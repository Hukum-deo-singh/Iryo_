package com.iryo.backend.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashSet;
import java.util.Set;

import org.junit.jupiter.api.Test;

class UserIdGeneratorTest {

    private final UserIdGenerator generator = new UserIdGenerator();

    @Test
    void usesTheExpectedFormat() {
        for (int i = 0; i < 200; i++) {
            assertTrue(generator.next(id -> false).matches("^IRY-[0-9]{8}$"));
        }
    }

    @Test
    void skipsIdsAlreadyInUse() {
        Set<String> rejected = new HashSet<>();
        String id = generator.next(candidate -> rejected.size() < 3 && rejected.add(candidate));
        assertEquals(3, rejected.size());
        assertTrue(!rejected.contains(id));
    }

    @Test
    void givesUpWhenEveryIdIsTaken() {
        assertThrows(IllegalStateException.class, () -> generator.next(id -> true));
    }
}
