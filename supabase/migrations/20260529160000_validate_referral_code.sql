/*
  Pre-signup referral validation. Invalid codes must block registration entirely.
*/

CREATE OR REPLACE FUNCTION validate_referral_code(p_referral_code text)
RETURNS json AS $$
DECLARE
  v_ref text := nullif(trim(p_referral_code), '');
BEGIN
  IF v_ref IS NULL THEN
    RETURN json_build_object('valid', true);
  END IF;

  IF EXISTS (SELECT 1 FROM companies WHERE upper(referral_code) = upper(v_ref)) THEN
    RETURN json_build_object('valid', true);
  END IF;

  RETURN json_build_object(
    'valid', false,
    'error', 'This referral code was not found. Remove it or enter a valid code to continue.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION validate_referral_code(text) TO anon, authenticated;

-- Ensure register_company uses the same error message
CREATE OR REPLACE FUNCTION register_company(
  p_company_name  text,
  p_mc_number     text,
  p_company_email text,
  p_user_id       uuid,
  p_ip_address    text,
  p_referral_code text DEFAULT NULL
) RETURNS json AS $$
DECLARE
  v_company_id       uuid;
  v_email_exists     boolean;
  v_user_email       text;
  v_referrer_id      uuid;
  v_new_referral_code text;
  v_ref_code_trimmed text;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM companies WHERE lower(email) = lower(p_company_email)
  ) INTO v_email_exists;

  IF v_email_exists THEN
    RETURN json_build_object(
      'success', false,
      'error', 'An account with this email already exists. Please sign in instead.'
    );
  END IF;

  v_ref_code_trimmed := nullif(trim(p_referral_code), '');
  IF v_ref_code_trimmed IS NOT NULL THEN
    SELECT id INTO v_referrer_id
    FROM companies
    WHERE upper(referral_code) = upper(v_ref_code_trimmed);

    IF v_referrer_id IS NULL THEN
      RETURN json_build_object(
        'success', false,
        'error', 'This referral code was not found. Remove it or enter a valid code to continue.'
      );
    END IF;
  END IF;

  v_new_referral_code := generate_referral_code();

  BEGIN
    INSERT INTO companies (name, mc_number, email, referral_code, referred_by_company_id)
    VALUES (p_company_name, p_mc_number, p_company_email, v_new_referral_code, v_referrer_id)
    RETURNING id INTO v_company_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Company name, email, or MC number is already registered.'
    );
  END;

  IF v_referrer_id IS NOT NULL THEN
    INSERT INTO referrals (referrer_company_id, referee_company_id)
    VALUES (v_referrer_id, v_company_id);
  END IF;

  INSERT INTO company_ip_log (company_id, ip_address)
  VALUES (v_company_id, p_ip_address);

  INSERT INTO company_users (company_id, user_id)
  VALUES (v_company_id, p_user_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO user_credits (user_id, company_id, search_credits, updated_at)
  VALUES (p_user_id, v_company_id, 0, now())
  ON CONFLICT (user_id) DO UPDATE SET
    company_id     = v_company_id,
    search_credits = 0,
    updated_at     = now();

  SELECT email INTO v_user_email FROM auth.users WHERE id = p_user_id;
  IF v_user_email = 'admin@cdlscore.com' THEN
    INSERT INTO admin_users (user_id)
    VALUES (p_user_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN json_build_object(
    'success', true,
    'company_id', v_company_id,
    'referral_code', v_new_referral_code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
