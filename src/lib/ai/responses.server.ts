import { CHAT_MODEL, GATEWAY_BASE_URL, getGatewayHeaders } from "./gateway.server";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayResponseHeaders,
  getLovableAiGatewayRunId,
} from "./run-id.server";

export type GatewayOptions = {
  /** OpenClaw agent id sent as the x-openclaw-agent-id header (agent targeting). */
  agentId?: string;
  /** Stable conversation id; sent as the OpenAI `user` field so one console thread keeps one gateway session. */
  sessionUser?: string;
  /** Explicit backend provider model sent as the x-openclaw-model header (allowed only alongside an agent-target model). */
  backendModel?: string;
};

export async function streamResponses(
  request: Request,
  input: Record<string, unknown>[],
  extra: Record<string, unknown> = {},
  model: string = CHAT_MODEL,
  gw: GatewayOptions = {},
) {
  // The Gateway HTTP surface works over /v1/chat/completions (enabled in the gateway config);
  // agent targeting, session continuity and backend model overrides ride the OpenClaw headers.
  return streamChatAsResponses(request, input, model, gw);
}

function openClawHeaders(gw: GatewayOptions): Record<string, string> {
  return getGatewayHeaders({
    "Content-Type": "application/json",
    "X-Lovable-AIG-SDK": "fetch",
    ...(gw.agentId ? { "x-openclaw-agent-id": gw.agentId } : {}),
    ...(gw.backendModel ? { "x-openclaw-model": gw.backendModel } : {}),
  });
}

/** Streams from OpenClaw Gateway (/v1/chat/completions) and re-emits deltas as Responses-style SSE events. */
async function streamChatAsResponses(request: Request, input: Record<string, unknown>[], model: string, gw: GatewayOptions) {
  const gateway = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const messages = input.map((m) => ({
    role: m["role"],
    content: ((m["content"] as { text: string }[]) ?? []).map((c) => c.text).join("\n"),
  }));
  messages.push({ role: "system", content: "Reply with only the JSON object described above, no code fences." });
  const body: Record<string, unknown> = { model, messages, stream: true };
  if (gw.sessionUser) body["user"] = gw.sessionUser;
  try {
    const response = await gateway.fetch(`${GATEWAY_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      signal: request.signal,
      headers: openClawHeaders(gw),
      body: JSON.stringify(body),
    });
    const headers = getLovableAiGatewayResponseHeaders(response.headers);
    if (!response.ok || !response.body) {
      headers.set("Content-Type", "application/json");
      const detail = (await response.text()).slice(0, 300);
      return new Response(JSON.stringify({ error: `${model} returned ${response.status}: ${detail}` }), { status: response.status, headers });
    }
    headers.set("Content-Type", "text/event-stream");
    headers.set("Cache-Control", "no-cache");
    const enc = new TextEncoder();
    let buf = "";
    const out = response.body.pipeThrough(new TextDecoderStream()).pipeThrough(new TransformStream<string, Uint8Array>({
      transform(chunk, ctrl) {
        buf += chunk;
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const data = line.startsWith("data:") ? line.slice(5).trim() : "";
          if (!data || data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data) as {
              choices?: { delta?: { content?: string; reasoning_content?: string } }[];
            };
            const reasoning = parsed.choices?.[0]?.delta?.reasoning_content;
            if (reasoning) {
              ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ type: "response.reasoning_summary_text.delta", delta: reasoning })}\n\n`));
            }
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ type: "response.output_text.delta", delta })}\n\n`));
          } catch { /* partial line */ }
        }
      },
    }));
    return new Response(out, { status: 200, headers });
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    return new Response(
      JSON.stringify({
        error: `Could not reach OpenClaw Gateway at ${GATEWAY_BASE_URL}. Start your OpenClaw gateway or configure OPENCLAW_GATEWAY_URL in .env.`,
      }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
}

/**
 * Non-streaming gateway call. Collects the full response text.
 * Used by the tool dispatch loop to inspect tool_request before returning.
 */
export async function collectResponses(
  request: Request,
  input: Record<string, unknown>[],
  extra: Record<string, unknown> = {},
  model: string = CHAT_MODEL,
  gw: GatewayOptions = {},
): Promise<string> {
  const gateway = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const messages = input.map((m) => ({
    role: m["role"],
    content: ((m["content"] as { text: string }[]) ?? []).map((c) => c.text).join("\n"),
  }));
  messages.push({ role: "system", content: "Reply with only the JSON object described above, no code fences." });
  const payload: Record<string, unknown> = { model, messages, stream: false };
  if (gw.sessionUser) payload["user"] = gw.sessionUser;
  const response = await gateway.fetch(`${GATEWAY_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    signal: request.signal,
    headers: openClawHeaders(gw),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`${model} returned ${response.status}: ${detail}`);
  }
  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  return data["choices"]?.[0]?.message?.content ?? "";
}
