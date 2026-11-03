import { describe, it, expect } from 'vitest';
import { RingBuffer } from '../src/utils/ring-buffer.js';
import { ManualClock } from '../src/utils/clock.js';
import { extractText, normalizeForMatching, normalizeVariants, countOccurrences } from '../src/utils/content.js';

describe('RingBuffer', () => {
  it('retains items up to capacity', () => {
    const buffer = new RingBuffer<number>(3);
    buffer.push(1);
    buffer.push(2);
    expect(buffer.size).toBe(2);
  });

  it('evicts the oldest item when full', () => {
    const buffer = new RingBuffer<number>(3);
    buffer.push(1);
    buffer.push(2);
    buffer.push(3);
    buffer.push(4);

    expect(buffer.size).toBe(3);
    expect(buffer.toArray()).toEqual([2, 3, 4]);
  });

  it('clears', () => {
    const buffer = new RingBuffer<number>(3);
    buffer.push(1);
    buffer.clear();
    expect(buffer.size).toBe(0);
  });

  it('returns a copy from toArray', () => {
    const buffer = new RingBuffer<number>(3);
    buffer.push(1);
    const snapshot = buffer.toArray();
    snapshot.push(2);
    expect(buffer.size).toBe(1);
  });

  it('returns the tail', () => {
    const buffer = new RingBuffer<number>(5);
    for (let i = 1; i <= 5; i += 1) buffer.push(i);
    expect(buffer.tail(2)).toEqual([4, 5]);
    expect(buffer.tail(0)).toEqual([]);
    expect(buffer.tail(99)).toEqual([1, 2, 3, 4, 5]);
  });

  it('rejects an invalid capacity', () => {
    expect(() => new RingBuffer<number>(0)).toThrow(RangeError);
  });
});

describe('ManualClock', () => {
  it('starts at the given time', () => {
    expect(new ManualClock(100).now()).toBe(100);
  });

  it('advances', () => {
    const clock = new ManualClock(0);
    clock.advance(50);
    expect(clock.now()).toBe(50);
  });

  it('sets an absolute time', () => {
    const clock = new ManualClock(0);
    clock.set(999);
    expect(clock.now()).toBe(999);
  });

  it('exposes a Clock function', () => {
    const clock = new ManualClock(0);
    const fn = clock.clock;
    clock.advance(10);
    expect(fn()).toBe(10);
  });
});

describe('extractText', () => {
  it('extracts strings', () => {
    expect(extractText('hello')).toBe('hello');
  });

  it('extracts numbers and booleans', () => {
    expect(extractText(42)).toBe('42');
    expect(extractText(true)).toBe('true');
  });

  it('returns an empty string for null and undefined', () => {
    expect(extractText(null)).toBe('');
    expect(extractText(undefined)).toBe('');
  });

  it('flattens nested objects including keys', () => {
    const text = extractText({ instruction: 'do something' });
    expect(text).toContain('instruction');
    expect(text).toContain('do something');
  });

  it('flattens arrays', () => {
    expect(extractText(['a', 'b'])).toContain('a');
    expect(extractText(['a', 'b'])).toContain('b');
  });

  it('handles Map and Set', () => {
    expect(extractText(new Map([['k', 'v']]))).toContain('v');
    expect(extractText(new Set(['s']))).toContain('s');
  });

  it('handles Date and Error', () => {
    expect(extractText(new Date('2024-01-01T00:00:00Z'))).toContain('2024');
    expect(extractText(new Error('oops'))).toContain('oops');
  });

  it('skips functions', () => {
    expect(extractText({ fn: () => 1, keep: 'yes' })).not.toContain('=>');
    expect(extractText({ fn: () => 1, keep: 'yes' })).toContain('yes');
  });

  it('does not recurse infinitely on deep structures', () => {
    let deep: unknown = 'leaf';
    for (let i = 0; i < 100; i += 1) deep = { deep };
    expect(() => extractText(deep)).not.toThrow();
  });
});

describe('normalizeForMatching', () => {
  it('lowercases', () => {
    expect(normalizeForMatching('HeLLo')).toBe('hello');
  });

  it('collapses whitespace', () => {
    expect(normalizeForMatching('a    b\n\nc')).toBe('a b c');
  });

  it('replaces zero-width characters with a space', () => {
    // A hidden character inside a word becomes a separator, so "ig<narrow>ore"
    // cannot fuse into a single token that hides from the pattern.
    expect(normalizeForMatching('ig\u200Bnore')).toBe('ig nore');
  });

  it('provides a variant with invisible characters removed entirely', () => {
    const variants = normalizeVariants('ig\u200Bnore');
    expect(variants).toContain('ig nore');
    expect(variants).toContain('ignore');
  });

  it('applies NFKC folding', () => {
    expect(normalizeForMatching('ＡＢＣ')).toBe('abc');
  });
});

describe('countOccurrences', () => {
  it('counts non-overlapping occurrences', () => {
    expect(countOccurrences('aaa', 'a')).toBe(3);
    expect(countOccurrences('abcabc', 'abc')).toBe(2);
  });

  it('returns 0 for an empty needle', () => {
    expect(countOccurrences('abc', '')).toBe(0);
  });

  it('returns 0 when the needle is absent', () => {
    expect(countOccurrences('abc', 'z')).toBe(0);
  });
});
