/**
 * Hand-drawn flat illustrations as SVG strings (rendered with SvgXml).
 * Animated parts (eyes, waving arm) are separate layers so they can move on the UI thread.
 * The palette stays muted: skin, dark hair and one accent colour passed in by the caller.
 */

const SKIN = '#F1C7A3';
const SKIN_SHADE = '#E4B08A';
const INK = '#2B2A33';
const BLUSH = '#EE9A94';

const wrap = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`;

/* ---------------------------------------------------------------- Guide (little boy) */

export const GUIDE_VIEWBOX = { w: 200, h: 240 };

export function guideBodySvg(accent: string, trousers = '#3E4452'): string {
  return wrap(
    200,
    240,
    `
    <ellipse cx="100" cy="230" rx="52" ry="7" fill="#000" opacity="0.08"/>
    <rect x="77" y="178" width="19" height="44" rx="8" fill="${trousers}"/>
    <rect x="104" y="178" width="19" height="44" rx="8" fill="${trousers}"/>
    <rect x="72" y="216" width="27" height="12" rx="6" fill="#F4F4F2"/>
    <rect x="101" y="216" width="27" height="12" rx="6" fill="#F4F4F2"/>
    <rect x="56" y="124" width="14" height="46" rx="7" fill="${accent}"/>
    <circle cx="63" cy="173" r="7.5" fill="${SKIN}"/>
    <rect x="68" y="118" width="64" height="70" rx="20" fill="${accent}"/>
    <rect x="68" y="168" width="64" height="20" rx="10" fill="#000" opacity="0.06"/>
    <rect x="92" y="104" width="16" height="20" rx="6" fill="${SKIN_SHADE}"/>
    <circle cx="61" cy="82" r="7" fill="${SKIN}"/>
    <circle cx="139" cy="82" r="7" fill="${SKIN}"/>
    <circle cx="100" cy="78" r="38" fill="${SKIN}"/>
    <path d="M59 80 C50 22 150 22 141 80 C132 62 114 55 100 57 C86 55 68 62 59 80 Z" fill="${INK}"/>
    <path d="M94 36 C95 24 110 22 114 32 C108 32 100 34 94 36 Z" fill="${INK}"/>
    <circle cx="77" cy="92" r="6.5" fill="${BLUSH}" opacity="0.55"/>
    <circle cx="123" cy="92" r="6.5" fill="${BLUSH}" opacity="0.55"/>
    <path d="M90 95 Q100 106 110 95" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>
  `,
  );
}

/** Eyes only, same canvas as the body, so it can be scaled to blink. */
export function guideEyesSvg(): string {
  return wrap(
    200,
    240,
    `
    <ellipse cx="86" cy="78" rx="4.8" ry="6" fill="${INK}"/>
    <ellipse cx="114" cy="78" rx="4.8" ry="6" fill="${INK}"/>
    <circle cx="87.6" cy="75.6" r="1.7" fill="#fff"/>
    <circle cx="115.6" cy="75.6" r="1.7" fill="#fff"/>
  `,
  );
}

/** Arm hanging from the right shoulder at (137,128). Rotate around that point to wave or point. */
export function guideArmSvg(accent: string): string {
  return wrap(
    200,
    240,
    `
    <rect x="130" y="122" width="14" height="48" rx="7" fill="${accent}"/>
    <circle cx="137" cy="173" r="7.5" fill="${SKIN}"/>
  `,
  );
}
export const GUIDE_SHOULDER = { x: 137 / 200, y: 129 / 240 };
export const GUIDE_EYES_PIVOT = { x: 0.5, y: 78 / 240 };

/* ---------------------------------------------------------------- Anime avatar */

export interface AvatarPreset {
  id: string;
  label: string;
  hair: string;
  iris: string;
  style: 'side' | 'spiky';
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'midnight', label: 'Midnight', hair: '#2C2838', iris: '#4E8D8A', style: 'side' },
  { id: 'silver', label: 'Silver', hair: '#A9AEC0', iris: '#6B7FD0', style: 'side' },
  { id: 'chestnut', label: 'Chestnut', hair: '#6A4330', iris: '#8A6A44', style: 'spiky' },
  { id: 'ink', label: 'Ink', hair: '#1D1D22', iris: '#B2606E', style: 'spiky' },
];

export function avatarBodySvg(preset: AvatarPreset, accent: string): string {
  const { hair, style } = preset;
  const hairBack =
    style === 'side'
      ? `<path d="M40 96 C34 40 166 40 160 96 L164 150 C150 160 140 140 138 120 L62 120 C60 140 50 160 36 150 Z" fill="${hair}"/>`
      : `<path d="M44 92 C40 44 160 44 156 92 C150 70 50 70 44 92 Z" fill="${hair}"/>`;
  const bangs =
    style === 'side'
      ? `<path d="M48 92 C46 52 154 46 152 94 C146 80 132 70 116 66 C112 82 96 92 70 94 C62 94 54 94 48 92 Z" fill="${hair}"/>
         <path d="M70 66 C80 74 92 78 104 78" stroke="#fff" stroke-opacity="0.18" stroke-width="3" fill="none" stroke-linecap="round"/>`
      : `<path d="M48 94 C42 60 62 38 78 46 C84 28 110 26 116 44 C132 34 158 56 152 94 C146 80 134 72 118 70 L104 62 L92 72 C76 70 58 78 48 94 Z" fill="${hair}"/>`;
  return wrap(
    200,
    200,
    `
    ${hairBack}
    <path d="M30 200 C30 160 64 146 100 146 C136 146 170 160 170 200 Z" fill="${accent}"/>
    <path d="M84 146 L100 168 L116 146 Z" fill="#fff" opacity="0.92"/>
    <rect x="88" y="124" width="24" height="28" rx="10" fill="${SKIN_SHADE}"/>
    <path d="M52 96 C52 62 148 62 148 96 C148 128 126 150 100 150 C74 150 52 128 52 96 Z" fill="${SKIN}"/>
    ${bangs}
    <ellipse cx="72" cy="118" rx="9" ry="5" fill="${BLUSH}" opacity="0.5"/>
    <ellipse cx="128" cy="118" rx="9" ry="5" fill="${BLUSH}" opacity="0.5"/>
    <path d="M100 112 L98 118 L102 118" stroke="${SKIN_SHADE}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M91 128 Q100 135 109 128" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
  `,
  );
}

export function avatarEyesSvg(preset: AvatarPreset): string {
  const { iris } = preset;
  const eye = (cx: number) => `
    <ellipse cx="${cx}" cy="104" rx="13" ry="16" fill="#fff"/>
    <ellipse cx="${cx}" cy="106" rx="10" ry="13" fill="${iris}"/>
    <ellipse cx="${cx}" cy="108" rx="5.5" ry="7.5" fill="${INK}"/>
    <circle cx="${cx - 3.6}" cy="100" r="4" fill="#fff"/>
    <circle cx="${cx + 4}" cy="112" r="2" fill="#fff" opacity="0.9"/>
    <path d="M${cx - 14} 98 Q${cx} 86 ${cx + 14} 98" stroke="${INK}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
  return wrap(200, 200, `${eye(76)}${eye(124)}`);
}
export const AVATAR_EYES_PIVOT = { x: 0.5, y: 104 / 200 };

/* ---------------------------------------------------------------- Door scene */

export const DOOR = { w: 170, h: 250 };

export function doorwaySvg(frame: string, glow: string): string {
  return wrap(
    170,
    250,
    `
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${glow}" stop-opacity="0.95"/><stop offset="1" stop-color="${glow}" stop-opacity="0.55"/>
    </linearGradient></defs>
    <rect x="2" y="2" width="166" height="246" rx="14" fill="${frame}"/>
    <rect x="12" y="12" width="146" height="236" rx="8" fill="url(#g)"/>
  `,
  );
}

export function doorLeafSvg(leaf: string, panel: string, handle: string): string {
  return wrap(
    146,
    236,
    `
    <rect x="0" y="0" width="146" height="236" rx="8" fill="${leaf}"/>
    <rect x="16" y="18" width="114" height="92" rx="8" fill="${panel}"/>
    <rect x="16" y="124" width="114" height="94" rx="8" fill="${panel}"/>
    <circle cx="122" cy="118" r="7" fill="${handle}"/>
  `,
  );
}

/* ---------------------------------------------------------------- Device illustration */

export function deviceSvg(body: string, screen: string, accent: string): string {
  return wrap(
    120,
    150,
    `
    <rect x="14" y="8" width="92" height="134" rx="22" fill="${body}"/>
    <rect x="26" y="22" width="68" height="52" rx="12" fill="${screen}"/>
    <path d="M32 50 H44 L50 38 L58 62 L65 46 H88" stroke="${accent}" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="60" cy="104" r="15" fill="${screen}"/>
    <circle cx="60" cy="104" r="7" fill="${accent}"/>
    <rect x="44" y="126" width="32" height="5" rx="2.5" fill="${screen}"/>
  `,
  );
}
