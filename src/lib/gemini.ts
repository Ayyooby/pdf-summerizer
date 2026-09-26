// lib/gemini.ts
// All Gemini API calls — summary, flashcards, Q&A

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

function getApiKey(): string {
  const key = import.meta.env.VITE_GEMINI_API_KEY
  if (!key) throw new Error('Gemini API key not found in VITE_GEMINI_API_KEY')
  return key
}

async function callGemini(prompt: string, retries = 3): Promise<string> {
  const apiKey = getApiKey()

  for (let attempt = 1; attempt <= retries; attempt++) {
    const response = await fetch(
      `${GEMINI_API_BASE}/gemini-3.8-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 4096,
          },
        }),
      }
    )

    // Retry on overload / rate limit
    if ((response.status === 503 || response.status === 429) && attempt < retries) {
      await new Promise(r => setTimeout(r, 2000 * attempt)) // 2s, 4s back-off
      continue
    }

    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error?.message || `Gemini API error ${response.status}`)
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) throw new Error('No response text from Gemini')
    return text
  }

  throw new Error('Gemini is under high demand right now. Please wait a moment and try again.')
}


// ---------- Summary ----------
export interface Summary {
  summaryText: string
  keyPoints: string[]
}

export async function generateSummary(pdfText: string): Promise<Summary> {
  // Use first 30k chars to stay within token limits
  const excerpt = pdfText.slice(0, 30000)

  const prompt = `You are an expert document summarizer. Analyze the following document and provide:
1. A comprehensive but concise summary (2-4 paragraphs)
2. A list of 5-8 key points

Respond ONLY with valid JSON in this exact format (no markdown code blocks):
{
  "summaryText": "Your summary here...",
  "keyPoints": ["Point 1", "Point 2", "Point 3"]
}

Document:
${excerpt}`

  const raw = await callGemini(prompt)

  // Strip possible markdown code fences
  const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  try {
    const parsed = JSON.parse(clean)
    return {
      summaryText: parsed.summaryText || parsed.summary_text || '',
      keyPoints: parsed.keyPoints || parsed.key_points || [],
    }
  } catch {
    // Fallback: return raw text as summary
    return { summaryText: raw, keyPoints: [] }
  }
}

// ---------- Flashcards ----------
export interface Flashcard {
  id: string
  question: string
  answer: string
  sourcePage: number
  difficulty: 'easy' | 'medium' | 'hard'
  // spaced-rep state
  interval: number      // days until next review
  easeFactor: number
  nextReview: Date
  lastReview: Date | null
}

export async function generateFlashcards(pdfText: string, count = 10): Promise<Flashcard[]> {
  const excerpt = pdfText.slice(0, 25000)

  const prompt = `You are an expert educator creating study flashcards. Based on the document below, generate exactly ${count} high-quality question-answer flashcard pairs.

Rules:
- Questions should test understanding, not just recall of trivial facts
- Answers should be concise but complete (1-3 sentences)
- Vary difficulty: some easy, some medium, some hard

Respond ONLY with a valid JSON array (no markdown code blocks):
[
  { "question": "...", "answer": "...", "sourcePage": 1, "difficulty": "medium" }
]

Document:
${excerpt}`

  const raw = await callGemini(prompt)
  const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

  try {
    const parsed: any[] = JSON.parse(clean)
    return parsed.map((fc, idx) => ({
      id: `fc-${Date.now()}-${idx}`,
      question: fc.question,
      answer: fc.answer,
      sourcePage: fc.sourcePage || fc.source_page || 1,
      difficulty: fc.difficulty || 'medium',
      interval: 1,
      easeFactor: 2.5,
      nextReview: new Date(),
      lastReview: null,
    }))
  } catch {
    throw new Error('Failed to parse flashcards from Gemini response')
  }
}

// ---------- Q&A Chat ----------
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  citedPages?: number[]
  timestamp: Date
}

export async function askQuestion(
  question: string,
  pdfText: string,
  chatHistory: ChatMessage[]
): Promise<{ answer: string; citedPages: number[] }> {
  // Build a simple conversation history string for context
  const historyStr = chatHistory
    .slice(-6) // last 3 turns
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n')

  // Use up to 25k chars of PDF text
  const docExcerpt = pdfText.slice(0, 25000)

  const prompt = `You are an intelligent document assistant. Answer questions strictly based on the document provided.

If the answer is found in the document, answer clearly and mention the approximate page number if possible (e.g. "Based on page 3, ...").
If the question cannot be answered from the document, say: "I couldn't find that in the document."

${chatHistory.length > 0 ? `Previous conversation:\n${historyStr}\n` : ''}

Document content:
${docExcerpt}

User's question: ${question}

Respond with valid JSON only (no markdown code blocks):
{ "answer": "Your answer here", "citedPages": [1, 2] }`

  const raw = await callGemini(prompt)
  const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

  try {
    const parsed = JSON.parse(clean)
    return {
      answer: parsed.answer || raw,
      citedPages: Array.isArray(parsed.citedPages) ? parsed.citedPages : [],
    }
  } catch {
    return { answer: raw, citedPages: [] }
  }
}

// ---------- SM-2 Spaced Repetition ----------
export type FlashcardRating = 'again' | 'hard' | 'good' | 'easy'

export function applySpacedRepetition(card: Flashcard, rating: FlashcardRating): Flashcard {
  const ratingMap = { again: 0, hard: 3, good: 4, easy: 5 }
  const q = ratingMap[rating]

  let { easeFactor, interval } = card

  if (q < 3) {
    interval = 1
  } else {
    if (interval === 1) interval = 6
    else interval = Math.round(interval * easeFactor)
    easeFactor = Math.max(1.3, easeFactor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  }

  const nextReview = new Date()
  nextReview.setDate(nextReview.getDate() + interval)

  return { ...card, interval, easeFactor, nextReview, lastReview: new Date() }
}
