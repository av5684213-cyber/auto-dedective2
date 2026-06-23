// apps/scraper/src/cache.ts
// Otodedektif - Cache Service with optional Redis backend (falls back to in-memory)

interface CacheEntry<T = unknown> {
  value: T;
  expires: number;
}

interface CacheStatsEntry {
  hits: number;
  misses: number;
}

const DEFAULT_TTL = 300_000; // 5 minutes in ms

// ── Redis Client (lazy-init) ──────────────────────────────────────────

let redisClient: import('ioredis').default | null = null;
let redisConnectionFailed = false;

async function getRedis(): Promise<import('ioredis').default | null> {
  if (redisConnectionFailed) return null;
  if (redisClient) return redisClient;

  try {
    const Redis = (await import('ioredis')).default;
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      console.log('[Cache] No REDIS_URL set, using in-memory cache');
      redisConnectionFailed = true;
      return null;
    }

    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      connectTimeout: 5000,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 3) {
          console.warn('[Cache] Redis connection failed after 3 retries, falling back to in-memory');
          redisConnectionFailed = true;
          return null; // Stop retrying
        }
        return Math.min(times * 500, 2000);
      },
    });

    redisClient.on('error', (err) => {
      console.warn('[Cache] Redis error:', err.message);
    });

    await redisClient.connect();
    console.log('[Cache] Connected to Redis');
    return redisClient;
  } catch (error) {
    console.warn('[Cache] Redis connection failed, using in-memory cache:', (error as Error).message);
    redisConnectionFailed = true;
    return null;
  }
}

// ── Cache Service ──────────────────────────────────────────────────────

export class CacheService {
  private cache: Map<string, CacheEntry>;
  private stats: Map<string, CacheStatsEntry>;
  private defaultTtl: number;
  private keyPrefix: string;

  constructor(defaultTtl: number = DEFAULT_TTL, keyPrefix: string = 'otodedektif:') {
    this.cache = new Map();
    this.stats = new Map();
    this.defaultTtl = defaultTtl;
    this.keyPrefix = keyPrefix;
  }

  /**
   * Get a value from the cache. Checks Redis first, then in-memory.
   * Returns null if not found or expired.
   */
  async get<T>(key: string): Promise<T | null> {
    const fullKey = `${this.keyPrefix}${key}`;

    // Try Redis first
    const redis = await getRedis();
    if (redis) {
      try {
        const raw = await redis.get(fullKey);
        if (raw !== null) {
          this.recordHit(key);
          return JSON.parse(raw) as T;
        }
      } catch (error) {
        console.warn('[Cache] Redis GET error, falling back to memory:', (error as Error).message);
      }
    }

    // Fall back to in-memory
    const entry = this.cache.get(fullKey);

    if (!entry) {
      this.recordMiss(key);
      return null;
    }

    const now = Date.now();
    if (now >= entry.expires) {
      this.cache.delete(fullKey);
      this.recordMiss(key);
      return null;
    }

    this.recordHit(key);
    return entry.value as T;
  }

  /**
   * Set a value in the cache. Stores in both Redis and in-memory.
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const fullKey = `${this.keyPrefix}${key}`;
    const effectiveTtl = ttl ?? this.defaultTtl;
    const expires = Date.now() + effectiveTtl;

    // Set in-memory
    this.cache.set(fullKey, { value, expires });

    // Set in Redis
    const redis = await getRedis();
    if (redis) {
      try {
        await redis.set(fullKey, JSON.stringify(value), 'PX', effectiveTtl);
      } catch (error) {
        console.warn('[Cache] Redis SET error:', (error as Error).message);
      }
    }
  }

  /**
   * Delete a specific key from the cache.
   */
  async delete(key: string): Promise<void> {
    const fullKey = `${this.keyPrefix}${key}`;
    this.cache.delete(fullKey);

    const redis = await getRedis();
    if (redis) {
      try {
        await redis.del(fullKey);
      } catch (error) {
        console.warn('[Cache] Redis DEL error:', (error as Error).message);
      }
    }
  }

  /**
   * Clear all cache entries. Stats are preserved.
   */
  async clear(): Promise<void> {
    this.cache.clear();

    const redis = await getRedis();
    if (redis) {
      try {
        // Only delete keys with our prefix
        const keys = await redis.keys(`${this.keyPrefix}*`);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } catch (error) {
        console.warn('[Cache] Redis CLEAR error:', (error as Error).message);
      }
    }
  }

  /**
   * Check whether a key exists and is not expired.
   */
  async has(key: string): Promise<boolean> {
    const fullKey = `${this.keyPrefix}${key}`;

    // Check Redis
    const redis = await getRedis();
    if (redis) {
      try {
        const exists = await redis.exists(fullKey);
        if (exists) return true;
      } catch (error) {
        // Fall through to memory check
      }
    }

    // Check in-memory
    const entry = this.cache.get(fullKey);
    if (!entry) return false;

    const now = Date.now();
    if (now >= entry.expires) {
      this.cache.delete(fullKey);
      return false;
    }

    return true;
  }

  /**
   * Get cache statistics: number of keys, overall hit rate, and per-key stats.
   */
  getStats(): {
    keys: number;
    hitRate: number;
    stats: Record<string, CacheStatsEntry>;
  } {
    // Purge expired entries first for an accurate count
    this.purgeExpired();

    let totalHits = 0;
    let totalMisses = 0;
    const statsRecord: Record<string, CacheStatsEntry> = {};

    for (const [key, stat] of this.stats) {
      totalHits += stat.hits;
      totalMisses += stat.misses;
      statsRecord[key] = { ...stat };
    }

    const total = totalHits + totalMisses;
    const hitRate = total > 0 ? totalHits / total : 0;

    return {
      keys: this.cache.size,
      hitRate,
      stats: statsRecord,
    };
  }

  // ── Internal helpers ───────────────────────────────────────────────

  private recordHit(key: string): void {
    const stat = this.stats.get(key);
    if (stat) {
      stat.hits++;
    } else {
      this.stats.set(key, { hits: 1, misses: 0 });
    }
  }

  private recordMiss(key: string): void {
    const stat = this.stats.get(key);
    if (stat) {
      stat.misses++;
    } else {
      this.stats.set(key, { hits: 0, misses: 1 });
    }
  }

  /** Remove all expired entries from the in-memory cache */
  private purgeExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now >= entry.expires) {
        this.cache.delete(key);
      }
    }
  }
}

/** Singleton cache instance for use across the application */
export const cache = new CacheService();
