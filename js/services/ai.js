/**
 * Servizio AI centrale per CiccioSheets.
 * Gestisce la logica di risposta locale, il routing verso i provider (Ollama/Cloud)
 * e la costruzione del contesto per l'AI.
 */

const aiService = {
    /**
     * Tenta di dare una risposta immediata basata sui dati reali senza chiamare l'AI.
     * @param {string} question - La domanda dell'utente.
     * @param {Object} data - I dati delle passeggiate e sessioni.
     * @returns {string|null} - La risposta calcolata o null se complessa.
     */
    getSmartLocalAnswer(question, data) {
        const q = question.toLowerCase();
        const plannedWalks = data.plannedWalks || [];
        const realSessions = data.sessions || [];
        const activeSessions = data.activeSessions || [];

        // Helper per la durata reale
        const getDur = (s) => {
            if (s.duration_minutes) return s.duration_minutes;
            if (s.started_at && s.ended_at) return Math.round((new Date(s.ended_at) - new Date(s.started_at)) / 60000);
            return 0;
        };

        // 1. Chi scende di più / Più passeggiate (REAL DATA)
        if (q.includes('chi scende di più') || q.includes('più passeggiate') || q.includes('più uscite')) {
            const counts = {};
            realSessions.forEach(s => {
                const name = s.profiles?.full_name || 'Utente';
                counts[name] = (counts[name] || 0) + 1;
            });
            const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
            if (sorted.length === 0) return "Non ci sono ancora dati sulle passeggiate reali.";
            return `${sorted[0][0]} è chi scende di più Ciccio con ${sorted[0][1]} passeggiate reali registrate nel periodo selezionato.`;
        }

        // 2. Chi passa più tempo (REAL DATA)
        if (q.includes('più tempo') || q.includes('chi passa più tempo')) {
            const durations = {};
            realSessions.forEach(s => {
                const name = s.profiles?.full_name || 'Utente';
                durations[name] = (durations[name] || 0) + getDur(s);
            });
            const sorted = Object.entries(durations).sort((a, b) => b[1] - a[1]);
            if (sorted.length === 0) return "Non ci sono ancora dati sulla durata delle passeggiate reali.";
            const hours = Math.floor(sorted[0][1] / 60);
            const minutes = Math.round(sorted[0][1] % 60);
            return `${sorted[0][0]} è chi passa più tempo con Ciccio: un totale di ${hours}h e ${minutes}m (tempo reale).`;
        }

        // 3. Fascia oraria più usata (REAL DATA)
        if (q.includes('fascia oraria') || q.includes('orario più usato') || q.includes('fascia più usata')) {
            const fasce = { mattina: 0, pomeriggio: 0, sera: 0 };
            realSessions.forEach(s => {
                const hour = new Date(s.started_at).getHours();
                if (hour < 12) fasce.mattina++;
                else if (hour < 18) fasce.pomeriggio++;
                else fasce.sera++;
            });
            const sorted = Object.entries(fasce).sort((a, b) => b[1] - a[1]);
            return `La fascia oraria reale più usata per le passeggiate di Ciccio è quella della ${sorted[0][0]} (${sorted[0][1]} volte).`;
        }

        // 4. Chi è in servizio oggi / Chi c'è oggi
        if (q.includes('servizio oggi') || q.includes('chi c\'è oggi') || q.includes('chi è in servizio')) {
            const plannedNames = [...new Set(plannedWalks.map(w => w.profiles?.full_name))].filter(Boolean);
            const activeNames = activeSessions.map(s => s.profiles?.full_name).filter(Boolean);

            let resp = "";
            if (plannedNames.length > 0) {
                resp += `Oggi sono pianificati: ${plannedNames.join(', ')}. `;
            } else {
                resp += "Non ci sono passeggiate pianificate per oggi. ";
            }

            if (activeNames.length > 0) {
                resp += `Attualmente in corso: ${activeNames.join(', ')}.`;
            } else {
                resp += "Non ci sono sessioni attive in questo momento.";
            }
            return resp;
        }

        // 5. Slot scoperti / liberi
        if (q.includes('slot scoperti') || q.includes('slot liberi') || q.includes('buchi')) {
            const todayStr = new Date().toISOString().split('T')[0];
            const todayWalks = walks.filter(w => w.walk_date === todayStr).sort((a,b) => a.start_time.localeCompare(b.start_time));

            if (todayWalks.length === 0) return "Oggi sembra tutto scoperto! Non ci sono ancora passeggiate registrate.";

            if (todayWalks.length < 3) return `Oggi ci sono solo ${todayWalks.length} passeggiate. Potrebbero esserci degli slot scoperti.`;
            return "Oggi la giornata sembra ben coperta con " + todayWalks.length + " passeggiate.";
        }

        return null; // Lascia decidere all'AI
    },

    /**
     * Costruisce il contesto JSON da inviare all'AI con raggruppamenti temporali.
     */
    buildAIContext(data) {
        const sessions = data.sessions || [];
        const now = new Date();
        const startOfThisWeek = new Date(now);
        startOfThisWeek.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
        startOfThisWeek.setHours(0,0,0,0);

        const startOfLastWeek = new Date(startOfThisWeek);
        startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);

        const stats = {
            currentWeek: { count: 0, hours: 0 },
            lastWeek: { count: 0, hours: 0 },
            caregivers: {}
        };

        sessions.forEach(s => {
            const sessDate = new Date(s.started_at);
            let durationMin = s.duration_minutes;
            if (!durationMin && s.ended_at) {
                durationMin = Math.round((new Date(s.ended_at) - new Date(s.started_at)) / 60000);
            }
            const duration = (durationMin || 0) / 60;
            const name = s.profiles?.full_name || 'Utente';

            if (!stats.caregivers[name]) stats.caregivers[name] = { count: 0, hours: 0 };
            stats.caregivers[name].count++;
            stats.caregivers[name].hours += duration;

            if (sessDate >= startOfThisWeek) {
                stats.currentWeek.count++;
                stats.currentWeek.hours += duration;
            } else if (sessDate >= startOfLastWeek && sessDate < startOfThisWeek) {
                stats.lastWeek.count++;
                stats.lastWeek.hours += duration;
            }
        });

        return {
            totale_uscite_reali_periodo: sessions.length,
            confronto_settimanale_reale: {
                questa_settimana: { uscite: stats.currentWeek.count, ore: stats.currentWeek.hours.toFixed(1) },
                settimana_scorsa: { uscite: stats.lastWeek.count, ore: stats.lastWeek.hours.toFixed(1) }
            },
            classifica_accompagnatori_reale: Object.entries(stats.caregivers).map(([nome, s]) => ({
                nome, uscite: s.count, ore: s.hours.toFixed(1)
            })).sort((a,b) => b.uscite - a.uscite),
            ultime_5_timbrature: sessions.slice(0, 5).map(s => ({
                data: s.started_at.split('T')[0], chi: s.profiles?.full_name, note: s.notes || s.walks?.notes || "Libera"
            }))
        };
    },

    calculateMinutes(startStr, endStr) {
        if (!startStr || !endStr) return 0;
        const start = new Date(`1970-01-01T${startStr}`);
        const end = new Date(`1970-01-01T${endStr}`);
        let diff = (end - start) / 60000;
        if (diff < 0) diff += 1440;
        return diff;
    },

    /**
     * Invia una domanda all'AI (Ollama o Cloud).
     */
    async askAI(question, data, history = []) {
        const config = window.APP_CONFIG;
        const localAnswer = this.getSmartLocalAnswer(question, data);
        const contextData = this.buildAIContext(data);

        const prompt = `Sei il chatbot dell'app di Ciccio.
Rispondi in italiano.
Usa esclusivamente i dati JSON forniti.
Non inventare nomi, orari, durate o statistiche.
Se un dato non è disponibile, dillo chiaramente.
Rispondi in modo breve, chiaro e utile.
Massimo 5-8 righe.

Domanda utente:
${question}

Risposta calcolata localmente, se disponibile:
${localAnswer || "N/A"}

Dati reali riassunti:
${JSON.stringify(contextData, null, 2)}

Cronologia recente:
${history.map(h => `${h.role}: ${h.content}`).join('\n')}`;

        if (config.AI_PROVIDER === 'ollama') {
            return this.callOllama(prompt);
        } else if (config.AI_PROVIDER === 'cloud') {
            try {
                const answer = await this.callCloud(prompt);
                return answer;
            } catch (err) {
                if (localAnswer) return localAnswer + " (Risposta generata con calcolo locale - Cloud non disponibile)";
                throw err;
            }
        } else {
            if (localAnswer) return localAnswer + " (Risposta generata con calcolo locale)";
            throw new Error("Nessun provider AI configurato");
        }
    },

    async callOllama(prompt) {
        const config = window.APP_CONFIG;
        try {
            const response = await fetch(config.OLLAMA_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: config.OLLAMA_MODEL,
                    prompt: prompt,
                    stream: false
                })
            });
            if (!response.ok) throw new Error("Ollama non risponde correttamente");
            const result = await response.json();
            return result.response;
        } catch (error) {
            console.error("Errore Ollama:", error);
            throw new Error("Ollama disponibile solo in locale. Assicurati che sia avviato.");
        }
    },

    async callCloud(prompt) {
        const config = window.APP_CONFIG;
        if (!config.CLOUD_AI_ENDPOINT) {
            throw new Error("Endpoint Cloud non configurato.");
        }
        try {
            const response = await fetch(config.CLOUD_AI_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });
            if (!response.ok) {
                const errJson = await response.json().catch(() => ({}));
                throw new Error(errJson.error || "Il servizio Cloud non risponde");
            }
            const result = await response.json();
            return result.answer || result.response;
        } catch (error) {
            console.error("Errore Cloud AI:", error);
            throw error;
        }
    },

    /**
     * Genera il report automatico.
     */
    async generateAIReport(data) {
        const contextData = this.buildAIContext(data);
        const prompt = `Genera un report sintetico sulle passeggiate di Ciccio.
Includi: riepilogo generale, classifica accompagnatori, chi ha fatto più passeggiate e chi ha passato più tempo, fasce orarie più usate, eventuali slot scoperti e suggerimenti pratici.
Usa solo i dati forniti.

Dati:
${JSON.stringify(contextData, null, 2)}`;

        const config = window.APP_CONFIG;
        if (config.AI_PROVIDER === 'ollama') {
            return this.callOllama(prompt);
        } else if (config.AI_PROVIDER === 'cloud') {
            return this.callCloud(prompt);
        } else {
            throw new Error("Nessun provider AI configurato per il report.");
        }
    }
};

window.aiService = aiService;
