import { GATEWAY_BASE_URL, MAX_AUDIO_BYTES, getGatewayHeaders } from "./gateway.server";

// Speech-to-text upstream. When STT_BASE_URL + STT_API_KEY are configured
// (e.g. Groq's free whisper-large-v3), audio goes there instead of the
// OpenClaw gateway, whose OpenAI-compatible HTTP surface does not expose
// /v1/audio/transcriptions. The key stays server-side either way.
const STT_BASE_URL = (process.env["STT_BASE_URL"] ?? "").replace(/\/$/, "");
const STT_API_KEY = process.env["STT_API_KEY"] ?? "";
const STT_MODEL = process.env["STT_MODEL"] || "whisper-large-v3";

const sseHeaders = { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" };

export async function transcribe(file: File, signal?: AbortSignal) {
  if (!file.size || file.size > MAX_AUDIO_BYTES) throw new Error("Invalid audio file size");
  if (!file.type.startsWith("audio/")) throw new Error("Unexpected media MIME type");

  if (STT_BASE_URL && STT_API_KEY) {
    const form = new FormData();
    form.append("model", STT_MODEL);
    form.append("file", file, file.name);
    form.append("response_format", "json");
    const upstream = await fetch(`${STT_BASE_URL}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${STT_API_KEY}` },
      body: form,
      ...(signal ? { signal } : {}),
    });
    if (!upstream.ok) {
      const detail = (await upstream.text()).slice(0, 300);
      throw new Error(`STT upstream returned ${upstream.status}: ${detail}`);
    }
    // Normalize the non-streaming {text} reply into the SSE shape the client already parses.
    const data = (await upstream.json()) as { text?: unknown };
    const text = typeof data.text === "string" ? data.text : "";
    const payload = new TextEncoder().encode(`data: ${JSON.stringify({ type: "transcript.text.done", text })}\n\n`);
    return new Response(payload, { status: 200, headers: sseHeaders });
  }

  // Default: OpenClaw gateway transcription passthrough (SSE upstream).
  const form = new FormData();
  form.append("model", process.env["OPENCLAW_TRANSCRIBE_MODEL"] || "whisper-1");
  form.append("file", file, file.name);
  form.append("response_format", "json");
  form.append("stream", "true");
  return fetch(`${GATEWAY_BASE_URL}/v1/audio/transcriptions`, {
    method: "POST",
    headers: getGatewayHeaders(),
    body: form,
    ...(signal ? { signal } : {}),
  });
}
