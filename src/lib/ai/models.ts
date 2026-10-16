/** Portfolio and OpenClaw gateway models served by /api/agent, keyed by the short name shown in plans. */
export const GATEWAY_MODELS: Record<string, string> = {
  "openclaw/default": "openclaw/default",
  "dc-orchestrator": "openclaw/dc-orchestrator",
  "gpt-6-astra": "openai/gpt-6-astra",
  "gpt-5.6-terra": "openai/gpt-5.6-terra",
  "gpt-5.6-luna": "openai/gpt-5.6-luna",
  "gpt-5.6-sol": "openai/gpt-5.6-sol",
  "gemini-3.1-pro": "google/gemini-3.1-pro-preview",
};

/** Resolves a short name or openclaw/* agent/model route to a gateway model id; unknown names return null (never silently swapped). */
export function resolveGatewayModel(name: string | undefined): string | null {
  if (!name) return "openclaw/default";
  if (name.startsWith("openclaw/")) return name;
  return GATEWAY_MODELS[name] ?? null;
}

/** Console agents backed by a dedicated OpenClaw agent; anything else runs on the gateway's default agent. */
export const OPENCLAW_AGENT_IDS: ReadonlySet<string> = new Set(["ciso"]);

/** The OpenClaw agent target for a console agent id (ciso -> openclaw/ciso; anything else -> openclaw/default). */
export function toOpenClawTarget(agentId: string | undefined): string {
  return agentId && OPENCLAW_AGENT_IDS.has(agentId) ? `openclaw/${agentId}` : "openclaw/default";
}
