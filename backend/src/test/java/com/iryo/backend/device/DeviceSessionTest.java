package com.iryo.backend.device;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class DeviceSessionTest {

    private final Instant start = Instant.parse("2026-10-11T10:00:00Z");

    private Device device() {
        return Device.provision(UUID.randomUUID(), "TEST-0001", "hash", start);
    }

    @Test
    void freeDeviceIsNotHeld() {
        assertFalse(device().isHeldAt(start));
    }

    @Test
    void deviceIsHeldDuringTheSession() {
        Device device = device();
        device.assignTo(UUID.randomUUID(), start, start.plus(Duration.ofMinutes(2)));
        assertTrue(device.isHeldAt(start.plusSeconds(1)));
        assertTrue(device.isHeldAt(start.plusSeconds(119)));
    }

    @Test
    void deviceIsFreeOnceTheSessionEnds() {
        Device device = device();
        device.assignTo(UUID.randomUUID(), start, start.plus(Duration.ofMinutes(2)));
        assertFalse(device.isHeldAt(start.plus(Duration.ofMinutes(2))));
        assertFalse(device.isHeldAt(start.plus(Duration.ofMinutes(5))));
    }
}
