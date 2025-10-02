// Configuration constants for the Customer Balance Manager
export const CONFIG = {
    // OAuth 2.0 Configuration
    OAUTH: {
        CLIENT_ID: '392627232767-jrhadte3r7mfine1jccm0h9db8tovhnf.apps.googleusercontent.com',
        API_KEY: 'AIzaSyBUNDxeULUWer3oa1iSPi_ieEyHBbHLHwg',
        SPREADSHEET_ID: '1uUnQJBjHnDdMBKM7hnoyN9ivWXLa5WjL6_4-whP0feg',
        DISCOVERY_DOC: 'https://sheets.googleapis.com/$discovery/rest?version=v4',
        SCOPES: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive'
    },

    // Sheet Configuration
    SHEETS: {
        DEFAULT_SHEET_NAME: 'CustomerBalances',
        MASTER_HEADERS: ['Name', 'Phone', 'Balance', 'Notes', 'Last Updated', 'Individual Sheet'],
        TRANSACTION_HEADERS: ['Date', 'Type', 'Amount', 'Running Balance', 'Notes', 'Updated By']
    },

    // UI Configuration
    UI: {
        DEFAULT_VIEW: 'card',
        TOAST_DURATION: 3000,
        ANIMATION_DURATION: 300
    },

    // Storage Keys
    STORAGE: {
        CUSTOMERS: 'customerBalances',
        OAUTH_CONFIG: 'googleSheetsOAuthConfig'
    },

    // Header Formatting
    FORMATTING: {
        HEADER_BACKGROUND: { red: 0.2, green: 0.6, blue: 0.9 },
        HEADER_TEXT_COLOR: { red: 1.0, green: 1.0, blue: 1.0 }
    }
};
