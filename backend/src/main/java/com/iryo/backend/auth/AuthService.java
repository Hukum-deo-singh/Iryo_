package com.iryo.backend.auth;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.util.Locale;
import java.util.UUID;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.iryo.backend.auth.AuthDtos.AuthResponse;
import com.iryo.backend.auth.AuthDtos.LoginRequest;
import com.iryo.backend.auth.AuthDtos.SignupRequest;
import com.iryo.backend.auth.AuthDtos.UserResponse;
import com.iryo.backend.common.ApiException;
import com.iryo.backend.common.AttemptLimiter;
import com.iryo.backend.user.AppUser;
import com.iryo.backend.user.UserRepository;

@Service
public class AuthService {

    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final UserIdGenerator idGenerator;
    private final Clock clock;
    private final AttemptLimiter loginLimiter;
    /** Compared against when the email is unknown, so timing does not reveal which emails exist. */
    private final String dummyHash;

    public AuthService(UserRepository users, PasswordEncoder encoder, JwtService jwt, UserIdGenerator idGenerator,
            Clock clock) {
        this.users = users;
        this.encoder = encoder;
        this.jwt = jwt;
        this.idGenerator = idGenerator;
        this.clock = clock;
        this.loginLimiter = new AttemptLimiter(5, Duration.ofMinutes(15), clock,
                "Too many sign-in attempts. Try again in 15 minutes.");
        this.dummyHash = encoder.encode("not-a-real-password-" + UUID.randomUUID());
    }

    public AuthResponse signup(SignupRequest request) {
        if (request.password().getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Password is too long.");
        }
        String email = normalizeEmail(request.email());
        if (users.existsByEmail(email)) {
            throw emailTaken();
        }
        AppUser user = AppUser.create(
                UUID.randomUUID(),
                idGenerator.next(users::existsByUserId),
                request.displayName().trim(),
                email,
                encoder.encode(request.password()),
                clock.instant());
        try {
            users.saveAndFlush(user);
        } catch (DataIntegrityViolationException ex) {
            throw emailTaken();
        }
        return respond(user);
    }

    public AuthResponse login(LoginRequest request) {
        String email = normalizeEmail(request.email());
        loginLimiter.assertAllowed(email);

        AppUser user = users.findByEmail(email).orElse(null);
        boolean passwordOk = encoder.matches(request.password(), user != null ? user.getPasswordHash() : dummyHash);
        if (user == null || !passwordOk || !user.isActive()) {
            loginLimiter.recordFailure(email);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Email or password is incorrect.");
        }
        loginLimiter.clear(email);
        return respond(user);
    }

    /** Signs the user out everywhere by invalidating every token issued so far. */
    public void logout(UUID userPk) {
        users.bumpTokenVersion(userPk, clock.instant());
    }

    private AuthResponse respond(AppUser user) {
        JwtService.IssuedToken issued = jwt.issue(user);
        return new AuthResponse(issued.token(), issued.expiresAt(),
                new UserResponse(user.getUserId(), user.getDisplayName(), user.getEmail()));
    }

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private static ApiException emailTaken() {
        return new ApiException(HttpStatus.CONFLICT, "EMAIL_TAKEN", "An account with this email already exists.");
    }
}
