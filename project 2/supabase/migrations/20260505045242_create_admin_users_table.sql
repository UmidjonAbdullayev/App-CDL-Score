/*
  # Admin users table

  1. New Tables
    - `admin_users`
      - `user_id` (uuid, primary key, references auth.users)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Authenticated users can check if their own ID is in this table
    - No insert/update/delete via client — managed via DB only

  3. Seed
    - Grant admin to onlyforwork911@gmail.com
    - Future: any user who registers with admin@cdlscore.com email
      will be handled by the register_company function or signup trigger
*/

CREATE TABLE IF NOT EXISTS admin_users (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can check own admin status"
  ON admin_users FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Grant admin to the existing user
INSERT INTO admin_users (user_id)
VALUES ('67e459df-7802-41ca-b90e-dd3d2fd11047')
ON CONFLICT DO NOTHING;
