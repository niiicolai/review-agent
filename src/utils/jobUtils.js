import { getTokenCounts } from "../config/tokens.js";
import logger from "../config/logger.js";
import { AIMessage } from "langchain";

const MAX_TOKENS_ALLOWED = parseInt(process.env.MAX_TOKENS_ALLOWED ?? 0) || Infinity;
const FILE_EXTENSIONS = process.env.GITHUB_FILE_EXTENSIONS || "js,ts,py,go,java,tsx,rs";
const MAX_FILES_TO_REVIEW = parseInt(process.env.MAX_FILES_TO_REVIEW || "20");
const FILES_PER_BATCH = parseInt(process.env.FILES_PER_BATCH || "10");
const MAX_TOKENS_PER_BATCH = parseInt(process.env.MAX_TOKENS_PER_BATCH || "20000");

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

export function splitFilesByTokenLimit(files) {
  const batches = [];
  let currentBatch = [];
  let currentTokens = 0;

  for (const file of files) {
    const fileTokens = estimateTokens(file.patch);
    if (currentTokens + fileTokens > MAX_TOKENS_PER_BATCH && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = [];
      currentTokens = 0;
    }
    currentBatch.push(file);
    currentTokens += fileTokens;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

export async function checkTokenLimit() {
  const currentTokens = await getTokenCounts();
  if (currentTokens.total >= MAX_TOKENS_ALLOWED) {
    logger.error({ currentTokens }, "Max allowed tokens reached.");
    return { allowed: false, tokens: currentTokens };
  }
  return { allowed: true, tokens: currentTokens };
}

export function filterAndBatchPRFiles(files, filesPerBatch=FILES_PER_BATCH, maxFilesToReview=MAX_FILES_TO_REVIEW) {
  const extensions = FILE_EXTENSIONS.split(",").map(e => e.trim());
  const extRegex = new RegExp(`\\.(${extensions.join("|") })$`);

  const reviewableFiles = files.filter(
    f =>
      f.status !== "removed" &&
      f.patch &&
      f.filename.match(extRegex)
  );

  const filesToReview = reviewableFiles.slice(0, maxFilesToReview);
  const batches = [];
  for (let i = 0; i < filesToReview.length; i += filesPerBatch) {
    batches.push(filesToReview.slice(i, i + filesPerBatch));
  }

  return {
    filesToReview,
    batches,
    fileCount: filesToReview.length,
    batchCount: batches.length,
  };
}

export function extractIssueNumber(issueUrl) {
  const parts = issueUrl.split('/').filter(Boolean);
  return parts[parts.length - 1];
}

export function parseLLMResponse(response) {
  const aiMessages = response.messages.filter((m) => m instanceof AIMessage);
  const aimessage = aiMessages[aiMessages.length - 1];
  if (!aimessage) {
    logger.error({}, "No LLM response.");
    return null;
  }
  return aimessage.content;
}

export function parseLLMJsonResponse(response) {
  const content = parseLLMResponse(response);
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch (err) {
    logger.error({ err }, "Failed to parse LLM JSON response");
    return null;
  }
}
