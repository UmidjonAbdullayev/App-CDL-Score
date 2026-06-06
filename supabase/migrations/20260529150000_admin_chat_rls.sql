/*
  RLS for admin_chat_messages: carriers can read/send for their company,
  admins can read/send for any company.
*/

ALTER TABLE public.admin_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own messages" ON public.admin_chat_messages;
DROP POLICY IF EXISTS "Admins can insert messages" ON public.admin_chat_messages;
DROP POLICY IF EXISTS "Carriers read own chat" ON public.admin_chat_messages;
DROP POLICY IF EXISTS "Carriers send chat" ON public.admin_chat_messages;
DROP POLICY IF EXISTS "Admins read all chat" ON public.admin_chat_messages;
DROP POLICY IF EXISTS "Admins send chat" ON public.admin_chat_messages;

CREATE POLICY "Carriers read own chat"
  ON public.admin_chat_messages FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Carriers send chat"
  ON public.admin_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_role = 'carrier'
    AND company_id IN (
      SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins read all chat"
  ON public.admin_chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins send chat"
  ON public.admin_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_role = 'admin'
    AND EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  );
