-- Optional readings from the device. Older rows and devices without these sensors keep NULL.
ALTER TABLE health_measurements ADD COLUMN heart_rate_bpm NUMERIC(5, 2);
ALTER TABLE health_measurements ADD COLUMN height_cm NUMERIC(5, 1);

ALTER TABLE health_measurements ADD CONSTRAINT chk_heart_rate_bpm
    CHECK (heart_rate_bpm IS NULL OR (heart_rate_bpm >= 20 AND heart_rate_bpm <= 250));
ALTER TABLE health_measurements ADD CONSTRAINT chk_height_cm
    CHECK (height_cm IS NULL OR (height_cm >= 30 AND height_cm <= 260));
