document.addEventListener('DOMContentLoaded', async () => {
    const calendarGrid = document.querySelector('.calendar-grid');
    const monthTitle = document.querySelector('h3.text-primary');
    const viewSelectors = document.querySelectorAll('.view-selector-container');

    let currentView = 'month'; // 'day', 'week', 'month'
    let referenceDate = new Date();

    async function loadView() {
        if (!calendarGrid) return;

        let start, end;

        if (currentView === 'month') {
            start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
            end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);
            monthTitle.textContent = start.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }).toUpperCase();
        } else if (currentView === 'week') {
            const day = referenceDate.getDay();
            const diff = referenceDate.getDate() - day + (day === 0 ? -6 : 1);
            start = new Date(referenceDate.setDate(diff));
            start.setHours(0,0,0,0);
            end = new Date(start);
            end.setDate(start.getDate() + 6);
            end.setHours(23,59,59,999);
            monthTitle.textContent = `SETTIMANA ${start.getDate()} ${start.toLocaleDateString('it-IT', {month: 'short'})} - ${end.getDate()} ${end.toLocaleDateString('it-IT', {month: 'short'})}`.toUpperCase();
        } else {
            start = new Date(referenceDate);
            start.setHours(0,0,0,0);
            end = new Date(referenceDate);
            end.setHours(23,59,59,999);
            monthTitle.textContent = start.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
        }

        if (window.supabaseClient) {
            const { data: walks, error } = await window.supabaseClient
                .from('walks')
                .select('*, profiles(full_name)')
                .gte('walk_date', start.toISOString().split('T')[0])
                .lte('walk_date', end.toISOString().split('T')[0]);

            if (currentView === 'month') renderMonth(start, end, walks || []);
            else if (currentView === 'week') renderWeek(start, walks || []);
            else renderDay(start, walks || []);
        }
    }

    function renderMonth(firstDay, lastDay, walks) {
        calendarGrid.innerHTML = '';
        const isMobile = window.innerWidth < 640;

        if (isMobile) {
            calendarGrid.classList.add('calendar-grid');
            calendarGrid.classList.remove('flex', 'flex-row', 'gap-px', 'overflow-x-auto', 'snap-x', 'snap-mandatory');
        }
        const days = isMobile ? ['L', 'M', 'M', 'G', 'V', 'S', 'D'] : ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'];
        days.forEach(d => {
            const h = document.createElement('div');
            h.className = 'p-1 md:p-md text-center font-label-sm text-on-surface-variant';
            h.textContent = d;
            calendarGrid.appendChild(h);
        });

        let startDay = firstDay.getDay();
        startDay = startDay === 0 ? 6 : startDay - 1;

        for (let i = 0; i < startDay; i++) {
            const empty = document.createElement('div');
            empty.className = 'bg-white min-h-[80px] md:min-h-[140px] p-1 md:p-sm opacity-20';
            calendarGrid.appendChild(empty);
        }

        for (let day = 1; day <= lastDay.getDate(); day++) {
            const dateStr = `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayWalks = walks.filter(w => w.walk_date === dateStr);

            const dayCell = document.createElement('div');
            dayCell.className = 'bg-white min-h-[80px] md:min-h-[140px] p-1 md:p-sm border hover:bg-surface/50 cursor-pointer transition-colors';
            dayCell.onclick = () => window.location.href = `crud.html?date=${dateStr}`;

            let walksHtml = '';
            if (isMobile) {
                // Show dots or thin bars for mobile
                walksHtml = dayWalks.length > 0 ? `
                    <div class="flex flex-wrap gap-0.5 mt-1 justify-center">
                        ${dayWalks.map(() => `<div class="w-1.5 h-1.5 rounded-full bg-primary"></div>`).join('')}
                    </div>
                ` : '';
            } else {
                walksHtml = dayWalks.map(w => `
                    <div class="mt-xs relative bg-surface-container-high p-xs rounded pl-md overflow-hidden">
                        <div class="shift-accent bg-primary"></div>
                        <p class="text-[12px] font-bold leading-tight">${window.CiccioUtils.formatCardLabel(w.start_time, w.profiles?.full_name)}</p>
                    </div>
                `).join('');
            }

            dayCell.innerHTML = `
                <div class="flex flex-col h-full items-center md:items-start">
                    <span class="text-[10px] md:text-label-sm ${dateStr === new Date().toISOString().split('T')[0] ? 'font-bold text-primary underline' : 'text-outline-variant'}">${String(day).padStart(2, '0')}</span>
                    <div class="flex-grow overflow-hidden w-full">
                        ${walksHtml}
                    </div>
                </div>
            `;
            calendarGrid.appendChild(dayCell);
        }
    }

    function renderWeek(start, walks) {
        calendarGrid.innerHTML = '';
        const isMobile = window.innerWidth < 640;

        if (isMobile) {
            calendarGrid.classList.remove('calendar-grid');
            calendarGrid.className = 'flex flex-row gap-px bg-surface-variant/30 overflow-x-auto snap-x snap-mandatory no-scrollbar';
            // Ensure parent allows scrolling
            if (calendarGrid.parentElement && !calendarGrid.parentElement.classList.contains('overflow-x-auto')) {
                calendarGrid.parentElement.classList.add('overflow-x-auto');
            }
        }

        const days = isMobile ? ['L', 'M', 'M', 'G', 'V', 'S', 'D'] : ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'];

        if (!isMobile) {
            days.forEach(d => {
                const h = document.createElement('div');
                h.className = 'p-1 md:p-md text-center font-label-sm text-on-surface-variant';
                h.textContent = d;
                calendarGrid.appendChild(h);
            });
        }

        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            const dayWalks = walks.filter(w => w.walk_date === dateStr);

            const dayCell = document.createElement('div');
            dayCell.className = isMobile
                ? 'bg-white min-h-[400px] p-4 border snap-center flex-shrink-0 w-[85%] relative'
                : 'bg-white min-h-[300px] md:min-h-[400px] p-1 md:p-sm border hover:bg-surface/50 cursor-pointer transition-colors';
            dayCell.onclick = () => window.location.href = `crud.html?date=${dateStr}`;

            let walksHtml = dayWalks.map(w => `
                <div class="mt-sm relative bg-surface-container-high p-2 md:p-sm rounded pl-4 md:pl-md overflow-hidden shadow-sm">
                    <div class="shift-accent bg-primary"></div>
                    <p class="text-sm md:text-base font-bold">${window.CiccioUtils.formatCardLabel(w.start_time, w.profiles?.full_name)}</p>
                    <p class="text-xs text-on-surface-variant italic leading-none mb-1">${w.start_time.substring(0,5)} - ${w.end_time?.substring(0,5)}</p>
                    ${w.notes ? `<p class="text-xs text-on-surface-variant truncate">${w.notes}</p>` : ''}
                </div>
            `).join('');

            dayCell.innerHTML = `
                <div class="flex justify-between items-center mb-md">
                    <div class="flex flex-col">
                        <span class="text-xs font-label-sm text-on-surface-variant uppercase">${days[i]}</span>
                        <span class="text-xl font-bold text-primary">${d.getDate()}</span>
                    </div>
                </div>
                <div class="space-y-2">
                    ${walksHtml || '<p class="text-sm text-outline-variant italic">Nessuna attività</p>'}
                </div>
            `;
            calendarGrid.appendChild(dayCell);
        }
    }

    function renderDay(date, walks) {
        calendarGrid.innerHTML = '';
        calendarGrid.classList.remove('calendar-grid', 'flex', 'flex-row', 'gap-px', 'overflow-x-auto', 'snap-x', 'snap-mandatory');
        calendarGrid.className = 'p-lg space-y-md bg-white';

        const dateStr = date.toISOString().split('T')[0];
        const dayWalks = walks.filter(w => w.walk_date === dateStr);

        // Add a button to add new activity for the day
        const addBtn = document.createElement('div');
        addBtn.className = 'flex justify-center mb-md';
        addBtn.innerHTML = `<button onclick="window.location.href='crud.html?date=${dateStr}'" class="bg-primary text-on-primary px-xl py-sm rounded-lg font-label-md text-label-md hover:opacity-90 active:scale-95 duration-200 flex items-center gap-2">
            <span class="material-symbols-outlined">add</span> Aggiungi Attività
        </button>`;
        calendarGrid.appendChild(addBtn);

        if (dayWalks.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'text-center py-xl text-on-surface-variant';
            empty.textContent = 'Nessuna attività registrata per oggi.';
            calendarGrid.appendChild(empty);
        } else {
            dayWalks.forEach(w => {
                const item = document.createElement('div');
                item.className = 'flex items-center justify-between p-md bg-surface-container-low rounded-xl border border-outline-variant';
                item.innerHTML = `
                    <div class="flex items-center gap-md">
                        <div class="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center">
                            <span class="material-symbols-outlined">pets</span>
                        </div>
                        <div>
                            <p class="font-headline-md text-primary">${w.notes || 'Passeggiata'} · ${w.profiles?.full_name}</p>
                            <p class="text-body-md text-on-surface-variant">${w.start_time.substring(0,5)} - ${w.end_time?.substring(0,5) || '--:--'}</p>
                        </div>
                    </div>
                    <button onclick="window.location.href='crud.html?date=${dateStr}'" class="bg-primary text-on-primary px-md py-sm rounded-lg">Dettagli</button>
                `;
                calendarGrid.appendChild(item);
            });
        }

        // Re-add class after render if we switch back
        const cleanup = () => {
             calendarGrid.className = 'calendar-grid p-xs bg-surface-variant/30';
             if (!calendarGrid.parentElement.classList.contains('overflow-x-auto')) {
                 const wrapper = document.createElement('div');
                 wrapper.className = 'overflow-x-auto';
                 calendarGrid.parentNode.insertBefore(wrapper, calendarGrid);
                 wrapper.appendChild(calendarGrid);
             }
        };
        window.calendarCleanup = cleanup;
    }

    // Navigation
    const buttons = document.querySelectorAll('button');
    let prevBtn, nextBtn;

    buttons.forEach(btn => {
        const icon = btn.querySelector('.material-symbols-outlined');
        if (icon) {
            if (icon.textContent === 'chevron_left') prevBtn = btn;
            if (icon.textContent === 'chevron_right') nextBtn = btn;
        }
    });

    prevBtn?.addEventListener('click', () => {
        if (currentView === 'month') referenceDate.setMonth(referenceDate.getMonth() - 1);
        else if (currentView === 'week') referenceDate.setDate(referenceDate.getDate() - 7);
        else referenceDate.setDate(referenceDate.getDate() - 1);
        loadView();
    });

    nextBtn?.addEventListener('click', () => {
        if (currentView === 'month') referenceDate.setMonth(referenceDate.getMonth() + 1);
        else if (currentView === 'week') referenceDate.setDate(referenceDate.getDate() + 7);
        else referenceDate.setDate(referenceDate.getDate() + 1);
        loadView();
    });

    viewSelectors.forEach(selector => {
        selector.addEventListener('click', (e) => {
            const target = e.target.closest('[data-view]');
            if (!target) return;

            currentView = target.dataset.view;

            // UI update for ALL selectors to keep them in sync
            viewSelectors.forEach(s => {
                s.querySelectorAll('[data-view]').forEach(el => {
                    if (el.dataset.view === currentView) {
                        el.classList.remove('text-secondary', 'hover:bg-surface-container-high');
                        el.classList.add('bg-primary', 'text-on-primary', 'shadow-sm');
                    } else {
                        el.classList.remove('bg-primary', 'text-on-primary', 'shadow-sm');
                        el.classList.add('text-secondary', 'hover:bg-surface-container-high');
                    }
                });
            });

            if (currentView !== 'day' && window.calendarCleanup) window.calendarCleanup();
            loadView();
        });
    });

    loadView();
});
