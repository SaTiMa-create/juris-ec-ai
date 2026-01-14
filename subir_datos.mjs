import { createClient } from '@supabase/supabase-js';
import { pipeline } from '@xenova/transformers';

// 1. CONFIGURACIÓN (Pega tus claves aquí)
const SUPABASE_URL = 'https://tmpomnvoeuucfrxfrvfm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_IQl6TSuDlG6kcMs6jfYjjQ_CKVlB3rk';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. TUS DATOS (Aquí pegaremos las leyes poco a poco)
// Como ejemplo, pongo 3 artículos claves sobre el Femicidio y Homicidio
const leyes = [
  {
    titulo: "Artículo 141 - Femicidio",
    texto: "La persona que, como resultado de relaciones de poder manifestadas en cualquier tipo de violencia, dé muerte a una mujer por el hecho de serlo o por su condición de género, será sancionada con pena privativa de libertad de veintidós a veintiséis años."
  },
  {
    titulo: "Artículo 144 - Homicidio",
    texto: "La persona que mate a otra será sancionada con pena privativa de libertad de diez a trece años."
  },
  {
    titulo: "Artículo 189 - Robo",
    texto: "La persona que mediante amenazas o violencias sustraiga o se apodere de cosa mueble ajena, sea que la violencia tenga lugar antes del acto para facilitarlo, en el momento de cometerlo o después de cometido para procurar impunidad, será sancionada con pena privativa de libertad de cinco a siete años."
  }
];

async function main() {
  console.log("--> 🧠 Cargando modelo de IA (puede tardar un poco la primera vez)...");
  
  // Descargamos el modelo gratuito que convierte texto a números (384 dimensiones)
  const generateEmbedding = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

  console.log("--> 🚀 Empezando la carga de leyes a Supabase...");

  for (const ley of leyes) {
    // A. Convertir el texto a vector
    const output = await generateEmbedding(ley.texto, { pooling: 'mean', normalize: true });
    const embedding = Array.from(output.data); // Convertimos a array normal

    // B. Guardar en Supabase
    const { error } = await supabase
      .from('documents')
      .insert({
        content: ley.texto,
        metadata: { titulo: ley.titulo, ley: "COIP" },
        embedding: embedding
      });

    if (error) {
      console.error("❌ Error subiendo:", ley.titulo, error);
    } else {
      console.log("✅ Ley guardada:", ley.titulo);
    }
  }

  console.log("--> 🎉 ¡Proceso terminado!");
}

main();