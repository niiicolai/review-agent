import { getInstallationToken, postComment } from "../services/github_service.js";
import { loadPrompt } from "../prompts/_load_prompt.js";
import { agent } from "../agent/agent.js";
import logger from "../config/logger.js";
import { checkTokenLimit, extractIssueNumber, parseLLMResponse } from "../utils/job_utils.js";

export async function processComment(payload) {
  const { repository, comment, installation } = payload;

  const owner = repository.owner.login;
  const repo = repository.name;

  const issueNumber = extractIssueNumber(comment.issue_url);
  const { allowed, tokens } = await checkTokenLimit();

  logger.info({ owner, repo, issueNumber, user: comment.user.login, tokensSpent: tokens.total }, "Processing comment reply");
  if (!allowed) {
    return;
  }

  const token = await getInstallationToken(installation.id);

  const prompt = loadPrompt("comment-reply", {
    USER: comment.user.login,
    MESSAGE: comment.body,
  });

  const response = await agent.invoke({
    messages: [{ role: 'user', content: prompt }],
  }, {
    configurable: { thread_id: String(issueNumber), owner, repo, installationId: installation.id }
  });

  const replyBody = parseLLMResponse(response);
  if (!replyBody) {
    return;
  }

  await postComment({ token, owner, repo, issueNumber, body: replyBody });

  logger.info({ owner, repo, issueNumber }, "Comment reply posted");
}
