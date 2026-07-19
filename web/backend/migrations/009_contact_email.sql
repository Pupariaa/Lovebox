ALTER TABLE users
    ADD COLUMN contact_email VARCHAR(255) NULL AFTER email,
    ADD COLUMN contact_email_verified_at DATETIME NULL AFTER contact_email,
    ADD COLUMN contact_email_verify_token VARCHAR(64) NULL AFTER contact_email_verified_at,
    ADD COLUMN password_set_at DATETIME NULL AFTER password_hash;
