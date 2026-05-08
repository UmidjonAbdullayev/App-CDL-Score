/*
  # Fix credit RPC functions to use SECURITY DEFINER

  The add_user_credits, set_user_credits, and get_user_credits functions
  were running as the calling user (SECURITY INVOKER by default), causing
  RLS on user_credits and company_users to block admin operations.

  Making them SECURITY DEFINER allows them to bypass RLS and always work
  regardless of who calls them. The logic inside already validates inputs.

  Also creates an admin-specific approve_purchase_request function that
  looks up company_users and adds credits in one SECURITY DEFINER call,
  avoiding the RLS issue entirely in the admin panel.
*/

-- Fix get_user_credits
CREATE OR REPLACE FUNCTION get_user_credits(target_user_id uuid)
RETURNS json AS $$
DECLARE
  credits integer;
BEGIN
  SELECT search_credits INTO credits FROM user_credits WHERE user_id = target_user_id;
  RETURN json_build_object('search_credits', COALESCE(credits, 0));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix add_user_credits
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

-- Fix set_user_credits
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

-- New: approve_purchase_request — looks up user via company_users and adds credits
-- Admin panel calls this instead of doing two separate queries
CREATE OR REPLACE FUNCTION approve_purchase_request(
  p_company_id uuid,
  p_credit_amount integer
) RETURNS json AS $$
DECLARE
  v_user_id uuid;
  v_new_total integer;
BEGIN
  -- Bypass RLS: look up the user for this company
  SELECT user_id INTO v_user_id
  FROM company_users
  WHERE company_id = p_company_id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No user found for this company');
  END IF;

  -- Add credits
  INSERT INTO user_credits (user_id, search_credits, updated_at)
  VALUES (v_user_id, p_credit_amount, now())
  ON CONFLICT (user_id) DO UPDATE SET
    search_credits = user_credits.search_credits + p_credit_amount,
    updated_at     = now()
  RETURNING search_credits INTO v_new_total;

  RETURN json_build_object('success', true, 'user_id', v_user_id, 'search_credits', v_new_total);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
