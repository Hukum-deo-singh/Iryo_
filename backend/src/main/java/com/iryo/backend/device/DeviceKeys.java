package com.iryo.backend.device;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

/**
 * Per-device ingest secrets. Keys are random 256-bit values, so a plain SHA-256 hash is enough to store.
 * The raw key is shown once at provisioning and never stored.
 */
public final class DeviceKeys {

    private static final SecureRandom RANDOM = new SecureRandom();

    private DeviceKeys() {
    }

    public static String generate() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public static String hash(String rawKey) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(rawKey.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is not available.", ex);
        }
    }

    /** Constant-time comparison. */
    public static boolean matches(String rawKey, String storedHash) {
        if (rawKey == null || storedHash == null) {
            return false;
        }
        return MessageDigest.isEqual(
                hash(rawKey).getBytes(StandardCharsets.UTF_8), storedHash.getBytes(StandardCharsets.UTF_8));
    }
}
