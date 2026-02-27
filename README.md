# Review Agent

AI-powered GitHub Pull Request reviewer and comment responder bot.

## Features

- **Automated PR Reviews** - Analyzes pull request diffs using LLM and posts review comments
- **Comment Replies** - Responds to mentions in issues/PRs using AI
- **Production Ready** - Includes rate limiting, graceful shutdown, structured logging, and Docker support

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
WEB_PORT=3000
GITHUB_APP_HANDLE=your_bot_username  # Bot will respond to @mentions
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
