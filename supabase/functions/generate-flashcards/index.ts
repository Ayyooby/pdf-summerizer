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
    const { document_id } = await req.json()
    if (!document_id) throw new Error("document_id is required")

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const geminiApiKey = Deno.env.get('VITE_GEMINI_API_KEY') ?? ''
    
    if (!geminiApiKey) throw new Error("Gemini API key is not configured")

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // 1. Fetch document summary
    const { data: summary, error: summaryError } = await supabase
      .from('summaries')
      .select('summary_text')
      .eq('document_id', document_id)
      .single()

    if (summaryError || !summary) throw new Error("Summary not found")

    // 2. Fetch some chunks for context
    const { data: chunks, error: chunksError } = await supabase
      .from('chunks')
      .select('content, page_number')
      .eq('document_id', document_id)
      .limit(5) // Limit context to avoid huge token usage for flashcards
      
    if (chunksError) throw chunksError
    
    const contextText = summary.summary_text + "\n\n" + chunks.map(c => c.content).join("\n")

    // 3. Ask Gemini for Flashcards
    const prompt = `Based on the following document context, generate 5 study flashcards. 
    Each flashcard should have a question and an answer.
    Format your response as a raw JSON array (do not include markdown code block formatting) where each object has "question" (string), "answer" (string), and "source_page" (integer, default 1).
    
    Document context:
    ${contextText}`

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    })
    
    const data = await response.json()
    if (data.error) throw new Error(data.error.message)
    
    const rawResponse = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!rawResponse) throw new Error("Empty response from AI")

    // Parse JSON
    const jsonMatch = rawResponse.match(/```(?:json)?([\s\S]*?)```/)
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : rawResponse.trim()
    const parsedFlashcards = JSON.parse(jsonStr)

    // Insert into DB
    const flashcardsToInsert = parsedFlashcards.map((fc: any) => ({
      document_id,
      question: fc.question,
      answer: fc.answer,
      source_page: fc.source_page || 1,
      difficulty: 'medium'
    }))

    const { error: insertError } = await supabase.from('flashcards').insert(flashcardsToInsert)
    if (insertError) throw insertError

    return new Response(
      JSON.stringify({ message: "Flashcards generated successfully", count: flashcardsToInsert.length }),
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
