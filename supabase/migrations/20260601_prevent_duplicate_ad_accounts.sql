-- Prevent duplicate ad accounts with same platform + account name + advertiser
-- First, clean up any existing duplicates by keeping the oldest row
DELETE FROM ad_accounts
WHERE id NOT IN (
  SELECT DISTINCT ON (platform_id, account_name, advertiser_id) id
  FROM ad_accounts
  ORDER BY platform_id, account_name, advertiser_id, created_at ASC
);

ALTER TABLE ad_accounts
  ADD CONSTRAINT uq_ad_accounts_platform_name_advertiser
  UNIQUE (platform_id, account_name, advertiser_id);
