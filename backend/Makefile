DATABASE_URL ?= postgres://shekinah:shekinah@localhost:5432/shekinah?sslmode=disable

.PHONY: run migrate-up migrate-down migrate-status db-reset

run:
	go run ./cmd/api

migrate-up:
	goose -dir migrations postgres "$(DATABASE_URL)" up

migrate-down:
	goose -dir migrations postgres "$(DATABASE_URL)" down

migrate-status:
	goose -dir migrations postgres "$(DATABASE_URL)" status

db-reset:
	goose -dir migrations postgres "$(DATABASE_URL)" reset
	goose -dir migrations postgres "$(DATABASE_URL)" up
