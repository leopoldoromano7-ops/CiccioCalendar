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
    function showCriticalError(message) {
        console.error('Map Critical Error:', message);
        emptyMessage.textContent = message;
        const icon = emptyState.querySelector('.material-symbols-outlined');
        if (icon) icon.textContent = 'error';
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

        map = L.map('map', {
            zoomControl: false,
            trackResize: true
        }).setView([41.9028, 12.4964], 13); // Default Roma

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        L.control.zoom({
            position: 'bottomright'
        }).addTo(map);

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
                showCriticalError("Mappa non disponibile. Riprova più tardi.");
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
                showCriticalError("Errore nel caricamento del percorso.");
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
                endCoordsEl.textContent = 'In tempo reale...';
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

        if (locations.length > 0) {
            const coords = locations.map(l => [l.latitude, l.longitude]);
            polyline = L.polyline(coords, { color: '#282625', weight: 6, opacity: 0.9, lineJoin: 'round' }).addTo(map);

            const startIcon = L.divIcon({
                className: 'custom-start-marker',
                html: `<div class="w-4 h-4 bg-secondary border-2 border-white rounded-full shadow-lg"></div>`,
                iconSize: [16, 16], iconAnchor: [8, 8]
            });
            startMarker = L.marker(coords[0], { icon: startIcon }).addTo(map).bindPopup('Partenza');

            const endIcon = L.divIcon({
                className: 'custom-end-marker',
                html: `<div class="w-5 h-5 bg-primary border-2 border-white rounded-full shadow-lg ${mode === 'live' ? 'animate-pulse' : ''}"></div>`,
                iconSize: [20, 20], iconAnchor: [10, 10]
            });
            endMarker = L.marker(coords[coords.length - 1], { icon: endIcon }).addTo(map).bindPopup(mode === 'live' ? 'Posizione attuale' : 'Arrivo');

            map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
            emptyState.classList.add('hidden');
            updateDistance(coords);
        } else if (currentSession && currentSession.start_lat && currentSession.start_lng) {
            const startCoord = [currentSession.start_lat, currentSession.start_lng];
            map.setView(startCoord, 16);
            const startIcon = L.divIcon({
                className: 'custom-start-marker',
                html: `<div class="w-4 h-4 bg-secondary border-2 border-white rounded-full shadow-lg"></div>`,
                iconSize: [16, 16], iconAnchor: [8, 8]
            });
            startMarker = L.marker(startCoord, { icon: startIcon }).addTo(map).bindPopup('Posizione iniziale');
            emptyState.classList.remove('hidden');
            emptyMessage.textContent = 'Percorso non disponibile, solo posizione iniziale salvata.';
            distanceEl.textContent = '0.00 km';
        } else {
            emptyState.classList.remove('hidden');
            emptyMessage.textContent = 'Nessun percorso registrato per questa passeggiata.';
            distanceEl.textContent = '0.00 km';
        }
    }

    function updateDistance(coords) {
        if (!currentSession) return;
        if (currentSession.distance_meters > 0) {
            distanceEl.textContent = `${(currentSession.distance_meters / 1000).toFixed(2)} km`;
        } else if (coords.length > 1) {
            let total = 0;
            for (let i = 0; i < coords.length - 1; i++) {
                total += haversineDistance(coords[i], coords[i+1]);
            }
            distanceEl.textContent = `${(total / 1000).toFixed(2)} km`;
            if (mode === 'live') tryUpdateSessionDistance(total);
        } else {
            distanceEl.textContent = '0.00 km';
        }
    }

    async function tryUpdateSessionDistance(meters) {
        if (!window.supabaseClient || mode !== 'live') return;
        await window.supabaseClient.from('walk_sessions').update({ distance_meters: meters }).eq('id', sessionId);
    }

    function haversineDistance(coords1, coords2) {
        const [lat1, lon1] = coords1;
        const [lat2, lon2] = coords2;
        const R = 6371e3;
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lon2-lon1) * Math.PI/180;
        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    function startLiveUpdates() {
        if (refreshInterval) clearInterval(refreshInterval);
        refreshInterval = setInterval(async () => {
            const { data: session } = await window.supabaseClient.from('walk_sessions').select('*, walks(notes)').eq('id', sessionId).single();
            if (session) {
                currentSession = session;
                if (!session.is_active) {
                    mode = 'history';
                    clearInterval(refreshInterval);
                }
            }
            const { data: locs } = await window.supabaseClient.from('walk_locations').eq('walk_session_id', sessionId).order('recorded_at', { ascending: true });
            if (locs) locations = locs;
            updateUI();
            renderRoute();
        }, 15000);
    }

    loadData();
});
