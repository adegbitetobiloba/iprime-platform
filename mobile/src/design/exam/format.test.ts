import { formatRemaining, spokenRemaining } from './format';

describe('formatRemaining', () => {
  it('formats minutes and hours', () => {
    expect(formatRemaining(65_000)).toBe('01:05');
    expect(formatRemaining(3_725_000)).toBe('1:02:05');
  });
  it('rounds partial seconds up and never goes negative', () => {
    expect(formatRemaining(1)).toBe('00:01');
    expect(formatRemaining(-500)).toBe('00:00');
    expect(formatRemaining(Number.NaN)).toBe('00:00');
  });
  it('speaks the time', () => {
    expect(spokenRemaining(3_725_000)).toBe('1 hour 2 minutes 5 seconds');
    expect(spokenRemaining(1_000)).toBe('1 second');
    expect(spokenRemaining(0)).toBe('0 seconds');
  });
});
