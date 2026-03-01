# Review Agent

AI-powered GitHub Pull Request reviewer and comment responder bot.

## Features

- **Automated PR Reviews** - Analyzes pull request diffs using LLM and posts review comments
- **Comment Replies** - Responds to mentions in issues/PRs using AI
- **MCP Client Support** - Connect the agent to documentation MCP servers to get updated information
- **Short-term Memory** - The agent implements a short term memory with PR and Issue number filtering

## Requirements

- Node.js 20+
- Redis
- OpenAI API key (or Ollama for local models)
- GitHub App credentials

## Setup

### 1. Create a GitHub App

1. Go to [GitHub Developer Settings](https://github.com/settings/apps/new)
2. Set the following:
   - **Homepage URL**: Your app's URL
   - **Webhook URL**: Your server URL + `/webhook-event`
   - **Webhook secret**: Generate using `npm run generate:secret`
3. **Permissions**:
   - Pull requests: Read & Write
   - Contents: Read
   - Issues: Read & Write
   - Issue comments: Read & Write
4. **Subscribe to events**:
   - Pull request
   - Issue comment
5. Install the app on your repositories

### 2. Configure Environment

Create a `.env` file:

```bash
# Required
REDIS_URL=redis://localhost:6379
GITHUB_APP_ID=your_app_id
GITHUB_WEBHOOK_SECRET=your_webhook_secret
OPENAI_API_KEY=your_openai_key

# Optional
WEB_PORT=3000                        # HTTP server port
ENABLE_MCP_CLIENT=1                  # Enable MCP client tools
ENABLE_SHORT_MEMORY=1                # Enable short memory
SHORT_MEMORY_MAX_MESSAGES=2          # Set short memory max messages
GITHUB_BOT_HANDLE=your_bot_username  # Bot will respond to @mentions
OLLAMA_URL=http://localhost:11434    # Use local Ollama instead of OpenAI
OLLAMA_MODEL=llama3                  # Ollama model name
LOG_LEVEL=info
```

### 3. Add Private Key

Place your GitHub App private key (`private-key.pem`) in the project root.

## Development

```bash
# Install dependencies
npm install

# Run webhook server
npm run webhook

# Run worker (separate terminal)
npm run worker
```

## Docker

```bash
# Build and run with Docker Compose
docker-compose up --build
```

This starts:
- `webhook` - HTTP server on port 3000
- `worker` - Queue processor
- `redis` - Message broker

## GitHub Pages

The documentation site is generated from this README.md and hosted at `https://niiicolai.github.io/review-agent/`

### Testing Locally

```bash
npm run serve:docs
```

Then open `http://localhost:3000` in your browser.

## Architecture

```
GitHub Webhook → Webhook Server → Redis Queue → Worker → GitHub API
                     ↓                                   ↓
               Health Check                         LLM Review
```

### Key Files

- `webhook.js` - Express server handling GitHub webhooks
- `worker.js` - BullMQ worker processing queue jobs
- `src/jobs/processPr.js` - PR review logic
- `src/jobs/processComment.js` - Comment reply logic
- `src/services/github_service.js` - GitHub API interactions
- `src/prompts/` - LLM prompt templates

## Customization

### Adding New File Extensions

Configure which file types to review using the `GITHUB_FILE_EXTENSIONS` environment variable (comma-separated):

```bash
# Default: js,ts,py,go,java,tsx,rs
GITHUB_FILE_EXTENSIONS=js,ts,py,go,java,tsx,rs,ruby,cpp
```

### Switching LLM Provider

The LLM is configured in `src/agent/llm.js`. By default, it uses OpenAI. To use Ollama instead:

1. Uncomment the `ChatOllama` block in `src/agent/llm.js`
2. Comment out the `ChatOpenAI` block
3. Ensure `OLLAMA_URL` and `OLLAMA_MODEL` are set in your `.env` file

```js
export const llm = new ChatOllama({
    baseUrl: process.env.OLLAMA_URL,
    model: process.env.OLLAMA_MODEL,
    temperature: 0,
    maxRetries: 2,
});
```

### Adding MCP Servers

The agent can connect to MCP (Model Context Protocol) servers to access external tools and documentation. Edit `src/agent/mcpClient.js`:

```js
import { MultiServerMCPClient } from "@langchain/mcp-adapters";  

const mcpClient = new MultiServerMCPClient({  
    // Add your MCP servers here
    server_name: {
        transport: "http",  // or "stdio" for local commands
        url: "http://localhost:3001",
        // For stdio transport:
        // command: "npx",
        // args: ["-y", "@some/mcp-server"],
    },
});

export const tools = await mcpClient.getTools();  
```

The tools from your MCP servers will be automatically available to the LLM during PR reviews.
