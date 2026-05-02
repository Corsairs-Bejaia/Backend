import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private publisher: Redis;
  private subscriber: Redis;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('redis.url')!;
    this.publisher = new Redis(url, { lazyConnect: true });
    // Dedicated subscriber connection — cannot issue regular commands when subscribed
    this.subscriber = new Redis(url, { lazyConnect: true });
  }

  async onModuleInit() {
    await this.publisher.connect();
    await this.subscriber.connect();
  }

  async onModuleDestroy() {
    await this.publisher.quit();
    await this.subscriber.quit();
  }

  // ─── Key/Value ────────────────────────────────────────────────────────────

  async get<T>(key: string): Promise<T | null> {
    const value = await this.publisher.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await this.publisher.setex(key, ttlSeconds, serialized);
    } else {
      await this.publisher.set(key, serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.publisher.del(key);
  }

  // ─── Pub/Sub (used for SSE verification progress streaming) ───────────────

  async publish(channel: string, message: unknown): Promise<void> {
    await this.publisher.publish(channel, JSON.stringify(message));
  }

  /**
   * Subscribe to a Redis channel and call the handler on each message.
   * Returns an unsubscribe function.
   */
  subscribe(channel: string, handler: (message: unknown) => void): () => void {
    void this.subscriber.subscribe(channel);

    const listener = (receivedChannel: string, message: string) => {
      if (receivedChannel === channel) {
        try {
          handler(JSON.parse(message));
        } catch {
          handler(message);
        }
      }
    };

    this.subscriber.on('message', listener);

    return () => {
      void this.subscriber.unsubscribe(channel);
      this.subscriber.off('message', listener);
    };
  }
}
