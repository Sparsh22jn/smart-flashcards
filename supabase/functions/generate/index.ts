// Smart FlashCards — Generate Edge Function
// Accepts a source (topic, YouTube URL, text, etc.) and generates flashcards via Claude.
// YouTube URLs are auto-detected: transcript is extracted server-side, then fed to Claude.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.1";
import { fetchYouTubeTranscript, extractVideoId, chunkTranscript } from "./youtube.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are a professional-grade flashcard author used by medical students, law students, PhD candidates, and other advanced learners preparing for high-stakes exams (USMLE, bar exam, board certifications, qualifying exams).

DOMAIN DETECTION — Adapt your question style:
- Medical/clinical → pathophysiology, clinical vignettes, drug mechanisms, differentials
- Legal → rules, elements, landmark holdings, policy rationales
- Scientific → mechanisms, experimental design, data interpretation
- Humanities → analysis, comparison, historiography, theoretical frameworks
- Technical → architecture, trade-offs, failure modes, implementation details

DIFFICULTY TIERS:
- Easy: definitions, core mechanisms, foundational "what is" questions
- Medium: application, clinical/practical vignettes, "why" and "how" questions, compare-and-contrast
- Hard (Advanced): synthesis, differential diagnosis, edge cases, multi-step reasoning, exam-style questions with distractors, questions that require integrating multiple concepts

CARD QUALITY RULES:
1. Each flashcard must have: front (question), back (answer), explanation (ELI5), mnemonic (memory trick)
2. Questions must be SPECIFIC and TESTABLE — never vague ("Tell me about X"). Use "Which mechanism…", "What distinguishes X from Y…", "A patient presents with… what is the most likely…"
3. Answers must include the mechanism, reasoning, or key distinction — not just a bare fact
4. Cards are ATOMIC BUT DEEP — one concept per card, but that concept explored thoroughly
5. Follow SuperMemo's 20 Rules: avoid sets/enumerations, use cloze deletion where it fits, leverage imagery
6. Explanations should be genuinely simple — as if explaining to a curious 10-year-old
7. Mnemonics should be professional-grade and varied: acronyms, stories, visual associations, method of loci, rhymes, peg systems

OUTPUT FORMAT:
Return a JSON array of flashcard objects. Each object:
{
  "front": "The question",
  "back": "The answer",
  "explanation": "ELI5 explanation",
  "mnemonic": "Memory trick",
  "difficulty": "easy|medium|hard"
}

Return ONLY the JSON array, no markdown code fences, no extra text.`;

function sseEvent(data: any): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // We'll use a TransformStream so we can send SSE updates as we progress
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  const send = async (data: any) => {
    await writer.write(encoder.encode(sseEvent(data)));
  };

  const finish = async () => {
    await writer.write(encoder.encode("data: [DONE]\n\n"));
    await writer.close();
  };

  const fail = async (msg: string) => {
    await writer.write(encoder.encode(sseEvent({ error: msg })));
    await writer.write(encoder.encode("data: [DONE]\n\n"));
    await writer.close();
  };

  // Start processing in the background so we can return the stream immediately
  (async () => {
    try {
      // ── Auth ─────────────────────────────────────────────────────
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) { await fail("Unauthorized"); return; }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) { await fail("Invalid token"); return; }

      const { source, sourceType, numCards = 10, difficulty = "medium" } = await req.json();
      if (!source) { await fail("Source is required"); return; }

      // ── YouTube: Extract transcript ──────────────────────────────
      let userMessage = "";
      let videoMeta: any = null;

      if (sourceType === "youtube" || extractVideoId(source)) {
        await send({ status: "Detecting YouTube video..." });

        try {
          await send({ status: "Fetching video transcript..." });
          const transcript = await fetchYouTubeTranscript(source);
          videoMeta = {
            videoId: transcript.videoId,
            title: transcript.title,
            channel: transcript.channel,
            duration: transcript.duration,
            language: transcript.language,
            segmentCount: transcript.segments.length,
            wordCount: transcript.fullText.split(/\s+/).length,
          };

          await send({
            status: `Transcript extracted: "${transcript.title}" by ${transcript.channel} (${transcript.duration})`,
            meta: videoMeta,
          });

          // Chunk transcript if it's very long
          const chunks = chunkTranscript(transcript.fullText, 4000);
          const transcriptText = chunks.length > 1
            ? chunks[0] + `\n\n[... transcript continues for ${chunks.length} sections total ...]`
            : transcript.fullText;

          const difficultyGuide = difficulty === "easy"
            ? "Easy: definitions, core mechanisms, foundational 'what is' questions."
            : difficulty === "medium"
            ? "Medium: application, clinical/practical vignettes, 'why' and 'how' questions, compare-and-contrast."
            : "Advanced: synthesis, differential diagnosis, edge cases, multi-step reasoning, exam-style questions. Go BEYOND the transcript — add related concepts, edge cases, and exam-relevant cards not explicitly stated in the source.";

          userMessage =
            `Generate exactly ${numCards} flashcards from this YouTube video transcript.\n\n` +
            `DIFFICULTY: ${difficulty}\n${difficultyGuide}\n\n` +
            `VIDEO: "${transcript.title}" by ${transcript.channel} (${transcript.duration})\n` +
            `LANGUAGE: ${transcript.language}\n\n` +
            `TRANSCRIPT:\n${transcriptText}\n\n` +
            `Focus on the key concepts, facts, and insights discussed in the video. ` +
            `Create flashcards that test deep understanding, not trivia or surface details.`;

        } catch (err) {
          await fail(`YouTube error: ${err.message}`);
          return;
        }

      } else if (sourceType === "paste" || sourceType === "pdf" || sourceType === "document") {
        // ── Text content ──────────────────────────────────────────
        await send({ status: "Processing your content..." });
        const pasteDiffGuide = difficulty === "easy"
          ? "Easy: definitions, core mechanisms, foundational 'what is' questions. Stay within the source material."
          : difficulty === "medium"
          ? "Medium: application, clinical/practical vignettes, 'why' and 'how' questions, compare-and-contrast. Stay within the source material."
          : "Advanced: synthesis, differential diagnosis, edge cases, multi-step reasoning, exam-style questions. Generate cards from the content AND additional cards on related concepts, edge cases, and exam-relevant material NOT in the source.";

        userMessage =
          `Generate exactly ${numCards} flashcards from the following content.\n\n` +
          `DIFFICULTY: ${difficulty}\n${pasteDiffGuide}\n\n` +
          `CONTENT:\n${source}`;

      } else {
        // ── Topic ─────────────────────────────────────────────────
        await send({ status: `Generating cards about "${source}"...` });
        const topicDiffGuide = difficulty === "easy"
          ? "Easy: definitions, core mechanisms, foundational 'what is' questions."
          : difficulty === "medium"
          ? "Medium: application, clinical/practical vignettes, 'why' and 'how' questions, compare-and-contrast."
          : "Advanced: synthesis, differential diagnosis, edge cases, multi-step reasoning, exam-style questions with distractors, questions requiring integration of multiple concepts.";

        userMessage =
          `Generate exactly ${numCards} flashcards about: ${source}\n\n` +
          `DIFFICULTY: ${difficulty}\n${topicDiffGuide}\n\n` +
          `Cover the most important concepts comprehensively. Match the depth and question style to what is typically considered ${difficulty} within this domain.`;
      }

      // ── Call Claude ──────────────────────────────────────────────
      await send({ status: "AI is generating your flashcards..." });

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8192,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userMessage }],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        await fail(`Claude API error: ${errText}`);
        return;
      }

      const result = await response.json();
      const text = result.content[0].text;

      // ── Parse response ───────────────────────────────────────────
      let cards;
      try {
        cards = JSON.parse(text);
      } catch {
        const match = text.match(/\[[\s\S]*\]/);
        if (match) {
          cards = JSON.parse(match[0]);
        } else {
          await fail("Failed to parse generated cards from Claude response.");
          return;
        }
      }

      // Validate cards
      if (!Array.isArray(cards) || cards.length === 0) {
        await fail("Claude returned no valid flashcards.");
        return;
      }

      // Ensure all required fields
      cards = cards.map((c: any, i: number) => ({
        front: c.front || `Question ${i + 1}`,
        back: c.back || "No answer provided",
        explanation: c.explanation || null,
        mnemonic: c.mnemonic || null,
        difficulty: ["easy", "medium", "hard"].includes(c.difficulty) ? c.difficulty : difficulty,
      }));

      // ── Track cost ───────────────────────────────────────────────
      const inputTokens = result.usage?.input_tokens || 0;
      const outputTokens = result.usage?.output_tokens || 0;
      const cost = (inputTokens / 1_000_000) * 3.0 + (outputTokens / 1_000_000) * 15.0;

      try {
        await supabase.rpc("increment_cost", {
          user_id_input: user.id,
          input_tokens_add: inputTokens,
          output_tokens_add: outputTokens,
          cost_add: cost,
        });
      } catch {} // non-critical

      // ── Send results ─────────────────────────────────────────────
      await send({
        status: `Generated ${cards.length} flashcards!`,
        cards,
        meta: videoMeta,
        cost: {
          inputTokens,
          outputTokens,
          cost: Math.round(cost * 10000) / 10000,
        },
      });

      await finish();

    } catch (err) {
      try { await fail(`Unexpected error: ${err.message}`); } catch {}
    }
  })();

  return new Response(readable, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
});
