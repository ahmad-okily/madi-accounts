// MADI Accounts: AI helper.
// The app sends the conversation here. This function checks that the person is signed in,
// adds the secret key, and forwards the request. The key never reaches the phone or the browser.
//
// Set one or more secrets in Supabase > Edge Functions > Secrets:
//   GEMINI_API_KEY     free key from aistudio.google.com (no card needed)
//   GROQ_API_KEY       free key from console.groq.com (no card needed), used if Gemini fails
//   ANTHROPIC_API_KEY  paid key from console.anthropic.com; if set, it is used first
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// deno-lint-ignore no-explicit-any
type Any = any;

// ---------- Anthropic ----------
async function viaAnthropic(key: string, b: Any) {
  const payload: Any = {
    model: Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5-5",
    max_tokens: Math.min(Number(b.max_tokens) || 2500, 4096),
    system: String(b.system || ""),
    messages: Array.isArray(b.messages) ? b.messages : [],
  };
  if (Array.isArray(b.tools) && b.tools.length) payload.tools = b.tools;
  if (b.tool_choice) payload.tool_choice = b.tool_choice;
  // strip Gemini-only fields if the provider was switched mid-conversation
  for (const m of payload.messages) if (Array.isArray(m.content)) for (const c of m.content) delete c._sig;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(50000),
  });
  const out = await r.json();
  if (!r.ok) return json({ error: out?.error?.message || out?.error?.type || "ai_error" }, r.status);
  return json(out);
}

// ---------- Gemini (translated to and from the same format the app uses) ----------
function cleanSchema(s: Any): Any {
  if (!s || typeof s !== "object") return s;
  const o: Any = {};
  for (const [k, v] of Object.entries(s)) {
    if (k === "properties") {
      const p: Any = {};
      for (const [pk, pv] of Object.entries(v as Any)) p[pk] = cleanSchema(pv);
      o.properties = p;
    } else if (k === "items") o.items = cleanSchema(v);
    else if (["type", "description", "enum", "required", "format", "nullable"].includes(k)) o[k] = v;
  }
  return o;
}
async function viaGeminiModel(key: string, b: Any, model: string) {
  const names: Record<string, string> = {};
  const contents: Any[] = [];
  for (const m of (Array.isArray(b.messages) ? b.messages : [])) {
    const role = m.role === "assistant" ? "model" : "user";
    const parts: Any[] = [];
    if (typeof m.content === "string") parts.push({ text: m.content });
    else for (const c of m.content || []) {
      if (c.type === "text" && c.text) parts.push({ text: c.text });
      else if (c.type === "tool_use") {
        names[c.id] = c.name;
        const p: Any = { functionCall: { name: c.name, args: c.input || {} } };
        if (c._sig) p.thoughtSignature = c._sig;
        parts.push(p);
      } else if (c.type === "tool_result") {
        let res: Any = c.content;
        try { res = JSON.parse(c.content); } catch (_) { /* keep text */ }
        parts.push({ functionResponse: { name: names[c.tool_use_id] || "tool", response: { result: res } } });
      }
    }
    if (parts.length) contents.push({ role, parts });
  }
  const payload: Any = {
    contents,
    generationConfig: { maxOutputTokens: 8192 }, // room for the model's own thinking plus the answer
  };
  if (b.system) payload.systemInstruction = { parts: [{ text: String(b.system) }] };
  if (Array.isArray(b.tools) && b.tools.length) {
    payload.tools = [{
      functionDeclarations: b.tools.map((t: Any) => {
        const d: Any = { name: t.name, description: t.description };
        const sc = t.input_schema;
        if (sc && sc.properties && Object.keys(sc.properties).length) d.parameters = cleanSchema(sc);
        return d;
      }),
    }];
    if (b.tool_choice?.type === "tool") {
      payload.toolConfig = { functionCallingConfig: { mode: "ANY", allowedFunctionNames: [b.tool_choice.name] } };
    }
  }
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(50000),
  });
  const out = await r.json();
  if (!r.ok) return { ok: false, status: r.status, error: out?.error?.message || out?.error?.status || "ai_error" };
  const parts = out?.candidates?.[0]?.content?.parts || [];
  const content: Any[] = [];
  let i = 0;
  for (const p of parts) {
    if (p.thought) continue;
    if (p.text) content.push({ type: "text", text: p.text });
    if (p.functionCall) {
      const blk: Any = { type: "tool_use", id: `g${Date.now()}_${i++}`, name: p.functionCall.name, input: p.functionCall.args || {} };
      if (p.thoughtSignature) blk._sig = p.thoughtSignature;
      content.push(blk);
    }
  }
  if (!content.length) {
    const why = out?.candidates?.[0]?.finishReason || out?.promptFeedback?.blockReason || "empty";
    return { ok: false, status: 502, error: "empty_reply:" + why };
  }
  return { ok: true, body: { content, model, stop_reason: content.some((c) => c.type === "tool_use") ? "tool_use" : "end_turn" } };
}
const GEMINI_MODELS = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-flash-lite-latest", "gemini-2.5-flash-lite", "gemini-2.0-flash"];
// tries each model in turn; a model with no free quota (429) or that no longer exists (404) is skipped
async function viaGemini(key: string, b: Any) {
  const env = Deno.env.get("GEMINI_MODEL");
  const list = env ? [env, ...GEMINI_MODELS.filter((m) => m !== env)] : GEMINI_MODELS;
  const errors: string[] = [];
  for (const m of list) {
    let res: Any;
    try { res = await viaGeminiModel(key, b, m); } catch (e) { res = { ok: false, status: 504, error: String((e as Error)?.message || e) }; }
    if (res.ok) return { ok: true, body: res.body };
    errors.push(`${m}: ${String(res.error).slice(0, 160)}`);
    if (![429, 404, 503, 500, 504].includes(res.status)) return { ok: false, status: res.status, error: res.error, errors };
  }
  return { ok: false, status: 429, error: "all_gemini_failed", errors };
}

// ---------- Groq (free, OpenAI-style API) ----------
async function viaGroq(key: string, b: Any) {
  const msgs: Any[] = [];
  if (b.system) msgs.push({ role: "system", content: String(b.system) });
  for (const m of (Array.isArray(b.messages) ? b.messages : [])) {
    if (typeof m.content === "string") { msgs.push({ role: m.role, content: m.content }); continue; }
    if (m.role === "assistant") {
      const text = (m.content || []).filter((c: Any) => c.type === "text").map((c: Any) => c.text).join("\n");
      const calls = (m.content || []).filter((c: Any) => c.type === "tool_use").map((c: Any) => ({ id: c.id, type: "function", function: { name: c.name, arguments: JSON.stringify(c.input || {}) } }));
      const o: Any = { role: "assistant", content: text || null };
      if (calls.length) o.tool_calls = calls;
      msgs.push(o);
    } else {
      for (const c of m.content || []) {
        if (c.type === "tool_result") msgs.push({ role: "tool", tool_call_id: c.tool_use_id, content: String(c.content) });
        else if (c.type === "text") msgs.push({ role: "user", content: c.text });
      }
    }
  }
  const models = [Deno.env.get("GROQ_MODEL") || "openai/gpt-oss-120b", "llama-3.3-70b-versatile"];
  const errors: string[] = [];
  for (const model of models) {
    const payload: Any = { model, messages: msgs, max_tokens: Math.min(Number(b.max_tokens) || 2500, 8000) };
    if (Array.isArray(b.tools) && b.tools.length) {
      payload.tools = b.tools.map((t: Any) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema || { type: "object", properties: {} } } }));
      if (b.tool_choice?.type === "tool") payload.tool_choice = { type: "function", function: { name: b.tool_choice.name } };
    }
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(50000),
    });
    const out = await r.json();
    if (!r.ok) { errors.push(`${model}: ${String(out?.error?.message || r.status).slice(0, 160)}`); if ([429, 404, 400, 503].includes(r.status)) continue; return { ok: false, status: r.status, error: out?.error?.message || "ai_error", errors }; }
    const msg = out?.choices?.[0]?.message || {};
    const content: Any[] = [];
    if (msg.content) content.push({ type: "text", text: msg.content });
    for (const tc of msg.tool_calls || []) {
      let input: Any = {}; try { input = JSON.parse(tc.function?.arguments || "{}"); } catch (_) { /* empty */ }
      content.push({ type: "tool_use", id: tc.id, name: tc.function?.name, input });
    }
    if (!content.length) { errors.push(`${model}: empty`); continue; }
    return { ok: true, body: { content, model, stop_reason: content.some((c) => c.type === "tool_use") ? "tool_use" : "end_turn" } };
  }
  return { ok: false, status: 429, error: "all_groq_failed", errors };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    // 1. only signed-in users of the app
    const auth = req.headers.get("Authorization") || "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY") || req.headers.get("apikey") || "";
    const who = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: auth, apikey: anon } });
    if (!who.ok) return json({ error: "not_signed_in" }, 401);

    // 2. pick the provider from the secret that is set
    const b = await req.json();
    const anthropic = Deno.env.get("ANTHROPIC_API_KEY");
    if (anthropic) return await viaAnthropic(anthropic, b);
    const gemini = Deno.env.get("GEMINI_API_KEY"), groq = Deno.env.get("GROQ_API_KEY");
    if (!gemini && !groq) return json({ error: "no_key" }, 500);
    const errors: string[] = [];
    if (gemini) { const r = await viaGemini(gemini, b); if (r.ok) return json(r.body); errors.push(...(r.errors || [r.error])); if (!groq) return json({ error: r.error, details: errors }, r.status); }
    if (groq) { const r = await viaGroq(groq, b); if (r.ok) return json(r.body); errors.push(...(r.errors || [r.error])); return json({ error: r.error, details: errors }, r.status); }
    return json({ error: "ai_error", details: errors }, 500);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
