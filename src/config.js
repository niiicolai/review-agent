const requiredEnvVars = [
  'REDIS_URL',
  'GITHUB_APP_ID',
  'GITHUB_WEBHOOK_SECRET',
  'OLLAMA_URL',
  'OLLAMA_MODEL',
];

const optionalEnvVars = [
  'WEB_PORT',
  'OPENAI_API_KEY',
  'GITHUB_APP_HANDLE',
];

export function validateConfig() {
  const missing = requiredEnvVars.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const config = {};
  for (const v of requiredEnvVars) {
    config[v] = process.env[v];
  }
  for (const v of optionalEnvVars) {
    config[v] = process.env[v];
  }

  return config;
}
