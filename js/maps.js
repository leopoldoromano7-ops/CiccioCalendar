document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    let mode = urlParams.get('mode');

    // UI Elements
    const loadingOverlay = document.getElementById('loading-overlay');
    const emptyState = document.getElementById('empty-state');
    const emptyMessage = document.getElementById('empty-message');
    const modeBadge = document.getElementById('mode-badge');
    const activeStatus = document.getElementById('active-status');
    const backBtn = document.getElementById('back-btn');
    const backLabel = document.getElementById('back-label');

    const userNameEl = document.getElementById('user-name');
    const userAvatarEl = document.getElementById('user-avatar');
    const walkDateEl = document.getElementById('walk-date');
    const distanceEl = document.getElementById('distance-val');
    const startTimeEl = document.getElementById('start-time');
    const startCoordsEl = document.getElementById('start-coords');
    const endTimeEl = document.getElementById('end-time');
    const endCoordsEl = document.getElementById('end-coords');
    const durationEl = document.getElementById('duration-val');
    const accuracyEl = document.getElementById('accuracy-val');
    const notesContainer = document.getElementById('notes-container');
    const notesEl = document.getElementById('walk-notes');

    let map = null;
    let polyline = null;
    let startMarker = null;
    let endMarker = null;
    let currentSession = null;
    let locations = [];
    let refreshInterval = null;

    // Helper: Show Error using Empty State
    function showCriticalError(message, type = 'error') {
        console.error('Map Critical Error:', message);
        emptyMessage.textContent = message;
        const icon = emptyState.querySelector('.material-symbols-outlined');
        if (icon) icon.textContent = type;
        emptyState.classList.remove('hidden');
    }

    function hideLoading() {
        loadingOverlay.classList.add('opacity-0');
        setTimeout(() => loadingOverlay.classList.add('hidden'), 300);
    }

    // Initialize Map
    function initMap() {
        if (typeof L === 'undefined') {
            throw new Error("Libreria Leaflet non caricata.");
        }

        if (map) return;

        const tileUrl = window.APP_CONFIG?.MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        const attribution = window.APP_CONFIG?.MAP_ATTRIBUTION || '© OpenStreetMap contributors';

        map = L.map('map', {
            zoomControl: false,
            trackResize: true
        }).setView([41.9028, 12.4964], 13); // Default Roma

        L.tileLayer(tileUrl, {
            attribution: attribution
        }).addTo(map);

        L.control.zoom({
            position: 'bottomright'
        }).addTo(map);

        // Crucial for correct rendering in dynamic layouts/mobile
        const resizeObserver = new ResizeObserver(() => {
            if (map) map.invalidateSize();
        });
        resizeObserver.observe(document.getElementById('map'));

        setTimeout(() => {
            if (map) map.invalidateSize();
        }, 200);
    }

    async function loadData() {
        try {
            // Check session ID first
            if (!sessionId) {
                showCriticalError("Sessione percorso non trovata.");
                return;
            }

            // Check Leaflet
            if (typeof L === 'undefined') {
                showCriticalError("Libreria Leaflet non disponibile.");
                return;
            }

            // Initialize map early
            initMap();

            if (mode) updateBackButton();

            if (!window.supabaseClient) {
                showCriticalError("Connessione al database non inizializzata.");
                return;
            }

            // 1. Fetch Session
            const { data: session, error: sessionErr } = await window.supabaseClient
                .from('walk_sessions')
                .select(`
                    *,
                    profiles (full_name),
                    walks (*)
                `)
                .eq('id', sessionId)
                .single();

            if (sessionErr) {
                console.error('Supabase Session Error:', sessionErr);
                showCriticalError("Errore Supabase: Impossibile caricare i dati della sessione.");
                return;
            }

            if (!session) {
                showCriticalError("Sessione percorso non trovata.");
                return;
            }

            currentSession = session;

            // 2. Determine Mode
            if (!mode) {
                mode = session.is_active ? 'live' : 'history';
                updateBackButton();
            }

            // 3. Fetch Locations
            const { data: locs, error: locsErr } = await window.supabaseClient
                .from('walk_locations')
                .eq('walk_session_id', sessionId)
                .order('recorded_at', { ascending: true });

            if (locsErr) {
                console.error('Supabase Locations Error:', locsErr);
            }

            locations = locs || [];

            updateUI();
            renderRoute();

            if (mode === 'live' && session.is_active) {
                startLiveUpdates();
            }

        } catch (err) {
            console.error('Unexpected Map Error:', err);
            showCriticalError("Si è verificato un errore imprevisto.");
        } finally {
            hideLoading();
        }
    }

    function updateBackButton() {
        if (mode === 'live') {
            backLabel.textContent = 'Torna alla timbratura';
            backBtn.onclick = () => window.location.href = 'timbratura.html';
        } else {
            backLabel.textContent = 'Torna al report';
            backBtn.onclick = () => window.location.href = 'report.html';
        }
    }

    function updateUI() {
        if (!currentSession) return;

        modeBadge.classList.remove('hidden');
        if (mode === 'live') {
            modeBadge.textContent = 'In corso';
            modeBadge.className = 'font-label-sm px-3 py-1 rounded-full uppercase tracking-wider bg-primary text-on-primary';
            activeStatus.classList.remove('hidden');
        } else {
            modeBadge.textContent = 'Completato';
            modeBadge.className = 'font-label-sm px-3 py-1 rounded-full uppercase tracking-wider bg-secondary-container text-on-secondary-container';
            activeStatus.classList.add('hidden');
        }
        updateBackButton();

        const name = currentSession.profiles?.full_name || 'Dato non disponibile';
        userNameEl.textContent = name;
        userAvatarEl.textContent = name !== 'Dato non disponibile' ? name.substring(0, 2).toUpperCase() : '?';

        const dateObj = new Date(currentSession.started_at);
        walkDateEl.textContent = dateObj.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        startTimeEl.textContent = dateObj.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

        if (currentSession.ended_at) {
            endTimeEl.textContent = new Date(currentSession.ended_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        } else if (mode === 'live') {
            endTimeEl.textContent = 'In corso...';
        } else {
            endTimeEl.textContent = 'Non disponibile';
        }

        if (currentSession.duration_minutes) {
            durationEl.textContent = `${currentSession.duration_minutes} min`;
        } else if (currentSession.started_at) {
            const now = currentSession.ended_at ? new Date(currentSession.ended_at) : new Date();
            const start = new Date(currentSession.started_at);
            const diff = Math.max(0, Math.round((now - start) / 60000));
            durationEl.textContent = `${diff} min`;
        } else {
            durationEl.textContent = '-- min';
        }

        if (currentSession.walks?.notes) {
            notesContainer.classList.remove('hidden');
            notesEl.textContent = currentSession.walks.notes;
        } else {
            notesContainer.classList.add('hidden');
        }

        if (locations.length > 0) {
            const firstLoc = locations[0];
            const lastLoc = locations[locations.length - 1];
            startCoordsEl.textContent = `Lat ${firstLoc.latitude.toFixed(4)}, Lng ${firstLoc.longitude.toFixed(4)}`;

            if (mode !== 'live' || currentSession.ended_at) {
                endCoordsEl.textContent = `Lat ${lastLoc.latitude.toFixed(4)}, Lng ${lastLoc.longitude.toFixed(4)}`;
            } else {
                const now = new Date();
                endCoordsEl.textContent = `Ultimo agg: ${now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
            }
            accuracyEl.textContent = lastLoc.accuracy ? `+/- ${Math.round(lastLoc.accuracy)}m` : 'Non disponibile';
        } else {
            startCoordsEl.textContent = 'Nessun segnale GPS';
            endCoordsEl.textContent = 'Nessun segnale GPS';
            accuracyEl.textContent = '--';
        }
    }

    function renderRoute() {
        if (!map) return;
        if (polyline) map.removeLayer(polyline);
        if (startMarker) map.removeLayer(startMarker);
        if (endMarker) map.removeLayer(endMarker);

        if (locations.length >= 2) {
            const coords = locations.map(l => [l.latitude, l.longitude]);
            polyline = L.polyline(coords, { color: '#282625', weight: 6, opacity: 0.9, lineJoin: 'round' }).addTo(map);

            const startIcon = L.divIcon({
                className: 'custom-start-marker',
                html: `<div class="w-4 h-4 bg-secondary border-2 border-white rounded-full shadow-lg flex items-center justify-center"><span class="text-[8px] text-white font-bold">PARTENZA</span></div>`,
                iconSize: [48, 16], iconAnchor: [24, 8]
            });
            startMarker = L.marker(coords[0], { icon: startIcon }).addTo(map).bindPopup('Punto di partenza');

            const endLabel = mode === 'live' ? 'LIVE' : 'ARRIVO';
            const endIcon = L.divIcon({
                className: 'custom-end-marker',
                html: `<div class="px-2 py-0.5 bg-primary border-2 border-white rounded-full shadow-lg flex items-center justify-center ${mode === 'live' ? 'animate-pulse' : ''}"><span class="text-[10px] text-white font-bold">${endLabel}</span></div>`,
                iconSize: [54, 24], iconAnchor: [27, 12]
            });
            endMarker = L.marker(coords[coords.length - 1], { icon: endIcon }).addTo(map).bindPopup(mode === 'live' ? 'Posizione attuale' : 'Arrivo');

            map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
            emptyState.classList.add('hidden');
            updateDistance(coords);
        } else if (locations.length === 1 || (currentSession && currentSession.start_lat && currentSession.start_lng)) {
            const lat = locations.length === 1 ? locations[0].latitude : currentSession.start_lat;
            const lng = locations.length === 1 ? locations[0].longitude : currentSession.start_lng;
            const coord = [lat, lng];

            map.setView(coord, 16);
            const icon = L.divIcon({
                className: 'custom-start-marker',
                html: `<div class="px-2 py-0.5 bg-primary border-2 border-white rounded-full shadow-lg ${mode === 'live' ? 'animate-pulse' : ''}"><span class="text-[10px] text-white font-bold">ATTUALE</span></div>`,
                iconSize: [60, 24], iconAnchor: [30, 12]
            });
            startMarker = L.marker(coord, { icon: icon }).addTo(map).bindPopup(mode === 'live' ? 'Posizione attuale' : 'Punto registrato');

            emptyState.classList.add('hidden');
            updateDistance([]);
        } else {
            emptyState.classList.remove('hidden');
            emptyMessage.textContent = 'Nessun percorso GPS registrato per questa passeggiata.';
            distanceEl.textContent = '0.00 km';
        }
    }

    function updateDistance(coords) {
        if (!currentSession) return;

        let meters = 0;
        const noteEl = document.getElementById('distance-note') || createDistanceNote();

        if (mode === 'live' && coords.length > 1 && window.CiccioUtils) {
            meters = window.CiccioUtils.calculateDistanceMeters(coords.map(c => ({ lat: c[0], lng: c[1] })));
            tryUpdateSessionDistance(meters);
        } else if (currentSession.distance_meters > 0) {
            meters = currentSession.distance_meters;
        } else if (coords.length > 1 && window.CiccioUtils) {
            meters = window.CiccioUtils.calculateDistanceMeters(coords.map(c => ({ lat: c[0], lng: c[1] })));
        }

        distanceEl.textContent = `${(meters / 1000).toFixed(2)} km`;

        if (locations.length === 1 && meters === 0) {
            noteEl.textContent = 'Percorso troppo breve per calcolare distanza';
            noteEl.classList.remove('hidden');
        } else {
            noteEl.classList.add('hidden');
        }
    }

    function createDistanceNote() {
        const note = document.createElement('p');
        note.id = 'distance-note';
        note.className = 'text-[10px] text-secondary mt-1 hidden';
        distanceEl.parentElement.appendChild(note);
        return note;
    }

    async function tryUpdateSessionDistance(meters) {
        if (!window.supabaseClient || mode !== 'live') return;
        await window.supabaseClient.from('walk_sessions').update({ distance_meters: meters }).eq('id', sessionId);
    }

    function startLiveUpdates() {
        if (refreshInterval) clearInterval(refreshInterval);
        refreshInterval = setInterval(async () => {
            try {
                const { data: session, error: sessionErr } = await window.supabaseClient
                    .from('walk_sessions')
                    .select(`
                        *,
                        profiles (full_name),
                        walks (*)
                    `)
                    .eq('id', sessionId)
                    .single();

                if (sessionErr) throw sessionErr;

                if (session) {
                    currentSession = session;
                    if (!session.is_active) {
                        mode = 'history';
                        clearInterval(refreshInterval);
                    }
                }

                const { data: locs, error: locsErr } = await window.supabaseClient
                    .from('walk_locations')
                    .eq('walk_session_id', sessionId)
                    .order('recorded_at', { ascending: true });

                if (locsErr) throw locsErr;

                if (locs) locations = locs;
                updateUI();
                renderRoute();
            } catch (err) {
                console.warn('Live Update Error:', err);
                // Do not show critical error to avoid interrupting the live experience
            }
        }, 15000);
    }

    loadData();
});
