document.addEventListener('DOMContentLoaded', async () => {
    const clockBtn = document.getElementById('clockBtn');
    const clockIcon = document.getElementById('clockIcon');
    const clockLabel = document.getElementById('clockLabel');
    const timerDisplay = document.getElementById('timerDisplay');
    const statusBadge = document.getElementById('statusBadge');
    const activeDetails = document.getElementById('activeDetails');
    const startTimeLabel = document.getElementById('startTimeLabel');
    const historyList = document.querySelector('#historySection .space-y-sm');

    let activeSession = null;
    let timerInterval = null;

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
    }

    function formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return [h, m, s].map(v => v < 10 ? "0" + v : v).join(":");
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
            const { data, error } = await window.supabaseClient
                .from('walk_sessions')
                .insert([{
                    started_at: startTime.toISOString(),
                    created_by: user.id,
                    is_active: true
                }])
                .select()
                .single();

            if (error) {
                alert('Errore: ' + error.message);
            } else {
                activeSession = data;
                uiStartWalk(startTime);
            }
        } else {
            // STOP
            const endTime = new Date();
            const { error: sessionError } = await window.supabaseClient
                .from('walk_sessions')
                .update({
                    ended_at: endTime.toISOString(),
                    is_active: false
                })
                .eq('id', activeSession.id);

            if (sessionError) {
                alert('Errore durante la chiusura: ' + sessionError.message);
                return;
            }

            // Create record in walks table
            const { error: walkError } = await window.supabaseClient
                .from('walks')
                .insert([{
                    walk_date: endTime.toISOString().split('T')[0],
                    assigned_user_id: user.id,
                    start_time: new Date(activeSession.started_at).toLocaleTimeString('it-IT', { hour12: false }),
                    end_time: endTime.toLocaleTimeString('it-IT', { hour12: false }),
                    notes: 'Sessione registrata via timbratura'
                }]);

            if (walkError) console.error('Errore salvataggio passeggiata:', walkError);

            activeSession = null;
            uiStopWalk();
            loadHistory();
        }
    });

    async function loadHistory() {
        const { data, error } = await window.supabaseClient
            .from('walks')
            .select('*, profiles(full_name)')
            .order('walk_date', { ascending: false }, 'start_time', { ascending: false })
            .limit(5);

        if (data) {
            historyList.innerHTML = '';
            data.forEach(walk => {
                const item = document.createElement('div');
                item.className = 'flex items-center justify-between p-md bg-white rounded-xl border border-outline-variant/50 hover:border-secondary transition-colors group';
                item.innerHTML = `
                    <div class="flex items-center gap-md">
                        <div class="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-secondary">
                            <span class="material-symbols-outlined">history</span>
                        </div>
                        <div>
                            <p class="font-label-md text-label-md text-primary">Passeggiata</p>
                            <p class="text-xs text-secondary">${walk.walk_date} - ${walk.start_time} to ${walk.end_time}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="font-label-md text-label-md text-primary">${walk.profiles?.full_name || 'Utente'}</p>
                    </div>
                `;
                historyList.appendChild(item);
            });
        }
    }

    fetchActiveSession();
    loadHistory();
});
