/**
 * Find more providers at: 
 * https://docs.langchain.com/oss/javascript/integrations/providers/all_providers
 * 
 * OLLAMA Example:
 * import { ChatOllama } from "@langchain/ollama";
 * 
 * export const model = new ChatOllama({
 *  baseUrl: process.env.OLLAMA_URL,
 *  model: process.env.OLLAMA_MODEL,
 *  temperature: 0,
 *  maxRetries: 2,
 * });
 */

//
import { ChatOpenAI } from "@langchain/openai";
import logger from "../config/logger.js";


export const model = new ChatOpenAI({
  model: process.env.OPENAI_MODEL,
  temperature: 0,
  maxRetries: 2,
});

logger.info({
  model: model.model,
  temperature: model.temperature,
  maxRetries: model.maxRetries,
}, "Language Model");
