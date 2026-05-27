document.addEventListener('DOMContentLoaded', async () => {
    const clockBtn = document.getElementById('clockBtn');
    const clockIcon = document.getElementById('clockIcon');
    const clockLabel = document.getElementById('clockLabel');
    const timerDisplay = document.getElementById('timerDisplay');
    const statusBadge = document.getElementById('statusBadge');
    const activeDetails = document.getElementById('activeDetails');
    const startTimeLabel = document.getElementById('startTimeLabel');
    const viewMapBtn = document.getElementById('viewMapBtn');
    const historyList = document.querySelector('#historySection .space-y-sm');

    let activeSession = null;
    let timerInterval = null;
    let watchId = null;

    // 1. Check if there is an active session
    async function fetchActiveSession() {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return;

        // Fetch user profile name
        const { data: profile } = await window.supabaseClient
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();

        if (profile) {
            const nameEl = document.getElementById('user-display-name');
            if (nameEl) nameEl.textContent = profile.full_name;
        }

        const { data, error } = await window.supabaseClient
            .from('walk_sessions')
            .select('*')
            .eq('is_active', true)
            .single();

        if (data) {
            activeSession = data;
            uiStartWalk(new Date(data.started_at));
        }
    }

    function uiStartWalk(startTime) {
        clockLabel.textContent = 'Termina Uscita';
        clockIcon.textContent = 'stop';
        clockBtn.classList.replace('bg-primary', 'bg-error');
        timerDisplay.classList.remove('hidden');

        statusBadge.classList.replace('bg-surface-container', 'bg-secondary-container');
        statusBadge.querySelector('span:first-child').classList.replace('bg-outline', 'bg-secondary');
        statusBadge.querySelector('span:first-child').classList.add('active-pulse');
        statusBadge.querySelector('span:last-child').textContent = 'In giro con Ciccio';

        activeDetails.classList.remove('hidden');
        startTimeLabel.textContent = startTime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

        if (activeSession && activeSession.tracking_enabled) {
            viewMapBtn.classList.remove('hidden');
            viewMapBtn.onclick = () => window.location.href = `maps.html?session_id=${activeSession.id}&mode=live`;
        } else {
            viewMapBtn.classList.add('hidden');
        }

        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            const elapsed = Math.floor((new Date() - startTime) / 1000);
            timerDisplay.textContent = formatTime(elapsed);
        }, 1000);
    }

    function uiStopWalk() {
        if (timerInterval) clearInterval(timerInterval);
        clockLabel.textContent = 'Inizia Uscita';
        clockIcon.textContent = 'play_arrow';
        clockBtn.classList.replace('bg-error', 'bg-primary');
        timerDisplay.classList.add('hidden');

        statusBadge.classList.replace('bg-secondary-container', 'bg-surface-container');
        statusBadge.querySelector('span:first-child').classList.replace('bg-secondary', 'bg-outline');
        statusBadge.querySelector('span:first-child').classList.remove('active-pulse');
        statusBadge.querySelector('span:last-child').textContent = 'Ciccio è a casa';

        activeDetails.classList.add('hidden');
        viewMapBtn.classList.add('hidden');
    }

    function formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return [h, m, s].map(v => v < 10 ? "0" + v : v).join(":");
    }

    function calculateMinutes(t1, t2) {
        const [h1, m1] = t1.split(':').map(Number);
        const [h2, m2] = t2.split(':').map(Number);
        return (h1 * 60 + m1) - (h2 * 60 + m2);
    }

    async function findCompatibleBooking(user, date, time) {
        const { data: walks } = await window.supabaseClient
            .from('walks')
            .select('*')
            .eq('assigned_user_id', user.id)
            .eq('walk_date', date);

        if (!walks || walks.length === 0) return null;

        // Find closest within 90 minutes
        let closest = null;
        let minDiff = 91;

        walks.forEach(w => {
            const diff = Math.abs(calculateMinutes(time, w.start_time.substring(0, 5)));
            if (diff < minDiff) {
                minDiff = diff;
                closest = w;
            }
        });

        return closest;
    }

    clockBtn.addEventListener('click', async () => {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) {
            alert('Devi essere loggato per timbrare.');
            return;
        }

        if (!activeSession) {
            // START
            const startTime = new Date();
            const dateStr = startTime.toISOString().split('T')[0];
            const timeStr = startTime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', hour12: false });

            const linkedBooking = await findCompatibleBooking(user, dateStr, timeStr);

            const insertData = {
                started_at: startTime.toISOString(),
                created_by: user.id,
                is_active: true,
                source: 'timer',
                tracking_enabled: true // Always enable tracking for live timer sessions
            };
            if (linkedBooking) insertData.walk_id = linkedBooking.id;

            const { data, error } = await window.supabaseClient
                .from('walk_sessions')
                .insert([insertData])
                .select()
                .single();

            if (error) {
                if (window.showToast) window.showToast('Errore: ' + error.message, 'error');
                else alert('Errore: ' + error.message);
            } else {
                activeSession = data;
                uiStartWalk(startTime);
                startTracking(user.id, data.id);
                if (window.showToast) window.showToast('Passeggiata iniziata!');
            }
        } else {
            // STOP
            const endTime = new Date();
            const startTime = new Date(activeSession.started_at);
            const duration = Math.round((endTime - startTime) / 60000);

            stopTracking();

            const { error: sessionError } = await window.supabaseClient
                .from('walk_sessions')
                .update({
                    ended_at: endTime.toISOString(),
                    is_active: false,
                    duration_minutes: duration
                })
                .eq('id', activeSession.id);

            if (sessionError) {
                if (window.showToast) window.showToast('Errore durante la chiusura: ' + sessionError.message, 'error');
                else alert('Errore durante la chiusura: ' + sessionError.message);
                return;
            }
            if (window.showToast) window.showToast('Passeggiata terminata');

            activeSession = null;
            uiStopWalk();
            loadHistory();
        }
    });

    async function loadHistory() {
        const { data, error } = await window.supabaseClient
            .from('walk_sessions')
            .select('*, profiles(full_name), walks(start_time, end_time, notes)')
            .eq('is_active', false)
            .order('started_at', { ascending: false })
            .limit(5);

        if (data) {
            historyList.innerHTML = '';
            data.forEach(session => {
                const start = new Date(session.started_at);
                const end = session.ended_at ? new Date(session.ended_at) : null;
                const dateStr = start.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
                const timeStr = `${start.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} - ${end ? end.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '??'}`;

                const item = document.createElement('div');
                item.className = 'flex items-center justify-between p-md bg-white rounded-xl border border-outline-variant/50 hover:border-secondary transition-colors group';
                item.innerHTML = `
                    <div class="flex items-center gap-md">
                        <div class="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-secondary">
                            <span class="material-symbols-outlined">history</span>
                        </div>
                        <div>
                            <p class="font-label-md text-label-md text-primary">Passeggiata ${session.is_manual ? '(Manuale)' : ''}</p>
                            <p class="text-xs text-secondary">${dateStr} · ${timeStr}</p>
                            <p class="text-[10px] text-outline italic">${session.notes || session.walks?.notes || (session.walk_id ? 'Prenotata' : 'Passeggiata libera')}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="font-label-md text-label-md text-primary">${session.profiles?.full_name || 'Utente'}</p>
                        <p class="text-[10px] font-bold text-secondary">${session.duration_minutes || 0} min</p>
                    </div>
                `;
                historyList.appendChild(item);
            });
        }
    }

    // --- GEOLOCATION ARCHITECTURE ---
    let lastPosition = null;
    function startTracking(userId, sessionId) {
        if (!("geolocation" in navigator)) return;

        watchId = navigator.geolocation.watchPosition(async (pos) => {
            const { latitude, longitude, accuracy } = pos.coords;

            // Throttling logic: check distance or time
            const now = Date.now();
            if (lastPosition && (now - lastPosition.time < 20000)) { // 20s throttle
                return;
            }

            lastPosition = { lat: latitude, lng: longitude, time: now };

            // Save to walk_locations
            await window.supabaseClient.from('walk_locations').insert([{
                walk_session_id: sessionId,
                user_id: userId,
                latitude,
                longitude,
                accuracy
            }]);

        }, (err) => console.warn('Geo error:', err), {
            enableHighAccuracy: true,
            maximumAge: 30000,
            timeout: 27000
        });
    }

    function stopTracking() {
        if (watchId) navigator.geolocation.clearWatch(watchId);
    }

    // --- MANUAL ENTRY MODAL ---
    const manualBtn = document.getElementById('manualEntryBtn');
    const manualModal = document.getElementById('manualModal');
    const manualForm = document.getElementById('manualEntryForm');
    const manualDateInput = document.getElementById('manual-date');
    const manualStartInput = document.getElementById('manual-start');
    const manualEndInput = document.getElementById('manual-end');

    window.openManualModal = () => {
        manualModal.classList.remove('hidden');
        manualDateInput.value = new Date().toISOString().split('T')[0];
        setTimeout(() => {
            document.getElementById('manualModalContent').classList.remove('scale-95', 'opacity-0');
            document.getElementById('manualModalContent').classList.add('scale-100', 'opacity-100');
        }, 10);
    };

    window.closeManualModal = () => {
        document.getElementById('manualModalContent').classList.add('scale-95', 'opacity-0');
        setTimeout(() => manualModal.classList.add('hidden'), 300);
    };

    manualBtn?.addEventListener('click', window.openManualModal);

    // Auto-check for booking when date/time changes
    [manualDateInput, manualStartInput].forEach(el => el?.addEventListener('change', async () => {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user || !manualDateInput.value || !manualStartInput.value) return;

        const booking = await findCompatibleBooking(user, manualDateInput.value, manualStartInput.value);
        const linkArea = document.getElementById('booking-link-area');
        const linkInfo = document.getElementById('booking-found-info');
        const linkId = document.getElementById('linked-booking-id');

        if (booking) {
            linkArea.classList.remove('hidden');
            linkInfo.textContent = `${booking.start_time.substring(0,5)} - ${booking.notes || 'Passeggiata'}`;
            linkId.value = booking.id;
        } else {
            linkArea.classList.add('hidden');
            linkId.value = '';
        }
    }));

    manualForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return;

        const date = manualDateInput.value;
        const start = manualStartInput.value;
        const end = manualEndInput.value;
        const notes = document.getElementById('manual-notes').value;
        const linkedId = document.getElementById('linked-booking-id').value;

        const startFull = new Date(`${date}T${start}`);
        const endFull = new Date(`${date}T${end}`);
        const duration = Math.round((endFull - startFull) / 60000);

        const { error } = await window.supabaseClient.from('walk_sessions').insert([{
            started_at: startFull.toISOString(),
            ended_at: endFull.toISOString(),
            duration_minutes: duration,
            is_active: false,
            is_manual: true,
            source: 'manual',
            created_by: user.id,
            walk_id: linkedId || null,
            notes: notes || null
        }]);

        if (error) {
            if (window.showToast) window.showToast('Errore: ' + error.message, 'error');
            else alert('Errore: ' + error.message);
        } else {
            if (window.showToast) window.showToast('Passeggiata inserita manualmente');
            window.closeManualModal();
            loadHistory();
        }
    });

    fetchActiveSession();
    loadHistory();
});
