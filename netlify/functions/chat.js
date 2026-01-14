import { createClient } from '@supabase/supabase-js';

export default async (req, context) => {
    // 1. Configuración básica y CORS
    if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const body = await req.json();
        const userMessage = body.message;
        
        console.log("--> Pregunta recibida:", userMessage);

        // 2. FASE 1: Generar Embedding (Vía API de Hugging Face en lugar de local)
        // Esto elimina la necesidad de sharp y transformers.js
        const hfToken = process.env.HF_TOKEN;
        const embeddingResponse = await fetch(
            "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${hfToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    inputs: userMessage,
                    options: { wait_for_model: true } // Esperar si el modelo está dormido
                }),
            }
        );

        if (!embeddingResponse.ok) {
            throw new Error(`Error HF: ${embeddingResponse.statusText}`);
        }

        const embedding = await embeddingResponse.json();

        // 3. FASE 2: Buscar en Supabase (Igual que antes)
        const supabase = createClient(
            process.env.SUPABASE_URL, 
            process.env.SUPABASE_KEY
        );

        const { data: documents, error } = await supabase.rpc('match_documents', {
            query_embedding: embedding, // El vector que nos dio la API
            match_threshold: 0.4,
            match_count: 3
        });

        if (error) console.error("Error Supabase:", error);

        // Preparamos el contexto
        let contextText = "";
        if (documents && documents.length > 0) {
            contextText = documents.map(doc => `ARTÍCULO DE LEY (${doc.metadata.titulo}): ${doc.content}`).join("\n\n");
            console.log(`--> Encontrados ${documents.length} artículos.`);
        } else {
            console.log("--> No se encontró información relevante.");
            contextText = "No hay artículos específicos en la base de datos para esto.";
        }

        // 4. FASE 3: Preguntar a Groq (Igual que antes)
        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    {
                        role: "system",
                        content: `Eres JurisEC, abogado experto.
                        Usa esta INFORMACIÓN RECUPERADA para responder:
                        ${contextText}
                        
                        Si la respuesta está ahí, CITA el artículo. Si no, dilo.`
                    },
                    { role: "user", content: userMessage }
                ],
                temperature: 0.1
            })
        });

        const groqData = await groqResponse.json();

        return new Response(JSON.stringify({ 
            reply: groqData.choices[0].message.content 
        }), { headers: { "Content-Type": "application/json" } });

    } catch (error) {
        console.error("ERROR:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};
