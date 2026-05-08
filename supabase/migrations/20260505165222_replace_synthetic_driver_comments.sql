/*
  # Replace synthetic driver comments

  Deletes and rebuilds all comments for the 12 synthetic seed drivers
  (those with IDs starting with a1000000-...).

  Rules:
  - Each driver gets 2–4 comments from different carrier names
  - No two drivers share the same comment text
  - Carrier names are varied and realistic (no repeats within a driver)
  - Comments match the driver's risk profile (green/yellow/red)
*/

-- Remove existing synthetic comments only
DELETE FROM driver_comments
WHERE driver_id IN (
  'a1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000003',
  'a1000000-0000-0000-0000-000000000004',
  'a1000000-0000-0000-0000-000000000005',
  'a1000000-0000-0000-0000-000000000006',
  'a1000000-0000-0000-0000-000000000007',
  'a1000000-0000-0000-0000-000000000008',
  'a1000000-0000-0000-0000-000000000009',
  'a1000000-0000-0000-0000-000000000010',
  'a1000000-0000-0000-0000-000000000011',
  'a1000000-0000-0000-0000-000000000012'
);

-- Marcus T. Reynolds (green) — 3 comments
INSERT INTO driver_comments (driver_id, company_name, comment, stars, created_at) VALUES
('a1000000-0000-0000-0000-000000000001', 'Heartland Transport',    'Zero issues over 18 months of hauling. Always on time, always professional.',                                           5, now() - interval '14 days'),
('a1000000-0000-0000-0000-000000000001', 'Apex Freight LLC',       'One of the most reliable contractors we have worked with. Communicates proactively and never misses a delivery window.', 5, now() - interval '9 days'),
('a1000000-0000-0000-0000-000000000001', 'Iron Horse Carriers',    'Clean safety record. Pre-trip inspections always completed. Would hire again without hesitation.',                      5, now() - interval '3 days');

-- James D. Whitfield (green) — 2 comments
INSERT INTO driver_comments (driver_id, company_name, comment, stars, created_at) VALUES
('a1000000-0000-0000-0000-000000000002', 'BlueLine Logistics',     'Dependable on regional routes. Rarely misses check-ins, paperwork always correct.',                                    4, now() - interval '20 days'),
('a1000000-0000-0000-0000-000000000002', 'Summit Carriers',        'Good attitude under pressure. Had one late arrival due to weather but called ahead to notify dispatch.',               4, now() - interval '7 days');

-- Sandra L. Okafor (green) — 4 comments
INSERT INTO driver_comments (driver_id, company_name, comment, stars, created_at) VALUES
('a1000000-0000-0000-0000-000000000003', 'Ironclad Freight',       'Solid driver with a spotless record. Excellent attitude and very courteous at delivery docks.',                       5, now() - interval '30 days'),
('a1000000-0000-0000-0000-000000000003', 'Trident Hauling Co.',    'Reliable on time-sensitive loads. One minor delay on a long-haul but handled it professionally.',                    4, now() - interval '18 days'),
('a1000000-0000-0000-0000-000000000003', 'Pinnacle Freight Group', 'Handles oversized loads with care. No incidents on record with our fleet.',                                           5, now() - interval '10 days'),
('a1000000-0000-0000-0000-000000000003', 'Central States Haulage', 'Met every deadline during peak season. A driver we request by name.',                                                5, now() - interval '2 days');

-- Tyler B. Nguyen (yellow) — 3 comments
INSERT INTO driver_comments (driver_id, company_name, comment, stars, created_at) VALUES
('a1000000-0000-0000-0000-000000000004', 'Crossroads Transit',     'Performs acceptably on standard routes. Had one minor incident in a loading bay — no injuries.',                      3, now() - interval '25 days'),
('a1000000-0000-0000-0000-000000000004', 'Pacific Rim Logistics',  'Average communication. Completed most loads on schedule but showed up late twice without prior notice.',              2, now() - interval '13 days'),
('a1000000-0000-0000-0000-000000000004', 'Bluestar Dispatch',      'Inconsistent log accuracy on two trips. No major violations but worth monitoring closely.',                          3, now() - interval '5 days');

-- David M. Castillo (yellow) — 2 comments
INSERT INTO driver_comments (driver_id, company_name, comment, stars, created_at) VALUES
('a1000000-0000-0000-0000-000000000005', 'Delta Freight Inc.',     'Multiple late arrivals in Q3. Improving recently but still needs consistency on scheduling.',                         2, now() - interval '22 days'),
('a1000000-0000-0000-0000-000000000005', 'Central Haul Co.',       'Has potential but communication gaps have caused issues. Best suited for short routes until reliability improves.',   2, now() - interval '8 days');

-- Kevin R. Paulson (yellow) — 3 comments
INSERT INTO driver_comments (driver_id, company_name, comment, stars, created_at) VALUES
('a1000000-0000-0000-0000-000000000006', 'Vanguard Trucking',      'Missed two scheduled pickups without prior notice. Requires closer oversight from dispatch.',                         2, now() - interval '28 days'),
('a1000000-0000-0000-0000-000000000006', 'Redline Express',        'Performance has been inconsistent across several lanes. Drug test compliance confirmed on file.',                    2, now() - interval '15 days'),
('a1000000-0000-0000-0000-000000000006', 'Midwest Road Freight',   'Completed assignments but frequently needed reminders on paperwork. Low-risk flag but watch for pattern.',           2, now() - interval '4 days');

-- Angela F. Brooks (red) — 2 comments
INSERT INTO driver_comments (driver_id, company_name, comment, stars, created_at) VALUES
('a1000000-0000-0000-0000-000000000007', 'NorthStar Carriers',     'Showed up late repeatedly across multiple assignments. Limited responsiveness to dispatcher calls.',                 1, now() - interval '35 days'),
('a1000000-0000-0000-0000-000000000007', 'Titan Freight Group',    'Below average reliability. Would not assign critical or time-sensitive loads without close monitoring.',              1, now() - interval '11 days');

-- Robert J. Harmon (red) — 3 comments
INSERT INTO driver_comments (driver_id, company_name, comment, stars, created_at) VALUES
('a1000000-0000-0000-0000-000000000008', 'Keystone Logistics',     'Significant reliability issues over a 6-month period. Currently on probationary status with our fleet.',             1, now() - interval '40 days'),
('a1000000-0000-0000-0000-000000000008', 'LongHaul USA',           'Multiple no-shows without explanation. Communication has broken down completely at times.',                          1, now() - interval '19 days'),
('a1000000-0000-0000-0000-000000000008', 'Cornerstone Freight',    'Terminated contract after repeated failure to comply with HOS regulations. Not eligible for rehire.',                1, now() - interval '6 days');

-- Carlos E. Mendez (red) — 4 comments
INSERT INTO driver_comments (driver_id, company_name, comment, stars, created_at) VALUES
('a1000000-0000-0000-0000-000000000009', 'Southern Cross Freight', 'Failed pre-employment drug screening in 2024. Currently in return-to-duty protocol per DOT guidelines.',             1, now() - interval '45 days'),
('a1000000-0000-0000-0000-000000000009', 'Gulf Coast Carriers',    'High-risk profile. Do not assign any load without direct supervisor clearance.',                                      1, now() - interval '30 days'),
('a1000000-0000-0000-0000-000000000009', 'Sunbelt Transport LLC',  'History of logbook falsification. Flagged in our system. Would not recommend to any partner carrier.',               1, now() - interval '14 days'),
('a1000000-0000-0000-0000-000000000009', 'Rio Grande Haulage',     'Involved in a preventable accident while under our employment. Case is still under review.',                         1, now() - interval '3 days');

-- Darnell Q. Gibson (red) — 2 comments
INSERT INTO driver_comments (driver_id, company_name, comment, stars, created_at) VALUES
('a1000000-0000-0000-0000-000000000010', 'Midwest Haul Inc.',      'Terminated after repeated non-compliance with safety protocols. Not eligible for rehire under any circumstances.',   1, now() - interval '50 days'),
('a1000000-0000-0000-0000-000000000010', 'Riverdale Transport',    'Multiple safety violations on record including two roadside inspections with critical OOS defects.',                 1, now() - interval '22 days');

-- Patrick O. Simmons (red) — 3 comments
INSERT INTO driver_comments (driver_id, company_name, comment, stars, created_at) VALUES
('a1000000-0000-0000-0000-000000000011', 'Cascade Logistics',      'Several failed random drug screenings on record. Avoid assigning any loads.',                                         1, now() - interval '60 days'),
('a1000000-0000-0000-0000-000000000011', 'Horizon Freight',        'Abandoned a load mid-route without notifying dispatch. Caused a significant financial loss.',                        1, now() - interval '33 days'),
('a1000000-0000-0000-0000-000000000011', 'Statewide Cargo Inc.',   'Involved in a DUI incident while operating a company vehicle. Contract terminated immediately.',                     1, now() - interval '8 days');

-- Leon T. Barrett (red) — 2 comments
INSERT INTO driver_comments (driver_id, company_name, comment, stars, created_at) VALUES
('a1000000-0000-0000-0000-000000000012', 'Eagle Transport LLC',    'Blacklisted by three carrier partners. Significant legal history involving cargo theft allegations.',                 1, now() - interval '70 days'),
('a1000000-0000-0000-0000-000000000012', 'Atlas Trucking Co.',     'Suspended CDL at time of last engagement. Do not engage under any circumstances pending legal resolution.',          1, now() - interval '25 days');
