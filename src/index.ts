#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const SERVER_URL = (process.env.KEYORIX_SERVER || "").replace(/\/$/, "");
let TOKEN = process.env.KEYORIX_TOKEN || "";
if (!SERVER_URL) { console.error("KEYORIX_SERVER is required"); process.exit(1); }

async function apiGet(path: string): Promise<any> {
  const res = await fetch(SERVER_URL + path, { headers: { Authorization: "Bearer " + TOKEN } });
  if (!res.ok) throw new Error("HTTP " + res.status + ": " + await res.text());
  return res.json();
}
async function apiPost(path: string, body: unknown): Promise<any> {
  const res = await fetch(SERVER_URL + path, { method: "POST", headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error("HTTP " + res.status + ": " + await res.text());
  return res.json();
}
async function apiDelete(path: string): Promise<any> {
  const res = await fetch(SERVER_URL + path, { method: "DELETE", headers: { Authorization: "Bearer " + TOKEN } });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.status === 204 ? { success: true } : res.json();
}

// ── Rate limiter ──────────────────────────────────────────────────────────────
const rateLimiter = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 60;      // max requests
const RATE_LIMIT_WINDOW = 60000; // per 60 seconds

function checkRateLimit(identity: string): boolean {
  const now = Date.now();
  const entry = rateLimiter.get(identity);
  if (!entry || now > entry.resetAt) {
    rateLimiter.set(identity, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimiter.entries()) {
    if (now > entry.resetAt) rateLimiter.delete(key);
  }
}, 5 * 60 * 1000);

const server = new Server({ name: "keyorix-mcp", version: "0.1.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: "list_secrets", description: "List secret metadata (names, types, environments). Returns metadata only — use get_secret to retrieve a value.", inputSchema: { type: "object", properties: { environment: { type: "string" } } } },
    { name: "get_secret", description: "Get the value of a secret by name.", inputSchema: { type: "object", properties: { name: { type: "string" }, environment: { type: "string" } }, required: ["name"] } },
    { name: "create_secret", description: "Create a new secret.", inputSchema: { type: "object", properties: { name: { type: "string" }, value: { type: "string" }, environment_id: { type: "number" }, type: { type: "string" } }, required: ["name", "value"] } },
    { name: "delete_secret", description: "Delete a secret by ID.", inputSchema: { type: "object", properties: { id: { type: "number" } }, required: ["id"] } },
    { name: "list_environments", description: "List all environments.", inputSchema: { type: "object", properties: {} } },
    { name: "get_stats", description: "Get dashboard stats.", inputSchema: { type: "object", properties: {} } },
    { name: "list_audit_events", description: "List recent audit events.", inputSchema: { type: "object", properties: { limit: { type: "number" } } } },
    { name: "list_users", description: "List all users.", inputSchema: { type: "object", properties: {} } },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  // Rate limit by token (60 requests per minute per client)
  const identity = TOKEN.slice(0, 16) || "anonymous";
  if (!checkRateLimit(identity)) {
    return {
      content: [{ type: "text", text: "Rate limit exceeded. Maximum 60 requests per minute." }],
      isError: true,
    };
  }
  try {
    switch (name) {
      case "list_secrets": {
        const env = (args as any).environment;
        const path = env ? "/api/v1/secrets?environment=" + encodeURIComponent(env) : "/api/v1/secrets";
        const data: any = await apiGet(path);
        const secrets = data.data?.secrets || [];
        // Return metadata only — never include secret values
        const metadata = secrets.map((s: any) => ({
          id: s.ID,
          name: s.Name,
          type: s.Type,
          environment: s.environment_name,
          namespace: s.namespace_name,
          created_at: s.CreatedAt,
          is_shared: s.IsShared,
        }));
        return { content: [{ type: "text", text: metadata.length === 0 ? "No secrets found." : JSON.stringify(metadata, null, 2) }] };
      }
      case "get_secret": {
        const { name: secretName, environment } = args as any;
        const path = environment ? "/api/v1/secrets?environment=" + encodeURIComponent(environment) : "/api/v1/secrets";
        const data: any = await apiGet(path);
        const secret = (data.data?.secrets || []).find((s: any) => s.Name === secretName);
        if (!secret) return { content: [{ type: "text", text: "Secret not found: " + secretName }] };
        const valueData: any = await apiGet("/api/v1/secrets/" + secret.ID + "?include_value=true");
        return { content: [{ type: "text", text: "Secret: " + secretName + "\nValue: " + (valueData.data?.value || "(no value)") }] };
      }
      case "create_secret": {
        const { name: n, value, environment_id = 1, type = "generic" } = args as any;
        const data: any = await apiPost("/api/v1/secrets", { name: n, value, namespace_id: 1, zone_id: 1, environment_id, type });
        return { content: [{ type: "text", text: "Created: " + data.data?.Name + " (ID: " + data.data?.ID + ")" }] };
      }
      case "delete_secret": {
        const { id } = args as any;
        await apiDelete("/api/v1/secrets/" + id);
        return { content: [{ type: "text", text: "Secret " + id + " deleted." }] };
      }
      case "list_environments": {
        const data: any = await apiGet("/api/v1/environments");
        return { content: [{ type: "text", text: JSON.stringify(data.data, null, 2) }] };
      }
      case "get_stats": {
        const data: any = await apiGet("/api/v1/dashboard/stats");
        return { content: [{ type: "text", text: JSON.stringify(data.data, null, 2) }] };
      }
      case "list_audit_events": {
        const limit = (args as any).limit || 20;
        const data: any = await apiGet("/api/v1/audit?limit=" + limit);
        return { content: [{ type: "text", text: JSON.stringify(data.data, null, 2) }] };
      }
      case "list_users": {
        const data: any = await apiGet("/api/v1/users");
        return { content: [{ type: "text", text: JSON.stringify(data.data, null, 2) }] };
      }
      default: return { content: [{ type: "text", text: "Unknown tool: " + name }] };
    }
  } catch (err) {
    return { content: [{ type: "text", text: "Error: " + (err instanceof Error ? err.message : String(err)) }], isError: true };
  }
});

async function main() {
  if (!TOKEN) {
    const u = process.env.KEYORIX_USERNAME, p = process.env.KEYORIX_PASSWORD;
    if (u && p) {
      const res = await fetch(SERVER_URL + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: u, password: p }) });
      const d: any = await res.json();
      TOKEN = d.data.token;
    } else { console.error("KEYORIX_TOKEN or KEYORIX_USERNAME+KEYORIX_PASSWORD required"); process.exit(1); }
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Keyorix MCP server running. Connected to: " + SERVER_URL);
}

main().catch(err => { console.error(err); process.exit(1); });
