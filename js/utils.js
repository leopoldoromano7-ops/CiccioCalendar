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
    },

    /**
     * Calculates distance between two points in meters using Haversine formula
     */
    haversineDistance(p1, p2) {
        const lat1 = p1.latitude || p1.lat;
        const lon1 = p1.longitude || p1.lng;
        const lat2 = p2.latitude || p2.lat;
        const lon2 = p2.longitude || p2.lng;

        if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return 0;

        const R = 6371e3; // Earth radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    },

    /**
     * Calculates total distance for an array of points
     */
    calculateDistanceMeters(points) {
        if (!points || points.length < 2) return 0;
        let total = 0;
        for (let i = 0; i < points.length - 1; i++) {
            total += this.haversineDistance(points[i], points[i + 1]);
        }
        return total;
    },

    /**
     * Formats duration from minutes or seconds into a readable string
     * @param {number} value The value to format
     * @param {string} unit 'min' or 'sec'
     */
    formatDuration(value, unit = 'min') {
        let totalSeconds = unit === 'min' ? Math.round(value * 60) : Math.round(value);
        if (totalSeconds < 0) totalSeconds = 0;

        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;

        if (h > 0) {
            return `${h}h ${m}m ${s}s`;
        } else if (m > 0) {
            return `${m}m ${s}s`;
        } else {
            return `${s}s`;
        }
    }
};

// Export to window for global access in Vanilla JS
window.CiccioUtils = Utils;
