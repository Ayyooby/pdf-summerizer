import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { document_id, user_question } = await req.json()
    if (!document_id || !user_question) throw new Error("document_id and user_question are required")

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const geminiApiKey = Deno.env.get('VITE_GEMINI_API_KEY') ?? ''
    
    if (!geminiApiKey) throw new Error("Gemini API key is not configured")

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // 1. Embed the user's question using Gemini
    const embedResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: { parts: [{ text: user_question }] }
      })
    })
    
    const embedData = await embedResponse.json()
    if (embedData.error) throw new Error(embedData.error.message)
    
    const queryEmbedding = embedData.embedding.values

    // 2. Search for similar chunks using pgvector RPC
    const { data: matchedChunks, error: matchError } = await supabase.rpc('match_chunks', {
      query_embedding: queryEmbedding,
      match_document_id: document_id,
      match_count: 5
    })

    if (matchError) throw matchError

    // 3. Build the prompt with context
    const contextText = matchedChunks?.map((chunk: any) => `[Page ${chunk.page_number}] ${chunk.content}`).join("\n\n") || ""
    
    const prompt = `You are a helpful AI assistant that answers questions based on a specific document.
    Answer the user's question using ONLY the provided context from the document.
    If the context doesn't contain the answer, politely say that you don't know based on the provided document.
    When you use information from the context, try to mention the page number if provided.

    Document Context:
    ${contextText}

    User Question:
    ${user_question}
    `

    // 4. Generate answer using Gemini
    const chatResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    })
    
    const chatData = await chatResponse.json()
    if (chatData.error) throw new Error(chatData.error.message)
    
    const answer = chatData.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate an answer."
    
    // Extract cited pages from matched chunks
    const citedPages = [...new Set(matchedChunks?.map((c: any) => c.page_number) || [])]

    // 5. Store the messages (mock user_id if needed, but since we disabled RLS/constraints, we can pass null or skip)
    const { error: insertError } = await supabase.from('chat_messages').insert([
      { document_id, role: 'user', content: user_question, cited_pages: [] },
      { document_id, role: 'assistant', content: answer, cited_pages: citedPages }
    ])

    if (insertError) throw insertError

    return new Response(
      JSON.stringify({ answer, cited_pages: citedPages }),
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
