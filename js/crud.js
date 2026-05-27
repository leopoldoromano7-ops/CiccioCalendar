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
    let allShifts = []; // Unified list of activities
    let currentUser = null;

    // Load shifts and sessions for the day
    async function loadShifts() {
        if (!window.supabaseClient) return;

        const { data: { user } } = await window.supabaseClient.auth.getUser();
        currentUser = user;

        // Fetch bookings
        const { data: walks, error: wErr } = await window.supabaseClient
            .from('walks')
            .select('*, profiles(full_name)')
            .eq('walk_date', selectedDate);

        if (wErr) console.error('Error loading walks:', wErr);

        // Fetch real sessions for the same day
        const dayStart = `${selectedDate}T00:00:00`;
        const dayEnd = `${selectedDate}T23:59:59`;
        const { data: sessions, error: sErr } = await window.supabaseClient
            .from('walk_sessions')
            .select('*, profiles(full_name)')
            .gte('started_at', dayStart)
            .lte('started_at', dayEnd);

        if (sErr) console.error('Error loading sessions:', sErr);

        // Merge into unified activities
        const unified = [];
        const walkMap = {};

        (walks || []).forEach(w => {
            const act = { ...w, type: 'walk', sessions: [] };
            unified.push(act);
            walkMap[w.id] = act;
        });

        (sessions || []).forEach(s => {
            if (s.walk_id && walkMap[s.walk_id]) {
                walkMap[s.walk_id].sessions.push(s);
            } else {
                // Free session
                const startTime = new Date(s.started_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', hour12: false });
                const endTime = s.ended_at ? new Date(s.ended_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', hour12: false }) : window.CiccioUtils.addMinutesToTime(startTime, 30);
                unified.push({
                    ...s,
                    type: 'session',
                    start_time: startTime,
                    end_time: endTime,
                    walk_date: selectedDate
                });
            }
        });

        allShifts = unified;
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

    function renderMobileList(activities) {
        if (!mobileListView) return;
        mobileListView.innerHTML = '';

        if (activities.length === 0) {
            mobileListView.innerHTML = `
                <div class="p-xl text-center w-full">
                    <span class="material-symbols-outlined text-outline text-[48px] mb-md">event_busy</span>
                    <p class="text-on-surface-variant font-body-md">Nessuna attività programmata per questa fascia.</p>
                </div>
            `;
            return;
        }

        activities.sort((a,b) => a.start_time.localeCompare(b.start_time)).forEach(act => {
            const isWalk = act.type === 'walk';
            const hasSession = isWalk ? act.sessions.length > 0 : true;
            const isOwner = currentUser && (isWalk ? act.assigned_user_id === currentUser.id : act.created_by === currentUser.id);

            const duration = calculateDuration(act.start_time, act.end_time);
            const card = document.createElement('div');
            card.className = `bg-surface-container-low rounded-xl p-md border border-outline-variant shadow-sm cursor-pointer hover:border-primary/30 transition-all w-full box-border active:scale-[0.98] min-h-[120px] touch-manipulation ${hasSession ? 'border-l-4 border-l-green-500' : ''}`;
            card.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isWalk) window.openDetailModal(act.id);
                else window.openDetailModal(null, act.id);
            };

            let badge = '';
            if (isOwner) badge = `<span class="px-2 py-0.5 bg-primary text-on-primary text-[10px] rounded-full font-bold uppercase">MIA</span>`;
            else if (hasSession) badge = `<span class="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] rounded-full font-bold uppercase">TIMBRATA</span>`;

            card.innerHTML = `
                <div class="flex justify-between items-start mb-md pointer-events-none">
                    <div class="flex items-center gap-sm">
                        <div class="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container font-bold text-sm">
                            ${(act.profiles?.full_name || 'U').substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <p class="font-label-md text-primary leading-none mb-1">${act.profiles?.full_name || 'Utente'}</p>
                            <p class="text-[11px] text-on-surface-variant">Accompagnatore</p>
                        </div>
                    </div>
                    ${badge}
                </div>
                <div class="space-y-sm">
                    <div class="flex items-center justify-between text-secondary">
                        <div class="flex items-center gap-xs">
                            <span class="material-symbols-outlined text-[18px]">schedule</span>
                            <span class="font-label-sm">${window.CiccioUtils.formatCardLabel(act.start_time, act.profiles?.full_name)}</span>
                        </div>
                        <span class="font-label-sm bg-surface-container px-2 py-1 rounded-md">${duration} min</span>
                    </div>
                    <div class="bg-surface-container-highest p-sm rounded-lg">
                         <p class="font-body-md text-on-surface leading-tight">${act.notes || (isWalk ? 'Passeggiata programmata' : 'Passeggiata libera')}</p>
                    </div>
                </div>
            `;
            mobileListView.appendChild(card);
        });
    }

    function calculateDuration(startStr, endStr) {
        return window.CiccioUtils.calculateDurationMinutes(startStr, endStr);
    }

    function renderTimeline(activities) {
        if (!timelineContainer) return;
        document.querySelectorAll('.absolute-shift-block').forEach(el => el.remove());

        activities.forEach(act => {
            const isWalk = act.type === 'walk';
            const hasSession = isWalk ? act.sessions.length > 0 : true;

            const [startH, startM] = act.start_time.split(':').map(Number);
            const duration = calculateDuration(act.start_time, act.end_time);

            const top = (startH * 64) + (startM * 64 / 60);
            const height = Math.max(32, (duration * 64 / 60));

            const block = document.createElement('div');
            block.className = 'absolute left-[60px] right-0 px-2 py-1 absolute-shift-block';
            block.style.top = `${top}px`;
            block.style.height = `${height}px`;
            block.style.zIndex = '20';

            const isOwner = currentUser && (isWalk ? act.assigned_user_id === currentUser.id : act.created_by === currentUser.id);
            const borderColor = hasSession ? 'border-green-500' : 'border-secondary';
            const bgColor = hasSession ? 'bg-green-50' : 'bg-surface-container-high';

            block.innerHTML = `
                <div class="w-full h-full ${bgColor} rounded-lg border-l-4 ${borderColor} p-2 shadow-sm hover:ring-2 hover:ring-primary/20 transition-all cursor-pointer group relative overflow-hidden touch-manipulation ${isOwner && isWalk ? 'draggable' : ''}"
                     ${isOwner && isWalk ? `draggable="true" data-id="${act.id}"` : ''}
                     onclick="event.stopPropagation(); ${isWalk ? `openDetailModal('${act.id}')` : `openDetailModal(null, '${act.id}')`}">
                    <div class="flex justify-between items-start h-full pointer-events-none">
                        <div class="flex flex-col h-full justify-between min-w-0">
                            <div>
                                <p class="font-label-md text-primary font-bold truncate leading-tight">${window.CiccioUtils.formatCardLabel(act.start_time, act.profiles?.full_name)}</p>
                                <p class="font-label-sm text-on-surface-variant text-[11px]">${act.start_time.substring(0,5)} - ${act.end_time?.substring(0,5)}</p>
                            </div>
                            <p class="font-body-md text-on-surface-variant text-[10px] truncate ${height < 50 ? 'hidden' : ''}">${act.notes || ''}</p>
                        </div>
                        ${hasSession ? '<span class="material-symbols-outlined text-green-600 text-sm">verified</span>' : ''}
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
            const sessionId = shiftForm.dataset.sessionId;

            // If we are updating a session, only update notes
            if (sessionId) {
                const { error } = await window.supabaseClient
                    .from('walk_sessions')
                    .update({ notes: notes })
                    .eq('id', sessionId);

                if (error) {
                    if (window.showToast) window.showToast('Errore aggiornamento sessione: ' + error.message, 'error');
                } else {
                    window.closeModal();
                    loadShifts();
                    if (window.showToast) window.showToast('Note sessione aggiornate');
                }
                return;
            }

            // Strict validation
            if (!startTime || !endTime) {
                if (window.showToast) window.showToast('Imposta un orario valido.', 'error');
                else alert('Imposta un orario valido.');
                return;
            }

            const duration = window.CiccioUtils.calculateDurationMinutes(startTime, endTime);
            if (duration <= 0) {
                if (window.showToast) window.showToast('Imposta un orario valido.', 'error');

                // Suggerisci automaticamente ora fine = ora inizio + 30 minuti
                const suggestedEnd = window.CiccioUtils.addMinutesToTime(startTime, 30);
                shiftForm.querySelector('input[type="time"]:last-of-type').value = suggestedEnd;
                updateModalDuration();
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

    window.openDetailModal = (walkId, sessionId) => {
        let activity = null;
        if (walkId) activity = allShifts.find(a => a.type === 'walk' && a.id == walkId);
        else if (sessionId) activity = allShifts.find(a => a.type === 'session' && a.id == sessionId);

        if (!activity) return;

        const isOwner = currentUser && (activity.type === 'walk' ? activity.assigned_user_id === currentUser.id : activity.created_by === currentUser.id);

        // Reset modal state
        shiftForm.reset();
        if (walkId) shiftForm.dataset.id = walkId;
        else delete shiftForm.dataset.id;

        if (sessionId) shiftForm.dataset.sessionId = sessionId;
        else delete shiftForm.dataset.sessionId;

        const modalTitle = document.querySelector('#shiftModal h2');
        const submitBtn = shiftForm.querySelector('button[type="submit"]');
        const deleteBtn = document.getElementById('modal-delete-btn');

        // Remove existing source badges
        const existingBadge = document.getElementById('modal-source-badge');
        if (existingBadge) existingBadge.remove();

        if (isOwner) {
            modalTitle.textContent = activity.type === 'session' ? 'Modifica Sessione' : 'Modifica Prenotazione';
            submitBtn.textContent = 'Salva Modifiche';
            submitBtn.classList.remove('hidden');
            if (deleteBtn) {
                deleteBtn.classList.remove('hidden');
                deleteBtn.textContent = activity.type === 'session' ? 'Elimina Sessione' : 'Elimina Prenotazione';
            }
        } else {
            modalTitle.textContent = 'Dettaglio Attività';
            submitBtn.classList.add('hidden');
            if (deleteBtn) deleteBtn.classList.add('hidden');
        }

        // Fill data
        const inputs = shiftForm.querySelectorAll('input');
        inputs[0].value = activity.start_time.substring(0, 5);
        inputs[1].value = activity.end_time?.substring(0, 5) || '';
        inputs[2].value = activity.notes || '';

        // Reminders
        if (reminderEnabled) {
            reminderEnabled.checked = activity.reminder_enabled || false;
            if (reminderEnabled.checked) reminderOptions?.classList.remove('hidden');
            else reminderOptions?.classList.add('hidden');
            reminderEnabled.disabled = !isOwner || activity.type === 'session';
        }
        const reminderMinutesEl = document.getElementById('reminder-minutes');
        if (reminderMinutesEl) {
            reminderMinutesEl.value = activity.reminder_minutes_before || '30';
            reminderMinutesEl.disabled = !isOwner || activity.type === 'session';
        }

        // Read-only if not owner or if it's a concluded session
        const isConcluded = activity.type === 'session' || (activity.sessions && activity.sessions.length > 0);
        inputs[0].readOnly = !isOwner || isConcluded;
        inputs[1].readOnly = !isOwner || isConcluded;
        inputs[2].readOnly = !isOwner;

        // Add extra info for detail view
        let detailInfo = document.getElementById('modal-detail-info');
        if (!detailInfo) {
            detailInfo = document.createElement('div');
            detailInfo.id = 'modal-detail-info';
            detailInfo.className = 'mt-4 pt-4 border-t border-outline-variant text-sm space-y-1';
            shiftForm.insertBefore(detailInfo, shiftForm.querySelector('.pt-md'));
        }

        const duration = calculateDuration(activity.start_time, activity.end_time);
        const dateObj = window.CiccioUtils.parseLocalDateTime(selectedDate);

        detailInfo.innerHTML = `
            <div class="flex justify-between"><span class="text-on-surface-variant">Accompagnatore:</span> <span class="font-bold">${activity.profiles?.full_name}</span></div>
            <div class="flex justify-between"><span class="text-on-surface-variant">Data:</span> <span>${window.CiccioUtils.formatDisplayDate(dateObj)}</span></div>
            <div class="flex justify-between"><span class="text-on-surface-variant">Durata ${activity.type === 'walk' ? 'programmata' : 'reale'}:</span> <span>${duration} minuti</span></div>
        `;

        if (activity.type === 'walk' && activity.sessions.length > 0) {
             // Show real data for walk with sessions
             activity.sessions.forEach((s, idx) => {
                const realStart = new Date(s.started_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', hour12: false });
                const realEnd = s.ended_at ? new Date(s.ended_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', hour12: false }) : 'In corso';

                const realDataEl = document.createElement('div');
                realDataEl.className = `pt-2 mt-2 border-t border-dashed border-outline-variant text-primary`;
                realDataEl.innerHTML = `
                    <div class="font-bold text-xs uppercase text-secondary mb-1">Dati Reali (Timbratura ${idx+1})</div>
                    <div class="flex justify-between"><span>Inizio reale:</span> <span>${realStart}</span></div>
                    <div class="flex justify-between"><span>Fine reale:</span> <span>${realEnd}</span></div>
                    ${s.duration_minutes ? `<div class="flex justify-between"><span>Durata reale:</span> <span>${s.duration_minutes} min</span></div>` : ''}
                `;
                detailInfo.appendChild(realDataEl);

                // Add source badge for the first session
                if (idx === 0) {
                    let sourceLabel = 'Timer';
                    if (s.is_manual || s.source === 'manual') sourceLabel = 'Manuale';
                    else if (s.walk_id) sourceLabel = 'Da prenotazione';

                    const badge = document.createElement('span');
                    badge.id = 'modal-source-badge';
                    badge.className = 'px-2 py-0.5 bg-secondary-container text-on-secondary-container text-[10px] rounded-full font-bold ml-2';
                    badge.textContent = sourceLabel;
                    modalTitle.after(badge);
                }
             });
        } else if (activity.type === 'session') {
             // Badge for free session
             let sourceLabel = 'Timer';
             if (activity.is_manual || activity.source === 'manual') sourceLabel = 'Manuale';
             const badge = document.createElement('span');
             badge.id = 'modal-source-badge';
             badge.className = 'px-2 py-0.5 bg-secondary-container text-on-secondary-container text-[10px] rounded-full font-bold ml-2';
             badge.textContent = sourceLabel;
             modalTitle.after(badge);
        } else {
             // Simple walk without sessions
             const badge = document.createElement('span');
             badge.id = 'modal-source-badge';
             badge.className = 'px-2 py-0.5 bg-surface-container-high text-on-surface-variant text-[10px] rounded-full font-bold ml-2';
             badge.textContent = 'Programmata';
             modalTitle.after(badge);
        }

        window.openModal();
    };

    // Add Delete button to modal if it doesn't exist
    function ensureModalDeleteBtn() {
        const footer = document.querySelector('#shiftModal .sticky.bottom-0');
        if (footer && !document.getElementById('modal-delete-btn')) {
            const delBtn = document.createElement('button');
            delBtn.id = 'modal-delete-btn';
            delBtn.type = 'button';
            delBtn.className = 'w-full bg-error/10 text-error py-sm rounded-lg font-label-md text-label-md hover:bg-error/20 transition-colors mt-2 hidden';
            delBtn.textContent = 'Elimina Prenotazione';
            delBtn.onclick = async () => {
                const sessionId = shiftForm.dataset.sessionId;
                const walkId = shiftForm.dataset.id;

                const msg = sessionId ? 'Sicuro di voler eliminare questa sessione reale?' : 'Sicuro di voler eliminare questa prenotazione?';

                if (confirm(msg)) {
                    let error = null;
                    if (sessionId) {
                        const { error: err } = await window.supabaseClient.from('walk_sessions').delete().eq('id', sessionId);
                        error = err;
                    } else {
                        const { error: err } = await window.supabaseClient.from('walks').delete().eq('id', walkId);
                        error = err;
                    }

                    if (!error) {
                        if (window.showToast) window.showToast(sessionId ? 'Sessione eliminata' : 'Prenotazione eliminata');
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
