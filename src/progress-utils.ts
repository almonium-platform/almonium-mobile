export function clampProgress(percentage: number) {
  return Math.max(0, Math.min(100, Math.round(percentage)));
}

/** The chapter being read and how many the reader counted, as the shelf will say it back. */
export interface ReadingPlace {
  chapter: number;
  chapterCount: number;
}

export interface ProgressPoint {
  percentage: number;
  place: ReadingPlace | null;
}

export function samePoint(a: ProgressPoint | null, b: ProgressPoint | null) {
  if (!a || !b) return a === b;
  return a.percentage === b.percentage && a.place?.chapter === b.place?.chapter && a.place?.chapterCount === b.place?.chapterCount;
}

export class ProgressQueue {
  private latest: ProgressPoint | null = null;
  private lastSaved: ProgressPoint | null = null;

  /** A percentage without a place keeps the last place known: the chapter does not change between two scrolls. */
  record(percentage: number, place: ReadingPlace | null = null): ProgressPoint {
    this.latest = { percentage: clampProgress(percentage), place: place ?? this.latest?.place ?? null };
    return this.latest;
  }

  next() {
    return this.latest && !samePoint(this.latest, this.lastSaved) ? this.latest : null;
  }

  markSaved(point: ProgressPoint) {
    this.lastSaved = { percentage: clampProgress(point.percentage), place: point.place };
  }
}
