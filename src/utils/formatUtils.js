// Formatting utility functions
export class FormatUtils {
    // Format currency amount
    static formatCurrency(amount) {
        return `₹${Math.abs(amount).toFixed(2)}`;
    }

    // Get CSS class for balance display
    static getBalanceClass(balance) {
        if (balance > 0) return 'balance-positive';
        if (balance < 0) return 'balance-negative';
        return 'balance-zero';
    }

    // Escape HTML attributes for safe rendering
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Escape JSON for HTML attributes
    static escapeJsonForHtml(obj) {
        return JSON.stringify(obj).replace(/"/g, '&quot;');
    }
}
