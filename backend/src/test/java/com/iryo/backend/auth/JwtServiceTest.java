package com.iryo.backend.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.iryo.backend.TestClock;
import com.iryo.backend.user.AppUser;

class JwtServiceTest {

    private static final String SECRET = "0123456789abcdef0123456789abcdef";
    private final Instant start = Instant.parse("2026-10-10T08:00:00Z");

    private AppUser user() {
        return AppUser.create(UUID.randomUUID(), "IRY-12345678", "Asha", "asha@example.com", "hash", start);
    }

    @Test
    void issuedTokenIsAccepted() {
        JwtService service = new JwtService(SECRET, 60, new TestClock(start));
        AppUser user = user();
        JwtService.IssuedToken issued = service.issue(user);

        Optional<JwtService.ParsedToken> parsed = service.parse(issued.token());
        assertTrue(parsed.isPresent());
        assertEquals(user.getId(), parsed.get().userId());
        assertEquals(0, parsed.get().tokenVersion());
        assertEquals(start.plus(Duration.ofMinutes(60)), issued.expiresAt());
    }

    @Test
    void expiredTokenIsRejected() {
        TestClock clock = new TestClock(start);
        JwtService service = new JwtService(SECRET, 60, clock);
        String token = service.issue(user()).token();
        clock.advance(Duration.ofMinutes(61));
        assertTrue(service.parse(token).isEmpty());
    }

    @Test
    void tokenSignedWithAnotherSecretIsRejected() {
        JwtService issuer = new JwtService("ffffffffffffffffffffffffffffffff", 60, new TestClock(start));
        JwtService checker = new JwtService(SECRET, 60, new TestClock(start));
        assertTrue(checker.parse(issuer.issue(user()).token()).isEmpty());
    }

    @Test
    void garbageIsRejected() {
        JwtService service = new JwtService(SECRET, 60, new TestClock(start));
        assertTrue(service.parse("not-a-token").isEmpty());
        assertTrue(service.parse("").isEmpty());
    }

    @Test
    void shortSecretFailsFast() {
        assertThrows(IllegalStateException.class, () -> new JwtService("too-short", 60, new TestClock(start)));
    }
}
