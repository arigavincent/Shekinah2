-- +goose Up
-- Anonymous prayer requests keep no email; staff never see who sent them.
UPDATE prayers SET owner_email = '' WHERE name = 'Anonymous' AND owner_email <> '';

-- +goose Down
SELECT 1;
