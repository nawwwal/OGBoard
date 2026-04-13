import { Redis } from '@upstash/redis'

interface CacheClient {
  del(key: string): Promise<number>
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, opts?: { ex?: number }): Promise<unknown>
}

interface MemoryEntry {
  expiresAt: number | null
  value: unknown
}

const memoryStore = new Map<string, MemoryEntry>()

const memoryRedis: CacheClient = {
  async get<T>(key: string) {
    const entry = memoryStore.get(key)
    if (!entry) return null

    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      memoryStore.delete(key)
      return null
    }

    return entry.value as T
  },

  async set<T>(key: string, value: T, opts?: { ex?: number }) {
    memoryStore.set(key, {
      value,
      expiresAt: opts?.ex ? Date.now() + opts.ex * 1000 : null,
    })
    return 'OK'
  },

  async del(key: string) {
    return memoryStore.delete(key) ? 1 : 0
  },
}

const redisUrl =
  process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
const redisToken =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
const isProductionDeployment =
  process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'

function missingRedisEnvError(): Error {
  return new Error(
    'Upstash Redis is not configured. Set UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN or KV_REST_API_URL / KV_REST_API_TOKEN for production deployments.',
  )
}

const missingRedisClient: CacheClient = {
  async get() {
    throw missingRedisEnvError()
  },
  async set() {
    throw missingRedisEnvError()
  },
  async del() {
    throw missingRedisEnvError()
  },
}

export const redis: CacheClient =
  redisUrl && redisToken
    ? Redis.fromEnv()
    : isProductionDeployment
      ? missingRedisClient
      : memoryRedis
