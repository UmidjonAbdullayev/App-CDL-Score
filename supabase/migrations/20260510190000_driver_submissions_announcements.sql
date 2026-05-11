/*
  Carrier driver submissions (pending review), admin announcements, storage for proof docs.
*/

-- ── driver_submissions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.driver_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  submitted_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  score integer NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  reliability_pct integer NOT NULL DEFAULT 0 CHECK (reliability_pct >= 0 AND reliability_pct <= 100),
  drug_test_pct integer NOT NULL DEFAULT 100 CHECK (drug_test_pct >= 0 AND drug_test_pct <= 100),
  on_time_pct integer NOT NULL DEFAULT 0 CHECK (on_time_pct >= 0 AND on_time_pct <= 100),
  stars numeric NOT NULL DEFAULT 0,
  flag text NOT NULL DEFAULT 'green' CHECK (flag IN ('green', 'yellow', 'red')),
  pending_comment text,
  pending_comment_stars integer CHECK (pending_comment_stars IS NULL OR (pending_comment_stars >= 0 AND pending_comment_stars <= 5)),
  attachment_path text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_response text,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resulting_driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_submissions_company ON public.driver_submissions(company_id);
CREATE INDEX IF NOT EXISTS idx_driver_submissions_status ON public.driver_submissions(status);

ALTER TABLE public.driver_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Carriers insert own company submissions"
  ON public.driver_submissions FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (SELECT cu.company_id FROM public.company_users cu WHERE cu.user_id = auth.uid())
  );

CREATE POLICY "Carriers read own company submissions"
  ON public.driver_submissions FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT cu.company_id FROM public.company_users cu WHERE cu.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
  );

CREATE POLICY "Carriers update own pending submissions"
  ON public.driver_submissions FOR UPDATE TO authenticated
  USING (
    status = 'pending'
    AND company_id IN (SELECT cu.company_id FROM public.company_users cu WHERE cu.user_id = auth.uid())
  )
  WITH CHECK (
    status = 'pending'
    AND company_id IN (SELECT cu.company_id FROM public.company_users cu WHERE cu.user_id = auth.uid())
  );

-- ── carrier_announcements ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.carrier_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_carrier_announcements_active ON public.carrier_announcements(is_active, published_at DESC);

ALTER TABLE public.carrier_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read announcements"
  ON public.carrier_announcements FOR SELECT TO authenticated
  USING (
    is_active = true
    OR EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
  );

CREATE POLICY "Admins insert announcements"
  ON public.carrier_announcements FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

CREATE POLICY "Admins update announcements"
  ON public.carrier_announcements FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

-- ── Storage bucket for submission attachments ─────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('driver-submission-docs', 'driver-submission-docs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Carriers upload submission docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'driver-submission-docs'
    AND split_part(name, '/', 1) IN (
      SELECT cu.company_id::text FROM public.company_users cu WHERE cu.user_id = auth.uid()
    )
  );

CREATE POLICY "Carriers read own submission docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'driver-submission-docs'
    AND split_part(name, '/', 1) IN (
      SELECT cu.company_id::text FROM public.company_users cu WHERE cu.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins read all submission docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'driver-submission-docs'
    AND EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
  );

-- ── Approve / reject RPCs (SECURITY DEFINER) ───────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_driver_submission(
  p_submission_id uuid,
  p_admin_note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.driver_submissions%ROWTYPE;
  v_driver_id uuid;
  v_company_name text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT * INTO s FROM public.driver_submissions WHERE id = p_submission_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Submission not found');
  END IF;
  IF s.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Submission is not pending');
  END IF;

  SELECT name INTO v_company_name FROM public.companies WHERE id = s.company_id;

  INSERT INTO public.drivers (
    full_name, score, reliability_pct, drug_test_pct, on_time_pct, flag, stars, company_id, is_synthetic
  )
  VALUES (
    s.full_name, s.score, s.reliability_pct, s.drug_test_pct, s.on_time_pct, s.flag, s.stars, s.company_id, false
  )
  RETURNING id INTO v_driver_id;

  IF s.pending_comment IS NOT NULL AND length(trim(s.pending_comment)) > 0 THEN
    INSERT INTO public.driver_comments (
      driver_id, company_name, comment, stars, user_id, company_id
    )
    VALUES (
      v_driver_id,
      coalesce(v_company_name, 'Unknown Company'),
      trim(s.pending_comment),
      coalesce(s.pending_comment_stars, 0),
      s.submitted_by_user_id,
      s.company_id
    );
  END IF;

  UPDATE public.driver_submissions
  SET
    status = 'approved',
    admin_response = nullif(trim(p_admin_note), ''),
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    resulting_driver_id = v_driver_id
  WHERE id = p_submission_id;

  RETURN jsonb_build_object('success', true, 'driver_id', v_driver_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_driver_submission(
  p_submission_id uuid,
  p_admin_note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.driver_submissions WHERE id = p_submission_id AND status = 'pending') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pending submission not found');
  END IF;

  UPDATE public.driver_submissions
  SET
    status = 'rejected',
    admin_response = nullif(trim(p_admin_note), ''),
    reviewed_at = now(),
    reviewed_by = auth.uid()
  WHERE id = p_submission_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_driver_submission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_driver_submission(uuid, text) TO authenticated;
