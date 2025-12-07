-- EDITING THIS WON'T DO ANYTHING
-- 1. groups table
create table groups (
  id uuid primary key default gen_random_uuid(),
  invite_code text unique not null,
  rotation_period int not null,
  max_word_count int not null,
  quizzes_enabled boolean default true,
  guess_name boolean default false,
  archive_enabled boolean default false,
  archive_time_period int,
  anonymous boolean default false,
  demo_time_offset bigint default 0,  -- Time offset in milliseconds for demo purposes
  created_at timestamp default now()
);

-- 2. group_members table
create table group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  name text not null,
  joined_at timestamp default now()
);

-- 3. topics table
create table topics (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  member_id uuid not null references group_members(id) on delete cascade,
  topic_text text not null,
  rotation_cycle int not null,
  submitted_at timestamp default now()
);

-- 4. rotations table
create table rotations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  rotation_number int not null,
  assignments jsonb not null,
  created_at timestamp default now()
);

-- 5. articles (optional)
create table articles (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  member_id uuid not null references group_members(id) on delete cascade,
  rotation_number int not null,
  content text not null,
  word_count int,
  created_at timestamp default now()
);

-- 6. quizzes table
create table quizzes (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references articles(id) on delete cascade,
  questions jsonb not null,
  created_at timestamp default now()
);

-- 7. quiz_attempts table
create table quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  member_id uuid not null references group_members(id) on delete cascade,
  answers jsonb not null,
  score int not null,
  attempted_at timestamp default now()
);