// Date and time utility functions for IST timezone
export class DateUtils {
    // Get current IST DateTime as ISO string
    static getISTDateTime() {
        const now = new Date();
        const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000)); // Add 5.5 hours for IST
        return istTime.toISOString();
    }

    // Get IST date string in DD/MM/YYYY format
    static getISTDateString() {
        const now = new Date();
        const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000)); // Add 5.5 hours for IST
        return istTime.toLocaleDateString('en-IN', { 
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: '2-digit', 
            year: 'numeric'
        });
    }

    // Get IST date and time string with AM/PM
    static getISTDateTimeString() {
        const now = new Date();
        const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000)); // Add 5.5 hours for IST
        return istTime.toLocaleString('en-IN', { 
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }
}
