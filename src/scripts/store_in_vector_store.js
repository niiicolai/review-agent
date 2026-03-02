import 'dotenv/config';
import { splitAndStoreDocuments } from "../agent/vector_store.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function getFiles(dirPath, extensions = [".md", ".txt"]) {
  const files = [];
  
  if (!fs.existsSync(dirPath)) {
    console.error(`Path does not exist: ${dirPath}`);
    process.exit(1);
  }

  const stat = fs.statSync(dirPath);

  if (stat.isFile()) {
    if (extensions.includes(path.extname(dirPath))) {
      files.push(dirPath);
    }
    return files;
  }

  function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile() && extensions.includes(path.extname(entry.name))) {
        files.push(fullPath);
      }
    }
  }

  walkDir(dirPath);
  return files;
}

async function main() {
  const targetPath = process.argv[2];

  if (!targetPath) {
    console.error("Usage: node store_in_vector_store.js <file-or-directory>");
    process.exit(1);
  }

  const absolutePath = path.isAbsolute(targetPath)
    ? targetPath
    : path.resolve(__dirname, "../../", targetPath);

  console.log(`Scanning: ${absolutePath}`);
  
  const files = await getFiles(absolutePath);
  
  if (files.length === 0) {
    console.log("No .md or .txt files found.");
    return;
  }

  console.log(`Found ${files.length} file(s)`);

  const documents = files.map((filePath) => {
    const content = fs.readFileSync(filePath, "utf-8");
    const relativePath = path.relative(process.cwd(), filePath);
    return {
      pageContent: content,
      metadata: { source: relativePath },
    };
  });

  console.log("Storing in vector store...");
  await splitAndStoreDocuments(documents);
  console.log("Done!");
  process.exit(0);
}

main();
