CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM ('USER', 'MANAGER', 'ADMIN');
CREATE TYPE reservation_status AS ENUM ('pending', 'approved', 'canceled', 'rejected');
CREATE TYPE education_status AS ENUM ('requested', 'completed', 'certified');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'USER',
  suspended BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE equipment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  location TEXT NOT NULL,
  image_url TEXT,
  features TEXT[] NOT NULL DEFAULT '{}',
  usage_conditions TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id UUID NOT NULL REFERENCES equipment(id),
  user_id UUID NOT NULL REFERENCES users(id),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status reservation_status NOT NULL DEFAULT 'pending',
  purpose TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT no_negative_reservation CHECK (ends_at > starts_at)
);

CREATE INDEX reservations_equipment_time_idx ON reservations (equipment_id, starts_at, ends_at);

CREATE TABLE education_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id UUID NOT NULL REFERENCES equipment(id),
  title TEXT NOT NULL,
  material_url TEXT,
  video_url TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 20
);

CREATE TABLE education_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  education_session_id UUID NOT NULL REFERENCES education_sessions(id),
  user_id UUID NOT NULL REFERENCES users(id),
  status education_status NOT NULL DEFAULT 'requested',
  certificate_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cms_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_key TEXT NOT NULL,
  block_key TEXT NOT NULL,
  content JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (page_key, block_key)
);
