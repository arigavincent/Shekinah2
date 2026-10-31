package server

import (
	"context"
	"github.com/ariga/shekinah-backend/internal/admin"
	adminbranches "github.com/ariga/shekinah-backend/internal/admin/branches"
	admincategories "github.com/ariga/shekinah-backend/internal/admin/categories"
	admindevotions "github.com/ariga/shekinah-backend/internal/admin/devotions"
	adminevents "github.com/ariga/shekinah-backend/internal/admin/events"
	adminlibrary "github.com/ariga/shekinah-backend/internal/admin/library"
	adminliveconfig "github.com/ariga/shekinah-backend/internal/admin/liveconfig"
	adminmedia "github.com/ariga/shekinah-backend/internal/admin/media"
	adminprayers "github.com/ariga/shekinah-backend/internal/admin/prayers"
	adminreadingplans "github.com/ariga/shekinah-backend/internal/admin/readingplans"
	adminsermons "github.com/ariga/shekinah-backend/internal/admin/sermons"
	"github.com/ariga/shekinah-backend/internal/admin/superadmin"
	adminupdates "github.com/ariga/shekinah-backend/internal/admin/updates"
	"github.com/ariga/shekinah-backend/internal/apibible"
	"github.com/ariga/shekinah-backend/internal/attendance"
	"github.com/ariga/shekinah-backend/internal/auth"
	"github.com/ariga/shekinah-backend/internal/bibleaudio"
	"github.com/ariga/shekinah-backend/internal/bibleversions"
	"github.com/ariga/shekinah-backend/internal/books"
	"github.com/ariga/shekinah-backend/internal/checkins"
	"github.com/ariga/shekinah-backend/internal/community"
	"github.com/ariga/shekinah-backend/internal/config"
	"github.com/ariga/shekinah-backend/internal/content"
	"github.com/ariga/shekinah-backend/internal/eventreg"
	"github.com/ariga/shekinah-backend/internal/giving"
	"github.com/ariga/shekinah-backend/internal/health"
	"github.com/ariga/shekinah-backend/internal/httpx"
	"github.com/ariga/shekinah-backend/internal/integrations"
	"github.com/ariga/shekinah-backend/internal/library"
	"github.com/ariga/shekinah-backend/internal/live"
	"github.com/ariga/shekinah-backend/internal/notifications"
	"github.com/ariga/shekinah-backend/internal/overview"
	"github.com/ariga/shekinah-backend/internal/permissions"
	"github.com/ariga/shekinah-backend/internal/prayers"
	"github.com/ariga/shekinah-backend/internal/privatechat"
	"github.com/ariga/shekinah-backend/internal/readingplans"
	"github.com/ariga/shekinah-backend/internal/sermonmedia"
	"github.com/ariga/shekinah-backend/internal/serve"
	"github.com/ariga/shekinah-backend/internal/settings"
	"github.com/ariga/shekinah-backend/internal/testimonies"
	"github.com/ariga/shekinah-backend/internal/uploads"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"time"
)

// StartBackground runs scheduled jobs until ctx is cancelled.
func StartBackground(ctx context.Context, cfg config.Config, db *pgxpool.Pool) {
	providers := integrations.Store{DB: db, Secret: cfg.JWTSecret}
	repository := adminsermons.NewRepository(db)
	media := sermonmedia.NewService(
		sermonmedia.NewStreamClient(cfg.CloudflareAccountID, cfg.CloudflareStreamAPIToken),
		adminsermons.NewService(repository),
		repository,
		db,
	)
	media = media.WithIntegrations(providers)
	go media.Run(ctx, 2*time.Minute)
	go func() {
		h := uploads.New(db, permissions.New(db))
		t := time.NewTicker(time.Hour)
		defer t.Stop()
		for {
			h.Cleanup(ctx)
			select {
			case <-ctx.Done():
				return
			case <-t.C:
			}
		}
	}()
}

func New(cfg config.Config, db *pgxpool.Pool) *gin.Engine { return newRouter(cfg, db, nil) }
func NewWithContext(ctx context.Context, cfg config.Config, db *pgxpool.Pool) *gin.Engine {
	return newRouter(cfg, db, ctx)
}
func newRouter(cfg config.Config, db *pgxpool.Pool, background context.Context) *gin.Engine {
	if cfg.AppEnv == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(httpx.CORS(cfg.AllowedOrigins))

	r.Use(httpx.RequestID())
	r.Use(httpx.Logger())
	r.Use(httpx.Recoverer())
	r.Use(httpx.JSONHeaders())

	providers := integrations.Store{DB: db, Secret: cfg.JWTSecret}
	contentRepository := content.NewRepository(db)
	contentService := content.NewService(contentRepository)
	contentHandler := content.NewHandler(contentService)

	authRepository := auth.NewRepository(db)
	authService := auth.NewService(authRepository, cfg.JWTSecret)
	authHandler := auth.NewHandler(authService)

	adminDevotionRepository := admindevotions.NewRepository(db)
	adminDevotionService := admindevotions.NewService(adminDevotionRepository)
	adminDevotionHandler := admindevotions.NewHandler(adminDevotionService)
	adminHandler := admin.NewHandler()
	adminSermonRepository := adminsermons.NewRepository(db)
	adminSermonService := adminsermons.NewService(adminSermonRepository)
	adminSermonHandler := adminsermons.NewHandler(adminSermonService)
	sermonMediaService := sermonmedia.NewService(
		sermonmedia.NewStreamClient(cfg.CloudflareAccountID, cfg.CloudflareStreamAPIToken),
		adminSermonService,
		adminSermonRepository,
		db,
	)
	sermonMediaService = sermonMediaService.WithIntegrations(providers)
	sermonMediaHandler := sermonmedia.NewHandler(sermonMediaService)
	adminCategoryHandler := admincategories.NewHandler(admincategories.NewService(admincategories.NewRepository(db)))

	adminEventRepository := adminevents.NewRepository(db)
	adminEventService := adminevents.NewService(adminEventRepository)
	adminEventHandler := adminevents.NewHandler(adminEventService)

	adminUpdateRepository := adminupdates.NewRepository(db)
	adminUpdateService := adminupdates.NewService(adminUpdateRepository)
	adminUpdateHandler := adminupdates.NewHandler(adminUpdateService)

	adminBranchRepository := adminbranches.NewRepository(db)
	adminBranchService := adminbranches.NewService(adminBranchRepository)
	adminBranchHandler := adminbranches.NewHandler(adminBranchService)

	adminLiveConfigRepository := adminliveconfig.NewRepository(db)
	adminLiveConfigService := adminliveconfig.NewService(adminLiveConfigRepository, cfg).WithIntegrations(providers)
	adminLiveConfigHandler := adminliveconfig.NewHandler(adminLiveConfigService)
	adminPrayerRepository := adminprayers.NewRepository(db)
	adminPrayerService := adminprayers.NewService(adminPrayerRepository)
	adminPrayerHandler := adminprayers.NewHandler(adminPrayerService)
	adminLibraryHandler := adminlibrary.NewHandler(db)
	adminReadingPlanHandler := adminreadingplans.NewHandler(db)
	adminMediaHandler := adminmedia.NewHandler().WithIntegrations(providers)
	givingHandler := giving.NewHandler(db, cfg.JWTSecret).WithProviderClient(cfg.ProviderHTTPClient)
	notificationHandler := notifications.NewHandler(db).WithIntegrations(providers)
	prayerHandler := prayers.NewHandler(db)
	perms := permissions.New(db)
	uploadHandler := uploads.New(db, perms)
	eventReg := eventreg.NewHandler(db)
	serveTeams := serve.NewTeams(db, cfg.JWTSecret)
	attendanceHandler := attendance.NewHandler(db)
	communityHandler := community.NewHandler(db, perms)
	liveHandler := live.NewHandler(db, notificationHandler, communityHandler)
	liveHandler.UseAccess(authService, func(ctx context.Context, userID string) bool {
		return perms.Has(ctx, userID, permissions.LiveBroadcast) || perms.Has(ctx, userID, permissions.LiveModerate)
	})
	// Moves broadcasts from "starting" to "live" and ends dropped ones.
	if background != nil {
		go liveHandler.Watch(background)
		go liveHandler.ArchiveWatch(background)
		go notificationHandler.PublishWatch(background)
	}
	testimonyHandler := testimonies.NewHandler(db)
	readingPlanHandler := readingplans.NewHandler(db)
	checkinHandler := checkins.NewHandler(db)
	bibleVersionsHandler := bibleversions.NewHandler(db, cfg)
	apiBibleHandler := apibible.NewHandler(cfg).WithIntegrations(providers)
	privateChatHandler := privatechat.NewHandler(db)
	libraryHandler := library.NewHandler(db)
	settingsHandler := settings.NewHandler(db, cfg.JWTSecret).WithProviderClient(cfg.ProviderHTTPClient)
	serveHandler := serve.NewHandler()

	r.GET("/healthz", health.HandleHealthz(cfg, db))
	r.Static("/uploads", "./uploads")

	audioHandler := bibleaudio.NewHandler().WithIntegrations(providers)
	r.GET("/api/v1/bible/audio/:version/:book/:chapter", audioHandler.Chapter)
	api := r.Group("/api/v1")
	{
		api.GET("/healthz", health.HandleHealthz(cfg, db))
		api.GET("/home", contentHandler.Home)
		api.POST("/giving/mpesa/stk-push", auth.RequireAuth(authService), givingHandler.STKPush)
		api.POST("/giving/mpesa/callback", givingHandler.Callback)
		api.POST("/giving/card/checkout", auth.RequireAuth(authService), givingHandler.CardCheckout)
		api.GET("/giving/card/return", givingHandler.CardReturn)
		api.GET("/giving/transactions/:id", auth.OptionalAuth(authService), givingHandler.GetTransaction)
		api.GET("/giving/details", givingHandler.Details)
		api.POST("/giving/confirm", auth.OptionalAuth(authService), givingHandler.Confirm)
		api.GET("/giving/mine", auth.RequireAuth(authService), givingHandler.Mine)
		api.GET("/giving/transactions/:id/receipt.pdf", auth.OptionalAuth(authService), givingHandler.DownloadReceipt)
		api.GET("/giving/transactions/:id/invoice.pdf", auth.OptionalAuth(authService), givingHandler.DownloadInvoice)
		api.POST("/notifications/register", notificationHandler.RegisterDevice)
		api.PATCH("/notifications/preferences", notificationHandler.UpdatePreferences)
		api.GET("/notifications/feed", notificationHandler.Feed)
		api.GET("/prayer-requests", prayerHandler.ListPublic)
		api.POST("/prayer-requests", auth.RequireAuth(authService), prayerHandler.Create)
		api.GET("/prayer-requests/mine", auth.RequireAuth(authService), prayerHandler.ListMine)
		api.POST("/prayer-requests/:id/pray", auth.RequireAuth(authService), prayerHandler.Pray)
		api.POST("/uploads", auth.RequireAuth(authService), uploadHandler.Create)
		api.GET("/uploads/:id", auth.RequireAuth(authService), uploadHandler.Get)
		api.PATCH("/uploads/:id", auth.RequireAuth(authService), uploadHandler.Chunk)
		api.POST("/uploads/:id/finish", auth.RequireAuth(authService), uploadHandler.Finish)
		api.DELETE("/uploads/:id", auth.RequireAuth(authService), uploadHandler.Cancel)
		api.GET("/permissions/me", auth.RequireAuth(authService), perms.Mine)
		api.GET("/live/replays", auth.OptionalAuth(authService), liveHandler.Replays)
		api.GET("/live/replays/:id/file", auth.OptionalAuth(authService), liveHandler.Replay)
		directPublish := []gin.HandlerFunc{auth.RequireAuth(authService), perms.Require(permissions.LiveBroadcast)}
		api.POST("/live/direct/:id/segments", append(directPublish, liveHandler.DirectPrepare)...)
		api.POST("/live/direct/:id/segments/:sequence/commit", append(directPublish, liveHandler.DirectCommit)...)
		api.GET("/live/direct/:id/status", append(directPublish, liveHandler.DirectStatus)...)
		api.GET("/live/direct/:id/key", auth.OptionalAuth(authService), liveHandler.DirectKey)
		api.GET("/live/direct/:id/index.m3u8", auth.OptionalAuth(authService), liveHandler.DirectPlaylist)
		api.GET("/live/current", auth.OptionalAuth(authService), liveHandler.Current)
		api.GET("/events/:id/registration", auth.OptionalAuth(authService), eventReg.Get)
		api.POST("/events/:id/register", auth.RequireAuth(authService), eventReg.Register)
		api.DELETE("/events/:id/register", auth.RequireAuth(authService), eventReg.Cancel)
		api.POST("/live/heartbeat", liveHandler.Heartbeat)
		api.POST("/live/mediamtx-auth", liveHandler.MediaMTXAuth)
		api.POST("/live/start", auth.RequireAuth(authService), perms.Require(permissions.LiveBroadcast), perms.Audit(), liveHandler.Start)
		api.POST("/live/stop", auth.RequireAuth(authService), perms.Require(permissions.LiveBroadcast), perms.Audit(), liveHandler.Stop)
		mod := []gin.HandlerFunc{auth.RequireAuth(authService), perms.Require(permissions.LiveModerate)}
		api.GET("/live/chat/messages", append(mod, communityHandler.ModMessages)...)
		api.GET("/live/chat/settings", append(mod, communityHandler.GetLiveChatSettings)...)
		api.GET("/live/chat/status", communityHandler.LiveChatStatus)
		api.PUT("/live/chat/settings", append(mod, communityHandler.UpdateLiveChatSettings)...)
		api.POST("/live/chat/messages/:id/hide", append(mod, communityHandler.ModHide)...)
		api.POST("/live/chat/messages/:id/pin", append(mod, communityHandler.ModPin)...)
		api.GET("/live/chat/bans", append(mod, communityHandler.ModBans)...)
		api.POST("/live/chat/bans", append(mod, communityHandler.ModBan)...)
		api.DELETE("/live/chat/bans/:userId", append(mod, communityHandler.ModUnban)...)
		api.GET("/community/messages", communityHandler.List)
		api.GET("/community/live/stream", communityHandler.LiveStream)
		api.POST("/community/messages/:id/report", auth.RequireAuth(authService), communityHandler.Report)
		api.POST("/community/messages", auth.RequireAuth(authService), communityHandler.Create)
		api.GET("/testimonies", testimonyHandler.List)
		api.GET("/testimonies/mine", auth.RequireAuth(authService), testimonyHandler.ListMine)
		api.POST("/testimonies", auth.RequireAuth(authService), testimonyHandler.Create)
		api.POST("/testimonies/:id/like", auth.RequireAuth(authService), testimonyHandler.Like)
		api.GET("/reading-plans", readingPlanHandler.List)
		api.GET("/reading-plans/mine", auth.RequireAuth(authService), readingPlanHandler.List)
		api.GET("/reading-plans/:id", readingPlanHandler.Detail)
		api.GET("/reading-plans/:id/mine", auth.RequireAuth(authService), readingPlanHandler.Detail)
		api.POST("/reading-plans/:id/days/:day/complete", auth.RequireAuth(authService), readingPlanHandler.CompleteDay)
		api.PUT("/reading-plans/:id/days/:day/note", auth.RequireAuth(authService), readingPlanHandler.SaveNote)
		api.PATCH("/reading-plans/:id/reminder", auth.RequireAuth(authService), readingPlanHandler.UpdateReminder)
		api.GET("/checkin/code", auth.RequireAuth(authService), checkinHandler.MemberCode)
		api.GET("/checkin/history", auth.RequireAuth(authService), checkinHandler.Mine)
		booksHandler := books.NewHandler(db, perms)
		api.GET("/library", auth.OptionalAuth(authService), booksHandler.List)
		api.GET("/library/:id/file", auth.OptionalAuth(authService), booksHandler.File)
		api.POST("/library", auth.RequireAuth(authService), perms.Require(permissions.BooksPublish), perms.Audit(), booksHandler.Publish)
		api.PATCH("/library/:id", auth.RequireAuth(authService), perms.Require(permissions.BooksPublish), perms.Audit(), booksHandler.Update)
		api.GET("/library/:id", libraryHandler.Detail)
		api.GET("/settings/ministry", settingsHandler.Ministry)
		api.GET("/settings/serve", settingsHandler.GetServe)
		api.GET("/serve/teams", auth.OptionalAuth(authService), serveTeams.List)
		api.POST("/serve/requests", auth.RequireAuth(authService), serveTeams.Request)
		scan := []gin.HandlerFunc{auth.RequireAuth(authService), perms.Require(permissions.CheckinScan)}
		api.POST("/attendance/scan", append(scan, attendanceHandler.Scan)...)
		api.GET("/attendance", append(scan, attendanceHandler.List)...)
		api.GET("/attendance/report.pdf", append(scan, attendanceHandler.PDF)...)
		api.POST("/reading-plans/:id/start", auth.RequireAuth(authService), readingPlanHandler.Start)
		api.DELETE("/reading-plans/:id/start", auth.RequireAuth(authService), readingPlanHandler.Leave)
		api.DELETE("/reading-plans/:id/days/:day/complete", auth.RequireAuth(authService), readingPlanHandler.UncompleteDay)
		api.POST("/serve/request-pdf", serveHandler.UploadRequestPDF)
		api.GET("/bible/versions", bibleVersionsHandler.List)
		api.GET("/bible/versions/:id/download", bibleVersionsHandler.Download)
		api.GET("/bible/provider/api-bible/versions", apiBibleHandler.ListBibles)
		api.GET("/bible/provider/api-bible/audio-bibles", apiBibleHandler.ListAudioBibles)
		api.GET("/bible/provider/api-bible/audio-bibles/:audioBibleId/chapters/:chapterId", apiBibleHandler.GetAudioChapter)
		api.GET("/bible/provider/api-bible/versions/:bibleId/export-vpl", apiBibleHandler.ExportVPL)
		api.GET("/bible/installs", auth.RequireAuth(authService), bibleVersionsHandler.ListInstalled)
		api.POST("/bible/installs", auth.RequireAuth(authService), bibleVersionsHandler.RecordInstall)
		api.POST("/private-chat/device", auth.RequireAuth(authService), privateChatHandler.RegisterDevice)
		api.GET("/private-chat/members/:id", auth.RequireAuth(authService), privateChatHandler.MemberProfile)
		api.GET("/private-chat/requests", auth.RequireAuth(authService), privateChatHandler.ListRequests)
		api.POST("/private-chat/requests", auth.RequireAuth(authService), privateChatHandler.CreateRequest)
		api.POST("/private-chat/requests/:id/respond", auth.RequireAuth(authService), privateChatHandler.RespondRequest)
		api.GET("/private-chat/contacts", auth.RequireAuth(authService), privateChatHandler.Contacts)
		api.POST("/private-chat/threads", auth.RequireAuth(authService), privateChatHandler.CreateThread)
		api.GET("/private-chat/threads", auth.RequireAuth(authService), privateChatHandler.ListThreads)
		api.GET("/private-chat/threads/:id/messages", auth.RequireAuth(authService), privateChatHandler.ListMessages)
		api.POST("/private-chat/threads/:id/messages", auth.RequireAuth(authService), privateChatHandler.SendMessage)

		authGroup := api.Group("/auth")
		{
			authGroup.POST("/register", authHandler.Register)
			authGroup.POST("/login", authHandler.Login)
			authGroup.POST("/password-reset/request", authHandler.RequestPasswordReset)
			authGroup.POST("/password-reset/confirm", authHandler.ConfirmPasswordReset)
			authGroup.GET("/me", auth.RequireAuth(authService), authHandler.Me)
			authGroup.PATCH("/password", auth.RequireAuth(authService), authHandler.ChangePassword)
		}

		adminGroup := api.Group("/admin")
		adminGroup.Use(auth.RequireAuth(authService), perms.StaffRoute(), perms.Audit())
		{
			adminGroup.GET("/healthz", adminHandler.Healthz)
			adminGroup.GET("/settings/integrations", settingsHandler.Integrations)
			adminGroup.PUT("/settings/integrations/:provider", settingsHandler.UpdateIntegration)
			adminGroup.POST("/settings/integrations/:provider/check", settingsHandler.CheckIntegration)
			adminGroup.GET("/settings/readiness", settingsHandler.Readiness)
			adminGroup.GET("/settings/smtp", settingsHandler.SMTP)
			adminGroup.PUT("/settings/smtp", settingsHandler.UpdateSMTP)
			adminGroup.POST("/settings/smtp/check", settingsHandler.CheckSMTP)
			adminGroup.GET("/settings/production", settingsHandler.Production)
			adminGroup.PUT("/settings/production", settingsHandler.UpdateProduction)
			adminGroup.GET("/settings/ministry", settingsHandler.Ministry)
			adminGroup.PUT("/settings/ministry", settingsHandler.UpdateMinistry)
			adminGroup.GET("/settings/serve", settingsHandler.AdminGetServe)
			adminGroup.PATCH("/settings/serve", settingsHandler.AdminUpdateServe)

			adminGroup.GET("/sermons", adminSermonHandler.List)
			adminGroup.POST("/sermons", adminSermonHandler.Create)
			adminGroup.POST("/sermons/import/preview", adminSermonHandler.PreviewImport)
			adminGroup.POST("/sermons/import", adminSermonHandler.Import)
			adminGroup.GET("/sermon-categories", adminCategoryHandler.List)
			adminGroup.POST("/sermon-categories", adminCategoryHandler.Create)
			adminGroup.PATCH("/sermon-categories/:id", adminCategoryHandler.Update)
			adminGroup.DELETE("/sermon-categories/:id", adminCategoryHandler.Delete)
			adminGroup.POST("/sermons/stream-upload", sermonMediaHandler.StartStreamUpload)
			adminGroup.POST("/sermons/direct-upload", sermonMediaHandler.StartDirectUpload)
			adminGroup.GET("/sermons/storage", sermonMediaHandler.StorageStatus)
			adminGroup.POST("/sermons/sync", sermonMediaHandler.SyncNow)
			adminGroup.GET("/settings/podcast", sermonMediaHandler.GetPodcastSettings)
			adminGroup.PATCH("/settings/podcast", sermonMediaHandler.UpdatePodcastSettings)
			adminGroup.PATCH("/sermons/:id", adminSermonHandler.Update)
			adminGroup.DELETE("/sermons/:id", adminSermonHandler.Delete)

			adminGroup.GET("/devotions", adminDevotionHandler.List)
			adminGroup.POST("/devotions", adminDevotionHandler.Create)
			adminGroup.POST("/devotions/import/preview", adminDevotionHandler.PreviewImport)
			adminGroup.POST("/devotions/import", adminDevotionHandler.Import)
			adminGroup.PATCH("/devotions/:id", adminDevotionHandler.Update)
			adminGroup.DELETE("/devotions/:id", adminDevotionHandler.Delete)

			adminGroup.GET("/library", adminLibraryHandler.List)
			adminGroup.POST("/library", adminLibraryHandler.Create)
			adminGroup.PATCH("/library/:id", adminLibraryHandler.Update)
			adminGroup.DELETE("/library/:id", adminLibraryHandler.Delete)

			adminGroup.GET("/reading-plans", adminReadingPlanHandler.List)
			adminGroup.POST("/reading-plans", adminReadingPlanHandler.Create)
			adminGroup.PATCH("/reading-plans/:id", adminReadingPlanHandler.Update)
			adminGroup.DELETE("/reading-plans/:id", adminReadingPlanHandler.Delete)

			adminGroup.GET("/events", adminEventHandler.List)
			adminGroup.POST("/events", adminEventHandler.Create)
			adminGroup.PATCH("/events/:id", adminEventHandler.Update)
			adminGroup.DELETE("/events/:id", adminEventHandler.Delete)

			adminGroup.GET("/updates", adminUpdateHandler.List)
			adminGroup.POST("/updates", adminUpdateHandler.Create)
			adminGroup.PATCH("/updates/:id", adminUpdateHandler.Update)
			adminGroup.DELETE("/updates/:id", adminUpdateHandler.Delete)

			adminGroup.GET("/branches", adminBranchHandler.List)
			adminGroup.POST("/branches", adminBranchHandler.Create)
			adminGroup.PATCH("/branches/:id", adminBranchHandler.Update)
			adminGroup.DELETE("/branches/:id", adminBranchHandler.Delete)

			adminGroup.GET("/live-config", adminLiveConfigHandler.Get)
			adminGroup.POST("/live-config/cloudflare/live-input", adminLiveConfigHandler.CreateCloudflareLiveInput)
			adminGroup.DELETE("/live-config/cloudflare/live-input", adminLiveConfigHandler.ResetCloudflareLiveInput)
			adminGroup.PATCH("/live-config", adminLiveConfigHandler.Update)
			adminGroup.GET("/prayers", adminPrayerHandler.List)
			adminGroup.PATCH("/prayers/:id", adminPrayerHandler.Update)
			adminGroup.POST("/media", adminMediaHandler.Upload)
			adminGroup.GET("/members", perms.AdminListMembers)
			adminGroup.PATCH("/members/:id/permissions", perms.AdminSetPermissions)
			adminGroup.GET("/permissions/log", perms.AdminPermissionLog)
			adminGroup.POST("/members/:id/reset-password", authHandler.AdminSendReset)
			adminGroup.GET("/serve", serveTeams.AdminOverview)
			adminGroup.PUT("/serve/teams/:id", serveTeams.AdminSaveTeam)
			adminGroup.DELETE("/serve/teams/:id", serveTeams.AdminDeleteTeam)
			adminGroup.PATCH("/serve/requests/:id", serveTeams.AdminUpdateRequest)
			adminGroup.PUT("/serve/contact", serveTeams.AdminSetContact)
			adminGroup.GET("/events/:id/registration", eventReg.Get)
			adminGroup.PUT("/events/:id/registration", eventReg.AdminSetup)
			adminGroup.GET("/events/:id/registrations", eventReg.AdminList)
			adminGroup.GET("/events/:id/registrations.csv", eventReg.AdminCSV)
			adminGroup.GET("/overview", overview.Handle(db))
			adminGroup.GET("/giving/analytics", overview.AnalyticsHandler(db))
			adminGroup.GET("/giving/transactions", givingHandler.ListTransactions)
			adminGroup.GET("/giving/details", givingHandler.Details)
			adminGroup.PUT("/giving/details", givingHandler.AdminUpdateDetails)
			adminGroup.PATCH("/giving/transactions/:id", givingHandler.AdminReview)
			adminGroup.GET("/giving/transactions/:id/receipt.pdf", givingHandler.DownloadReceipt)
			adminGroup.GET("/giving/transactions/:id/invoice.pdf", givingHandler.DownloadInvoice)
			adminGroup.GET("/notifications/messages", notificationHandler.ListMessages)
			adminGroup.POST("/notifications/broadcast", notificationHandler.Broadcast)
			adminGroup.GET("/community/reports", communityHandler.Reports)
			adminGroup.PATCH("/community/reports/:id", communityHandler.ResolveReport)
			adminGroup.GET("/community/messages", communityHandler.AdminList)
			adminGroup.PATCH("/community/messages/:id", communityHandler.AdminUpdate)
			adminGroup.DELETE("/community/messages/:id", communityHandler.Delete)
			adminGroup.GET("/testimonies", testimonyHandler.AdminList)
			adminGroup.PATCH("/testimonies/:id", testimonyHandler.AdminUpdate)
			adminGroup.GET("/checkins/recent", checkinHandler.Recent)
			adminGroup.POST("/checkins/verify", checkinHandler.Verify)
			// ─── Super Admin only routes ───────────────────────────────────
			saGroup := adminGroup.Group("")
			saGroup.Use(func(c *gin.Context) {
				userID, ok := auth.UserIDFromContext(c)
				if !ok {
					c.AbortWithStatusJSON(401, gin.H{"message": "Unauthorized"})
					return
				}
				var role string
				_ = db.QueryRow(c.Request.Context(), `SELECT role FROM users WHERE id = $1`, userID).Scan(&role)
				if role != "super_admin" {
					c.AbortWithStatusJSON(403, gin.H{"message": "Super admin access required"})
					return
				}
				c.Next()
			})
			saHandler := superadmin.New(db)
			// Domain 1 – Identity
			saGroup.POST("/sa/users", saHandler.CreateUser)
			saGroup.GET("/sa/users/:id", saHandler.GetUserProfile)
			saGroup.PATCH("/sa/users/:id", saHandler.UpdateUser)
			saGroup.POST("/sa/users/:id/suspend", saHandler.ToggleUserSuspend)
			saGroup.DELETE("/sa/users/:id", saHandler.DeleteUser)
			// Domain 2 – Members
			saGroup.POST("/sa/members/:id/merge", saHandler.MergeMemberProfiles)
			saGroup.GET("/sa/members/:id/pastoral-notes", saHandler.ListPastoralNotes)
			saGroup.POST("/sa/members/:id/pastoral-notes", saHandler.CreatePastoralNote)
			saGroup.DELETE("/sa/members/:id/pastoral-notes/:noteId", saHandler.DeletePastoralNote)
			saGroup.DELETE("/sa/members/:id/purge-gdpr", saHandler.PurgeMemberDataGDPR)
			// Domain 3 – Finance
			saGroup.GET("/sa/finance/funds", saHandler.ListFunds)
			saGroup.PUT("/sa/finance/funds", saHandler.SaveFund)
			saGroup.POST("/sa/finance/transactions", saHandler.RecordManualTransaction)
			saGroup.POST("/sa/finance/transactions/:id/refund", saHandler.ProcessRefund)
			saGroup.DELETE("/sa/finance/transactions/:id", saHandler.HardDeleteFinancialEntry)
			saGroup.GET("/sa/members/:memberId/donation-statement", saHandler.GenerateDonorStatement)
			saGroup.GET("/sa/kiosks", saHandler.ListKiosks)
			saGroup.POST("/sa/kiosks", saHandler.PairKiosk)
			saGroup.PATCH("/sa/kiosks/:id/lock", saHandler.ToggleKioskLock)
			saGroup.DELETE("/sa/kiosks/:id", saHandler.UnbindKiosk)
			// Domain 4 – Groups
			saGroup.GET("/sa/groups", saHandler.ListGroups)
			saGroup.PUT("/sa/groups", saHandler.SaveGroup)
			saGroup.DELETE("/sa/groups/:id", saHandler.DeleteGroup)
			saGroup.GET("/sa/groups/:id/roster", saHandler.ListGroupRoster)
			saGroup.POST("/sa/groups/:id/roster", saHandler.AssignGroupMember)
			saGroup.DELETE("/sa/groups/:id/roster/:userId", saHandler.RemoveGroupMember)
			// Domain 5 – Attendance
			saGroup.GET("/sa/attendance/sessions", saHandler.ListAttendanceSessions)
			saGroup.POST("/sa/attendance/sessions", saHandler.CreateAttendanceSession)
			saGroup.PATCH("/sa/attendance/sessions/:id", saHandler.UpdateAttendanceSession)
			saGroup.DELETE("/sa/attendance/sessions/:id", saHandler.DeleteAttendanceSession)
			// Domain 7 – Comms Templates
			saGroup.GET("/sa/comm/templates", saHandler.ListTemplates)
			saGroup.PUT("/sa/comm/templates", saHandler.SaveTemplate)
			saGroup.DELETE("/sa/comm/templates/:id", saHandler.DeleteTemplate)
			// Domain 8 – API Keys & Webhooks
			saGroup.GET("/sa/api-keys", saHandler.ListApiKeys)
			saGroup.POST("/sa/api-keys", saHandler.CreateApiKey)
			saGroup.DELETE("/sa/api-keys/:id", saHandler.RevokeApiKey)
			saGroup.GET("/sa/webhooks", saHandler.ListWebhooks)
			saGroup.PUT("/sa/webhooks", saHandler.SaveWebhook)
			saGroup.POST("/sa/webhooks/:id/test", saHandler.TestWebhook)
			saGroup.DELETE("/sa/webhooks/:id", saHandler.DeleteWebhook)
			// Domain 9 – Governance
			saGroup.GET("/sa/audit-trail", saHandler.GetAuditTrail)
			saGroup.DELETE("/sa/audit-trail", saHandler.PurgeAuditTrail)
			saGroup.GET("/sa/system/modules", saHandler.GetSystemModules)
			saGroup.PUT("/sa/system/modules", saHandler.UpdateSystemModules)
			saGroup.POST("/sa/system/backup", saHandler.TriggerDatabaseBackup)

		}
	}

	return r
}
