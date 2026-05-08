/*
  # Add synthetic driver support

  1. Adds `is_synthetic` boolean column to drivers table
  2. Adds a unique index on full_name (case-insensitive) for synthetic drivers
     so we never double-insert the same searched name
  3. Creates `create_synthetic_driver` SECURITY DEFINER function that:
     - Inserts the driver row if not already present
     - Inserts 2-4 unique comments from different carriers
     - Returns the driver id
  4. Adds RLS SELECT policy so all authenticated users can read synthetic drivers
*/

-- 1. Add is_synthetic column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'is_synthetic'
  ) THEN
    ALTER TABLE drivers ADD COLUMN is_synthetic boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- 2. Unique index on lower(full_name) for synthetic drivers only
CREATE UNIQUE INDEX IF NOT EXISTS drivers_synthetic_name_unique
  ON drivers (lower(full_name))
  WHERE is_synthetic = true;

-- 3. RLS: all authenticated users can read synthetic drivers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'drivers' AND policyname = 'Authenticated users can read synthetic drivers'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Authenticated users can read synthetic drivers"
        ON drivers FOR SELECT
        TO authenticated
        USING (is_synthetic = true)
    $policy$;
  END IF;
END $$;

-- 4. Function: create_synthetic_driver
CREATE OR REPLACE FUNCTION create_synthetic_driver(
  p_full_name      text,
  p_score          integer,
  p_reliability    integer,
  p_drug_test      integer,
  p_on_time        integer,
  p_flag           text,
  p_stars          numeric,
  p_comments       jsonb   -- array of {company_name, comment, stars}
) RETURNS uuid AS $$
DECLARE
  v_id   uuid;
  v_item jsonb;
BEGIN
  -- Upsert driver (idempotent on lower(full_name) for synthetics)
  INSERT INTO drivers (full_name, score, reliability_pct, drug_test_pct, on_time_pct, flag, stars, is_synthetic)
  VALUES (p_full_name, p_score, p_reliability, p_drug_test, p_on_time, p_flag, p_stars, true)
  ON CONFLICT (lower(full_name)) WHERE is_synthetic = true
  DO UPDATE SET
    score           = EXCLUDED.score,
    reliability_pct = EXCLUDED.reliability_pct,
    drug_test_pct   = EXCLUDED.drug_test_pct,
    on_time_pct     = EXCLUDED.on_time_pct,
    flag            = EXCLUDED.flag,
    stars           = EXCLUDED.stars
  RETURNING id INTO v_id;

  -- Insert comments only if this is a fresh insert (no comments yet)
  IF NOT EXISTS (SELECT 1 FROM driver_comments WHERE driver_id = v_id) THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_comments)
    LOOP
      INSERT INTO driver_comments (driver_id, company_name, comment, stars, user_id, company_id)
      VALUES (
        v_id,
        v_item->>'company_name',
        v_item->>'comment',
        (v_item->>'stars')::integer,
        NULL,
        NULL
      );
    END LOOP;
  END IF;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
