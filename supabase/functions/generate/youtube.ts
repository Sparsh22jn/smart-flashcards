/**
 * YouTube Transcript Extractor for Deno Edge Functions.
 *
 * Fetches captions directly from YouTube's innertube API — no API key needed.
 * Same technique used by youtube-transcript-api (Python) and youtubei.js.
 *
 * Flow:
 * 1. Fetch video page HTML
 * 2. Extract the initial player response JSON (contains caption tracks)
 * 3. Fetch the caption track URL (timedtext XML)
 * 4. Parse XML into plain text with timestamps
 */

export interface TranscriptSegment {
  text: string;
  start: number;   // seconds
  duration: number; // seconds
}

export interface TranscriptResult {
  videoId: string;
  title: string;
  channel: string;
  duration: string;
  language: string;
  segments: TranscriptSegment[];
  fullText: string;
}

/**
 * Extract video ID from various YouTube URL formats.
 */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  // Maybe it's already a video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;

  return null;
}

/**
 * Fetch and parse the YouTube video page to extract player response.
 */
async function fetchPlayerResponse(videoId: string): Promise<any> {
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch video page: HTTP ${res.status}`);
  }

  const html = await res.text();

  // Extract ytInitialPlayerResponse from the page
  const match = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
  if (!match) {
    throw new Error("Could not find player response in page HTML. Video may be private or unavailable.");
  }

  try {
    return JSON.parse(match[1]);
  } catch {
    throw new Error("Failed to parse player response JSON.");
  }
}

/**
 * Extract video metadata from player response.
 */
function extractMetadata(playerResponse: any): { title: string; channel: string; duration: string } {
  const videoDetails = playerResponse.videoDetails || {};
  const title = videoDetails.title || "Unknown Title";
  const channel = videoDetails.author || "Unknown Channel";

  const lengthSeconds = parseInt(videoDetails.lengthSeconds || "0", 10);
  const mins = Math.floor(lengthSeconds / 60);
  const secs = lengthSeconds % 60;
  const duration = `${mins}:${String(secs).padStart(2, "0")}`;

  return { title, channel, duration };
}

/**
 * Get available caption tracks from player response.
 */
function getCaptionTracks(playerResponse: any): any[] {
  return (
    playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || []
  );
}

/**
 * Fetch and parse a caption track URL (timedtext XML).
 */
async function fetchCaptionTrack(trackUrl: string): Promise<TranscriptSegment[]> {
  // Request JSON format instead of XML for easier parsing
  const url = new URL(trackUrl);
  url.searchParams.set("fmt", "json3");

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch caption track: HTTP ${res.status}`);
  }

  const data = await res.json();

  // json3 format has events array
  if (data.events) {
    return data.events
      .filter((e: any) => e.segs) // filter out non-text events
      .map((e: any) => ({
        text: (e.segs || []).map((s: any) => s.utf8 || "").join("").trim(),
        start: (e.tStartMs || 0) / 1000,
        duration: (e.dDurationMs || 0) / 1000,
      }))
      .filter((s: TranscriptSegment) => s.text.length > 0);
  }

  // Fallback: try XML parsing if json3 fails
  return fetchCaptionTrackXML(trackUrl);
}

/**
 * Fallback: Fetch caption track as XML and parse it.
 */
async function fetchCaptionTrackXML(trackUrl: string): Promise<TranscriptSegment[]> {
  const res = await fetch(trackUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch caption XML: HTTP ${res.status}`);
  }

  const xml = await res.text();
  const segments: TranscriptSegment[] = [];

  // Parse <text start="..." dur="...">content</text> elements
  const textRegex = /<text\s+start="([^"]*)"(?:\s+dur="([^"]*)")?\s*>([\s\S]*?)<\/text>/g;
  let match;

  while ((match = textRegex.exec(xml)) !== null) {
    const start = parseFloat(match[1]) || 0;
    const duration = parseFloat(match[2]) || 0;
    // Decode HTML entities
    const text = match[3]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/<[^>]*>/g, "") // strip any remaining HTML tags
      .trim();

    if (text) {
      segments.push({ text, start, duration });
    }
  }

  return segments;
}

/**
 * Format seconds to MM:SS timestamp.
 */
function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Main function: Fetch YouTube transcript.
 *
 * Prefers manual captions > auto-generated captions.
 * Prefers English > any other language.
 */
export async function fetchYouTubeTranscript(url: string): Promise<TranscriptResult> {
  const videoId = extractVideoId(url);
  if (!videoId) {
    throw new Error(`Invalid YouTube URL: ${url}`);
  }

  const playerResponse = await fetchPlayerResponse(videoId);
  const { title, channel, duration } = extractMetadata(playerResponse);
  const captionTracks = getCaptionTracks(playerResponse);

  if (captionTracks.length === 0) {
    throw new Error(
      "No captions available for this video. The video may not have subtitles enabled."
    );
  }

  // Pick best track: prefer manual English > auto English > manual any > auto any
  let selectedTrack = null;
  const priorities = [
    (t: any) => t.languageCode === "en" && t.kind !== "asr",    // manual English
    (t: any) => t.languageCode === "en",                         // any English (incl auto)
    (t: any) => t.kind !== "asr",                                // manual, any language
    (_t: any) => true,                                           // anything
  ];

  for (const predicate of priorities) {
    selectedTrack = captionTracks.find(predicate);
    if (selectedTrack) break;
  }

  if (!selectedTrack?.baseUrl) {
    throw new Error("Could not find a usable caption track.");
  }

  const language = selectedTrack.languageCode || "unknown";
  const isAutoGenerated = selectedTrack.kind === "asr";

  const segments = await fetchCaptionTrack(selectedTrack.baseUrl);

  if (segments.length === 0) {
    throw new Error("Caption track was empty. Try a different video.");
  }

  // Build full text with timestamps every ~60 seconds for context
  const textParts: string[] = [];
  let lastTimestamp = -60;

  for (const seg of segments) {
    if (seg.start - lastTimestamp >= 60) {
      textParts.push(`\n[${formatTimestamp(seg.start)}]`);
      lastTimestamp = seg.start;
    }
    textParts.push(seg.text);
  }

  const fullText = textParts.join(" ").trim();

  return {
    videoId,
    title,
    channel,
    duration,
    language: `${language}${isAutoGenerated ? " (auto-generated)" : ""}`,
    segments,
    fullText,
  };
}

/**
 * Chunk a long transcript for Claude API (respecting token limits).
 * Each chunk is ~3000 words (roughly 4000 tokens).
 */
export function chunkTranscript(fullText: string, maxWordsPerChunk = 3000): string[] {
  const words = fullText.split(/\s+/);

  if (words.length <= maxWordsPerChunk) {
    return [fullText];
  }

  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += maxWordsPerChunk) {
    chunks.push(words.slice(i, i + maxWordsPerChunk).join(" "));
  }

  return chunks;
}
