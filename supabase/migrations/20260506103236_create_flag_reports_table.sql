/*
  # Create flag_reports table

  Stores user-submitted reports flagging a driver record or a specific comment.
  Admins review these in the Reports tab and can delete or take action.

  1. New Table: flag_reports
     - id (uuid, pk)
     - report_type: 'driver' | 'comment'
     - driver_id: uuid ref to drivers (nullable)
     - comment_id: uuid ref to driver_comments (nullable)
     - driver_name: text (denormalized for quick display)
     - reporter_company_name: text
     - reporter_user_id: uuid
     - reason: text — what the user says is wrong
     - action_requested: 'deletion' | 'correction' | 'other'
     - status: 'open' | 'resolved'
     - created_at

  2. RLS
     - Authenticated users can INSERT
     - Only admin reads/updates (enforced via SECURITY DEFINER functions or direct admin_users check)
*/

CREATE TABLE IF NOT EXISTS flag_reports (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type           text NOT NULL CHECK (report_type IN ('driver', 'comment')),
  driver_id             uuid REFERENCES drivers(id) ON DELETE SET NULL,
  comment_id            uuid REFERENCES driver_comments(id) ON DELETE SET NULL,
  driver_name           text NOT NULL DEFAULT '',
  reporter_company_name text NOT NULL DEFAULT '',
  reporter_user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason                text NOT NULL,
  action_requested      text NOT NULL DEFAULT 'other' CHECK (action_requested IN ('deletion', 'correction', 'other')),
  status                text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at            timestamptz DEFAULT now()
);

ALTER TABLE flag_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert flag reports"
  ON flag_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_user_id);

CREATE POLICY "Authenticated users can read own reports"
  ON flag_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_user_id);

-- Admin read: allow if user is in admin_users table
CREATE POLICY "Admins can read all flag reports"
  ON flag_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can update flag reports"
  ON flag_reports FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

CREATE POLICY "Admins can delete flag reports"
  ON flag_reports FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));
