import { createContext, useContext, useState, useCallback, useMemo } from 'react'
import { streamGenerate, incrementAiUsage } from '../lib/ai'

const GenerationContext = createContext(null)

export function GenerationProvider({ children }) {
  const [generating, setGenerating] = useState(false)
  const [generatedCards, setGeneratedCards] = useState([])
  const [status, setStatus] = useState('')
  const [error, setError] = useState(null)
  const [videoMeta, setVideoMeta] = useState(null)
  const [pdfMeta, setPdfMeta] = useState(null)
  const [costInfo, setCostInfo] = useState(null)
  const [activeSourceType, setActiveSourceType] = useState(null)
  const [sourceLabel, setSourceLabel] = useState('')

  const reset = useCallback(() => {
    setGenerating(false)
    setGeneratedCards([])
    setStatus('')
    setError(null)
    setVideoMeta(null)
    setPdfMeta(null)
    setCostInfo(null)
    setActiveSourceType(null)
    setSourceLabel('')
  }, [])

  const startGeneration = useCallback(async ({ input, fileMeta, sourceType, numCards, difficulty, purpose, resumeFile, companyName, jobTitle, jobDescription }) => {
    setGenerating(true)
    setGeneratedCards([])
    setError(null)
    setVideoMeta(null)
    setPdfMeta(null)
    setCostInfo(null)
    setActiveSourceType(sourceType)
    setSourceLabel(fileMeta?.fileName || input)

    if (fileMeta?.type === 'pdf') {
      setPdfMeta({ fileName: fileMeta.fileName, pageCount: fileMeta.pageCount, wordCount: fileMeta.wordCount })
    }

    setStatus(
      sourceType === 'interview' ? 'Analyzing your resume...'
        : sourceType === 'youtube' ? 'Connecting to YouTube...'
        : sourceType === 'pdf' ? `Processing ${fileMeta?.fileName}...`
        : 'Analyzing your input...'
    )

    try {
      await streamGenerate({
        source: input,
        sourceType,
        numCards,
        difficulty,
        purpose,
        resumeFile,
        companyName,
        jobTitle,
        jobDescription,
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
          setGeneratedCards(prev => {
            if (prev.length > 0) {
              setStatus(`Generation complete! ${prev.length} ${sourceType === 'interview' ? 'questions' : 'cards'} ready.`)
            } else {
              setStatus('Generation complete!')
            }
            return prev
          })
          setGenerating(false)
          incrementAiUsage().catch(() => {})
        },
        onError: (err) => {
          // If we already have some cards, don't lose them — just stop generating
          setGeneratedCards(prev => {
            if (prev.length > 0) {
              setStatus(`Stream ended early — ${prev.length} ${sourceType === 'interview' ? 'questions' : 'cards'} recovered.`)
              setGenerating(false)
              return prev
            }
            setError(err.message)
            setGenerating(false)
            return prev
          })
        },
      })
    } catch (err) {
      setError(err.message)
      setGenerating(false)
    }
  }, [])

  const value = useMemo(() => ({
    generating,
    generatedCards,
    status,
    error,
    videoMeta,
    pdfMeta,
    costInfo,
    activeSourceType,
    sourceLabel,
    startGeneration,
    reset,
  }), [generating, generatedCards, status, error, videoMeta, pdfMeta, costInfo, activeSourceType, sourceLabel, startGeneration, reset])

  return (
    <GenerationContext.Provider value={value}>
      {children}
    </GenerationContext.Provider>
  )
}

export function useGeneration() {
  const ctx = useContext(GenerationContext)
  if (!ctx) throw new Error('useGeneration must be used within GenerationProvider')
  return ctx
}
