import { MongoDBAtlasVectorSearch } from "@langchain/mongodb"
import { MongoClient } from "mongodb";
import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});

let vectorStore = null;

const getVectorStore = async () => {
  if (vectorStore) return vectorStore;

  const embeddings = new OpenAIEmbeddings({
    model: process.env.OPENAI_EMBEDDING_MODEL
  });
  const client = new MongoClient(process.env.MONGODB_ATLAS_URI);
  const collection = client
    .db(process.env.MONGODB_ATLAS_DB_NAME)
    .collection(process.env.MONGODB_ATLAS_COLLECTION_NAME);

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
    const vectorStore = await getVectorStore();
    const retrievedDocs = await vectorStore.similaritySearch(query, 2);
    const serialized = retrievedDocs
      .map(
        (doc) => `Source: ${doc.metadata.source}\nContent: ${doc.pageContent}`
      )
      .join("\n");
    return [serialized, retrievedDocs];
  },
  {
    name: "retrieve",
    description: "Retrieve internal information related to a query.",
    schema: z.object({ query: z.string() }),
    responseFormat: "content_and_artifact",
  }
);

export async function splitAndStoreDocuments(docs) {
  const allSplits = await splitter.splitDocuments(docs);
  const vectorStore = await getVectorStore();
  await vectorStore.addDocuments(allSplits);
}
