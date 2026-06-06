/*
  Store source type and tooltip from "synthetic driver data" on synthetic driver comments.
*/

ALTER TABLE driver_comments
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS tooltip_text text;

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
      INSERT INTO driver_comments (driver_id, company_name, comment, stars, source_type, tooltip_text, user_id, company_id)
      VALUES (
        v_id,
        v_item->>'company_name',
        v_item->>'comment',
        (v_item->>'stars')::integer,
        NULLIF(trim(v_item->>'source_type'), ''),
        NULLIF(trim(v_item->>'tooltip_text'), ''),
        NULL,
        NULL
      );
    END LOOP;
  END IF;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
