CREATE TABLE app_users (
    id              UUID PRIMARY KEY,
    user_id         VARCHAR(32)  NOT NULL UNIQUE,
    display_name    VARCHAR(120) NOT NULL,
    email           VARCHAR(254) NOT NULL UNIQUE,
    password_hash   VARCHAR(100) NOT NULL,
    account_status  VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE',
    token_version   INTEGER      NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_app_users_status CHECK (account_status IN ('ACTIVE', 'DISABLED'))
);

CREATE TABLE devices (
    id               UUID PRIMARY KEY,
    device_id        VARCHAR(80) NOT NULL UNIQUE,
    device_status    VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    ingest_key_hash  VARCHAR(64) NOT NULL,
    assigned_user_id UUID,
    assigned_at      TIMESTAMPTZ,
    last_seen_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_devices_assigned_user FOREIGN KEY (assigned_user_id)
        REFERENCES app_users (id) ON DELETE RESTRICT,
    CONSTRAINT chk_devices_status CHECK (device_status IN ('ACTIVE', 'DISABLED')),
    CONSTRAINT chk_device_assignment CHECK (
        (assigned_user_id IS NULL AND assigned_at IS NULL)
        OR (assigned_user_id IS NOT NULL AND assigned_at IS NOT NULL)
    )
);

-- MVP rule: one device per user.
CREATE UNIQUE INDEX uq_devices_assigned_user ON devices (assigned_user_id)
    WHERE assigned_user_id IS NOT NULL;

CREATE TABLE health_measurements (
    id                UUID PRIMARY KEY,
    device_pk         UUID          NOT NULL,
    measured_at       TIMESTAMPTZ   NOT NULL,
    spo2_percent      NUMERIC(5, 2) NOT NULL,
    temperature_c     NUMERIC(5, 2) NOT NULL,
    source_message_id VARCHAR(128),
    received_at       TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_measurements_device FOREIGN KEY (device_pk)
        REFERENCES devices (id) ON DELETE RESTRICT,
    CONSTRAINT chk_spo2_percent CHECK (spo2_percent >= 0 AND spo2_percent <= 100),
    CONSTRAINT chk_temperature_c CHECK (temperature_c >= 0 AND temperature_c <= 60)
);

CREATE INDEX idx_measurements_device_time ON health_measurements (device_pk, measured_at DESC);

CREATE UNIQUE INDEX uq_measurement_device_source ON health_measurements (device_pk, source_message_id)
    WHERE source_message_id IS NOT NULL;
