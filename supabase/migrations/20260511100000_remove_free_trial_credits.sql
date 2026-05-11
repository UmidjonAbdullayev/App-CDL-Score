/*
  # Remove free trial credits from registration

  New users should start with 0 search credits instead of 3 free searches.
  The paid credit system replaces the free trial entirely.
*/

-- Drop and recreate the register_company function with 0 credits instead of 3
DROP FUNCTION IF EXISTS register_company(text, text, text, uuid, text);

CREATE FUNCTION register_company(
  p_company_name  text,
  p_mc_number     text,
  p_company_email text,
  p_user_id       uuid,
  p_ip_address    text
) RETURNS json AS $$
DECLARE
  v_company_id    uuid;
  v_email_exists  boolean;
  v_user_email    text;
BEGIN
  -- 1. Company email duplicate check
  SELECT EXISTS(
    SELECT 1 FROM companies WHERE lower(email) = lower(p_company_email)
  ) INTO v_email_exists;

  IF v_email_exists THEN
    RETURN json_build_object(
      'success', false,
      'error', 'An account with this email already exists. Please sign in instead.'
    );
  END IF;

  -- 2. Insert company
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

  -- 3. Log IP for admin visibility (no blocking)
  INSERT INTO company_ip_log (company_id, ip_address)
  VALUES (v_company_id, p_ip_address);

  -- 4. Link user to company
  INSERT INTO company_users (company_id, user_id)
  VALUES (v_company_id, p_user_id)
  ON CONFLICT DO NOTHING;

  -- 5. Start with 0 credits (no free trial)
  INSERT INTO user_credits (user_id, company_id, search_credits, updated_at)
  VALUES (p_user_id, v_company_id, 0, now())
  ON CONFLICT (user_id) DO UPDATE SET
    company_id     = v_company_id,
    search_credits = 0,
    updated_at     = now();

  -- 6. Auto-grant admin role for the designated admin email
  SELECT email INTO v_user_email FROM auth.users WHERE id = p_user_id;
  IF v_user_email = 'admin@cdlscore.com' THEN
    INSERT INTO admin_users (user_id)
    VALUES (p_user_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN json_build_object('success', true, 'company_id', v_company_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;