<h1 align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=0:11a8c7,100:5e17eb&height=300&section=header&text=Review%20Agent&fontSize=80&animation=fadeIn&fontAlignY=35" />
</h1>

<div align="center">

[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/niiicolai/review-agent/ci.yml?branch=main)](https://github.com/niiicolai/review-agent/actions)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE.md)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org)


</div>

<br />

**Review Agent** is an AI-powered code review assistant that automatically reviews pull requests and replies to comments using LLMs. Think of it as an always-available senior engineer on your team.

<br />

## Why Review Agent?

- 🚀 **Instant Feedback** - Every PR gets reviewed within seconds
- 💰 **Cost Effective** - Batch processing and token tracking keep costs under control
- 🔌 **Flexible** - Use OpenAI, Ollama, or any LLM provider
- 🧠 **Context Aware** - Connect MCP servers for up-to-date documentation
- 🔒 **Private** - Runs on your infrastructure, your data stays yours

<br />

## Quick Start

```bash
# Clone & install
git clone https://github.com/niiicolai/review-agent.git
cd review-agent
npm install

# Configure
cp .env.example .env
# Edit .env with your credentials

# Run
docker-compose up --build
```

<br />

## Features

### 🤖 Automated PR Reviews
Analyzes pull request diffs and posts constructive feedback on bugs, security issues, and performance problems.

### 💬 Intelligent Comment Replies
Responds to @mentions in issues and PRs with context-aware answers powered by AI.

### 🔗 MCP Integration
Connect to Model Context Protocol servers to give your agent access to up-to-date documentation and tools.

### 📊 Token Monitoring
Built-in Redis tracking shows exactly how many tokens you're spending.

### 🔍 Code Search
The agent can search your codebase directly to find relevant code and answer questions about your project.

### ⚡ Rate Limiting & Batching
Configure file limits and batch sizes to optimize API usage and avoid rate limits.

<br />

## Requirements

| Component | Version |
|-----------|---------|
| Node.js   | 20+     |
| Redis     | Latest  |
| LLM       | OpenAI / Ollama |

<br />

## Setup

### 1. Create a GitHub App

1. Go to [GitHub Developer Settings](https://github.com/settings/apps/new)
2. Configure:
   - **Homepage URL**: Your app's URL
   - **Webhook URL**: Your server URL + `/webhook-event`
   - **Webhook secret**: `npm run generate:secret`
3. **Permissions**:
   - Pull requests: Read & Write
   - Contents: Read
   - Issues: Read & Write
   - Issue comments: Read & Write
4. **Subscribe to events**: Pull request, Issue comment
5. Install on your repositories

### 2. Environment Variables

```bash
# Required
REDIS_URL=redis://localhost:6379
GITHUB_APP_ID=your_app_id
GITHUB_WEBHOOK_SECRET=your_webhook_secret
OPENAI_API_KEY=sk-...

# Optional
WEB_PORT=3000
GITHUB_BOT_HANDLE=your_bot_username
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3
API_KEY=your_secure_key

# Features
ENABLE_MCP_CLIENT=1
ENABLE_SHORT_TERM_MEMORY=1

# Rate limiting
MAX_FILES_TO_REVIEW=20
FILES_PER_BATCH=10
```

### 3. Add Private Key

Place your GitHub App private key (`private-key.pem`) in the project root.

<br />

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────┐     ┌─────────┐     ┌─────────────┐
│   GitHub    │────▶│   Webhook   │────▶│  Redis  │────▶│ Worker  │────▶│  GitHub API │
│   Webhook   │     │   Server    │     │  Queue  │     │         │     │             │
└─────────────┘     └─────────────┘     └─────────┘     └─────────┘     └─────────────┘
                                                                                  │
                                                                                  ▼
                                                                           ┌─────────────┐
                                                                           │     LLM     │
                                                                           │   (GPT-4)   │
                                                                           └─────────────┘
```

<br />

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/tokens` | GET | Get token usage (requires `X-API-Key`) |
| `/tokens` | DELETE | Reset token counter |

```bash
# Check token usage
curl -H "X-API-Key: your_api_key" http://localhost:3000/tokens

# Reset counters
curl -X DELETE -H "X-API-Key: your_api_key" http://localhost:3000/tokens
```

<br />

## Customization

### File Extensions
```bash
GITHUB_FILE_EXTENSIONS=js,ts,py,go,java,tsx,rs,ruby
```

### Search Tools (Built-in)
The agent has built-in tools to search the codebase:

- `search_code` - Search for code across the repository
- `get_file_content` - Read file contents

Enable/disable:
```bash
ENABLE_SEARCH_TOOLS=1  # default: enabled
```

### MCP Servers
```js
// src/agent/mcpClient.js
const mcpClient = new MultiServerMCPClient({  
    server_name: {
        transport: "http",
        url: "http://localhost:3001",
    },
});
```

### Switching LLM Provider
The default uses OpenAI. To use Ollama instead:

```js
// src/agent/llm.js
import { ChatOllama } from "@langchain/ollama";

export const model = new ChatOllama({
    baseUrl: process.env.OLLAMA_URL,
    model: process.env.OLLAMA_MODEL,
    temperature: 0,
    maxRetries: 2,
});
```

<br />

## Contributing

Contributions are welcome! Feel free to open issues and pull requests.

<br />

## License

MIT
