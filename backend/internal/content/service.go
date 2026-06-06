package content

import (
	"context"
	"fmt"
)

type Service struct {
	repository Repository
}

func NewService(repository Repository) Service {
	return Service{repository: repository}
}

func (s Service) Home(ctx context.Context) (HomeResponse, error) {
	scripture, err := s.repository.LatestScripture(ctx)
	if err != nil {
		return HomeResponse{}, fmt.Errorf("load scripture: %w", err)
	}

	live, err := s.repository.LiveStream(ctx)
	if err != nil {
		return HomeResponse{}, fmt.Errorf("load live stream: %w", err)
	}

	devotions, err := s.repository.Devotions(ctx)
	if err != nil {
		return HomeResponse{}, fmt.Errorf("load devotions: %w", err)
	}

	sermons, err := s.repository.Sermons(ctx)
	if err != nil {
		return HomeResponse{}, fmt.Errorf("load sermons: %w", err)
	}

	categories, err := s.repository.Categories(ctx)
	if err != nil {
		return HomeResponse{}, fmt.Errorf("load categories: %w", err)
	}

	clips, err := s.repository.Clips(ctx)
	if err != nil {
		return HomeResponse{}, fmt.Errorf("load clips: %w", err)
	}

	events, err := s.repository.Events(ctx)
	if err != nil {
		return HomeResponse{}, fmt.Errorf("load events: %w", err)
	}

	branches, err := s.repository.Branches(ctx)
	if err != nil {
		return HomeResponse{}, fmt.Errorf("load branches: %w", err)
	}

	updates, err := s.repository.Updates(ctx)
	if err != nil {
		return HomeResponse{}, fmt.Errorf("load updates: %w", err)
	}

	platforms, err := s.repository.Platforms(ctx)
	if err != nil {
		return HomeResponse{}, fmt.Errorf("load platforms: %w", err)
	}

	downloads, err := s.repository.Downloads(ctx)
	if err != nil {
		return HomeResponse{}, fmt.Errorf("load downloads: %w", err)
	}

	prayers, err := s.repository.Prayers(ctx)
	if err != nil {
		return HomeResponse{}, fmt.Errorf("load prayers: %w", err)
	}

	about, err := s.repository.About(ctx)
	if err != nil {
		return HomeResponse{}, fmt.Errorf("load about: %w", err)
	}

	return HomeResponse{
		Scripture:  scripture,
		Live:       live,
		Devotions:  devotions,
		Sermons:    sermons,
		Categories: categories,
		Clips:      clips,
		Events:     events,
		Branches:   branches,
		Updates:    updates,
		Platforms:  platforms,
		Downloads:  downloads,
		Prayers:    prayers,
		About:      about,
	}, nil
}
