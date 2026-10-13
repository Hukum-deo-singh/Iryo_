package com.iryo.backend.device;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.iryo.backend.common.ApiException;
import com.iryo.backend.common.AttemptLimiter;
import com.iryo.backend.config.IryoProperties;
import com.iryo.backend.device.DeviceDtos.ProvisionResponse;

@Service
public class DeviceService {

    private final DeviceRepository devices;
    private final Clock clock;
    private final Duration sessionLength;
    /** Slows down anyone guessing Device IDs. */
    private final AttemptLimiter assignLimiter;

    public DeviceService(DeviceRepository devices, Clock clock, IryoProperties properties) {
        this.devices = devices;
        this.clock = clock;
        long minutes = properties.assignment().minutes();
        if (minutes < 1) {
            throw new IllegalStateException("DEVICE_ASSIGNMENT_MINUTES must be at least 1.");
        }
        this.sessionLength = Duration.ofMinutes(minutes);
        this.assignLimiter = new AttemptLimiter(10, Duration.ofHours(1), clock,
                "Too many attempts to connect a device. Try again later.");
    }

    /** The device this user holds right now. Empty once the session has ended. */
    public Optional<Device> findMine(UUID userPk) {
        return devices.findByAssignedUserIdAndAssignedUntilAfter(userPk, clock.instant());
    }

    @Transactional
    public Device assign(UUID userPk, String rawDeviceId) {
        String key = userPk.toString();
        assignLimiter.assertAllowed(key);
        try {
            return doAssign(userPk, DeviceIds.normalize(rawDeviceId));
        } catch (ApiException ex) {
            assignLimiter.recordFailure(key);
            throw ex;
        }
    }

    private Device doAssign(UUID userPk, String deviceId) {
        Instant now = clock.instant();
        // Free anything whose session has run out, so old sessions never block a new one.
        devices.releaseExpired(now);

        Device device = devices.findForUpdate(deviceId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                "DEVICE_NOT_FOUND", "We couldn't find a device with that ID. Check the ID printed on your device."));

        if (!device.isActive()) {
            throw new ApiException(HttpStatus.CONFLICT, "DEVICE_UNAVAILABLE", "This device isn't available to connect.");
        }
        if (device.isHeldAt(now)) {
            if (device.getAssignedUserId().equals(userPk)) {
                return device;
            }
            throw new ApiException(HttpStatus.CONFLICT, "DEVICE_IN_USE",
                    "This device is being used by someone else right now. Try again in a couple of minutes.");
        }
        if (devices.findByAssignedUserIdAndAssignedUntilAfter(userPk, now).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "USER_HAS_DEVICE",
                    "You're already connected to a device. Wait for that session to finish.");
        }
        device.assignTo(userPk, now, now.plus(sessionLength));
        try {
            return devices.saveAndFlush(device);
        } catch (DataIntegrityViolationException ex) {
            throw new ApiException(HttpStatus.CONFLICT, "USER_HAS_DEVICE",
                    "You're already connected to a device. Wait for that session to finish.");
        }
    }

    public Instant now() {
        return clock.instant();
    }

    public ProvisionResponse provision(String rawDeviceId) {
        String deviceId = DeviceIds.normalize(rawDeviceId);
        if (devices.findByDeviceId(deviceId).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "DEVICE_EXISTS", "A device with this ID already exists.");
        }
        String rawKey = DeviceKeys.generate();
        Device device = Device.provision(UUID.randomUUID(), deviceId, DeviceKeys.hash(rawKey), clock.instant());
        try {
            devices.saveAndFlush(device);
        } catch (DataIntegrityViolationException ex) {
            throw new ApiException(HttpStatus.CONFLICT, "DEVICE_EXISTS", "A device with this ID already exists.");
        }
        return new ProvisionResponse(deviceId, rawKey);
    }
}
