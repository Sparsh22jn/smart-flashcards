/**
 * Client-side PDF text extraction using Mozilla's pdf.js.
 * Extracts text from all pages, returns content + metadata.
 */

import * as pdfjsLib from 'pdfjs-dist'

// Use the bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).href

/**
 * Extract text content from a PDF file.
 * @param {File} file - PDF File object from file input
 * @param {(progress: {page: number, total: number}) => void} onProgress - Optional progress callback
 * @returns {Promise<{text: string, pageCount: number, wordCount: number, fileName: string}>}
 */
export async function extractPdfText(file, onProgress) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const pageCount = pdf.numPages
  const pages = []

  for (let i = 1; i <= pageCount; i++) {
    onProgress?.({ page: i, total: pageCount })
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item) => item.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (pageText) pages.push(pageText)
  }

  const text = pages.join('\n\n')
  const wordCount = text.split(/\s+/).filter(Boolean).length

  return {
    text,
    pageCount,
    wordCount,
    fileName: file.name,
  }
}
