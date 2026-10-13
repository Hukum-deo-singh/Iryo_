package com.iryo.backend.device;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.iryo.backend.auth.AuthUser;
import com.iryo.backend.common.ApiException;
import com.iryo.backend.device.DeviceDtos.AssignRequest;
import com.iryo.backend.device.DeviceDtos.DeviceResponse;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/devices")
public class DeviceController {

    private final DeviceService service;

    public DeviceController(DeviceService service) {
        this.service = service;
    }

    @PostMapping("/assign")
    public DeviceResponse assign(@AuthenticationPrincipal AuthUser principal, @Valid @RequestBody AssignRequest request) {
        Device device = service.assign(principal.id(), request.deviceId());
        return DeviceResponse.from(device, service.now());
    }

    /** 404 NO_DEVICE once the session has ended. */
    @GetMapping("/me")
    public DeviceResponse mine(@AuthenticationPrincipal AuthUser principal) {
        return service.findMine(principal.id())
                .map(device -> DeviceResponse.from(device, service.now()))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NO_DEVICE", "No device is connected right now."));
    }
}
