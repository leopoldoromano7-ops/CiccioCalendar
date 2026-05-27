/**
 * Configurazione globale dell'applicazione CiccioSheets.
 */
const CONFIG = {
    // Provider AI: 'ollama' | 'cloud' | 'none'
    // Se siamo su Vercel (hostname non localhost), usiamo cloud come default
    AI_PROVIDER: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                 ? 'ollama'
                 : 'cloud',

    // Configurazione Ollama Locale
    OLLAMA_ENDPOINT: 'http://localhost:11434/api/generate',
    OLLAMA_MODEL: 'qwen3.5:9b',

    // Configurazione Cloud
    // L'endpoint punta al proxy serverless locale (/api/ai)
    CLOUD_AI_ENDPOINT: '/api/ai',
    CLOUD_AI_PROVIDER: 'groq',

    // Configurazione Mappe
    MAP_TILE_URL: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    MAP_ATTRIBUTION: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};

// Esporta la configurazione globalmente
window.APP_CONFIG = CONFIG;
