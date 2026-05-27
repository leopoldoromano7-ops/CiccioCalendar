/**
 * Notification Service for CiccioSheets
 */

class NotificationService {
    constructor() {
        this.checkInterval = null;
        this.notifiedIds = new Set();
        this.init();
    }

    async init() {
        if ("Notification" in window) {
            if (Notification.permission === "granted") {
                this.startMonitoring();
            }
        }
    }

    startMonitoring() {
        if (this.checkInterval) return;
        this.checkInterval = setInterval(() => this.checkReminders(), 60000); // Check every minute
        this.checkReminders();
    }

    async checkReminders() {
        if (!window.supabaseClient) return;
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return;

        const today = new Date().toISOString().split('T')[0];
        const { data: walks } = await window.supabaseClient
            .from('walks')
            .select('*')
            .eq('assigned_user_id', user.id)
            .eq('walk_date', today)
            .eq('reminder_enabled', true);

        if (!walks) return;

        const now = new Date();
        walks.forEach(walk => {
            if (this.notifiedIds.has(walk.id)) return;

            const [h, m] = walk.start_time.split(':').map(Number);
            const walkTime = new Date();
            walkTime.setHours(h, m, 0, 0);

            const diffMinutes = (walkTime - now) / 60000;
            const threshold = walk.reminder_minutes_before || 30;

            if (diffMinutes > 0 && diffMinutes <= threshold) {
                this.sendNotification(walk);
                this.notifiedIds.add(walk.id);
            }
        });
    }

    sendNotification(walk) {
        const title = "Promemoria Passeggiata 🐾";
        const options = {
            body: `La tua uscita "${walk.notes || 'Passeggiata'}" è prevista alle ${walk.start_time.substring(0,5)}.`,
            icon: '/favicon.svg'
        };

        if (Notification.permission === "granted") {
            new Notification(title, options);
        }

        // Always show toast as fallback or extra feedback
        if (window.showToast) {
            window.showToast(`${title}: ${options.body}`);
        }
    }
}

window.notificationService = new NotificationService();
