import { getInstallationToken, getPullRequestFiles, postReviewComments } from "../services/github_service.js";
import { loadPrompt } from "../prompts/_load_prompt.js";
import { agent } from "../agent/agent.js";
import logger from "../config/logger.js";
import { checkTokenLimit, parseLLMJsonResponse, filterAndBatchPRFiles, splitFilesByTokenLimit } from "../utils/job_utils.js";

export async function processPR(payload) {
  const { repository, pull_request, installation } = payload;

  const owner = repository.owner.login;
  const repo = repository.name;
  const pullNumber = pull_request.number;

  const { allowed, tokens } = await checkTokenLimit();

  logger.info({ owner, repo, pullNumber, tokensSpent: tokens.total }, "Processing PR review");

  if (!allowed) {
    return;
  }

  const token = await getInstallationToken(installation.id);

  const files = await getPullRequestFiles({ token, owner, repo, pullNumber });
  const { filesToReview } = filterAndBatchPRFiles(files);
  const batches = splitFilesByTokenLimit(filesToReview);

  logger.info({ totalFiles: files.length, batchCount: batches.length }, "Processing PR files");

  const allComments = [];

  for (const batch of batches) {
    const comments = await reviewFilesWithLLM(batch, pullNumber, owner, repo, installation.id);

    for (const comment of comments) {
      allComments.push({
        path: comment.filename,
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

async function reviewFilesWithLLM(files, pullNumber, owner, repo, installationId) {
  const fileContents = files.map(f => `File: ${f.filename}\n\n${f.patch}`).join("\n\n---\n\n");
  const prompt = loadPrompt("review-pr", { DIFF: fileContents });

  try {
    const response = await agent.invoke({
      messages: [{ role: 'user', content: prompt }],
    }, {
      configurable: { thread_id: String(pullNumber), owner, repo, installationId }
    });

    const comments = parseLLMJsonResponse(response);
    if (!comments) {
      return [];
    }
    return comments;
  } catch (err) {
    logger.error({ err }, "LLM returned invalid JSON or tool error");
    return [];
  }
}
