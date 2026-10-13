package com.iryo.backend.device;

import java.time.Clock;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Every few seconds, returns devices whose session has ended to their free state. */
@Component
public class DeviceSessionReleaser {

    private final DeviceRepository devices;
    private final Clock clock;

    public DeviceSessionReleaser(DeviceRepository devices, Clock clock) {
        this.devices = devices;
        this.clock = clock;
    }

    @Scheduled(fixedDelay = 15_000, initialDelay = 15_000)
    public void releaseExpiredSessions() {
        devices.releaseExpired(clock.instant());
    }
}
