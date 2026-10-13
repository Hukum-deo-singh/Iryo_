package com.iryo.backend.user;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "app_users")
public class AppUser {

    public static final String STATUS_ACTIVE = "ACTIVE";

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private String userId;

    @Column(name = "display_name", nullable = false)
    private String displayName;

    @Column(name = "email", nullable = false)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "account_status", nullable = false)
    private String accountStatus;

    @Column(name = "token_version", nullable = false)
    private int tokenVersion;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected AppUser() {
    }

    public static AppUser create(UUID id, String userId, String displayName, String email, String passwordHash,
            Instant now) {
        AppUser user = new AppUser();
        user.id = id;
        user.userId = userId;
        user.displayName = displayName;
        user.email = email;
        user.passwordHash = passwordHash;
        user.accountStatus = STATUS_ACTIVE;
        user.tokenVersion = 0;
        user.createdAt = now;
        user.updatedAt = now;
        return user;
    }

    public boolean isActive() {
        return STATUS_ACTIVE.equals(accountStatus);
    }

    public UUID getId() {
        return id;
    }

    public String getUserId() {
        return userId;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public int getTokenVersion() {
        return tokenVersion;
    }
}
