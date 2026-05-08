/*
  # Fix register_company to always upsert user_credits with company_id

  Previously used ON CONFLICT DO NOTHING which silently skipped updating
  the company_id if a user_credits row already existed. Changed to DO UPDATE
  so the company_id and initial credits are always set correctly on signup.
*/

CREATE OR REPLACE FUNCTION register_company(
  p_company_name  text,
  p_mc_number     text,
  p_company_email text,
  p_user_id       uuid,
  p_ip_address    text
) RETURNS json AS $$
DECLARE
  v_company_id uuid;
  v_ip_count   integer;
  v_user_email text;
BEGIN
  IF p_ip_address <> 'unknown' THEN
    SELECT COUNT(*) INTO v_ip_count
    FROM company_ip_log
    WHERE ip_address = p_ip_address
      AND created_at >= now() - interval '24 hours';

    IF v_ip_count > 0 THEN
      RETURN json_build_object(
        'success', false,
        'error', 'An account has already been registered from this network today. Please contact support.'
      );
    END IF;
  END IF;

  BEGIN
    INSERT INTO companies (name, mc_number, email)
    VALUES (p_company_name, p_mc_number, p_company_email)
    RETURNING id INTO v_company_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Company name, email, or MC number is already registered.'
    );
  END;

  INSERT INTO company_ip_log (company_id, ip_address)
  VALUES (v_company_id, p_ip_address);

  INSERT INTO company_users (company_id, user_id)
  VALUES (v_company_id, p_user_id)
  ON CONFLICT DO NOTHING;

  -- Always upsert so company_id is set even if row existed
  INSERT INTO user_credits (user_id, company_id, search_credits, updated_at)
  VALUES (p_user_id, v_company_id, 3, now())
  ON CONFLICT (user_id) DO UPDATE SET
    company_id = v_company_id,
    search_credits = GREATEST(user_credits.search_credits, 3),
    updated_at = now();

  SELECT email INTO v_user_email FROM auth.users WHERE id = p_user_id;
  IF v_user_email = 'admin@cdlscore.com' THEN
    INSERT INTO admin_users (user_id)
    VALUES (p_user_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN json_build_object('success', true, 'company_id', v_company_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
