-- ============================================================
-- Run this in your Supabase project's SQL Editor to set up
-- the database schema and Row Level Security policies.
-- ============================================================

-- 1. PROFILES TABLE (linked to Supabase Auth users)
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);


-- 2. SUBMISSIONS TABLE (photo uploads)
CREATE TABLE IF NOT EXISTS submissions (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  image_url   TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_submissions_user_id ON submissions(user_id);
CREATE INDEX idx_submissions_uploaded_at ON submissions(uploaded_at);

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Submissions are viewable by everyone"
  ON submissions FOR SELECT USING (true);

CREATE POLICY "Users can insert their own submissions"
  ON submissions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own submissions"
  ON submissions FOR DELETE USING (auth.uid() = user_id);


-- 3. STORAGE BUCKET (run these individually if the bucket doesn't exist yet)

-- Create a public bucket called 'submissions'. Run this first:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('submissions', 'submissions', true);

-- Then set RLS policies on storage.objects:

-- CREATE POLICY "Public read access for submissions"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'submissions');

-- CREATE POLICY "Authenticated users can upload to submissions"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'submissions' AND auth.role() = 'authenticated');

-- CREATE POLICY "Users can delete their own uploads"
--   ON storage.objects FOR DELETE
--   USING (bucket_id = 'submissions' AND owner = auth.uid());
