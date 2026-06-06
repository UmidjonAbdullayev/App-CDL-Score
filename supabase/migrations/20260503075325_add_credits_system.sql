/*
  # Add Search Credits System

  1. New Tables
    - `user_credits`
      - `user_id` (uuid, primary key -> auth.users)
      - `search_credits` (integer, default 0)
      - `updated_at` (timestamptz)

  2. Modified Tables
    - `drivers`: add `created_by_user_id` (uuid) to track who added the driver

  3. Security
    - Users can read their own credits
    - RLS policies for access control
*/

-- Create user_credits table
CREATE TABLE IF NOT EXISTS user_credits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  search_credits integer DEFAULT 0 CHECK (search_credits >= 0),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own credits"
  ON user_credits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Add created_by_user_id to drivers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'created_by_user_id'
  ) THEN
    ALTER TABLE drivers ADD COLUMN created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create function to set credits
CREATE OR REPLACE FUNCTION set_user_credits(
  target_user_id uuid,
  new_credit_amount integer
) RETURNS json AS $$
BEGIN
  IF new_credit_amount < 0 THEN
    RAISE EXCEPTION 'Credits cannot be negative';
  END IF;

  INSERT INTO user_credits (user_id, search_credits, updated_at)
  VALUES (target_user_id, new_credit_amount, now())
  ON CONFLICT (user_id) DO UPDATE SET
    search_credits = new_credit_amount,
    updated_at = now();

  RETURN json_build_object(
    'success', true,
    'user_id', target_user_id,
    'search_credits', new_credit_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to add credits
CREATE OR REPLACE FUNCTION add_user_credits(
  target_user_id uuid,
  amount integer
) RETURNS json AS $$
DECLARE
  current_credits integer;
BEGIN
  IF amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  SELECT search_credits INTO current_credits FROM user_credits WHERE user_id = target_user_id;
  
  IF current_credits IS NULL THEN
    INSERT INTO user_credits (user_id, search_credits, updated_at)
    VALUES (target_user_id, amount, now());
    current_credits := amount;
  ELSE
    UPDATE user_credits SET search_credits = search_credits + amount, updated_at = now()
    WHERE user_id = target_user_id;
    current_credits := current_credits + amount;
  END IF;

  RETURN json_build_object(
    'success', true,
    'user_id', target_user_id,
    'search_credits', current_credits
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to decrement credits (for searches)
CREATE OR REPLACE FUNCTION decrement_user_credits(target_user_id uuid)
RETURNS json AS $$
DECLARE
  current_credits integer;
BEGIN
  SELECT search_credits INTO current_credits FROM user_credits WHERE user_id = target_user_id;

  IF current_credits IS NULL OR current_credits <= 0 THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Insufficient credits',
      'search_credits', 0
    );
  END IF;

  UPDATE user_credits SET search_credits = search_credits - 1, updated_at = now()
  WHERE user_id = target_user_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Credit decremented',
    'search_credits', current_credits - 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user credits
CREATE OR REPLACE FUNCTION get_user_credits(target_user_id uuid)
RETURNS json AS $$
DECLARE
  credits integer;
BEGIN
  SELECT search_credits INTO credits FROM user_credits WHERE user_id = target_user_id;
  
  RETURN json_build_object(
    'user_id', target_user_id,
    'search_credits', COALESCE(credits, 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
