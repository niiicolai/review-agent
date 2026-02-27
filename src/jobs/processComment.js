import { llm } from "../llm.js";
import { getInstallationToken, postComment } from "../services/github_service.js";
import { loadPrompt } from "../prompts/index.js";
import logger from "../logger.js";

export async function processComment(payload) {
  const { repository, comment, installation } = payload;

  const owner = repository.owner.login;
  const repo = repository.name;

  const issueNumber = comment.issue_url.split('/').pop();

  logger.info({ owner, repo, issueNumber, user: comment.user.login }, "Processing comment reply");

  const token = await getInstallationToken(installation.id);

  const prompt = loadPrompt("comment-reply", {
    USER: comment.user.login,
    MESSAGE: comment.body,
  });

  const response = await llm.invoke(prompt);
  const replyBody = response.content;

  await postComment({ token, owner, repo, issueNumber, body: replyBody });

  logger.info({ owner, repo, issueNumber }, "Comment reply posted");
}
