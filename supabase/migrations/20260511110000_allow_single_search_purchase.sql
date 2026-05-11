# Allow purchase_requests to have search_count >= 1 (for first-time offer)

ALTER TABLE purchase_requests DROP CONSTRAINT purchase_requests_search_count_check;
ALTER TABLE purchase_requests ADD CONSTRAINT purchase_requests_search_count_check CHECK (search_count >= 1);