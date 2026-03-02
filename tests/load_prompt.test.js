import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadPrompt } from '../src/prompts/_load_prompt.js';

describe('loadPrompt', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('should load a prompt file', () => {
        const prompt = loadPrompt('review-pr');
        expect(prompt).toBeDefined();
        expect(typeof prompt).toBe('string');
        expect(prompt.length).toBeGreaterThan(0);
    });

    it('should replace variables in the prompt', () => {
        const prompt = loadPrompt('review-pr', { DIFF: 'test diff content' });
        expect(prompt).toContain('test diff content');
    });

    it('should replace multiple variables', () => {
        const prompt = loadPrompt('review-pr', { 
            DIFF: 'diff1',
        });
        expect(prompt).toContain('diff1');
    });

    it('should cache loaded prompts', () => {
        const prompt1 = loadPrompt('review-pr');
        const prompt2 = loadPrompt('review-pr');
        expect(prompt1).toBe(prompt2);
    });
});
