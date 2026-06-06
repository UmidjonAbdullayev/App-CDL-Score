/*
  Referral program: unique code per company, optional code at signup,
  10% subscription discount for referrer when referee buys a subscription.
*/

-- ── Companies: referral fields ─────────────────────────────────────────────
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referred_by_company_id uuid REFERENCES companies(id),
  ADD COLUMN IF NOT EXISTS referral_discount_pct integer NOT NULL DEFAULT 0
    CHECK (referral_discount_pct >= 0 AND referral_discount_pct <= 100);

CREATE UNIQUE INDEX IF NOT EXISTS companies_referral_code_key
  ON companies (upper(referral_code))
  WHERE referral_code IS NOT NULL;

-- ── Referrals ledger ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  referee_company_id uuid NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  referral_subscription_rewarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referrals_no_self CHECK (referrer_company_id <> referee_company_id)
);

CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON referrals (referrer_company_id);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Companies can read own referrals"
  ON referrals FOR SELECT
  TO authenticated
  USING (
    referrer_company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

-- ── Purchase requests: track subscription + discount usage ─────────────────
ALTER TABLE purchase_requests
  ADD COLUMN IF NOT EXISTS is_subscription boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS referral_discount_applied boolean NOT NULL DEFAULT false;

-- ── Generate unique referral codes ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS text AS $$
DECLARE
  v_code text;
  v_tries int := 0;
BEGIN
  LOOP
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM companies WHERE upper(referral_code) = v_code);
    v_tries := v_tries + 1;
    IF v_tries > 20 THEN
      RAISE EXCEPTION 'Could not generate unique referral code';
    END IF;
  END LOOP;
  RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- Backfill codes for existing companies
UPDATE companies
SET referral_code = generate_referral_code()
WHERE referral_code IS NULL;

ALTER TABLE companies ALTER COLUMN referral_code SET NOT NULL;

-- ── Registration with optional referral code ───────────────────────────────
DROP FUNCTION IF EXISTS register_company(text, text, text, uuid, text);
DROP FUNCTION IF EXISTS register_company(text, text, text, uuid, text, text);

CREATE FUNCTION register_company(
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
        'error', 'Invalid referral code. Please check the code and try again.'
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

-- ── Approve purchase: reward referrer / consume discount ───────────────────
CREATE OR REPLACE FUNCTION approve_purchase_request(
  p_company_id uuid,
  p_credit_amount integer,
  p_is_subscription boolean DEFAULT false,
  p_referral_discount_applied boolean DEFAULT false
) RETURNS json AS $$
DECLARE
  v_user_id uuid;
  v_new_total integer;
  v_referrer_id uuid;
BEGIN
  SELECT user_id INTO v_user_id
  FROM company_users
  WHERE company_id = p_company_id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No user found for this company');
  END IF;

  UPDATE companies SET has_purchased = true WHERE id = p_company_id;

  INSERT INTO user_credits (user_id, search_credits, updated_at)
  VALUES (v_user_id, p_credit_amount, now())
  ON CONFLICT (user_id) DO UPDATE SET
    search_credits = user_credits.search_credits + p_credit_amount,
    updated_at     = now()
  RETURNING search_credits INTO v_new_total;

  IF p_is_subscription THEN
    -- Referrer earns 10% off next subscription when referee's first sub is approved
    SELECT referrer_company_id INTO v_referrer_id
    FROM referrals
    WHERE referee_company_id = p_company_id
      AND referral_subscription_rewarded = false;

    IF v_referrer_id IS NOT NULL THEN
      UPDATE companies
      SET referral_discount_pct = 10
      WHERE id = v_referrer_id;

      UPDATE referrals
      SET referral_subscription_rewarded = true
      WHERE referee_company_id = p_company_id;
    END IF;

    -- Consume one-time referrer discount
    IF p_referral_discount_applied THEN
      UPDATE companies
      SET referral_discount_pct = 0
      WHERE id = p_company_id;
    END IF;
  END IF;

  RETURN json_build_object('success', true, 'user_id', v_user_id, 'search_credits', v_new_total);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Stats for referrals tab (no leak of other companies' codes)
CREATE OR REPLACE FUNCTION get_referral_stats(p_company_id uuid)
RETURNS json AS $$
DECLARE
  v_user_company uuid;
BEGIN
  SELECT company_id INTO v_user_company
  FROM company_users
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_user_company IS NULL OR v_user_company <> p_company_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  RETURN json_build_object(
    'success', true,
    'referral_code', (SELECT referral_code FROM companies WHERE id = p_company_id),
    'referral_discount_pct', (SELECT referral_discount_pct FROM companies WHERE id = p_company_id),
    'referral_count', (
      SELECT count(*)::int FROM referrals WHERE referrer_company_id = p_company_id
    ),
    'rewarded_count', (
      SELECT count(*)::int FROM referrals
      WHERE referrer_company_id = p_company_id AND referral_subscription_rewarded = true
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
