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
            throw new Error('Errore nella risposta di Ollama');
        }

        const result = await response.json();
        return result.response;
    } catch (error) {
        console.error('Errore durante la generazione del report AI:', error);
        throw new Error('AI locale non disponibile. Avvia Ollama per generare il report.');
    }
}

// Esporta la funzione globalmente per semplicità nel contesto di questo progetto Vanilla JS
window.ollamaService = {
    generateAIReport
};
