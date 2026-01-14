import { createClient } from '@supabase/supabase-js';
import { pipeline } from '@xenova/transformers';

// Variable para guardar el modelo de IA en memoria y no cargarlo cada vez (hace que sea más rápido)
let generateEmbedding = null;

export default async (req, context) => {
    // Solo permitimos POST
    if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const body = await req.json();
        const userMessage = body.message;

        console.log("--> 1. Recibido mensaje:", userMessage);

        // --- FASE 1: Convertir la pregunta en números (Embedding) ---
        if (!generateEmbedding) {
            console.log("--> Cargando modelo extractor (esto puede tardar la primera vez)...");
            generateEmbedding = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        }

        // Generamos el vector de la pregunta del usuario
        const output = await generateEmbedding(userMessage, { pooling: 'mean', normalize: true });
        const embedding = Array.from(output.data);

        // --- FASE 2: Buscar en la Base de Datos (Supabase) ---
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_KEY;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Llamamos a la función "match_documents" que creamos con SQL
        const { data: documents, error } = await supabase.rpc('match_documents', {
            query_embedding: embedding,
            match_threshold: 0.4, // Similitud mínima (0 a 1)
            match_count: 3        // Cuántos artículos traer
        });

        if (error) console.error("Error buscando en Supabase:", error);

        // Preparamos el texto que encontró la base de datos
        let contextText = "";
        if (documents && documents.length > 0) {
            contextText = documents.map(doc => `ARTÍCULO DE LEY: ${doc.content}`).join("\n\n");
            console.log("--> Encontrados documentos:", documents.length);
        } else {
            console.log("--> No se encontró información relevante en la base de datos.");
            contextText = "No hay artículos específicos en la base de datos para esto.";
        }

        // --- FASE 3: Preguntar a la IA (Groq) con el contexto ---
        const apiKey = process.env.GROQ_API_KEY;
        
        const systemPrompt = `Eres JurisEC, un abogado experto ecuatoriano.
        
        INSTRUCCIONES:
        1. Usa EXCLUSIVAMENTE la siguiente "Información Legal Recuperada" para responder.
        2. Si la respuesta está en la información, cita textual el artículo.
        3. Si la información no basta, di: "No tengo esa información en mi base de datos actual".
        4. Usa formato HTML (<b>negritas</b>, <br> saltos, <ul> listas) para responder.

        --- INFORMACIÓN LEGAL RECUPERADA ---
        ${contextText}
        -----------------------------------
        `;

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage }
                ],
                temperature: 0.1 // Muy baja creatividad para ser fiel a la ley
            })
        });

        const data = await response.json();

        return new Response(JSON.stringify({ 
            reply: data.choices[0].message.content 
        }), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (error) {
        console.error("ERROR CRÍTICO:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};