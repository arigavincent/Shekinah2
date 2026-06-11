-- +goose Up
INSERT INTO users (
    name,
    email,
    password_hash,
    role,
    is_active
)
VALUES (
    'Vincent Ariga',
    'vincent@example.com',
    crypt('password123', gen_salt('bf')),
    'admin',
    true
)
ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    is_active = true,
    updated_at = now();

-- +goose Down
DELETE FROM users
WHERE email = 'vincent@example.com';
