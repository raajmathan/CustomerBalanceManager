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
                range: `${this.sheetName}!A1:G1`,
                valueInputOption: 'RAW',
                resource: {
                    values: [CONFIG.SHEETS.MASTER_HEADERS]
                }
            });

            // Format headers as bold
            await this.formatHeaders(this.spreadsheetId, 0, 7);
            
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
        if (!this.spreadsheetId) return null;
        
        try {
            console.log('🔄 Starting Google Sheets sync...');
            console.log('📊 Spreadsheet ID:', this.spreadsheetId);
            console.log('🔐 Is signed in:', this.isSignedIn);
            
            // Get spreadsheet info
            console.log('📋 Getting spreadsheet info...');
            const spreadsheetInfo = await gapi.client.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId
            });
            
            const sheets = spreadsheetInfo.result.sheets;
            const sheetNames = sheets.map(sheet => sheet.properties.title);
            console.log('📄 Available sheets:', sheetNames);
            
            // Use first sheet if target sheet doesn't exist
            let targetSheetName = this.sheetName;
            if (!sheetNames.includes(targetSheetName)) {
                targetSheetName = sheetNames[0];
                this.sheetName = targetSheetName;
                console.log('📝 Using sheet:', targetSheetName);
            }
            
            // Read existing data
            console.log('📖 Reading data from sheet:', targetSheetName);
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${targetSheetName}!A:G`
            });
            
            if (response.result.values && response.result.values.length > 1) {
                const rows = response.result.values.slice(1);
                console.log('Raw sheet data:', rows);
                
                return rows.map((row, index) => {
                    console.log(`=== PARSING ROW ${index} ===`);
                    console.log('Raw row data:', row);
                    console.log('Row length:', row.length);
                    console.log('Individual columns:');
                    row.forEach((col, colIndex) => {
                        console.log(`  Column ${colIndex}: "${col}" (type: ${typeof col})`);
                    });
                    
                    // Handle the case where data might be in wrong columns
                    let name = row[0] || '';
                    let phone = row[1] || '';
                    let category = '';
                    let balance = 0;
                    let notes = '';
                    let lastUpdated = row[5] || DateUtils.getISTDateTime();
                    let sheetId = null;
                    
                    // Based on your test data, the structure appears to be:
                    // [Name, Phone, Category, Balance, Notes, LastUpdated, SheetURL]
                    // But your actual data shows: [Name, Phone, Balance, Notes, LastUpdated, SheetURL]
                    
                    if (row.length >= 3) {
                        // First, let's try the standard expected format
                        if (row.length >= 4) {
                            // Check if column 3 (index 3) looks like a balance
                            const col3Str = String(row[3]).trim();
                            console.log(`Checking column 3 as balance: "${col3Str}"`);
                            
                            if (!isNaN(col3Str) && col3Str !== '' && !col3Str.includes(':')) {
                                // Standard format: [Name, Phone, Category, Balance, Notes, LastUpdated, SheetURL]
                                category = row[2] || '';
                                balance = parseFloat(col3Str);
                                notes = row[4] || '';
                                lastUpdated = row[5] || DateUtils.getISTDateTime();
                                console.log(`✅ Standard format: category="${category}", balance=${balance}, notes="${notes}"`);
                            } else {
                                // Your format: [Name, Phone, Balance, Notes, LastUpdated, SheetURL]
                                const col2Str = String(row[2]).trim();
                                console.log(`Checking column 2 as balance: "${col2Str}"`);
                                
                                if (!isNaN(col2Str) && col2Str !== '') {
                                    balance = parseFloat(col2Str);
                                    notes = row[3] || '';
                                    lastUpdated = row[4] || DateUtils.getISTDateTime();
                                    category = 'Contractor'; // Default category since it's missing
                                    console.log(`✅ Your format: balance=${balance}, notes="${notes}"`);
                                }
                            }
                        } else {
                            // Fallback for shorter rows
                            const col2Str = String(row[2]).trim();
                            if (!isNaN(col2Str) && col2Str !== '') {
                                balance = parseFloat(col2Str);
                                category = 'Contractor'; // Default
                            }
                        }
                    }
                    
                    // Extract sheet ID from URL if present
                    if (row[6] && row[6].includes('spreadsheets/d/')) {
                        sheetId = row[6].split('/d/')[1].split('/')[0];
                        console.log(`✅ Extracted sheet ID: ${sheetId}`);
                    } else if (row[5] && row[5].includes('spreadsheets/d/')) {
                        // Try column 5 if column 6 doesn't have it
                        sheetId = row[5].split('/d/')[1].split('/')[0];
                        console.log(`✅ Extracted sheet ID from column 5: ${sheetId}`);
                    }
                    
                    const customer = {
                        id: Date.now() + index + Math.random() * 1000, // Ensure unique IDs
                        name,
                        phone,
                        category,
                        balance,
                        notes,
                        lastUpdated,
                        sheetId
                    };
                    
                    console.log(`✅ FINAL PARSED CUSTOMER ${index}:`, customer);
                    console.log('================================');
                    return customer;
                });
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
                    customer.category || '',
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
            await this.formatHeaders(this.spreadsheetId, 0, 7);
            
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
                    customer.category || '',
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
            await this.formatHeaders(this.spreadsheetId, 0, 7);
            
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
