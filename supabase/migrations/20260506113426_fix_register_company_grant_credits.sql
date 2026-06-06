/*
  # Fix register_company: always grant 3 credits on signup

  The previous migration reverted the user_credits insert to ON CONFLICT DO NOTHING,
  which silently skips giving credits if a row already exists (e.g., from a partial
  prior registration attempt). This migration restores the DO UPDATE behavior so new
  users always receive exactly 3 credits, and also re-adds the admin email check.

  Changes:
  - user_credits insert uses DO UPDATE to always set credits = 3 on new registration
  - Re-adds admin email detection (was dropped in the strengthen_registration migration)
*/

CREATE OR REPLACE FUNCTION register_company(
  p_company_name  text,
  p_mc_number     text,
  p_company_email text,
  p_user_id       uuid,
  p_ip_address    text
) RETURNS json AS $$
DECLARE
  v_company_id    uuid;
  v_email_exists  boolean;
  v_ip_count      integer;
  v_user_email    text;
BEGIN
  -- 1. Email duplicate check: company email already registered?
  SELECT EXISTS(
    SELECT 1 FROM companies WHERE lower(email) = lower(p_company_email)
  ) INTO v_email_exists;

  IF v_email_exists THEN
    RETURN json_build_object(
      'success', false,
      'error', 'An account with this email already exists. Please sign in instead.'
    );
  END IF;

  -- 2. IP duplicate check (permanent — any prior registration from this IP)
  IF p_ip_address <> 'unknown' THEN
    SELECT COUNT(*) INTO v_ip_count
    FROM company_ip_log
    WHERE ip_address = p_ip_address;

    IF v_ip_count > 0 THEN
      RETURN json_build_object(
        'success', false,
        'error', 'An account has already been registered from this device or network.'
      );
    END IF;
  END IF;

  -- 3. Insert company
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

  -- 4. Log IP immediately after company created
  INSERT INTO company_ip_log (company_id, ip_address)
  VALUES (v_company_id, p_ip_address);

  -- 5. Link user to company
  INSERT INTO company_users (company_id, user_id)
  VALUES (v_company_id, p_user_id)
  ON CONFLICT DO NOTHING;

  -- 6. Always grant 3 credits — use DO UPDATE so a leftover row from a failed
  --    prior attempt never silently blocks the credit grant.
  INSERT INTO user_credits (user_id, company_id, search_credits, updated_at)
  VALUES (p_user_id, v_company_id, 3, now())
  ON CONFLICT (user_id) DO UPDATE SET
    company_id     = v_company_id,
    search_credits = 3,
    updated_at     = now();

  -- 7. Auto-grant admin role for the designated admin email
  SELECT email INTO v_user_email FROM auth.users WHERE id = p_user_id;
  IF v_user_email = 'admin@cdlscore.com' THEN
    INSERT INTO admin_users (user_id)
    VALUES (p_user_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN json_build_object('success', true, 'company_id', v_company_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
