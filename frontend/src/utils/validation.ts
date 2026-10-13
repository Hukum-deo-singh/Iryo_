const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DEVICE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{2,79}$/;

export function validateName(value: string): string | null {
  const v = value.trim();
  if (v.length < 2) return 'Enter your name (at least 2 characters).';
  if (v.length > 60) return 'Name must be 60 characters or fewer.';
  return null;
}

export function validateEmail(value: string): string | null {
  const v = value.trim();
  if (!v) return 'Enter your email address.';
  if (v.length > 254 || !EMAIL.test(v)) return 'Enter a valid email address.';
  return null;
}

export function validatePassword(value: string): string | null {
  if (value.length < 8) return 'Use at least 8 characters.';
  if (value.length > 72) return 'Use 72 characters or fewer.';
  if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) return 'Include at least one letter and one number.';
  return null;
}

export function validateLoginPassword(value: string): string | null {
  return value.length === 0 ? 'Enter your password.' : null;
}

export function validateDeviceId(value: string): string | null {
  const v = value.trim();
  if (!v) return 'Enter the Device ID printed on your device.';
  if (!DEVICE_ID.test(v)) return 'Device IDs use letters, numbers, hyphens and underscores only.';
  return null;
}
