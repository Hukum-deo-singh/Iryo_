package com.iryo.backend.measurement;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.iryo.backend.auth.AuthUser;
import com.iryo.backend.measurement.MeasurementDtos.HistoryResponse;
import com.iryo.backend.measurement.MeasurementDtos.MeasurementResponse;

@RestController
@RequestMapping("/api/measurements")
public class MeasurementController {

    private final MeasurementService service;

    public MeasurementController(MeasurementService service) {
        this.service = service;
    }

    @GetMapping("/latest")
    public MeasurementResponse latest(@AuthenticationPrincipal AuthUser principal) {
        return service.latest(principal.id());
    }

    @GetMapping("/history")
    public HistoryResponse history(@AuthenticationPrincipal AuthUser principal,
            @RequestParam(name = "range", defaultValue = "7d") String range) {
        return service.history(principal.id(), range);
    }
}
