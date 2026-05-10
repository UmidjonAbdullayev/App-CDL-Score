/*
  Read CSV lookup table via RPC so the browser does not depend on RLS on
  public."synthetic driver data" (common reason .from() returns nothing / errors).
*/

CREATE OR REPLACE FUNCTION public.get_synthetic_driver_data_rows()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF to_regclass('public."synthetic driver data"') IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;
  RETURN COALESCE(
    (SELECT jsonb_agg(to_jsonb(t)) FROM public."synthetic driver data" AS t),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_synthetic_driver_data_rows() TO authenticated;
