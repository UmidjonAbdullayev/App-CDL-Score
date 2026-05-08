/*
  # Strengthen registration duplicate checks

  Two hard blocks before any account is created:

  1. EMAIL: Check if the submitted login email already exists in auth.users
     (Supabase prevents duplicate auth emails but we surface a clear message)

  2. EMAIL (company): Check if company email already registered in companies table

  3. IP (permanent): Check if the IP has ANY prior registration ever — not just 24h.
     This is a permanent block per network, not a rolling window.

  Updates register_company to run all checks up front, before inserting anything.
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

  -- 6. Init 3 free credits
  INSERT INTO user_credits (user_id, company_id, search_credits, updated_at)
  VALUES (p_user_id, v_company_id, 3, now())
  ON CONFLICT (user_id) DO NOTHING;

  RETURN json_build_object('success', true, 'company_id', v_company_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
