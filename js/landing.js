document.addEventListener('DOMContentLoaded', async () => {
    const calendarGrid = document.querySelector('.calendar-grid');
    const monthTitle = document.querySelector('h3.text-primary');
    const viewMonth = document.getElementById('viewMonth');
    const viewWeek = document.getElementById('viewWeek');
    const viewDay = document.getElementById('viewDay');

    let currentView = 'month'; // 'month', 'week', 'day'
    let referenceDate = new Date();

    async function loadData() {
        const firstDay = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
        const lastDay = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);

        let walks = [];
        if (window.supabaseClient) {
            const { data } = await window.supabaseClient
                .from('walks')
                .select('*')
                .gte('walk_date', firstDay.toISOString().split('T')[0])
                .lte('walk_date', lastDay.toISOString().split('T')[0]);
            walks = data || [];
        }
        render(walks);
    }

    function render(walks) {
        if (!calendarGrid) return;
        calendarGrid.innerHTML = '';

        if (currentView === 'month') {
            renderMonth(walks);
        } else if (currentView === 'week') {
            renderWeek(walks);
        } else if (currentView === 'day') {
            renderDay(walks);
        }
    }

    function renderMonth(walks) {
        const firstDay = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
        const lastDay = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);

        if (monthTitle) monthTitle.textContent = referenceDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

        // Weekdays headers
        const days = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'];
        days.forEach(d => {
            const el = document.createElement('div');
            el.className = 'p-md text-center font-label-sm text-on-surface-variant';
            el.textContent = d;
            calendarGrid.appendChild(el);
        });

        let startDay = firstDay.getDay();
        startDay = startDay === 0 ? 6 : startDay - 1;

        for (let i = 0; i < startDay; i++) {
            const empty = document.createElement('div');
            empty.className = 'bg-white min-h-[140px] p-sm';
            calendarGrid.appendChild(empty);
        }

        for (let day = 1; day <= lastDay.getDate(); day++) {
            const dateStr = `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayWalks = walks.filter(w => w.walk_date === dateStr);

            const dayCell = document.createElement('div');
            dayCell.className = 'bg-white min-h-[140px] p-sm border hover:bg-surface/50 cursor-pointer transition-colors';
            dayCell.onclick = () => {
                referenceDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), day);
                currentView = 'day';
                updateViewButtons();
                loadData();
            };

            let walksHtml = dayWalks.map(w => `
                <div class="mt-xs relative bg-surface-container-high p-xs rounded pl-md overflow-hidden">
                    <div class="shift-accent bg-primary"></div>
                    <p class="text-[10px] font-bold leading-tight">${w.start_time}</p>
                </div>
            `).join('');

            dayCell.innerHTML = `
                <span class="text-label-sm ${day === new Date().getDate() && referenceDate.getMonth() === new Date().getMonth() ? 'font-bold text-primary underline' : 'text-outline-variant'}">${String(day).padStart(2, '0')}</span>
                ${walksHtml}
            `;
            calendarGrid.appendChild(dayCell);
        }
    }

    function renderWeek(walks) {
        // Find start of week (Monday)
        const day = referenceDate.getDay();
        const diff = referenceDate.getDate() - day + (day === 0 ? -6 : 1);
        const startOfWeek = new Date(referenceDate);
        startOfWeek.setDate(diff);

        if (monthTitle) {
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            monthTitle.textContent = `${startOfWeek.getDate()} - ${endOfWeek.getDate()} ${startOfWeek.toLocaleDateString('it-IT', { month: 'short' })}`;
        }

        for (let i = 0; i < 7; i++) {
            const current = new Date(startOfWeek);
            current.setDate(startOfWeek.getDate() + i);
            const dateStr = current.toISOString().split('T')[0];
            const dayWalks = walks.filter(w => w.walk_date === dateStr);

            const cell = document.createElement('div');
            cell.className = 'bg-white min-h-[400px] p-sm border';

            let walksHtml = dayWalks.map(w => `
                <div class="mt-md p-md bg-surface-container-high rounded-xl border border-primary/10">
                    <p class="font-bold">${w.start_time} - ${w.end_time}</p>
                    <p class="text-sm opacity-70">${w.notes || ''}</p>
                </div>
            `).join('');

            cell.innerHTML = `
                <div class="text-center border-b pb-md">
                    <p class="text-xs uppercase opacity-50">${current.toLocaleDateString('it-IT', { weekday: 'short' })}</p>
                    <p class="text-xl font-bold">${current.getDate()}</p>
                </div>
                ${walksHtml}
            `;
            calendarGrid.appendChild(cell);
        }
    }

    function renderDay(walks) {
        if (monthTitle) monthTitle.textContent = referenceDate.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

        calendarGrid.classList.remove('calendar-grid'); // Remove 7-col grid
        calendarGrid.className = 'p-md space-y-md';

        const dateStr = referenceDate.toISOString().split('T')[0];
        const dayWalks = walks.filter(w => w.walk_date === dateStr);

        if (dayWalks.length === 0) {
            calendarGrid.innerHTML = '<div class="text-center py-xl opacity-50">Nessuna attività registrata per oggi</div>';
        } else {
            dayWalks.forEach(w => {
                const el = document.createElement('div');
                el.className = 'flex items-center gap-md p-lg bg-white rounded-2xl border border-outline-variant shadow-sm';
                el.innerHTML = `
                    <div class="w-16 h-16 rounded-full bg-primary-container flex items-center justify-center text-on-primary-fixed">
                        <span class="material-symbols-outlined text-3xl">pets</span>
                    </div>
                    <div>
                        <p class="text-2xl font-bold text-primary">${w.start_time} - ${w.end_time}</p>
                        <p class="text-on-surface-variant">${w.notes || 'Passeggiata con Ciccio'}</p>
                    </div>
                    <button class="ml-auto bg-surface-container px-md py-sm rounded-lg hover:bg-surface-container-high transition-colors" onclick="window.location.href='crud.html?date=${dateStr}'">Dettagli</button>
                `;
                calendarGrid.appendChild(el);
            });
        }

        // Add a back button for mobile or easy navigation
        const backBtn = document.createElement('button');
        backBtn.className = 'w-full py-md border-2 border-dashed border-outline-variant rounded-xl text-secondary hover:border-secondary transition-all';
        backBtn.textContent = 'Torna al Calendario Mensile';
        backBtn.onclick = () => {
            currentView = 'month';
            calendarGrid.className = 'calendar-grid p-xs bg-surface-variant/30';
            updateViewButtons();
            loadData();
        };
        calendarGrid.appendChild(backBtn);
    }

    function updateViewButtons() {
        [viewMonth, viewWeek, viewDay].forEach(btn => {
            if (!btn) return;
            btn.classList.remove('bg-primary', 'text-on-primary');
            btn.classList.add('bg-surface-container', 'text-secondary');
        });

        let active;
        if (currentView === 'month') active = viewMonth;
        else if (currentView === 'week') active = viewWeek;
        else if (currentView === 'day') active = viewDay;

        if (active) {
            active.classList.remove('bg-surface-container', 'text-secondary');
            active.classList.add('bg-primary', 'text-on-primary');
        }
    }

    viewMonth?.addEventListener('click', () => {
        currentView = 'month';
        calendarGrid.className = 'calendar-grid p-xs bg-surface-variant/30';
        updateViewButtons();
        loadData();
    });
    viewWeek?.addEventListener('click', () => {
        currentView = 'week';
        calendarGrid.className = 'calendar-grid p-xs bg-surface-variant/30';
        updateViewButtons();
        loadData();
    });
    viewDay?.addEventListener('click', () => {
        currentView = 'day';
        updateViewButtons();
        loadData();
    });

    // Navigation
    const icons = Array.from(document.querySelectorAll('.material-symbols-outlined'));
    const prevBtn = icons.find(el => el.textContent.trim() === 'chevron_left')?.parentElement;
    const nextBtn = icons.find(el => el.textContent.trim() === 'chevron_right')?.parentElement;

    prevBtn?.addEventListener('click', () => {
        if (currentView === 'month') referenceDate.setMonth(referenceDate.getMonth() - 1);
        else if (currentView === 'week') referenceDate.setDate(referenceDate.getDate() - 7);
        else referenceDate.setDate(referenceDate.getDate() - 1);
        loadData();
    });

    nextBtn?.addEventListener('click', () => {
        if (currentView === 'month') referenceDate.setMonth(referenceDate.getMonth() + 1);
        else if (currentView === 'week') referenceDate.setDate(referenceDate.getDate() + 7);
        else referenceDate.setDate(referenceDate.getDate() + 1);
        loadData();
    });

    loadData();
});
