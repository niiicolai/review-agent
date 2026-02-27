import 'dotenv/config';
import express from 'express';
import { reviewQueue } from "./src/queue/queue.js";
import { webhookMiddleware } from "./src/middleware/webhook_middleware.js";

const port = process.env.WEB_PORT;
const app = express();
const BOT_HANDLE = process.env.GITHUB_APP_HANDLE;

app.use(express.json({
  limit: '50kb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

app.post('/webhook-event', webhookMiddleware, async (req, res) => {
  try {
    const { action, pull_request, comment } = req.body;

    if (pull_request && (action === 'opened' || action === 'synchronize')) {
      await reviewQueue.add("review-pr", { payload: req.body });
    }

    if (comment && action === 'created' && BOT_HANDLE && typeof comment.body === 'string') {
      const mention = `@${BOT_HANDLE}`;
      if (comment.body.includes(mention)) {
        await reviewQueue.add("reply-comment", { payload: req.body });
      }
    }
    
    res.sendStatus(204);
  } catch {
    res.sendStatus(500);
  }
});

app.listen(port, () => {
  console.log(`server listening on http://localhost:${port}`);
});
