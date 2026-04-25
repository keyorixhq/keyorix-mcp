#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const SERVER_URL = (process.env.KEYORIX_SERVER || "").replace(/\/$/, "");
let TOKEN = process.env.KEYORIX_TOKEN || "";
if (!SERVER_URL) { console.error("KEYORIX_SERVER is required"); process.exit(1); }

async function apiGet(path: string): Promise<any> {
