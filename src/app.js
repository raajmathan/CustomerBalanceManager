// Main application entry point
import { CustomerBalanceManager } from './core/customerManager.js';
import { StorageUtils } from './utils/storageUtils.js';
import { CONFIG } from './config/config.js';

// Global function to setup Google Sheets OAuth (called from HTML)
window.setupGoogleSheets = async function() {
    const clientId = document.getElementById('clientId').value.trim();
    const apiKey = document.getElementById('apiKey').value.trim();
    const spreadsheetId = document.getElementById('spreadsheetId').value.trim();
    
    if (!clientId || !apiKey || !spreadsheetId) {
        window.customerManager.showErrorMessage('Please enter Client ID, API Key, and Spreadsheet ID');
        return;
    }
    
    try {
        // Save OAuth configuration
        const config = {
            clientId: clientId,
            apiKey: apiKey,
            spreadsheetId: spreadsheetId
        };
        
        StorageUtils.saveOAuthConfig(config);
        
        // Update manager configuration
        window.customerManager.googleSheetsService.spreadsheetId = spreadsheetId;
        
        // Initialize Google API
        await window.customerManager.initializeGoogleAPI();
        
        // Close modal
        window.customerManager.closeGoogleSheetsModal();
        
    } catch (error) {
        console.error('Setup error:', error);
        window.customerManager.showErrorMessage('Failed to setup Google Sheets integration: ' + error.message);
    }
};

// Initialize the application when DOM is loaded
let customerManager;
document.addEventListener('DOMContentLoaded', () => {
    customerManager = new CustomerBalanceManager();
    
    // Export for global access (needed for HTML onclick handlers)
    window.customerManager = customerManager;
});
