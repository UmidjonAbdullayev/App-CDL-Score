/*
  # CDL Score - Drivers Schema

  1. New Tables
    - `drivers`
      - `id` (uuid, primary key)
      - `full_name` (text, not null)
      - `score` (integer 0-100)
      - `reliability_pct` (integer 0-100)
      - `drug_test_pct` (integer 0-100)
      - `on_time_pct` (integer 0-100)
      - `flag` (text: 'green' | 'yellow' | 'red')
      - `created_at` (timestamptz)
    - `driver_comments`
      - `id` (uuid, primary key)
      - `driver_id` (uuid, foreign key -> drivers)
      - `company_name` (text)
      - `comment` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Authenticated users can read all drivers and comments
    - No public access

  3. Seed Data
    - 12 sample drivers with varied scores and flags
*/

CREATE TABLE IF NOT EXISTS drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  score integer NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  reliability_pct integer NOT NULL DEFAULT 0 CHECK (reliability_pct >= 0 AND reliability_pct <= 100),
  drug_test_pct integer NOT NULL DEFAULT 0 CHECK (drug_test_pct >= 0 AND drug_test_pct <= 100),
  on_time_pct integer NOT NULL DEFAULT 0 CHECK (on_time_pct >= 0 AND on_time_pct <= 100),
  flag text NOT NULL DEFAULT 'green' CHECK (flag IN ('green', 'yellow', 'red')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS driver_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  comment text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read drivers"
  ON drivers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read driver comments"
  ON driver_comments FOR SELECT
  TO authenticated
  USING (true);

-- Seed drivers
INSERT INTO drivers (id, full_name, score, reliability_pct, drug_test_pct, on_time_pct, flag) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Marcus T. Reynolds', 94, 97, 100, 92, 'green'),
  ('a1000000-0000-0000-0000-000000000002', 'James D. Whitfield', 87, 91, 100, 85, 'green'),
  ('a1000000-0000-0000-0000-000000000003', 'Sandra L. Okafor', 82, 88, 96, 80, 'green'),
  ('a1000000-0000-0000-0000-000000000004', 'Tyler B. Nguyen', 76, 80, 100, 74, 'green'),
  ('a1000000-0000-0000-0000-000000000005', 'David M. Castillo', 68, 72, 90, 65, 'yellow'),
  ('a1000000-0000-0000-0000-000000000006', 'Kevin R. Paulson', 61, 65, 85, 60, 'yellow'),
  ('a1000000-0000-0000-0000-000000000007', 'Angela F. Brooks', 55, 58, 80, 52, 'yellow'),
  ('a1000000-0000-0000-0000-000000000008', 'Robert J. Harmon', 48, 50, 75, 45, 'yellow'),
  ('a1000000-0000-0000-0000-000000000009', 'Carlos E. Mendez', 34, 38, 60, 30, 'red'),
  ('a1000000-0000-0000-0000-000000000010', 'Darnell Q. Gibson', 28, 30, 50, 25, 'red'),
  ('a1000000-0000-0000-0000-000000000011', 'Patrick O. Simmons', 19, 20, 40, 18, 'red'),
  ('a1000000-0000-0000-0000-000000000012', 'Leon T. Barrett', 11, 15, 30, 10, 'red');

-- Seed comments
INSERT INTO driver_comments (driver_id, company_name, comment) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Apex Freight LLC', 'Consistently on time and communicates proactively. One of our top-rated contractors.'),
  ('a1000000-0000-0000-0000-000000000001', 'Heartland Transport', 'Zero issues over 18 months. Highly recommended for long-haul routes.'),
  ('a1000000-0000-0000-0000-000000000002', 'BlueLine Logistics', 'Dependable and professional. Rarely misses check-ins.'),
  ('a1000000-0000-0000-0000-000000000002', 'Summit Carriers', 'Good performance on regional routes. Occasionally slow to respond.'),
  ('a1000000-0000-0000-0000-000000000003', 'Ironclad Freight', 'Solid driver with a clean record. Good attitude on the road.'),
  ('a1000000-0000-0000-0000-000000000003', 'Trident Hauling Co.', 'Reliable for time-sensitive loads. Minor delay on one delivery.'),
  ('a1000000-0000-0000-0000-000000000004', 'Pacific Rim Logistics', 'Good work ethic. Communication could be more consistent.'),
  ('a1000000-0000-0000-0000-000000000004', 'Crossroads Transit', 'Performs well on standard routes. No major incidents on record.'),
  ('a1000000-0000-0000-0000-000000000005', 'Delta Freight Inc.', 'Multiple late arrivals in Q3. Improving but still inconsistent.'),
  ('a1000000-0000-0000-0000-000000000005', 'Central Haul Co.', 'Has potential but needs improvement in communication and scheduling.'),
  ('a1000000-0000-0000-0000-000000000006', 'Vanguard Trucking', 'Missed two scheduled pickups without prior notice.'),
  ('a1000000-0000-0000-0000-000000000006', 'Redline Express', 'Performance has been inconsistent. Drug test compliance on record.'),
  ('a1000000-0000-0000-0000-000000000007', 'Titan Freight Group', 'Below average reliability. Would not assign critical loads without monitoring.'),
  ('a1000000-0000-0000-0000-000000000007', 'NorthStar Carriers', 'Showed up late repeatedly. Limited responsiveness.'),
  ('a1000000-0000-0000-0000-000000000008', 'Keystone Logistics', 'Significant reliability issues. Placed on probationary status.'),
  ('a1000000-0000-0000-0000-000000000008', 'LongHaul USA', 'Multiple no-shows. Communication has broken down at times.'),
  ('a1000000-0000-0000-0000-000000000009', 'Southern Cross Freight', 'Failed drug screening in 2024. Currently in return-to-duty protocol.'),
  ('a1000000-0000-0000-0000-000000000009', 'Gulf Coast Carriers', 'High risk profile. Do not assign without clearance.'),
  ('a1000000-0000-0000-0000-000000000010', 'Midwest Haul Inc.', 'Terminated after repeated non-compliance. Not eligible for rehire.'),
  ('a1000000-0000-0000-0000-000000000010', 'Riverdale Transport', 'Multiple safety violations on record. Not recommended.'),
  ('a1000000-0000-0000-0000-000000000011', 'Horizon Freight', 'History of abandoning loads mid-route. Extremely high risk.'),
  ('a1000000-0000-0000-0000-000000000011', 'Cascade Logistics', 'Several failed screenings. Avoid.'),
  ('a1000000-0000-0000-0000-000000000012', 'Atlas Trucking Co.', 'Suspended license. Do not engage under any circumstances.'),
  ('a1000000-0000-0000-0000-000000000012', 'Eagle Transport LLC', 'Blacklisted by multiple carriers. Significant legal history.');
