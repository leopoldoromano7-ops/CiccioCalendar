/**
 * CiccioSheets Utilities
 * Shared helper functions for date/time manipulation and formatting
 */

const Utils = {
    /**
     * Parses a date string (YYYY-MM-DD) and optional time string (HH:mm)
     * into a local Date object without UTC shifts.
     */
    parseLocalDateTime(dateStr, timeStr = '00:00') {
        if (!dateStr) return new Date();
        const [y, m, d] = dateStr.split('-').map(Number);
        const [hh, mm] = timeStr.split(':').map(Number);
        return new Date(y, m - 1, d, hh, mm);
    },

    /**
     * Formats a Date object to HH:mm string
     */
    formatLocalTime(date) {
        return date.toLocaleTimeString('it-IT', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    },

    /**
     * Formats a Date object for display (e.g., "lunedì 26 maggio 2024")
     */
    formatDisplayDate(date) {
        return date.toLocaleDateString('it-IT', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    },

    /**
     * Adds minutes to an HH:mm string and returns a new HH:mm string
     */
    addMinutesToTime(timeStr, minutes) {
        if (!timeStr) return '00:00';
        const [h, m] = timeStr.split(':').map(Number);
        let totalMinutes = h * 60 + m + minutes;

        // Handle wrap around for 24h
        totalMinutes = totalMinutes % 1440;
        if (totalMinutes < 0) totalMinutes += 1440;

        const newH = Math.floor(totalMinutes / 60);
        const newM = totalMinutes % 60;
        return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
    },

    /**
     * Calculates duration in minutes between two HH:mm strings
     */
    calculateDurationMinutes(startStr, endStr) {
        if (!startStr || !endStr) return 0;
        const [h1, m1] = startStr.split(':').map(Number);
        const [h2, m2] = endStr.split(':').map(Number);
        const start = h1 * 60 + m1;
        const end = h2 * 60 + m2;

        let diff = end - start;
        // If end is before start, assume it's the next day
        if (diff < 0) diff += 1440;
        return diff;
    },

    /**
     * Shortens a name to a specific limit, adding ellipsis if needed (optional)
     * Or just truncating as requested.
     */
    shortenName(name, limit = 5) {
        if (!name) return '';
        if (name.length <= limit) return name;
        return name.substring(0, limit);
    },

    /**
     * Formats time for display in cards: HH:mm · Name
     */
    formatCardLabel(timeStr, name) {
        const time = timeStr ? timeStr.substring(0, 5) : '--:--';
        const shortName = this.shortenName(name, 5);
        return `${time} · ${shortName}`;
    }
};

// Export to window for global access in Vanilla JS
window.CiccioUtils = Utils;
