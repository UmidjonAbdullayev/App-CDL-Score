/*
  # Add reply_to column to driver_comments

  Enables threaded replies: a comment can reference another comment via reply_to.
  Nullable — top-level comments have null.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'driver_comments' AND column_name = 'reply_to'
  ) THEN
    ALTER TABLE driver_comments ADD COLUMN reply_to uuid REFERENCES driver_comments(id) ON DELETE CASCADE;
  END IF;
END $$;
