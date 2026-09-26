import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload as UploadIcon, File, X, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Upload() {
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files[0]
    validateAndSetFile(droppedFile)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0])
    }
  }

  const validateAndSetFile = (selectedFile: File) => {
    setError(null)
    if (selectedFile.type !== 'application/pdf') {
      setError('Please upload a valid PDF file.')
      return
    }
    if (selectedFile.size > 20 * 1024 * 1024) { // 20MB limit
      setError('File size exceeds 20MB limit.')
      return
    }
    setFile(selectedFile)
  }

  const handleUpload = async () => {
    if (!file) return
    setIsUploading(true)
    setError(null)

    try {
      // Mocking the user auth for now (since we don't have login set up yet)
      const { data: { user } } = await supabase.auth.getUser()
      
      // If no user, we might want to handle it or skip for this MVP
      // For real app: uncomment and handle auth
      /*
      if (!user) {
        throw new Error('You must be logged in to upload.')
      }
      */
      
      // 1. Create document record (mock user id if needed)
      // Note: for this to work RLS needs to allow it, or we need a real user.
      const userId = user?.id || null // fallback
      
      const insertData: any = {
        title: file.name,
        file_path: `mock_path`, // placeholder, we update it after upload
        status: 'uploaded'
      }
      if (userId) insertData.user_id = userId

      const { data: docData, error: docError } = await supabase
        .from('documents')
        .insert(insertData)
        .select()
        .single()
        
      if (docError) throw docError

      const filePath = userId ? `${userId}/${docData.id}.pdf` : `public/${docData.id}.pdf`

      // 2. Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('pdfs')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // 3. Update document with real file_path
      const { error: updateError } = await supabase
        .from('documents')
        .update({ file_path: filePath })
        .eq('id', docData.id)

      if (updateError) throw updateError

      // Navigate to dashboard or document view
      navigate('/')
      
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'An error occurred during upload.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto mt-10">
      <div className="bg-white rounded-3xl p-10 border border-slate-200 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Upload a Document</h1>
        <p className="text-slate-500 mb-8">Upload a PDF to generate summaries, flashcards, and start chatting.</p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-3 border border-red-100">
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        {!file ? (
          <div 
            className={`border-3 border-dashed rounded-2xl p-16 text-center transition-all ${
              isDragging 
                ? 'border-indigo-500 bg-indigo-50' 
                : 'border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="bg-white w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-slate-100">
              <UploadIcon size={32} className="text-indigo-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">Drag and drop your PDF here</h3>
            <p className="text-slate-500 mb-6">or click to browse from your computer (Max 20MB)</p>
            
            <input 
              type="file" 
              accept=".pdf" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileSelect}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="bg-white text-slate-700 font-medium px-6 py-2.5 rounded-lg border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors"
            >
              Browse Files
            </button>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-2xl p-6 bg-slate-50">
            <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="bg-indigo-100 p-3 rounded-lg text-indigo-700">
                  <File size={28} />
                </div>
                <div>
                  <div className="font-semibold text-slate-800 text-lg">{file.name}</div>
                  <div className="text-slate-500 text-sm">{(file.size / (1024 * 1024)).toFixed(2)} MB</div>
                </div>
              </div>
              <button 
                onClick={() => setFile(null)}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                disabled={isUploading}
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="flex justify-end gap-4">
              <button 
                onClick={() => setFile(null)}
                className="px-6 py-2.5 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors"
                disabled={isUploading}
              >
                Cancel
              </button>
              <button 
                onClick={handleUpload}
                disabled={isUploading}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-8 py-2.5 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2"
              >
                {isUploading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading...
                  </>
                ) : (
                  'Process Document'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
