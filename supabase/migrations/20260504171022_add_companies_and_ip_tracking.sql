/*
  # Add Companies, IP Tracking, and Purchase Requests

  1. New Tables
    - `companies`: Store company info and MC number
    - `company_users`: Link users to companies
    - `company_ip_log`: Track registration IPs to prevent duplicates
    - `purchase_requests`: Track purchase requests from companies
    - `daily_stats`: Store daily stats (searches, savings) that reset daily
*/

-- Create companies table first
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  mc_number text NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Create company_users junction table
CREATE TABLE IF NOT EXISTS company_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE(company_id, user_id)
);

CREATE POLICY "Users can read own company"
  ON company_users FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create IP tracking table
CREATE TABLE IF NOT EXISTS company_ip_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  ip_address text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create purchase requests table
CREATE TABLE IF NOT EXISTS purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  search_count integer NOT NULL CHECK (search_count >= 3),
  total_cost numeric(10,2) NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'completed')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE purchase_requests ENABLE ROW LEVEL SECURITY;

-- Create daily stats table
CREATE TABLE IF NOT EXISTS daily_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stat_date date NOT NULL DEFAULT CURRENT_DATE,
  searches_today integer DEFAULT 0,
  money_saved numeric(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(stat_date)
);

-- Add company relationship to drivers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE drivers ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add company relationship to driver_comments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'driver_comments' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE driver_comments ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add company relationship to user_credits
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_credits' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE user_credits ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Remove old view count from drivers if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'view_count'
  ) THEN
    ALTER TABLE drivers DROP COLUMN view_count;
  END IF;
END $$;
