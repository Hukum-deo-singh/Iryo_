package com.iryo.backend.measurement;

import java.time.Instant;
import java.util.List;

import com.iryo.backend.measurement.DerivedDataService.DerivedIndicator;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class MeasurementDtos {

    private MeasurementDtos() {
    }

    /** Sent by Node-RED. Missing or implausible sensor values are rejected, never stored as zero. */
    public record IngestRequest(
            @NotBlank(message = "deviceId is required.")
            @Size(max = 80, message = "deviceId is too long.")
            String deviceId,

            Instant measuredAt,

            @NotNull(message = "spo2Percent is required.")
            @DecimalMin(value = "50.0", message = "spo2Percent is outside the plausible range.")
            @DecimalMax(value = "100.0", message = "spo2Percent is outside the plausible range.")
            Double spo2Percent,

            @NotNull(message = "temperatureC is required.")
            @DecimalMin(value = "25.0", message = "temperatureC is outside the plausible range.")
            @DecimalMax(value = "45.0", message = "temperatureC is outside the plausible range.")
            Double temperatureC,

            @DecimalMin(value = "30.0", message = "heartRateBpm is outside the plausible range.")
            @DecimalMax(value = "220.0", message = "heartRateBpm is outside the plausible range.")
            Double heartRateBpm,

            @DecimalMin(value = "50.0", message = "heightCm is outside the plausible range.")
            @DecimalMax(value = "250.0", message = "heightCm is outside the plausible range.")
            Double heightCm,

            @Size(max = 128, message = "messageId is too long.")
            String messageId) {
    }

    public record IngestResponse(String status) {
    }

    /** heartRateBpm and heightCm are null when the device did not measure them. */
    public record MeasurementResponse(Instant measuredAt, Instant receivedAt, double spo2Percent,
            double temperatureC, Double heartRateBpm, Double heightCm, List<DerivedIndicator> derived) {
    }

    public record HistoryPoint(Instant measuredAt, double spo2Percent, double temperatureC) {
    }

    public record HistoryResponse(String range, List<HistoryPoint> points) {
    }
}
