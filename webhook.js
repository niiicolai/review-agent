import 'dotenv/config';
import express from 'express';
import rateLimit from 'express-rate-limit';
import logger from "./src/logger.js";
import { validateConfig } from "./src/config.js";
import { reviewQueue } from "./src/queue/queue.js";
import { webhookMiddleware } from "./src/middleware/webhook_middleware.js";

validateConfig();

const port = process.env.WEB_PORT || 3000;
const app = express();
const BOT_HANDLE = process.env.GITHUB_APP_HANDLE;

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

app.use(limiter);

app.use(express.json({
  limit: '10kb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/webhook-event', webhookMiddleware, async (req, res) => {
  try {
    const { action, pull_request, comment } = req.body;

    if (pull_request && (action === 'opened' || action === 'synchronize')) {
      await reviewQueue.add("review-pr", { payload: req.body });
      logger.info({ action, repo: pull_request.head.repo.full_name, pr: pull_request.number }, "PR review queued");
    }

    if (comment && action === 'created' && BOT_HANDLE && typeof comment.body === 'string') {
      const mention = `@${BOT_HANDLE}`;
      if (comment.body.includes(mention)) {
        await reviewQueue.add("reply-comment", { payload: req.body });
        logger.info({ repo: comment.repository.full_name, issue: comment.issue.number }, "Comment reply queued");
      }
    }
    
    res.sendStatus(204);
  } catch (err) {
    logger.error(err, "Webhook error");
    res.sendStatus(500);
  }
});

const server = app.listen(port, () => {
  logger.info({ port }, "Server started");
});

async function gracefulShutdown(signal) {
  logger.info({ signal }, "Shutting down");
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
