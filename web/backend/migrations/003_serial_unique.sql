SET NAMES utf8mb4;

SET @db = DATABASE();

DELETE d1 FROM devices d1
INNER JOIN devices d2 ON LOWER(d1.serial_number) = LOWER(d2.serial_number)
    AND d1.serial_number <> ''
    AND d2.serial_number <> ''
    AND d1.id > d2.id
    AND (
        d2.owner_user_id IS NOT NULL
        OR (d1.owner_user_id IS NULL AND d2.id < d1.id)
    );

UPDATE devices SET serial_number = CONCAT('LEGACY-', id) WHERE serial_number = '';

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'devices' AND INDEX_NAME = 'devices_serial_unique') = 0,
    'ALTER TABLE devices ADD UNIQUE KEY devices_serial_unique (serial_number)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

DELETE p1 FROM pairings p1
INNER JOIN pairings p2 ON p1.sender_user_id = p2.sender_user_id
    AND p1.target_device_id = p2.target_device_id
    AND p1.status = 'active'
    AND p2.status = 'active'
    AND p1.id > p2.id;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'pairings' AND INDEX_NAME = 'pairings_sender_target_unique') = 0,
    'ALTER TABLE pairings ADD UNIQUE KEY pairings_sender_target_unique (sender_user_id, target_device_id)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
