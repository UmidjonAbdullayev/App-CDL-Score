/*
  # Fix RLS policies, insert permissions, and daily stats seeding

  1. Fixes
    - Add insert/select policies for company_ip_log (needed for signup IP check)
    - Add insert policy for company_users
    - Add insert policy for purchase_requests (companies need to submit requests)
    - Enable RLS on company_ip_log and company_users
    - Fix daily_stats: seed with deterministic random values based on date
    - Add select policy for daily_stats (public read)
  
  2. New function: upsert_daily_stats
    - Called once per day to seed a deterministic random value for searches/savings
    - Uses date as seed for reproducible randomness
*/

-- Enable RLS on tables that were missing it
ALTER TABLE company_ip_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;

-- company_ip_log: allow inserts for IP check during signup (anon + authenticated)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'company_ip_log' AND policyname = 'Allow insert for signup'
  ) THEN
    CREATE POLICY "Allow insert for signup"
      ON company_ip_log FOR INSERT
      TO anon, authenticated
      WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'company_ip_log' AND policyname = 'Allow select for IP check'
  ) THEN
    CREATE POLICY "Allow select for IP check"
      ON company_ip_log FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

-- company_users: allow insert and select
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'company_users' AND policyname = 'Users can read own company link'
  ) THEN
    CREATE POLICY "Users can read own company link"
      ON company_users FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'company_users' AND policyname = 'Allow insert company link'
  ) THEN
    CREATE POLICY "Allow insert company link"
      ON company_users FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- companies: allow insert for signup, select for own company
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'companies' AND policyname = 'Allow company insert during signup'
  ) THEN
    CREATE POLICY "Allow company insert during signup"
      ON companies FOR INSERT
      TO anon, authenticated
      WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'companies' AND policyname = 'Authenticated users can read companies'
  ) THEN
    CREATE POLICY "Authenticated users can read companies"
      ON companies FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- purchase_requests: allow companies to insert their own requests
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'purchase_requests' AND policyname = 'Companies can insert own requests'
  ) THEN
    CREATE POLICY "Companies can insert own requests"
      ON purchase_requests FOR INSERT
      TO authenticated
      WITH CHECK (
        company_id IN (
          SELECT company_id FROM company_users WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- purchase_requests: allow select for own company
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'purchase_requests' AND policyname = 'Companies can read own requests'
  ) THEN
    CREATE POLICY "Companies can read own requests"
      ON purchase_requests FOR SELECT
      TO authenticated
      USING (
        company_id IN (
          SELECT company_id FROM company_users WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- user_credits: allow insert (for signup initialization)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_credits' AND policyname = 'Users can insert own credits'
  ) THEN
    CREATE POLICY "Users can insert own credits"
      ON user_credits FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- daily_stats: allow public read
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'daily_stats' AND policyname = 'Anyone can read daily stats'
  ) THEN
    CREATE POLICY "Anyone can read daily stats"
      ON daily_stats FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

-- Function: get or seed daily stats (deterministic random based on date)
CREATE OR REPLACE FUNCTION get_or_seed_daily_stats()
RETURNS json AS $$
DECLARE
  stat record;
  seed_int integer;
  rand_searches integer;
  rand_savings numeric;
BEGIN
  -- Check if today's stats exist
  SELECT * INTO stat FROM daily_stats WHERE stat_date = CURRENT_DATE;

  IF stat IS NULL THEN
    -- Use date as integer seed for deterministic random
    seed_int := EXTRACT(EPOCH FROM CURRENT_DATE)::integer;
    PERFORM setseed((seed_int % 1000000)::float / 1000000.0);
    rand_searches := floor(random() * 180 + 40)::integer;  -- 40–219
    rand_savings := round((random() * 9000 + 1000)::numeric, 2);  -- $1000–$10000

    INSERT INTO daily_stats (stat_date, searches_today, money_saved)
    VALUES (CURRENT_DATE, rand_searches, rand_savings)
    ON CONFLICT (stat_date) DO NOTHING;

    SELECT * INTO stat FROM daily_stats WHERE stat_date = CURRENT_DATE;
  END IF;

  RETURN json_build_object(
    'searches_today', stat.searches_today,
    'money_saved',    stat.money_saved
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: atomic credit decrement (returns updated credits or error)
CREATE OR REPLACE FUNCTION decrement_user_credits(target_user_id uuid)
RETURNS json AS $$
DECLARE
  current_credits integer;
BEGIN
  -- Lock the row
  SELECT search_credits INTO current_credits
  FROM user_credits
  WHERE user_id = target_user_id
  FOR UPDATE;

  IF current_credits IS NULL OR current_credits <= 0 THEN
    RETURN json_build_object(
      'success',        false,
      'message',        'Insufficient credits',
      'search_credits', 0
    );
  END IF;

  UPDATE user_credits
  SET search_credits = search_credits - 1,
      updated_at     = now()
  WHERE user_id = target_user_id;

  RETURN json_build_object(
    'success',        true,
    'message',        'OK',
    'search_credits', current_credits - 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: set credits (admin use)
CREATE OR REPLACE FUNCTION set_user_credits(target_user_id uuid, new_credit_amount integer)
RETURNS json AS $$
BEGIN
  IF new_credit_amount < 0 THEN
    RAISE EXCEPTION 'Credits cannot be negative';
  END IF;

  INSERT INTO user_credits (user_id, search_credits, updated_at)
  VALUES (target_user_id, new_credit_amount, now())
  ON CONFLICT (user_id) DO UPDATE SET
    search_credits = new_credit_amount,
    updated_at     = now();

  RETURN json_build_object('success', true, 'search_credits', new_credit_amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: add credits (admin use)
CREATE OR REPLACE FUNCTION add_user_credits(target_user_id uuid, amount integer)
RETURNS json AS $$
DECLARE
  new_total integer;
BEGIN
  IF amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  INSERT INTO user_credits (user_id, search_credits, updated_at)
  VALUES (target_user_id, amount, now())
  ON CONFLICT (user_id) DO UPDATE SET
    search_credits = user_credits.search_credits + amount,
    updated_at     = now()
  RETURNING search_credits INTO new_total;

  RETURN json_build_object('success', true, 'search_credits', new_total);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: get credits
CREATE OR REPLACE FUNCTION get_user_credits(target_user_id uuid)
RETURNS json AS $$
DECLARE
  credits integer;
BEGIN
  SELECT search_credits INTO credits FROM user_credits WHERE user_id = target_user_id;
  RETURN json_build_object('search_credits', COALESCE(credits, 0));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
