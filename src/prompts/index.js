import fs from "fs";
import path from "path";

const PROMPTS_DIR = path.join(process.cwd(), "src", "prompts");

export function loadPrompt(name, variables = {}) {
  const filePath = path.join(PROMPTS_DIR, `${name}.md`);
  let prompt = fs.readFileSync(filePath, "utf8");

  for (const [key, value] of Object.entries(variables)) {
    prompt = prompt.replace(`<INSERT-${key.toUpperCase()}>`, value);
  }

  return prompt;
}
