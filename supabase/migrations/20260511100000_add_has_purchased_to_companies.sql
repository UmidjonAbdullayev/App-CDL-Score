# Add has_purchased field to companies table

ALTER TABLE companies ADD COLUMN has_purchased boolean DEFAULT false;

-- Update the approve_purchase_request function to set has_purchased to true
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

  -- Mark company as having purchased
  UPDATE companies SET has_purchased = true WHERE id = p_company_id;

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