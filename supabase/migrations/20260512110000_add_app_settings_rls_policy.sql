/*
  # Add admin RLS policy for app_settings

  The app_settings table is used for global feature flags like subscription_mode.
  If row-level security is enabled on this table, admin users need an explicit
  policy to read and modify those rows.
*/

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage app settings"
  ON public.app_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  );
