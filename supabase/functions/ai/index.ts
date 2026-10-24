// MADI Accounts: AI helper.
// The app sends the conversation here. This function checks that the person is signed in,
// adds the secret Anthropic key, and forwards the request. The key never reaches the phone or the browser.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

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

    // 2. the secret key
    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return json({ error: "no_key" }, 500);

    // 3. forward to Claude
    const b = await req.json();
    const payload: Record<string, unknown> = {
      model: Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5-5",
      max_tokens: Math.min(Number(b.max_tokens) || 2500, 4096),
      system: String(b.system || ""),
      messages: Array.isArray(b.messages) ? b.messages : [],
    };
    if (Array.isArray(b.tools) && b.tools.length) payload.tools = b.tools;
    if (b.tool_choice) payload.tool_choice = b.tool_choice;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const out = await r.json();
    if (!r.ok) return json({ error: out?.error?.message || out?.error?.type || "anthropic_error" }, r.status);
    return json(out);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
