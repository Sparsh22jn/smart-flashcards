import { useState, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import InputBar from '../components/InputBar'
import { createDeck, insertCards } from '../lib/data'
import { isYouTubeUrl, extractVideoId, getThumbnailUrl } from '../lib/youtube'
import { extractPdfText } from '../lib/pdf'
import LoadingScreen from '../components/LoadingScreen'
import { useGeneration } from '../contexts/GenerationContext'

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Generate page — create flashcards from any source.
 * Includes Interview Prep mode: upload resume + JD to generate targeted interview questions.
 */
export default function Generate({ user, onDeckCreated }) {
  const location = useLocation()
  const navigate = useNavigate()

  const {
    generating, generatedCards, status, error,
    videoMeta, pdfMeta, costInfo, activeSourceType, sourceLabel,
    startGeneration, reset,
  } = useGeneration()

  const [difficulty, setDifficulty] = useState('medium')
  const [purpose, setPurpose] = useState('general')
  const [source, setSource] = useState(location.state?.topic || '')
  const [saving, setSaving] = useState(false)

  // Interview Prep state
  const [resumePreview, setResumePreview] = useState(null)
  const [resumeLoading, setResumeLoading] = useState(false)
  const [resumeError, setResumeError] = useState(null)
  const [companyName, setCompanyName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [questionCount, setQuestionCount] = useState(25)
  const resumeFileRef = useRef(null)

  const isInterview = purpose === 'interview'

  const difficultyOptions = [
    { value: 'easy', label: 'Easy' },
    { value: 'medium', label: 'Medium' },
    { value: 'hard', label: 'Advanced' },
  ]

  const purposeOptions = [
    { value: 'general', label: 'General' },
    { value: 'interview', label: 'Interview Prep' },
    { value: 'exam', label: 'Exam Prep' },
  ]

  const detectSourceType = (text) => {
    if (isYouTubeUrl(text)) return 'youtube'
    if (text.startsWith('http')) return 'url'
    return 'topic'
  }

  const calculateCardCount = (input, sourceType, diff, fileMeta) => {
    if (sourceType === 'topic') {
      if (diff === 'easy') return 10
      if (diff === 'medium') return 25
      return 50 // advanced
    }
    // paste, pdf, youtube — scale with content length
    const wordCount = fileMeta?.wordCount || input.split(/\s+/).length
    if (diff === 'easy') return Math.max(5, Math.min(20, Math.round(wordCount / 100)))
    const mediumCount = Math.max(10, Math.min(40, Math.round(wordCount / 50)))
    if (diff === 'medium') return mediumCount
    return mediumCount + 15 // advanced: beyond the source
  }

  // Show estimated card count based on current source & difficulty
  const estimatedCards = (() => {
    if (isInterview) return questionCount
    if (!source && !pdfMeta) {
      return calculateCardCount('', 'topic', difficulty, null)
    }
    const st = pdfMeta ? 'pdf' : detectSourceType(source)
    return calculateCardCount(source, st, difficulty, pdfMeta)
  })()

  // ── Standard generation handler ───────────────────────────────────
  const handleGenerate = async (input, fileMeta) => {
    setSource(fileMeta?.fileName || input)
    const sourceType = fileMeta?.type === 'pdf' ? 'pdf' : detectSourceType(input)
    const numCards = calculateCardCount(input, sourceType, difficulty, fileMeta)

    startGeneration({ input, fileMeta, sourceType, numCards, difficulty, purpose })
  }

  const handleFileUpload = async (file) => {
    setSource(file.name)
    reset()
  }

  // ── Interview Prep handlers ───────────────────────────────────────
  const handleResumeUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setResumeLoading(true)
    setResumeError(null)
    try {
      // base64 is required (sent to Claude); text extraction is optional (for preview metadata)
      const [base64, textResult] = await Promise.allSettled([
        readFileAsBase64(file),
        extractPdfText(file),
      ])

      if (base64.status === 'rejected') {
        throw new Error('Could not read file')
      }

      const meta = textResult.status === 'fulfilled' ? textResult.value : null
      setResumePreview({
        fileName: file.name,
        pageCount: meta?.pageCount ?? '?',
        wordCount: meta?.wordCount ?? 0,
        base64Data: base64.value,
        mediaType: file.type || 'application/pdf',
      })
    } catch (err) {
      console.error('Resume upload error:', err)
      setResumeError('Failed to read file. Please make sure it\'s a valid PDF.')
    } finally {
      setResumeLoading(false)
    }
  }

  const handleInterviewGenerate = () => {
    if (!resumePreview) return

    setSource(resumePreview.fileName)
    startGeneration({
      input: resumePreview.fileName,
      sourceType: 'interview',
      numCards: questionCount,
      difficulty,
      purpose: 'interview',
      resumeFile: {
        data: resumePreview.base64Data,
        mediaType: resumePreview.mediaType,
        fileName: resumePreview.fileName,
      },
      companyName: companyName.trim() || null,
      jobTitle: jobTitle.trim() || null,
      jobDescription: jobDescription.trim() || null,
    })
  }

  // ── Save deck ─────────────────────────────────────────────────────
  const handleSaveDeck = async () => {
    if (!generatedCards.length || !user) return
    setSaving(true)
    try {
      const src = sourceLabel || source
      let title, description, sourceType

      if (isInterview || activeSourceType === 'interview') {
        // Auto-name: "Interview Prep: Google - Senior Data Scientist"
        const co = companyName.trim()
        const jt = jobTitle.trim()
        title = co && jt ? `Interview Prep: ${co} - ${jt}`
          : co ? `Interview Prep: ${co}`
          : jt ? `Interview Prep: ${jt}`
          : 'Interview Prep'

        description = `${generatedCards.length} interview questions based on resume${jobDescription.trim() ? ' + job description' : ''}`
        sourceType = 'interview'
      } else {
        sourceType = detectSourceType(src)
        title = videoMeta?.title
          ? videoMeta.title
          : pdfMeta?.fileName
          ? pdfMeta.fileName.replace(/\.pdf$/i, '')
          : src.slice(0, 60) + (src.length > 60 ? '...' : '')
        description = videoMeta
          ? `${generatedCards.length} cards from "${videoMeta.title}" by ${videoMeta.channel}`
          : pdfMeta
          ? `${generatedCards.length} cards from "${pdfMeta.fileName}" (${pdfMeta.pageCount} pages)`
          : `${generatedCards.length} cards generated from ${sourceType}`
      }

      const deck = await createDeck(user.id, {
        title,
        description,
        source: src,
        sourceType,
      })

      await insertCards(deck.id, generatedCards)
      onDeckCreated?.()
      reset()
      navigate(`/library/${deck.id}`)
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const displaySource = sourceLabel || source
  const isYouTube = isYouTubeUrl(displaySource)
  const videoId = isYouTube ? extractVideoId(displaySource) : null

  if (generating && generatedCards.length === 0) {
    return (
      <LoadingScreen
        source={sourceLabel}
        sourceType={activeSourceType}
        status={status}
      />
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-6 pt-8 pb-12">
      {/* Header */}
      <section className="mb-12 animate-fade-in">
        <h2 className="font-headline text-3xl md:text-4xl font-extrabold tracking-tight text-on-surface mb-4">
          {isInterview ? 'Interview Prep' : 'Create Flashcards'}
        </h2>
        <p className="text-on-surface-variant text-lg leading-relaxed max-w-xl">
          {isInterview
            ? 'Upload your resume and job description to generate targeted interview questions.'
            : 'Transform any topic, video, or document into study-ready flashcards with AI.'
          }
        </p>
      </section>

      {/* Settings */}
      <section className="flex flex-wrap items-end gap-6 mb-8">
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">
            Purpose
          </label>
          <div className="flex gap-2">
            {purposeOptions.map(p => (
              <button
                key={p.value}
                onClick={() => setPurpose(p.value)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  purpose === p.value
                    ? 'primary-gradient text-on-primary editorial-shadow'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">
            {isInterview ? 'Depth' : 'Difficulty'}
          </label>
          <div className="flex gap-2">
            {difficultyOptions.map(d => (
              <button
                key={d.value}
                onClick={() => setDifficulty(d.value)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  difficulty === d.value
                    ? 'primary-gradient text-on-primary editorial-shadow'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
        {isInterview && (
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">
              Questions
            </label>
            <div className="flex gap-2">
              {[10, 25, 50].map(n => (
                <button
                  key={n}
                  onClick={() => setQuestionCount(n)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    questionCount === n
                      ? 'primary-gradient text-on-primary editorial-shadow'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
        {estimatedCards && !isInterview && (
          <span className="text-sm text-on-surface-variant font-medium pb-2">
            ~{estimatedCards} cards
          </span>
        )}
      </section>

      {/* ── Interview Prep Panel ─────────────────────────────────────── */}
      {isInterview && (
        <section className="mb-8 space-y-6 animate-fade-in">
          {/* Resume upload */}
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">
              Resume <span className="text-primary">*</span>
            </label>
            {!resumePreview ? (
              <button
                type="button"
                onClick={() => resumeFileRef.current?.click()}
                disabled={resumeLoading}
                className="w-full border-2 border-dashed border-outline-variant/20 rounded-2xl p-8 text-center cursor-pointer hover:border-primary/30 hover:bg-surface-container-lowest/50 transition-all"
              >
                {resumeLoading ? (
                  <>
                    <span className="material-symbols-outlined text-primary text-3xl mb-2 animate-spin">progress_activity</span>
                    <p className="text-on-surface-variant text-sm">Processing resume...</p>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-primary text-3xl mb-2">upload_file</span>
                    <p className="text-on-surface-variant text-sm">Click to upload your resume</p>
                    <p className="text-on-surface-variant/50 text-xs mt-1">PDF format</p>
                  </>
                )}
              </button>
            ) : (
              <div className="bg-surface-container-lowest rounded-2xl p-4 editorial-shadow flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-primary text-xl">description</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-on-surface text-sm truncate">{resumePreview.fileName}</p>
                  <p className="text-xs text-on-surface-variant">
                    {resumePreview.pageCount !== '?' ? `${resumePreview.pageCount} page${resumePreview.pageCount !== 1 ? 's' : ''}` : 'PDF'}
                    {resumePreview.wordCount > 0 ? ` · ${resumePreview.wordCount.toLocaleString()} words` : ''}
                  </p>
                </div>
                <button
                  onClick={() => setResumePreview(null)}
                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            )}
            <input ref={resumeFileRef} type="file" className="hidden" accept=".pdf" onChange={handleResumeUpload} />
            {resumeError && (
              <p className="text-error text-xs mt-2">{resumeError}</p>
            )}
          </div>

          {/* Company name + Job title row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">
                Company Name <span className="text-on-surface-variant/40">(optional)</span>
              </label>
              <input
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="e.g., Google, Meta, Stripe"
                className="w-full bg-surface-container-lowest rounded-xl px-4 py-3 text-on-surface text-sm border-none focus:ring-1 focus:ring-outline-variant/20 placeholder:text-on-surface-variant/40"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">
                Job Title <span className="text-on-surface-variant/40">(optional)</span>
              </label>
              <input
                type="text"
                value={jobTitle}
                onChange={e => setJobTitle(e.target.value)}
                placeholder="e.g., Senior Data Scientist"
                className="w-full bg-surface-container-lowest rounded-xl px-4 py-3 text-on-surface text-sm border-none focus:ring-1 focus:ring-outline-variant/20 placeholder:text-on-surface-variant/40"
              />
            </div>
          </div>

          {/* Job description */}
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">
              Job Description <span className="text-on-surface-variant/40">(optional — greatly improves question relevance)</span>
            </label>
            <textarea
              value={jobDescription}
              onChange={e => setJobDescription(e.target.value)}
              placeholder="Paste the full job description including responsibilities, requirements, and company details..."
              className="w-full bg-surface-container-lowest rounded-xl p-4 text-on-surface text-sm border-none focus:ring-1 focus:ring-outline-variant/20 resize-none placeholder:text-on-surface-variant/40"
              rows={6}
            />
          </div>

          {/* Generate button */}
          <button
            onClick={handleInterviewGenerate}
            disabled={!resumePreview || generating}
            className="w-full py-4 rounded-full primary-gradient text-on-primary font-bold text-lg editorial-shadow pressable disabled:opacity-40 transition-opacity"
          >
            {generating ? 'Generating...' : `Generate ${questionCount} Interview Questions`}
          </button>
        </section>
      )}

      {/* ── Standard Input (hidden in interview mode) ────────────────── */}
      {!isInterview && (
        <InputBar
          onSubmit={handleGenerate}
          onFileUpload={handleFileUpload}
          loading={generating}
        />
      )}

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
                {generatedCards.length} {activeSourceType === 'interview' ? 'Questions' : 'Cards'} Generated
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
                        <span className="text-[10px] uppercase tracking-widest text-primary font-bold">
                          {activeSourceType === 'interview' ? 'What They Evaluate' : 'ELI5'}
                        </span>
                        <p className="text-on-surface-variant text-xs mt-1 leading-relaxed">{card.explanation}</p>
                      </div>
                    )}
                    {card.mnemonic && (
                      <div className="mt-2">
                        <span className="text-[10px] uppercase tracking-widest text-tertiary font-bold">
                          {activeSourceType === 'interview' ? 'Key Points' : 'Mnemonic'}
                        </span>
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
