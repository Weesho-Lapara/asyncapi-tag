/**
 * Colour maths for the runtime rules in spec 4.2: badge text colour from the accent's
 * lightness, and a text-safe variant of the accent when it does not reach 4.5:1 on the
 * page background. Pure functions over `[r, g, b]` in 0-255 so they are easy to test.
 */
export type RGB = [number, number, number];

/** Parse `rgb(…)`, `rgba(…)`, `#rgb`, `#rrggbb` or `#rrggbbaa`. Undefined for anything else. */
export function parseColor(text: string): RGB | undefined {
  const s = text.trim();
  const rgb = /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)/i.exec(s);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  const hex = /^#([0-9a-f]{3,8})$/i.exec(s)?.[1];
  if (!hex) return undefined;
  if (hex.length === 3 || hex.length === 4) {
    return [parseInt(hex[0]! + hex[0]!, 16), parseInt(hex[1]! + hex[1]!, 16), parseInt(hex[2]! + hex[2]!, 16)];
  }
  if (hex.length === 6 || hex.length === 8) {
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  }
  return undefined;
}

export function toHex([r, g, b]: RGB): string {
  return `#${[r, g, b].map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('')}`;
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance([r, g, b]: RGB): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio, 1 to 21. */
export function contrast(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Spec 4.2: `#14161B` on light accents (lightness above 0.6), white otherwise. */
export function badgeInk(accent: RGB): string {
  return luminance(accent) > 0.6 ? '#14161B' : '#FFFFFF';
}

/**
 * The accent itself when it reaches `ratio` against `background`, otherwise the nearest
 * darker (light theme) or lighter (dark theme) shade that does. Mixes towards black or white
 * in small steps so the hue is kept.
 */
export function textSafe(accent: RGB, background: RGB, dark: boolean, ratio = 4.5): RGB {
  if (contrast(accent, background) >= ratio) return accent;
  const target: RGB = dark ? [255, 255, 255] : [0, 0, 0];
  for (let t = 0.05; t <= 1; t += 0.05) {
    const mixed = mix(accent, target, t);
    if (contrast(mixed, background) >= ratio) return mixed;
  }
  return target;
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
