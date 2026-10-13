package com.iryo.backend.user;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface UserRepository extends JpaRepository<AppUser, UUID> {

    Optional<AppUser> findByEmail(String email);

    boolean existsByEmail(String email);

    boolean existsByUserId(String userId);

    /** Invalidates every token issued before now. */
    @Transactional
    @Modifying
    @Query("update AppUser u set u.tokenVersion = u.tokenVersion + 1, u.updatedAt = :now where u.id = :id")
    int bumpTokenVersion(@Param("id") UUID id, @Param("now") Instant now);
}
