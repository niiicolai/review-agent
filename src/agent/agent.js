import { StateSchema, MemorySaver } from "@langchain/langgraph";
import { createAgent, createMiddleware } from "langchain";
import { tools } from "./mcpClient.js";
import { model } from "./llm.js";
import logger from "../config/logger.js";
import * as z from "zod";

const middleware = [];
const options = { model, middleware };

const ENABLE_MCP_CLIENT = parseInt(process.env.ENABLE_MCP_CLIENT ?? 0) === 1;
const ENABLE_SHORT_MEMORY = parseInt(process.env.ENABLE_SHORT_MEMORY ?? 0) === 1;
const SHORT_MEMORY_MAX_MESSAGES = parseInt(process.env.SHORT_MEMORY_MAX_MESSAGES ?? 2);
const BOT_HANDLE = process.env.GITHUB_BOT_HANDLE;

if (ENABLE_MCP_CLIENT) {
  options.tools = tools;
}

if (ENABLE_SHORT_MEMORY) {
  const deleteOldMessages = createMiddleware({
    name: "DeleteOldMessages",
    afterModel: (state) => {
      const messages = state.messages;
      if (messages.length > SHORT_MEMORY_MAX_MESSAGES) {
        return {
          messages: messages
            .slice(0, 2)
            .map((m) => new RemoveMessage({ id: m.id })),
        };
      }
      return;
    },
  });
  const checkpointer = new MemorySaver();
  const CustomState = new StateSchema({
    pullNumber: z.number(),
    issueNumber: z.number(),
  });
  const stateExtensionMiddleware = createMiddleware(
    { name: "StateExtension", stateSchema: CustomState }
  );

  options.checkpointer = checkpointer;
  middleware.push(stateExtensionMiddleware, deleteOldMessages);
}

logger.info({
  mcp_client_enabled: ENABLE_MCP_CLIENT,
  short_memory_enabled: ENABLE_SHORT_MEMORY,
  short_memory_max_message: SHORT_MEMORY_MAX_MESSAGES,
  github_handle: BOT_HANDLE,
}, "Agent Settings");

export const agent = createAgent(options);
