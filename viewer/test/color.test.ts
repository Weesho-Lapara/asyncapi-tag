import { describe, expect, it } from 'vitest';
import { badgeInk, contrast, luminance, parseColor, textSafe, toHex } from '../src/util/color.js';

describe('colour maths', () => {
  it('parses hex and rgb forms', () => {
    expect(parseColor('#2944C9')).toEqual([41, 68, 201]);
    expect(parseColor('#fff')).toEqual([255, 255, 255]);
    expect(parseColor('rgb(10, 20, 30)')).toEqual([10, 20, 30]);
    expect(parseColor('rgba(10 20 30 / 0.5)')).toEqual([10, 20, 30]);
    expect(parseColor('#2944c9aa')).toEqual([41, 68, 201]);
    expect(parseColor('tomato')).toBeUndefined();
    expect(toHex([41, 68, 201])).toBe('#2944c9');
  });

  it('luminance and contrast follow WCAG', () => {
    expect(luminance([255, 255, 255])).toBeCloseTo(1);
    expect(luminance([0, 0, 0])).toBe(0);
    expect(contrast([0, 0, 0], [255, 255, 255])).toBeCloseTo(21);
    expect(contrast([41, 68, 201], [246, 245, 241])).toBeCloseTo(6.97, 1);
  });

  it('badge ink is dark on light accents and white otherwise', () => {
    expect(badgeInk([41, 68, 201])).toBe('#FFFFFF');
    expect(badgeInk([184, 78, 26])).toBe('#FFFFFF');
    expect(badgeInk([255, 214, 0])).toBe('#14161B');
    expect(badgeInk([200, 230, 255])).toBe('#14161B');
  });

  it('text-safe accent keeps a passing colour and darkens or lightens a failing one', () => {
    const bgLight: [number, number, number] = [246, 245, 241];
    const bgDark: [number, number, number] = [15, 17, 21];
    expect(textSafe([41, 68, 201], bgLight, false)).toEqual([41, 68, 201]);
    const yellowOnLight = textSafe([255, 214, 0], bgLight, false);
    expect(contrast(yellowOnLight, bgLight)).toBeGreaterThanOrEqual(4.5);
    expect(luminance(yellowOnLight)).toBeLessThan(luminance([255, 214, 0]));
    const navyOnDark = textSafe([20, 30, 90], bgDark, true);
    expect(contrast(navyOnDark, bgDark)).toBeGreaterThanOrEqual(4.5);
    expect(luminance(navyOnDark)).toBeGreaterThan(luminance([20, 30, 90]));
  });
});
