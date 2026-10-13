package com.iryo.backend.device;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class DeviceKeysTest {

    @Test
    void generatedKeysAreUniqueAndLong() {
        String a = DeviceKeys.generate();
        String b = DeviceKeys.generate();
        assertNotEquals(a, b);
        assertTrue(a.length() >= 43);
    }

    @Test
    void hashIsStableHexOfFixedLength() {
        assertEquals(DeviceKeys.hash("abc"), DeviceKeys.hash("abc"));
        assertEquals(64, DeviceKeys.hash("abc").length());
    }

    @Test
    void matchesOnlyTheRightKey() {
        String key = DeviceKeys.generate();
        String stored = DeviceKeys.hash(key);
        assertTrue(DeviceKeys.matches(key, stored));
        assertFalse(DeviceKeys.matches(key + "x", stored));
        assertFalse(DeviceKeys.matches(null, stored));
        assertFalse(DeviceKeys.matches(key, null));
    }

    @Test
    void deviceIdsAreMatchedIgnoringCase() {
        assertEquals("IRYO-001A", DeviceIds.normalize("  iryo-001a "));
        assertTrue("IRYO-001A".matches(DeviceIds.PATTERN));
        assertFalse("IR".matches(DeviceIds.PATTERN));
        assertFalse("IRYO 001".matches(DeviceIds.PATTERN));
    }
}
