import 'dotenv/config';
import { Worker } from "bullmq";
import { validateConfig } from "./src/config/config.js";
import { processPR } from "./src/jobs/processPr.js";
import { processComment } from "./src/jobs/processComment.js";
import logger from "./src/config/logger.js";

validateConfig();

const redisUrl = process.env.REDIS_URL;

const worker = new Worker(
  "review",
  async job => {
    if (job.name === 'review-pr') {
      await processPR(job.data.payload);
    } else if (job.name === 'reply-comment') {
      await processComment(job.data.payload);
    }
  },
  {
    connection: { url: redisUrl },
    maxRetries: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  }
);

worker.on('failed', (job, err) => {
  logger.error({ jobId: job.id, err: err.message }, "Job failed");
});

worker.on('completed', (job) => {
  logger.info({ jobId: job.id, name: job.name }, "Job completed");
});

async function gracefulShutdown(signal) {
  logger.info({ signal }, "Shutting down");
  await worker.close();
  logger.info("Worker closed");
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
