import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { ChatOllama } from "@langchain/ollama";
import { ChatOpenAI } from "@langchain/openai";

const GITHUB_API = "https://api.github.com";

const appId = process.env.GITHUB_APP_ID;
const privateKey = fs.readFileSync(path.join(process.cwd(), "private-key.pem"), "utf8");

/*
const llm = new ChatOllama({
    baseUrl: process.env.OLLAMA_URL,
    model: process.env.OLLAMA_MODEL,
    temperature: 0,
    maxRetries: 2,
});*/

const llm = new ChatOpenAI({
  model: process.env.OPENAI_MODEL,
  temperature: 0,
})

export async function processPR(payload) {
  const { repository, pull_request, installation } = payload;

  const owner = repository.owner.login;
  const repo = repository.name;
  const pullNumber = pull_request.number;

  const token = await getInstallationToken(installation.id);

  const filesRes = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/pulls/${pullNumber}/files`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    }
  );

  const files = await filesRes.json();
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
      console.log(allComments)

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
  const prompt = `
You are a senior engineer reviewing a pull request.

Only report serious:
- Bugs
- Security issues
- Performance problems

Ignore style and formatting.

Diff:
${file.patch}

THE OUTPUT MUST ONLY BE JSON!

E.g.
[
  { "line": number, "comment": "text" }
]
`;

  try {
    const response = await llm.invoke(prompt);
    return JSON.parse(response.content);
  } catch (err) {
    console.error("LLM returned invalid JSON", err);
    return [];
  }
}

async function getInstallationToken(installationId) {

  const appJwt = jwt.sign(
    {
      iat: Math.floor(Date.now() / 1000) - 60,
      exp: Math.floor(Date.now() / 1000) + 600,
      iss: appId,
    },
    privateKey,
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

async function postReviewComments({ token, owner, repo, pullNumber, commitId, comments }) {
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
    console.error("Review error:", err);
    throw new Error(`Failed to post review: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  console.log("Review response:", data);
  return data;
}
