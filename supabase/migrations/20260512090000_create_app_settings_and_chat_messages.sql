/*
  # Add app settings and admin chat messages

  - `app_settings`: global application settings
  - `admin_chat_messages`: conversation history between admin and carrier companies
*/

SET search_path = public;

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL
);

INSERT INTO public.app_settings (key, value)
VALUES ('subscription_mode', 'false')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.admin_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('admin', 'carrier')),
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);
