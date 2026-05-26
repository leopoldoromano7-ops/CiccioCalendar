document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const selectedDate = urlParams.get('date') || new Date().toISOString().split('T')[0];

    const dateTitle = document.querySelector('h1');
    if (dateTitle) dateTitle.textContent = new Date(selectedDate).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const timelineContainer = document.querySelector('.relative.z-10');
    const staffList = document.querySelector('.lg\\:col-span-4 .space-y-md');
    const shiftForm = document.querySelector('#shiftModal form');
    const totalDurationEl = document.getElementById('total-duration-display');
    const totalStaffEl = document.getElementById('total-staff-count');

    // Load shifts for the day
    async function loadShifts() {
        if (!window.supabaseClient) return;

        const { data, error } = await window.supabaseClient
            .from('walks')
            .select('*, profiles(full_name)')
            .eq('walk_date', selectedDate);

        if (data) {
            renderTimeline(data);
            renderStaff(data);
            updateSummary(data);
        }
    }

    function calculateDuration(startStr, endStr) {
        if (!startStr || !endStr) return 60; // default 1h
        const start = new Date(`1970-01-01T${startStr}`);
        const end = new Date(`1970-01-01T${endStr}`);
        let diff = (end - start) / 60000;
        if (diff < 0) diff += 1440;
        return diff;
    }

    function renderTimeline(walks) {
        if (!timelineContainer) return;
        document.querySelectorAll('.absolute-shift-block').forEach(el => el.remove());

        walks.forEach(walk => {
            const startParts = walk.start_time.split(':');
            const startHour = parseInt(startParts[0]);
            const startMin = parseInt(startParts[1]);

            const duration = calculateDuration(walk.start_time, walk.end_time);

            const top = (startHour * 64) + (startMin * 64 / 60);
            const height = (duration * 64 / 60);

            const block = document.createElement('div');
            block.className = 'absolute left-[60px] right-0 p-xs absolute-shift-block';
            block.style.top = `${top}px`;
            block.style.height = `${height}px`;
            block.style.zIndex = '20';

            block.innerHTML = `
                <div class="w-full h-full bg-surface-container-high rounded-lg border-l-4 border-secondary p-sm shadow-sm hover:scale-[1.01] transition-all cursor-pointer group">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="font-label-md text-label-md text-primary">${walk.profiles?.full_name || 'Turno'}</p>
                            <p class="font-label-sm text-label-sm text-on-surface-variant">${walk.start_time} - ${walk.end_time || '--:--'}</p>
                        </div>
                        <div class="flex gap-2">
                             <span class="material-symbols-outlined text-error opacity-0 group-hover:opacity-100 transition-opacity delete-walk" data-id="${walk.id}">delete</span>
                        </div>
                    </div>
                </div>
            `;
            timelineContainer.appendChild(block);
        });

        document.querySelectorAll('.delete-walk').forEach(btn => {
            btn.onclick = async (e) => {
                e.stopPropagation();
                if (confirm('Sicuro di voler eliminare questa attività?')) {
                    const id = e.target.dataset.id;
                    await window.supabaseClient.from('walks').delete().eq('id', id);
                    loadShifts();
                }
            };
        });
    }

    function renderStaff(walks) {
        if (!staffList) return;
        staffList.innerHTML = '';
        const uniqueStaff = [...new Set(walks.map(w => w.profiles?.full_name))].filter(Boolean);

        uniqueStaff.forEach(name => {
            const item = document.createElement('div');
            item.className = 'flex items-center gap-sm';
            item.innerHTML = `
                <div class="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container font-bold">
                    ${name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                    <p class="font-label-md text-label-md text-primary">${name}</p>
                </div>
            `;
            staffList.appendChild(item);
        });

        if (totalStaffEl) totalStaffEl.textContent = `${uniqueStaff.length} Members`;
    }

    function updateSummary(walks) {
        let totalMin = 0;
        walks.forEach(w => totalMin += calculateDuration(w.start_time, w.end_time));
        if (totalDurationEl) totalDurationEl.textContent = `${Math.floor(totalMin / 60)}h ${totalMin % 60}m`;
    }

    // Handle Form Submit
    if (shiftForm) {
        shiftForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const { data: { user } } = await window.supabaseClient.auth.getUser();
            if (!user) { alert('Devi essere loggato.'); return; }

            const startTime = shiftForm.querySelector('input[type="time"]:first-of-type').value;
            const endTime = shiftForm.querySelector('input[type="time"]:last-of-type').value;
            const notes = shiftForm.querySelector('#shift-notes')?.value || 'Passeggiata';

            const { error } = await window.supabaseClient
                .from('walks')
                .insert([{
                    walk_date: selectedDate,
                    start_time: startTime,
                    end_time: endTime,
                    assigned_user_id: user.id,
                    notes: notes
                }]);

            if (error) {
                alert('Errore: ' + error.message);
            } else {
                window.closeModal();
                loadShifts();
            }
        });
    }

    loadShifts();
});
