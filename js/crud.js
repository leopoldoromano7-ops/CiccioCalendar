document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const selectedDate = urlParams.get('date') || new Date().toISOString().split('T')[0];

    const dateTitle = document.querySelector('h1');
    if (dateTitle) dateTitle.textContent = new Date(selectedDate).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const shiftList = document.querySelector('.relative.z-10.grid'); // Selector might need tuning
    const staffList = document.querySelector('.lg\\:col-span-4 .space-y-md');
    const shiftForm = document.querySelector('#shiftModal form');

    // Load shifts for the day
    async function loadShifts() {
        const { data, error } = await window.supabaseClient
            .from('walks')
            .select('*, profiles(full_name)')
            .eq('walk_date', selectedDate);

        if (data) {
            renderTimeline(data);
            renderStaff(data);
        }
    }

    function renderTimeline(walks) {
        // Find the absolute container for shift blocks
        const timelineContainer = document.querySelector('.relative.z-10');
        if (!timelineContainer) return;

        // Clear existing dynamic blocks
        document.querySelectorAll('.absolute-shift-block').forEach(el => el.remove());

        walks.forEach(walk => {
            const startHour = parseInt(walk.start_time.split(':')[0]);
            const startMin = parseInt(walk.start_time.split(':')[1]);
            const endHour = walk.end_time ? parseInt(walk.end_time.split(':')[0]) : startHour + 1;

            const top = (startHour * 64) + (startMin * 64 / 60);
            const height = ((endHour - startHour) * 64);

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
                             <span class="material-symbols-outlined text-secondary opacity-0 group-hover:opacity-100 transition-opacity edit-walk" data-id="${walk.id}">edit</span>
                             <span class="material-symbols-outlined text-error opacity-0 group-hover:opacity-100 transition-opacity delete-walk" data-id="${walk.id}">delete</span>
                        </div>
                    </div>
                </div>
            `;
            timelineContainer.appendChild(block);
        });

        // Add event listeners for edit/delete
        document.querySelectorAll('.delete-walk').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Sicuro di voler eliminare questa passeggiata?')) {
                    const id = e.target.dataset.id;
                    await window.supabaseClient.from('walks').delete().eq('id', id);
                    loadShifts();
                }
            });
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
    }

    // Handle Form Submit
    if (shiftForm) {
        shiftForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const { data: { user } } = await window.supabaseClient.auth.getUser();

            const startTime = shiftForm.querySelector('input[type="time"]:first-of-type').value;
            const endTime = shiftForm.querySelector('input[type="time"]:last-of-type').value;

            const { error } = await window.supabaseClient
                .from('walks')
                .insert([{
                    walk_date: selectedDate,
                    start_time: startTime,
                    end_time: endTime,
                    assigned_user_id: user.id
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
