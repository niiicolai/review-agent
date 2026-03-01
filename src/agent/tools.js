import { tool } from "@langchain/core/tools";
import { getInstallationToken, searchCode as searchCodeApi, getFileContent as getFileContentApi } from "../services/github_service.js";
import logger from "../config/logger.js";
import { z } from "zod";

export const searchCode = tool(
  async ({ query }, { configurable }) => {
    try {
      const { owner, repo, installationId } = configurable;
      if (!owner || !repo || !installationId) {
        return "Error: Missing repository context (owner, repo, or installationId)";
      }

      const token = await getInstallationToken(installationId);
      const data = await searchCodeApi({ token, owner, repo, query });

      if (data.items.length === 0) {
        return "No results found.";
      }

      const results = data.items.slice(0, 5).map(item => ({
        path: item.path,
        url: item.html_url,
      }));

      return `Found ${data.total_count} results. Top matches:\n${results.map(r => `- ${r.path}: ${r.url}`).join("\n")}`;
    } catch (err) {
      logger.error({ err, query }, "Search code failed");
      return `Search error: ${err.message}`;
    }
  },
  {
    name: "search_code",
    description: "Search for code in the repository using GitHub's code search. Use this when you need to find relevant code, functions, or patterns in the codebase.",
    schema: z.object({
      query: z.string().describe("The search query"),
    }),
  }
);

export const getFileContent = tool(
  async ({ path }, { configurable }) => {
    try {
      const { owner, repo, installationId } = configurable;
      if (!owner || !repo || !installationId) {
        return "Error: Missing repository context (owner, repo, or installationId)";
      }

      const token = await getInstallationToken(installationId);
      const data = await getFileContentApi({ token, owner, repo, path });

      if (data.encoding === "base64") {
        const content = Buffer.from(data.content, "base64").toString("utf-8");
        return `File: ${data.path}\n\n${content}`;
      }

      return data.content;
    } catch (err) {
      logger.error({ err, path }, "Get file failed");
      return `Error: ${err.message}`;
    }
  },
  {
    name: "get_file_content",
    description: "Get the content of a specific file from the repository. Use this to read file contents when you need to examine code in detail.",
    schema: z.object({
      path: z.string().describe("File path in the repository"),
    }),
  }
);
