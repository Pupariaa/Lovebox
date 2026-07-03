CREATE TABLE IF NOT EXISTS firmware_releases (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    version VARCHAR(32) NOT NULL,
    channel VARCHAR(16) NOT NULL DEFAULT 'stable',
    firmware_file VARCHAR(255) NOT NULL,
    firmware_sha256 CHAR(64) NOT NULL,
    firmware_size BIGINT UNSIGNED NOT NULL,
    assets_file VARCHAR(255) NULL,
    assets_sha256 CHAR(64) NULL,
    assets_size BIGINT UNSIGNED NULL,
    min_version VARCHAR(32) NULL,
    notes TEXT NULL,
    published TINYINT(1) NOT NULL DEFAULT 0,
    published_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_firmware_version (version),
    KEY idx_firmware_published (published, published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
