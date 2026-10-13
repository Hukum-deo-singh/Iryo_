-- A device is linked to a user for a short session, then becomes free again.
ALTER TABLE devices ADD COLUMN assigned_until TIMESTAMPTZ;

UPDATE devices SET assigned_until = assigned_at + INTERVAL '2 minutes' WHERE assigned_user_id IS NOT NULL;

ALTER TABLE devices ADD CONSTRAINT chk_device_assignment_until
    CHECK ((assigned_user_id IS NULL) = (assigned_until IS NULL));

-- Readings belong to the user who held the device when they arrived, so history survives the session.
ALTER TABLE health_measurements ADD COLUMN user_pk UUID;

ALTER TABLE health_measurements ADD CONSTRAINT fk_measurements_user
    FOREIGN KEY (user_pk) REFERENCES app_users (id) ON DELETE RESTRICT;

UPDATE health_measurements m
SET user_pk = d.assigned_user_id
FROM devices d
WHERE m.device_pk = d.id AND d.assigned_user_id IS NOT NULL;

CREATE INDEX idx_measurements_user_time ON health_measurements (user_pk, measured_at DESC)
    WHERE user_pk IS NOT NULL;
