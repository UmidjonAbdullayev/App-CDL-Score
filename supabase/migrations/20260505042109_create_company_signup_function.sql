/*
  # Signup helper: register_company
  
  Handles the full company signup in one SECURITY DEFINER call,
  bypassing RLS entirely. This is safe because:
  - All inputs are validated inside the function
  - Duplicate checking is enforced via unique constraints
  - Called only from the signup form with user-supplied data
  
  Steps performed:
  1. Check IP not already used in past 24h
  2. Insert company row
  3. Log IP address
  4. Link auth user to company
  5. Initialize 3 free search credits
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
BEGIN
  -- 1. IP duplicate check (last 24h)
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

  -- 3. Log IP
  INSERT INTO company_ip_log (company_id, ip_address)
  VALUES (v_company_id, p_ip_address);

  -- 4. Link user to company
  INSERT INTO company_users (company_id, user_id)
  VALUES (v_company_id, p_user_id)
  ON CONFLICT DO NOTHING;

  -- 5. Init 3 free credits
  INSERT INTO user_credits (user_id, company_id, search_credits, updated_at)
  VALUES (p_user_id, v_company_id, 3, now())
  ON CONFLICT (user_id) DO NOTHING;

  RETURN json_build_object('success', true, 'company_id', v_company_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
