SET NAMES utf8mb4;

SET @db = DATABASE();

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'messages' AND COLUMN_NAME = 'opened_at') = 0,
    'ALTER TABLE messages ADD COLUMN opened_at DATETIME NULL AFTER acked_at',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'messages' AND COLUMN_NAME = 'seen_at') = 0,
    'ALTER TABLE messages ADD COLUMN seen_at DATETIME NULL AFTER opened_at',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'messages'
       AND CONSTRAINT_NAME = 'messages_status_check' AND CONSTRAINT_TYPE = 'CHECK') > 0,
    'ALTER TABLE messages DROP CONSTRAINT messages_status_check',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE messages SET status = 'seen' WHERE status = 'acked';

SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'messages'
       AND CONSTRAINT_NAME = 'messages_status_check' AND CONSTRAINT_TYPE = 'CHECK') = 0,
    'ALTER TABLE messages ADD CONSTRAINT messages_status_check CHECK (status IN (''queued'', ''delivering'', ''delivered'', ''received'', ''opened'', ''seen'', ''acked''))',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
