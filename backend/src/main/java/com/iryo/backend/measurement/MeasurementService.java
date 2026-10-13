package com.iryo.backend.measurement;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import com.iryo.backend.common.ApiException;
import com.iryo.backend.device.Device;
import com.iryo.backend.device.DeviceIds;
import com.iryo.backend.device.DeviceKeys;
import com.iryo.backend.device.DeviceRepository;
import com.iryo.backend.measurement.MeasurementDtos.HistoryPoint;
import com.iryo.backend.measurement.MeasurementDtos.HistoryResponse;
import com.iryo.backend.measurement.MeasurementDtos.IngestRequest;
import com.iryo.backend.measurement.MeasurementDtos.MeasurementResponse;

@Service
public class MeasurementService {

    private static final Duration MAX_FUTURE_SKEW = Duration.ofMinutes(5);
    private static final Duration MAX_AGE = Duration.ofDays(30);
    private static final String DUMMY_HASH = DeviceKeys.hash("no-such-device");

    private static final String HISTORY_SQL = """
            SELECT date_bin(make_interval(secs => ?), measured_at, TIMESTAMPTZ '2000-01-01 00:00:00+00') AS bucket,
                   AVG(spo2_percent) AS spo2,
                   AVG(temperature_c) AS temperature
            FROM health_measurements
            WHERE user_pk = ? AND measured_at >= ?
            GROUP BY bucket
            ORDER BY bucket
            """;

    private final MeasurementRepository measurements;
    private final DeviceRepository devices;
    private final DerivedDataService derivedData;
    private final JdbcTemplate jdbc;
    private final Clock clock;

    public MeasurementService(MeasurementRepository measurements, DeviceRepository devices,
            DerivedDataService derivedData, JdbcTemplate jdbc, Clock clock) {
        this.measurements = measurements;
        this.devices = devices;
        this.derivedData = derivedData;
        this.jdbc = jdbc;
        this.clock = clock;
    }

    /** Returns true when stored, false when it was a repeat of an earlier message. */
    public boolean ingest(String deviceKey, IngestRequest request) {
        Device device = devices.findByDeviceId(DeviceIds.normalize(request.deviceId())).orElse(null);
        boolean keyOk = DeviceKeys.matches(deviceKey, device != null ? device.getIngestKeyHash() : DUMMY_HASH);
        if (device == null || !keyOk) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_DEVICE_CREDENTIALS", "Invalid device credentials.");
        }
        if (!device.isActive()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "DEVICE_DISABLED", "This device is disabled.");
        }

        Instant now = clock.instant();
        Instant measuredAt = request.measuredAt() != null ? request.measuredAt() : now;
        if (measuredAt.isAfter(now.plus(MAX_FUTURE_SKEW))) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_TIMESTAMP", "measuredAt is in the future.");
        }
        if (measuredAt.isBefore(now.minus(MAX_AGE))) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_TIMESTAMP", "measuredAt is too old.");
        }

        String messageId = request.messageId() == null || request.messageId().isBlank() ? null : request.messageId().trim();
        if (messageId != null && measurements.existsByDevicePkAndSourceMessageId(device.getId(), messageId)) {
            return false;
        }

        // The reading belongs to whoever holds the device right now. After the session ends, nobody does.
        UUID owner = device.isHeldAt(now) ? device.getAssignedUserId() : null;
        HealthMeasurement measurement = HealthMeasurement.create(device.getId(), owner, measuredAt,
                decimal(request.spo2Percent()), decimal(request.temperatureC()),
                request.heartRateBpm() == null ? null : decimal(request.heartRateBpm()),
                request.heightCm() == null ? null : decimal(request.heightCm()).setScale(1, RoundingMode.HALF_UP),
                messageId, now);
        try {
            measurements.saveAndFlush(measurement);
        } catch (DataIntegrityViolationException ex) {
            if (messageId != null) {
                return false; // Two copies of the same message arrived together.
            }
            throw ex;
        }
        devices.touchLastSeen(device.getId(), now);
        return true;
    }

    public MeasurementResponse latest(UUID userPk) {
        HealthMeasurement m = measurements.findFirstByUserPkOrderByMeasuredAtDescReceivedAtDesc(userPk)
                .orElseThrow(MeasurementService::noMeasurements);
        return new MeasurementResponse(m.getMeasuredAt(), m.getReceivedAt(), m.getSpo2Percent().doubleValue(),
                m.getTemperatureC().doubleValue(),
                m.getHeartRateBpm() == null ? null : m.getHeartRateBpm().doubleValue(),
                m.getHeightCm() == null ? null : m.getHeightCm().doubleValue(),
                derivedData.derive(m.getSpo2Percent(), m.getTemperatureC()));
    }

    /** Averages into hourly (7 days) or 4-hourly (30 days) buckets so the chart stays small. */
    public HistoryResponse history(UUID userPk, String range) {
        long days;
        double bucketSeconds;
        switch (range) {
            case "7d" -> {
                days = 7;
                bucketSeconds = 3600;
            }
            case "30d" -> {
                days = 30;
                bucketSeconds = 4 * 3600;
            }
            default -> throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_RANGE", "Range must be 7d or 30d.");
        }
        OffsetDateTime since = OffsetDateTime.ofInstant(clock.instant().minus(Duration.ofDays(days)), ZoneOffset.UTC);

        List<HistoryPoint> points = jdbc.query(HISTORY_SQL, (rs, row) -> {
            Timestamp bucket = rs.getTimestamp("bucket");
            return new HistoryPoint(bucket.toInstant(), round2(rs.getDouble("spo2")), round2(rs.getDouble("temperature")));
        }, bucketSeconds, userPk, since);
        return new HistoryResponse(range, points);
    }

    private static BigDecimal decimal(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP);
    }

    private static double round2(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }

    private static ApiException noMeasurements() {
        return new ApiException(HttpStatus.NOT_FOUND, "NO_MEASUREMENTS", "No measurements yet.");
    }
}
