// Local storage utility functions
import { CONFIG } from '../config/config.js';

export class StorageUtils {
    // Load customers from localStorage
    static loadCustomers() {
        try {
            const saved = localStorage.getItem(CONFIG.STORAGE.CUSTOMERS);
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('Error loading customers from localStorage:', error);
            return [];
        }
    }

    // Save customers to localStorage
    static saveCustomers(customers) {
        try {
            localStorage.setItem(CONFIG.STORAGE.CUSTOMERS, JSON.stringify(customers));
        } catch (error) {
            console.error('Error saving customers to localStorage:', error);
        }
    }

    // Load OAuth configuration from localStorage
    static loadOAuthConfig() {
        try {
            const saved = localStorage.getItem(CONFIG.STORAGE.OAUTH_CONFIG);
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.error('Error loading OAuth config from localStorage:', error);
            return null;
        }
    }

    // Save OAuth configuration to localStorage
    static saveOAuthConfig(config) {
        try {
            localStorage.setItem(CONFIG.STORAGE.OAUTH_CONFIG, JSON.stringify(config));
        } catch (error) {
            console.error('Error saving OAuth config to localStorage:', error);
        }
    }
}
