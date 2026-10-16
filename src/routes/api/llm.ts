import { createFileRoute } from "@tanstack/react-router";
import { OUTPUT_FORMAT, SYSTEM_PROMPT, planContextMessage } from "@/lib/voice/prompt";

type Turn = { role: "user" | "assistant"; text: string };

// Fixed hosts only: the browser never chooses where this server sends keys.
const CLOUD: Record<string, string> = {
  groq: "https://api.groq.com/openai/v1",
  openai: "https://api.openai.com/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
  openrouter: "https://openrouter.ai/api/v1",
  anthropic: "https://api.anthropic.com/v1",
};

/** Server-side env keys per provider, so the browser needs no key at all for free-tier cloud models. */
const ENV_KEYS: Record<string, string> = {
  groq: "GROQ_API_KEY",
  gemini: "GEMINI_API_KEY",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

type ToolCall = { id?: string; type?: string; function?: { name?: string; arguments?: string } };
type ChatMsg = { role: string; content?: string | null; tool_calls?: ToolCall[]; tool_call_id?: string };

/** Workspace tools exposed to cloud models in OpenAI function format. Writes never execute directly —
 *  they create a server-side approval proposal, exactly like the OpenClaw gateway path. */
const MAX_TOOL_ROUNDS = 5;

/** Workspace tools exposed to cloud models in OpenAI function format. Writes never execute directly —
 *  they create a server-side approval proposal, exactly like the OpenClaw gateway path.
 *  Harmony-format models turn "reply with one JSON object" into a virtual `json` tool call —
 *  declaring it as a real function makes that call valid: its arguments ARE the screen JSON. */
const TOOLS = [
  {
    type: "function",
    function: {
      name: "json",
      description: "Return your final answer as one JSON object per the screen contract: { kind: \"screen\", screen: { text: string (plain spoken language), choices?: [{ id, label, value }], navigation?: [] }, action_proposal?: null, app_commands?: [] }.",
      parameters: { type: "object" },
    },
  },
  { type: "function", function: { name: "read_file", description: "Read a text file within the repository workspace.", parameters: { type: "object", properties: { path: { type: "string", description: "Workspace-relative path" } }, required: ["path"] } } },
  { type: "function", function: { name: "list_files", description: "List files and directories within a workspace directory.", parameters: { type: "object", properties: { path: { type: "string", description: "Workspace-relative directory, defaults to '.'" } } } } },
  { type: "function", function: { name: "search_code", description: "Search for a text pattern in workspace source files.", parameters: { type: "object", properties: { pattern: { type: "string" }, path: { type: "string", description: "Workspace-relative directory, defaults to '.'" } }, required: ["pattern"] } } },
  { type: "function", function: { name: "write_fix", description: "Propose a file write (code fix). Does NOT write directly — the human operator must approve it in the Approval panel.", parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" }, description: { type: "string" } }, required: ["path", "content", "description"] } } },
];

async function keyFromVault(path: string, field: string): Promise<string> {
  const addr = process.env["VAULT_ADDR"];
  const token = process.env["VAULT_TOKEN"];
  if (!addr || !token) throw new Error("HashiCorp Vault is not set up yet (missing Vault address or token).");
  if (!/^[\w\-./]+$/.test(path) || path.includes("..")) throw new Error("That Vault path is not valid.");
  const headers: Record<string, string> = { "X-Vault-Token": token };
  const ns = process.env["VAULT_NAMESPACE"];
  if (ns) headers["X-Vault-Namespace"] = ns;
  const res = await fetch(`${addr.replace(/\/$/, "")}/v1/${path.replace(/^\//, "")}`, { headers });
  if (!res.ok) throw new Error(`Vault refused the request [${res.status}]: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { data?: { data?: Record<string, unknown> } & Record<string, unknown> };
  const value = body.data?.data?.[field] ?? body.data?.[field];
  if (typeof value !== "string" || !value) throw new Error(`Vault secret has no "${field}" field.`);
  return value;
}

export const Route = createFileRoute("/api/llm")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let body: { kind?: string; model?: string; apiKey?: string; vaultPath?: string; vaultField?: string; turns?: Turn[]; context?: string };
        try { body = await request.json(); } catch { return json({ error: "Invalid request" }, 400); }
        const kind = body.kind ?? "";
        const base = CLOUD[kind];
        const model = (body.model ?? "").trim();
        const turns = (Array.isArray(body.turns) ? body.turns : []).filter((t) => t && typeof t.text === "string").slice(-12);
        if (!base || !model || !turns.length) return json({ error: "Missing provider, model or message" }, 400);

        let key: string;
        try {
          key = body.vaultPath ? await keyFromVault(body.vaultPath, body.vaultField || "api_key") : (body.apiKey ?? "").trim() || process.env[ENV_KEYS[kind] ?? ""] || "";
        } catch (error) {
          return json({ error: error instanceof Error ? error.message : "Vault lookup failed" }, 502);
        }
        if (!key) return json({ error: `No API key available for ${kind} (set ${ENV_KEYS[kind] ?? "an API key"} server-side or choose a key source in Settings)` }, 400);

        const plan = planContextMessage(body.context);
        // Cloud tool-loop path: no JSON_INSTRUCTION (strict JSON-only phrasing makes harmony
        // models emit virtual "json" tool calls); the console renders plain-text answers as-is.
        const system = [
          SYSTEM_PROMPT,
          plan,
          "TOOL USE: Call only the functions provided in this request (read_file, list_files, search_code, write_fix); never invent other tool names. After tool results, answer in plain spoken text without markdown. If you call write_fix, never claim it executed — the console asks the human for approval.",
        ].filter(Boolean).join("\n\n");
        const messages = turns.map((t) => ({ role: t.role, content: t.text }));

        try {
          let res: Response | null = null;
          if (kind === "anthropic") {
            res = await fetch(`${base}/messages`, {
              method: "POST", signal: request.signal,
              headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
              body: JSON.stringify({ model, max_tokens: 1500, system, messages }),
            });
            if (!res.ok) {
              const detail = (await res.text()).slice(0, 300);
              console.error(`Provider ${kind} failed [${res.status}]: ${detail}`);
              return json({ error: `${kind} returned ${res.status}: ${detail}` }, res.status);
            }
            const data = (await res.json()) as { content?: { type: string; text?: string }[] };
            const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
            if (!text.trim()) return json({ error: "The provider returned an empty answer" }, 502);
            return json({ text });
          }

          // OpenAI-compatible cloud path with a native tool-calling loop, mirroring
          // the gateway path's contract: read-only tools execute, writes become
          // server-side approval proposals. Same tools, same trust boundary.
          const { dispatchTool, isKnownTool } = await import("@/lib/agent/tools.server");
          const { createProposal } = await import("@/lib/agent/approval.server");

          const loopMessages: ChatMsg[] = [{ role: "system", content: system }, ...messages];
          for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
            let rateLimitDetail: string | null = null;
            for (let attempt = 0; attempt < 3; attempt++) {
              res = await fetch(`${base}/chat/completions`, {
                method: "POST", signal: request.signal,
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
                body: JSON.stringify({ model, messages: loopMessages, tools: TOOLS, tool_choice: "auto" }),
              });
              if (res.status !== 429) break;
              rateLimitDetail = await res.text();
              if (attempt === 2) break;
              const suggested = rateLimitDetail.match(/try again in ([\d.]+)s/i);
              const delay = suggested ? Math.min(60_000, Math.ceil(parseFloat(suggested[1] ?? "5") * 1000) + 300) : 5_000;
              await new Promise((r) => setTimeout(r, delay));
              if (request.signal.aborted) return new Response(null, { status: 499 });
            }
            if (!res || !res.ok) {
              const detail = (rateLimitDetail ?? (res ? await res.text() : "no response")).slice(0, 300);
              console.error(`Provider ${kind} failed [${res?.status ?? "network"}]: ${detail}`);
              return json({ error: `${kind} returned ${res?.status ?? 502}: ${detail}` }, res?.status ?? 502);
            }
            const data = (await res.json()) as { choices?: { message?: ChatMsg }[] };
            const msg: ChatMsg = data.choices?.[0]?.message ?? { role: "assistant", content: "" };
            const calls = msg.tool_calls ?? [];

            if (!calls.length) {
              const text = typeof msg.content === "string" ? msg.content : "";
              if (!text.trim()) return json({ error: "The provider returned an empty answer" }, 502);
              return json({ text });
            }

            loopMessages.push({ role: "assistant", content: msg.content ?? null, tool_calls: calls });
            for (const call of calls) {
              const name = call.function?.name ?? "";
              let args: Record<string, unknown> = {};
              try { args = JSON.parse(call.function?.arguments || "{}") as Record<string, unknown>; } catch { args = {}; }
              if (name === "json") {
                // The model delivered its final answer through the screen-contract function.
                return json({ text: JSON.stringify(args) });
              }
              if (!isKnownTool(name)) {
                loopMessages.push({ role: "tool", tool_call_id: call.id ?? "", content: `Unknown tool: ${name}. Available tools: read_file, list_files, search_code, write_fix.` });
                continue;
              }
              const result = await dispatchTool({ tool: name, args });
              if (result.needsApproval) {
                const proposal = createProposal(name, result.needsApproval.args);
                const enriched = JSON.stringify({
                  kind: "screen",
                  screen: { text: "I've prepared this fix and need your approval before anything is written.", choices: [], navigation: ["cancel"] },
                  action_proposal: {
                    id: proposal.id,
                    title: result.needsApproval.title,
                    tool: name,
                    summary: result.needsApproval.summary,
                    risk: result.needsApproval.risk,
                  },
                  app_commands: [],
                });
                return json({ text: enriched });
              }
              loopMessages.push({ role: "tool", tool_call_id: call.id ?? "", content: result.ok ? result.output : `Error: ${result.output}` });
            }
          }
          return json({ error: "The agent used too many tool rounds" }, 502);
        } catch (error) {
          if (request.signal.aborted) return new Response(null, { status: 499 });
          return json({ error: error instanceof Error ? error.message : "Provider request failed" }, 502);
        }
      },
    },
  },
});
