SET NAMES utf8mb4;

ALTER TABLE deletion_requests
    ADD COLUMN IF NOT EXISTS action VARCHAR(32) NOT NULL DEFAULT 'account_delete' AFTER email;
