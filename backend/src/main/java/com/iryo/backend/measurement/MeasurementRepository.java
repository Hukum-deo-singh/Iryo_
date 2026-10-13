package com.iryo.backend.measurement;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MeasurementRepository extends JpaRepository<HealthMeasurement, UUID> {

    boolean existsByDevicePkAndSourceMessageId(UUID devicePk, String sourceMessageId);

    Optional<HealthMeasurement> findFirstByUserPkOrderByMeasuredAtDescReceivedAtDesc(UUID userPk);
}
