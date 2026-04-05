import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import InputBar from '../components/InputBar'
import { streamGenerate } from '../lib/ai'
import { createDeck, insertCards } from '../lib/data'
import { isYouTubeUrl, extractVideoId, getThumbnailUrl } from '../lib/youtube'

/**
 * Generate page — create flashcards from any source.
 * Full YouTube pipeline: URL → transcript extraction → Claude → flashcards.
 */
export default function Generate({ user }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [generating, setGenerating] = useState(false)
  const [generatedCards, setGeneratedCards] = useState([])
  const [status, setStatus] = useState('')
  const [error, setError] = useState(null)
  const [numCards, setNumCards] = useState(10)
  const [difficulty, setDifficulty] = useState('medium')
  const [source, setSource] = useState(location.state?.topic || '')
  const [saving, setSaving] = useState(false)
  const [videoMeta, setVideoMeta] = useState(null) // YouTube metadata from edge function
  const [costInfo, setCostInfo] = useState(null)

  const detectSourceType = (text) => {
    if (isYouTubeUrl(text)) return 'youtube'
    if (text.startsWith('http')) return 'url'
    return 'topic'
  }

  const [pdfMeta, setPdfMeta] = useState(null) // PDF metadata from client-side extraction

  const handleGenerate = async (input, fileMeta) => {
    setSource(fileMeta?.fileName || input)
    setGenerating(true)
    setGeneratedCards([])
    setError(null)
    setVideoMeta(null)
    setPdfMeta(null)
    setCostInfo(null)

    const sourceType = fileMeta?.type === 'pdf' ? 'pdf' : detectSourceType(input)

    if (fileMeta?.type === 'pdf') {
      setPdfMeta({ fileName: fileMeta.fileName, pageCount: fileMeta.pageCount, wordCount: fileMeta.wordCount })
    }

    setStatus(
      sourceType === 'youtube' ? 'Connecting to YouTube...'
        : sourceType === 'pdf' ? `Processing ${fileMeta.fileName}...`
        : 'Analyzing your input...'
    )

    try {
      await streamGenerate({
        source: input,
        sourceType,
        numCards,
        difficulty,
        onChunk: (data) => {
          if (data.status) setStatus(data.status)
          if (data.meta) setVideoMeta(data.meta)
          if (data.cost) setCostInfo(data.cost)
          if (data.error) {
            setError(data.error)
            setGenerating(false)
          }
          if (data.card) {
            setGeneratedCards(prev => [...prev, data.card])
          }
          if (data.cards) {
            setGeneratedCards(data.cards)
          }
        },
        onDone: () => {
          if (!error) setStatus('Generation complete!')
          setGenerating(false)
        },
        onError: (err) => {
          setError(err.message)
          setGenerating(false)
        },
      })
    } catch (err) {
      setError(err.message)
      setGenerating(false)
    }
  }

  const handleFileUpload = async (file) => {
    setSource(file.name)
    setError(`${file.type || file.name.split('.').pop()} files are not supported yet — try a PDF, topic, or YouTube URL.`)
  }

  const handleSaveDeck = async () => {
    if (!generatedCards.length || !user) return
    setSaving(true)
    try {
      const sourceType = detectSourceType(source)

      // Use video title or PDF filename as deck name
      const title = videoMeta?.title
        ? videoMeta.title
        : pdfMeta?.fileName
        ? pdfMeta.fileName.replace(/\.pdf$/i, '')
        : source.slice(0, 60) + (source.length > 60 ? '...' : '')

      const description = videoMeta
        ? `${generatedCards.length} cards from "${videoMeta.title}" by ${videoMeta.channel}`
        : pdfMeta
        ? `${generatedCards.length} cards from "${pdfMeta.fileName}" (${pdfMeta.pageCount} pages)`
        : `${generatedCards.length} cards generated from ${sourceType}`

      const deck = await createDeck(user.id, {
        title,
        description,
        source,
        sourceType,
      })

      await insertCards(deck.id, generatedCards)
      navigate(`/library/${deck.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const isYouTube = isYouTubeUrl(source)
  const videoId = isYouTube ? extractVideoId(source) : null

  return (
    <div className="max-w-4xl mx-auto px-6 pt-8 pb-12">
      {/* Header */}
      <section className="mb-12 animate-fade-in">
        <h2 className="font-headline text-3xl md:text-4xl font-extrabold tracking-tight text-on-surface mb-4">
          Create Flashcards
        </h2>
        <p className="text-on-surface-variant text-lg leading-relaxed max-w-xl">
          Transform any topic, video, or document into study-ready flashcards with AI.
        </p>
      </section>

      {/* Settings */}
      <section className="flex flex-wrap gap-6 mb-8">
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">
            Cards
          </label>
          <div className="flex gap-2">
            {[5, 10, 15, 20].map(n => (
              <button
                key={n}
                onClick={() => setNumCards(n)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  numCards === n
                    ? 'primary-gradient text-on-primary editorial-shadow'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">
            Difficulty
          </label>
          <div className="flex gap-2">
            {['easy', 'medium', 'hard'].map(d => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`px-4 py-2 rounded-full text-sm font-medium capitalize transition-all ${
                  difficulty === d
                    ? 'primary-gradient text-on-primary editorial-shadow'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Input */}
      <InputBar
        onSubmit={handleGenerate}
        onFileUpload={handleFileUpload}
        loading={generating}
      />

      {/* YouTube metadata card — shown during/after generation */}
      {videoMeta && (
        <div className="mt-8 bg-surface-container-lowest rounded-2xl overflow-hidden editorial-shadow animate-scale-in">
          <div className="flex gap-4 p-5">
            {videoId && (
              <div className="relative flex-shrink-0 w-40 h-24 rounded-xl overflow-hidden bg-surface-container">
                <img
                  src={getThumbnailUrl(videoId, 'hqdefault')}
                  alt={videoMeta.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                  {videoMeta.duration}
                </div>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="material-symbols-outlined text-red-500 text-base">smart_display</span>
                <span className="text-[10px] uppercase tracking-widest text-red-500 font-bold">
                  YouTube · {videoMeta.language}
                </span>
              </div>
              <p className="font-headline font-semibold text-on-surface text-base leading-snug mb-1">
                {videoMeta.title}
              </p>
              <p className="text-on-surface-variant text-sm">{videoMeta.channel}</p>
              <div className="flex gap-4 mt-2 text-[11px] text-on-surface-variant">
                <span>{videoMeta.segmentCount} transcript segments</span>
                <span>{videoMeta.wordCount?.toLocaleString()} words</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF metadata card */}
      {pdfMeta && (
        <div className="mt-8 bg-surface-container-lowest rounded-2xl overflow-hidden editorial-shadow animate-scale-in">
          <div className="flex gap-4 p-5">
            <div className="relative flex-shrink-0 w-40 h-24 rounded-xl overflow-hidden bg-error-container/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-error text-5xl">picture_as_pdf</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="material-symbols-outlined text-error text-base">description</span>
                <span className="text-[10px] uppercase tracking-widest text-error font-bold">
                  PDF Document
                </span>
              </div>
              <p className="font-headline font-semibold text-on-surface text-base leading-snug mb-1">
                {pdfMeta.fileName}
              </p>
              <div className="flex gap-4 mt-2 text-[11px] text-on-surface-variant">
                <span>{pdfMeta.pageCount} pages</span>
                <span>{pdfMeta.wordCount?.toLocaleString()} words</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status */}
      {status && (
        <div className="mt-8 text-center animate-fade-in">
          <p className="text-on-surface-variant text-sm flex items-center justify-center gap-2">
            {generating && (
              <span className="material-symbols-outlined text-primary animate-spin text-base">progress_activity</span>
            )}
            {status}
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-6 text-center">
          <div className="inline-block text-xs text-error bg-error-container/20 px-4 py-3 rounded-lg max-w-md">
            {error}
          </div>
        </div>
      )}

      {/* Generated cards preview */}
      {generatedCards.length > 0 && (
        <section className="mt-12 animate-slide-up">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="font-headline text-xl font-bold">
                {generatedCards.length} Cards Generated
              </h3>
              {costInfo && (
                <p className="text-on-surface-variant text-xs mt-1">
                  Cost: ${costInfo.cost?.toFixed(4)} · {costInfo.inputTokens?.toLocaleString()} input + {costInfo.outputTokens?.toLocaleString()} output tokens
                </p>
              )}
            </div>
            <button
              onClick={handleSaveDeck}
              disabled={saving}
              className="primary-gradient text-on-primary px-8 py-3 rounded-full font-bold editorial-shadow pressable disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Deck'}
            </button>
          </div>

          <div className="space-y-6">
            {generatedCards.map((card, i) => (
              <div
                key={i}
                className="bg-surface-container-lowest rounded-2xl p-6 editorial-shadow animate-slide-up"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div className="flex items-start gap-4">
                  <span className="text-2xl font-headline font-black text-outline-variant/20 mt-1">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="flex-1">
                    <p className="font-headline font-semibold text-on-surface mb-3">{card.front}</p>
                    <p className="text-on-surface-variant text-sm leading-relaxed">{card.back}</p>
                    {card.explanation && (
                      <div className="mt-3 pt-3 border-t border-outline-variant/10">
                        <span className="text-[10px] uppercase tracking-widest text-primary font-bold">ELI5</span>
                        <p className="text-on-surface-variant text-xs mt-1 leading-relaxed">{card.explanation}</p>
                      </div>
                    )}
                    {card.mnemonic && (
                      <div className="mt-2">
                        <span className="text-[10px] uppercase tracking-widest text-tertiary font-bold">Mnemonic</span>
                        <p className="text-on-surface-variant text-xs mt-1 leading-relaxed">{card.mnemonic}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
