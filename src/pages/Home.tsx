import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, FileText, Sparkles, BookOpen, MessageSquare, AlertCircle, Zap } from 'lucide-react'
import { extractTextFromPDF } from '../lib/pdfExtractor'

const features = [
  { icon: Sparkles, label: 'AI Summary', desc: 'Instant executive summary + key points' },
  { icon: BookOpen, label: 'Flashcards', desc: 'Auto-generated study cards with spaced repetition' },
  { icon: MessageSquare, label: 'Chat with PDF', desc: 'Ask any question, get cited answers' },
]

export default function Home() {
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f?.type === 'application/pdf') {
      setFile(f)
      setError(null)
    } else {
      setError('Please drop a PDF file.')
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f?.type === 'application/pdf') {
      setFile(f)
      setError(null)
    } else {
      setError('Please select a PDF file.')
    }
  }

  const handleProcess = async () => {
    if (!file) return
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY
    if (!apiKey) {
      setError('Gemini API key is missing. Add VITE_GEMINI_API_KEY to your .env file.')
      return
    }
    setIsProcessing(true)
    setError(null)

    try {
      setProgress('Extracting text from PDF…')
      const extracted = await extractTextFromPDF(file)

      if (!extracted.fullText.trim()) {
        throw new Error('Could not extract any text. The PDF may be image-only or scanned.')
      }

      setProgress('Sending to Gemini…')
      // Pass everything via router state — no backend needed
      navigate('/document', {
        state: {
          fileName: file.name,
          pageCount: extracted.pageCount,
          pages: extracted.pages,
          fullText: extracted.fullText,
        },
      })
    } catch (err: any) {
      setError(err.message || 'Something went wrong.')
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16 relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="text-center mb-14 z-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-indigo-300 text-sm font-medium mb-6 border border-indigo-500/20">
          <Zap size={14} className="text-indigo-400" />
          Powered by Gemini 2.5 Flash
        </div>
        <h1 className="text-6xl font-extrabold mb-4 leading-tight">
          <span className="gradient-text">SkimAI</span>
        </h1>
        <p className="text-slate-400 text-xl max-w-lg mx-auto leading-relaxed">
          Drop any PDF — get a smart summary, study flashcards, and an AI you can chat with about it.
        </p>
      </div>

      {/* Feature pills */}
      <div className="flex flex-wrap justify-center gap-3 mb-12 z-10">
        {features.map(({ icon: Icon, label, desc }) => (
          <div key={label} className="glass rounded-2xl px-5 py-3 flex items-center gap-3 hover:border-indigo-500/30 transition-colors cursor-default">
            <div className="p-2 bg-indigo-500/10 rounded-xl">
              <Icon size={18} className="text-indigo-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-200">{label}</div>
              <div className="text-xs text-slate-500">{desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Upload Card */}
      <div className="w-full max-w-xl z-10">
        {error && (
          <div className="mb-4 flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            <AlertCircle size={18} className="shrink-0" />
            {error}
          </div>
        )}

        {!file ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`glass rounded-3xl p-12 text-center cursor-pointer transition-all duration-300 border-2 ${
              isDragging
                ? 'border-indigo-400/70 bg-indigo-500/10 drop-active'
                : 'border-dashed border-slate-700/50 hover:border-indigo-500/40 hover:bg-indigo-500/5'
            }`}
          >
            <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileSelect} />
            <div className="w-20 h-20 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-6">
              <Upload size={36} className="text-indigo-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-200 mb-2">
              {isDragging ? 'Drop it here!' : 'Drag & drop your PDF'}
            </h3>
            <p className="text-slate-500 mb-6">or click to browse · max 50MB</p>
            <div className="inline-block px-5 py-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-sm font-medium hover:bg-indigo-500/20 transition-colors">
              Choose File
            </div>
          </div>
        ) : (
          <div className="glass rounded-3xl p-8">
            <div className="flex items-center gap-4 mb-8 p-4 bg-slate-800/40 rounded-2xl border border-slate-700/30">
              <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center shrink-0">
                <FileText size={22} className="text-indigo-400" />
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="font-semibold text-slate-200 truncate">{file.name}</div>
                <div className="text-sm text-slate-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</div>
              </div>
              {!isProcessing && (
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null) }}
                  className="text-slate-500 hover:text-red-400 transition-colors text-2xl leading-none"
                >
                  ×
                </button>
              )}
            </div>

            {isProcessing ? (
              <div className="text-center py-4">
                <div className="relative w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-4">
                  <div className="absolute inset-y-0 left-0 w-3/4 shimmer rounded-full" />
                </div>
                <p className="text-slate-400 text-sm animate-pulse">{progress}</p>
              </div>
            ) : (
              <button
                onClick={handleProcess}
                className="w-full py-4 rounded-2xl font-semibold text-white text-lg transition-all duration-200 flex items-center justify-center gap-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:scale-[1.01]"
              >
                <Sparkles size={20} />
                Analyze with Gemini
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
