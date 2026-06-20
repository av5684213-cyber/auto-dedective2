// apps/scraper/src/utils/rateLimiter.ts

interface RateLimiterConfig {
  maxRequests: number;
  perSeconds: number;
  key: string;
}

export class RateLimiter {
  private maxRequests: number;
  private perSeconds: number;
  private key: string;
  private requests: number[] = [];
  private lock: Promise<void> = Promise.resolve();

  constructor(config: RateLimiterConfig) {
    this.maxRequests = config.maxRequests;
    this.perSeconds = config.perSeconds;
    this.key = config.key;
  }

  async wait(): Promise<void> {
    await this.lock;
    
    this.lock = this.lock.then(async () => {
      const now = Date.now();
      const windowStart = now - (this.perSeconds * 1000);
      
      // Eski istekleri temizle
      this.requests = this.requests.filter(time => time > windowStart);
      
      if (this.requests.length >= this.maxRequests) {
        const oldestRequest = this.requests[0];
        const waitTime = (oldestRequest + (this.perSeconds * 1000)) - now;
        
        if (waitTime > 0) {
          console.log(`[RateLimiter:${this.key}] Waiting ${waitTime}ms`);
          await new Promise(resolve => setTimeout(resolve, waitTime + 100));
        }
      }
      
      this.requests.push(Date.now());
    });
    
    await this.lock;
  }

  getStats(): { requests: number; maxRequests: number; windowSeconds: number } {
    const now = Date.now();
    const windowStart = now - (this.perSeconds * 1000);
    const activeRequests = this.requests.filter(time => time > windowStart);
    
    return {
      requests: activeRequests.length,
      maxRequests: this.maxRequests,
      windowSeconds: this.perSeconds
    };
  }
}

// ── Rate Limiter Registry ─────────────────────────────────────────────

const limiters = new Map<string, RateLimiter>();

/**
 * Get or create a rate limiter for a given key.
 * Uses default settings: 10 requests per 60 seconds.
 *
 * Supports both calling conventions:
 *   getRateLimiter('my-key', 10, 60)          — positional args
 *   getRateLimiter({ key: 'my-key', maxRequests: 10, perSeconds: 60 }) — config object
 */
export function getRateLimiter(keyOrConfig: string | RateLimiterConfig, maxRequests: number = 10, perSeconds: number = 60): RateLimiter {
  let key: string;
  let mr: number;
  let ps: number;

  if (typeof keyOrConfig === 'object') {
    key = keyOrConfig.key;
    mr = keyOrConfig.maxRequests;
    ps = keyOrConfig.perSeconds;
  } else {
    key = keyOrConfig;
    mr = maxRequests;
    ps = perSeconds;
  }

  if (!limiters.has(key)) {
    limiters.set(key, new RateLimiter({ key, maxRequests: mr, perSeconds: ps }));
  }
  return limiters.get(key)!;
}
