-- +goose Up
ALTER TABLE giving_transactions ADD COLUMN callback_token_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE giving_transactions ADD COLUMN client_request_id TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX giving_client_request ON giving_transactions(user_id,method,client_request_id) WHERE client_request_id<>'';
-- +goose Down
DROP INDEX giving_client_request;
ALTER TABLE giving_transactions DROP COLUMN client_request_id;
ALTER TABLE giving_transactions DROP COLUMN callback_token_hash;
