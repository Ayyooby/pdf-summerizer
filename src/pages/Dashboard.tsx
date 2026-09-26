import { Link } from 'react-router-dom'
import { FileText, Plus, Clock, ChevronRight } from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const [recentDocs, setRecentDocs] = useState<any[]>([])
  const [stats, setStats] = useState({ docs: 0, flashcards: 0 })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      setIsLoading(true)
      const { data: docs } = await supabase.from('documents').select('*').order('created_at', { ascending: false })
      const { count: flashcardsCount } = await supabase.from('flashcards').select('*', { count: 'exact', head: true })
      
      if (docs) setRecentDocs(docs)
      setStats({
        docs: docs?.length || 0,
        flashcards: flashcardsCount || 0
      })
      setIsLoading(false)
    }
    loadStats()
  }, [])
  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Welcome back</h1>
          <p className="text-slate-500 mt-2">Here's an overview of your documents and study progress.</p>
        </div>
        <Link 
          to="/upload" 
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus size={20} />
          Upload PDF
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 font-medium mb-2">Total Documents</div>
          <div className="text-4xl font-bold text-slate-800">{stats.docs}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 font-medium mb-2">Flashcards Created</div>
          <div className="text-4xl font-bold text-slate-800">{stats.flashcards}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 font-medium mb-2">Study Streak</div>
          <div className="text-4xl font-bold text-slate-800 flex items-baseline gap-2">
            1 <span className="text-lg font-medium text-slate-400">days</span>
          </div>
        </div>
      </div>

      {/* Recent Documents */}
      <h2 className="text-xl font-bold text-slate-800 mb-4">Recent Documents</h2>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-100">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500">Loading documents...</div>
          ) : recentDocs.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No documents found. Upload one to get started!</div>
          ) : recentDocs.map((doc) => (
            <div key={doc.id} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors group">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${doc.status === 'ready' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
                  {doc.status === 'ready' ? <FileText size={24} /> : <Clock size={24} className="animate-pulse" />}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 text-lg group-hover:text-indigo-600 transition-colors">{doc.title}</h3>
                  <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                    <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                    <span>&bull;</span>
                    <span>{doc.page_count || '?'} pages</span>
                    {doc.status === 'processing' && (
                      <>
                        <span>&bull;</span>
                        <span className="text-amber-600 font-medium">Processing...</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              <Link 
                to={`/document/${doc.id}`}
                className={`p-2 rounded-full ${doc.status === 'ready' ? 'hover:bg-slate-200 text-slate-400 hover:text-slate-700' : 'opacity-50 cursor-not-allowed pointer-events-none'}`}
              >
                <ChevronRight size={24} />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
