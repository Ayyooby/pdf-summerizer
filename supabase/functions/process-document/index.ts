import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import pdf from "npm:pdf-parse"
import { Buffer } from "node:buffer"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { document_id } = await req.json()
    if (!document_id) throw new Error("document_id is required")

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const geminiApiKey = Deno.env.get('VITE_GEMINI_API_KEY') ?? ''
    
    if (!geminiApiKey) throw new Error("Gemini API key is not configured")

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // 1. Fetch document details
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', document_id)
      .single()

    if (docError || !doc) throw new Error("Document not found")

    // Update status to processing
    await supabase.from('documents').update({ status: 'processing' }).eq('id', document_id)

    // 2. Download PDF
    const { data: fileData, error: fileError } = await supabase.storage
      .from('pdfs')
      .download(doc.file_path)

    if (fileError) throw new Error("Error downloading file: " + fileError.message)

    const arrayBuffer = await fileData.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // 3. Parse PDF
    const pdfData = await pdf(buffer)
    const text = pdfData.text
    
    // Update page count
    await supabase.from('documents').update({ page_count: pdfData.numpages }).eq('id', document_id)

    // 4. Chunk text (simple chunking ~1000 characters with 200 char overlap)
    const chunkSize = 1000
    const overlap = 200
    const chunks = []
    
    for (let i = 0; i < text.length; i += chunkSize - overlap) {
      chunks.push({
        content: text.slice(i, i + chunkSize).trim(),
        chunk_index: chunks.length,
        page_number: 1 // PDF parse doesn't give exact page mapping easily without custom logic
      })
    }

    // Filter out tiny chunks
    const validChunks = chunks.filter(c => c.content.length > 50)

    // 5. Embed chunks using Gemini API
    const chunkInserts = []
    
    // Process in batches of 10 to avoid rate limits
    for (let i = 0; i < validChunks.length; i += 10) {
      const batch = validChunks.slice(i, i + 10)
      
      const requests = batch.map(async (chunk) => {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: "models/text-embedding-004",
            content: { parts: [{ text: chunk.content }] }
          })
        })
        const data = await response.json()
        if (data.error) throw new Error(data.error.message)
        
        return {
          document_id,
          content: chunk.content,
          page_number: chunk.page_number,
          chunk_index: chunk.chunk_index,
          embedding: data.embedding.values
        }
      })
      
      const embeddedBatch = await Promise.all(requests)
      chunkInserts.push(...embeddedBatch)
    }

    // 6. Insert into chunks table
    if (chunkInserts.length > 0) {
      const { error: insertError } = await supabase.from('chunks').insert(chunkInserts)
      if (insertError) throw insertError
    }

    // 7. Generate Summary (using first 10,000 chars to fit context if needed)
    const textForSummary = text.slice(0, 15000)
    const summaryResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Summarize the following document. Provide a main summary text, and then a list of key points. Format as JSON with 'summary_text' (string) and 'key_points' (array of strings).\n\nDocument text:\n${textForSummary}` }] }]
      })
    })
    
    const summaryData = await summaryResponse.json()
    let summaryText = "Summary generation failed."
    let keyPoints = []
    
    try {
      if (summaryData.candidates?.[0]?.content?.parts?.[0]?.text) {
        const rawResponse = summaryData.candidates[0].content.parts[0].text
        // Try to parse JSON out of markdown block if present
        const jsonMatch = rawResponse.match(/```(?:json)?([\s\S]*?)```/)
        const jsonStr = jsonMatch ? jsonMatch[1].trim() : rawResponse.trim()
        const parsed = JSON.parse(jsonStr)
        summaryText = parsed.summary_text
        keyPoints = parsed.key_points
      }
    } catch (e) {
      console.error("Failed to parse summary JSON", e)
    }

    await supabase.from('summaries').insert({
      document_id,
      summary_text: summaryText,
      key_points: keyPoints,
      style: 'default'
    })

    // 8. Mark ready
    await supabase.from('documents').update({ status: 'ready' }).eq('id', document_id)

    return new Response(
      JSON.stringify({ message: "Processed successfully", document_id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (error: any) {
    console.error(error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    )
  }
})
