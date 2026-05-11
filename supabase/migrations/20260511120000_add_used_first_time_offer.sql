# Add used_first_time_offer field to companies table

ALTER TABLE companies ADD COLUMN used_first_time_offer boolean DEFAULT false;