import 'dotenv/config';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractIssueNumber, parseLLMResponse, checkTokenLimit, filterAndBatchPRFiles } from '../src/utils/job_utils.js';
import { AIMessage } from 'langchain';
import * as tokensModule from '../src/config/tokens.js';

describe('jobUtils.js', () => {
  describe('extractIssueNumber', () => {
    it('should extract issue number from URL', () => {
      const url = 'https://api.github.com/repos/owner/repo/issues/123';
      expect(extractIssueNumber(url)).toBe('123');
    });

    it('should handle issue comment URLs', () => {
      const url = 'https://api.github.com/repos/owner/repo/issues/comments/789';
      expect(extractIssueNumber(url)).toBe('789');
    });
  });

  describe('parseLLMResponse', () => {
    it('should return content from AIMessage', () => {
      const response = {
        messages: [
          { type: 'human' },
          new AIMessage('Hello world'),
        ],
      };
      
      const result = parseLLMResponse(response);
      expect(result).toBe('Hello world');
    });

    it('should return null when no AIMessage', () => {
      const response = {
        messages: [
          { type: 'human', content: 'Hello' },
        ],
      };
      
      const result = parseLLMResponse(response);
      expect(result).toBeNull();
    });

    it('should return last AIMessage when multiple exist', () => {
      const response = {
        messages: [
          new AIMessage('First response'),
          new AIMessage('Last response'),
        ],
      };
      
      const result = parseLLMResponse(response);
      expect(result).toBe('Last response');
    });
  });

  describe('checkTokenLimit', () => {
    beforeEach(() => {
      vi.spyOn(tokensModule, 'getTokenCounts');
    });

    it('should allow when under limit', async () => {
      tokensModule.getTokenCounts.mockResolvedValue({ total: 100 });
      const result = await checkTokenLimit();
      expect(result.allowed).toBe(true);
      expect(result.tokens.total).toBe(100);
    });

    it('should deny when at or over limit', async () => {
      tokensModule.getTokenCounts.mockResolvedValue({ total: 1000000 });
      const result = await checkTokenLimit();
      expect(result.allowed).toBe(false);
    });
  });

  describe('filterAndBatchPRFiles', () => {
    it('should filter and batch files correctly', () => {
      const files = [
        { filename: 'test.js', status: 'added', patch: '...' },
        { filename: 'test.ts', status: 'modified', patch: '...' },
        { filename: 'test.py', status: 'removed', patch: null },
        { filename: 'test.txt', status: 'modified', patch: '...' },
      ];

      const result = filterAndBatchPRFiles(files, 10, 20);
      
      expect(result.filesToReview).toHaveLength(2);
      expect(result.batches).toHaveLength(1);
      expect(result.fileCount).toBe(2);
      expect(result.batchCount).toBe(1);
    });

    it('should create multiple batches when files exceed batch size', () => {
      const files = Array.from({ length: 25 }, (_, i) => ({
        filename: `test${i}.js`,
        status: 'modified',
        patch: '...',
      }));

      const result = filterAndBatchPRFiles(files, 10, 20);
      
      expect(result.filesToReview).toHaveLength(20);
      expect(result.batches).toHaveLength(2);
    });
  });
});
