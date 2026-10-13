package com.iryo.backend.device;

import java.util.Locale;

public final class DeviceIds {

    /** Same rule as the mobile app. */
    public static final String PATTERN = "^[A-Za-z0-9][A-Za-z0-9_-]{2,79}$";

    private DeviceIds() {
    }

    /** Device IDs are stored upper-case so matching ignores case. */
    public static String normalize(String raw) {
        return raw.trim().toUpperCase(Locale.ROOT);
    }
}
