/**
 * A fixed-capacity FIFO buffer.
 *
 * The guard retains a bounded window of recent steps so that long-running
 * agents do not leak memory. Once `capacity` is reached the oldest entry is
 * dropped.
 */
export class RingBuffer<T> {
  private items: T[] = [];

  constructor(private capacity: number) {
    if (!Number.isFinite(capacity) || capacity < 1) {
      throw new RangeError(`RingBuffer capacity must be >= 1, received ${capacity}`);
    }
  }

  /** Append an item, evicting the oldest one when full. */
  push(item: T): void {
    this.items.push(item);
    if (this.items.length > this.capacity) {
      this.items.splice(0, this.items.length - this.capacity);
    }
  }

  /** Number of retained items. */
  get size(): number {
    return this.items.length;
  }

  /** Maximum number of retained items. */
  get maxSize(): number {
    return this.capacity;
  }

  /** Snapshot of the buffer contents, oldest first. */
  toArray(): T[] {
    return this.items.slice();
  }

  /** Remove every item. */
  clear(): void {
    this.items = [];
  }

  /**
   * The most recent `count` items, oldest first.
   */
  tail(count: number): T[] {
    if (count <= 0) return [];
    return this.items.slice(Math.max(0, this.items.length - count));
  }
}
