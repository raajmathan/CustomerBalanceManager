// Customer Balance Manager - OAuth 2.0 Enabled for Full Write Access
// Supports creating individual customer sheets and full bidirectional sync

class CustomerBalanceManager {
    constructor() {
        this.customers = [];
        this.filteredCustomers = [];
        this.currentView = 'card';
        this.editingCustomerId = null;
        
        // OAuth 2.0 Configuration
        this.clientId = '392627232767-jrhadte3r7mfine1jccm0h9db8tovhnf.apps.googleusercontent.com';
        this.apiKey = 'AIzaSyBUNDxeULUWer3oa1iSPi_ieEyHBbHLHwg';
        this.spreadsheetId = '1uUnQJBjHnDdMBKM7hnoyN9ivWXLa5WjL6_4-whP0feg';
        this.sheetName = 'CustomerBalances';
        this.isSignedIn = false;
        this.authInstance = null;
        
        // Google API Configuration
        this.DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';
        this.SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadFromLocalStorage();
        this.renderCustomers();
        this.updateStats();
        this.checkOAuthSetup();
    }

    setupEventListeners() {
        // Header buttons
        document.getElementById('addCustomerBtn').addEventListener('click', () => this.openCustomerModal());
        document.getElementById('refreshBtn').addEventListener('click', () => this.refreshData());
        document.getElementById('uploadToSheetsBtn').addEventListener('click', () => this.uploadLocalDataToSheets());

        // Search and filter
        document.getElementById('searchInput').addEventListener('input', (e) => this.filterCustomers(e.target.value));
        document.getElementById('filterSelect').addEventListener('change', (e) => this.applyFilter(e.target.value));

        // View toggle
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.toggleView(e.target.dataset.view));
        });

        // Modal controls
        document.getElementById('closeModal').addEventListener('click', () => this.closeCustomerModal());
        document.getElementById('cancelBtn').addEventListener('click', () => this.closeCustomerModal());
        document.getElementById('customerForm').addEventListener('submit', (e) => this.saveCustomer(e));

        // Balance modal controls
        document.getElementById('closeBalanceModal').addEventListener('click', () => this.closeBalanceModal());
        document.getElementById('cancelBalanceBtn').addEventListener('click', () => this.closeBalanceModal());
        document.getElementById('balanceForm').addEventListener('submit', (e) => this.updateBalance(e));

        // Overlay
        document.getElementById('overlay').addEventListener('click', () => {
            this.closeCustomerModal();
            this.closeBalanceModal();
            this.closeGoogleSheetsModal();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeCustomerModal();
                this.closeBalanceModal();
                this.closeGoogleSheetsModal();
            }
        });
    }

    checkOAuthSetup() {
        // Show the Google Sheets modal to display sign-in interface
        this.showGoogleSheetsModal();
        
        // Since we have the Client ID configured, directly initialize
        if (this.clientId) {
            this.initializeGoogleAPI();
            return;
        }
        
        // Check if OAuth is already configured in localStorage
        const savedConfig = localStorage.getItem('googleSheetsOAuthConfig');
        
        if (savedConfig) {
            try {
                const config = JSON.parse(savedConfig);
                this.clientId = config.clientId || this.clientId;
                this.apiKey = config.apiKey || this.apiKey;
                this.spreadsheetId = config.spreadsheetId || this.spreadsheetId;
                
                if (this.clientId) {
                    this.initializeGoogleAPI();
                    return;
                }
            } catch (error) {
                console.error('Error parsing saved OAuth config:', error);
            }
        }
        
        // Show OAuth setup modal as fallback
        this.showOAuthSetupModal();
    }

    showGoogleSheetsModal() {
        document.getElementById('googleSheetsModal').style.display = 'block';
        document.getElementById('overlay').classList.add('active');
        
        // Hide all sections initially
        document.getElementById('oauthSetup').style.display = 'none';
        document.getElementById('signInSection').style.display = 'none';
        document.getElementById('signedInSection').style.display = 'none';
    }

    showOAuthSetupModal() {
        document.getElementById('googleSheetsModal').style.display = 'block';
        document.getElementById('overlay').classList.add('active');
        document.getElementById('oauthSetup').style.display = 'block';
        
        // Hide other sections initially
        document.getElementById('signInSection').style.display = 'none';
        document.getElementById('signedInSection').style.display = 'none';
    }

    closeGoogleSheetsModal() {
        document.getElementById('googleSheetsModal').style.display = 'none';
        document.getElementById('overlay').classList.remove('active');
    }

    async initializeGoogleAPI() {
        try {
            this.showLoadingSpinner(true);
            this.showSuccessMessage('Initializing Google API...');
            
            // Load Google API
            await this.loadGoogleAPI();
            
            // Initialize OAuth
            await this.initializeOAuth();
            
            if (this.isSignedIn) {
                this.showSuccessMessage('Google Sheets integration enabled with full write access!');
                document.getElementById('uploadToSheetsBtn').style.display = 'inline-flex';
                await this.syncWithGoogleSheets();
            } else {
                this.showSuccessMessage('Google API initialized. Ready to sign in.');
            }
        } catch (error) {
            console.error('Failed to initialize Google API:', error);
            this.showErrorMessage('Failed to initialize Google API: ' + error.message);
            // Show sign-in button even if there's an error, so user can try to authenticate
            this.showSignInButton();
        } finally {
            this.showLoadingSpinner(false);
        }
    }

    loadGoogleAPI() {
        return new Promise((resolve, reject) => {
            // Load both the old gapi and new Google Identity Services
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

    async initializeOAuth() {
        try {
            // Initialize gapi client
            await gapi.client.init({
                apiKey: this.apiKey,
                discoveryDocs: [this.DISCOVERY_DOC]
            });

            // Initialize Google Identity Services
            this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: this.clientId,
                scope: this.SCOPES,
                callback: (response) => {
                    if (response.error) {
                        console.error('Token response error:', response);
                        this.showErrorMessage('Authentication failed: ' + response.error);
                        return;
                    }
                    
                    // Set the access token for gapi client
                    gapi.client.setToken({access_token: response.access_token});
                    this.isSignedIn = true;
                    this.showSignedInState();
                    this.showSuccessMessage('Successfully signed in to Google!');
                    this.syncWithGoogleSheets();
                }
            });

            // Check if we already have a valid token
            const token = gapi.client.getToken();
            if (token && token.access_token) {
                this.isSignedIn = true;
                this.showSignedInState();
                this.syncWithGoogleSheets();
            } else {
                this.showSignInButton();
            }

        } catch (error) {
            console.error('OAuth initialization failed:', error);
            throw error;
        }
    }

    showSignInButton() {
        document.getElementById('signInSection').style.display = 'block';
        document.getElementById('signedInSection').style.display = 'none';
        
        const signInBtn = document.getElementById('signInBtn');
        signInBtn.onclick = () => {
            // Use the new Google Identity Services token client
            if (this.tokenClient) {
                this.tokenClient.requestAccessToken();
            } else {
                this.showErrorMessage('Authentication not initialized. Please refresh the page.');
            }
        };
    }

    showSignedInState() {
        document.getElementById('signInSection').style.display = 'none';
        document.getElementById('signedInSection').style.display = 'block';
    }

    async syncWithGoogleSheets() {
        if (!this.isSignedIn || !this.spreadsheetId) return;
        
        try {
            this.showLoadingSpinner(true);
            
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
                this.customers = rows.map((row, index) => ({
                    id: Date.now() + index,
                    name: row[0] || '',
                    phone: row[1] || '',
                    balance: parseFloat(row[2]) || 0,
                    notes: row[3] || '',
                    lastUpdated: row[4] || this.getISTDateTime(),
                    sheetId: row[5] && row[5].includes('spreadsheets/d/') ? 
                        row[5].split('/d/')[1].split('/')[0] : null
                }));
                
                this.saveToLocalStorage();
                this.renderCustomers();
                this.updateStats();
                this.showSuccessMessage(`Synced ${this.customers.length} customers from Google Sheets!`);
            } else {
                await this.createSheetHeader();
                if (this.customers.length > 0) {
                    await this.uploadLocalDataToSheets();
                }
            }
        } catch (error) {
            console.error('Sync error:', error);
            this.showErrorMessage('Failed to sync with Google Sheets: ' + error.message);
        } finally {
            this.showLoadingSpinner(false);
        }
    }

    async createSheetHeader() {
        try {
            // Add header values
            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: `${this.sheetName}!A1:F1`,
                valueInputOption: 'RAW',
                resource: {
                    values: [['Name', 'Phone', 'Balance', 'Notes', 'Last Updated', 'Individual Sheet']]
                }
            });

            // Format headers as bold
            await gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId: this.spreadsheetId,
                resource: {
                    requests: [
                        {
                            repeatCell: {
                                range: {
                                    sheetId: 0,
                                    startRowIndex: 0,
                                    endRowIndex: 1,
                                    startColumnIndex: 0,
                                    endColumnIndex: 6
                                },
                                cell: {
                                    userEnteredFormat: {
                                        backgroundColor: { red: 0.2, green: 0.6, blue: 0.9 },
                                        textFormat: {
                                            foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
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
            
            console.log('Sheet header created successfully with bold formatting');
        } catch (error) {
            console.error('Failed to create sheet header:', error);
            throw error;
        }
    }

    async uploadLocalDataToSheets() {
        if (!this.isSignedIn || !this.spreadsheetId || this.customers.length === 0) return;
        
        try {
            this.showLoadingSpinner(true);
            
            const values = [
                ['Name', 'Phone', 'Balance', 'Notes', 'Last Updated', 'Individual Sheet'],
                ...this.customers.map(customer => [
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
            await gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId: this.spreadsheetId,
                resource: {
                    requests: [
                        {
                            repeatCell: {
                                range: {
                                    sheetId: 0,
                                    startRowIndex: 0,
                                    endRowIndex: 1,
                                    startColumnIndex: 0,
                                    endColumnIndex: 6
                                },
                                cell: {
                                    userEnteredFormat: {
                                        backgroundColor: { red: 0.2, green: 0.6, blue: 0.9 },
                                        textFormat: {
                                            foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
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
            
            this.showSuccessMessage(`Successfully uploaded ${this.customers.length} customers to Google Sheets!`);
        } catch (error) {
            console.error('Upload failed:', error);
            this.showErrorMessage('Failed to upload data: ' + error.message);
        } finally {
            this.showLoadingSpinner(false);
        }
    }

    async createCustomerSheet(customerData) {
        if (!this.isSignedIn) {
            throw new Error('Not signed in to Google');
        }

        try {
            console.log('Creating individual sheet for:', customerData.name);
            
            const createResponse = await gapi.client.sheets.spreadsheets.create({
                resource: {
                    properties: {
                        title: `${customerData.name} - Customer Transactions`
                    },
                    sheets: [{
                        properties: {
                            title: 'Transactions',
                            gridProperties: {
                                rowCount: 1000,
                                columnCount: 8
                            }
                        }
                    }]
                }
            });

            const newSheetId = createResponse.result.spreadsheetId;
            
            // Set up headers
            const headers = [
                ['Date', 'Type', 'Amount', 'Running Balance', 'Notes', 'Updated By']
            ];
            
            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: newSheetId,
                range: 'Transactions!A1:G1',
                valueInputOption: 'RAW',
                resource: { values: headers }
            });

            // Add initial balance entry if non-zero
            if (customerData.balance !== 0) {
                const initialEntry = [
                    this.getISTDateString(),
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

            // Format the sheet
            await this.formatCustomerSheet(newSheetId);
            
            console.log(`Created customer sheet: ${newSheetId}`);
            return newSheetId;

        } catch (error) {
            console.error('Error creating customer sheet:', error);
            throw error;
        }
    }

    async formatCustomerSheet(sheetId) {
        try {
            await gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId: sheetId,
                resource: {
                    requests: [
                        {
                            repeatCell: {
                                range: {
                                    sheetId: 0,
                                    startRowIndex: 0,
                                    endRowIndex: 1,
                                    startColumnIndex: 0,
                                    endColumnIndex: 7
                                },
                                cell: {
                                    userEnteredFormat: {
                                        backgroundColor: { red: 0.2, green: 0.6, blue: 0.9 },
                                        textFormat: {
                                            foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
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
            console.error('Error formatting sheet:', error);
        }
    }

    async updateCustomerSheet(customer, transactionData) {
        if (!customer.sheetId || !this.isSignedIn) return;

        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: customer.sheetId,
                range: 'Transactions!A:G'
            });

            const currentRows = response.result.values || [];
            const nextRow = currentRows.length + 1;

            const newTransaction = [
                this.getISTDateString(),
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
        }
    }

    async updateMasterSheet() {
        if (!this.isSignedIn || !this.spreadsheetId || this.customers.length === 0) return;
        
        try {
            // Clear the sheet first, then write all current customer data
            // This ensures we have exactly one record per customer with current balance
            await gapi.client.sheets.spreadsheets.values.clear({
                spreadsheetId: this.spreadsheetId,
                range: `${this.sheetName}!A:Z`
            });
            
            const values = [
                ['Name', 'Phone', 'Balance', 'Notes', 'Last Updated', 'Individual Sheet'],
                ...this.customers.map(customer => [
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
            await gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId: this.spreadsheetId,
                resource: {
                    requests: [
                        {
                            repeatCell: {
                                range: {
                                    sheetId: 0,
                                    startRowIndex: 0,
                                    endRowIndex: 1,
                                    startColumnIndex: 0,
                                    endColumnIndex: 6
                                },
                                cell: {
                                    userEnteredFormat: {
                                        backgroundColor: { red: 0.2, green: 0.6, blue: 0.9 },
                                        textFormat: {
                                            foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
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
            
            console.log('Master sheet updated successfully - one record per customer with bold headers');
        } catch (error) {
            console.error('Failed to update master sheet:', error);
        }
    }

    // Customer Management Methods
    loadFromLocalStorage() {
        const saved = localStorage.getItem('customerBalances');
        if (saved) {
            this.customers = JSON.parse(saved);
        }
    }

    saveToLocalStorage() {
        localStorage.setItem('customerBalances', JSON.stringify(this.customers));
    }

    openCustomerModal(customer = null) {
        this.editingCustomerId = customer ? customer.id : null;
        const modal = document.getElementById('customerModal');
        const form = document.getElementById('customerForm');
        const title = document.getElementById('modalTitle');
        
        title.textContent = customer ? 'Edit Customer' : 'Add New Customer';
        
        if (customer) {
            document.getElementById('customerName').value = customer.name;
            document.getElementById('customerPhone').value = customer.phone;
            document.getElementById('customerBalance').value = customer.balance;
            document.getElementById('customerNotes').value = customer.notes;
        } else {
            form.reset();
        }
        
        modal.classList.add('active');
        document.getElementById('overlay').classList.add('active');
        document.getElementById('customerName').focus();
    }

    closeCustomerModal() {
        document.getElementById('customerModal').classList.remove('active');
        document.getElementById('overlay').classList.remove('active');
        this.editingCustomerId = null;
    }

    async saveCustomer(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const customerData = {
            name: formData.get('customerName').trim(),
            phone: formData.get('customerPhone').trim(),
            balance: parseFloat(formData.get('customerBalance')) || 0,
            notes: formData.get('customerNotes').trim(),
            lastUpdated: this.getISTDateTime()
        };
        
        if (!customerData.name) {
            this.showErrorMessage('Customer name is required');
            return;
        }
        
        try {
            this.showLoadingSpinner(true);
            
            if (this.editingCustomerId) {
                // Update existing customer
                const index = this.customers.findIndex(c => c.id === this.editingCustomerId);
                if (index !== -1) {
                    this.customers[index] = { ...this.customers[index], ...customerData };
                }
                this.showSuccessMessage('Customer updated successfully!');
            } else {
                // Add new customer
                customerData.id = Date.now();
                
                // Create individual Google Sheet if signed in
                if (this.isSignedIn) {
                    try {
                        const sheetId = await this.createCustomerSheet(customerData);
                        customerData.sheetId = sheetId;
                        this.showSuccessMessage(`Customer added with individual Google Sheet created!`);
                    } catch (error) {
                        console.error('Failed to create customer sheet:', error);
                        this.showErrorMessage('Customer added but failed to create individual sheet');
                    }
                } else {
                    this.showSuccessMessage('Customer added successfully!');
                }
                
                this.customers.push(customerData);
            }
            
            this.saveToLocalStorage();
            await this.updateMasterSheet();
            this.renderCustomers();
            this.updateStats();
            this.closeCustomerModal();
            
        } catch (error) {
            console.error('Error saving customer:', error);
            this.showErrorMessage('Failed to save customer: ' + error.message);
        } finally {
            this.showLoadingSpinner(false);
        }
    }

    openBalanceModal(customer) {
        const balanceCustomerName = document.getElementById('balanceCustomerName');
        const currentBalance = document.getElementById('currentBalance');
        const balanceForm = document.getElementById('balanceForm');
        const balanceModal = document.getElementById('balanceModal');
        const overlay = document.getElementById('overlay');
        
        if (!balanceCustomerName || !currentBalance || !balanceForm || !balanceModal || !overlay) {
            console.error('Balance modal elements not found');
            this.showErrorMessage('Balance modal not available');
            return;
        }
        
        balanceCustomerName.textContent = customer.name;
        currentBalance.textContent = this.formatCurrency(customer.balance);
        currentBalance.className = this.getBalanceClass(customer.balance);
        
        balanceForm.reset();
        balanceModal.classList.add('active');
        overlay.classList.add('active');
        
        balanceModal.dataset.customerId = customer.id;
    }

    closeBalanceModal() {
        document.getElementById('balanceModal').classList.remove('active');
        document.getElementById('overlay').classList.remove('active');
    }

    async updateBalance(e) {
        e.preventDefault();
        
        const customerId = parseInt(document.getElementById('balanceModal').dataset.customerId);
        const formData = new FormData(e.target);
        const transactionType = formData.get('transactionType');
        const amount = parseFloat(formData.get('transactionAmount'));
        const note = formData.get('transactionNote').trim();
        
        if (!amount || amount <= 0) {
            this.showErrorMessage('Please enter a valid amount');
            return;
        }
        
        const customer = this.customers.find(c => c.id === customerId);
        if (!customer) return;
        
        try {
            this.showLoadingSpinner(true);
            
            const oldBalance = customer.balance;
            if (transactionType === 'add') {
                customer.balance += amount;
            } else {
                customer.balance -= amount;
            }
            
            customer.lastUpdated = this.getISTDateTime();
            if (note) {
                customer.notes = customer.notes ? 
                    `${customer.notes}\n${this.getISTDateString()}: ${note}` : 
                    `${this.getISTDateString()}: ${note}`;
            }
            
            // Update individual customer sheet
            if (customer.sheetId && this.isSignedIn) {
                await this.updateCustomerSheet(customer, {
                    type: transactionType === 'add' ? 'Charge/Purchase' : 'Payment Received',
                    amount: transactionType === 'add' ? amount : -amount,
                    note: note
                });
            }
            
            this.saveToLocalStorage();
            await this.updateMasterSheet();
            this.renderCustomers();
            this.updateStats();
            this.closeBalanceModal();
            
            const action = transactionType === 'add' ? 'added to' : 'payment received, subtracted from';
            this.showSuccessMessage(`₹${amount.toFixed(2)} ${action} ${customer.name}'s balance`);
            
        } catch (error) {
            console.error('Error updating balance:', error);
            this.showErrorMessage('Failed to update balance: ' + error.message);
        } finally {
            this.showLoadingSpinner(false);
        }
    }

    deleteCustomer(customerId) {
        const customer = this.customers.find(c => c.id === customerId);
        if (!customer) return;
        
        if (customer.balance !== 0) {
            this.showErrorMessage('Cannot delete customer with outstanding balance');
            return;
        }
        
        if (confirm('Are you sure you want to delete this customer? This action cannot be undone.')) {
            this.customers = this.customers.filter(c => c.id !== customerId);
            this.saveToLocalStorage();
            this.updateMasterSheet();
            this.renderCustomers();
            this.updateStats();
            this.showSuccessMessage('Customer deleted successfully');
        }
    }

    // UI and Display Methods
    filterCustomers(searchTerm) {
        const term = searchTerm.toLowerCase();
        this.filteredCustomers = this.customers.filter(customer =>
            customer.name.toLowerCase().includes(term) ||
            customer.phone.includes(term)
        );
        this.renderCustomers();
    }

    applyFilter(filterType) {
        let filtered = [...this.customers];
        
        switch (filterType) {
            case 'positive':
                filtered = filtered.filter(c => c.balance > 0);
                break;
            case 'negative':
                filtered = filtered.filter(c => c.balance < 0);
                break;
            case 'zero':
                filtered = filtered.filter(c => c.balance === 0);
                break;
            default:
                break;
        }
        
        this.filteredCustomers = filtered;
        this.renderCustomers();
    }

    toggleView(view) {
        this.currentView = view;
        document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-view="${view}"]`).classList.add('active');
        
        const container = document.getElementById('customersContainer');
        container.className = `customers-container ${view}-view`;
        
        this.renderCustomers();
    }

    renderCustomers() {
        const container = document.getElementById('customersContainer');
        const customersToShow = this.filteredCustomers.length > 0 ? this.filteredCustomers : this.customers;
        
        if (customersToShow.length === 0) {
            document.getElementById('noResults').style.display = 'block';
            container.innerHTML = '';
            return;
        }
        
        document.getElementById('noResults').style.display = 'none';
        
        if (this.currentView === 'card') {
            container.innerHTML = customersToShow.map(customer => this.createCustomerCard(customer)).join('');
        } else {
            container.innerHTML = this.createCustomersTable(customersToShow);
        }
    }

    createCustomerCard(customer) {
        const balanceClass = this.getBalanceClass(customer.balance);
        const canDelete = customer.balance === 0;
        const hasIndividualSheet = customer.sheetId ? '📊' : '📋';
        
        return `
            <div class="customer-card fade-in">
                <div class="customer-header">
                    <div class="customer-info">
                        <h3>${customer.name} ${hasIndividualSheet}</h3>
                        <div class="customer-contact">
                            ${customer.phone ? `📞 ${customer.phone}` : ''}
                        </div>
                    </div>
                    <div class="balance-display ${balanceClass}">
                        ${this.formatCurrency(customer.balance)}
                    </div>
                </div>
                ${customer.notes ? `<p style="color: #718096; font-size: 14px; margin-bottom: 15px;">${customer.notes.split('\n').slice(-1)[0]}</p>` : ''}
                <div class="customer-actions">
                    <button class="btn btn-small btn-edit" onclick="customerManager.openCustomerModal(${JSON.stringify(customer).replace(/"/g, '&quot;')})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-small btn-balance" onclick="customerManager.openBalanceModal(${JSON.stringify(customer).replace(/"/g, '&quot;')})">
                        <i class="fas fa-coins"></i> Update Balance
                    </button>
                    ${customer.sheetId ? `
                        <button class="btn btn-small" style="background: #e6fffa; color: #234e52;" onclick="window.open('https://docs.google.com/spreadsheets/d/${customer.sheetId}/edit', '_blank')">
                            <i class="fas fa-external-link-alt"></i> View Sheet
                        </button>
                    ` : ''}
                    ${canDelete ? `
                        <button class="btn btn-small" style="background: #fed7d7; color: #c53030;" onclick="customerManager.deleteCustomer(${customer.id})">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    ` : `
                        <button class="btn btn-small" style="background: #e2e8f0; color: #a0aec0; cursor: not-allowed;" disabled title="Cannot delete customer with outstanding balance">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    `}
                </div>
            </div>
        `;
    }

    createCustomersTable(customers) {
        return `
            <table class="customers-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Contact</th>
                        <th>Balance</th>
                        <th>Last Updated</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${customers.map(customer => {
                        const canDelete = customer.balance === 0;
                        const hasIndividualSheet = customer.sheetId ? '📊' : '📋';
                        return `
                        <tr>
                            <td>
                                <strong>${customer.name} ${hasIndividualSheet}</strong>
                                ${customer.notes ? `<br><small style="color: #718096;">${customer.notes.split('\n').slice(-1)[0]}</small>` : ''}
                            </td>
                            <td>
                                ${customer.phone ? `📞 ${customer.phone}` : 'No phone'}
                            </td>
                            <td>
                                <span class="${this.getBalanceClass(customer.balance)}" style="font-weight: 600;">
                                    ${this.formatCurrency(customer.balance)}
                                </span>
                            </td>
                            <td>${new Date(customer.lastUpdated).toLocaleDateString()}</td>
                            <td>
                                <button class="btn btn-small btn-edit" onclick="customerManager.openCustomerModal(${JSON.stringify(customer).replace(/"/g, '&quot;')})" title="Edit">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-small btn-balance" onclick="customerManager.openBalanceModal(${JSON.stringify(customer).replace(/"/g, '&quot;')})" title="Update Balance">
                                    <i class="fas fa-coins"></i>
                                </button>
                                ${customer.sheetId ? `
                                    <button class="btn btn-small" style="background: #e6fffa; color: #234e52;" onclick="window.open('https://docs.google.com/spreadsheets/d/${customer.sheetId}/edit', '_blank')" title="View Individual Sheet">
                                        <i class="fas fa-external-link-alt"></i>
                                    </button>
                                ` : ''}
                                ${canDelete ? `
                                    <button class="btn btn-small" style="background: #fed7d7; color: #c53030;" onclick="customerManager.deleteCustomer(${customer.id})" title="Delete">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                ` : `
                                    <button class="btn btn-small" style="background: #e2e8f0; color: #a0aec0; cursor: not-allowed;" disabled title="Cannot delete customer with outstanding balance">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                `}
                            </td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    updateStats() {
        const totalCustomers = this.customers.length;
        const totalPositive = this.customers.reduce((sum, c) => sum + (c.balance > 0 ? c.balance : 0), 0);
        const totalNegative = this.customers.reduce((sum, c) => sum + (c.balance < 0 ? Math.abs(c.balance) : 0), 0);
        
        document.getElementById('totalCustomers').textContent = totalCustomers;
        document.getElementById('totalPositive').textContent = this.formatCurrency(totalPositive);
        document.getElementById('totalNegative').textContent = this.formatCurrency(totalNegative);
    }

    async refreshData() {
        if (this.isSignedIn && this.spreadsheetId) {
            await this.syncWithGoogleSheets();
        } else {
            this.renderCustomers();
            this.updateStats();
            this.showSuccessMessage('Data refreshed from local storage');
        }
    }

    formatCurrency(amount) {
        return `₹${Math.abs(amount).toFixed(2)}`;
    }

    getBalanceClass(balance) {
        if (balance > 0) return 'balance-positive';
        if (balance < 0) return 'balance-negative';
        return 'balance-zero';
    }

    showLoadingSpinner(show) {
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) {
            spinner.style.display = show ? 'block' : 'none';
        }
    }

    showSuccessMessage(message) {
        this.showToast(message, 'success');
    }

    showErrorMessage(message) {
        this.showToast(message, 'error');
    }

    showToast(message, type) {
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
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // IST Time Helper Methods
    getISTDateTime() {
        const now = new Date();
        const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000)); // Add 5.5 hours for IST
        return istTime.toISOString();
    }

    getISTDateString() {
        const now = new Date();
        const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000)); // Add 5.5 hours for IST
        return istTime.toLocaleDateString('en-IN', { 
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: '2-digit', 
            year: 'numeric'
        });
    }

    getISTDateTimeString() {
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

// Global function to setup Google Sheets OAuth
async function setupGoogleSheets() {
    const clientId = document.getElementById('clientId').value.trim();
    const apiKey = document.getElementById('apiKey').value.trim();
    const spreadsheetId = document.getElementById('spreadsheetId').value.trim();
    
    if (!clientId || !apiKey || !spreadsheetId) {
        customerManager.showErrorMessage('Please enter Client ID, API Key, and Spreadsheet ID');
        return;
    }
    
    try {
        // Save OAuth configuration
        const config = {
            clientId: clientId,
            apiKey: apiKey,
            spreadsheetId: spreadsheetId
        };
        
        localStorage.setItem('googleSheetsOAuthConfig', JSON.stringify(config));
        
        // Update manager configuration
        customerManager.clientId = clientId;
        customerManager.apiKey = apiKey;
        customerManager.spreadsheetId = spreadsheetId;
        
        // Initialize Google API
        await customerManager.initializeGoogleAPI();
        
        // Close modal
        customerManager.closeGoogleSheetsModal();
        
    } catch (error) {
        console.error('Setup error:', error);
        customerManager.showErrorMessage('Failed to setup Google Sheets integration: ' + error.message);
    }
}

// Add CSS for toast animations
const style = document.createElement('style');
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

// Initialize the application when DOM is loaded
let customerManager;
document.addEventListener('DOMContentLoaded', () => {
    customerManager = new CustomerBalanceManager();
});

// Export for global access
window.customerManager = customerManager;
