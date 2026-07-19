SET NAMES utf8mb4;

ALTER TABLE devices
    ADD COLUMN IF NOT EXISTS rssi INT NULL AFTER firmware_version,
    ADD COLUMN IF NOT EXISTS free_heap INT UNSIGNED NULL AFTER rssi,
    ADD COLUMN IF NOT EXISTS uptime_s INT UNSIGNED NULL AFTER free_heap,
    ADD COLUMN IF NOT EXISTS ip_addr VARCHAR(45) NULL AFTER uptime_s,
    ADD COLUMN IF NOT EXISTS mac_addr VARCHAR(17) NULL AFTER ip_addr,
    ADD COLUMN IF NOT EXISTS telemetry_at DATETIME NULL AFTER mac_addr;

ALTER TABLE devices
    ADD INDEX IF NOT EXISTS idx_devices_fw (firmware_version),
    ADD INDEX IF NOT EXISTS idx_devices_last_seen (last_seen_at);
