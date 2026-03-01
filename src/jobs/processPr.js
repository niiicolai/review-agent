import { getInstallationToken, getPullRequestFiles, postReviewComments } from "../services/github_service.js";
import { loadPrompt } from "../prompts/_loadPrompt.js";
import { agent } from "../agent/agent.js";
import logger from "../config/logger.js";
import { getTokenCounts } from "../config/tokens.js";
import { AIMessage } from "langchain";

const BOT_HANDLE = process.env.GITHUB_BOT_HANDLE;
const FILE_EXTENSIONS = process.env.GITHUB_FILE_EXTENSIONS || "js,ts,py,go,java,tsx,rs";
const MAX_FILES_TO_REVIEW = parseInt(process.env.MAX_FILES_TO_REVIEW || "20");
const FILES_PER_BATCH = parseInt(process.env.FILES_PER_BATCH || "10");
const MAX_TOKENS_ALLOWED = parseInt(process.env.MAX_TOKENS_ALLOWED ?? 0) || Infinity;

function removeBotMention(text) {
  if (!BOT_HANDLE) return text;
  return text.replace(new RegExp(`@${BOT_HANDLE}`, 'gi'), BOT_HANDLE);
}

export async function processPR(payload) {
  const { repository, pull_request, installation } = payload;

  const owner = repository.owner.login;
  const repo = repository.name;
  const pullNumber = pull_request.number;

  const currentTokens = await getTokenCounts();
  logger.info({ owner, repo, pullNumber, tokensSpent: currentTokens.total }, "Processing PR review");

  if (currentTokens >= MAX_TOKENS_ALLOWED) {
    logger.error({ currentTokens }, "Max allowed tokens reached.");
    return;
  }

  const token = await getInstallationToken(installation.id);

  const files = await getPullRequestFiles({ token, owner, repo, pullNumber });
  const extensions = FILE_EXTENSIONS.split(",").map(e => e.trim());
  const extRegex = new RegExp(`\\.(${extensions.join("|")})$`);
  const reviewableFiles = files.filter(
    f =>
      f.status !== "removed" &&
      f.patch &&
      f.filename.match(extRegex)
  );

  if (reviewableFiles.length > MAX_FILES_TO_REVIEW) {
    logger.info({ fileCount: reviewableFiles.length, maxFiles: MAX_FILES_TO_REVIEW }, "PR has too many files, truncating");
  }

  const filesToReview = reviewableFiles.slice(0, MAX_FILES_TO_REVIEW);
  const batches = [];
  for (let i = 0; i < filesToReview.length; i += FILES_PER_BATCH) {
    batches.push(filesToReview.slice(i, i + FILES_PER_BATCH));
  }

  logger.info({ totalFiles: filesToReview.length, batchCount: batches.length, filesPerBatch: FILES_PER_BATCH }, "Processing PR files");

  const allComments = [];

  for (const batch of batches) {
    const comments = await reviewFilesWithLLM(batch, pullNumber, owner, repo, installation.id);

    for (const comment of comments) {
      const sanitizedComment = removeBotMention(comment.comment);
      allComments.push({
        path: comment.filename,
        body: sanitizedComment,
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

    const aiMessages = response.messages.filter((m) => m instanceof AIMessage);
    const aimessage = aiMessages[aiMessages.length - 1];
    if (!aimessage) {
      logger.error({ issueNumber, action: "Comment" }, "No LLM response.");
      return;
    }

    return JSON.parse(aimessage.content);
  } catch (err) {
    logger.error({ err }, "LLM returned invalid JSON or tool error");
    return [];
  }
}
