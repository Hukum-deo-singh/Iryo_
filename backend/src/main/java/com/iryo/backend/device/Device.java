package com.iryo.backend.device;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "devices")
public class Device {

    public static final String STATUS_ACTIVE = "ACTIVE";

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "device_id", nullable = false, updatable = false)
    private String deviceId;

    @Column(name = "device_status", nullable = false)
    private String deviceStatus;

    @Column(name = "ingest_key_hash", nullable = false)
    private String ingestKeyHash;

    @Column(name = "assigned_user_id")
    private UUID assignedUserId;

    @Column(name = "assigned_at")
    private Instant assignedAt;

    @Column(name = "assigned_until")
    private Instant assignedUntil;

    @Column(name = "last_seen_at")
    private Instant lastSeenAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected Device() {
    }

    public static Device provision(UUID id, String deviceId, String ingestKeyHash, Instant now) {
        Device device = new Device();
        device.id = id;
        device.deviceId = deviceId;
        device.deviceStatus = STATUS_ACTIVE;
        device.ingestKeyHash = ingestKeyHash;
        device.createdAt = now;
        return device;
    }

    public void assignTo(UUID userId, Instant now, Instant until) {
        this.assignedUserId = userId;
        this.assignedAt = now;
        this.assignedUntil = until;
    }

    /** True while a user holds the device. An expired session counts as free even before cleanup runs. */
    public boolean isHeldAt(Instant now) {
        return assignedUserId != null && assignedUntil != null && assignedUntil.isAfter(now);
    }

    public boolean isActive() {
        return STATUS_ACTIVE.equals(deviceStatus);
    }

    public UUID getId() {
        return id;
    }

    public String getDeviceId() {
        return deviceId;
    }

    public String getDeviceStatus() {
        return deviceStatus;
    }

    public String getIngestKeyHash() {
        return ingestKeyHash;
    }

    public UUID getAssignedUserId() {
        return assignedUserId;
    }

    public Instant getAssignedAt() {
        return assignedAt;
    }

    public Instant getAssignedUntil() {
        return assignedUntil;
    }

    public Instant getLastSeenAt() {
        return lastSeenAt;
    }
}
