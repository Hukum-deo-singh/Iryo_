package com.iryo.backend.config;

import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties(prefix = "iryo")
public record IryoProperties(
        Jwt jwt,
        @DefaultValue Admin admin,
        @DefaultValue Cors cors,
        @DefaultValue Thresholds thresholds,
        @DefaultValue Assignment assignment) {

    public record Jwt(String secret, @DefaultValue("720") long expiryMinutes) {
    }

    public record Assignment(@DefaultValue("2") long minutes) {
    }

    public record Admin(@DefaultValue("") String apiKey) {
    }

    public record Cors(@DefaultValue List<String> allowedOrigins) {
    }

    /** Provisional rules. Must be reviewed by a qualified clinician before release. */
    public record Thresholds(
            @DefaultValue("95") int spo2Normal,
            @DefaultValue("90") int spo2Urgent,
            @DefaultValue("35.0") double tempLowUrgent,
            @DefaultValue("36.0") double tempLowAttention,
            @DefaultValue("37.5") double tempHighAttention,
            @DefaultValue("38.0") double tempHighUrgent) {
    }
}
