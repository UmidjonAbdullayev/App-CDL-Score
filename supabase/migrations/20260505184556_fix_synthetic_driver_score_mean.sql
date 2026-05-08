/*
  # Fix synthetic driver score to be mean of 3 metrics

  Updates create_synthetic_driver so the stored score equals
  round((reliability + drug_test + on_time) / 3), matching the frontend calculation.
  No schema changes needed — just replacing the function body.
*/

CREATE OR REPLACE FUNCTION create_synthetic_driver(
  p_full_name      text,
  p_score          integer,
  p_reliability    integer,
  p_drug_test      integer,
  p_on_time        integer,
  p_flag           text,
  p_stars          numeric,
  p_comments       jsonb
) RETURNS uuid AS $$
DECLARE
  v_id   uuid;
  v_item jsonb;
  v_computed_score integer;
BEGIN
  -- Always recompute score as mean of 3 metrics
  v_computed_score := ROUND((p_reliability + p_drug_test + p_on_time)::numeric / 3);

  INSERT INTO drivers (full_name, score, reliability_pct, drug_test_pct, on_time_pct, flag, stars, is_synthetic)
  VALUES (p_full_name, v_computed_score, p_reliability, p_drug_test, p_on_time, p_flag, p_stars, true)
  ON CONFLICT (lower(full_name)) WHERE is_synthetic = true
  DO UPDATE SET
    score           = v_computed_score,
    reliability_pct = EXCLUDED.reliability_pct,
    drug_test_pct   = EXCLUDED.drug_test_pct,
    on_time_pct     = EXCLUDED.on_time_pct,
    flag            = EXCLUDED.flag,
    stars           = EXCLUDED.stars
  RETURNING id INTO v_id;

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
