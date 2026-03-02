import fs from "fs";
import path from "path";

const PROMPTS_DIR = path.join(process.cwd(), "src", "prompts");
const cachedPrompts = {};

export function loadPrompt(name, variables = {}) {
  let prompt;

  if (cachedPrompts[name]) {
    prompt = cachedPrompts[name];
  } else {
    const filePath = path.join(PROMPTS_DIR, `${name}.md`);
    prompt = fs.readFileSync(filePath, "utf8");
    cachedPrompts[name] = prompt;
  }

  for (const [key, value] of Object.entries(variables)) {
    prompt = prompt.replace(`<INSERT-${key.toUpperCase()}>`, value);
  }

  return prompt;
}
