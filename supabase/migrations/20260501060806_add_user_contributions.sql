/*
  # Add User Contribution Features

  1. Updated Security
    - Users can insert their own driver records
    - Users can insert comments on any driver
    
  2. Policies
    - CREATE policy for authenticated users to insert drivers
    - CREATE policy for authenticated users to insert driver comments
*/

CREATE POLICY "Authenticated users can insert drivers"
  ON drivers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert driver comments"
  ON driver_comments FOR INSERT
  TO authenticated
  WITH CHECK (true);
