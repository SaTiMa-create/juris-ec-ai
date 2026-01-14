// 1. Seleccionamos los elementos del HTML
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const chatContainer = document.getElementById('chat-container');
const installBtn = document.getElementById('installBtn');

// 2. Escuchamos el evento "submit" (cuando envían el formulario)
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // ¡CRUCIAL! Esto evita que la página se recargue

    const messageText = userInput.value.trim();

    if (messageText !== "") {
        // A. Mostrar mensaje del usuario
        addMessage(messageText, 'user');
        
        // Limpiar el input
        userInput.value = '';

        // B. Llamar a la IA real (Groq)
        // Mostramos un mensaje temporal de "Consultando..."
        const loadingDiv = addMessage("Consultando jurisprudencia...", 'ai');

        try {
            // Hacemos la petición a nuestra función de Netlify
            const response = await fetch('/.netlify/functions/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: messageText })
            });

            if (!response.ok) {
                throw new Error('Error en la respuesta del servidor');
            }

            const data = await response.json();

            // Borramos el mensaje de "cargando" y ponemos la respuesta real
            loadingDiv.remove(); 
            addMessage(data.reply, 'ai');

        } catch (error) {
            console.error(error); // Ver el error en la consola
            loadingDiv.remove();
            addMessage("Lo siento, hubo un error de conexión o la API key no es válida. Revisa la consola.", 'ai');
        }
    }
});

// 3. Función para agregar burbujas de chat
function addMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('flex', 'flex-col', 'space-y-2');

    const bubbleClass = sender === 'user' 
        ? 'bg-blue-600 text-white self-end rounded-br-none' 
        : 'bg-white text-gray-800 self-start border-l-4 border-blue-500 rounded-bl-none shadow';

    const bubbleContent = `
        <div class="${bubbleClass} p-3 rounded-lg max-w-[80%]">
            <p>${text}</p>
        </div>
    `;

    messageDiv.innerHTML = bubbleContent;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    return messageDiv; // Devolvemos el div para poder borrarlo luego si es necesario
}

// 4. LÓGICA DE INSTALACIÓN PWA
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  // Solo mostramos el botón si la app NO está instalada aún
  installBtn.classList.remove('hidden');
});

installBtn.addEventListener('click', async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`El usuario decidió: ${outcome}`);
    deferredPrompt = null;
    installBtn.classList.add('hidden');
  }
});

// Registro del Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js');
    });
}