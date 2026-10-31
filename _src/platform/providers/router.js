// The existing Responses adapter retains orchestration/tools/identities; transports normalize provider protocols.
import { openAIResponses, sse } from "./openai.js";
import { Problem, fail, rpc } from "../shared.js";
const endpoints = {
  gemini:
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  groq: "https://api.groq.com/openai/v1/chat/completions",
  openai: "https://api.openai.com/v1/responses",
};
const secretNames = {
  gemini: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
  openai: "OPENAI_API_KEY",
};
const circuit = new Map();
const number = (value, fallback) =>
  Number.isFinite(Number(value)) && Number(value) >= 0
    ? Number(value)
    : fallback;
const wire = (event) => "data: " + JSON.stringify(event) + "\n\n";
export function routingConfig(env, payload) {
  const complex =
    String(payload.content || "").length > 1600 ||
    /\b(debug|architecture|prove|compare.*strateg|analy[sz]e)\b/i.test(
      payload.content || "",
    );
  const order = [
    env.AELIO_PRIMARY_PROVIDER || "gemini",
    env.AELIO_SECONDARY_PROVIDER || "groq",
    env.AELIO_EMERGENCY_PROVIDER || "openai",
  ];
  return [...new Set(order)]
    .filter(
      (p) =>
        endpoints[p] &&
        env[secretNames[p]] &&
        env["AELIO_" + p.toUpperCase() + "_ENABLED"] !== "false",
    )
    .map((p) => {
      const prefix = p === "openai" ? "OPENAI" : p.toUpperCase(),
        model = String(
          (complex && env[prefix + "_COMPLEX_MODEL"]) ||
            env[prefix + "_MODEL"] ||
            "",
        ).trim();
      if (!/^[A-Za-z0-9_./:-]{1,160}$/.test(model))
        fail(
          503,
          "model_configuration",
          "Configure a supported model for each enabled provider.",
        );
      const tariff =
          complex && env[prefix + "_COMPLEX_MODEL"] ? "_COMPLEX" : "",
        input = number(env[prefix + tariff + "_INPUT_USD_PER_MILLION"], NaN),
        output = number(env[prefix + tariff + "_OUTPUT_USD_PER_MILLION"], NaN);
      if (
        !Number.isFinite(input) ||
        !Number.isFinite(output) ||
        input <= 0 ||
        output <= 0
      )
        fail(
          503,
          "pricing_configuration",
          "Configure verified provider token prices before enabling routing.",
        );
      return {
        provider: p,
        model,
        input,
        output,
        timeout: Math.min(
          90000,
          Math.max(
            1000,
            number(
              env[prefix + "_TIMEOUT_MS"] ||
                (p === order[0]
                  ? env.AELIO_PRIMARY_TIMEOUT_MS
                  : env.AELIO_SECONDARY_TIMEOUT_MS),
              15000,
            ),
          ),
        ),
      };
    });
}
function chatBody(body, model) {
  const messages = [{ role: "system", content: body.instructions }];
  for (const item of body.input || []) {
    if (typeof item.content === "string")
      messages.push({ role: item.role, content: item.content });
    else {
      if (item.content.some((c) => c.type === "input_file"))
        throw new Problem(
          400,
          "provider_attachment_unsupported",
          "PDF attachments use the configured OpenAI adapter.",
        );
      messages.push({
        role: item.role,
        content: item.content.map((c) => ({ type: "text", text: c.text })),
      });
    }
  }
  return {
    model,
    messages,
    stream: true,
    stream_options: { include_usage: true },
    max_tokens: body.max_output_tokens,
    ...(body.tools?.length
      ? {
          tools: body.tools.map((t) => ({
            type: "function",
            function: {
              name: t.name,
              description: t.description,
              parameters: t.parameters,
            },
          })),
        }
      : {}),
  };
}
async function normalize(response, provider, signal, onUsage, onOutcome) {
  if (provider === "openai") return response;
  const enc = new TextEncoder();
  let canceled = false;
  const stream = new ReadableStream({
    async start(c) {
      const tools = new Map();
      let finished = false;
      try {
        for await (const e of sse(response.body)) {
          if (signal.aborted) throw new DOMException("Stopped", "AbortError");
          if (e.error)
            throw new Problem(
              502,
              "provider_response_invalid",
              "The provider could not complete the reply.",
            );
          if (e.usage)
            onUsage({
              input_tokens: e.usage.prompt_tokens,
              output_tokens: e.usage.completion_tokens,
            });
          for (const choice of e.choices || []) {
            const d = choice.delta || {};
            if (d.content)
              c.enqueue(
                enc.encode(
                  wire({
                    type: "response.output_text.delta",
                    delta: d.content,
                  }),
                ),
              );
            for (const t of d.tool_calls || []) {
              const old = tools.get(t.index) || { name: "", arguments: "" };
              old.name += t.function?.name || "";
              old.arguments += t.function?.arguments || "";
              tools.set(t.index, old);
            }
            if (choice.finish_reason) {
              if (!["stop", "tool_calls"].includes(choice.finish_reason))
                throw new Problem(
                  502,
                  "response_incomplete",
                  "The reply reached its limit before finishing.",
                );
              finished = true;
            }
          }
        }
        if (!finished)
          throw new Problem(
            502,
            "stream_interrupted",
            "The provider stream ended early.",
          );
        for (const t of tools.values())
          c.enqueue(
            enc.encode(
              wire({
                type: "response.output_item.done",
                item: { type: "function_call", ...t },
              }),
            ),
          );
        c.enqueue(
          enc.encode(wire({ type: "response.completed", response: {} })),
        );
        onOutcome("complete");
      } catch (e) {
        onOutcome("interrupted");
        if (!canceled)
          c.enqueue(
            enc.encode(
              wire({
                type: "error",
                error: { code: "provider_stream_interrupted" },
              }),
            ),
          );
      } finally {
        try {
          c.close();
        } catch {}
      }
    },
    cancel() {
      canceled = true;
      response.body.cancel().catch(() => {});
      onOutcome("canceled");
    },
  });
  return new Response(stream, {
    headers: { "content-type": "text/event-stream" },
  });
}
export async function intelligenceRouter(env, payload, signal, deps = {}) {
  const ledger = deps.rpc || ((name, data) => rpc(env, name, data)),
    fetcher = deps.fetch || fetch;
  env = { ...env, ...(await ledger("app_ai_router_config", {})) };
  const configs = routingConfig(env, payload);
  if (!configs.length)
    fail(503, "ai_not_configured", "No AI provider is enabled.");
  const daily = number(env.AELIO_DAILY_AI_BUDGET_USD, 0),
    monthly = number(env.AELIO_MONTHLY_AI_BUDGET_USD, 0),
    emergency = number(env.AELIO_OPENAI_EMERGENCY_BUDGET_USD, 0);
  if (daily <= 0 || monthly <= 0)
    fail(
      503,
      "budget_configuration",
      "Platform AI safety limits are required.",
    );
  const routerFetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    let last;
    for (const config of configs) {
      const { provider, model } = config;
      if ((circuit.get(provider)?.until || 0) > Date.now()) continue;
      const hasPDF = body.input.some(
        (m) =>
          Array.isArray(m.content) &&
          m.content.some((c) => c.type === "input_file"),
      );
      if (hasPDF && provider !== "openai") continue; // Decide compatibility before any paid request.
      const providerBody =
        provider === "openai" ? { ...body, model } : chatBody(body, model);
      // UTF-8 bytes upper-bound text tokens, plus explicit conservative per-PDF token allowance.
      const promptBytes = new TextEncoder().encode(
        JSON.stringify(providerBody),
      ).length;
      const inputBound =
        promptBytes +
        (hasPDF ? number(env.AELIO_PDF_INPUT_TOKEN_BOUND, 100000) : 0);
      const reserve =
        Math.ceil(
          ((inputBound * config.input +
            body.max_output_tokens * config.output) /
            1e6) *
            1e8,
        ) / 1e8;
      const id = crypto.randomUUID(),
        start = Date.now();
      await ledger("app_ai_reserve", {
        attempt: id,
        rid: payload.request_id,
        uid: payload.billing_user_id || null,
        product_scope: payload.billing_product || "aelio",
        provider_name: provider,
        model_name: model,
        reserve_usd: reserve,
        daily_limit: daily,
        monthly_limit: monthly,
        emergency_limit: emergency,
        provider_daily_limit: number(
          env[provider.toUpperCase() + "_DAILY_BUDGET_USD"],
          daily,
        ),
        provider_monthly_limit: number(
          env[provider.toUpperCase() + "_MONTHLY_BUDGET_USD"],
          monthly,
        ),
      });
      let settled = false,
        usage = null,
        outcome = "uncertain";
      const settle = async (knownZero = false) => {
        if (settled) return;
        settled = true;
        const known =
          Number.isFinite(usage?.input_tokens) &&
          Number.isFinite(usage?.output_tokens);
        const cost = known
          ? (usage.input_tokens * config.input +
              usage.output_tokens * config.output) /
            1e6
          : knownZero
            ? 0
            : reserve;
        await ledger("app_ai_settle", {
          attempt: id,
          actual_usd: cost,
          result: outcome,
          latency: Date.now() - start,
          in_tokens: usage?.input_tokens ?? null,
          out_tokens: usage?.output_tokens ?? null,
          is_estimated: !known && !knownZero,
        });
      };
      const abort = new AbortController(),
        stop = () => abort.abort();
      options.signal?.addEventListener("abort", stop, { once: true });
      if (options.signal?.aborted) abort.abort();
      let received = false;
      const timeout = setTimeout(() => abort.abort(), config.timeout);
      try {
        let response;
        try {
          response = await fetcher(endpoints[provider], {
            method: "POST",
            headers: {
              authorization: "Bearer " + env[secretNames[provider]],
              "content-type": "application/json",
              accept: "text/event-stream",
            },
            body: JSON.stringify(providerBody),
            signal: abort.signal,
          });
        } catch (e) {
          outcome = options.signal?.aborted ? "canceled" : "network_ambiguous";
          await settle();
          throw new Problem(
            502,
            "provider_request_ambiguous",
            "The AI connection ended before acceptance could be confirmed. Please retry.",
          );
        }
        if (!response.ok) {
          const safe = [401, 403, 404, 429].includes(response.status);
          outcome = "http_" + response.status;
          await settle(safe);
          circuit.set(provider, {
            until:
              Date.now() +
              Math.min(300000, number(env.AELIO_CIRCUIT_BREAKER_MS, 30000)),
          });
          if (safe) {
            last = new Problem(
              503,
              "provider_unavailable",
              "The AI provider is unavailable.",
            );
            clearTimeout(timeout);
            options.signal?.removeEventListener("abort", stop);
            continue;
          }
          throw new Problem(
            502,
            "provider_request_ambiguous",
            "The AI request could not be confirmed. Please retry.",
          );
        }
        if (!response.body) {
          outcome = "empty_stream";
          await settle();
          throw new Problem(
            502,
            "provider_response_invalid",
            "The AI stream was missing.",
          );
        }
        const normalized = await normalize(
          response,
          provider,
          abort.signal,
          (u) => (usage = u),
          (o) => {
            outcome = o;
            if (o === "interrupted")
              circuit.set(provider, { until: Date.now() + 30000 });
          },
        );
        const reader = normalized.body.getReader(),
          decoder = new TextDecoder();
        let pending = "";
        const stream = new ReadableStream({
          async pull(controller) {
            try {
              const part = await reader.read();
              if (part.done) {
                clearTimeout(timeout);
                options.signal?.removeEventListener("abort", stop);
                await settle();
                controller.close();
                return;
              }
              received = true;
              // Parse a side copy for usage only; the adapter receives the exact provider bytes.
              pending = (
                pending + decoder.decode(part.value, { stream: true })
              ).replace(/\r\n/g, "\n");
              let i;
              while ((i = pending.indexOf("\n\n")) >= 0) {
                const block = pending.slice(0, i);
                pending = pending.slice(i + 2);
                const raw = block
                  .split("\n")
                  .filter((l) => l.startsWith("data:"))
                  .map((l) => l.slice(5).trimStart())
                  .join("\n");
                try {
                  const e = JSON.parse(raw);
                  if (e.response?.usage) usage = e.response.usage;
                  if (e.type === "response.completed") outcome = "complete";
                  if (e.type === "response.failed" || e.type === "error")
                    outcome = "provider_failed";
                } catch {}
              }
              if (pending.length > 2000000) throw Error("frame_limit");
              controller.enqueue(part.value);
            } catch (e) {
              outcome = "interrupted";
              clearTimeout(timeout);
              abort.abort();
              await settle();
              controller.error(e);
            }
          },
          async cancel() {
            outcome = "canceled";
            clearTimeout(timeout);
            abort.abort();
            options.signal?.removeEventListener("abort", stop);
            await reader.cancel().catch(() => {});
            await settle();
          },
        });
        circuit.delete(provider);
        return new Response(stream, {
          headers: {
            "content-type": "text/event-stream",
            "x-aelio-provider": provider,
            "x-aelio-model": model,
          },
        });
      } catch (e) {
        clearTimeout(timeout);
        abort.abort();
        options.signal?.removeEventListener("abort", stop);
        await settle();
        throw e;
      }
    }
    throw (
      last ||
      new Problem(
        503,
        "provider_unavailable",
        "AI providers are temporarily unavailable.",
      )
    );
  };
  return openAIResponses(
    { ...env, OPENAI_API_KEY: "server-router", OPENAI_MODEL: configs[0].model },
    payload,
    signal,
    { fetch: routerFetch, reserve: async () => {} },
  );
}

export function providerHealth() {
  return Object.fromEntries(
    [...circuit].map(([p, s]) => [
      p,
      { circuit_open: s.until > Date.now(), retry_after: s.until },
    ]),
  );
}
