import { getInstallationToken, getPullRequestFiles, postReviewComments } from "../services/github_service.js";
import { loadPrompt } from "../prompts/_loadPrompt.js";
import { agent } from "../agent/agent.js";
import logger from "../config/logger.js";

const BOT_HANDLE = process.env.GITHUB_BOT_HANDLE;
const FILE_EXTENSIONS = process.env.FILE_EXTENSIONS || "js,ts,py,go,java,tsx,rs";

function removeBotMention(text) {
  if (!BOT_HANDLE) return text;
  return text.replace(new RegExp(`@${BOT_HANDLE}`, 'gi'), BOT_HANDLE);
}

export async function processPR(payload) {
  const { repository, pull_request, installation } = payload;

  const owner = repository.owner.login;
  const repo = repository.name;
  const pullNumber = pull_request.number;

  logger.info({ owner, repo, pullNumber }, "Processing PR review");

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

  const allComments = [];

  for (const file of reviewableFiles) {
    const comments = await reviewFileWithLLM(file, pullNumber);

    for (const comment of comments) {
      const sanitizedComment = removeBotMention(comment.comment);
      allComments.push({
        path: file.filename,
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

async function reviewFileWithLLM(file, pullNumber) {
  const prompt = loadPrompt("review-pr", { DIFF: file.patch });

  try {
    const response = await agent.invoke(
      { messages: [{ role: 'user', content: prompt }] },
      { configurable: { pullNumber } }
    );
    return JSON.parse(response.content);
  } catch (err) {
    logger.error({ err, file: file.filename }, "LLM returned invalid JSON");
    return [];
  }
}
