import { supabase } from './supabase'

/**
 * Stream flashcard generation from Claude via Edge Function.
 * Same SSE pattern as IronLog's chat streaming.
 */
export async function streamGenerate({ source, sourceType, numCards, difficulty, purpose, onChunk, onDone, onError }) {
  const abort = new AbortController()

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ source, sourceType, numCards, difficulty, purpose }),
      signal: abort.signal,
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(err || `HTTP ${res.status}`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const payload = trimmed.slice(6)
        if (payload === '[DONE]') {
          onDone?.()
          return () => abort.abort()
        }
        try {
          const json = JSON.parse(payload)
          onChunk?.(json)
        } catch {}
      }
    }

    onDone?.()
  } catch (err) {
    if (err.name !== 'AbortError') onError?.(err)
  }

  return () => abort.abort()
}

/**
 * Stream chat with AI coach (ELI5, mnemonics, general questions).
 */
export async function streamChat({ message, conversation, cardContext, onChunk, onDone, onError }) {
  const abort = new AbortController()

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ message, conversation, cardContext }),
      signal: abort.signal,
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(err || `HTTP ${res.status}`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let accumulated = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const payload = trimmed.slice(6)
        if (payload === '[DONE]') {
          onDone?.(accumulated)
          return () => abort.abort()
        }
        try {
          const json = JSON.parse(payload)
          if (json.text) {
            accumulated += json.text
            onChunk?.(json.text, accumulated)
          }
        } catch {}
      }
    }

    onDone?.(accumulated)
  } catch (err) {
    if (err.name !== 'AbortError') onError?.(err)
  }

  return () => abort.abort()
}

/**
 * Get AI usage stats (no rate limit enforced — free tier is unlimited).
 * Kept for future freemium gating.
 */
export async function getAiUsage() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { remaining: Infinity, limit: Infinity }

  return { remaining: Infinity, limit: Infinity }
}

/**
 * Increment AI usage counter after a generation.
 */
export async function incrementAiUsage() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data } = await supabase
    .from('user_preferences')
    .select('value')
    .eq('user_id', user.id)
    .eq('key', 'ai_usage')
    .single()

  const today = new Date().toISOString().slice(0, 10)
  const usage = data?.value || {}
  const count = usage.date === today ? (usage.count || 0) + 1 : 1

  await supabase
    .from('user_preferences')
    .upsert({
      user_id: user.id,
      key: 'ai_usage',
      value: { date: today, count },
    }, { onConflict: 'user_id,key' })
}
