// Smart FlashCards — Chat Edge Function
// Handles ELI5 explanations, mnemonic generation, and general study questions.
// Streams responses via SSE (same pattern as IronLog).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.1";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are a brilliant, friendly study coach inside a flashcard app called Smart FlashCards.

Your capabilities:
1. **ELI5 Explanations** — Explain any concept as if to a curious 5-year-old. Use analogies, metaphors, and everyday examples.
2. **Mnemonic Generation** — Create memorable tricks using: acronyms, stories, visual associations, method of loci, rhymes, chunking, peg systems.
3. **Study Coaching** — Help users understand difficult concepts, suggest study strategies, answer follow-up questions.
4. **Card Context** — When given a flashcard's front/back, help the user master that specific concept.

Rules:
- Be concise (2-4 sentences default, expand only if asked)
- Use concrete examples, not abstract explanations
- Be encouraging but not patronizing
- Reference the specific card/topic being discussed`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response("Unauthorized", { status: 401, headers: CORS_HEADERS });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response("Invalid token", { status: 401, headers: CORS_HEADERS });
    }

    const { message, conversation = [], cardContext } = await req.json();

    // Build messages
    const messages = [];
    if (cardContext) {
      messages.push({
        role: "user",
        content: `Context — I'm studying this flashcard:\nQ: ${cardContext.front}\nA: ${cardContext.back}`,
      });
      messages.push({
        role: "assistant",
        content: "I can see the card. What would you like help with?",
      });
    }

    // Add conversation history (last 10)
    for (const msg of conversation.slice(-10)) {
      messages.push({ role: msg.role, content: msg.content });
    }

    messages.push({ role: "user", content: message });

    // Stream from Claude
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        stream: true,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(`Claude API error: ${errText}`, { status: 500, headers: CORS_HEADERS });
    }

    // Pipe Claude's SSE stream through to the client
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const reader = response.body!.getReader();

    const stream = new ReadableStream({
      async pull(controller) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6);
            if (payload === "[DONE]") continue;

            try {
              const event = JSON.parse(payload);
              if (event.type === "content_block_delta" && event.delta?.text) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
                );
              }
            } catch {}
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (err) {
    return new Response(`Error: ${err.message}`, { status: 500, headers: CORS_HEADERS });
  }
});
