import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import logger from "../config/logger.js";

const GITHUB_API = "https://api.github.com";
const GITHUB_PRIVATE_KEY = process.env.GITHUB_PRIVATE_KEY
    ? process.env.GITHUB_PRIVATE_KEY
    : fs.readFileSync(path.join(process.cwd(), "private-key.pem"), "utf8");

export async function getInstallationToken(installationId) {
    const appJwt = jwt.sign(
        {
            iat: Math.floor(Date.now() / 1000) - 60,
            exp: Math.floor(Date.now() / 1000) + 600,
            iss: process.env.GITHUB_APP_ID,
        },
        GITHUB_PRIVATE_KEY,
        { algorithm: "RS256" }
    );

    const res = await fetch(
        `https://api.github.com/app/installations/${installationId}/access_tokens`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${appJwt}`,
                Accept: "application/vnd.github+json",
            },
        }
    );

    if (!res.ok) {
        const err = await res.json();
        throw new Error(`Failed to get installation token: ${JSON.stringify(err)}`);
    }

    const data = await res.json();
    return data.token;
}

export async function getPullRequestFiles({ token, owner, repo, pullNumber }) {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/pulls/${pullNumber}/files`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Failed to get PR files: ${JSON.stringify(err)}`);
  }

  return res.json();
}

export async function postReviewComments({ token, owner, repo, pullNumber, commitId, comments }) {
  const body = comments.map(c => `**${c.path}:${c.line}**\n${c.body}`).join("\n\n---\n\n");

  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      body: JSON.stringify({
        event: "COMMENT",
        commit_id: commitId,
        body,
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json();
    logger.error({ err, owner, repo, pullNumber }, "Failed to post review");
    throw new Error(`Failed to post review: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  logger.info({ owner, repo, pullNumber, reviewId: data.id }, "Review posted");
  return data;
}

export async function postComment({ token, owner, repo, issueNumber, body }) {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      body: JSON.stringify({ body }),
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Failed to post comment: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  logger.info({ owner, repo, issueNumber, commentId: data.id }, "Comment posted");
}

export async function searchCode({ token, owner, repo, query }) {

  const res = await fetch(
    `${GITHUB_API}/search/code?q=${encodeURIComponent(query)}+repo:${owner}/${repo}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Search failed: ${JSON.stringify(err)}`);
  }

  return res.json();
}

export async function getFileContent({ token, owner, repo, path }) {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Failed to get file: ${JSON.stringify(err)}`);
  }

  return res.json();
}

