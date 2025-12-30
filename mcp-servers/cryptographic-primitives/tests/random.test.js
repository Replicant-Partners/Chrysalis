/**
 * Tests for cryptographic random operations
 */

import { test } from 'node:test';
import assert from 'node:assert';
import {
  randomBytes,
  randomInt,
  randomIntRange,
  randomSelect,
  randomSample,
  shuffle,
  randomUUID
} from '../dist/random.js';

test('randomBytes - correct length', () => {
  const bytes = randomBytes(32);
  assert.strictEqual(bytes.length, 32);
});

test('randomBytes - zero length', () => {
  const bytes = randomBytes(0);
  assert.strictEqual(bytes.length, 0);
});

test('randomBytes - negative length throws', () => {
  assert.throws(() => randomBytes(-1), {
    message: 'Length must be non-negative'
  });
});

test('randomBytes - uniqueness', () => {
  const bytes1 = randomBytes(32);
  const bytes2 = randomBytes(32);
  
  // Should be extremely unlikely to be equal
  assert.notDeepStrictEqual(bytes1, bytes2);
});

test('randomInt - in range', () => {
  for (let i = 0; i < 100; i++) {
    const value = randomInt(10);
    assert.ok(value >= 0 && value < 10);
  }
});

test('randomInt - max 1 returns 0', () => {
  const value = randomInt(1);
  assert.strictEqual(value, 0);
});

test('randomInt - distribution', () => {
  const max = 5;
  const counts = new Array(max).fill(0);
  const iterations = 1000;
  
  for (let i = 0; i < iterations; i++) {
    const value = randomInt(max);
    counts[value]++;
  }
  
  // Each value should appear roughly iterations/max times
  // Use loose bounds for probabilistic test
  const expected = iterations / max;
  const tolerance = expected * 0.5; // 50% tolerance
  
  for (let i = 0; i < max; i++) {
    assert.ok(counts[i] > expected - tolerance);
    assert.ok(counts[i] < expected + tolerance);
  }
});

test('randomInt - zero or negative throws', () => {
  assert.throws(() => randomInt(0), {
    message: 'Max must be positive'
  });
  
  assert.throws(() => randomInt(-5), {
    message: 'Max must be positive'
  });
});

test('randomIntRange - in range', () => {
  for (let i = 0; i < 100; i++) {
    const value = randomIntRange(10, 20);
    assert.ok(value >= 10 && value < 20);
  }
});

test('randomIntRange - invalid range throws', () => {
  assert.throws(() => randomIntRange(10, 10), {
    message: 'Min must be less than max'
  });
  
  assert.throws(() => randomIntRange(20, 10), {
    message: 'Min must be less than max'
  });
});

test('randomSelect - returns element', () => {
  const array = ['a', 'b', 'c', 'd', 'e'];
  const selected = randomSelect(array);
  
  assert.ok(array.includes(selected));
});

test('randomSelect - single element', () => {
  const array = [42];
  const selected = randomSelect(array);
  
  assert.strictEqual(selected, 42);
});

test('randomSelect - empty array throws', () => {
  assert.throws(() => randomSelect([]), {
    message: 'Cannot select from empty array'
  });
});

test('randomSelect - distribution', () => {
  const array = [0, 1, 2];
  const counts = [0, 0, 0];
  const iterations = 1000;
  
  for (let i = 0; i < iterations; i++) {
    const selected = randomSelect(array);
    counts[selected]++;
  }
  
  // Each element should be selected roughly equally
  const expected = iterations / array.length;
  const tolerance = expected * 0.5;
  
  for (let i = 0; i < array.length; i++) {
    assert.ok(counts[i] > expected - tolerance);
    assert.ok(counts[i] < expected + tolerance);
  }
});

test('randomSample - correct size', () => {
  const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const sample = randomSample(array, 5);
  
  assert.strictEqual(sample.length, 5);
});

test('randomSample - no duplicates', () => {
  const array = [1, 2, 3, 4, 5];
  const sample = randomSample(array, 5);
  
  const unique = new Set(sample);
  assert.strictEqual(unique.size, 5);
});

test('randomSample - all from array', () => {
  const array = [1, 2, 3, 4, 5];
  const sample = randomSample(array, 3);
  
  for (const element of sample) {
    assert.ok(array.includes(element));
  }
});

test('randomSample - zero size', () => {
  const array = [1, 2, 3];
  const sample = randomSample(array, 0);
  
  assert.deepStrictEqual(sample, []);
});

test('randomSample - full size', () => {
  const array = [1, 2, 3, 4, 5];
  const sample = randomSample(array, 5);
  
  assert.strictEqual(sample.length, 5);
  
  // Should contain all elements (in some order)
  const sorted = [...sample].sort((a, b) => a - b);
  assert.deepStrictEqual(sorted, array);
});

test('randomSample - invalid size throws', () => {
  const array = [1, 2, 3];
  
  assert.throws(() => randomSample(array, -1), {
    message: 'Sample size must be non-negative'
  });
  
  assert.throws(() => randomSample(array, 4), {
    message: 'Sample size cannot exceed array length'
  });
});

test('shuffle - same length', () => {
  const array = [1, 2, 3, 4, 5];
  const shuffled = shuffle([...array]);
  
  assert.strictEqual(shuffled.length, array.length);
});

test('shuffle - same elements', () => {
  const array = [1, 2, 3, 4, 5];
  const shuffled = shuffle([...array]);
  
  const sorted = [...shuffled].sort((a, b) => a - b);
  assert.deepStrictEqual(sorted, array);
});

test('shuffle - mutates array', () => {
  const array = [1, 2, 3, 4, 5];
  const result = shuffle(array);
  
  assert.strictEqual(result, array); // Same reference
});

test('shuffle - actually shuffles', () => {
  const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  let differentCount = 0;
  const iterations = 10;
  
  for (let i = 0; i < iterations; i++) {
    const copy = [...array];
    shuffle(copy);
    
    // Check if order changed
    let isDifferent = false;
    for (let j = 0; j < array.length; j++) {
      if (copy[j] !== array[j]) {
        isDifferent = true;
        break;
      }
    }
    
    if (isDifferent) {
      differentCount++;
    }
  }
  
  // Should shuffle most of the time (probabilistic)
  assert.ok(differentCount >= iterations * 0.8);
});

test('randomUUID - format', () => {
  const uuid = randomUUID();
  
  // Check UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  assert.ok(regex.test(uuid));
});

test('randomUUID - uniqueness', () => {
  const uuid1 = randomUUID();
  const uuid2 = randomUUID();
  
  assert.notStrictEqual(uuid1, uuid2);
});

test('randomUUID - version and variant', () => {
  const uuid = randomUUID();
  const parts = uuid.split('-');
  
  // Version 4
  assert.strictEqual(parts[2][0], '4');
  
  // Variant (RFC4122): 10xx
  const variantChar = parts[3][0];
  assert.ok(['8', '9', 'a', 'b'].includes(variantChar));
});
