import { contrastRatio } from './contrast';
import { darkColors, lightColors, type ThemeColors } from './tokens';

// [foreground, background] pairs that carry text must reach 4.5:1 (WCAG AA). Borders that identify controls need 3:1.
const textPairs: Array<[keyof ThemeColors, keyof ThemeColors]> = [
  ['text', 'bg'], ['muted', 'bg'], ['muted', 'surface'], ['ink', 'surface'], ['text', 'surface'],
  ['onPrimary', 'primary'], ['onPrimary', 'primaryPressed'], ['link', 'bg'], ['link', 'surface'],
  ['onGold', 'gold'], ['goldText', 'goldSoft'], ['info', 'infoSoft'], ['success', 'successSoft'], ['danger', 'dangerSoft'],
  ['danger', 'surface'], ['success', 'surface'],
];

for (const [name, c] of [['light', lightColors], ['dark', darkColors]] as const) {
  describe(`${name} theme contrast`, () => {
  it('text pairs reach 4.5:1', () => {
    for (const [fg, bg] of textPairs) {
      expect({ pair: `${fg}/${bg}`, ok: contrastRatio(c[fg], c[bg]) >= 4.5 }).toEqual({ pair: `${fg}/${bg}`, ok: true });
    }
  });
  it('control borders reach 3:1 on page and card', () => {
    expect(contrastRatio(c.lineStrong, c.bg)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(c.lineStrong, c.surface)).toBeGreaterThanOrEqual(3);
  });
  });
}
