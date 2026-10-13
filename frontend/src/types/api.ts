export interface User {
  userId: string;
  displayName: string;
  email: string;
}

export interface AuthResponse {
  accessToken: string;
  /** ISO-8601 UTC timestamp */
  expiresAt: string;
  user: User;
}

export interface SignupRequest {
  displayName: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

/** A device is linked to a user for a short session, then becomes free again. */
export interface Device {
  deviceId: string;
  status: 'ACTIVE' | 'DISABLED';
  assignedAt: string;
  assignedUntil: string;
  /** Seconds left in the session at the moment the server answered. */
  remainingSeconds: number;
  lastSeenAt: string | null;
}

export type IndicatorLevel = 'normal' | 'attention' | 'urgent' | 'info';

/** Calculated by the backend. The app only displays it. */
export interface DerivedIndicator {
  key: string;
  label: string;
  value: string;
  level: IndicatorLevel;
  note?: string;
}

export interface Measurement {
  measuredAt: string;
  receivedAt: string;
  spo2Percent: number;
  temperatureC: number;
  /** Null or missing when the device did not measure it. */
  heartRateBpm?: number | null;
  heightCm?: number | null;
  derived: DerivedIndicator[];
}

export type HistoryRange = '7d' | '30d';

export interface HistoryPoint {
  measuredAt: string;
  spo2Percent: number;
  temperatureC: number;
}

export interface HistoryResponse {
  range: HistoryRange;
  points: HistoryPoint[];
}

export interface ApiErrorBody {
  code: string;
  message: string;
}
