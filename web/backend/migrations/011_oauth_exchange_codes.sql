CREATE TABLE oauth_exchange_codes (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code_hash VARCHAR(64) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token VARCHAR(255) NOT NULL,
    expires_in INT NOT NULL DEFAULT 900,
    expires_at DATETIME NOT NULL,
    consumed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY oauth_exchange_codes_hash_unique (code_hash),
    KEY oauth_exchange_codes_expires_idx (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
