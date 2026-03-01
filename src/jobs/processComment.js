import { getInstallationToken, postComment } from "../services/github_service.js";
import { loadPrompt } from "../prompts/_loadPrompt.js";
import { agent } from "../agent/agent.js";
import logger from "../config/logger.js";
import { getTokenCounts } from "../config/tokens.js";
import { AIMessage } from "langchain";

const BOT_HANDLE = process.env.GITHUB_BOT_HANDLE;
const MAX_TOKENS_ALLOWED = parseInt(process.env.MAX_TOKENS_ALLOWED ?? 0) || Infinity;

function removeBotMention(text) {
  if (!BOT_HANDLE || !text) return text;
  return text.replace(new RegExp(`@${BOT_HANDLE}`, 'gi'), BOT_HANDLE);
}

export async function processComment(payload) {
  const { repository, comment, installation } = payload;

  const owner = repository.owner.login;
  const repo = repository.name;

  const issueNumber = comment.issue_url.split('/').pop();
  const currentTokens = await getTokenCounts();

  logger.info({ owner, repo, issueNumber, user: comment.user.login, tokensSpent: currentTokens.total }, "Processing comment reply");
  if (currentTokens >= MAX_TOKENS_ALLOWED) {
    logger.error({ currentTokens }, "Max allowed tokens reached.");
    return;
  }

  const token = await getInstallationToken(installation.id);

  let message = comment.body;
  if (BOT_HANDLE) {
    message = message.replace(new RegExp(`@${BOT_HANDLE}`, ''), '').trim();
  }

  const prompt = loadPrompt("comment-reply", {
    USER: comment.user.login,
    MESSAGE: message,
  });

  const response = await agent.invoke({
    messages: [{ role: 'user', content: prompt }],
  }, {
    configurable: { thread_id: String(issueNumber), owner, repo, installationId: installation.id }
  });

  const aiMessages = response.messages.filter((m) => m instanceof AIMessage);
  const aimessage = aiMessages[aiMessages.length - 1];
  if (!aimessage) {
    logger.error({ issueNumber, action: "Comment" }, "No LLM response.");
    return;
  }

  const replyBody = removeBotMention(aimessage.content);

  await postComment({ token, owner, repo, issueNumber, body: replyBody });

  logger.info({ owner, repo, issueNumber }, "Comment reply posted");
}
