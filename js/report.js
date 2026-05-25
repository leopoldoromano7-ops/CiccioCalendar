document.addEventListener('DOMContentLoaded', async () => {
    const totalHoursEl = document.getElementById('total-hours-val');
    const longestWalkEl = document.getElementById('longest-walk-val');
    const longestWalkMeta = document.getElementById('longest-walk-meta');
    const bestCaregiverName = document.getElementById('best-caregiver-name');
    const bestCaregiverMeta = document.getElementById('best-caregiver-meta');
    const recentTableBody = document.querySelector('tbody');
    const teamRankingList = document.querySelector('.lg\\:col-span-1 .space-y-lg');
    const loadMoreBtn = document.querySelector('.p-md.bg-surface-container-low a');

    let currentLimit = 5;

    async function loadReports() {
        if (!window.supabaseClient) return;

        const { data: walks, error } = await window.supabaseClient
            .from('walks')
            .select('*, profiles(full_name)')
            .order('walk_date', { ascending: false }, 'start_time', { ascending: false });

        if (walks) {
            updateMetrics(walks);
            renderRecentTable(walks.slice(0, currentLimit));
            renderTeamRanking(walks);
            setupRankingModal(walks);
        }
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
        if (!recentTableBody) return;
        recentTableBody.innerHTML = '';
        walks.forEach(w => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-surface-bright transition-colors';
            const duration = calculateDuration(w.start_time, w.end_time);

            tr.innerHTML = `
                <td class="px-md py-md">
                    <div class="flex items-center gap-sm">
                        <div class="w-8 h-8 rounded-full bg-secondary-fixed flex items-center justify-center font-label-sm">
                            ${(w.profiles?.full_name || 'U').substring(0, 2).toUpperCase()}
                        </div>
                        <span class="font-body-md text-on-surface">${w.profiles?.full_name || 'Utente'}</span>
                    </div>
                </td>
                <td class="px-md py-md"><span class="font-body-md">${w.notes || 'Passeggiata'}</span></td>
                <td class="px-md py-md font-body-md">${Math.floor(duration / 60)}h ${duration % 60}m</td>
                <td class="px-md py-md text-on-surface-variant font-label-sm">${w.walk_date} ${w.start_time}</td>
                <td class="px-md py-md text-right">
                    <button class="material-symbols-outlined text-outline hover:text-primary transition-colors">more_vert</button>
                </td>
            `;
            recentTableBody.appendChild(tr);
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

    if (loadMoreBtn) {
        loadMoreBtn.onclick = (e) => {
            e.preventDefault();
            currentLimit += 5;
            loadReports();
        };
    }

    loadReports();
});
