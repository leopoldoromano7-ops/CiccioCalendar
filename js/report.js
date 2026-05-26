document.addEventListener('DOMContentLoaded', async () => {
    const totalHoursEl = document.getElementById('total-hours-val');
    const longestWalkEl = document.getElementById('longest-walk-val');
    const longestWalkMeta = document.getElementById('longest-walk-meta');
    const bestCaregiverName = document.getElementById('best-caregiver-name');
    const bestCaregiverMeta = document.getElementById('best-caregiver-meta');
    const recentActivitiesContainer = document.getElementById('recent-activities-container');
    const teamRankingList = document.querySelector('.lg\\:col-span-1 .space-y-lg');
    const loadMoreBtn = document.querySelector('.p-md.bg-surface-container-low a');
    const dateFromInput = document.getElementById('date-from');
    const dateToInput = document.getElementById('date-to');
    const trendingSpan = document.querySelector('.mt-md.flex.items-center.gap-xs.text-secondary .font-label-sm');
    const fasciaFilterContainer = document.getElementById('fascia-filter-container');

    // Chatbot Elements
    const chatMessages = document.getElementById('chat-messages');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatLoading = document.getElementById('chat-loading');
    const generateReportBtn = document.getElementById('generate-ai-report-btn');
    const sendChatBtn = document.getElementById('send-chat-btn');
    const chatSuggestions = document.getElementById('chat-suggestions');

    let currentLimit = 5;
    let allWalks = [];
    let last60DaysWalks = [];
    let activeSessions = [];
    let currentFascia = 'all';
    let chatHistory = [];

    async function loadReports() {
        if (!window.supabaseClient) return;

        // Inizializza date default (ultimi 14 giorni)
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 14);

        if (dateFromInput) dateFromInput.value = start.toISOString().split('T')[0];
        if (dateToInput) dateToInput.value = end.toISOString().split('T')[0];

        // Recupera tutte le passeggiate per le statistiche generali
        const { data: walks, error } = await window.supabaseClient
            .from('walks')
            .select('*, profiles(full_name)')
            .order('walk_date', { ascending: false }, 'start_time', { ascending: false });

        if (walks) {
            allWalks = walks;

            // Recupera sessioni attive
            const { data: sessions } = await window.supabaseClient
                .from('walk_sessions')
                .select('*, profiles(full_name)')
                .eq('is_active', true);

            activeSessions = sessions || [];

            applyFiltersAndRender();
        }
    }

    function addMessage(role, text) {
        const isAI = role === 'ai';
        const msgDiv = document.createElement('div');
        msgDiv.className = `flex gap-sm ${isAI ? '' : 'flex-row-reverse'}`;

        const avatar = isAI
            ? `<div class="w-8 h-8 rounded-full bg-surface-container-high p-1.5 flex-shrink-0 border border-outline-variant">
                 <img src="favicon.svg" alt="Ciccio" class="w-full h-full object-contain">
               </div>`
            : `<div class="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0">TU</div>`;

        msgDiv.innerHTML = `
            ${avatar}
            <div class="${isAI ? 'bg-surface-container-high' : 'bg-primary text-on-primary'} p-md rounded-2xl ${isAI ? 'rounded-tl-none' : 'rounded-tr-none'} max-w-[85%] md:max-w-[70%] shadow-sm">
                <p class="font-body-md whitespace-pre-line">${text}</p>
            </div>
        `;

        chatMessages.appendChild(msgDiv);

        // Auto-scroll with small delay to ensure DOM is updated
        setTimeout(() => {
            chatMessages.scrollTo({
                top: chatMessages.scrollHeight,
                behavior: 'smooth'
            });
        }, 10);

        // Mantieni cronologia (max 10 messaggi)
        chatHistory.push({ role: isAI ? 'assistant' : 'user', content: text });
        if (chatHistory.length > 10) chatHistory.shift();
    }

    async function handleChat(e) {
        e.preventDefault();
        const question = chatInput.value.trim();
        if (!question || !window.aiService) return;

        chatInput.value = '';
        addMessage('user', question);

        // Show loading state
        chatLoading.classList.remove('hidden');
        chatMessages.scrollTop = chatMessages.scrollHeight;
        sendChatBtn.disabled = true;
        if (generateReportBtn) generateReportBtn.disabled = true;

        try {
            const filtered = getFilteredData();
            const dateRangeText = `Sto considerando solo il periodo dal ${dateFromInput.value} al ${dateToInput.value}.`;
            const dataContext = { walks: filtered, activeSessions: activeSessions, dateRange: dateRangeText };
            const answer = await window.aiService.askAI(question, dataContext, chatHistory);
            addMessage('ai', (chatHistory.length <= 2 ? dateRangeText + "\n\n" : "") + answer);
        } catch (error) {
            addMessage('ai', "Ops! " + error.message);
        } finally {
            chatLoading.classList.add('hidden');
            sendChatBtn.disabled = false;
            if (generateReportBtn) generateReportBtn.disabled = false;
        }
    }

    async function handleGenerateReport() {
        if (!window.aiService) return;

        chatLoading.classList.remove('hidden');
        if (generateReportBtn) generateReportBtn.disabled = true;
        sendChatBtn.disabled = true;

        try {
            const filtered = getFilteredData();
            const dateRangeText = `Report basato sul periodo ${dateFromInput.value} - ${dateToInput.value}.`;
            const dataContext = { walks: filtered, activeSessions: activeSessions, dateRange: dateRangeText };
            const report = await window.aiService.generateAIReport(dataContext);
            addMessage('ai', dateRangeText + "\n\n" + report);
        } catch (error) {
            addMessage('ai', "Errore nella generazione del report: " + error.message);
        } finally {
            chatLoading.classList.add('hidden');
            if (generateReportBtn) generateReportBtn.disabled = false;
            sendChatBtn.disabled = false;
        }
    }

    function getFilteredData() {
        let filtered = allWalks;

        if (dateFromInput && dateFromInput.value) {
            filtered = filtered.filter(w => w.walk_date >= dateFromInput.value);
        }
        if (dateToInput && dateToInput.value) {
            filtered = filtered.filter(w => w.walk_date <= dateToInput.value);
        }

        if (currentFascia !== 'all') {
            filtered = filtered.filter(w => {
                const hour = parseInt(w.start_time.split(':')[0]);
                if (currentFascia === 'morning') return hour < 12;
                if (currentFascia === 'afternoon') return hour >= 12 && hour < 18;
                if (currentFascia === 'evening') return hour >= 18;
                return true;
            });
        }
        return filtered;
    }

    function applyFiltersAndRender() {
        const filtered = getFilteredData();

        updateMetrics(filtered);
        renderRecentTable(filtered.slice(0, currentLimit));
        renderTeamRanking(filtered);
        setupRankingModal(filtered);
        renderWeeklyChart(filtered);
        updateDateRange(filtered);
        renderPopularActivities(filtered);
    }


    function calculateDuration(startStr, endStr) {
        if (!startStr || !endStr) return 0;
        const start = new Date(`1970-01-01T${startStr}`);
        const end = new Date(`1970-01-01T${endStr}`);
        let diff = (end - start) / 60000;
        if (diff < 0) diff += 1440; // Over midnight
        return diff;
    }

    function updateMetrics(walks) {
        let totalMinutes = 0;
        let maxMin = 0;
        let longestWalk = null;
        const caregiverCounts = {};

        walks.forEach(w => {
            const duration = calculateDuration(w.start_time, w.end_time);
            totalMinutes += duration;
            if (duration > maxMin) {
                maxMin = duration;
                longestWalk = w;
            }
            const name = w.profiles?.full_name || 'Utente';
            caregiverCounts[name] = (caregiverCounts[name] || 0) + 1;
        });

        if (totalHoursEl) totalHoursEl.textContent = Math.round(totalMinutes / 60);
        if (trendingSpan) trendingSpan.textContent = "Basato su dati reali";

        if (longestWalkEl) {
            longestWalkEl.textContent = `${Math.floor(maxMin / 60)}h ${Math.round(maxMin % 60)}m`;
        }
        if (longestWalkMeta && longestWalk) {
            longestWalkMeta.textContent = `Registrata da ${longestWalk.profiles?.full_name || 'Utente'} il ${new Date(longestWalk.walk_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}`;
        }

        const sortedCaregivers = Object.entries(caregiverCounts).sort((a, b) => b[1] - a[1]);
        if (bestCaregiverName && sortedCaregivers[0]) {
            bestCaregiverName.textContent = sortedCaregivers[0][0];
            bestCaregiverMeta.textContent = `${sortedCaregivers[0][1]} uscite totali`;
        }
    }

    function renderRecentTable(walks) {
        if (!recentActivitiesContainer) return;
        recentActivitiesContainer.innerHTML = '';

        if (walks.length === 0) {
            recentActivitiesContainer.innerHTML = '<p class="text-center text-on-surface-variant py-md">Nessuna attività nel periodo selezionato.</p>';
            return;
        }

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const currentTime = now.getHours() * 60 + now.getMinutes();

        walks.forEach(w => {
            const duration = calculateDuration(w.start_time, w.end_time);
            const hour = parseInt(w.start_time.split(':')[0]);
            let fascia = 'Mattina';
            if (hour >= 12 && hour < 18) fascia = 'Pomeriggio';
            if (hour >= 18) fascia = 'Sera';

            // Calcolo Stato
            let status = 'Programmata';
            const startMins = parseInt(w.start_time.split(':')[0]) * 60 + parseInt(w.start_time.split(':')[1]);
            const endMins = parseInt(w.end_time.split(':')[0]) * 60 + parseInt(w.end_time.split(':')[1]);

            if (w.walk_date < todayStr) {
                status = 'Completata';
            } else if (w.walk_date === todayStr) {
                if (currentTime > endMins) status = 'Completata';
                else if (currentTime >= startMins) status = 'In corso';
            }

            const statusColors = {
                'Completata': 'bg-green-100 text-green-700',
                'In corso': 'bg-blue-100 text-blue-700 animate-pulse',
                'Programmata': 'bg-surface-container-high text-on-surface-variant'
            };

            const card = document.createElement('div');
            card.className = 'bg-surface-container-low rounded-xl p-md border border-outline-variant hover:border-primary/30 transition-all group';
            card.innerHTML = `
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-md">
                    <div class="flex items-center gap-sm">
                        <div class="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container font-bold shadow-sm">
                            ${(w.profiles?.full_name || 'U').substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <p class="font-headline-md text-sm md:text-base text-primary">${w.profiles?.full_name || 'Utente'}</p>
                            <p class="text-on-surface-variant text-xs">${new Date(w.walk_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 sm:flex sm:items-center gap-md md:gap-lg">
                        <div class="flex flex-col">
                            <span class="text-[10px] uppercase text-secondary font-label-sm">Orario</span>
                            <span class="font-body-md text-sm">${w.start_time} - ${w.end_time}</span>
                        </div>
                        <div class="flex flex-col">
                            <span class="text-[10px] uppercase text-secondary font-label-sm">Durata</span>
                            <span class="font-body-md text-sm">${duration} min</span>
                        </div>
                        <div class="flex flex-col">
                            <span class="text-[10px] uppercase text-secondary font-label-sm">Fascia</span>
                            <span class="font-body-md text-sm">${fascia}</span>
                        </div>
                        <div class="flex flex-col items-start sm:items-end">
                            <span class="px-sm py-xs rounded-full text-[10px] font-bold ${statusColors[status]}">${status}</span>
                        </div>
                    </div>
                </div>
                ${w.notes ? `<div class="mt-md pt-md border-t border-outline-variant/30 text-sm text-on-surface-variant italic">"${w.notes}"</div>` : ''}
            `;
            recentActivitiesContainer.appendChild(card);
        });
    }

    function renderTeamRanking(walks) {
        if (!teamRankingList) return;
        const ranking = {};
        walks.forEach(w => {
            const name = w.profiles?.full_name || 'Anonimo';
            ranking[name] = (ranking[name] || 0) + calculateDuration(w.start_time, w.end_time) / 60;
        });

        const sorted = Object.entries(ranking).sort((a, b) => b[1] - a[1]);
        const maxHours = sorted[0]?.[1] || 1;

        teamRankingList.innerHTML = sorted.slice(0, 4).map(([name, hours]) => `
            <div>
                <div class="flex justify-between items-center mb-xs">
                    <span class="font-label-md text-primary">${name}</span>
                    <span class="font-label-sm text-secondary">${hours.toFixed(1)}h</span>
                </div>
                <div class="h-2 w-full bg-surface-container rounded-full overflow-hidden">
                    <div class="h-full bg-primary rounded-full transition-all duration-1000" style="width: ${(hours / maxHours * 100)}%"></div>
                </div>
            </div>
        `).join('');
    }

    function setupRankingModal(walks) {
        const buttons = document.querySelectorAll('.lg\\:col-span-1 button');
        const btn = Array.from(buttons).find(b => b.textContent.includes('Vedi Classifica Completa')) || buttons[0];
        if (!btn) return;

        btn.onclick = () => {
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 z-[100] flex items-center justify-center p-4 bg-primary/20 backdrop-blur-sm';
            modal.innerHTML = `
                <div class="bg-white w-full max-w-lg rounded-xl shadow-2xl p-lg border border-outline-variant relative">
                    <button class="absolute top-4 right-4 text-outline hover:text-primary close-modal">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                    <h2 class="font-headline-lg text-primary mb-md">Classifica Completa</h2>
                    <div class="mb-lg">
                        <label class="font-label-md text-on-surface-variant mb-xs block">Ordina per:</label>
                        <select id="rank-criteria" class="w-full bg-surface-container p-sm rounded-lg border-transparent focus:border-secondary focus:ring-0">
                            <option value="duration">Tempo totale fuori</option>
                            <option value="frequency">Frequenza uscite</option>
                        </select>
                    </div>
                    <div id="modal-ranking-list" class="space-y-md max-h-[400px] overflow-y-auto pr-2"></div>
                </div>
            `;
            document.body.appendChild(modal);

            const criteriaSelect = modal.querySelector('#rank-criteria');
            const listContainer = modal.querySelector('#modal-ranking-list');

            const renderModalList = () => {
                const criteria = criteriaSelect.value;
                const stats = {};
                walks.forEach(w => {
                    const name = w.profiles?.full_name || 'Anonimo';
                    if (!stats[name]) stats[name] = { duration: 0, frequency: 0 };
                    stats[name].duration += calculateDuration(w.start_time, w.end_time) / 60;
                    stats[name].frequency += 1;
                });

                const sorted = Object.entries(stats).sort((a, b) => b[1][criteria] - a[1][criteria]);
                const maxVal = sorted[0]?.[1][criteria] || 1;

                listContainer.innerHTML = sorted.map(([name, data], index) => `
                    <div class="flex items-center gap-md p-sm hover:bg-surface-container-low rounded-lg transition-colors">
                        <div class="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold">${index + 1}</div>
                        <div class="flex-grow">
                            <div class="flex justify-between mb-1">
                                <span class="font-label-md font-bold">${name}</span>
                                <span class="text-secondary font-label-sm">${criteria === 'duration' ? data.duration.toFixed(1) + 'h' : data.frequency + ' uscite'}</span>
                            </div>
                            <div class="h-2 w-full bg-surface-container rounded-full overflow-hidden">
                                <div class="h-full bg-secondary" style="width: ${(data[criteria] / maxVal * 100)}%"></div>
                            </div>
                        </div>
                    </div>
                `).join('');
            };

            criteriaSelect.onchange = renderModalList;
            renderModalList();

            modal.querySelector('.close-modal').onclick = () => modal.remove();
            modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
        };
    }

    function renderPopularActivities(walks) {
        const container = document.querySelector('.bg-surface-container-low.p-md.rounded-xl .flex.flex-wrap');
        if (!container) return;

        const notes = walks.map(w => w.notes).filter(Boolean);
        const counts = {};
        notes.forEach(n => counts[n] = (counts[n] || 0) + 1);

        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        if (sorted.length === 0) {
            container.innerHTML = '<span class="text-on-surface-variant text-sm">Nessuna attività registrata</span>';
            return;
        }

        container.innerHTML = sorted.slice(0, 5).map(([note]) => `
            <span class="px-sm py-xs bg-secondary-container text-on-secondary-container rounded-full font-label-sm">${note}</span>
        `).join('');
    }

    function renderWeeklyChart(walks) {
        const chartWrapper = document.querySelector('.lg\\:col-span-2 > .bg-surface-container-lowest');
        let chartContainer = document.querySelector('.h-\\[280px\\].flex.items-end');
        if (!chartWrapper || !chartContainer) return;

        // Make wrapper horizontally scrollable on mobile
        chartWrapper.style.overflowX = 'auto';
        chartContainer.style.minWidth = window.innerWidth < 640 ? '600px' : '100%';

        // Reset data: 7 days, Morning, Afternoon, Evening
        const weeklyData = [
            { morning: 0, afternoon: 0, evening: 0 }, // Lun
            { morning: 0, afternoon: 0, evening: 0 }, // Mar
            { morning: 0, afternoon: 0, evening: 0 }, // Mer
            { morning: 0, afternoon: 0, evening: 0 }, // Gio
            { morning: 0, afternoon: 0, evening: 0 }, // Ven
            { morning: 0, afternoon: 0, evening: 0 }, // Sab
            { morning: 0, afternoon: 0, evening: 0 }  // Dom
        ];

        walks.forEach(w => {
            const date = new Date(w.walk_date);
            let dayIndex = date.getDay() - 1; // 0 (Mon) to 6 (Sun)
            if (dayIndex === -1) dayIndex = 6; // Sunday

            const hour = parseInt(w.start_time.split(':')[0]);
            if (hour < 12) {
                weeklyData[dayIndex].morning++;
            } else if (hour < 18) {
                weeklyData[dayIndex].afternoon++;
            } else {
                weeklyData[dayIndex].evening++;
            }
        });

        const maxCount = Math.max(...weeklyData.flatMap(d => [d.morning, d.afternoon, d.evening]), 1);
        const dayLabels = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

        chartContainer.innerHTML = weeklyData.map((data, i) => `
            <div class="flex flex-col items-center gap-sm group h-full justify-end flex-1">
                <div class="flex gap-1 items-end h-full w-full justify-center">
                    <div class="w-4 md:w-8 bg-primary rounded-t-sm chart-bar-glow transition-all hover:scale-x-110" style="height: ${(data.morning / maxCount * 90) + 5}%" title="Mattina: ${data.morning}"></div>
                    <div class="w-4 md:w-8 bg-secondary rounded-t-sm chart-bar-glow transition-all hover:scale-x-110" style="height: ${(data.afternoon / maxCount * 90) + 5}%" title="Pomeriggio: ${data.afternoon}"></div>
                    <div class="w-4 md:w-8 bg-tertiary rounded-t-sm chart-bar-glow transition-all hover:scale-x-110" style="height: ${(data.evening / maxCount * 90) + 5}%" title="Sera: ${data.evening}"></div>
                </div>
                <span class="font-label-sm text-on-surface-variant">${dayLabels[i]}</span>
            </div>
        `).join('');
    }

    if (loadMoreBtn) {
        loadMoreBtn.onclick = (e) => {
            e.preventDefault();
            currentLimit += 5;
            applyFiltersAndRender();
        };
    }

    if (chatForm) {
        chatForm.onsubmit = handleChat;
    }

    if (generateReportBtn) {
        generateReportBtn.onclick = handleGenerateReport;
    }

    if (chatSuggestions) {
        chatSuggestions.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            chatInput.value = btn.textContent;
            chatForm.dispatchEvent(new Event('submit'));
        });
    }

    if (fasciaFilterContainer) {
        fasciaFilterContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            currentFascia = btn.dataset.fascia;

            // UI update
            fasciaFilterContainer.querySelectorAll('button').forEach(b => {
                if (b === btn) {
                    b.className = 'px-md py-xs rounded-lg font-label-md text-label-md bg-primary text-on-primary shadow-sm transition-all';
                } else {
                    b.className = 'px-md py-xs rounded-lg font-label-md text-label-md text-secondary hover:bg-surface-container-high transition-all';
                }
            });

            applyFiltersAndRender();
        });
    }

    if (dateFromInput) dateFromInput.onchange = applyFiltersAndRender;
    if (dateToInput) dateToInput.onchange = applyFiltersAndRender;

    loadReports();
});
