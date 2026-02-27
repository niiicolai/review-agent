import { getInstallationToken, getPullRequestFiles, postReviewComments } from "../services/github_service.js";
import { llm } from "../llm.js";
import { loadPrompt } from "../prompts/index.js";
import logger from "../logger.js";

export async function processPR(payload) {
  const { repository, pull_request, installation } = payload;

  const owner = repository.owner.login;
  const repo = repository.name;
  const pullNumber = pull_request.number;

  logger.info({ owner, repo, pullNumber }, "Processing PR review");

  const token = await getInstallationToken(installation.id);

  const files = await getPullRequestFiles({ token, owner, repo, pullNumber });
  const reviewableFiles = files.filter(
    f =>
      f.status !== "removed" &&
      f.patch &&
      f.filename.match(/\.(js|ts|py|go|java|tsx|rs)$/)
  );

  const allComments = [];

  for (const file of reviewableFiles) {
    const comments = await reviewFileWithLLM(file);

    for (const comment of comments) {
      allComments.push({
        path: file.filename,
        body: comment.comment,
        line: comment.line,
      });
    }
  }

  logger.info({ owner, repo, pullNumber, commentCount: allComments.length }, "PR review complete");

  if (allComments.length > 0) {
    await postReviewComments({
      token,
      owner,
      repo,
      pullNumber,
      commitId: pull_request.head.sha,
      comments: allComments,
    });
  }
}

async function reviewFileWithLLM(file) {
  const prompt = loadPrompt("review-pr", { DIFF: file.patch });

  try {
    const response = await llm.invoke(prompt);
    return JSON.parse(response.content);
  } catch (err) {
    logger.error({ err, file: file.filename }, "LLM returned invalid JSON");
    return [];
  }
}
