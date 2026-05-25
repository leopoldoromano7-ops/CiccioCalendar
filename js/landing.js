document.addEventListener('DOMContentLoaded', async () => {
    const calendarGrid = document.querySelector('.calendar-grid');
    const monthTitle = document.querySelector('h3.text-primary');
    let currentMonth = new Date().getMonth();
    let currentYear = new Date().getFullYear();

    async function loadCalendar() {
        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);

        if (monthTitle) monthTitle.textContent = firstDay.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

        // Fetch walks for the month
        if (window.supabaseClient) {
            const { data: walks, error } = await window.supabaseClient
                .from('walks')
                .select('*')
                .gte('walk_date', firstDay.toISOString().split('T')[0])
                .lte('walk_date', lastDay.toISOString().split('T')[0]);

            renderCalendar(firstDay, lastDay, walks || []);
        }
    }

    function renderCalendar(firstDay, lastDay, walks) {
        if (!calendarGrid) return;

        // Keep header (LUN, MAR, etc.)
        const headers = Array.from(calendarGrid.children).slice(0, 7);
        calendarGrid.innerHTML = '';
        headers.forEach(h => calendarGrid.appendChild(h));

        // Padding for first day of week
        let startDay = firstDay.getDay(); // 0 is Sunday
        startDay = startDay === 0 ? 6 : startDay - 1; // Adjust to Monday start

        for (let i = 0; i < startDay; i++) {
            const empty = document.createElement('div');
            empty.className = 'bg-white min-h-[140px] p-sm';
            empty.innerHTML = `<span class="text-label-sm text-outline-variant/30"></span>`;
            calendarGrid.appendChild(empty);
        }

        // Days of month
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayWalks = walks.filter(w => w.walk_date === dateStr);

            const dayCell = document.createElement('div');
            dayCell.className = 'bg-white min-h-[140px] p-sm border hover:bg-surface/50 cursor-pointer transition-colors';
            dayCell.onclick = () => window.location.href = `crud.html?date=${dateStr}`;

            let walksHtml = dayWalks.map(w => `
                <div class="mt-xs relative bg-surface-container-high p-xs rounded pl-md overflow-hidden">
                    <div class="shift-accent bg-primary"></div>
                    <p class="text-[10px] font-bold leading-tight">${w.start_time}</p>
                </div>
            `).join('');

            dayCell.innerHTML = `
                <span class="text-label-sm ${day === new Date().getDate() && currentMonth === new Date().getMonth() && currentYear === new Date().getFullYear() ? 'font-bold text-primary underline' : 'text-outline-variant'}">${String(day).padStart(2, '0')}</span>
                ${walksHtml}
            `;
            calendarGrid.appendChild(dayCell);
        }
    }

    // Navigation
    const icons = Array.from(document.querySelectorAll('.material-symbols-outlined'));
    const prevBtn = icons.find(el => el.textContent.trim() === 'chevron_left')?.parentElement;
    const nextBtn = icons.find(el => el.textContent.trim() === 'chevron_right')?.parentElement;

    prevBtn?.addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
        loadCalendar();
    });

    nextBtn?.addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        loadCalendar();
    });

    loadCalendar();
});
