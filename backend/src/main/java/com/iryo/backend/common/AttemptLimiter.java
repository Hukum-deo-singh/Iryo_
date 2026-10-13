package com.iryo.backend.common;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.http.HttpStatus;

/**
 * Blocks a key after too many failures inside a time window.
 * In memory, so it protects a single instance. Use a shared store if you run several.
 */
public class AttemptLimiter {

    private static final int MAX_TRACKED_KEYS = 10_000;

    private record State(int failures, Instant windowStart) {
    }

    private final int maxFailures;
    private final Duration window;
    private final Clock clock;
    private final String lockedMessage;
    private final ConcurrentHashMap<String, State> states = new ConcurrentHashMap<>();

    public AttemptLimiter(int maxFailures, Duration window, Clock clock, String lockedMessage) {
        this.maxFailures = maxFailures;
        this.window = window;
        this.clock = clock;
        this.lockedMessage = lockedMessage;
    }

    public void assertAllowed(String key) {
        State state = states.get(key);
        if (state == null) {
            return;
        }
        if (expired(state)) {
            states.remove(key, state);
            return;
        }
        if (state.failures() >= maxFailures) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "TOO_MANY_ATTEMPTS", lockedMessage);
        }
    }

    public void recordFailure(String key) {
        Instant now = clock.instant();
        if (states.size() > MAX_TRACKED_KEYS) {
            states.entrySet().removeIf(entry -> expired(entry.getValue()));
        }
        states.compute(key, (k, state) ->
                state == null || expired(state) ? new State(1, now) : new State(state.failures() + 1, state.windowStart()));
    }

    public void clear(String key) {
        states.remove(key);
    }

    private boolean expired(State state) {
        return !clock.instant().isBefore(state.windowStart().plus(window));
    }
}
