/*
  # Remove IP blocking from registration

  IP-based blocking caused legitimate users to be locked out when registering
  from shared networks, office buildings, or after failed registration attempts.
  Removed entirely from register_company. IP addresses are still logged for
  admin visibility, but no automatic blocking occurs.

  Admins can manually ban IPs from the Networks tab in the admin panel.
  
  Also adds a banned_ips table so admins can manually block specific IPs.
*/

-- Table for admin-managed IP bans
CREATE TABLE IF NOT EXISTS banned_ips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL UNIQUE,
  reason text DEFAULT '',
  banned_by text DEFAULT 'admin',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE banned_ips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage banned IPs"
  ON banned_ips FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Admin can insert banned IPs"
  ON banned_ips FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Admin can delete banned IPs"
  ON banned_ips FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

-- Updated register_company: no IP blocking, just log the IP
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

  -- 5. Always grant 3 credits
  INSERT INTO user_credits (user_id, company_id, search_credits, updated_at)
  VALUES (p_user_id, v_company_id, 3, now())
  ON CONFLICT (user_id) DO UPDATE SET
    company_id     = v_company_id,
    search_credits = 3,
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
