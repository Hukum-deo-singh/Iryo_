package com.iryo.backend.device;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.LockModeType;

public interface DeviceRepository extends JpaRepository<Device, UUID> {

    Optional<Device> findByDeviceId(String deviceId);

    /** The device this user holds right now, if the session has not expired. */
    Optional<Device> findByAssignedUserIdAndAssignedUntilAfter(UUID userId, Instant now);

    /** Row lock, so two people cannot claim the same device at the same moment. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from Device d where d.deviceId = :deviceId")
    Optional<Device> findForUpdate(@Param("deviceId") String deviceId);

    /** Puts every device whose session has run out back to its free state. */
    @Transactional
    @Modifying
    @Query("update Device d set d.assignedUserId = null, d.assignedAt = null, d.assignedUntil = null "
            + "where d.assignedUntil is not null and d.assignedUntil <= :now")
    int releaseExpired(@Param("now") Instant now);

    @Transactional
    @Modifying
    @Query("update Device d set d.lastSeenAt = :seenAt where d.id = :id and (d.lastSeenAt is null or d.lastSeenAt < :seenAt)")
    int touchLastSeen(@Param("id") UUID id, @Param("seenAt") Instant seenAt);
}
