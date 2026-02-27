import 'dotenv/config';
import express from 'express';
import { reviewQueue } from "./src/queue/queue.js";
import { webhookMiddleware } from "./src/middleware/webhook_middleware.js";

const port = process.env.WEB_PORT;
const app = express();

app.use(express.json({
  limit: '50kb',
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

app.post('/webhook-event', webhookMiddleware, async (req, res) => {
  try {

    await reviewQueue.add("review-pr", { payload: req.body });
    res.sendStatus(204);
  } catch {
    res.sendStatus(500);
  }
});

app.listen(port, () => {
  console.log(`server listening on http://localhost:${port}`);
});
