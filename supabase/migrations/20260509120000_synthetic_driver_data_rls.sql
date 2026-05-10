/*
  If the CSV table "synthetic driver data" exists, allow authenticated users to read it
  (required for the dashboard client .select('*')).
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename = 'synthetic driver data'
  ) THEN
    EXECUTE 'ALTER TABLE public."synthetic driver data" ENABLE ROW LEVEL SECURITY';

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'synthetic driver data'
        AND policyname = 'Authenticated read synthetic driver data'
    ) THEN
      EXECUTE $pol$CREATE POLICY "Authenticated read synthetic driver data"
        ON public."synthetic driver data"
        FOR SELECT
        TO authenticated
        USING (true)$pol$;
    END IF;
  END IF;
END $$;
