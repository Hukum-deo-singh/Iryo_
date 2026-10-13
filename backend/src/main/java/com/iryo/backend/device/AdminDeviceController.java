package com.iryo.backend.device;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.iryo.backend.common.ApiException;
import com.iryo.backend.config.IryoProperties;
import com.iryo.backend.device.DeviceDtos.ProvisionRequest;
import com.iryo.backend.device.DeviceDtos.ProvisionResponse;

import jakarta.validation.Valid;

/** Registers a manufactured device in the trusted registry. Protected by ADMIN_API_KEY. */
@RestController
@RequestMapping("/api/admin/devices")
public class AdminDeviceController {

    private final DeviceService service;
    private final byte[] adminKey;

    public AdminDeviceController(DeviceService service, IryoProperties properties) {
        this.service = service;
        this.adminKey = properties.admin().apiKey().getBytes(StandardCharsets.UTF_8);
    }

    @PostMapping
    public ResponseEntity<ProvisionResponse> provision(
            @RequestHeader(value = "X-Admin-Key", required = false) String providedKey,
            @Valid @RequestBody ProvisionRequest request) {
        if (adminKey.length == 0) {
            throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "We couldn't find what you asked for.");
        }
        byte[] provided = providedKey == null ? new byte[0] : providedKey.getBytes(StandardCharsets.UTF_8);
        if (!MessageDigest.isEqual(adminKey, provided)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid admin key.");
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(service.provision(request.deviceId()));
    }
}
