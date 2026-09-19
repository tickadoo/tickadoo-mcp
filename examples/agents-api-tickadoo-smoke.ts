/**
 * Agents API → tickadoo Public MCP smoke.
 *
 * Creates an OpenAI Agents API session with the public tickadoo MCP tool and
 * asks for a Lion King / London booking_url on www.tickadoo.com.
 *
 * Requires:
 *   - OPENAI_API_KEY (api.agents.read, api.agents.write, api.responses.write)
 *   - openai >= 7.15.0 (adds OpenAI-Beta: agents=v1 on beta.agents calls)
 *
 * CI/dev-only: run from the repo root after a full `npm install` (openai and
 * tsx are devDependencies). Production `npm install --omit=dev` is not
 * expected to run this smoke.
 *   export OPENAI_API_KEY="your-api-key"
 *   npm run smoke:agents-api
 *
 *   # or
 *   npx tsx examples/agents-api-tickadoo-smoke.ts
 *
 * The bare host https://mcp.tickadoo.com 404s — always use /mcp.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";

export const TICKADOO_MCP_URL = "https://mcp.tickadoo.com/mcp";
export const TICKADOO_BOOKING_HOST = "www.tickadoo.com";

export const MISSING_CREDENTIAL_GUIDANCE = [
  "The Agents API credential is not set.",
  "Francis/Mark must add OPENAI_API_KEY to tickadoo-mcp repo secrets or ensure the org secret is visible to this repo.",
  "Do not invent keys. Do not reuse Cloudflare ads keys.",
].join("\n");

/** Exact MCP tool shape from docs/openai-agents-api.md — service-origin, required. */
export const TICKADOO_MCP_TOOL = {
  type: "mcp" as const,
  server_label: "tickadoo",
  transport: {
    type: "http" as const,
    server_url: TICKADOO_MCP_URL,
  },
  connection_origin: "service" as const,
  required: true,
};

export const SMOKE_INSTRUCTIONS =
  "Use only the tickadoo MCP tools. Search London for The Lion King and return a www.tickadoo.com booking_url. Do not collect payment or invent a checkout tool. Do not use web search.";

export const SMOKE_INPUT =
  "Find The Lion King in London and return one official tickadoo booking_url on www.tickadoo.com. Quote the booking_url exactly.";

const DEFAULT_MODEL = "gpt-6-astra";

export class MissingAgentsCredentialError extends Error {
  constructor() {
    super(MISSING_CREDENTIAL_GUIDANCE);
    this.name = "MissingAgentsCredentialError";
  }
}

export function requireOpenAIApiKey(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const value = env.OPENAI_API_KEY?.trim();
  if (!value) {
    throw new MissingAgentsCredentialError();
  }
  return value;
}

const CREDENTIAL_QUERY_KEYS = new Set([
  "token",
  "session",
  "key",
  "secret",
  "password",
  "access_token",
  "api_key",
  "auth",
]);

export function isTickadooBookingUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname !== TICKADOO_BOOKING_HOST ||
      url.username !== "" ||
      url.password !== "" ||
      url.pathname.length <= 1
    ) {
      return false;
    }
    for (const key of url.searchParams.keys()) {
      if (CREDENTIAL_QUERY_KEYS.has(key.toLowerCase())) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

export function extractBookingUrl(text: string): string | undefined {
  const candidates = text.match(/https?:\/\/[^\s)"']+/gi) ?? [];
  for (const candidate of candidates) {
    const cleaned = candidate.replace(/[.,;:]+$/, "");
    if (isTickadooBookingUrl(cleaned)) {
      return new URL(cleaned).href;
    }
  }
  return undefined;
}

function eventRecord(event: unknown): Record<string, unknown> {
  return event && typeof event === "object" ? (event as Record<string, unknown>) : {};
}

function nestedRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function outputTextFromContent(value: unknown, into: string[]): void {
  if (!Array.isArray(value)) return;
  for (const entry of value) {
    const content = nestedRecord(entry);
    if (content.type === "output_text" && typeof content.text === "string") {
      into.push(content.text);
    }
  }
}

function collectAssistantMessageText(item: unknown): string {
  const record = nestedRecord(item);
  if (
    record.type !== "message" ||
    record.role !== "assistant" ||
    record.phase !== "final_answer"
  ) {
    return "";
  }
  const parts: string[] = [];
  outputTextFromContent(record.content, parts);
  return parts.join("\n");
}

export function collectEventText(event: unknown): string {
  const record = eventRecord(event);
  const type = typeof record.type === "string" ? record.type : "";
  if (type === "agent.session.turn.output_text.delta" && typeof record.delta === "string") {
    return record.delta;
  }
  if (type === "agent.session.turn.output_text.done" && typeof record.text === "string") {
    return record.text;
  }
  if (type === "agent.session.turn.item.done") {
    return collectAssistantMessageText(record.item);
  }
  return "";
}

async function collectItemText(client: OpenAI, sessionId: string): Promise<string> {
  const parts: string[] = [];
  // openai-node list() returns a PagePromise/AbstractPage. `limit` is page size,
  // not a total cap. iterPages() walks every page (see openai/openai-node
  // src/core/pagination.ts). Empty listings yield no assistant-final text and
  // fail via the existing booking_url hard error. List failures propagate.
  const firstPage = await client.beta.agents.sessions.items.list(sessionId, {
    order: "asc",
    limit: 100,
  });
  for await (const page of firstPage.iterPages()) {
    for (const item of page.getPaginatedItems()) {
      const text = collectAssistantMessageText(item);
      if (text) parts.push(text);
    }
  }
  return parts.join("\n");
}

function isRootTurnTerminal(event: unknown, suffix: string): boolean {
  const record = eventRecord(event);
  const type = typeof record.type === "string" ? record.type : "";
  if (type !== `agent.session.turn.${suffix}`) return false;
  const turn = nestedRecord(record.turn);
  return turn.subagent_id == null;
}

async function runSmoke(): Promise<void> {
  requireOpenAIApiKey();

  const client = new OpenAI({
    defaultHeaders: { "OpenAI-Beta": "agents=v1" },
  });

  const model = process.env.OPENAI_AGENTS_MODEL?.trim() || DEFAULT_MODEL;
  const events = await client.beta.agents.sessions.create({
    agent: {
      model,
      instructions: SMOKE_INSTRUCTIONS,
      tools: [TICKADOO_MCP_TOOL],
    },
    environment: { type: "none" },
    input: SMOKE_INPUT,
    stream: true,
  });

  let sessionId = "";
  const streamed: string[] = [];
  let failedMessage = "";
  let completed = false;

  try {
    for await (const event of events) {
      const record = eventRecord(event);
      const type = typeof record.type === "string" ? record.type : "";
      const session = nestedRecord(record.session);
      if (type === "agent.session.created" && typeof session.id === "string") {
        sessionId = session.id;
        console.log(`session: ${sessionId}`);
      }

      const chunk = collectEventText(event);
      if (chunk) {
        streamed.push(chunk);
        if (type.includes("output_text.delta")) {
          process.stdout.write(typeof record.delta === "string" ? record.delta : "");
        }
      }

      if (type === "error") {
        const error = nestedRecord(record.error);
        failedMessage =
          typeof error.message === "string" ? error.message : JSON.stringify(event);
        break;
      }
      if (type === "agent.session.failed" || isRootTurnTerminal(event, "failed")) {
        const turn = nestedRecord(record.turn);
        const error = nestedRecord(turn.error ?? record.error);
        failedMessage =
          typeof error.message === "string"
            ? error.message
            : `${type}: required MCP server failed to initialize or the turn failed`;
        break;
      }
      if (isRootTurnTerminal(event, "cancelled")) {
        failedMessage = "Agents API turn was cancelled before a booking_url was returned.";
        break;
      }
      if (isRootTurnTerminal(event, "completed")) {
        completed = true;
        break;
      }
    }
  } finally {
    events.controller.abort();
  }

  if (!sessionId) {
    throw new Error("Agents API session did not emit agent.session.created.");
  }

  let saved = "";
  try {
    saved = await collectItemText(client, sessionId);
  } finally {
    await client.beta.agents.sessions.delete(sessionId).catch(() => undefined);
  }

  if (failedMessage) {
    throw new Error(failedMessage);
  }
  if (!completed) {
    throw new Error(
      "Stream closed before agent.session.turn.completed. Retrieve saved session state before retrying.",
    );
  }

  const combined = [...streamed, saved].join("\n");
  const bookingUrl = extractBookingUrl(combined);
  if (!bookingUrl) {
    throw new Error(
      `Smoke did not find a https://${TICKADOO_BOOKING_HOST}/ booking_url in the Agents API output.`,
    );
  }

  console.log(`\nbooking_url: ${bookingUrl}`);
}

const isDirectRun =
  Boolean(process.argv[1]) &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? "");

if (isDirectRun) {
  runSmoke().catch((error: unknown) => {
    if (error instanceof MissingAgentsCredentialError) {
      console.error(
        "The Agents API credential is not set.\nFrancis/Mark must add OPENAI_API_KEY to tickadoo-mcp repo secrets or ensure the org secret is visible to this repo.\nDo not invent keys. Do not reuse Cloudflare ads keys.",
      );
    } else if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(String(error));
    }
    process.exit(1);
  });
}
