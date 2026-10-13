package com.iryo.backend.measurement;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Locale;

import com.iryo.backend.config.IryoProperties.Thresholds;

/**
 * Turns the two stored readings into plain-language indicators.
 * Calculated on read from the raw values, so changing a rule never leaves old rows inconsistent.
 * Thresholds are PROVISIONAL and need clinical review. This is not a diagnosis.
 */
public class DerivedDataService {

    public record DerivedIndicator(String key, String label, String value, String level, String note) {
    }

    private final Thresholds t;

    public DerivedDataService(Thresholds thresholds) {
        this.t = thresholds;
    }

    public List<DerivedIndicator> derive(BigDecimal spo2Percent, BigDecimal temperatureC) {
        return List.of(spo2(spo2Percent), temperature(temperatureC));
    }

    /** Oximeters report whole numbers, so the whole number is what gets classified and shown. */
    private DerivedIndicator spo2(BigDecimal raw) {
        int spo2 = raw.setScale(0, RoundingMode.HALF_UP).intValue();
        if (spo2 >= t.spo2Normal()) {
            return new DerivedIndicator("spo2Status", "Blood oxygen", spo2 + "% — within the usual range", "normal", null);
        }
        if (spo2 >= t.spo2Urgent()) {
            return new DerivedIndicator("spo2Status", "Blood oxygen", spo2 + "% — a little below the usual range",
                    "attention",
                    "Cold hands, nail polish or movement can affect a reading. Measure again, and speak to a healthcare professional if it stays low.");
        }
        return new DerivedIndicator("spo2Status", "Blood oxygen", spo2 + "% — low", "urgent",
                "If you feel short of breath or unwell, get medical help right away.");
    }

    private DerivedIndicator temperature(BigDecimal raw) {
        BigDecimal rounded = raw.setScale(1, RoundingMode.HALF_UP);
        double temp = rounded.doubleValue();
        String shown = String.format(Locale.ROOT, "%.1f °C", temp);
        if (temp >= t.tempHighUrgent()) {
            return new DerivedIndicator("temperatureStatus", "Body temperature", shown + " — high", "urgent",
                    "This is in the fever range. Consider medical advice, especially if you have other symptoms.");
        }
        if (temp < t.tempLowUrgent()) {
            return new DerivedIndicator("temperatureStatus", "Body temperature", shown + " — low", "urgent",
                    "Check that the sensor is placed correctly. If you feel unwell, get medical help.");
        }
        if (temp >= t.tempHighAttention()) {
            return new DerivedIndicator("temperatureStatus", "Body temperature", shown + " — a little raised",
                    "attention", "Rest and measure again in a few minutes. Speak to a healthcare professional if it continues.");
        }
        if (temp < t.tempLowAttention()) {
            return new DerivedIndicator("temperatureStatus", "Body temperature", shown + " — a little low",
                    "attention", "Check the sensor placement and measure again.");
        }
        return new DerivedIndicator("temperatureStatus", "Body temperature", shown + " — within the usual range",
                "normal", null);
    }
}
