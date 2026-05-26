/**
 * Configurazione globale dell'applicazione CiccioSheets.
 */
const CONFIG = {
    // Provider AI: 'ollama' | 'cloud' | 'none'
    AI_PROVIDER: 'ollama',

    // Configurazione Ollama Locale
    OLLAMA_ENDPOINT: 'http://localhost:11434/api/generate',
    OLLAMA_MODEL: 'qwen3.5:9b',

    // Configurazione Cloud (Futura)
    // Non inserire API Key qui. L'endpoint dovrebbe puntare a un proxy serverless.
    CLOUD_AI_ENDPOINT: '',
    CLOUD_AI_PROVIDER: '', // es. 'openai', 'anthropic', 'groq'
};

// Esporta la configurazione globalmente
window.APP_CONFIG = CONFIG;
