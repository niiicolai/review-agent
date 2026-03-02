import { addTokens } from "../config/tokens.js";
import logger from "../config/logger.js";

const SHORT_TERM_MEMORY_MAX_MESSAGES = parseInt(process.env.SHORT_TERM_MEMORY_MAX_MESSAGES ?? 2);

export async function tokenTrackingMiddleware(state) {
  const lastMessage = state.messages[state.messages.length - 1];
  const usage = lastMessage?.response_metadata?.usage;
  if (usage) {
    await addTokens(usage.completion_tokens || 0, usage.prompt_tokens || 0);
    logger.info({ total_tokens: usage.total_tokens }, "Token usage tracked");
  }
  return;
};

export function toolLoggerMiddleware(state) {
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
};

export function trimMessagesSafely(messages, maxMessages) {
  if (messages.length <= maxMessages) return messages;

  const trimmed = [...messages];

  while (trimmed.length > maxMessages) {
    const first = trimmed[0];
    const second = trimmed[1];
    const firstType = first?._getType?.() ?? first?.type;
    const secondType = second?._getType?.() ?? second?.type;

    if (
      firstType === "human" &&
      secondType === "ai" &&
      !second.tool_calls
    ) {
      trimmed.splice(0, 2);
      continue;
    }

    if (
      firstType === "human" &&
      secondType === "ai" &&
      second.tool_calls
    ) {
      trimmed.splice(0, 4);
      continue;
    }
    break;
  }

  return trimmed;
}

export function createDeleteOldMessagesMiddleware(state) {
  const maxMessages = SHORT_TERM_MEMORY_MAX_MESSAGES;
  const messages = state.messages;
  const length = messages?.length || 0;
  if (length <= maxMessages) return;
  const trimmed = trimMessagesSafely(messages, maxMessages);
  return { messages: trimmed };
}
