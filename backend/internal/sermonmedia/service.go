package sermonmedia

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	adminsermons "github.com/ariga/shekinah-backend/internal/admin/sermons"
)

// Service keeps sermon media in step with where it is hosted: it reserves
// Cloudflare Stream uploads, marks them ready once encoded, turns recorded
// live services into sermons, and pulls episodes from the podcast feed.
type Service struct {
	stream     StreamClient
	sermons    adminsermons.Service
	repository adminsermons.Repository
	db         *pgxpool.Pool
	podcast    PodcastFetcher
	mu         *sync.Mutex
}

func NewService(stream StreamClient, sermons adminsermons.Service, repository adminsermons.Repository, db *pgxpool.Pool) Service {
	return Service{
		stream:     stream,
		sermons:    sermons,
		repository: repository,
		db:         db,
		podcast:    NewPodcastFetcher(),
		mu:         &sync.Mutex{},
	}
}

type StartUploadRequest struct {
	SizeBytes   int64  `json:"sizeBytes"`
	FileName    string `json:"fileName"`
	Code        string `json:"code"`
	Title       string `json:"title"`
	Speaker     string `json:"speaker"`
	SermonDate  string `json:"sermonDate"`
	PublishedAt string `json:"publishedAt"`
	CategoryID  string `json:"categoryId"`
	Description string `json:"description"`
}

type StartUploadResult struct {
	UploadURL string              `json:"uploadUrl"`
	Sermon    adminsermons.Sermon `json:"sermon"`
}

// StartUpload creates the sermon in "processing" state and returns the
// resumable upload URL the dashboard sends the video file to.
func (s Service) StartUpload(ctx context.Context, req StartUploadRequest) (StartUploadResult, error) {
	title := strings.TrimSpace(req.Title)
	if title == "" {
		return StartUploadResult{}, adminsermons.ErrInvalidInput
	}

	// Sermons and services can run long; allow up to 6 hours.
	uploadURL, uid, err := s.stream.CreateTusUpload(ctx, req.SizeBytes, title, 6*60*60)
	if err != nil {
		return StartUploadResult{}, err
	}

	sermon, err := s.sermons.Create(ctx, adminsermons.CreateRequest{
		Type:        "video",
		Code:        req.Code,
		Title:       title,
		Speaker:     req.Speaker,
		SermonDate:  req.SermonDate,
		PublishedAt: req.PublishedAt,
		CategoryID:  req.CategoryID,
		Description: req.Description,
		Source:      adminsermons.SourceCloudflareStream,
		StreamUID:   uid,
		Status:      adminsermons.StatusProcessing,
	})
	if err != nil {
		return StartUploadResult{}, err
	}

	return StartUploadResult{UploadURL: uploadURL, Sermon: sermon}, nil
}

type SyncReport struct {
	Ready           int      `json:"ready"`
	Failed          int      `json:"failed"`
	StillProcessing int      `json:"stillProcessing"`
	RecordingsAdded int      `json:"recordingsAdded"`
	PodcastAdded    int      `json:"podcastAdded"`
	PodcastUpdated  int      `json:"podcastUpdated"`
	Errors          []string `json:"errors,omitempty"`
}

// Sync runs every step once. It is safe to call from the scheduler and from
// the admin "Sync now" button at the same time.
func (s Service) Sync(ctx context.Context) SyncReport {
	s.mu.Lock()
	defer s.mu.Unlock()

	report := SyncReport{}

	if s.stream.Configured() {
		if err := s.refreshProcessing(ctx, &report); err != nil {
			report.Errors = append(report.Errors, err.Error())
		}
		if err := s.importLiveRecordings(ctx, &report); err != nil {
			report.Errors = append(report.Errors, err.Error())
		}
	}

	if err := s.syncPodcast(ctx, &report); err != nil {
		report.Errors = append(report.Errors, err.Error())
	}

	return report
}

// Run syncs on an interval until the context is cancelled.
func (s Service) Run(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		report := s.Sync(ctx)
		if len(report.Errors) > 0 {
			log.Printf("sermon media sync: %s", strings.Join(report.Errors, "; "))
		}

		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (s Service) refreshProcessing(ctx context.Context, report *SyncReport) error {
	items, err := s.repository.ListByStatus(ctx, adminsermons.StatusProcessing)
	if err != nil {
		return err
	}

	for _, item := range items {
		if item.StreamUID == "" {
			continue
		}

		video, err := s.stream.GetVideo(ctx, item.StreamUID)
		if err != nil {
			report.Errors = append(report.Errors, fmt.Sprintf("%s: %v", item.ID, err))
			continue
		}

		switch {
		case video.ReadyToStream && video.HLSURL != "":
			update := readyUpdate(item, video)
			if _, err := s.sermons.Update(ctx, item.ID, update); err != nil {
				report.Errors = append(report.Errors, fmt.Sprintf("%s: %v", item.ID, err))
				continue
			}
			report.Ready++
		case video.State == "error":
			status := adminsermons.StatusError
			if _, err := s.sermons.Update(ctx, item.ID, adminsermons.UpdateRequest{Status: &status}); err != nil {
				report.Errors = append(report.Errors, fmt.Sprintf("%s: %v", item.ID, err))
				continue
			}
			report.Failed++
		default:
			report.StillProcessing++
		}
	}

	return nil
}

func readyUpdate(item adminsermons.Sermon, video StreamVideo) adminsermons.UpdateRequest {
	status := adminsermons.StatusReady
	media := video.HLSURL
	update := adminsermons.UpdateRequest{Status: &status, MediaURL: &media}

	if item.ThumbnailURL == "" && video.ThumbnailURL != "" {
		thumb := video.ThumbnailURL
		update.ThumbnailURL = &thumb
	}
	if item.Duration == "" {
		if duration := FormatDuration(video.DurationSec); duration != "" {
			update.Duration = &duration
		}
	}
	return update
}

func (s Service) liveInput(ctx context.Context) (string, string, error) {
	var uid, title string
	err := s.db.QueryRow(ctx, `
		SELECT COALESCE(cloudflare_live_input_id, ''), COALESCE(title, '')
		FROM live_stream_config
		WHERE id = 'main'
	`).Scan(&uid, &title)
	if err != nil {
		return "", "", fmt.Errorf("read live config: %w", err)
	}
	return strings.TrimSpace(uid), strings.TrimSpace(title), nil
}

// importLiveRecordings turns each finished live-service recording into a
// video sermon, once. Admins can then edit the title, code and category.
func (s Service) importLiveRecordings(ctx context.Context, report *SyncReport) error {
	liveInputUID, liveTitle, err := s.liveInput(ctx)
	if err != nil || liveInputUID == "" {
		return err
	}

	videos, err := s.stream.ListLiveInputVideos(ctx, liveInputUID)
	if err != nil {
		return err
	}

	for _, video := range videos {
		// A recording still in progress or encoding is picked up next time.
		if !video.ReadyToStream || video.HLSURL == "" || video.State == "live-inprogress" {
			continue
		}

		if _, err := s.repository.FindByStreamUID(ctx, video.UID); err == nil {
			continue
		} else if !errors.Is(err, adminsermons.ErrNotFound) {
			report.Errors = append(report.Errors, err.Error())
			continue
		}

		recordedAt := video.CreatedAt
		if recordedAt.IsZero() {
			recordedAt = time.Now()
		}
		local := recordedAt.In(eastAfrica)

		title := liveTitle
		if title == "" || strings.EqualFold(title, "live stream") {
			title = "Live Service"
		}
		title = fmt.Sprintf("%s · %s", title, local.Format("2 Jan 2006"))

		_, err := s.sermons.Create(ctx, adminsermons.CreateRequest{
			Type:         "video",
			Title:        title,
			Speaker:      "Shekinah Sons Global",
			SermonDate:   local.Format("2006-01-02"),
			PublishedAt:  recordedAt.UTC().Format(time.RFC3339),
			ThumbnailURL: video.ThumbnailURL,
			Duration:     FormatDuration(video.DurationSec),
			Description:  fmt.Sprintf("Recorded live service from %s.", local.Format("Monday, 2 January 2006")),
			MediaURL:     video.HLSURL,
			Source:       adminsermons.SourceLiveRecording,
			StreamUID:    video.UID,
			Status:       adminsermons.StatusReady,
		})
		if err != nil {
			report.Errors = append(report.Errors, fmt.Sprintf("recording %s: %v", video.UID, err))
			continue
		}
		report.RecordingsAdded++
	}

	return nil
}

var eastAfrica = func() *time.Location {
	if loc, err := time.LoadLocation("Africa/Nairobi"); err == nil {
		return loc
	}
	return time.FixedZone("EAT", 3*60*60)
}()
