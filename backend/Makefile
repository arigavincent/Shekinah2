DATABASE_URL ?= postgres://shekinah:shekinah@localhost:55432/shekinah?sslmode=disable

.PHONY: run test test-integration migrate-up migrate-down migrate-status db-reset

run:
	go run ./cmd/api

test:
	GOCACHE=/tmp/shekinah-go-cache GOMODCACHE=/tmp/shekinah-go-mod go test ./...

test-integration:
	TEST_DATABASE_URL="$(DATABASE_URL)" GOCACHE=/tmp/shekinah-go-cache GOMODCACHE=/tmp/shekinah-go-mod go test ./internal/server -run TestFreshDatabaseAuthHomeAdminAndNotifications -count=1 -v

migrate-up:
	goose -dir migrations postgres "$(DATABASE_URL)" up

migrate-down:
	goose -dir migrations postgres "$(DATABASE_URL)" down

migrate-status:
	goose -dir migrations postgres "$(DATABASE_URL)" status

db-reset:
	goose -dir migrations postgres "$(DATABASE_URL)" reset
	goose -dir migrations postgres "$(DATABASE_URL)" up
