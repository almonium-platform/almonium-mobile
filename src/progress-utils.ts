export function clampProgress(percentage: number) {
  return Math.max(0, Math.min(100, Math.round(percentage)));
}

export class ProgressQueue {
  private latest: number | null = null;
  private lastSaved: number | null = null;

  record(percentage: number) {
    this.latest = clampProgress(percentage);
    return this.latest;
  }

  next() {
    return this.latest === this.lastSaved ? null : this.latest;
  }

  markSaved(percentage: number) {
    this.lastSaved = clampProgress(percentage);
  }
}
