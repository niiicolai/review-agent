import { MultiServerMCPClient } from "@langchain/mcp-adapters";  

const mcpClient = new MultiServerMCPClient({  
    openai_documentation: {
        transport: "http",
        url: "https://developers.openai.com/mcp",
    },
});

export const tools = await mcpClient.getTools();  
