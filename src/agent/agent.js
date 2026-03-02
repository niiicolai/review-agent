import { MemorySaver } from "@langchain/langgraph";
import { createAgent, createMiddleware } from "langchain";
import { tools as mcpTools } from "./mcpClient.js";
import { searchCode, getFileContent } from "./tools.js";
import { model } from "./llm.js";
import logger from "../config/logger.js";
import { tokenTrackingMiddleware, toolLoggerMiddleware, createDeleteOldMessagesMiddleware } from "./middleware.js";

const middleware = [];
const tools = [];
const options = { model, middleware, tools, recursionLimit: 10 };

const ENABLE_MCP_CLIENT = parseInt(process.env.ENABLE_MCP_CLIENT ?? 0) === 1;
const ENABLE_SEARCH_TOOLS = parseInt(process.env.ENABLE_SEARCH_TOOLS ?? 1) === 1;
const ENABLE_SHORT_TERM_MEMORY = parseInt(process.env.ENABLE_SHORT_TERM_MEMORY ?? 0) === 1;
const SHORT_TERM_MEMORY_MAX_MESSAGES = parseInt(process.env.SHORT_TERM_MEMORY_MAX_MESSAGES ?? 2);
const BOT_HANDLE = process.env.GITHUB_BOT_HANDLE;

if (ENABLE_SEARCH_TOOLS) {
  tools.push(searchCode, getFileContent);
}

if (ENABLE_MCP_CLIENT) {
  tools.push(...mcpTools);
}

middleware.push(createMiddleware({ name: "TokenTracking", afterModel: tokenTrackingMiddleware }));
middleware.push(createMiddleware({ name: "ToolLogger", afterModel: toolLoggerMiddleware }));

if (ENABLE_SHORT_TERM_MEMORY) {
  options.checkpointer = new MemorySaver();
  middleware.push(createMiddleware({ name: "DeleteOldMessages", beforeModel: createDeleteOldMessagesMiddleware }));
}

logger.info({
  mcp_client_enabled: ENABLE_MCP_CLIENT,
  search_tools_enabled: ENABLE_SEARCH_TOOLS,
  short_term_memory_enabled: ENABLE_SHORT_TERM_MEMORY,
  short_term_memory_max_message: SHORT_TERM_MEMORY_MAX_MESSAGES,
  github_handle: BOT_HANDLE,
  available_tools: tools.map(t => t.name),
}, "Agent Settings");

export const agent = createAgent(options);
