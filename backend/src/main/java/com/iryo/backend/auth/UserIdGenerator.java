package com.iryo.backend.auth;

import java.security.SecureRandom;
import java.util.function.Predicate;

import org.springframework.stereotype.Component;

/** Produces public user IDs such as IRY-48213907. The internal primary key is a separate UUID. */
@Component
public class UserIdGenerator {

    private static final int MAX_TRIES = 20;

    private final SecureRandom random = new SecureRandom();

    public String next(Predicate<String> alreadyUsed) {
        for (int i = 0; i < MAX_TRIES; i++) {
            String candidate = "IRY-" + (10_000_000 + random.nextInt(90_000_000));
            if (!alreadyUsed.test(candidate)) {
                return candidate;
            }
        }
        throw new IllegalStateException("Could not generate a unique user ID.");
    }
}
