/**
 * Servizio per l'integrazione con Ollama locale.
 * Nota: Se riscontri problemi CORS dal frontend verso localhost,
 * avvia Ollama con la variabile d'ambiente: OLLAMA_ORIGINS="*"
 */
const OLLAMA_ENDPOINT = 'http://localhost:11434/api/generate';
const MODEL_NAME = 'qwen3.5:9b';

/**
 * Genera un report intelligente basato sui dati delle passeggiate.
 * @param {Object} data - Statistiche riassunte delle passeggiate.
 * @returns {Promise<string>} - Il testo del report generato.
 */
async function generateAIReport(data) {
    const prompt = `Sei un assistente AI per un’app di gestione passeggiate del cane Ciccio.
Analizza esclusivamente i dati JSON forniti.
Non inventare nomi, orari, durate o statistiche.
Se un dato manca, scrivi che non è disponibile.
Genera un report breve in italiano con:
1. riepilogo generale
2. classifica accompagnatori
3. fasce orarie più usate
4. eventuali criticità
5. suggerimenti pratici per migliorare l'organizzazione delle passeggiate.

Dati:
${JSON.stringify(data, null, 2)}`;

    try {
        console.log('Chiamata a Ollama:', { endpoint: OLLAMA_ENDPOINT, model: MODEL_NAME });

        const response = await fetch(OLLAMA_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: MODEL_NAME,
                prompt: prompt,
                stream: false
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Risposta Ollama non valida:', response.status, errorText);
            throw new Error(`Errore Ollama (${response.status}): ${errorText || 'Risposta non valida'}`);
        }

        const result = await response.json();
        if (!result || !result.response) {
            console.error('Risposta Ollama vuota o malformata:', result);
            throw new Error('Risposta Ollama malformata.');
        }

        return result.response;
    } catch (error) {
        console.error('Errore durante la generazione del report AI:', error);

        // Messaggio specifico per errori di connessione (possibile CORS o Ollama non avviato)
        if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
            throw new Error('Impossibile connettersi a Ollama. Verifica che sia attivo e configurato con OLLAMA_ORIGINS="*"');
        }

        throw new Error(`AI locale non disponibile: ${error.message}`);
    }
}

// Esporta la funzione globalmente per semplicità nel contesto di questo progetto Vanilla JS
window.ollamaService = {
    generateAIReport
};
