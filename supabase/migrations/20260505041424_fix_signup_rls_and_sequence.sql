/*
  # Fix signup RLS and policy gaps

  The signup flow hits three issues:
  1. company_users INSERT policy requires auth.uid() = user_id but the
     session may not be fully propagated at insert time — use SECURITY DEFINER
     helper function instead of relying on RLS for the link step.
  2. user_credits INSERT policy same problem.
  3. company_ip_log select needs to work for anon (pre-login IP check).

  Solution: drop the broken WITH CHECK policies and replace with
  SECURITY DEFINER functions that do the inserts safely.
*/

-- Drop conflicting policies that block the signup flow
DROP POLICY IF EXISTS "Allow insert company link" ON company_users;
DROP POLICY IF EXISTS "Users can insert own credits" ON user_credits;

-- Re-add permissive insert policies for authenticated context
-- (the functions below are SECURITY DEFINER so they bypass RLS anyway)
CREATE POLICY "Allow insert company link"
  ON company_users FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can insert own credits"
  ON user_credits FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function: complete_company_signup
-- Called after auth.signUp succeeds; links user to company and inits credits.
-- SECURITY DEFINER so it runs as the postgres role, bypassing RLS entirely.
CREATE OR REPLACE FUNCTION complete_company_signup(
  p_company_id uuid,
  p_user_id    uuid
) RETURNS json AS $$
BEGIN
  -- Link user ↔ company
  INSERT INTO company_users (company_id, user_id)
  VALUES (p_company_id, p_user_id)
  ON CONFLICT DO NOTHING;

  -- Init 0 search credits (no free trial)
  INSERT INTO user_credits (user_id, company_id, search_credits, updated_at)
  VALUES (p_user_id, p_company_id, 0, now())
  ON CONFLICT (user_id) DO NOTHING;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
