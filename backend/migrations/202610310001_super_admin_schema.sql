-- +goose Up

-- 1. Identity & Member Extensions
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_status TEXT NOT NULL DEFAULT 'member' CHECK (membership_status IN ('member', 'visitor', 'transferred', 'archived', 'pastor', 'leader', 'staff'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS family_id UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS family_role TEXT NOT NULL DEFAULT 'head' CHECK (family_role IN ('head', 'spouse', 'child', 'other'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS family_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pastoral & Counseling Notes (confidential care logs)
CREATE TABLE IF NOT EXISTS pastoral_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    category TEXT NOT NULL DEFAULT 'pastoral' CHECK (category IN ('pastoral', 'counseling', 'prayer', 'benevolence', 'disciplinary')),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    is_confidential BOOLEAN NOT NULL DEFAULT true,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pastoral_notes_member ON pastoral_notes(member_id);

-- 3. Financial Funds (Chart of Accounts)
CREATE TABLE IF NOT EXISTS financial_funds (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    is_tax_deductible BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO financial_funds (id, name, code, description, is_tax_deductible, is_active) VALUES
('tithe', 'Tithe', '1010', 'General church tithes', true, true),
('offering', 'Offering', '1020', 'Regular Sunday and Midweek offerings', true, true),
('building', 'Building Fund', '2010', 'Sanctuary expansion and construction', true, true),
('missions', 'Missions & Outreach', '3010', 'Evangelism and community benevolence', true, true),
('special', 'Special Seed', '4010', 'Conference seed and guest minister honorariums', true, true)
ON CONFLICT (id) DO NOTHING;

-- Giving Kiosks and Mobile POS
CREATE TABLE IF NOT EXISTS giving_kiosks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    location TEXT NOT NULL DEFAULT '',
    is_locked BOOLEAN NOT NULL DEFAULT false,
    paired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_ping_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Groups, Ministries & Departments
CREATE TABLE IF NOT EXISTS ministry_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'department' CHECK (type IN ('department', 'small_group', 'committee', 'sunday_school', 'fellowship')),
    leader_id UUID REFERENCES users(id) ON DELETE SET NULL,
    location TEXT NOT NULL DEFAULT '',
    schedule TEXT NOT NULL DEFAULT '',
    max_capacity INTEGER NOT NULL DEFAULT 0,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_members (
    group_id TEXT NOT NULL REFERENCES ministry_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'assistant', 'member')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);

-- 5. Attendance Rosters & Sessions
CREATE TABLE IF NOT EXISTS attendance_sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    occasion TEXT NOT NULL,
    headcount INTEGER NOT NULL DEFAULT 0,
    kiosk_locked BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Communication Templates
CREATE TABLE IF NOT EXISTS comm_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'push', 'whatsapp')),
    subject TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL,
    variables TEXT[] NOT NULL DEFAULT '{}',
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO comm_templates (id, name, channel, subject, body, variables) VALUES
('welcome-sms', 'First Time Visitor SMS', 'sms', '', 'Welcome to Shekinah Sons Global, {name}! We are honored to have you worship with us today. May God bless your week.', '{"name"}'),
('service-live-push', 'Service Live Alert', 'push', 'We Are Live! 🙌', 'Join Sir Joseph Mash for today''s service streaming live right now.', '{}'),
('tithe-receipt-email', 'Donation Receipt Email', 'email', 'Donation Receipt: Shekinah Sons Global', 'Dear {name}, thank you for your contribution of {amount} towards {category}. Ref: {reference}.', '{"name", "amount", "category", "reference"}')
ON CONFLICT (id) DO NOTHING;

-- 8. API Keys & Webhooks
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    permissions TEXT[] NOT NULL DEFAULT '{}',
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhooks (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    events TEXT[] NOT NULL DEFAULT '{}',
    secret TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_status INTEGER NOT NULL DEFAULT 0,
    last_triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. System Governance Modules & Security
INSERT INTO app_settings (key, value) VALUES
('system_modules', '{"onlineGiving":true,"counseling":true,"volunteerScheduling":true,"livestream":true,"communityChat":true,"attendanceKiosk":true,"taxStatements":true}'),
('security_policies', '{"mfaEnforced":false,"sessionTimeoutMinutes":120,"ipWhitelist":[],"passwordExpiryDays":90,"minPasswordLength":8}')
ON CONFLICT (key) DO NOTHING;

-- +goose Down
DROP TABLE IF EXISTS webhooks;
DROP TABLE IF EXISTS api_keys;
DROP TABLE IF EXISTS comm_templates;
DROP TABLE IF EXISTS attendance_sessions;
DROP TABLE IF EXISTS group_members;
DROP TABLE IF EXISTS ministry_groups;
DROP TABLE IF EXISTS giving_kiosks;
DROP TABLE IF EXISTS financial_funds;
DROP TABLE IF EXISTS pastoral_notes;
DROP TABLE IF EXISTS family_units;
ALTER TABLE users
    DROP COLUMN IF EXISTS suspended_at,
    DROP COLUMN IF EXISTS deleted_at,
    DROP COLUMN IF EXISTS mfa_enabled,
    DROP COLUMN IF EXISTS family_role,
    DROP COLUMN IF EXISTS family_id,
    DROP COLUMN IF EXISTS membership_status,
    DROP COLUMN IF EXISTS phone;
