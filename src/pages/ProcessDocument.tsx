import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Sparkles, BookOpen, MessageSquare, ArrowLeft,
  ChevronLeft, ChevronRight, RotateCcw, Check,
  Send, FileText, Loader2, Copy, Clock, Star
} from 'lucide-react'
import {
  generateSummary, generateFlashcards, askQuestion,
  applySpacedRepetition,
  type Summary, type Flashcard, type ChatMessage, type FlashcardRating
} from '../lib/gemini'

type Tab = 'summary' | 'flashcards' | 'chat'

export default function ProcessDocument() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as {
    fileName: string
    pageCount: number
    fullText: string
    pages: { pageNumber: number; text: string }[]
  } | null

  const [activeTab, setActiveTab] = useState<Tab>('summary')

  // Summary
  const [summary, setSummary] = useState<Summary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  // Flashcards
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [flashcardsLoading, setFlashcardsLoading] = useState(false)
  const [flashcardsError, setFlashcardsError] = useState<string | null>(null)
  const [cardIndex, setCardIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  // Redirect home if no state
  useEffect(() => {
    if (!state) navigate('/')
  }, [state, navigate])

  // Auto-generate summary on mount
  useEffect(() => {
    if (state?.fullText && !summary && !summaryLoading) {
      handleGenerateSummary()
    }
  }, [state])

  // Scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  if (!state) return null

  // ---------- Summary ----------
  const handleGenerateSummary = async () => {
    setSummaryLoading(true)
    setSummaryError(null)
    try {
      const result = await generateSummary(state.fullText)
      setSummary(result)
    } catch (e: any) {
      setSummaryError(e.message)
    } finally {
      setSummaryLoading(false)
    }
  }

  // ---------- Flashcards ----------
  const handleGenerateFlashcards = async () => {
    setFlashcardsLoading(true)
    setFlashcardsError(null)
    setCardIndex(0)
    setIsFlipped(false)
    try {
      const result = await generateFlashcards(state.fullText, 12)
      setFlashcards(result)
    } catch (e: any) {
      setFlashcardsError(e.message)
    } finally {
      setFlashcardsLoading(false)
    }
  }

  const handleFlashcardRating = (rating: FlashcardRating) => {
    setFlashcards(prev => {
      const updated = [...prev]
      updated[cardIndex] = applySpacedRepetition(updated[cardIndex], rating)
      return updated
    })
    setIsFlipped(false)
    setTimeout(() => {
      if (cardIndex < flashcards.length - 1) setCardIndex(i => i + 1)
      else setCardIndex(0) // loop back
    }, 150)
  }

  // ---------- Chat ----------
  const handleSend = async () => {
    const q = chatInput.trim()
    if (!q || chatLoading) return
    setChatInput('')

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: q,
      timestamp: new Date(),
    }
    setChatMessages(prev => [...prev, userMsg])
    setChatLoading(true)

    try {
      const { answer, citedPages } = await askQuestion(q, state.fullText, chatMessages)
      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: answer,
        citedPages,
        timestamp: new Date(),
      }
      setChatMessages(prev => [...prev, assistantMsg])
    } catch (e: any) {
      setChatMessages(prev => [
        ...prev,
        { id: `err-${Date.now()}`, role: 'assistant', content: `Error: ${e.message}`, timestamp: new Date() },
      ])
    } finally {
      setChatLoading(false)
    }
  }

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'summary', label: 'Summary', icon: Sparkles },
    { id: 'flashcards', label: 'Flashcards', icon: BookOpen },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
  ]

  const currentCard = flashcards[cardIndex]
  const ratingButtons: { label: string; rating: FlashcardRating; color: string }[] = [
    { label: 'Again', rating: 'again', color: 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' },
    { label: 'Hard', rating: 'hard', color: 'bg-orange-500/10 border-orange-500/20 text-orange-400 hover:bg-orange-500/20' },
    { label: 'Good', rating: 'good', color: 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20' },
    { label: 'Easy', rating: 'easy', color: 'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20' },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="glass border-b border-white/5 px-6 py-3 flex items-center gap-4 sticky top-0 z-20">
        <button
          onClick={() => navigate('/')}
          className="p-2 rounded-xl glass border border-white/5 hover:border-indigo-500/30 text-slate-400 hover:text-indigo-400 transition-all"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 bg-indigo-500/10 border border-indigo-500/20 rounded-lg flex items-center justify-center shrink-0">
            <FileText size={14} className="text-indigo-400" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-200 truncate">{state.fileName}</div>
            <div className="text-xs text-slate-500">{state.pageCount} pages · {Math.round(state.fullText.length / 4)} tokens</div>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex glass rounded-xl p-1 border border-white/5 gap-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                setActiveTab(id)
                if (id === 'flashcards' && flashcards.length === 0 && !flashcardsLoading) {
                  handleGenerateFlashcards()
                }
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === id
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">

        {/* ======== SUMMARY TAB ======== */}
        {activeTab === 'summary' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold gradient-text">Executive Summary</h2>
              {summary && (
                <button
                  onClick={handleGenerateSummary}
                  disabled={summaryLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl glass border border-white/5 hover:border-indigo-500/30 text-slate-400 hover:text-indigo-400 text-sm transition-all"
                >
                  <RotateCcw size={14} />
                  Regenerate
                </button>
              )}
            </div>

            {summaryLoading ? (
              <div className="space-y-4">
                <div className="glass rounded-2xl p-8 text-center">
                  <Loader2 size={32} className="text-indigo-400 animate-spin mx-auto mb-4" />
                  <p className="text-slate-400">Gemini is analyzing your document…</p>
                </div>
              </div>
            ) : summaryError ? (
              <div className="glass rounded-2xl p-6 border border-red-500/20 text-red-400">
                <p className="font-medium mb-2">Failed to generate summary</p>
                <p className="text-sm text-red-400/70 mb-4">{summaryError}</p>
                <button onClick={handleGenerateSummary} className="text-sm px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors">
                  Try again
                </button>
              </div>
            ) : summary ? (
              <div className="space-y-6">
                {/* Main summary */}
                <div className="glass rounded-2xl p-6 border border-white/5">
                  <p className="text-slate-300 leading-relaxed text-lg">{summary.summaryText}</p>
                  <button
                    onClick={() => navigator.clipboard.writeText(summary.summaryText)}
                    className="mt-4 flex items-center gap-2 text-xs text-slate-500 hover:text-indigo-400 transition-colors"
                  >
                    <Copy size={12} /> Copy summary
                  </button>
                </div>

                {/* Key Points */}
                {summary.keyPoints.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                      <Star size={18} className="text-yellow-400" />
                      Key Points
                    </h3>
                    <div className="grid gap-3">
                      {summary.keyPoints.map((pt, idx) => (
                        <div key={idx} className="glass rounded-xl p-4 border border-white/5 flex items-start gap-3 hover:border-indigo-500/20 transition-colors">
                          <span className="w-6 h-6 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-xs font-bold text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <p className="text-slate-300 text-sm leading-relaxed">{pt}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* ======== FLASHCARDS TAB ======== */}
        {activeTab === 'flashcards' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold gradient-text">Flashcards</h2>
              {flashcards.length > 0 && (
                <button
                  onClick={handleGenerateFlashcards}
                  disabled={flashcardsLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl glass border border-white/5 hover:border-indigo-500/30 text-slate-400 hover:text-indigo-400 text-sm transition-all"
                >
                  <RotateCcw size={14} />
                  Regenerate
                </button>
              )}
            </div>

            {flashcardsLoading ? (
              <div className="glass rounded-2xl p-12 text-center border border-white/5">
                <Loader2 size={32} className="text-indigo-400 animate-spin mx-auto mb-4" />
                <p className="text-slate-400">Generating flashcards with Gemini…</p>
              </div>
            ) : flashcardsError ? (
              <div className="glass rounded-2xl p-6 border border-red-500/20 text-red-400">
                <p className="font-medium mb-2">Failed to generate flashcards</p>
                <p className="text-sm text-red-400/70 mb-4">{flashcardsError}</p>
                <button onClick={handleGenerateFlashcards} className="text-sm px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors">
                  Try again
                </button>
              </div>
            ) : flashcards.length > 0 ? (
              <div>
                {/* Progress */}
                <div className="flex items-center justify-between mb-4 text-sm text-slate-500">
                  <span>Card {cardIndex + 1} of {flashcards.length}</span>
                  <div className="flex items-center gap-2">
                    <Clock size={14} />
                    <span>Due: {currentCard.nextReview.toLocaleDateString()}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                      currentCard.difficulty === 'easy' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                      currentCard.difficulty === 'hard' ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' :
                      'bg-blue-500/10 border-blue-500/20 text-blue-400'
                    }`}>
                      {currentCard.difficulty}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1 bg-slate-800 rounded-full mb-8 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full transition-all duration-300"
                    style={{ width: `${((cardIndex + 1) / flashcards.length) * 100}%` }}
                  />
                </div>

                {/* Card */}
                <div
                  onClick={() => setIsFlipped(f => !f)}
                  className="cursor-pointer mb-6"
                  style={{ perspective: 1000 }}
                >
                  <div
                    className="relative transition-all duration-500"
                    style={{
                      transformStyle: 'preserve-3d',
                      transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                      minHeight: 260,
                    }}
                  >
                    {/* Front */}
                    <div
                      className="absolute inset-0 glass rounded-3xl p-8 flex flex-col items-center justify-center border border-white/5 hover:border-indigo-500/20 transition-colors"
                      style={{ backfaceVisibility: 'hidden' }}
                    >
                      <div className="text-xs text-slate-500 uppercase tracking-widest mb-4 font-medium">Question</div>
                      <h3 className="text-xl font-semibold text-slate-200 text-center leading-relaxed">{currentCard.question}</h3>
                      <p className="text-slate-500 text-sm mt-6">Click to reveal answer</p>
                    </div>

                    {/* Back */}
                    <div
                      className="absolute inset-0 glass rounded-3xl p-8 flex flex-col items-center justify-center border border-indigo-500/20 bg-indigo-500/5"
                      style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                    >
                      <div className="text-xs text-indigo-400 uppercase tracking-widest mb-4 font-medium">Answer</div>
                      <p className="text-lg text-slate-200 text-center leading-relaxed">{currentCard.answer}</p>
                      {currentCard.sourcePage && (
                        <span className="mt-4 px-3 py-1 glass border border-white/5 rounded-full text-xs text-slate-500">
                          Page {currentCard.sourcePage}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Rating buttons (shown when flipped) */}
                {isFlipped ? (
                  <div>
                    <p className="text-center text-sm text-slate-500 mb-3">How well did you know this?</p>
                    <div className="grid grid-cols-4 gap-3">
                      {ratingButtons.map(({ label, rating, color }) => (
                        <button
                          key={rating}
                          onClick={() => handleFlashcardRating(rating)}
                          className={`py-3 rounded-xl border text-sm font-semibold transition-all ${color}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => { setIsFlipped(false); setCardIndex(i => Math.max(0, i - 1)) }}
                      disabled={cardIndex === 0}
                      className="flex items-center gap-2 px-5 py-3 glass rounded-xl border border-white/5 hover:border-indigo-500/20 text-slate-400 disabled:opacity-30 transition-all text-sm"
                    >
                      <ChevronLeft size={16} /> Prev
                    </button>
                    <button
                      onClick={() => setIsFlipped(true)}
                      className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20"
                    >
                      <Check size={16} /> Flip Card
                    </button>
                    <button
                      onClick={() => { setIsFlipped(false); setCardIndex(i => Math.min(flashcards.length - 1, i + 1)) }}
                      disabled={cardIndex === flashcards.length - 1}
                      className="flex items-center gap-2 px-5 py-3 glass rounded-xl border border-white/5 hover:border-indigo-500/20 text-slate-400 disabled:opacity-30 transition-all text-sm"
                    >
                      Next <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* ======== CHAT TAB ======== */}
        {activeTab === 'chat' && (
          <div className="flex flex-col h-[calc(100vh-10rem)]">
            <h2 className="text-2xl font-bold gradient-text mb-6">Chat with your PDF</h2>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
              {chatMessages.length === 0 && (
                <div className="glass rounded-2xl p-6 border border-white/5 text-center">
                  <MessageSquare size={32} className="text-indigo-400 mx-auto mb-3 opacity-50" />
                  <p className="text-slate-400 mb-4">Ask anything about your document</p>
                  <div className="grid grid-cols-1 gap-2 text-left">
                    {[
                      `What is the main argument of this document?`,
                      `Summarize the key findings`,
                      `What are the conclusions?`,
                    ].map(q => (
                      <button
                        key={q}
                        onClick={() => { setChatInput(q) }}
                        className="text-sm text-slate-400 hover:text-indigo-300 text-left px-4 py-2 glass rounded-xl border border-white/5 hover:border-indigo-500/20 transition-all"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {chatMessages.map(msg => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-purple-500/20 border border-purple-500/20 text-purple-400'
                  }`}>
                    {msg.role === 'user' ? 'U' : 'AI'}
                  </div>
                  <div className={`max-w-[80%] rounded-2xl px-5 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'glass border border-white/5 text-slate-300 rounded-tl-none'
                  }`}>
                    {msg.content}
                    {msg.citedPages && msg.citedPages.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {msg.citedPages.map(p => (
                          <span key={p} className="px-2 py-0.5 bg-white/10 rounded text-xs text-indigo-300 border border-indigo-500/20">
                            p.{p}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/20 flex items-center justify-center text-xs font-bold text-purple-400 shrink-0">AI</div>
                  <div className="glass border border-white/5 rounded-2xl rounded-tl-none px-5 py-4">
                    <div className="flex gap-1 items-center">
                      <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>

            {/* Input */}
            <div className="glass rounded-2xl border border-white/5 p-2 flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Ask about this document…"
                disabled={chatLoading}
                className="flex-1 bg-transparent px-3 py-2 text-slate-200 placeholder-slate-600 outline-none text-sm"
              />
              <button
                onClick={handleSend}
                disabled={chatLoading || !chatInput.trim()}
                className="p-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-white transition-all"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
