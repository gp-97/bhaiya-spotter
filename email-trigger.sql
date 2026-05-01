-- 7. EMAIL NOTIFICATION TRIGGERS
-- Run this in Supabase SQL Editor after deploying the Edge Function

CREATE OR REPLACE FUNCTION notify_email()
RETURNS TRIGGER AS $$
DECLARE
  actor_name TEXT;
  event_type TEXT;
BEGIN
  SELECT display_name INTO actor_name FROM profiles WHERE id = NEW.user_id;

  IF TG_TABLE_NAME = 'submissions' THEN
    event_type := 'new_submission';
  ELSIF TG_TABLE_NAME = 'comments' THEN
    event_type := 'new_comment';
  END IF;

  PERFORM net.http_post(
    url := 'https://igdptasnxeszanlfqade.supabase.co/functions/v1/notify-email',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnZHB0YXNueGVzemFubGZxYWRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MjE5MjMsImV4cCI6MjA5MzE5NzkyM30.WtcEI6BeZzFVXJxcxd1sAxzsLfs8ZwaiTH_Jfmjb4uo"}'::jsonb,
    body := json_build_object('event', event_type, 'actorName', actor_name)::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_submission_notify ON submissions;
CREATE TRIGGER on_new_submission_notify
  AFTER INSERT ON submissions
  FOR EACH ROW EXECUTE FUNCTION notify_email();

DROP TRIGGER IF EXISTS on_new_comment_notify ON comments;
CREATE TRIGGER on_new_comment_notify
  AFTER INSERT ON comments
  FOR EACH ROW EXECUTE FUNCTION notify_email();
