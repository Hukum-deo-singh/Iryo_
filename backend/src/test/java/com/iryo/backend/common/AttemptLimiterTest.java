package com.iryo.backend.common;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Duration;
import java.time.Instant;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import com.iryo.backend.TestClock;

class AttemptLimiterTest {

    private final TestClock clock = new TestClock(Instant.parse("2026-10-10T08:00:00Z"));
    private final AttemptLimiter limiter = new AttemptLimiter(3, Duration.ofMinutes(15), clock, "Locked.");

    @Test
    void blocksAfterTooManyFailures() {
        for (int i = 0; i < 3; i++) {
            assertDoesNotThrow(() -> limiter.assertAllowed("a"));
            limiter.recordFailure("a");
        }
        ApiException ex = assertThrows(ApiException.class, () -> limiter.assertAllowed("a"));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, ex.getStatus());
    }

    @Test
    void otherKeysAreNotAffected() {
        for (int i = 0; i < 3; i++) {
            limiter.recordFailure("a");
        }
        assertDoesNotThrow(() -> limiter.assertAllowed("b"));
    }

    @Test
    void unblocksAfterTheWindow() {
        for (int i = 0; i < 3; i++) {
            limiter.recordFailure("a");
        }
        clock.advance(Duration.ofMinutes(16));
        assertDoesNotThrow(() -> limiter.assertAllowed("a"));
    }

    @Test
    void successClearsTheCount() {
        for (int i = 0; i < 3; i++) {
            limiter.recordFailure("a");
        }
        limiter.clear("a");
        assertDoesNotThrow(() -> limiter.assertAllowed("a"));
    }
}
