import { createAgent, createMiddleware } from "langchain";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { tools as mcpTools } from "./mcp_client.js";
import { searchCode, getFileContent } from "./tools.js";
import { retrieve } from "./vector_store.js";
import { model } from "./llm.js";
import logger from "../config/logger.js";
import { 
  tokenTrackingMiddleware, 
  toolLoggerMiddleware, 
  createDeleteOldMessagesMiddleware 
} from "./middleware.js";

let checkpointer = null;
function getCheckpointer() {
  if (!checkpointer) {
    checkpointer = SqliteSaver.fromConnString(
      process.env.SQLITE_CHECKPOINT_PATH || "./checkpoints.db"
    );
  }
  return checkpointer;
}

const middleware = [];
const tools = [];
const options = { model, middleware, tools, recursionLimit: 10 };

const ENABLE_RAG_TOOL = parseInt(process.env.ENABLE_RAG_TOOL ?? 0) === 1;
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

if (ENABLE_RAG_TOOL) {
  tools.push(retrieve);
}

middleware.push(createMiddleware({ 
  name: "TokenTracking", 
  afterModel: tokenTrackingMiddleware 
}));

if (tools.length > 0) {
  middleware.push(createMiddleware({ 
    name: "ToolLogger", 
    afterModel: toolLoggerMiddleware 
  }));
}

if (ENABLE_SHORT_TERM_MEMORY) {
  options.checkpointer = getCheckpointer();
  middleware.push(createMiddleware({ 
    name: "DeleteOldMessages", 
    beforeModel: createDeleteOldMessagesMiddleware 
  }));
}

logger.info({
  rag_enabled: ENABLE_RAG_TOOL,
  mcp_client_enabled: ENABLE_MCP_CLIENT,
  search_tools_enabled: ENABLE_SEARCH_TOOLS,
  short_term_memory_enabled: ENABLE_SHORT_TERM_MEMORY,
  short_term_memory_max_message: SHORT_TERM_MEMORY_MAX_MESSAGES,
  github_handle: BOT_HANDLE,
  available_tools: tools.map(t => t.name),
}, "Agent Settings");

export const agent = createAgent(options);
