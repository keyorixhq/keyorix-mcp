# keyorix-mcp

MCP (Model Context Protocol) server for Keyorix — allows Claude and other AI assistants to manage secrets via natural language.

## What this enables

Ask Claude things like:
- "List all secrets in production"
- "Create a secret called db-password with value changeme in production"  
- "Show me all audit events from the last hour"
- "Who has access to the api-key secret?"
- "Delete secret ID 5"

## Install

```bash
npm install -g keyorix-mcp
```

## Configure in Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "keyorix": {
      "command": "keyorix-mcp",
      "env": {
        "KEYORIX_SERVER": "http://your-server:8080",
        "KEYORIX_TOKEN": "your-session-token"
      }
    }
  }
}
```

Or authenticate with username/password instead of token:

```json
{
  "mcpServers": {
    "keyorix": {
      "command": "keyorix-mcp",
      "env": {
        "KEYORIX_SERVER": "http://your-server:8080",
        "KEYORIX_USERNAME": "admin",
        "KEYORIX_PASSWORD": "your-password"
      }
    }
  }
}
```

## Available tools

| Tool | Description |
|---|---|
| `list_secrets` | List all secrets, optionally filtered by environment |
| `get_secret` | Get the value of a secret by name |
| `create_secret` | Create a new secret |
| `delete_secret` | Delete a secret by ID |
| `list_environments` | List available environments |
| `get_stats` | Dashboard statistics |
| `list_audit_events` | Recent audit log |
| `list_users` | List all users |

## Requirements

- Node.js 18+
- Keyorix server v0.1.0+

## License

AGPL-3.0

npm install -g keyorix-mcp

## Configure in Claude Desktop

Add to ~/Library/Application Support/Claude/claude_desktop_config.json

KEYORIX_SERVER=http://your-server:8080
KEYORIX_TOKEN=your-session-token

Or use KEYORIX_USERNAME and KEYORIX_PASSWORD instead of token.

## Available tools

list_secrets, get_secret, create_secret, delete_secret, list_environments, get_stats, list_audit_events, list_users

## Requirements: Node.js 18+, Keyorix server v0.1.0+

## License: AGPL-3.0
