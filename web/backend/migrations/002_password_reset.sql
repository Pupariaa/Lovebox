ALTER TABLE users
    ADD COLUMN password_reset_token VARCHAR(64) NULL AFTER email_verify_token,
    ADD COLUMN password_reset_expires_at DATETIME NULL AFTER password_reset_token;

CREATE INDEX users_password_reset_token_idx ON users (password_reset_token);
