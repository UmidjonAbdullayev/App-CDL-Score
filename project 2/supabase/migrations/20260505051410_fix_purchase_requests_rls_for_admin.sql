/*
  # Fix purchase_requests RLS policies

  Admin users need full access to all purchase requests.
  Previously only companies could see their own requests,
  and there were no UPDATE or DELETE policies at all.

  Changes:
  - Add SELECT policy for admin_users (read all requests)
  - Add UPDATE policy for admin_users (approve/reject)
  - Add DELETE policy for admin_users (delete after approval)
  - Add DELETE policy for companies (cancel own pending requests)
*/

-- Admin can read all requests
CREATE POLICY "Admins can read all purchase requests"
  ON purchase_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

-- Admin can update any request (status changes)
CREATE POLICY "Admins can update purchase requests"
  ON purchase_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

-- Admin can delete any request
CREATE POLICY "Admins can delete purchase requests"
  ON purchase_requests FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );
