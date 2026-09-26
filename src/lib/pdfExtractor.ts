// lib/pdfExtractor.ts
// Extract text from a PDF File object, page by page, client-side using pdf.js

import * as pdfjsLib from 'pdfjs-dist'

// Point to the worker bundled with pdfjs-dist
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

export interface ExtractedPage {
  pageNumber: number
  text: string
}

export interface ExtractedPDF {
  pages: ExtractedPage[]
  fullText: string
  pageCount: number
}

export async function extractTextFromPDF(file: File): Promise<ExtractedPDF> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const pages: ExtractedPage[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = content.items
      .map((item: any) => item.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    pages.push({ pageNumber: i, text })
  }

  const fullText = pages.map(p => p.text).join('\n\n')

  return {
    pages,
    fullText,
    pageCount: pdf.numPages
  }
}

// Chunk the full text into segments for RAG-style Q&A
export function chunkText(fullText: string, chunkSize = 1500, overlap = 200): string[] {
  const chunks: string[] = []
  for (let i = 0; i < fullText.length; i += chunkSize - overlap) {
    const chunk = fullText.slice(i, i + chunkSize).trim()
    if (chunk.length > 80) chunks.push(chunk)
  }
  return chunks
}
