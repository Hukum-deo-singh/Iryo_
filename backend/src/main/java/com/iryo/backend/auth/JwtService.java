package com.iryo.backend.auth;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;

import com.iryo.backend.user.AppUser;
import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.MACVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;

/** Issues and checks HS256 access tokens. */
public class JwtService {

    private static final String TOKEN_VERSION_CLAIM = "tv";

    public record IssuedToken(String token, Instant expiresAt) {
    }

    public record ParsedToken(UUID userId, int tokenVersion) {
    }

    private final byte[] secret;
    private final Duration lifetime;
    private final Clock clock;

    public JwtService(String secret, long expiryMinutes, Clock clock) {
        byte[] bytes = secret == null ? new byte[0] : secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            throw new IllegalStateException("JWT_SECRET must be at least 32 characters long.");
        }
        if (expiryMinutes < 1) {
            throw new IllegalStateException("JWT_EXPIRY_MINUTES must be at least 1.");
        }
        this.secret = bytes;
        this.lifetime = Duration.ofMinutes(expiryMinutes);
        this.clock = clock;
    }

    public IssuedToken issue(AppUser user) {
        Instant now = clock.instant();
        Instant expiresAt = now.plus(lifetime);
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .subject(user.getId().toString())
                .claim(TOKEN_VERSION_CLAIM, user.getTokenVersion())
                .issueTime(Date.from(now))
                .expirationTime(Date.from(expiresAt))
                .build();
        try {
            SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims);
            jwt.sign(new MACSigner(secret));
            return new IssuedToken(jwt.serialize(), expiresAt);
        } catch (JOSEException ex) {
            throw new IllegalStateException("Could not sign access token.", ex);
        }
    }

    /** Returns empty for anything that is not a valid, unexpired token signed by this server. */
    public Optional<ParsedToken> parse(String token) {
        try {
            SignedJWT jwt = SignedJWT.parse(token);
            if (!JWSAlgorithm.HS256.equals(jwt.getHeader().getAlgorithm())) {
                return Optional.empty();
            }
            if (!jwt.verify(new MACVerifier(secret))) {
                return Optional.empty();
            }
            JWTClaimsSet claims = jwt.getJWTClaimsSet();
            Date expiry = claims.getExpirationTime();
            if (expiry == null || !expiry.toInstant().isAfter(clock.instant())) {
                return Optional.empty();
            }
            Object version = claims.getClaim(TOKEN_VERSION_CLAIM);
            if (claims.getSubject() == null || !(version instanceof Number number)) {
                return Optional.empty();
            }
            return Optional.of(new ParsedToken(UUID.fromString(claims.getSubject()), number.intValue()));
        } catch (Exception ex) {
            return Optional.empty();
        }
    }
}
