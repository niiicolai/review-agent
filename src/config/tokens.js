import { Redis } from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

const TOKEN_KEY = "tokens:spent";

export async function addTokens(inputTokens, outputTokens) {
  const pipeline = redis.pipeline();
  pipeline.hincrby(TOKEN_KEY, "input", inputTokens);
  pipeline.hincrby(TOKEN_KEY, "output", outputTokens);
  pipeline.hincrby(TOKEN_KEY, "total", inputTokens + outputTokens);
  await pipeline.exec();
}

export async function getTokenCounts() {
  const counts = await redis.hgetall(TOKEN_KEY);
  return {
    input: parseInt(counts.input || 0),
    output: parseInt(counts.output || 0),
    total: parseInt(counts.total || 0),
  };
}

export async function resetTokenCounts() {
  await redis.del(TOKEN_KEY);
}
