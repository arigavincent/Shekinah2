-- +goose Up

INSERT INTO users (
    name,
    email,
    password_hash,
    role,
    is_active
)
VALUES
    (
        'Grace Member',
        'grace.member@example.com',
        crypt('password123', gen_salt('bf')),
        'member',
        true
    ),
    (
        'Daniel Member',
        'daniel.member@example.com',
        crypt('password123', gen_salt('bf')),
        'member',
        true
    )
ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    is_active = true,
    updated_at = now();

-- +goose Down

DELETE FROM users
WHERE email IN ('grace.member@example.com', 'daniel.member@example.com');
