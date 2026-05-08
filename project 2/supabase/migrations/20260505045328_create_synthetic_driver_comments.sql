/*
  # Synthetic driver comments table

  Stores user-submitted comments on synthetic (not-in-DB) drivers,
  keyed by the driver name slug.

  1. New Tables
    - `synthetic_driver_comments`
      - `id` (uuid, primary key)
      - `driver_slug` (text) — lowercased name used as key
      - `driver_name` (text) — display name
      - `company_name` (text)
      - `comment` (text)
      - `stars` (int)
      - `user_id` (uuid)
      - `company_id` (uuid)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Authenticated users can read all synthetic comments
    - Authenticated users can insert their own comments
    - Users can delete their own comments
*/

CREATE TABLE IF NOT EXISTS synthetic_driver_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_slug text NOT NULL,
  driver_name text NOT NULL,
  company_name text NOT NULL DEFAULT '',
  comment     text NOT NULL,
  stars       int NOT NULL DEFAULT 5 CHECK (stars BETWEEN 1 AND 5),
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id  uuid,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_synthetic_comments_slug ON synthetic_driver_comments(driver_slug);

ALTER TABLE synthetic_driver_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read synthetic comments"
  ON synthetic_driver_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert synthetic comments"
  ON synthetic_driver_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own synthetic comments"
  ON synthetic_driver_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
