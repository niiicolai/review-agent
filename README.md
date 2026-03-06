<h1 align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=0:11a8c7,100:5e17eb&height=300&section=header&text=CoPR%20Agent&fontSize=80&animation=fadeIn&fontAlignY=35" />
</h1>

<div align="center">

[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/niiicolai/copr-agent/ci.yml?branch=main)](https://github.com/niiicolai/copr-agent/actions)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE.md)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org)


</div>

<br />

**CoPR Agent** is an AI-powered code review assistant that automatically reviews pull requests and replies to comments using LLMs.

<br />

## Why CoPR Agent?

- **Instant Feedback** - Every PR gets reviewed within seconds
- **Cost Effective** - Batch processing and token tracking keep costs under control
- **Flexible** - Use OpenAI, Ollama, or any LLM provider
- **Context Aware** - Connect MCP servers for up-to-date documentation
- **Private** - Runs on your infrastructure, your data stays yours
- **Availability** - Use in public & private repositories
- **Multi Repository** - Deploy one server to use across multiples repositories

<br />

## Quick Start

```bash
# Clone & install
git clone https://github.com/niiicolai/copr-agent.git
cd copr-agent
npm install

# Configure
cp .env.example .env
# Edit .env with your credentials

# Terminal 1
npm run worker

# Terminal 2
npm run webhook
```

<br />

## Features

### Automated PR Reviews
Analyzes pull request diffs and posts constructive feedback on bugs, security issues, and performance problems.

### Intelligent Comment Replies
Responds to @mentions in issues and PRs with context-aware answers powered by AI.

### MCP Integration
Connect to Model Context Protocol servers to give your agent access to up-to-date documentation and tools.

### Token Monitoring
Built-in Redis tracking shows exactly how many tokens you're spending.

### Code Search
The agent can search your codebase directly to find relevant code and answer questions about your project.

### RAG Support
Give the agent access to search a vector database for internal docs.

### Rate Limiting & Batching
Configure file limits and batch sizes to optimize API usage and avoid rate limits.

### Customizable
Configure the vector store, LLM, and embeddings models to suit your needs.

<br />

## Requirements

| Component | Version |
|-----------|---------|
| Node.js   | 20+     |
| Redis     | Latest  |
| LLM       | OpenAI / Ollama |

<br />


## Examples

### General Security Issues
![General security demo](/copr-agent/examples/general-security-demo.png)

### Get latest documentation using MCP
![Latest docs MCP demo](/copr-agent/examples/latest-docs-mcp-demo.png)

### Use internal business logic with RAG
![Internal docs RAG demo](/copr-agent/examples/internal-docs-rag-demo.png)

<br />

## Setup

### 1. Create a GitHub App

1. Go to [GitHub Developer Settings](https://github.com/settings/apps/new)
2. Configure:
   - **Homepage URL**: Your app's URL
   - **Webhook URL**: Your server URL + `/webhook-event`
   - **Webhook secret**: Add a secure custom secret
3. **Permissions**:
   - Pull requests: Read & Write
   - Contents: Read
   - Issues: Read & Write
   - Issue comments: Read & Write
4. **Subscribe to events**: Pull request, Issue comment
5. Install on your repositories

### 2. Environment Variables

```bash
# Redis
REDIS_URL=redis://localhost:6379

# Web server
WEB_PORT=3000
API_KEY=your_secure_key

# Logging
LOG_LEVEL=info

# OpenAI
OPENAI_API_KEY=sk-...

# Ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3

# GitHub
GITHUB_BOT_HANDLE=your_bot_username  # GitHub username of your bot app (to detect @mentions and avoid self-replies)
GITHUB_FILE_EXTENSIONS=js,ts,py,go,java,tsx,rs,ruby,cpp
GITHUB_APP_ID=your_app_id
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# Features
ENABLE_SHORT_TERM_MEMORY=1
ENABLE_SEARCH_TOOLS=1
ENABLE_MCP_CLIENT=1
ENABLE_RAG_TOOL=1

# Vector store (RAG)
MONGODB_ATLAS_URI=...
MONGODB_ATLAS_DB_NAME=..
MONGODB_ATLAS_COLLECTION_NAME=..
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Short-term memory
SHORT_TERM_MEMORY_MAX_MESSAGES=2
SQLITE_CHECKPOINT_PATH=./checkpoints.db

# Rate limiting
MAX_TOKENS_PER_BATCH=20000
MAX_FILES_TO_REVIEW=20
FILES_PER_BATCH=10

# Usage limiting
MAX_TOKENS_ALLOWED=100000
```

### 3. Add Private Key

Place your GitHub App private key (`private-key.pem`) in the project root or set `GITHUB_PRIVATE_KEY` to the key.

<br />

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────┐     ┌─────────┐     ┌─────────────┐
│   GitHub     ────▶   Webhook    ────▶   Redis   ────▶  Worker  ────▶  GitHub API  │
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

### RAG (Retrieval-Augmented Generation)
When `ENABLE_RAG_TOOL=1` is set, the agent can retrieve relevant context from a vector store to answer questions about your documentation, architecture, or any stored knowledge.

- **Use cases**: Answer questions about project docs, architecture decisions, coding standards, troubleshooting guides
- **Storage**: MongoDB Atlas Vector Search
- **Enable**:
```bash
ENABLE_RAG_TOOL=1  # default: disabled
```

#### Populating the Vector Store
Store your `.md` and `.txt` files in the vector store:

```bash
# Store a single file
npm run store:vectors -- ./docs/readme.md

# Store all files in a directory
npm run store:vectors -- ./docs
```

The script recursively scans for `.md` and `.txt` files, splits them into chunks, and stores them with source metadata.

### Short-Term Memory
When `ENABLE_SHORT_TERM_MEMORY=1` is set, the agent persists conversation history using SQLite. This allows the agent to maintain context across multiple interactions within the same thread.

- **Storage**: SQLite database (default: `./checkpoints.db`)
- **Purpose**: Enables stateful conversations by checkpointing the agent's conversation history

```bash
SQLITE_CHECKPOINT_PATH=./checkpoints.db  # optional, default location
ENABLE_SHORT_TERM_MEMORY=1
```

### MCP Servers
When `ENABLE_MCP_CLIENT=1` is set, the agent got access to tools provided by the specified MCP servers.

- **Purpose**: Enables the agent to get the latest documentation from various external and internal providers.

Enable/disable:
```bash
ENABLE_MCP_CLIENT=1  # default: disabled
```
```js
// src/agent/mcp_client.js
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

[See LICENSE.md](/LICENSE.md)

