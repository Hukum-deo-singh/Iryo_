package com.iryo.backend.measurement;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "health_measurements")
public class HealthMeasurement {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "device_pk", nullable = false, updatable = false)
    private UUID devicePk;

    /** The user who held the device when this reading arrived. Null means nobody did, so nobody can see it. */
    @Column(name = "user_pk", updatable = false)
    private UUID userPk;

    @Column(name = "measured_at", nullable = false, updatable = false)
    private Instant measuredAt;

    @Column(name = "spo2_percent", nullable = false, updatable = false, precision = 5, scale = 2)
    private BigDecimal spo2Percent;

    @Column(name = "temperature_c", nullable = false, updatable = false, precision = 5, scale = 2)
    private BigDecimal temperatureC;

    @Column(name = "heart_rate_bpm", updatable = false, precision = 5, scale = 2)
    private BigDecimal heartRateBpm;

    @Column(name = "height_cm", updatable = false, precision = 5, scale = 1)
    private BigDecimal heightCm;

    @Column(name = "source_message_id", updatable = false)
    private String sourceMessageId;

    @Column(name = "received_at", nullable = false, updatable = false)
    private Instant receivedAt;

    protected HealthMeasurement() {
    }

    public static HealthMeasurement create(UUID devicePk, UUID userPk, Instant measuredAt, BigDecimal spo2Percent,
            BigDecimal temperatureC, BigDecimal heartRateBpm, BigDecimal heightCm, String sourceMessageId,
            Instant receivedAt) {
        HealthMeasurement m = new HealthMeasurement();
        m.id = UUID.randomUUID();
        m.devicePk = devicePk;
        m.userPk = userPk;
        m.measuredAt = measuredAt;
        m.spo2Percent = spo2Percent;
        m.temperatureC = temperatureC;
        m.heartRateBpm = heartRateBpm;
        m.heightCm = heightCm;
        m.sourceMessageId = sourceMessageId;
        m.receivedAt = receivedAt;
        return m;
    }

    public Instant getMeasuredAt() {
        return measuredAt;
    }

    public BigDecimal getSpo2Percent() {
        return spo2Percent;
    }

    public BigDecimal getTemperatureC() {
        return temperatureC;
    }

    public BigDecimal getHeartRateBpm() {
        return heartRateBpm;
    }

    public BigDecimal getHeightCm() {
        return heightCm;
    }

    public Instant getReceivedAt() {
        return receivedAt;
    }
}
