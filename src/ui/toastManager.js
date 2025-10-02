// Toast notification manager
import { CONFIG } from '../config/config.js';

export class ToastManager {
    static showSuccess(message) {
        this.showToast(message, 'success');
    }

    static showError(message) {
        this.showToast(message, 'error');
    }

    static showToast(message, type) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            animation: slideInRight 0.3s ease;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        `;
        
        if (type === 'success') {
            toast.style.background = 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)';
        } else {
            toast.style.background = 'linear-gradient(135deg, #f56565 0%, #e53e3e 100%)';
        }
        
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => toast.remove(), CONFIG.UI.ANIMATION_DURATION);
        }, CONFIG.UI.TOAST_DURATION);
    }

    // Initialize CSS animations
    static initializeStyles() {
        if (document.getElementById('toast-styles')) return;

        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
            .fade-in {
                animation: fadeIn 0.3s ease-in;
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;
        document.head.appendChild(style);
    }
}
