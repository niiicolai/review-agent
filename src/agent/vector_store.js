import { MongoDBAtlasVectorSearch } from "@langchain/mongodb"
import { MongoClient } from "mongodb";
import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import logger from "../config/logger.js";

const ENABLE_RAG_TOOL = parseInt(process.env.ENABLE_RAG_TOOL ?? 0) === 1;
const OPENAI_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const MONGODB_ATLAS_URI = process.env.MONGODB_ATLAS_URI;
const MONGODB_ATLAS_DB_NAME = process.env.MONGODB_ATLAS_DB_NAME;
const MONGODB_ATLAS_COLLECTION_NAME = process.env.MONGODB_ATLAS_COLLECTION_NAME;

if (ENABLE_RAG_TOOL && (!OPENAI_EMBEDDING_MODEL || !MONGODB_ATLAS_URI || !MONGODB_ATLAS_DB_NAME || !MONGODB_ATLAS_COLLECTION_NAME)) {
  logger.error({
    OPENAI_EMBEDDING_MODEL,
    MONGODB_ATLAS_URI,
    MONGODB_ATLAS_DB_NAME,
    MONGODB_ATLAS_COLLECTION_NAME,
  }, "An environment variable is missing for the RAG implementation");
}

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});

let vectorStore = null;

const getVectorStore = async () => {
  if (vectorStore) return vectorStore;
  const embeddings = new OpenAIEmbeddings({
    model: OPENAI_EMBEDDING_MODEL
  });
  const client = new MongoClient(MONGODB_ATLAS_URI);
  const collection = client
    .db(MONGODB_ATLAS_DB_NAME)
    .collection(MONGODB_ATLAS_COLLECTION_NAME);

  vectorStore = new MongoDBAtlasVectorSearch(embeddings, {
    collection: collection,
    indexName: "vector_index",
    textKey: "text",
    embeddingKey: "embedding",
  });

  return vectorStore;
}

export const retrieve = tool(
  async ({ query }) => {
    try {
      const vectorStore = await getVectorStore();
      logger.info({ query }, "RAG: Performing similarity search");
      
      const retrievedDocs = await vectorStore.similaritySearch(query, 2);
      
      logger.info({ numDocs: retrievedDocs.length }, "RAG: Retrieved documents");
      
      if (retrievedDocs.length === 0) {
        return "No relevant documents found.";
      }
      
      const serialized = retrievedDocs
        .map(
          (doc) => `Source: ${doc.metadata.source}\nContent: ${doc.pageContent}`
        )
        .join("\n");
      return [serialized, retrievedDocs];
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, "RAG: Error retrieving documents");
      return `Error retrieving documents: ${error.message}`;
    }
  },
  {
    name: "retrieve",
    description: "Retrieve internal information related to a query.",
    schema: z.object({ query: z.string() }),
    responseFormat: "content_and_artifact",
  }
);

export async function splitAndStoreDocuments(docs) {
  logger.info({ numDocs: docs.length }, "RAG: Splitting documents");
  const allSplits = await splitter.splitDocuments(docs);
  logger.info({ numSplits: allSplits.length }, "RAG: Document splits");
  
  const vectorStore = await getVectorStore();
  await vectorStore.addDocuments(allSplits);
  logger.info({ numStored: allSplits.length }, "RAG: Documents stored");
}
