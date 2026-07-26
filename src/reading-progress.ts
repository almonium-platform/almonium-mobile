import AsyncStorage from '@react-native-async-storage/async-storage';

import { api } from '@/src/api';
import { ProgressQueue } from '@/src/progress-utils';

export class ReadingProgressSync {
  private readonly queue = new ProgressQueue();
  private flushing: Promise<void> | null = null;
  private pendingWrite: Promise<void> = Promise.resolve();
  private readonly storageKey: string;

  constructor(
    private readonly bookId: number,
    userId: string,
  ) {
    this.storageKey = `almonium:pending-progress:${userId}:${bookId}`;
  }

  async restorePending() {
    const value = await AsyncStorage.getItem(this.storageKey);
    return value !== null && Number.isFinite(Number(value))
      ? this.queue.record(Number(value))
      : null;
  }

  record(percentage: number) {
    const value = this.queue.record(percentage);
    this.pendingWrite = this.pendingWrite.then(() =>
      AsyncStorage.setItem(this.storageKey, String(value)),
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
      await api.saveProgress(this.bookId, target);
      this.queue.markSaved(target);
      target = this.queue.next();
      if (target === null) await AsyncStorage.removeItem(this.storageKey);
    }
  }
}
