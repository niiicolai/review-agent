import 'dotenv/config';
import express from 'express';
import rateLimit from 'express-rate-limit';
import logger from "./src/config/logger.js";
import { validateConfig } from "./src/config/config.js";
import { reviewQueue } from "./src/config/queue.js";
import { getTokenCounts, resetTokenCounts } from "./src/config/tokens.js";
import { webhookMiddleware } from "./src/middleware/webhook_middleware.js";

validateConfig();

const app = express();
app.set('trust proxy', 1);

const port = process.env.WEB_PORT || 3000;
const BOT_HANDLE = process.env.GITHUB_BOT_HANDLE;

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

app.use(limiter);

app.use(express.json({
  limit: '50kb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/tokens', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.API_KEY) {
    return res.sendStatus(401);
  }
  const counts = await getTokenCounts();
  res.json(counts);
});

app.delete('/tokens', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.API_KEY) {
    return res.sendStatus(401);
  }
  await resetTokenCounts();
  res.json({ status: 'reset' });
});

app.post('/webhook-event', webhookMiddleware, async (req, res) => {
  try {
    const { action, pull_request, comment } = req.body;
    logger.info({ action }, "New webhook Event");

    if (pull_request && (action === 'opened' || action === 'reopened' || action === 'synchronize')) {
      await reviewQueue.add("review-pr", { payload: req.body });
      logger.info({ action, repo: pull_request.head.repo.full_name, pr: pull_request.number }, "PR review queued");
    }

    if (comment && action === 'created' && BOT_HANDLE && typeof comment.body === 'string') {
      const mention = `@${BOT_HANDLE}`;
      const issueNumber = comment.issue_url?.split('/')?.pop();

      if (comment.body.includes(mention) && !isNaN(issueNumber)) {
        await reviewQueue.add("reply-comment", { payload: { ...req.body, issueNumber } });
        logger.info({ issue: issueNumber }, "Comment reply queued");
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
