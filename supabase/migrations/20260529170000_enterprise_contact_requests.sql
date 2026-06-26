/*
  Enterprise (unlimited) contact requests from billing modal.
  Run this in the Supabase SQL editor if migrations are not connected.
*/

CREATE TABLE IF NOT EXISTS public.enterprise_contact_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contact_email text NOT NULL,
  contact_phone text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'contacted', 'closed')),
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS enterprise_contact_requests_company_idx
  ON public.enterprise_contact_requests (company_id);

CREATE INDEX IF NOT EXISTS enterprise_contact_requests_status_idx
  ON public.enterprise_contact_requests (status, created_at DESC);

ALTER TABLE public.enterprise_contact_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Companies insert own enterprise requests" ON public.enterprise_contact_requests;
DROP POLICY IF EXISTS "Companies read own enterprise requests" ON public.enterprise_contact_requests;
DROP POLICY IF EXISTS "Admins read all enterprise requests" ON public.enterprise_contact_requests;
DROP POLICY IF EXISTS "Admins update enterprise requests" ON public.enterprise_contact_requests;

CREATE POLICY "Companies insert own enterprise requests"
  ON public.enterprise_contact_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Companies read own enterprise requests"
  ON public.enterprise_contact_requests FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins read all enterprise requests"
  ON public.enterprise_contact_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins update enterprise requests"
  ON public.enterprise_contact_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  );
