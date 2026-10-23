/**
 * Contract test suite for CacheStore implementations.
 * Every CacheStore must pass this suite to ensure consistent behavior
 * across InMemoryCacheStore and RedisCacheStore.
 */

import { CacheStore } from '../../src/services/cacheStore';

describe('CacheStore Contract', () => {
  let store: CacheStore;

  beforeEach(() => {
    // Individual test suites will inject their store implementation
  });

  describe('basic operations', () => {
    it('should set and get a value', async () => {
      await store.set('key1', 'value1');
      const result = await store.get('key1');
      expect(result).toBe('value1');
    });

    it('should return undefined for missing keys', async () => {
      const result = await store.get('nonexistent');
      expect(result).toBeUndefined();
    });

    it('should delete a key', async () => {
      await store.set('key1', 'value1');
      await store.del('key1');
      const result = await store.get('key1');
      expect(result).toBeUndefined();
    });

    it('should check key existence', async () => {
      await store.set('key1', 'value1');
      let exists = await store.has('key1');
      expect(exists).toBe(true);

      await store.del('key1');
      exists = await store.has('key1');
      expect(exists).toBe(false);
    });
  });

  describe('TTL and expiry', () => {
    it('should expire entries after TTL', async () => {
      await store.set('ttl-key', 'value', 100); // 100ms TTL
      let result = await store.get('ttl-key');
      expect(result).toBe('value');

      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 150));

      result = await store.get('ttl-key');
      expect(result).toBeUndefined();
    });

    it('should persist entries without TTL', async () => {
      await store.set('persist-key', 'value'); // no TTL
      await new Promise(resolve => setTimeout(resolve, 150));

      const result = await store.get('persist-key');
      expect(result).toBe('value');
    });

    it('should check expiry in has()', async () => {
      await store.set('ttl-key', 'value', 100);
      let exists = await store.has('ttl-key');
      expect(exists).toBe(true);

      await new Promise(resolve => setTimeout(resolve, 150));

      exists = await store.has('ttl-key');
      expect(exists).toBe(false);
    });
  });

  describe('prefix deletion', () => {
    it('should delete all keys with a given prefix', async () => {
      await store.set('players:list:filter1', 'data1');
      await store.set('players:list:filter2', 'data2');
      await store.set('players:123', 'data3');

      await store.deleteByPrefix('players:list');

      let result = await store.get('players:list:filter1');
      expect(result).toBeUndefined();

      result = await store.get('players:list:filter2');
      expect(result).toBeUndefined();

      // Non-matching key should still exist
      result = await store.get('players:123');
      expect(result).toBe('data3');
    });

    it('should handle empty prefix matches', async () => {
      await store.set('key1', 'value1');
      await store.deleteByPrefix('nonexistent');

      const result = await store.get('key1');
      expect(result).toBe('value1');
    });
  });

  describe('type preservation', () => {
    it('should preserve objects', async () => {
      const obj = { id: 123, name: 'test' };
      await store.set('obj-key', obj);
      const result = await store.get('obj-key');
      expect(result).toEqual(obj);
    });

    it('should preserve arrays', async () => {
      const arr = [1, 2, 3];
      await store.set('arr-key', arr);
      const result = await store.get('arr-key');
      expect(result).toEqual(arr);
    });

    it('should preserve numbers', async () => {
      await store.set('num-key', 42);
      const result = await store.get('num-key');
      expect(result).toBe(42);
    });

    it('should preserve null', async () => {
      await store.set('null-key', null);
      const result = await store.get('null-key');
      expect(result).toBeNull();
    });
  });

  describe('updates', () => {
    it('should update existing keys', async () => {
      await store.set('key1', 'value1');
      await store.set('key1', 'value2');
      const result = await store.get('key1');
      expect(result).toBe('value2');
    });

    it('should allow overwriting TTL', async () => {
      await store.set('key1', 'value1', 50);
      await new Promise(resolve => setTimeout(resolve, 30));
      await store.set('key1', 'value2', 100); // Extend TTL

      await new Promise(resolve => setTimeout(resolve, 30));

      const result = await store.get('key1');
      expect(result).toBe('value2');
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent sets', async () => {
      await Promise.all([
        store.set('key1', 'value1'),
        store.set('key2', 'value2'),
        store.set('key3', 'value3'),
      ]);

      const results = await Promise.all([
        store.get('key1'),
        store.get('key2'),
        store.get('key3'),
      ]);

      expect(results).toEqual(['value1', 'value2', 'value3']);
    });

    it('should handle concurrent get/set', async () => {
      await Promise.all([
        store.set('key1', 'value1'),
        store.get('key2'),
        store.has('key3'),
      ]);

      const result = await store.get('key1');
      expect(result).toBe('value1');
    });
  });
});
