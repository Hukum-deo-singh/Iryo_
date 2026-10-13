# Iryo API contract

All paths are relative to the backend address. JSON in, JSON out. Times are ISO-8601 UTC.
Protected routes need `Authorization: Bearer <accessToken>`.

## Errors
Every non-2xx answer is `{ "code": "STRING", "message": "Text safe to show a user" }`.
The app shows `message` for 4xx and a generic message for 5xx. `401` on a protected route signs the user out.

## Health (public)
`GET /api/health` returns `200 {"status":"ok"}`. It does not touch the database. The app, the device and cron jobs use it to wake the server.

## Auth
| Route | Body | Success |
|---|---|---|
| `POST /api/auth/signup` | `{displayName, email, password}` | `201` AuthResponse. `409` if the email exists |
| `POST /api/auth/login` | `{email, password}` | `200` AuthResponse. `401` bad credentials, `429` too many tries |
| `GET /api/users/me` | none | `200` User |
| `POST /api/auth/logout` | none | `204` |

`AuthResponse = { accessToken, expiresAt, user: { userId, displayName, email } }`

## Devices
A device is linked to one user for a short session (default 2 minutes, `DEVICE_ASSIGNMENT_MINUTES`), then becomes free again.

| Route | Body | Success |
|---|---|---|
| `POST /api/devices/assign` | `{deviceId}` | `200` Device. `404` unknown ID, `409` in use or you already hold one, `429` too many tries |
| `GET /api/devices/me` | none | `200` Device while the session is active, `404 NO_DEVICE` otherwise |

`Device = { deviceId, status, assignedAt, assignedUntil, remainingSeconds, lastSeenAt|null }`. The user comes from the token. `deviceId` matches without regard to case.

## Measurements
| Route | Success |
|---|---|
| `GET /api/measurements/latest` | `200` Measurement, or `404 NO_MEASUREMENTS` |
| `GET /api/measurements/history?range=7d\|30d` | `200 { range, points: [{measuredAt, spo2Percent, temperatureC}] }` (averaged into hourly or 4-hourly points) |

`Measurement = { measuredAt, receivedAt, spo2Percent, temperatureC, heartRateBpm|null, heightCm|null, derived: [] }`
`derived = [{ key, label, value, level: "normal"|"attention"|"urgent"|"info", note? }]`, calculated by the backend from SpO2 and temperature only. Heart rate and height are shown as measured and are not judged.

Readings belong to the user who held the device when they arrived. They stay on that user's dashboard after the session ends. A reading that arrives while nobody holds the device is stored but visible to nobody.

## Device ingestion (called by Node-RED)
`POST /api/ingest/measurements` with header `X-Device-Key: <device key>`:
```json
{ "deviceId": "IRYO-0001", "spo2Percent": 97, "temperatureC": 36.7,
  "heartRateBpm": 72, "heightCm": 171.5, "measuredAt": "2026-10-13T10:00:00Z", "messageId": "IRYO-0001-1a2b3c4d-1" }
```
`heartRateBpm`, `heightCm`, `measuredAt` and `messageId` are optional. Limits: SpO2 50 to 100, temperature 25 to 45, heart rate 30 to 220, height 50 to 250.
Answers: `201 {"status":"accepted"}`, `200 {"status":"duplicate"}` (same `messageId` again), `400` bad values, `401` wrong key, `403` device disabled.

## Admin
`POST /api/admin/devices` with header `X-Admin-Key` and `{deviceId}` registers a device and returns its `ingestKey` once.
