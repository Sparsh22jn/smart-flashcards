import { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react'
import { streamGenerate, incrementAiUsage } from '../lib/ai'

const GenerationContext = createContext(null)

const BATCH_SIZE = 12 // cards per edge-function call — fits well within timeout

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
  const cancelledRef = useRef(false)

  const reset = useCallback(() => {
    cancelledRef.current = true
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
    cancelledRef.current = false
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

    const cardLabel = sourceType === 'interview' ? 'questions' : 'cards'
    const allCards = []          // accumulator across batches
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let batchError = null

    const totalBatches = Math.ceil(numCards / BATCH_SIZE)

    try {
      for (let batch = 0; batch < totalBatches; batch++) {
        if (cancelledRef.current) break

        const batchCount = Math.min(BATCH_SIZE, numCards - allCards.length)
        const previousQuestions = allCards.map(c => c.front)

        if (totalBatches > 1) {
          setStatus(`Batch ${batch + 1}/${totalBatches} — generating ${cardLabel}...`)
        }

        await new Promise((resolve, reject) => {
          streamGenerate({
            source: input,
            sourceType,
            numCards: batchCount,
            difficulty,
            purpose,
            resumeFile,
            companyName,
            jobTitle,
            jobDescription,
            previousQuestions: previousQuestions.length > 0 ? previousQuestions : undefined,
            onChunk: (data) => {
              if (cancelledRef.current) return
              if (data.status) {
                const prefix = totalBatches > 1 ? `[${batch + 1}/${totalBatches}] ` : ''
                setStatus(prefix + data.status)
              }
              if (data.meta) setVideoMeta(data.meta)
              if (data.cost) {
                totalInputTokens += data.cost.inputTokens || 0
                totalOutputTokens += data.cost.outputTokens || 0
              }
              if (data.error) {
                batchError = data.error
              }
              if (data.card) {
                allCards.push(data.card)
                setGeneratedCards([...allCards])
              }
              if (data.cards) {
                allCards.push(...data.cards)
                setGeneratedCards([...allCards])
              }
            },
            onDone: () => resolve(),
            onError: (err) => {
              // If we already have cards, don't reject — just stop batching
              if (allCards.length > 0) {
                batchError = err.message
                resolve()
              } else {
                reject(err)
              }
            },
          })
        })

        // Stop batching if this batch errored or produced no new cards
        if (batchError) break
      }

      // Final state
      const totalCost = (totalInputTokens / 1_000_000) * 3.0 + (totalOutputTokens / 1_000_000) * 15.0
      if (totalInputTokens > 0) {
        setCostInfo({
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          cost: Math.round(totalCost * 10000) / 10000,
        })
      }

      if (allCards.length > 0) {
        setGeneratedCards([...allCards])
        setStatus(
          batchError
            ? `Partially complete — ${allCards.length} ${cardLabel} generated (batch error: ${batchError})`
            : `Generation complete! ${allCards.length} ${cardLabel} ready.`
        )
      } else if (batchError) {
        setError(batchError)
      } else {
        setStatus('Generation complete!')
      }

      setGenerating(false)
      incrementAiUsage().catch(() => {})

    } catch (err) {
      if (allCards.length > 0) {
        setGeneratedCards([...allCards])
        setStatus(`Partially complete — ${allCards.length} ${cardLabel} recovered.`)
      } else {
        setError(err.message)
      }
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
