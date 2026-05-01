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

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create a profile row whenever a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 2. SUBMISSIONS TABLE (photo uploads)
CREATE TABLE IF NOT EXISTS submissions (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  image_url   TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_uploaded_at ON submissions(uploaded_at);

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Submissions are viewable by everyone" ON submissions;
CREATE POLICY "Submissions are viewable by everyone"
  ON submissions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own submissions" ON submissions;
CREATE POLICY "Users can insert their own submissions"
  ON submissions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own submissions" ON submissions;
CREATE POLICY "Users can delete their own submissions"
  ON submissions FOR DELETE USING (auth.uid() = user_id);


-- 3. COMMENTS TABLE (for gallery lightbox)
CREATE TABLE IF NOT EXISTS comments (
  id            BIGSERIAL PRIMARY KEY,
  submission_id BIGINT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id     BIGINT REFERENCES comments(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id BIGINT REFERENCES comments(id) ON DELETE CASCADE;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_comments_submission_id ON comments(submission_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Comments are viewable by everyone" ON comments;
CREATE POLICY "Comments are viewable by everyone"
  ON comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own comments" ON comments;
CREATE POLICY "Users can insert their own comments"
  ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own comments" ON comments;
CREATE POLICY "Users can delete their own comments"
  ON comments FOR DELETE USING (auth.uid() = user_id);


-- 4. VOTES TABLE (upvote/downvote on submissions)
CREATE TABLE IF NOT EXISTS votes (
  id            BIGSERIAL PRIMARY KEY,
  submission_id BIGINT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  value         SMALLINT NOT NULL CHECK (value IN (-1, 1)),
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (submission_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_votes_submission_id ON votes(submission_id);

ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Votes are viewable by everyone" ON votes;
CREATE POLICY "Votes are viewable by everyone"
  ON votes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert or update their own votes" ON votes;
CREATE POLICY "Users can insert or update their own votes"
  ON votes FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own votes" ON votes;
CREATE POLICY "Users can update their own votes"
  ON votes FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own votes" ON votes;
CREATE POLICY "Users can delete their own votes"
  ON votes FOR DELETE USING (auth.uid() = user_id);


-- 5. COMMENT VOTES TABLE (upvote/downvote on comments)
CREATE TABLE IF NOT EXISTS comment_votes (
  id         BIGSERIAL PRIMARY KEY,
  comment_id BIGINT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  value      SMALLINT NOT NULL CHECK (value IN (-1, 1)),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_votes_comment_id ON comment_votes(comment_id);

ALTER TABLE comment_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Comment votes are viewable by everyone" ON comment_votes;
CREATE POLICY "Comment votes are viewable by everyone"
  ON comment_votes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own comment votes" ON comment_votes;
CREATE POLICY "Users can insert their own comment votes"
  ON comment_votes FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own comment votes" ON comment_votes;
CREATE POLICY "Users can update their own comment votes"
  ON comment_votes FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own comment votes" ON comment_votes;
CREATE POLICY "Users can delete their own comment votes"
  ON comment_votes FOR DELETE USING (auth.uid() = user_id);


-- 6. STORAGE BUCKET RLS POLICIES
-- Run these in SQL Editor AFTER creating the 'submissions' bucket via the dashboard

-- Allow anyone to read files from the submissions bucket
DROP POLICY IF EXISTS "Public read access for submissions" ON storage.objects;
CREATE POLICY "Public read access for submissions"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'submissions');

-- Allow authenticated users to upload files
DROP POLICY IF EXISTS "Authenticated users can upload to submissions" ON storage.objects;
CREATE POLICY "Authenticated users can upload to submissions"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'submissions' AND auth.role() = 'authenticated');

-- Allow users to delete their own uploads
DROP POLICY IF EXISTS "Users can delete their own uploads" ON storage.objects;
CREATE POLICY "Users can delete their own uploads"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'submissions' AND owner = auth.uid());


-- 7. EMAIL NOTIFICATION TRIGGERS (Requires pg_net extension and deployed edge function)
-- Enable the extension first:
-- CREATE EXTENSION IF NOT EXISTS pg_net;

-- Then create the trigger function:
-- CREATE OR REPLACE FUNCTION notify_email()
-- RETURNS TRIGGER AS $$
-- DECLARE
--   actor_name TEXT;
--   event_type TEXT;
-- BEGIN
--   SELECT display_name INTO actor_name FROM profiles WHERE id = NEW.user_id;
--
--   IF TG_TABLE_NAME = 'submissions' THEN
--     event_type := 'new_submission';
--   ELSIF TG_TABLE_NAME = 'comments' THEN
--     event_type := 'new_comment';
--   END IF;
--
--   PERFORM net.http_post(
--     url := 'https://igdptasnxeszanlfqade.supabase.co/functions/v1/notify-email',
--     headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SUPABASE_ANON_KEY"}'::jsonb,
--     body := json_build_object('event', event_type, 'actorName', actor_name)::text
--   );
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and create triggers
-- DROP TRIGGER IF EXISTS on_new_submission_notify ON submissions;
-- CREATE TRIGGER on_new_submission_notify
--   AFTER INSERT ON submissions
--   FOR EACH ROW EXECUTE FUNCTION notify_email();

-- DROP TRIGGER IF EXISTS on_new_comment_notify ON comments;
-- CREATE TRIGGER on_new_comment_notify
--   AFTER INSERT ON comments
--   FOR EACH ROW EXECUTE FUNCTION notify_email();
