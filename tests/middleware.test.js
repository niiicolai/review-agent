import 'dotenv/config';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { trimMessagesSafely, createDeleteOldMessagesMiddleware } from '../src/agent/middleware.js';
import { AIMessage, HumanMessage, ToolMessage } from 'langchain';

describe('middleware.js', () => {
  describe('trimMessagesSafely', () => {
    it('should return same messages if under limit', () => {
      const messages = [
        new HumanMessage('Hello'),
        new AIMessage('Hi there'),
      ];
      const result = trimMessagesSafely(messages, 2);
      expect(result).toHaveLength(2);
    });

    it('should trim user+assistant pairs without tool calls', () => {
      const messages = [
        new HumanMessage('Hello'),
        new AIMessage('Hi there'),
        new HumanMessage('Second'),
        new AIMessage('Response'),
      ];
      const result = trimMessagesSafely(messages, 2);
      expect(result.length).toBeLessThanOrEqual(2);
    });

    it('should handle messages with tool calls', () => {
      const messages = [
        new HumanMessage('Hello'),
        new AIMessage('Using tool', { tool_calls: [{ name: 'test' }] }),
        new ToolMessage('Tool result'),
        new AIMessage('Response after tool'),
        new HumanMessage('New user message'),
        new AIMessage('New assistant'),
      ];
      const result = trimMessagesSafely(messages, 2);
      expect(result.length).toBeLessThanOrEqual(2);
    });

    it('should not trim if pattern does not match', () => {
      const messages = [
        new AIMessage('Just assistant'),
        new HumanMessage('Just user'),
      ];
      const result = trimMessagesSafely(messages, 2);
      expect(result).toHaveLength(2);
    });
  });

  describe('createDeleteOldMessagesMiddleware', () => {
    beforeEach(() => {
      vi.stubEnv('SHORT_TERM_MEMORY_MAX_MESSAGES', '2');
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('should return trimmed messages', async () => {
      const state = {
        messages: [
          new HumanMessage('Hello'),
          new AIMessage('Hi'),
          new HumanMessage('Again'),
          new AIMessage('Again'),
        ]
      };

      const result = createDeleteOldMessagesMiddleware(state, 2);
      
      expect(result).toBeDefined();
      expect(result.messages.length).toBeLessThanOrEqual(2);
    });

    it('should not modify if under limit', async () => {
      const state = {
        messages: [
          new HumanMessage('Hello'),
          new AIMessage('Hi'),
        ]
      };

      const result = createDeleteOldMessagesMiddleware(state, 2);
      
      expect(result).toBeUndefined();
    });
  });
});
