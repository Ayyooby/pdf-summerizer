import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, MessageSquare, Book, FileText, Send } from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function DocumentView() {
  const { id } = useParams()
  const [activeTab, setActiveTab] = useState<'summary' | 'flashcards' | 'chat'>('summary')
  const [chatInput, setChatInput] = useState('')
  const [document, setDocument] = useState<any>(null)
  const [summary, setSummary] = useState<any>(null)
  const [flashcards, setFlashcards] = useState<any[]>([])
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      if (!id) return
      setIsLoading(true)
      
      // Load document
      const { data: docData } = await supabase.from('documents').select('*').eq('id', id).single()
      setDocument(docData)
      
      // Load summary
      const { data: sumData } = await supabase.from('summaries').select('*').eq('document_id', id).single()
      setSummary(sumData)
      
      // Load flashcards
      const { data: flashData } = await supabase.from('flashcards').select('*').eq('document_id', id)
      setFlashcards(flashData || [])
      
      // Load chat
      const { data: chatData } = await supabase.from('chat_messages').select('*').eq('document_id', id).order('created_at', { ascending: true })
      setChatMessages(chatData || [])
      
      setIsLoading(false)
    }
    loadData()
  }, [id])

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !id) return
    
    const userMsg = chatInput
    setChatInput('')
    
    // Optimistic UI update
    setChatMessages([...chatMessages, { role: 'user', content: userMsg }])
    
    try {
      // Call edge function
      const { data, error } = await supabase.functions.invoke('chat-query', {
        body: { document_id: id, user_question: userMsg }
      })
      if (error) throw error
      
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.answer, cited_pages: data.cited_pages }])
    } catch (e) {
      console.error(e)
    }
  }

  const handleGenerateFlashcards = async () => {
    if (!id) return
    try {
      const { error } = await supabase.functions.invoke('generate-flashcards', {
        body: { document_id: id }
      })
      if (error) throw error
      // Reload flashcards
      const { data: flashData } = await supabase.from('flashcards').select('*').eq('document_id', id)
      setFlashcards(flashData || [])
    } catch (e) {
      console.error(e)
    }
  }

  // Mock data for the view if loading fails or isn't ready
  const docTitle = document?.title || "Loading..."
  const docStatus = document?.status || "..."
  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/" className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-slate-800">{docTitle}</h1>
        <span className={`px-3 py-1 text-sm font-medium rounded-full ml-auto ${
          docStatus === 'ready' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
        }`}>
          {docStatus.charAt(0).toUpperCase() + docStatus.slice(1)}
        </span>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* Left Panel: PDF Viewer placeholder */}
        <div className="w-1/2 bg-slate-200 rounded-2xl flex items-center justify-center border border-slate-300 shadow-inner">
          <div className="text-center text-slate-500">
            <FileText size={48} className="mx-auto mb-4 opacity-50" />
            <p className="font-medium">PDF Viewer</p>
            <p className="text-sm">react-pdf integration goes here</p>
          </div>
        </div>

        {/* Right Panel: AI Tools */}
        <div className="w-1/2 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-slate-200 p-2 gap-2 bg-slate-50">
            <button 
              onClick={() => setActiveTab('summary')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
                activeTab === 'summary' ? 'bg-white shadow-sm text-indigo-700 border border-slate-200' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <FileText size={18} /> Summary
            </button>
            <button 
              onClick={() => setActiveTab('flashcards')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
                activeTab === 'flashcards' ? 'bg-white shadow-sm text-indigo-700 border border-slate-200' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <Book size={18} /> Flashcards
            </button>
            <button 
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
                activeTab === 'chat' ? 'bg-white shadow-sm text-indigo-700 border border-slate-200' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <MessageSquare size={18} /> Chat
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="text-center text-slate-500 mt-10">Loading data...</div>
            ) : activeTab === 'summary' && (
              <div className="prose prose-slate max-w-none">
                <h3 className="text-xl font-bold text-slate-800 mb-4">Executive Summary</h3>
                <p>{summary?.summary_text || "No summary available."}</p>
                
                {summary?.key_points && summary.key_points.length > 0 && (
                  <>
                    <h4 className="text-lg font-semibold text-slate-800 mt-6 mb-2">Key Points</h4>
                    <ul className="list-disc pl-5 space-y-2">
                      {summary.key_points.map((pt: string, idx: number) => (
                        <li key={idx}>{pt}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            {!isLoading && activeTab === 'flashcards' && (
              <div className="space-y-4">
                {flashcards.length === 0 ? (
                  <div className="text-center mt-10">
                    <p className="text-slate-500 mb-4">No flashcards generated yet.</p>
                    <button onClick={handleGenerateFlashcards} className="bg-indigo-600 text-white px-4 py-2 rounded-lg">Generate Flashcards</button>
                  </div>
                ) : (
                  <>
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 text-center cursor-pointer hover:bg-indigo-100 transition-colors group h-48 flex flex-col justify-center perspective-1000">
                      <span className="text-indigo-400 font-medium text-sm mb-2 block uppercase tracking-wider">Question 1 of {flashcards.length}</span>
                      <h3 className="text-xl font-bold text-slate-800 group-hover:text-indigo-700">{flashcards[0].question}</h3>
                      <div className="mt-4 text-sm text-slate-500 flex items-center justify-center gap-2">
                        <span className="px-2 py-1 bg-slate-200 rounded text-xs font-medium">Page {flashcards[0].source_page}</span>
                        Click to flip
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors">Previous</button>
                      <button className="flex-1 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors">Next</button>
                    </div>
                  </>
                )}
              </div>
            )}

            {!isLoading && activeTab === 'chat' && (
              <div className="flex flex-col h-full">
                <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                  
                  {chatMessages.length === 0 && (
                    <div className="text-slate-500 text-center mt-4">Ask a question to start chatting.</div>
                  )}
                  
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        msg.role === 'user' ? 'bg-slate-800 text-white' : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        {msg.role === 'user' ? 'U' : 'AI'}
                      </div>
                      <div className={`p-3 rounded-2xl text-slate-800 ${
                        msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-100 rounded-tl-none'
                      }`}>
                        {msg.content}
                        {msg.cited_pages && msg.cited_pages.length > 0 && (
                          <span className="inline-block px-2 py-0.5 bg-white border border-slate-200 text-xs rounded text-indigo-600 ml-2 shadow-sm cursor-pointer hover:bg-indigo-50">
                            Page {msg.cited_pages.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  
                </div>
                
                {/* Chat Input */}
                <div className="relative mt-auto">
                  <input 
                    type="text" 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ask a question about this document..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
                  />
                  <button onClick={handleSendMessage} className="absolute right-2 top-2 p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                    <Send size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
