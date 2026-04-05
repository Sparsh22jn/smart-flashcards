import { useState, useRef, useEffect } from 'react'
import { isYouTubeUrl, extractVideoId, getThumbnailUrl, fetchVideoMeta } from '../lib/youtube'
import { extractPdfText } from '../lib/pdf'

/**
 * Chat-style input bar for generating flashcards.
 * Based on Welcome2.html (Quiet_Entry) Stitch design.
 * Live-detects YouTube URLs and shows a preview card.
 * Supports PDF upload with preview and text extraction.
 */
export default function InputBar({ onSubmit, onFileUpload, loading }) {
  const [value, setValue] = useState('')
  const [ytPreview, setYtPreview] = useState(null)  // { videoId, title, channel, thumbnail }
  const [ytLoading, setYtLoading] = useState(false)
  const [pdfPreview, setPdfPreview] = useState(null) // { fileName, pageCount, wordCount, text }
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfProgress, setPdfProgress] = useState(null) // { page, total }
  const fileRef = useRef(null)
  const debounceRef = useRef(null)

  // Detect YouTube URL as user types and fetch preview
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!isYouTubeUrl(value)) {
      setYtPreview(null)
      return
    }

    const videoId = extractVideoId(value)
    if (!videoId) {
      setYtPreview(null)
      return
    }

    // Debounce the metadata fetch
    debounceRef.current = setTimeout(async () => {
      setYtLoading(true)
      try {
        const meta = await fetchVideoMeta(value)
        if (meta) {
          setYtPreview({
            videoId,
            title: meta.title,
            channel: meta.author_name,
            thumbnail: getThumbnailUrl(videoId, 'hqdefault'),
          })
        } else {
          // oEmbed failed — still show thumbnail
          setYtPreview({
            videoId,
            title: null,
            channel: null,
            thumbnail: getThumbnailUrl(videoId, 'hqdefault'),
          })
        }
      } catch {
        setYtPreview(null)
      } finally {
        setYtLoading(false)
      }
    }, 400)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [value])

  const handleSubmit = (e) => {
    e?.preventDefault()
    if (pdfPreview) {
      onSubmit(pdfPreview.text, { type: 'pdf', ...pdfPreview })
      setPdfPreview(null)
      setValue('')
      return
    }
    if (!value.trim() || loading) return
    onSubmit(value.trim())
    setValue('')
    setYtPreview(null)
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      setPdfLoading(true)
      setPdfProgress(null)
      setYtPreview(null)
      setValue('')
      try {
        const result = await extractPdfText(file, (p) => setPdfProgress(p))
        setPdfPreview(result)
      } catch {
        setPdfPreview(null)
        onFileUpload?.(file) // fallback to parent handler
      } finally {
        setPdfLoading(false)
        setPdfProgress(null)
      }
    } else {
      onFileUpload?.(file)
    }
  }

  const inputType = pdfPreview ? 'pdf' : isYouTubeUrl(value) ? 'youtube' : 'topic'

  return (
    <div className="w-full max-w-3xl mx-auto px-4">
      {/* YouTube Preview Card */}
      {ytPreview && (
        <div className="mb-4 bg-surface-container-lowest rounded-2xl overflow-hidden editorial-shadow animate-scale-in">
          <div className="flex gap-4 p-4">
            {/* Thumbnail */}
            <div className="relative flex-shrink-0 w-32 h-20 rounded-xl overflow-hidden bg-surface-container">
              <img
                src={ytPreview.thumbnail}
                alt={ytPreview.title || 'Video thumbnail'}
                className="w-full h-full object-cover"
                onError={(e) => { e.target.style.display = 'none' }}
              />
              {/* Play icon overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center">
                  <span className="material-symbols-outlined text-on-surface text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                    play_arrow
                  </span>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-red-500 text-base">smart_display</span>
                <span className="text-[10px] uppercase tracking-widest text-red-500 font-bold">YouTube Video</span>
              </div>
              {ytPreview.title ? (
                <>
                  <p className="font-headline font-semibold text-on-surface text-sm leading-snug line-clamp-2">
                    {ytPreview.title}
                  </p>
                  {ytPreview.channel && (
                    <p className="text-on-surface-variant text-xs mt-1">{ytPreview.channel}</p>
                  )}
                </>
              ) : ytLoading ? (
                <p className="text-on-surface-variant text-xs">Loading video info...</p>
              ) : (
                <p className="text-on-surface-variant text-xs">Video ID: {ytPreview.videoId}</p>
              )}
            </div>

            {/* Close */}
            <button
              onClick={() => { setValue(''); setYtPreview(null) }}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors self-start"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>

          {/* Transcript info strip */}
          <div className="px-4 py-2.5 bg-surface-container-low flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-sm">subtitles</span>
            <span className="text-[11px] text-on-surface-variant">
              Transcript will be extracted automatically and converted to flashcards
            </span>
          </div>
        </div>
      )}

      {/* PDF Preview Card */}
      {(pdfPreview || pdfLoading) && (
        <div className="mb-4 bg-surface-container-lowest rounded-2xl overflow-hidden editorial-shadow animate-scale-in">
          <div className="flex gap-4 p-4">
            {/* PDF Icon */}
            <div className="relative flex-shrink-0 w-32 h-20 rounded-xl overflow-hidden bg-error-container/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-error text-4xl">picture_as_pdf</span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-error text-base">description</span>
                <span className="text-[10px] uppercase tracking-widest text-error font-bold">PDF Document</span>
              </div>
              {pdfPreview ? (
                <>
                  <p className="font-headline font-semibold text-on-surface text-sm leading-snug line-clamp-2">
                    {pdfPreview.fileName}
                  </p>
                  <div className="flex gap-4 mt-1 text-[11px] text-on-surface-variant">
                    <span>{pdfPreview.pageCount} pages</span>
                    <span>{pdfPreview.wordCount.toLocaleString()} words</span>
                  </div>
                </>
              ) : pdfLoading ? (
                <p className="text-on-surface-variant text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary animate-spin text-sm">progress_activity</span>
                  {pdfProgress
                    ? `Extracting page ${pdfProgress.page} of ${pdfProgress.total}...`
                    : 'Reading PDF...'}
                </p>
              ) : null}
            </div>

            {/* Close */}
            {pdfPreview && (
              <button
                onClick={() => setPdfPreview(null)}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors self-start"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </div>

          {/* Info strip */}
          {pdfPreview && (
            <div className="px-4 py-2.5 bg-surface-container-low flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-sm">auto_awesome</span>
              <span className="text-[11px] text-on-surface-variant">
                Text extracted — press generate to create flashcards
              </span>
            </div>
          )}
        </div>
      )}

      {/* Input form */}
      <form onSubmit={handleSubmit}>
        <div className={`relative group bg-surface-container-lowest editorial-shadow rounded-full p-2 flex items-center transition-all focus-within:ring-1 ${
          inputType === 'youtube'
            ? 'focus-within:ring-red-400/30 ring-1 ring-red-400/20'
            : 'focus-within:ring-outline-variant/20'
        }`}>
          {/* Left action icons */}
          <div className="flex items-center gap-1 pl-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors"
              title="Upload PDF or document"
            >
              <span className="material-symbols-outlined">upload_file</span>
            </button>
            <button
              type="button"
              className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${
                inputType === 'youtube'
                  ? 'text-red-500 bg-red-50'
                  : 'text-on-surface-variant hover:bg-surface-container'
              }`}
              title="YouTube link"
              onClick={() => {
                if (!value.includes('youtube') && !value.includes('youtu.be')) {
                  setValue('https://youtube.com/watch?v=')
                }
              }}
            >
              <span className="material-symbols-outlined">smart_display</span>
            </button>
          </div>

          {/* Text input */}
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Paste a topic, YouTube link, or upload a file..."
            className="flex-1 bg-transparent border-none focus:ring-0 text-on-surface placeholder:text-on-surface-variant/60 font-body px-4 py-3 text-lg"
            disabled={loading}
          />

          {/* Submit button */}
          <button
            type="submit"
            disabled={(!value.trim() && !pdfPreview) || loading || pdfLoading}
            className={`w-12 h-12 flex items-center justify-center rounded-full text-white editorial-shadow transition-transform active:scale-95 disabled:opacity-40 ${
              inputType === 'youtube'
                ? 'bg-red-500'
                : inputType === 'pdf'
                ? 'bg-error'
                : 'primary-gradient'
            }`}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: "'FILL' 0, 'wght' 600" }}
            >
              {loading ? 'hourglass_top' : 'arrow_upward'}
            </span>
          </button>
        </div>
      </form>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.pptx,.txt,.csv,.jpg,.jpeg,.png"
        onChange={handleFileChange}
      />

      {/* Subtext — contextual */}
      <p className="text-center text-on-surface-variant/40 text-[10px] mt-3 font-body tracking-wider uppercase">
        {inputType === 'youtube'
          ? 'Transcript will be extracted and converted to study cards.'
          : inputType === 'pdf'
          ? 'PDF text extracted — ready to generate flashcards.'
          : 'An intellectual sanctuary for focused learning.'}
      </p>
    </div>
  )
}
