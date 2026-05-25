document.addEventListener('DOMContentLoaded', async () => {
    const totalHoursEl = document.querySelector('.lg\\:col-span-1 .text-display-lg'); // Adjust based on HTML
    const recentTableBody = document.querySelector('tbody');
    const teamStats = document.querySelector('.lg\\:col-span-1 .space-y-lg');

    async function loadReports() {
        const { data: walks, error } = await window.supabaseClient
            .from('walks')
            .select('*, profiles(full_name)')
            .order('walk_date', { ascending: false });

        if (walks) {
            updateMetrics(walks);
            renderRecentTable(walks.slice(0, 10));
            renderTeamRanking(walks);
        }
    }

    function updateMetrics(walks) {
        let totalMinutes = 0;
        walks.forEach(w => {
            if (w.start_time && w.end_time) {
                const start = new Date(`1970-01-01T${w.start_time}`);
                const end = new Date(`1970-01-01T${w.end_time}`);
                totalMinutes += (end - start) / 60000;
            }
        });

        const displayHours = document.querySelector('.md\\:grid-cols-3 div:first-child .text-display-lg');
        if (displayHours) displayHours.textContent = (totalMinutes / 60).toFixed(1);

        const longestWalkEl = document.querySelector('.md\\:grid-cols-3 div:nth-child(2) .text-display-lg');
        if (longestWalkEl) {
            let maxMin = 0;
            walks.forEach(w => {
                if (w.start_time && w.end_time) {
                    const diff = (new Date(`1970-01-01T${w.end_time}`) - new Date(`1970-01-01T${w.start_time}`)) / 60000;
                    if (diff > maxMin) maxMin = diff;
                }
            });
            longestWalkEl.textContent = `${Math.floor(maxMin / 60)}h ${maxMin % 60}m`;
        }
    }

    function renderRecentTable(walks) {
        if (!recentTableBody) return;
        recentTableBody.innerHTML = '';
        walks.forEach(w => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-surface-bright transition-colors';

            const start = new Date(`1970-01-01T${w.start_time}`);
            const end = new Date(`1970-01-01T${w.end_time}`);
            const duration = Math.round((end - start) / 60000);

            tr.innerHTML = `
                <td class="px-md py-md">
                    <div class="flex items-center gap-sm">
                        <div class="w-8 h-8 rounded-full bg-secondary-fixed flex items-center justify-center font-label-sm">
                            ${(w.profiles?.full_name || 'U').substring(0, 2).toUpperCase()}
                        </div>
                        <span class="font-body-md text-on-surface">${w.profiles?.full_name || 'Utente'}</span>
                    </div>
                </td>
                <td class="px-md py-md"><span class="font-body-md">Passeggiata</span></td>
                <td class="px-md py-md font-body-md">${duration}m</td>
                <td class="px-md py-md text-on-surface-variant font-label-sm">${w.walk_date}</td>
                <td class="px-md py-md text-right"></td>
            `;
            recentTableBody.appendChild(tr);
        });
    }

    function renderTeamRanking(walks) {
        if (!teamStats) return;
        const ranking = {};
        walks.forEach(w => {
            const name = w.profiles?.full_name || 'Anonimo';
            const start = new Date(`1970-01-01T${w.start_time}`);
            const end = new Date(`1970-01-01T${w.end_time}`);
            const duration = (end - start) / 3600000;
            ranking[name] = (ranking[name] || 0) + duration;
        });

        const sorted = Object.entries(ranking).sort((a, b) => b[1] - a[1]);
        const maxHours = sorted[0]?.[1] || 1;

        teamStats.innerHTML = sorted.map(([name, hours]) => `
            <div>
                <div class="flex justify-between items-center mb-xs">
                    <span class="font-label-md text-primary">${name}</span>
                    <span class="font-label-sm text-secondary">${hours.toFixed(1)}h</span>
                </div>
                <div class="h-2 w-full bg-surface-container rounded-full overflow-hidden">
                    <div class="h-full bg-primary rounded-full" style="width: ${(hours / maxHours * 100)}%"></div>
                </div>
            </div>
        `).join('');
    }

    loadReports();
});
