# Derived data rules (PROVISIONAL)

These are placeholders based on commonly published general-wellness ranges. A qualified clinician must review them before release.
Change them in `application.properties` under `iryo.thresholds.*`, then update the unit tests.

| Reading | Level | Rule |
|---|---|---|
| SpO₂ (rounded to whole %) | normal | 95 or higher |
| | attention | 90 to 94 |
| | urgent | below 90 |
| Temperature (rounded to 0.1 °C) | normal | 36.0 to 37.4 |
| | attention | 35.0 to 35.9, or 37.5 to 37.9 |
| | urgent | below 35.0, or 38.0 and above |

Notes
- Temperature ranges depend on where the sensor measures (skin, ear, mouth). Member 2 must confirm the measurement site.
- The app never shows diagnoses. Wording is limited to "within the usual range", "a little below/raised" and "seek advice".
- Only these two indicators exist. Nothing else (heart rate, blood pressure) is inferred from SpO₂ or temperature.
- Derived values are calculated when read. They are not stored, so a rule change applies to old readings too.
