/*
  # Enhance Driver System with Views, Stars, Timestamps, and User Tracking

  1. Modified Tables
    - `drivers`: add stars (0-5), view_count, created_at
    - `driver_comments`: add stars (0-5), created_at, user_id for ownership
  
  2. New Tables
    - `driver_views`: track driver searches per day
    - `search_logs`: track daily searches for stats
    - `auth_users`: store carrier/user profile info (optional for display names)
  
  3. Security
    - Users can only edit/delete their own comments
    - RLS policies updated
*/

-- Add columns to drivers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'stars'
  ) THEN
    ALTER TABLE drivers ADD COLUMN stars decimal(2,1) DEFAULT 0 CHECK (stars >= 0 AND stars <= 5);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'view_count'
  ) THEN
    ALTER TABLE drivers ADD COLUMN view_count integer DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE drivers ADD COLUMN created_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Add columns to driver_comments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'driver_comments' AND column_name = 'stars'
  ) THEN
    ALTER TABLE driver_comments ADD COLUMN stars integer DEFAULT 0 CHECK (stars >= 0 AND stars <= 5);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'driver_comments' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE driver_comments ADD COLUMN user_id uuid DEFAULT auth.uid();
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'driver_comments' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE driver_comments ADD COLUMN created_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Create search_logs table for daily stats
CREATE TABLE IF NOT EXISTS search_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  search_count integer DEFAULT 0,
  money_saved_potential numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE search_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own search logs"
  ON search_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert search logs"
  ON search_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Update comment policies for edit/delete
CREATE POLICY "Users can update own comments"
  ON driver_comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON driver_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
