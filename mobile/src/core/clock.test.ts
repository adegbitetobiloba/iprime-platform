import { parseServerTime, ServerClock } from './clock';

// A realistic server time (epoch milliseconds). Values below 1e11 are read as seconds, so test data must look real.
const T0 = 1_762_430_400_000;

describe('parseServerTime', () => {
  it('reads ISO text, milliseconds and seconds', () => {
    expect(parseServerTime('2026-11-06T12:00:00.000Z')).toBe(Date.parse('2026-11-06T12:00:00.000Z'));
    expect(parseServerTime(T0)).toBe(T0);
    expect(parseServerTime(T0 / 1000)).toBe(T0);
  });
  it('rejects junk', () => {
    expect(parseServerTime('nope')).toBeNull();
    expect(parseServerTime(undefined)).toBeNull();
    expect(parseServerTime('')).toBeNull();
  });
});

describe('ServerClock', () => {
  it('computes the offset from the middle of the round trip', () => {
    const c = new ServerClock(() => 10_000);
    // phone sent at 1000 and got the reply at 1200 (middle 1100); the server said T0+5100, so the server is T0+4000 ahead
    expect(c.observe(T0 + 5100, 1000, 1200)).toBe(true);
    expect(c.offsetMs).toBe(T0 + 4000);
    expect(c.now()).toBe(T0 + 14_000);
  });
  it('prefers the sample with the shortest round trip', () => {
    const c = new ServerClock(() => 0);
    c.observe(T0 + 5100, 1000, 1200); // offset T0+4000, round trip 200
    c.observe(T0 + 9000, 2000, 2020); // offset T0+6990, round trip 20 (best)
    c.observe(T0 + 7000, 3000, 3400); // offset T0+3800, round trip 400
    expect(c.offsetMs).toBe(T0 + 6990);
  });
  it('ignores unusable samples', () => {
    const c = new ServerClock(() => 0);
    expect(c.observe('junk', 0, 10)).toBe(false);
    expect(c.observe(T0, 100, 50)).toBe(false); // negative round trip
    expect(c.observe(T0, 0, 60_000)).toBe(false); // too slow to trust
    expect(c.hasSample).toBe(false);
    expect(c.offsetMs).toBe(0);
  });
  it('keeps only the most recent samples', () => {
    const c = new ServerClock(() => 0, 2);
    c.observe(T0 + 1000, 0, 10); // round trip 10 would be best, but it gets pushed out
    c.observe(T0 + 2000, 0, 100);
    c.observe(T0 + 3000, 0, 50);
    expect(c.offsetMs).toBe(T0 + 3000 - 25);
  });
  it('reports time left from the server clock, not the phone clock', () => {
    const c = new ServerClock(() => T0 + 100_000); // the phone says T0+100s
    c.observe(T0 + 50_000, T0 + 100_000, T0 + 100_000); // the server says T0+50s, so the phone is 50 s ahead
    expect(c.now()).toBe(T0 + 50_000);
    expect(c.remainingMs(T0 + 80_000)).toBe(30_000);
    expect(c.remainingMs(T0 + 40_000)).toBe(-10_000);
    expect(c.remainingMs('garbage')).toBeNull();
  });
  it('reads serverNow from a reply body and can reset', () => {
    const c = new ServerClock(() => 0);
    expect(c.observeBody({ saved: true, serverNow: T0 }, 0, 0)).toBe(true);
    expect(c.observeBody({ saved: true }, 0, 0)).toBe(false);
    expect(c.observeBody(null, 0, 0)).toBe(false);
    c.reset();
    expect(c.hasSample).toBe(false);
  });
});
