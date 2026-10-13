package com.iryo.backend.measurement;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.math.BigDecimal;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.iryo.backend.config.IryoProperties.Thresholds;
import com.iryo.backend.measurement.DerivedDataService.DerivedIndicator;

class DerivedDataServiceTest {

    private final DerivedDataService service = new DerivedDataService(new Thresholds(95, 90, 35.0, 36.0, 37.5, 38.0));

    private DerivedIndicator spo2(String value) {
        return service.derive(new BigDecimal(value), new BigDecimal("36.8")).get(0);
    }

    private DerivedIndicator temp(String value) {
        return service.derive(new BigDecimal("98"), new BigDecimal(value)).get(1);
    }

    @Test
    void returnsOneIndicatorPerSensor() {
        List<DerivedIndicator> result = service.derive(new BigDecimal("98"), new BigDecimal("36.8"));
        assertEquals(2, result.size());
        assertEquals("spo2Status", result.get(0).key());
        assertEquals("temperatureStatus", result.get(1).key());
    }

    @Test
    void spo2Levels() {
        assertEquals("normal", spo2("98").level());
        assertNull(spo2("98").note());
        assertEquals("normal", spo2("95").level());
        assertEquals("attention", spo2("94").level());
        assertEquals("attention", spo2("90").level());
        assertEquals("urgent", spo2("89").level());
    }

    @Test
    void spo2IsClassifiedOnTheWholeNumberThatIsShown() {
        assertEquals("normal", spo2("94.6").level());
        assertEquals("95% — within the usual range", spo2("94.6").value());
        assertEquals("attention", spo2("94.4").level());
    }

    @Test
    void temperatureLevels() {
        assertEquals("normal", temp("36.0").level());
        assertEquals("normal", temp("37.4").level());
        assertEquals("attention", temp("37.5").level());
        assertEquals("attention", temp("37.9").level());
        assertEquals("urgent", temp("38.0").level());
        assertEquals("attention", temp("35.9").level());
        assertEquals("attention", temp("35.0").level());
        assertEquals("urgent", temp("34.9").level());
    }

    @Test
    void temperatureIsShownWithOneDecimal() {
        assertEquals("36.8 °C — within the usual range", temp("36.8").value());
    }
}
