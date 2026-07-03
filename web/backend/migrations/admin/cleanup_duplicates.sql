-- Run manually on production after backup.
-- Merges duplicate devices by serial_number (keeps owned row or lowest id).

SET @keep_id = NULL;
SET @serial = 'BACXS32F2325062026R4';

SELECT id INTO @keep_id FROM devices
WHERE LOWER(serial_number) = LOWER(@serial)
ORDER BY (owner_user_id IS NOT NULL) DESC, id ASC
LIMIT 1;

UPDATE pairings SET target_device_id = @keep_id
WHERE target_device_id IN (
    SELECT id FROM (SELECT id FROM devices WHERE LOWER(serial_number) = LOWER(@serial) AND id <> @keep_id) t
);

UPDATE messages SET target_device_id = @keep_id
WHERE target_device_id IN (
    SELECT id FROM (SELECT id FROM devices WHERE LOWER(serial_number) = LOWER(@serial) AND id <> @keep_id) t
);

UPDATE sent_message_log SET target_device_id = @keep_id
WHERE target_device_id IN (
    SELECT id FROM (SELECT id FROM devices WHERE LOWER(serial_number) = LOWER(@serial) AND id <> @keep_id) t
);

DELETE FROM devices
WHERE LOWER(serial_number) = LOWER(@serial) AND id <> @keep_id;

DELETE p1 FROM pairings p1
INNER JOIN pairings p2 ON p1.sender_user_id = p2.sender_user_id
    AND p1.target_device_id = p2.target_device_id
    AND p1.status = 'active'
    AND p2.status = 'active'
    AND p1.id > p2.id;
