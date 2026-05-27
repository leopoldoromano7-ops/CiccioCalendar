document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const selectedDate = urlParams.get('date') || new Date().toISOString().split('T')[0];

    // Parsing sicuro senza shift UTC tramite helper
    const displayDate = window.CiccioUtils.parseLocalDateTime(selectedDate);

    const dateTitle = document.querySelector('h1');
    if (dateTitle) dateTitle.textContent = window.CiccioUtils.formatDisplayDate(displayDate);

    const timelineContainer = document.getElementById('timeline-grid');
    const mobileListView = document.getElementById('mobile-list-view');
    const staffList = document.getElementById('active-staff-list');
    const shiftForm = document.querySelector('#shiftModal form');
    const totalDurationEl = document.getElementById('total-duration-display');
    const totalStaffEl = document.getElementById('total-staff-count');
    const filterContainer = document.getElementById('crud-view-filter');
    const scrollContainer = document.querySelector('.h-\\[600px\\]');

    // Fasce orarie definitions
    const FASCE = {
        morning: { start: '06:00', end: '11:59' },
        afternoon: { start: '12:00', end: '17:59' },
        evening: { start: '18:00', end: '23:59' }
    };

    let currentFascia = 'all';
    let allShifts = [];
    let currentUser = null;

    // Load shifts for the day
    async function loadShifts() {
        if (!window.supabaseClient) return;

        const { data: { user } } = await window.supabaseClient.auth.getUser();
        currentUser = user;

        const { data, error } = await window.supabaseClient
            .from('walks')
            .select('*, profiles(full_name)')
            .eq('walk_date', selectedDate);

        if (error) console.error('Error loading shifts:', error);
        allShifts = data || [];
        renderAll();
    }

    function filterWalksByFascia(walks, fascia) {
        if (fascia === 'all') return walks;
        const f = FASCE[fascia];
        return walks.filter(w => {
            // Richiesta: usare l'ora di inizio dell'attività
            const start = w.start_time.substring(0, 5);
            return start >= f.start && start <= f.end;
        });
    }

    function renderAll() {
        const desktopView = document.getElementById('desktop-timeline-view');
        const filteredShifts = filterWalksByFascia(allShifts, currentFascia);

        if (window.innerWidth < 768) {
            renderMobileList(filteredShifts);
            if (desktopView) {
                desktopView.classList.add('hidden');
                desktopView.style.display = 'none';
            }
            if (mobileListView) {
                mobileListView.classList.remove('hidden');
                mobileListView.style.display = 'block';
            }
        } else {
            renderTimeline(allShifts); // Timeline desktop mostra sempre tutto, ma scrolla
            if (desktopView) desktopView.classList.remove('hidden');
            if (mobileListView) mobileListView.classList.add('hidden');
        }
        renderStaff(allShifts);
        updateSummary(allShifts);
        applyViewFilter();
    }

    function renderMobileList(walks) {
        if (!mobileListView) return;
        mobileListView.innerHTML = '';

        if (walks.length === 0) {
            mobileListView.innerHTML = `
                <div class="p-xl text-center w-full">
                    <span class="material-symbols-outlined text-outline text-[48px] mb-md">event_busy</span>
                    <p class="text-on-surface-variant font-body-md">Nessuna attività programmata per questa fascia.</p>
                </div>
            `;
            return;
        }

        walks.sort((a,b) => a.start_time.localeCompare(b.start_time)).forEach(walk => {
            const isOwner = currentUser && walk.assigned_user_id === currentUser.id;
            const duration = calculateDuration(walk.start_time, walk.end_time);
            const card = document.createElement('div');
            card.className = 'bg-surface-container-low rounded-xl p-md border border-outline-variant shadow-sm cursor-pointer hover:border-primary/30 transition-all w-full box-border';
            card.onclick = () => window.openDetailModal(walk.id);
            card.innerHTML = `
                <div class="flex justify-between items-start mb-md">
                    <div class="flex items-center gap-sm">
                        <div class="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container font-bold text-sm">
                            ${(walk.profiles?.full_name || 'U').substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <p class="font-label-md text-primary leading-none mb-1">${walk.profiles?.full_name || 'Utente'}</p>
                            <p class="text-[11px] text-on-surface-variant">Accompagnatore</p>
                        </div>
                    </div>
                    ${isOwner ? `<span class="px-2 py-0.5 bg-primary text-on-primary text-[10px] rounded-full font-bold">MIA</span>` : ''}
                </div>
                <div class="space-y-sm">
                    <div class="flex items-center justify-between text-secondary">
                        <div class="flex items-center gap-xs">
                            <span class="material-symbols-outlined text-[18px]">schedule</span>
                            <span class="font-label-sm">${window.CiccioUtils.formatCardLabel(walk.start_time, walk.profiles?.full_name)}</span>
                        </div>
                        <span class="font-label-sm bg-surface-container px-2 py-1 rounded-md">${duration} min</span>
                    </div>
                    <div class="bg-surface-container-highest p-sm rounded-lg">
                         <p class="font-body-md text-on-surface leading-tight">${walk.notes || 'Passeggiata con Ciccio'}</p>
                    </div>
                </div>
            `;
            mobileListView.appendChild(card);
        });
    }

    function calculateDuration(startStr, endStr) {
        return window.CiccioUtils.calculateDurationMinutes(startStr, endStr);
    }

    function renderTimeline(walks) {
        if (!timelineContainer) return;
        document.querySelectorAll('.absolute-shift-block').forEach(el => el.remove());

        walks.forEach(walk => {
            const [startH, startM] = walk.start_time.split(':').map(Number);
            const duration = calculateDuration(walk.start_time, walk.end_time);

            const top = (startH * 64) + (startM * 64 / 60);
            const height = Math.max(32, (duration * 64 / 60)); // Min height for visibility

            const block = document.createElement('div');
            block.className = 'absolute left-[60px] right-0 px-2 py-1 absolute-shift-block';
            block.style.top = `${top}px`;
            block.style.height = `${height}px`;
            block.style.zIndex = '20';

            const isOwner = currentUser && walk.assigned_user_id === currentUser.id;

            block.innerHTML = `
                <div class="w-full h-full bg-surface-container-high rounded-lg border-l-4 border-secondary p-2 shadow-sm hover:ring-2 hover:ring-primary/20 transition-all cursor-pointer group relative overflow-hidden ${isOwner ? 'draggable' : ''}"
                     ${isOwner ? `draggable="true" data-id="${walk.id}"` : ''} onclick="openDetailModal('${walk.id}')">
                    <div class="flex justify-between items-start h-full">
                        <div class="flex flex-col h-full justify-between min-w-0">
                            <div>
                                <p class="font-label-md text-primary font-bold truncate leading-tight">${window.CiccioUtils.formatCardLabel(walk.start_time, walk.profiles?.full_name)}</p>
                                <p class="font-label-sm text-on-surface-variant text-[11px]">${walk.start_time.substring(0,5)} - ${walk.end_time?.substring(0,5)}</p>
                            </div>
                            <p class="font-body-md text-on-surface-variant text-[10px] truncate ${height < 50 ? 'hidden' : ''}">${walk.notes || ''}</p>
                        </div>
                    </div>
                </div>
            `;
            timelineContainer.appendChild(block);
        });

        setupDragAndDrop();
    }

    function setupDragAndDrop() {
        const draggables = document.querySelectorAll('.draggable');
        // Select only the interactive slots (the second div in each hour row)
        const slots = document.querySelectorAll('#timeline-grid > div:nth-child(even)');

        draggables.forEach(d => {
            d.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', d.dataset.id);
                d.classList.add('opacity-50');
            });
            d.addEventListener('dragend', () => d.classList.remove('opacity-50'));
        });

        slots.forEach((slot, index) => {
            // Re-enable slots to be interactive
            slot.classList.add('cursor-pointer', 'hover:bg-surface-container-low', 'transition-colors');
            slot.onclick = (e) => {
                // Prevent trigger when clicking on an existing card
                if (e.target !== slot) return;
                const hour = index < 10 ? `0${index}:00` : `${index}:00`;
                openModalWithTime(hour);
            };

            slot.addEventListener('dragover', (e) => e.preventDefault());
            slot.addEventListener('drop', async (e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain');
                const newHour = index < 10 ? `0${index}:00` : `${index}:00`;

                // Keep same duration
                const walk = allShifts.find(w => w.id === id);
                if (!walk) return;

                const duration = calculateDuration(walk.start_time, walk.end_time);
                const endH = (index + Math.floor(duration/60)) % 24;
                const endM = duration % 60;
                const newEndTime = `${endH < 10 ? '0'+endH : endH}:${endM < 10 ? '0'+endM : endM}`;

                await window.supabaseClient
                    .from('walks')
                    .update({ start_time: newHour, end_time: newEndTime })
                    .eq('id', id);

                loadShifts();
            });
        });
    }

    function openModalWithTime(time) {
        if (!window.openModal) return;

        // Reset modal to "New" state
        shiftForm.reset();
        delete shiftForm.dataset.id;
        const modalTitle = document.querySelector('#shiftModal h2');
        const submitBtn = shiftForm.querySelector('button[type="submit"]');
        const deleteBtn = document.getElementById('modal-delete-btn');
        const detailInfo = document.getElementById('modal-detail-info');

        modalTitle.textContent = 'Nuova Attività';
        submitBtn.textContent = 'Salva Attività';
        submitBtn.classList.remove('hidden');
        if (deleteBtn) deleteBtn.classList.add('hidden');
        if (detailInfo) detailInfo.innerHTML = '';

        const inputs = shiftForm.querySelectorAll('input');
        inputs.forEach(i => i.readOnly = false);

        // Se time è fornito (click su slot), usa quello + 30 min
        // Se time NON è fornito (bottone generale), usa ora attuale + 30 min
        let startVal, endVal;
        if (time) {
            startVal = time;
            endVal = window.CiccioUtils.addMinutesToTime(startVal, 30);
        } else {
            startVal = window.CiccioUtils.formatLocalTime(new Date());
            endVal = window.CiccioUtils.addMinutesToTime(startVal, 30);
        }

        inputs[0].value = startVal;
        inputs[1].value = endVal;

        // Ensure detailInfo exists and is ready for dynamic duration
        let di = document.getElementById('modal-detail-info');
        if (!di) {
            di = document.createElement('div');
            di.id = 'modal-detail-info';
            di.className = 'mt-4 pt-4 border-t border-outline-variant text-sm space-y-1';
            shiftForm.insertBefore(di, shiftForm.querySelector('.pt-md'));
        }
        updateModalDuration();

        window.openModal();
    }

    // Export to window to be callable from HTML button
    window.openModalWithTime = openModalWithTime;

    function renderStaff(walks) {
        if (!staffList) return;
        staffList.innerHTML = '';
        const uniqueStaff = [...new Set(walks.map(w => w.profiles?.full_name))].filter(Boolean);

        uniqueStaff.forEach(name => {
            const item = document.createElement('div');
            item.className = 'flex items-center gap-sm p-2 hover:bg-surface-container-low rounded-lg transition-colors';
            item.innerHTML = `
                <div class="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container font-bold">
                    ${name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                    <p class="font-label-md text-label-md text-primary">${name}</p>
                    <p class="font-label-sm text-label-sm text-on-surface-variant">Accompagnatore</p>
                </div>
            `;
            staffList.appendChild(item);
        });

        if (totalStaffEl) totalStaffEl.textContent = `${uniqueStaff.length} ${uniqueStaff.length === 1 ? 'persona' : 'persone'}`;
    }

    function applyViewFilter() {
        if (!filterContainer || !scrollContainer) return;

        const hourLines = document.querySelectorAll('.grid-cols-\\[60px_1fr\\] > div');
        let scrollTo = 0;

        if (currentFascia === 'morning') scrollTo = 6 * 64;
        else if (currentFascia === 'afternoon') scrollTo = 12 * 64;
        else if (currentFascia === 'evening') scrollTo = 18 * 64;

        if (currentFascia !== 'all') {
            scrollContainer.scrollTo({ top: scrollTo, behavior: 'smooth' });
        }
    }

    if (filterContainer) {
        filterContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            currentFascia = btn.dataset.fascia;

            filterContainer.querySelectorAll('button').forEach(b => {
                if (b === btn) {
                    b.className = 'bg-primary text-on-primary px-md py-xs rounded-lg font-label-md text-label-md shadow-sm transition-all';
                } else {
                    b.className = 'px-md py-xs rounded-lg font-label-md text-label-md hover:bg-surface-container-high transition-all text-secondary';
                }
            });
            renderAll();
        });
    }

    function updateSummary(walks) {
        let totalMin = 0;
        walks.forEach(w => totalMin += calculateDuration(w.start_time, w.end_time));
        if (totalDurationEl) totalDurationEl.textContent = `${Math.floor(totalMin / 60)}h ${totalMin % 60}m`;
    }

    // Handle Reminder Toggle
    const reminderEnabled = document.getElementById('reminder-enabled');
    const reminderOptions = document.getElementById('reminder-options');
    if (reminderEnabled && reminderOptions) {
        reminderEnabled.addEventListener('change', () => {
            if (reminderEnabled.checked) {
                reminderOptions.classList.remove('hidden');
                // Request notification permission if needed
                if ("Notification" in window && Notification.permission === "default") {
                    Notification.requestPermission();
                }
            } else {
                reminderOptions.classList.add('hidden');
            }
        });
    }

    // Update dynamic duration in modal
    function updateModalDuration() {
        const startTime = shiftForm.querySelector('input[type="time"]:first-of-type').value;
        const endTime = shiftForm.querySelector('input[type="time"]:last-of-type').value;
        const detailInfo = document.getElementById('modal-detail-info');
        if (!detailInfo) return;

        let durationEl = detailInfo.querySelector('.dynamic-duration');
        if (!durationEl) {
            durationEl = document.createElement('div');
            durationEl.className = 'flex justify-between dynamic-duration font-bold text-primary pt-1 border-t border-dashed border-outline-variant mt-2';
            detailInfo.appendChild(durationEl);
        }

        if (startTime && endTime) {
            const duration = window.CiccioUtils.calculateDurationMinutes(startTime, endTime);
            durationEl.innerHTML = `<span>Durata calcolata:</span> <span>${duration} minuti</span>`;
        } else {
            durationEl.innerHTML = `<span>Durata calcolata:</span> <span>--</span>`;
        }
    }

    if (shiftForm) {
        const timeInputs = shiftForm.querySelectorAll('input[type="time"]');
        timeInputs.forEach(input => {
            input.addEventListener('change', updateModalDuration);
            input.addEventListener('input', updateModalDuration);
        });

        shiftForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const { data: { user } } = await window.supabaseClient.auth.getUser();
            if (!user) { alert('Devi essere loggato.'); return; }

            const startTime = shiftForm.querySelector('input[type="time"]:first-of-type').value;
            const endTime = shiftForm.querySelector('input[type="time"]:last-of-type').value;
            const notes = shiftForm.querySelector('#shift-notes')?.value || 'Passeggiata';
            const reminderOn = document.getElementById('reminder-enabled')?.checked || false;
            const reminderMin = parseInt(document.getElementById('reminder-minutes')?.value || '30');
            const walkId = shiftForm.dataset.id;

            // Strict validation
            if (!startTime || !endTime) {
                if (window.showToast) window.showToast('Imposta un orario valido.', 'error');
                else alert('Imposta un orario valido.');
                return;
            }

            const duration = window.CiccioUtils.calculateDurationMinutes(startTime, endTime);
            if (duration <= 0) {
                if (window.showToast) window.showToast('Imposta un orario valido.', 'error');
                else alert('Imposta un orario valido.');
                return;
            }

            let error = null;
            if (walkId) {
                // Update existing
                const { error: err } = await window.supabaseClient
                    .from('walks')
                    .update({
                        start_time: startTime,
                        end_time: endTime,
                        notes: notes,
                        reminder_enabled: reminderOn,
                        reminder_minutes_before: reminderMin
                    })
                    .eq('id', walkId);
                error = err;
            } else {
                // Insert new
                const { error: err } = await window.supabaseClient
                    .from('walks')
                    .insert([{
                        walk_date: selectedDate,
                        start_time: startTime,
                        end_time: endTime,
                        assigned_user_id: user.id,
                        notes: notes,
                        reminder_enabled: reminderOn,
                        reminder_minutes_before: reminderMin
                    }]);
                error = err;

                // Feedback: Vibration for NEW activities
                if (!error && "vibrate" in navigator) {
                    navigator.vibrate([80, 40, 80]);
                }
            }

            if (error) {
                if (window.showToast) window.showToast('Errore salvataggio: ' + error.message, 'error');
                else alert('Errore salvataggio: ' + error.message);
            } else {
                window.closeModal();
                loadShifts();
                if (window.showToast) window.showToast(walkId ? 'Modifica salvata' : 'Uscita programmata con successo');
            }
        });
    }

    window.openDetailModal = (id) => {
        const walk = allShifts.find(w => w.id == id);
        if (!walk) return;

        const isOwner = currentUser && walk.assigned_user_id === currentUser.id;

        // Reset modal state
        shiftForm.reset();
        shiftForm.dataset.id = id;

        const modalTitle = document.querySelector('#shiftModal h2');
        const submitBtn = shiftForm.querySelector('button[type="submit"]');
        const deleteBtn = document.getElementById('modal-delete-btn');

        if (isOwner) {
            modalTitle.textContent = 'Modifica Attività';
            submitBtn.textContent = 'Salva Modifiche';
            submitBtn.classList.remove('hidden');
            if (deleteBtn) deleteBtn.classList.remove('hidden');
        } else {
            modalTitle.textContent = 'Dettaglio Attività';
            submitBtn.classList.add('hidden');
            if (deleteBtn) deleteBtn.classList.add('hidden');
        }

        // Fill data
        const inputs = shiftForm.querySelectorAll('input');
        inputs[0].value = walk.start_time.substring(0, 5);
        inputs[1].value = walk.end_time?.substring(0, 5) || '';
        inputs[2].value = walk.notes || '';

        // Reminders
        if (reminderEnabled) {
            reminderEnabled.checked = walk.reminder_enabled || false;
            if (reminderEnabled.checked) reminderOptions?.classList.remove('hidden');
            else reminderOptions?.classList.add('hidden');
        }
        const reminderMinutesEl = document.getElementById('reminder-minutes');
        if (reminderMinutesEl) reminderMinutesEl.value = walk.reminder_minutes_before || '30';

        // Read-only if not owner
        inputs.forEach(i => i.readOnly = !isOwner);
        if (reminderEnabled) reminderEnabled.disabled = !isOwner;
        if (reminderMinutesEl) reminderMinutesEl.disabled = !isOwner;

        // Add extra info for detail view
        let detailInfo = document.getElementById('modal-detail-info');
        if (!detailInfo) {
            detailInfo = document.createElement('div');
            detailInfo.id = 'modal-detail-info';
            detailInfo.className = 'mt-4 pt-4 border-t border-outline-variant text-sm space-y-1';
            shiftForm.insertBefore(detailInfo, shiftForm.querySelector('.pt-md'));
        }

        const duration = calculateDuration(walk.start_time, walk.end_time);
        const dateObj = window.CiccioUtils.parseLocalDateTime(walk.walk_date);

        detailInfo.innerHTML = `
            <div class="flex justify-between"><span class="text-on-surface-variant">Accompagnatore:</span> <span class="font-bold">${walk.profiles?.full_name}</span></div>
            <div class="flex justify-between"><span class="text-on-surface-variant">Data:</span> <span>${window.CiccioUtils.formatDisplayDate(dateObj)}</span></div>
            <div class="flex justify-between"><span class="text-on-surface-variant">Durata programmata:</span> <span>${duration} minuti</span></div>
        `;

        // Check for real data if linked to a session
        async function fetchRealData() {
            const { data: sessions } = await window.supabaseClient
                .from('walk_sessions')
                .select('*')
                .eq('walk_id', id)
                .order('created_at', { ascending: false });

            if (sessions && sessions.length > 0) {
                const s = sessions[0];
                const realStart = new Date(s.started_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', hour12: false });
                const realEnd = s.ended_at ? new Date(s.ended_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', hour12: false }) : 'In corso';

                const realDataEl = document.createElement('div');
                realDataEl.className = 'pt-2 mt-2 border-t border-dashed border-outline-variant text-primary';
                realDataEl.innerHTML = `
                    <div class="font-bold text-xs uppercase text-secondary mb-1">Dati Reali (Timbratura)</div>
                    <div class="flex justify-between"><span>Inizio:</span> <span>${realStart}</span></div>
                    <div class="flex justify-between"><span>Fine:</span> <span>${realEnd}</span></div>
                    ${s.duration_minutes ? `<div class="flex justify-between"><span>Durata reale:</span> <span>${s.duration_minutes} min</span></div>` : ''}
                `;
                detailInfo.appendChild(realDataEl);
            }
        }
        fetchRealData();

        window.openModal();
    };

    // Add Delete button to modal if it doesn't exist
    function ensureModalDeleteBtn() {
        const footer = document.querySelector('#shiftModal .pt-md');
        if (footer && !document.getElementById('modal-delete-btn')) {
            const delBtn = document.createElement('button');
            delBtn.id = 'modal-delete-btn';
            delBtn.type = 'button';
            delBtn.className = 'w-full bg-error/10 text-error py-sm rounded-lg font-label-md text-label-md hover:bg-error/20 transition-colors mt-2 hidden';
            delBtn.textContent = 'Elimina Prenotazione';
            delBtn.onclick = async () => {
                if (confirm('Sicuro di voler eliminare questa attività?')) {
                    const id = shiftForm.dataset.id;
                    const { error } = await window.supabaseClient.from('walks').delete().eq('id', id);
                    if (!error) {
                        if (window.showToast) window.showToast('Prenotazione eliminata');
                        window.closeModal();
                        loadShifts();
                    } else {
                        if (window.showToast) window.showToast('Errore eliminazione: ' + error.message, 'error');
                    }
                }
            };
            footer.appendChild(delBtn);
        }
    }
    ensureModalDeleteBtn();

    window.addEventListener('resize', () => {
        renderAll();
    });

    loadShifts();
});
