document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    let mode = urlParams.get('mode');

    if (!sessionId) {
        window.location.href = 'index.html';
        return;
    }

    const mapEl = document.getElementById('map');
    const loadingOverlay = document.getElementById('loading-overlay');
    const emptyState = document.getElementById('empty-state');
    const modeBadge = document.getElementById('mode-badge');
    const activeStatus = document.getElementById('active-status');
    const backBtn = document.getElementById('back-btn');
    const backLabel = document.getElementById('back-label');

    const userNameEl = document.getElementById('user-name');
    const userAvatarEl = document.getElementById('user-avatar');
    const walkDateEl = document.getElementById('walk-date');
    const distanceEl = document.getElementById('distance-val');
    const startTimeEl = document.getElementById('start-time');
    const endTimeEl = document.getElementById('end-time');
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

    // Initialize Map
    function initMap() {
        map = L.map('map', {
            zoomControl: false
        }).setView([45.4642, 9.1900], 13); // Default Milano

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        L.control.zoom({
            position: 'bottomright'
        }).addTo(map);
    }

    async function loadData() {
        if (!window.supabaseClient) return;

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

        if (sessionErr || !session) {
            console.error('Error fetching session:', sessionErr);
            loadingOverlay.innerHTML = '<p class="text-error">Errore nel caricamento della sessione.</p>';
            return;
        }

        currentSession = session;

        // 2. Determine Mode if missing
        if (!mode) {
            if (session.is_active) mode = 'live';
            else if (session.ended_at) mode = 'history';
            else mode = 'history'; // Fallback
        }

        // 3. Fetch Locations
        const { data: locs, error: locsErr } = await window.supabaseClient
            .from('walk_locations')
            .eq('walk_session_id', sessionId)
            .order('recorded_at', { ascending: true });

        locations = locs || [];

        updateUI();
        renderRoute();

        loadingOverlay.classList.add('hidden');

        if (mode === 'live' && session.is_active) {
            startLiveUpdates();
        }
    }

    function updateUI() {
        // Badge Mode
        if (mode === 'live') {
            modeBadge.textContent = 'Live';
            modeBadge.className = 'px-sm py-xs rounded-full text-[10px] font-bold uppercase bg-primary text-on-primary';
            activeStatus.classList.remove('hidden');
            backLabel.textContent = 'Torna alla timbratura';
            backBtn.onclick = () => window.location.href = 'timbratura.html';
        } else {
            modeBadge.textContent = 'History';
            modeBadge.className = 'px-sm py-xs rounded-full text-[10px] font-bold uppercase bg-secondary-container text-on-secondary-container';
            activeStatus.classList.add('hidden');
            backLabel.textContent = 'Torna al report';
            backBtn.onclick = () => window.location.href = 'report.html';
        }

        // User Info
        const name = currentSession.profiles?.full_name || 'Utente';
        userNameEl.textContent = name;
        userAvatarEl.textContent = name.substring(0, 2).toUpperCase();

        const dateObj = new Date(currentSession.started_at);
        walkDateEl.textContent = dateObj.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

        // Times
        startTimeEl.textContent = dateObj.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        if (currentSession.ended_at) {
            endTimeEl.textContent = new Date(currentSession.ended_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        } else {
            endTimeEl.textContent = '--:--';
        }

        // Duration
        if (currentSession.duration_minutes) {
            durationEl.textContent = `${currentSession.duration_minutes} min`;
        } else if (currentSession.started_at) {
            const now = new Date();
            const start = new Date(currentSession.started_at);
            const diff = Math.round((now - start) / 60000);
            durationEl.textContent = `${diff} min`;
        }

        // Notes
        if (currentSession.walks?.notes) {
            notesContainer.classList.remove('hidden');
            notesEl.textContent = currentSession.walks.notes;
        } else {
            notesContainer.classList.add('hidden');
        }

        // Accuracy
        if (locations.length > 0) {
            const lastLoc = locations[locations.length - 1];
            if (lastLoc.accuracy) {
                accuracyEl.textContent = `${Math.round(lastLoc.accuracy)}m`;
            } else {
                accuracyEl.textContent = 'Non disponibile';
            }
        } else {
            accuracyEl.textContent = '--';
        }
    }

    function renderRoute() {
        if (!map) return;

        // Clear existing layers
        if (polyline) map.removeLayer(polyline);
        if (startMarker) map.removeLayer(startMarker);
        if (endMarker) map.removeLayer(endMarker);

        if (locations.length > 0) {
            const coords = locations.map(l => [l.latitude, l.longitude]);

            polyline = L.polyline(coords, {
                color: '#282625', // Primary
                weight: 5,
                opacity: 0.8,
                lineJoin: 'round'
            }).addTo(map);

            // Start Marker
            startMarker = L.circleMarker(coords[0], {
                radius: 8,
                fillColor: '#6b5c4c', // Secondary
                color: '#fff',
                weight: 2,
                fillOpacity: 1
            }).addTo(map).bindPopup('Partenza');

            // End/Current Marker
            const lastCoord = coords[coords.length - 1];
            endMarker = L.marker(lastCoord, {
                icon: L.divIcon({
                    className: 'custom-div-icon',
                    html: `<div class="w-4 h-4 bg-primary border-2 border-white rounded-full shadow-md ${mode === 'live' ? 'animate-pulse' : ''}"></div>`,
                    iconSize: [16, 16],
                    iconAnchor: [8, 8]
                })
            }).addTo(map).bindPopup(mode === 'live' ? 'Posizione attuale' : 'Arrivo');

            map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
            emptyState.classList.add('hidden');

            // Distance calculation
            updateDistance(coords);

        } else if (currentSession.start_lat && currentSession.start_lng) {
            const startCoord = [currentSession.start_lat, currentSession.start_lng];
            map.setView(startCoord, 16);
            startMarker = L.marker(startCoord).addTo(map).bindPopup('Posizione iniziale');

            emptyState.classList.remove('hidden');
            document.getElementById('empty-message').textContent = 'Percorso non disponibile, solo posizione iniziale salvata.';
            distanceEl.textContent = '0.0 km';
        } else {
            emptyState.classList.remove('hidden');
            document.getElementById('empty-message').textContent = 'Nessun percorso registrato per questa passeggiata.';
            distanceEl.textContent = '0.0 km';
        }
    }

    function updateDistance(coords) {
        if (currentSession.distance_meters > 0) {
            distanceEl.textContent = `${(currentSession.distance_meters / 1000).toFixed(2)} km`;
        } else if (coords.length > 1) {
            let total = 0;
            for (let i = 0; i < coords.length - 1; i++) {
                total += haversineDistance(coords[i], coords[i+1]);
            }
            distanceEl.textContent = `${(total / 1000).toFixed(2)} km`;

            // Try updating DB (optional)
            tryUpdateSessionDistance(total);
        }
    }

    async function tryUpdateSessionDistance(meters) {
        if (mode !== 'live') return;
        // Simple throttle/debounce could be added, but here we just try
        await window.supabaseClient
            .from('walk_sessions')
            .update({ distance_meters: meters })
            .eq('id', sessionId);
    }

    function haversineDistance(coords1, coords2) {
        const [lat1, lon1] = coords1;
        const [lat2, lon2] = coords2;
        const R = 6371e3; // metres
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lon2-lon1) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }

    function startLiveUpdates() {
        if (refreshInterval) clearInterval(refreshInterval);
        refreshInterval = setInterval(async () => {
            console.log('Refreshing live data...');

            // Re-fetch session for status/distance
            const { data: session } = await window.supabaseClient
                .from('walk_sessions')
                .select('*, walks(notes)')
                .eq('id', sessionId)
                .single();

            if (session) {
                currentSession = session;
                if (!session.is_active) {
                    mode = 'history';
                    clearInterval(refreshInterval);
                }
            }

            // Fetch new locations
            const { data: locs } = await window.supabaseClient
                .from('walk_locations')
                .eq('walk_session_id', sessionId)
                .order('recorded_at', { ascending: true });

            if (locs) {
                locations = locs;
            }

            updateUI();
            renderRoute();
        }, 15000); // 15 seconds
    }

    initMap();
    loadData();
});
