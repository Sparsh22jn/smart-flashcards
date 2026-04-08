// Smart FlashCards — Generate Edge Function
// Accepts a source (topic, YouTube URL, text, etc.) and generates flashcards via Claude.
// YouTube URLs are auto-detected: transcript is extracted server-side, then fed to Claude.
// Interview Prep mode: receives resume PDF + JD and generates targeted interview questions.

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

PURPOSE MODES — Adapt question framing based on the selected purpose:
- General: standard study flashcards (default behavior)
- Interview Prep: frame questions the way an interviewer would ask them. Use formats like "Explain…", "Walk me through…", "How would you approach…", "What's the difference between X and Y?", "Tell me about a time…" (for behavioral). Answers should be structured (STAR format for behavioral, clear technical explanations for technical). Include follow-up probes an interviewer might ask. Mnemonics should help remember key talking points.
- Exam Prep: frame questions in formal exam style (MCQ stems, short-answer, case-based). Include distractor reasoning where applicable. Answers should cite mechanisms, rules, or principles explicitly.

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

const INTERVIEW_SYSTEM_PROMPT = `You are a senior hiring manager and career coach with deep expertise in interview preparation. Your job is to generate realistic, targeted interview questions based on a candidate's resume and (optionally) a specific job description.

QUESTION CATEGORIES — prefix every question with its category tag:
- [Resume Deep-Dive]: Questions about specific projects, achievements, career transitions, or skills from the resume. Examples: "Walk me through your work on...", "I see you used X at Y company — tell me about that decision", "What was the biggest challenge in your role at...?"
- [Technical]: Domain-specific technical questions testing depth of knowledge. Should relate to skills on the resume and/or requirements in the JD. Examples: "Explain how you would...", "What's the trade-off between X and Y?", "Design a system that..."
- [Behavioral]: STAR-format questions targeting competencies the role requires. Examples: "Tell me about a time you had to...", "Describe a situation where...", "Give me an example of..."
- [Culture Fit]: Questions about motivation, values, career goals, and working style. Examples: "Why are you interested in this role?", "How do you handle disagreements with teammates?", "Where do you see yourself in 3 years?"

ANSWER SCAFFOLDING — For each question, provide a model answer:
- Behavioral → Use STAR format: Situation (set the scene) → Task (your responsibility) → Action (what you specifically did) → Result (measurable outcome)
- Technical → Clear explanation hitting key concepts, trade-offs, and practical considerations
- Resume Deep-Dive → Structured talking points highlighting impact, challenges overcome, and lessons learned
- Culture Fit → Authentic response that connects personal values to the role/company

CARD FORMAT:
{
  "front": "[Category] The interview question",
  "back": "Model answer with structured talking points the candidate should cover",
  "explanation": "What the interviewer is actually evaluating with this question — the hidden agenda",
  "mnemonic": "Key points checklist: 1) ... 2) ... 3) ...",
  "difficulty": "easy|medium|hard"
}

QUALITY RULES:
1. Every question MUST be specific to THIS candidate's resume — never generic
2. If a job description is provided, tailor questions to match the role requirements and company context
3. Answers should be comprehensive but concise — what a strong, well-prepared candidate would say
4. Explanations reveal what the interviewer is really testing (leadership? technical depth? self-awareness?)
5. Mnemonics are quick-reference bullet checklists of must-mention points
6. Mix approximately: 30% Resume Deep-Dive, 30% Technical, 25% Behavioral, 15% Culture Fit

DIFFICULTY LEVELS:
- Easy: Standard expected questions any candidate should prepare for
- Medium: Probing follow-up questions that dig deeper into specific experiences and technical details
- Hard: Challenging curveball questions, stress-test scenarios, "what if" hypotheticals, questions exposing gaps

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

      const body = await req.json();
      const { source, sourceType, numCards = 10, difficulty = "medium", purpose = "general" } = body;
      const { resumeFile, companyName, jobTitle, jobDescription } = body;

      if (!source && sourceType !== "interview") { await fail("Source is required"); return; }
      if (sourceType === "interview" && !resumeFile?.data) { await fail("Resume file is required for interview prep"); return; }

      // ── Purpose guide (for non-interview modes) ────────────────
      const purposeGuide = purpose === "interview"
        ? `\nPURPOSE: Interview Prep\nFrame every question the way an interviewer would ask it. Use formats like "Explain…", "Walk me through…", "How would you approach…", "What's the difference between X and Y?", "Tell me about a time…" (for behavioral questions). Structure answers using STAR format for behavioral and clear technical explanations for technical. Include a likely follow-up probe an interviewer might ask. Mnemonics should help remember key talking points.\n`
        : purpose === "exam"
        ? `\nPURPOSE: Exam Prep\nFrame every question in formal exam style: MCQ stems, short-answer, or case-based prompts. Include distractor reasoning where applicable. Answers must cite mechanisms, rules, or principles explicitly.\n`
        : "";

      // ── Build Claude message content ───────────────────────────
      let messageContent: any;
      let systemPrompt: string;
      let maxTokens = 8192;
      let videoMeta: any = null;

      if (sourceType === "interview") {
        // ── Interview Prep: Resume PDF + JD ────────────────────
        systemPrompt = INTERVIEW_SYSTEM_PROMPT;
        maxTokens = numCards >= 25 ? 16384 : 8192;

        await send({ status: "Analyzing your resume..." });

        const difficultyGuide = difficulty === "easy"
          ? "Easy: Standard expected questions any candidate should prepare for."
          : difficulty === "medium"
          ? "Medium: Probing follow-up questions that dig deeper into specific experiences and technical details."
          : "Advanced: Challenging curveball questions, stress-test scenarios, hypotheticals, and questions that probe gaps or weaknesses.";

        let textPrompt = `Generate exactly ${numCards} realistic interview questions based on the attached resume.\n\n`;

        if (companyName || jobTitle) {
          textPrompt += `TARGET ROLE: ${[jobTitle, companyName].filter(Boolean).join(" at ")}\n\n`;
        }

        if (jobDescription) {
          textPrompt += `JOB DESCRIPTION:\n${jobDescription}\n\n`;
        }

        textPrompt += `DIFFICULTY: ${difficulty}\n${difficultyGuide}\n\n`;
        textPrompt += `Generate a balanced mix:\n- ~30% [Resume Deep-Dive] — probe specific projects, skills, and career decisions from the resume\n- ~30% [Technical] — technical questions matching resume skills${jobDescription ? " and JD requirements" : ""}\n- ~25% [Behavioral] — STAR-format questions on leadership, teamwork, problem-solving\n- ~15% [Culture Fit] — motivation, values, career trajectory\n\n`;
        textPrompt += `Make every question SPECIFIC to this candidate's actual background. Reference real projects, companies, skills, and experiences from the resume. Do NOT generate generic questions.`;

        // Build content array with document block + text
        messageContent = [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: resumeFile.mediaType || "application/pdf",
              data: resumeFile.data,
            },
          },
          { type: "text", text: textPrompt },
        ];

        await send({ status: "AI is generating interview questions..." });

      } else if (sourceType === "youtube" || extractVideoId(source)) {
        // ── YouTube: Extract transcript ──────────────────────────
        systemPrompt = SYSTEM_PROMPT;
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

          messageContent =
            `Generate exactly ${numCards} flashcards from this YouTube video transcript.\n\n` +
            `DIFFICULTY: ${difficulty}\n${difficultyGuide}\n` +
            purposeGuide + `\n` +
            `VIDEO: "${transcript.title}" by ${transcript.channel} (${transcript.duration})\n` +
            `LANGUAGE: ${transcript.language}\n\n` +
            `TRANSCRIPT:\n${transcriptText}\n\n` +
            `Focus on the key concepts, facts, and insights discussed in the video. ` +
            `Create flashcards that test deep understanding, not trivia or surface details.`;

          await send({ status: "AI is generating your flashcards..." });

        } catch (err) {
          await fail(`YouTube error: ${err.message}`);
          return;
        }

      } else if (sourceType === "paste" || sourceType === "pdf" || sourceType === "document") {
        // ── Text content ──────────────────────────────────────────
        systemPrompt = SYSTEM_PROMPT;
        await send({ status: "Processing your content..." });
        const pasteDiffGuide = difficulty === "easy"
          ? "Easy: definitions, core mechanisms, foundational 'what is' questions. Stay within the source material."
          : difficulty === "medium"
          ? "Medium: application, clinical/practical vignettes, 'why' and 'how' questions, compare-and-contrast. Stay within the source material."
          : "Advanced: synthesis, differential diagnosis, edge cases, multi-step reasoning, exam-style questions. Generate cards from the content AND additional cards on related concepts, edge cases, and exam-relevant material NOT in the source.";

        messageContent =
          `Generate exactly ${numCards} flashcards from the following content.\n\n` +
          `DIFFICULTY: ${difficulty}\n${pasteDiffGuide}\n` +
          purposeGuide + `\n` +
          `CONTENT:\n${source}`;

        await send({ status: "AI is generating your flashcards..." });

      } else {
        // ── Topic ─────────────────────────────────────────────────
        systemPrompt = SYSTEM_PROMPT;
        await send({ status: `Generating cards about "${source}"...` });
        const topicDiffGuide = difficulty === "easy"
          ? "Easy: definitions, core mechanisms, foundational 'what is' questions."
          : difficulty === "medium"
          ? "Medium: application, clinical/practical vignettes, 'why' and 'how' questions, compare-and-contrast."
          : "Advanced: synthesis, differential diagnosis, edge cases, multi-step reasoning, exam-style questions with distractors, questions requiring integration of multiple concepts.";

        messageContent =
          `Generate exactly ${numCards} flashcards about: ${source}\n\n` +
          `DIFFICULTY: ${difficulty}\n${topicDiffGuide}\n` +
          purposeGuide + `\n` +
          `Cover the most important concepts comprehensively. Match the depth and question style to what is typically considered ${difficulty} within this domain.`;

        await send({ status: "AI is generating your flashcards..." });
      }

      // ── Call Claude (streaming) ─────────────────────────────────
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: maxTokens,
          stream: true,
          system: systemPrompt,
          messages: [{ role: "user", content: messageContent }],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        await fail(`Claude API error: ${errText}`);
        return;
      }

      // Read Claude's SSE stream, parse and send each card incrementally
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = "";
      let accumulatedText = "";
      let inputTokens = 0;
      let outputTokens = 0;
      let cardsSentSoFar = 0;
      const cardLabel = sourceType === "interview" ? "questions" : "cards";

      function normalizeCard(c: any, idx: number): any {
        return {
          front: c.front || `Question ${idx + 1}`,
          back: c.back || "No answer provided",
          explanation: c.explanation || null,
          mnemonic: c.mnemonic || null,
          difficulty: ["easy", "medium", "hard"].includes(c.difficulty) ? c.difficulty : difficulty,
        };
      }

      // Try to extract complete card JSON objects from accumulated text
      // and send them to the client as they arrive
      async function tryExtractAndSendCards() {
        const arrayStart = accumulatedText.indexOf("[");
        if (arrayStart === -1) return;

        const jsonContent = accumulatedText.slice(arrayStart);

        // Find complete card objects: match each {...} block
        // We look for top-level objects within the array by tracking brace depth
        let depth = 0;
        let inString = false;
        let escape = false;
        let objStart = -1;
        const completeObjects: string[] = [];

        for (let i = 0; i < jsonContent.length; i++) {
          const ch = jsonContent[i];

          if (escape) { escape = false; continue; }
          if (ch === "\\") { escape = true; continue; }
          if (ch === '"') { inString = !inString; continue; }
          if (inString) continue;

          if (ch === "{") {
            if (depth === 0) objStart = i;
            depth++;
          } else if (ch === "}") {
            depth--;
            if (depth === 0 && objStart !== -1) {
              completeObjects.push(jsonContent.slice(objStart, i + 1));
              objStart = -1;
            }
          }
        }

        // Send any new complete cards
        for (let i = cardsSentSoFar; i < completeObjects.length; i++) {
          try {
            const parsed = JSON.parse(completeObjects[i]);
            const card = normalizeCard(parsed, i);
            await send({
              card,
              status: `Generating ${cardLabel}... (${i + 1} so far)`,
            });
            cardsSentSoFar = i + 1;
          } catch { /* incomplete or malformed — skip for now */ }
        }
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split("\n");
        sseBuffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const payload = trimmed.slice(6).trim();
          if (!payload || payload === "[DONE]") continue;

          try {
            const event = JSON.parse(payload);

            if (event.type === "message_start" && event.message?.usage) {
              inputTokens = event.message.usage.input_tokens || 0;
            }

            if (event.type === "content_block_delta" && event.delta?.text) {
              accumulatedText += event.delta.text;
              await tryExtractAndSendCards();
            }

            if (event.type === "message_delta" && event.usage) {
              outputTokens = event.usage.output_tokens || 0;
            }
          } catch { /* malformed SSE event — skip */ }
        }
      }

      // Final pass: extract any remaining cards not yet sent
      await tryExtractAndSendCards();

      if (cardsSentSoFar === 0) {
        await fail("Claude returned no valid flashcards.");
        return;
      }

      // ── Track cost ───────────────────────────────────────────────
      const cost = (inputTokens / 1_000_000) * 3.0 + (outputTokens / 1_000_000) * 15.0;

      try {
        await supabase.rpc("increment_cost", {
          user_id_input: user.id,
          input_tokens_add: inputTokens,
          output_tokens_add: outputTokens,
          cost_add: cost,
        });
      } catch {} // non-critical

      // ── Send final status ──────────────────────────────────────
      await send({
        status: `Generated ${cardsSentSoFar} ${cardLabel}!`,
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
