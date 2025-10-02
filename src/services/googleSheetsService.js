// Google Sheets API service
import { CONFIG } from '../config/config.js';
import { DateUtils } from '../utils/dateUtils.js';

export class GoogleSheetsService {
    constructor() {
        this.isSignedIn = false;
        this.tokenClient = null;
        this.spreadsheetId = CONFIG.OAUTH.SPREADSHEET_ID;
        this.sheetName = CONFIG.SHEETS.DEFAULT_SHEET_NAME;
    }

    // Load Google APIs (gapi and Google Identity Services)
    async loadGoogleAPI() {
        return new Promise((resolve, reject) => {
            const loadGapi = new Promise((resolveGapi, rejectGapi) => {
                if (window.gapi) {
                    resolveGapi();
                    return;
                }
                
                const gapiScript = document.createElement('script');
                gapiScript.src = 'https://apis.google.com/js/api.js';
                gapiScript.onload = () => {
                    gapi.load('client', resolveGapi);
                };
                gapiScript.onerror = rejectGapi;
                document.head.appendChild(gapiScript);
            });

            const loadGIS = new Promise((resolveGIS, rejectGIS) => {
                if (window.google && window.google.accounts) {
                    resolveGIS();
                    return;
                }
                
                const gisScript = document.createElement('script');
                gisScript.src = 'https://accounts.google.com/gsi/client';
                gisScript.onload = resolveGIS;
                gisScript.onerror = rejectGIS;
                document.head.appendChild(gisScript);
            });

            Promise.all([loadGapi, loadGIS]).then(resolve).catch(reject);
        });
    }

    // Initialize OAuth 2.0
    async initializeOAuth(onSignInCallback) {
        try {
            // Initialize gapi client
            await gapi.client.init({
                apiKey: CONFIG.OAUTH.API_KEY,
                discoveryDocs: [CONFIG.OAUTH.DISCOVERY_DOC]
            });

            // Initialize Google Identity Services
            this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: CONFIG.OAUTH.CLIENT_ID,
                scope: CONFIG.OAUTH.SCOPES,
                callback: (response) => {
                    if (response.error) {
                        console.error('Token response error:', response);
                        throw new Error('Authentication failed: ' + response.error);
                    }
                    
                    // Set the access token for gapi client
                    gapi.client.setToken({access_token: response.access_token});
                    this.isSignedIn = true;
                    onSignInCallback();
                }
            });

            // Check if we already have a valid token
            const token = gapi.client.getToken();
            if (token && token.access_token) {
                this.isSignedIn = true;
                return true;
            }

            return false;
        } catch (error) {
            console.error('OAuth initialization failed:', error);
            throw error;
        }
    }

    // Request access token
    requestAccessToken() {
        if (this.tokenClient) {
            this.tokenClient.requestAccessToken();
        } else {
            throw new Error('Authentication not initialized');
        }
    }

    // Create sheet header with formatting
    async createSheetHeader() {
        try {
            // Add header values
            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: `${this.sheetName}!A1:F1`,
                valueInputOption: 'RAW',
                resource: {
                    values: [CONFIG.SHEETS.MASTER_HEADERS]
                }
            });

            // Format headers as bold
            await this.formatHeaders(this.spreadsheetId, 0, 6);
            
            console.log('Sheet header created successfully with bold formatting');
        } catch (error) {
            console.error('Failed to create sheet header:', error);
            throw error;
        }
    }

    // Format headers with bold styling
    async formatHeaders(spreadsheetId, sheetId = 0, columnCount = 6) {
        try {
            await gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId: spreadsheetId,
                resource: {
                    requests: [
                        {
                            repeatCell: {
                                range: {
                                    sheetId: sheetId,
                                    startRowIndex: 0,
                                    endRowIndex: 1,
                                    startColumnIndex: 0,
                                    endColumnIndex: columnCount
                                },
                                cell: {
                                    userEnteredFormat: {
                                        backgroundColor: CONFIG.FORMATTING.HEADER_BACKGROUND,
                                        textFormat: {
                                            foregroundColor: CONFIG.FORMATTING.HEADER_TEXT_COLOR,
                                            bold: true
                                        }
                                    }
                                },
                                fields: 'userEnteredFormat(backgroundColor,textFormat)'
                            }
                        }
                    ]
                }
            });
        } catch (error) {
            console.error('Error formatting headers:', error);
            throw error;
        }
    }

    // Sync with Google Sheets
    async syncWithGoogleSheets() {
        if (!this.isSignedIn || !this.spreadsheetId) return null;
        
        try {
            // Get spreadsheet info
            const spreadsheetInfo = await gapi.client.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId
            });
            
            const sheets = spreadsheetInfo.result.sheets;
            const sheetNames = sheets.map(sheet => sheet.properties.title);
            
            // Use first sheet if target sheet doesn't exist
            let targetSheetName = this.sheetName;
            if (!sheetNames.includes(targetSheetName)) {
                targetSheetName = sheetNames[0];
                this.sheetName = targetSheetName;
            }
            
            // Read existing data
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${targetSheetName}!A:F`
            });
            
            if (response.result.values && response.result.values.length > 1) {
                const rows = response.result.values.slice(1);
                return rows.map((row, index) => ({
                    id: Date.now() + index,
                    name: row[0] || '',
                    phone: row[1] || '',
                    balance: parseFloat(row[2]) || 0,
                    notes: row[3] || '',
                    lastUpdated: row[4] || DateUtils.getISTDateTime(),
                    sheetId: row[5] && row[5].includes('spreadsheets/d/') ? 
                        row[5].split('/d/')[1].split('/')[0] : null
                }));
            }
            
            return [];
        } catch (error) {
            console.error('Sync error:', error);
            throw error;
        }
    }

    // Upload data to sheets
    async uploadDataToSheets(customers) {
        if (!this.isSignedIn || !this.spreadsheetId || customers.length === 0) return;
        
        try {
            const values = [
                CONFIG.SHEETS.MASTER_HEADERS,
                ...customers.map(customer => [
                    customer.name,
                    customer.phone,
                    customer.balance,
                    customer.notes,
                    customer.lastUpdated,
                    customer.sheetId ? `https://docs.google.com/spreadsheets/d/${customer.sheetId}/edit` : 'Not created'
                ])
            ];
            
            await gapi.client.sheets.spreadsheets.values.clear({
                spreadsheetId: this.spreadsheetId,
                range: `${this.sheetName}!A:Z`
            });
            
            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: `${this.sheetName}!A1`,
                valueInputOption: 'RAW',
                resource: { values }
            });

            // Format headers as bold
            await this.formatHeaders(this.spreadsheetId, 0, 6);
            
        } catch (error) {
            console.error('Upload failed:', error);
            throw error;
        }
    }

    // Update master sheet
    async updateMasterSheet(customers) {
        if (!this.isSignedIn || !this.spreadsheetId || customers.length === 0) return;
        
        try {
            // Clear the sheet first, then write all current customer data
            await gapi.client.sheets.spreadsheets.values.clear({
                spreadsheetId: this.spreadsheetId,
                range: `${this.sheetName}!A:Z`
            });
            
            const values = [
                CONFIG.SHEETS.MASTER_HEADERS,
                ...customers.map(customer => [
                    customer.name,
                    customer.phone,
                    customer.balance,
                    customer.notes,
                    customer.lastUpdated,
                    customer.sheetId ? `https://docs.google.com/spreadsheets/d/${customer.sheetId}/edit` : 'Not created'
                ])
            ];
            
            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: `${this.sheetName}!A1`,
                valueInputOption: 'RAW',
                resource: { values }
            });

            // Format headers as bold
            await this.formatHeaders(this.spreadsheetId, 0, 6);
            
            console.log('Master sheet updated successfully - one record per customer with bold headers');
        } catch (error) {
            console.error('Failed to update master sheet:', error);
            throw error;
        }
    }

    // Create individual customer sheet
    async createCustomerSheet(customerData) {
        if (!this.isSignedIn) {
            throw new Error('Not signed in to Google');
        }

        try {
            console.log('Creating individual sheet for:', customerData.name);
            
            // Sanitize the customer name for sheet title
            const sanitizedName = customerData.name.replace(/[^\w\s-]/g, '').trim();
            const sheetTitle = `${sanitizedName} - Transactions`;
            
            console.log('Creating sheet with title:', sheetTitle);
            
            const createResponse = await gapi.client.sheets.spreadsheets.create({
                resource: {
                    properties: {
                        title: sheetTitle
                    },
                    sheets: [{
                        properties: {
                            title: 'Transactions',
                            gridProperties: {
                                rowCount: 1000,
                                columnCount: 6
                            }
                        }
                    }]
                }
            });

            if (!createResponse.result || !createResponse.result.spreadsheetId) {
                throw new Error('Failed to get spreadsheet ID from create response');
            }

            const newSheetId = createResponse.result.spreadsheetId;
            console.log('Successfully created sheet with ID:', newSheetId);
            
            // Set up headers
            console.log('Setting up headers...');
            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: newSheetId,
                range: 'Transactions!A1:F1',
                valueInputOption: 'RAW',
                resource: { values: [CONFIG.SHEETS.TRANSACTION_HEADERS] }
            });

            // Add initial balance entry if non-zero
            if (customerData.balance !== 0) {
                console.log('Adding initial balance entry...');
                const initialEntry = [
                    DateUtils.getISTDateString(),
                    'Initial Balance',
                    customerData.balance,
                    customerData.balance,
                    customerData.notes || 'Account created',
                    'System'
                ];
                
                await gapi.client.sheets.spreadsheets.values.update({
                    spreadsheetId: newSheetId,
                    range: 'Transactions!A2:F2',
                    valueInputOption: 'RAW',
                    resource: { values: [initialEntry] }
                });
            }

            // Format the sheet headers
            console.log('Formatting headers...');
            try {
                await this.formatHeaders(newSheetId, 0, 6);
            } catch (formatError) {
                console.warn('Header formatting failed, but sheet was created:', formatError);
                // Continue even if formatting fails
            }
            
            console.log(`Successfully created customer sheet: ${newSheetId}`);
            return newSheetId;

        } catch (error) {
            console.error('Error creating customer sheet:', error);
            console.error('Error details:', {
                status: error.status,
                statusText: error.statusText,
                result: error.result,
                body: error.body
            });
            
            // Re-throw with more specific error message
            throw new Error(`Failed to create individual sheet for ${customerData.name}: ${error.result?.error?.message || error.message}`);
        }
    }

    // Update customer sheet with transaction
    async updateCustomerSheet(customer, transactionData) {
        if (!customer.sheetId || !this.isSignedIn) return;

        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: customer.sheetId,
                range: 'Transactions!A:F'
            });

            const currentRows = response.result.values || [];
            const nextRow = currentRows.length + 1;

            const newTransaction = [
                DateUtils.getISTDateString(),
                transactionData.type,
                transactionData.amount,
                customer.balance,
                transactionData.note || '',
                'User'
            ];

            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: customer.sheetId,
                range: `Transactions!A${nextRow}:F${nextRow}`,
                valueInputOption: 'RAW',
                resource: { values: [newTransaction] }
            });

            console.log(`Updated customer sheet for ${customer.name}`);
        } catch (error) {
            console.error('Error updating customer sheet:', error);
            throw error;
        }
    }

    // Delete individual customer sheet
    async deleteCustomerSheet(customer) {
        if (!customer.sheetId || !this.isSignedIn) {
            console.log('No sheet to delete or not signed in');
            return;
        }

        try {
            console.log(`Deleting individual sheet for ${customer.name} (ID: ${customer.sheetId})`);
            
            // Use Google Drive API to delete the spreadsheet file
            await gapi.client.request({
                path: `https://www.googleapis.com/drive/v3/files/${customer.sheetId}`,
                method: 'DELETE'
            });

            console.log(`Successfully deleted individual sheet for ${customer.name}`);
        } catch (error) {
            console.error(`Error deleting customer sheet for ${customer.name}:`, error);
            console.error('Error details:', {
                status: error.status,
                statusText: error.statusText,
                result: error.result,
                body: error.body
            });
            
            // Don't throw error - continue with customer deletion even if sheet deletion fails
            console.warn(`Failed to delete individual sheet for ${customer.name}, but continuing with customer deletion`);
        }
    }
}
