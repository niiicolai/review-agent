import crypto from "crypto";

const secret = process.env.GITHUB_WEBHOOK_SECRET;

export function webhookMiddleware(req, res, next) {
  const signature = req.headers["x-hub-signature-256"];

  if (!signature) {
    return res.status(401).send("Missing signature");
  }

  if (!secret) {
    console.error("Missing GITHUB_WEBHOOK_SECRET");
    return res.status(500).send("Server misconfigured");
  }

  const hmac = crypto.createHmac("sha256", secret);

  if (!req.rawBody) {
    return res.status(401).send("Unauthorized");
  }

  const digest = "sha256=" + hmac.update(req.rawBody).digest("hex");

  const sigBuffer = Buffer.from(signature);
  const digestBuffer = Buffer.from(digest);

  if (
    sigBuffer.length !== digestBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, digestBuffer)
  ) {
    return res.status(401).send("Invalid signature");
  }

  next();
}
