import { MemorySaver } from "@langchain/langgraph";
import { createAgent, createMiddleware } from "langchain";
import { RemoveMessage } from "@langchain/core/messages";
import { tools as mcpTools } from "./mcpClient.js";
import { searchCode, getFileContent } from "./tools.js";
import { model } from "./llm.js";
import logger from "../config/logger.js";
import { addTokens } from "../config/tokens.js";

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

const tokenTrackingMiddleware = createMiddleware({
  name: "TokenTracking",
  afterModel: async (state) => {
    const lastMessage = state.messages[state.messages.length - 1];
    const usage = lastMessage?.response_metadata?.usage;
    if (usage) {
      await addTokens(usage.completion_tokens || 0, usage.prompt_tokens || 0);
      logger.info({ total_tokens: usage.total_tokens }, "Token usage tracked");
    }
    return;
  },
});
middleware.push(tokenTrackingMiddleware);

const toolLoggerMiddleware = createMiddleware({
  name: "ToolLogger",
  afterAgent: (state) => {
    for (const msg of state.messages) {
      if (msg.role === "tool") {
        logger.info({ tool_call_id: msg.tool_call_id, result: msg.content?.slice(0, 300) }, "Tool result");
      }
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          logger.info({ tool: tc.name, args: tc.args }, "Agent invoked tool");
        }
      }
    }
    return;
  },
});
middleware.push(toolLoggerMiddleware);

if (ENABLE_SHORT_TERM_MEMORY) {
  function trimMessagesSafely(messages, maxMessages) {
    if (messages.length <= maxMessages) return messages;

    const trimmed = [...messages];

    while (trimmed.length > maxMessages) {
      const first = trimmed[0];
      const second = trimmed[1];

      if (
        first?.role === "user" &&
        second?.role === "assistant" &&
        !second.tool_calls
      ) {
        trimmed.splice(0, 2);
        continue;
      }

      if (
        first?.role === "user" &&
        second?.role === "assistant" &&
        second.tool_calls
      ) {
        trimmed.splice(0, 4);
        continue;
      }
      break;
    }

    return trimmed;
  }

  const deleteOldMessages = createMiddleware({
    name: "DeleteOldMessages",
    beforeModel: (state) => {
      const messages = state.messages;

      if (messages.length <= SHORT_TERM_MEMORY_MAX_MESSAGES) return;

      const trimmed = trimMessagesSafely(messages);

      return { messages: trimmed };
    }
  });

  options.checkpointer = new MemorySaver();
  middleware.push(deleteOldMessages);
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
