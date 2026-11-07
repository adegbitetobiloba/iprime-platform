// Owner: Account 1, for Account 2. Server-clock offset: the phone clock is never trusted for exam time.
// Every server reply carries `serverNow` (CONTRACTS v1.1). Its exact format (ISO text or epoch number) is UNVERIFIED,
// so both are accepted. Epoch numbers below 1e11 are read as seconds, otherwise milliseconds.

export function parseServerTime(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v < 1e11 ? v * 1000 : v;
  if (typeof v === 'string' && v.trim()) {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

interface Sample { offsetMs: number; rttMs: number }
const MAX_RTT_MS = 30_000; // a reply that slow (for example a waking server) tells us little about the clock

export class ServerClock {
  private samples: Sample[] = [];
  constructor(private readonly deviceNow: () => number = Date.now, private readonly keep = 5) {}

  /**
   * Record one reply. `sentAt` and `receivedAt` are device times around the request.
   * The server time is assumed to be taken halfway through the round trip. Returns false if the sample was unusable.
   */
  observe(serverNow: unknown, sentAt: number, receivedAt: number): boolean {
    const server = parseServerTime(serverNow);
    const rtt = receivedAt - sentAt;
    if (server === null || rtt < 0 || rtt > MAX_RTT_MS) return false;
    this.samples.push({ offsetMs: server - (sentAt + receivedAt) / 2, rttMs: rtt });
    if (this.samples.length > this.keep) this.samples.shift();
    return true;
  }

  /** Convenience for an already-parsed JSON body. */
  observeBody(body: unknown, sentAt: number, receivedAt: number): boolean {
    return body && typeof body === 'object' ? this.observe((body as Record<string, unknown>).serverNow, sentAt, receivedAt) : false;
  }

  get hasSample(): boolean { return this.samples.length > 0; }

  /** Offset of the best sample (the one with the shortest round trip). 0 until a sample exists. */
  get offsetMs(): number {
    if (!this.samples.length) return 0;
    return this.samples.reduce((best, s) => (s.rttMs < best.rttMs ? s : best)).offsetMs;
  }

  /** Best estimate of the server's current time (ms since epoch). */
  now(): number { return this.deviceNow() + this.offsetMs; }

  /** Milliseconds until a server deadline (ISO text or epoch). null if the deadline cannot be read. Can be negative. */
  remainingMs(deadline: unknown): number | null {
    const d = parseServerTime(deadline);
    return d === null ? null : d - this.now();
  }

  reset(): void { this.samples = []; }
}

/** App-wide clock. The API client feeds it from every reply. */
export const serverClock = new ServerClock();
