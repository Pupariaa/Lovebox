ALTER TABLE devices
    ADD COLUMN locale VARCHAR(8) NULL DEFAULT NULL AFTER region_override;
