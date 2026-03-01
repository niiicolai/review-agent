import { Queue } from "bullmq";

export const reviewQueue = new Queue("review", {
  connection: { url: process.env.REDIS_URL },
});
