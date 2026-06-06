/*
  Optional contact and experience fields for driver submissions and comment notifications.
*/
ALTER TABLE public.driver_submissions
  ADD COLUMN IF NOT EXISTS driver_phone text,
  ADD COLUMN IF NOT EXISTS years_experience integer CHECK (years_experience IS NULL OR (years_experience >= 0 AND years_experience <= 60));

ALTER TABLE public.driver_comments
  ADD COLUMN IF NOT EXISTS driver_phone text;

ALTER TABLE public.synthetic_driver_comments
  ADD COLUMN IF NOT EXISTS driver_phone text;
