/**
 * Find more providers at: 
 * https://docs.langchain.com/oss/javascript/integrations/providers/all_providers
 */
import { ChatOllama } from "@langchain/ollama";
import { ChatOpenAI } from "@langchain/openai";

/*
export const llm = new ChatOllama({
    baseUrl: process.env.OLLAMA_URL,
    model: process.env.OLLAMA_MODEL,
    temperature: 0,
    maxRetries: 2,
});*/

export const llm = new ChatOpenAI({
  model: process.env.OPENAI_MODEL,
  temperature: 0,
});
