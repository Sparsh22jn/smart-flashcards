/**
 * Client-side YouTube URL utilities.
 * Handles URL detection, video ID extraction, thumbnail/embed URLs, and oEmbed metadata.
 */

/**
 * Extract video ID from any YouTube URL format.
 */
export function extractVideoId(url) {
  if (!url || typeof url !== 'string') return null

  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }

  return null
}

/**
 * Check if a string is or contains a YouTube URL.
 */
export function isYouTubeUrl(text) {
  return /(?:youtube\.com\/(?:watch|embed|v|shorts|live)|youtu\.be\/)/.test(text)
}

/**
 * Get thumbnail URL for a YouTube video.
 * Quality: default, mqdefault, hqdefault, sddefault, maxresdefault
 */
export function getThumbnailUrl(videoId, quality = 'hqdefault') {
  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`
}

/**
 * Get embed URL for a YouTube video.
 */
export function getEmbedUrl(videoId) {
  return `https://www.youtube.com/embed/${videoId}`
}

/**
 * Fetch video metadata via YouTube's oEmbed endpoint (no API key needed).
 * Returns: { title, author_name, author_url, thumbnail_url }
 */
export async function fetchVideoMeta(url) {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
    )
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/**
 * Format duration string like "12:34" or "1:02:34".
 */
export function formatDuration(duration) {
  if (!duration) return ''
  return duration
}

/**
 * Estimate token count from transcript word count.
 * Rough estimate: 1 token ≈ 0.75 words for English.
 */
export function estimateTokens(wordCount) {
  return Math.round(wordCount / 0.75)
}

/**
 * Estimate cost for generating flashcards from a transcript.
 * Based on Claude Sonnet 4 pricing: $3/M input, $15/M output.
 */
export function estimateCost(wordCount, numCards = 10) {
  const inputTokens = estimateTokens(wordCount) + 500 // system prompt overhead
  const outputTokens = numCards * 150 // ~150 tokens per card
  const cost = (inputTokens / 1_000_000) * 3.0 + (outputTokens / 1_000_000) * 15.0
  return {
    inputTokens,
    outputTokens,
    cost: Math.round(cost * 10000) / 10000,
    display: cost < 0.01 ? '<$0.01' : `~$${cost.toFixed(2)}`,
  }
}
