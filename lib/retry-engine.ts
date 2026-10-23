// Exponential backoff intervals: 1s → 3s → 10s → 30s → 60s (stays at 60s)
const BACKOFF_MS = [1_000, 3_000, 10_000, 30_000, 60_000] as const;

type CheckFn    = () => Promise<boolean>;
type TickFn     = (secondsLeft: number, attempt: number) => void;
type SuccessFn  = () => void;

class RetryEngine {
  private timer:    ReturnType<typeof setTimeout>  | null = null;
  private ticker:   ReturnType<typeof setInterval> | null = null;
  private running   = false;
  private attempt   = 0;
  private checkFn:  CheckFn   | null = null;
  private onSuccess: SuccessFn | null = null;
  private onTick:   TickFn    | null = null;

  start(check: CheckFn, onSuccess: SuccessFn, onTick: TickFn): void {
    this.stop();
    this.checkFn  = check;
    this.onSuccess = onSuccess;
    this.onTick   = onTick;
    this.running  = true;
    this.attempt  = 0;
    this.schedule();
  }

  stop(): void {
    if (this.timer)  clearTimeout(this.timer);
    if (this.ticker) clearInterval(this.ticker);
    this.timer   = null;
    this.ticker  = null;
    this.running = false;
  }

  get isRunning(): boolean { return this.running; }

  private schedule(): void {
    const ms   = BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)];
    let secs   = Math.round(ms / 1000);

    this.onTick?.(secs, this.attempt);

    if (this.ticker) clearInterval(this.ticker);
    this.ticker = setInterval(() => {
      secs = Math.max(0, secs - 1);
      this.onTick?.(secs, this.attempt);
    }, 1_000);

    this.timer = setTimeout(() => {
      if (this.ticker) clearInterval(this.ticker);
      if (!this.running || !this.checkFn) return;

      void this.checkFn().then((ok) => {
        if (ok) {
          this.stop();
          this.onSuccess?.();
        } else {
          this.attempt += 1;
          this.schedule();
        }
      });
    }, ms);
  }
}

export const retryEngine = new RetryEngine();
