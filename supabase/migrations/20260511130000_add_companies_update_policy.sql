# Add UPDATE policy for companies table

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'companies' AND policyname = 'Users can update their own company'
  ) THEN
    CREATE POLICY "Users can update their own company"
      ON companies FOR UPDATE
      TO authenticated
      USING (
        id IN (
          SELECT company_id FROM company_users WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;