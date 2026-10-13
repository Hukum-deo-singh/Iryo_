package com.iryo.backend.measurement;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.iryo.backend.measurement.MeasurementDtos.IngestRequest;
import com.iryo.backend.measurement.MeasurementDtos.IngestResponse;

import jakarta.validation.Valid;

/** Called by Node-RED with the device's own key in X-Device-Key. */
@RestController
@RequestMapping("/api/ingest")
public class IngestController {

    private final MeasurementService service;

    public IngestController(MeasurementService service) {
        this.service = service;
    }

    @PostMapping("/measurements")
    public ResponseEntity<IngestResponse> ingest(
            @RequestHeader(value = "X-Device-Key", required = false) String deviceKey,
            @Valid @RequestBody IngestRequest request) {
        boolean stored = service.ingest(deviceKey, request);
        return stored
                ? ResponseEntity.status(HttpStatus.CREATED).body(new IngestResponse("accepted"))
                : ResponseEntity.ok(new IngestResponse("duplicate"));
    }
}
