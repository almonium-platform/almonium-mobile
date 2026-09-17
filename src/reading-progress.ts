import AsyncStorage from '@react-native-async-storage/async-storage';

import { api } from '@/src/api';
import { ProgressQueue, type ProgressPoint, type ReadingPlace } from '@/src/progress-utils';

export class ReadingProgressSync {
  private readonly queue = new ProgressQueue();
  private flushing: Promise<void> | null = null;
  private pendingWrite: Promise<void> = Promise.resolve();
  private readonly storageKey: string;

  constructor(
    private readonly bookId: string,
    userId: string,
  ) {
    this.storageKey = `almonium:pending-progress:${userId}:${bookId}`;
  }

  /** The percentage left unsent last time, put back on the queue with its place; null when nothing waits. */
  async restorePending() {
    const value = await AsyncStorage.getItem(this.storageKey);
    const pending = parsePendingPoint(value);
    return pending ? this.queue.record(pending.percentage, pending.place).percentage : null;
  }

  record(percentage: number, place: ReadingPlace | null = null) {
    const value = this.queue.record(percentage, place);
    this.pendingWrite = this.pendingWrite.then(() =>
      AsyncStorage.setItem(this.storageKey, JSON.stringify(value)),
    );
    return this.pendingWrite;
  }

  flush() {
    if (this.flushing) return this.flushing;
    this.flushing = this.flushLoop().finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  private async flushLoop() {
    await this.pendingWrite;
    let target = this.queue.next();
    while (target !== null) {
      await this.pendingWrite;
      await api.saveProgress(this.bookId, target.percentage, target.place);
      this.queue.markSaved(target);
      target = this.queue.next();
      if (target === null) await AsyncStorage.removeItem(this.storageKey);
    }
  }
}

/** A stored point, or the bare percentage an earlier build wrote. */
export function parsePendingPoint(value: string | null): ProgressPoint | null {
  if (value === null) return null;
  if (Number.isFinite(Number(value))) return { percentage: Number(value), place: null };
  try {
    const parsed = JSON.parse(value) as Partial<ProgressPoint>;
    if (typeof parsed.percentage !== 'number' || !Number.isFinite(parsed.percentage)) return null;
    const place = parsed.place;
    const valid = place && Number.isInteger(place.chapter) && place.chapter >= 1;
    return { percentage: parsed.percentage, place: valid ? { chapter: place.chapter } : null };
  } catch {
    return null;
  }
}
