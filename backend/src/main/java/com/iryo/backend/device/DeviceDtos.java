package com.iryo.backend.device;

import java.time.Duration;
import java.time.Instant;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public final class DeviceDtos {

    private DeviceDtos() {
    }

    public record AssignRequest(
            @NotBlank(message = "Enter the Device ID printed on your device.")
            @Pattern(regexp = DeviceIds.PATTERN, message = "Device IDs use letters, numbers, hyphens and underscores only.")
            String deviceId) {
    }

    /** remainingSeconds is measured when the server answers, so the app does not depend on the phone's clock. */
    public record DeviceResponse(String deviceId, String status, Instant assignedAt, Instant assignedUntil,
            long remainingSeconds, Instant lastSeenAt) {

        public static DeviceResponse from(Device device, Instant now) {
            long remaining = Math.max(0, Duration.between(now, device.getAssignedUntil()).toSeconds());
            return new DeviceResponse(device.getDeviceId(), device.getDeviceStatus(), device.getAssignedAt(),
                    device.getAssignedUntil(), remaining, device.getLastSeenAt());
        }
    }

    public record ProvisionRequest(
            @NotBlank(message = "Enter a device ID.")
            @Pattern(regexp = DeviceIds.PATTERN, message = "Device IDs use letters, numbers, hyphens and underscores only.")
            String deviceId) {
    }

    /** ingestKey is returned once. Store it on the device or in Node-RED straight away. */
    public record ProvisionResponse(String deviceId, String ingestKey) {
    }
}
