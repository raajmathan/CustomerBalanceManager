// Main Customer Balance Manager class
import { CONFIG } from '../config/config.js';
import { DateUtils } from '../utils/dateUtils.js';
import { FormatUtils } from '../utils/formatUtils.js';
import { StorageUtils } from '../utils/storageUtils.js';
import { GoogleSheetsService } from '../services/googleSheetsService.js';
import { ToastManager } from '../ui/toastManager.js';
import { CustomerRenderer } from '../ui/customerRenderer.js';

export class CustomerBalanceManager {
    constructor() {
        this.customers = [];
        this.filteredCustomers = [];
        this.currentView = CONFIG.UI.DEFAULT_VIEW;
        this.editingCustomerId = null;
        this.currentFilter = 'all'; // Track current filter state
        this.currentSearchTerm = ''; // Track current search term
        this.advancedFilters = {
            categories: [],
            balanceStatus: [],
            productCategories: [],
            minBalance: null,
            maxBalance: null,
            activityPeriod: '',
            startDate: null,
            endDate: null,
            sortBy: 'name-asc'
        }; // Track advanced filters
        this.isAdvancedFilterPanelOpen = false;
        
        // Initialize Google Sheets service
        this.googleSheetsService = new GoogleSheetsService();
        
        this.init();
    }

    async init() {
        // Make this instance globally accessible for filter tag removal
        window.customerManager = this;
        
        // Initialize UI styles
        ToastManager.initializeStyles();
        
        // Setup welcome message
        this.setupWelcomeMessage();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Initialize with empty data - we'll load fresh from Google Sheets
        this.customers = [];
        this.filteredCustomers = [];
        this.renderCustomers();
        this.updateStats();
        
        console.log('🚀 Customer data caching DISABLED - will fetch fresh from Google Sheets');
        
        // Check OAuth setup and load fresh data
        await this.checkOAuthSetup();
    }

    setupEventListeners() {
        // Header buttons
        document.getElementById('addCustomerBtn').addEventListener('click', () => this.openCustomerModal());
        document.getElementById('refreshBtn').addEventListener('click', () => this.refreshData());
        document.getElementById('uploadToSheetsBtn').addEventListener('click', () => this.uploadLocalDataToSheets());
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());

        // Search and filter
        document.getElementById('searchInput').addEventListener('input', (e) => this.filterCustomers(e.target.value));
        document.getElementById('quickFilterSelect').addEventListener('change', (e) => this.applyQuickFilter(e.target.value));
        
        // Setup advanced filtering system
        this.setupAdvancedFiltering();

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

        // Setup transaction type change handler for product category visibility
        this.setupTransactionTypeHandler();

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
                this.closeAdvancedFilterPanel();
            }
        });
    }

    async checkOAuthSetup() {
        console.log('=== GOOGLE SHEETS INTEGRATION DEBUG ===');
        console.log('Client ID:', CONFIG.OAUTH.CLIENT_ID);
        console.log('API Key:', CONFIG.OAUTH.API_KEY);
        console.log('Spreadsheet ID:', CONFIG.OAUTH.SPREADSHEET_ID);
        console.log('Scopes:', CONFIG.OAUTH.SCOPES);
        
        // Show the Google Sheets modal to display sign-in interface
        this.showGoogleSheetsModal();
        
        // Since we have the Client ID configured, directly initialize
        if (CONFIG.OAUTH.CLIENT_ID) {
            try {
                console.log('Attempting to initialize Google API...');
                await this.initializeGoogleAPI();
                console.log('Google API initialization completed');
                return;
            } catch (error) {
                console.error('Google API initialization failed:', error);
                ToastManager.showError('Google Sheets setup failed: ' + error.message);
                this.showOAuthSetupModal();
                return;
            }
        }
        
        // Check if OAuth is already configured in localStorage
        const savedConfig = StorageUtils.loadOAuthConfig();
        
        if (savedConfig) {
            try {
                this.googleSheetsService.spreadsheetId = savedConfig.spreadsheetId || CONFIG.OAUTH.SPREADSHEET_ID;
                
                if (savedConfig.clientId) {
                    await this.initializeGoogleAPI();
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
            console.log('🔄 Starting Google API initialization...');
            ToastManager.showSuccess('Initializing Google API...');
            
            // Load Google API
            console.log('📡 Loading Google API...');
            await this.googleSheetsService.loadGoogleAPI();
            console.log('✅ Google API loaded successfully');
            
            // Initialize OAuth
            console.log('🔐 Initializing OAuth...');
            const hasToken = await this.googleSheetsService.initializeOAuth(() => {
                console.log('🎉 OAuth callback triggered - user signed in!');
                this.showSignedInState();
                ToastManager.showSuccess('Successfully signed in to Google!');
                console.log('🔄 Starting sync after sign-in...');
                this.syncWithGoogleSheets();
            });
            
            console.log('🔍 Has existing token:', hasToken);
            
            if (hasToken) {
                console.log('✅ Found existing token, showing signed-in state');
                this.showSignedInState();
                ToastManager.showSuccess('Google Sheets integration enabled with full write access!');
                document.getElementById('uploadToSheetsBtn').style.display = 'inline-flex';
                console.log('🔄 Starting sync with existing token...');
                await this.syncWithGoogleSheets();
            } else {
                console.log('ℹ️ No existing token, attempting read-only sync with API key...');
                ToastManager.showSuccess('Google API initialized. Attempting to load existing data...');
                
                // Try to sync with read-only access using API key
                try {
                    console.log('📖 Attempting read-only sync...');
                    await this.syncWithGoogleSheets();
                    console.log('✅ Read-only sync successful');
                    ToastManager.showSuccess('Loaded existing customer data! Sign in for full write access.');
                } catch (syncError) {
                    console.log('⚠️ Read-only sync failed:', syncError.message);
                    ToastManager.showSuccess('Google API initialized. Ready to sign in for full access.');
                }
                
                this.showSignInButton();
            }
        } catch (error) {
            console.error('❌ Failed to initialize Google API:', error);
            ToastManager.showError('Failed to initialize Google API: ' + error.message);
            // Show sign-in button even if there's an error, so user can try to authenticate
            this.showSignInButton();
        } finally {
            this.showLoadingSpinner(false);
        }
    }

    showSignInButton() {
        document.getElementById('signInSection').style.display = 'block';
        document.getElementById('signedInSection').style.display = 'none';
        
        const signInBtn = document.getElementById('signInBtn');
        signInBtn.onclick = () => {
            try {
                this.googleSheetsService.requestAccessToken();
            } catch (error) {
                ToastManager.showError('Authentication not initialized. Please refresh the page.');
            }
        };
    }

    showSignedInState() {
        document.getElementById('signInSection').style.display = 'none';
        document.getElementById('signedInSection').style.display = 'block';
    }

    async syncWithGoogleSheets() {
        // Allow sync even when not signed in (read-only with API key)
        try {
            this.showLoadingSpinner(true);
            console.log('🔄 Starting sync from customerManager...');
            ToastManager.showSuccess('Syncing with Google Sheets...');
            
            const customers = await this.googleSheetsService.syncWithGoogleSheets();
            console.log('📊 Received customers from googleSheetsService:', customers);
            
            if (customers && customers.length > 0) {
                console.log('✅ Using FRESH data from Google Sheets (no cache mixing):', customers);
                
                // Use ONLY fresh data from Google Sheets - no merging with cache
                this.customers = [...customers];
                this.filteredCustomers = [...this.customers];
                
                // Don't save to localStorage - keep data fresh from Google Sheets
                console.log('📝 Skipping localStorage save - keeping data fresh from Google Sheets');
                
                this.renderCustomers();
                this.updateStats();
                ToastManager.showSuccess(`✅ Successfully loaded ${customers.length} fresh customers from Google Sheets!`);
            } else {
                console.log('No customers found in Google Sheets, creating header...');
                await this.googleSheetsService.createSheetHeader();
                if (this.customers.length > 0) {
                    ToastManager.showSuccess('Uploading local data to Google Sheets...');
                    await this.uploadLocalDataToSheets();
                } else {
                    ToastManager.showSuccess('Google Sheets initialized and ready!');
                }
            }
        } catch (error) {
            console.error('Sync error:', error);
            ToastManager.showError('Failed to sync with Google Sheets: ' + error.message);
        } finally {
            this.showLoadingSpinner(false);
        }
    }

    async uploadLocalDataToSheets() {
        if (!this.googleSheetsService.isSignedIn || this.customers.length === 0) return;
        
        try {
            this.showLoadingSpinner(true);
            await this.googleSheetsService.uploadDataToSheets(this.customers);
            ToastManager.showSuccess(`Successfully uploaded ${this.customers.length} customers to Google Sheets!`);
        } catch (error) {
            console.error('Upload failed:', error);
            ToastManager.showError('Failed to upload data: ' + error.message);
        } finally {
            this.showLoadingSpinner(false);
        }
    }

    // Customer Management Methods
    loadFromLocalStorage() {
        this.customers = StorageUtils.loadCustomers();
    }

    saveToLocalStorage() {
        StorageUtils.saveCustomers(this.customers);
    }

    openCustomerModal(customer = null) {
        this.editingCustomerId = customer ? customer.id : null;
        const modal = document.getElementById('customerModal');
        const form = document.getElementById('customerForm');
        const title = document.getElementById('modalTitle');
        
        title.textContent = customer ? 'Edit Customer' : 'Add New Customer';
        
        if (customer) {
            document.getElementById('customerName').value = customer.name;
            document.getElementById('customerPhone').value = customer.phone || '';
            document.getElementById('customerCategory').value = customer.category || '';
            document.getElementById('customerBalance').value = customer.balance;
            document.getElementById('customerNotes').value = customer.notes || '';
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

    validateCustomerData(customerData) {
        const errors = [];

        // Name validation
        if (!customerData.name || customerData.name.trim() === '') {
            errors.push('Name is required');
        } else {
            const trimmedName = customerData.name.trim();
            
            // Check name length
            if (trimmedName.length < 2) {
                errors.push('Name must be at least 2 characters long');
            } else if (trimmedName.length > 50) {
                errors.push('Name must not exceed 50 characters');
            }
            
            // Check for valid characters (letters, spaces, hyphens, apostrophes, periods)
            const nameRegex = /^[a-zA-Z\s\-'\.]+$/;
            if (!nameRegex.test(trimmedName)) {
                errors.push('Name can only contain letters, spaces, hyphens, apostrophes, and periods');
            }
            
            // Check for duplicate names (case-insensitive)
            const existingCustomer = this.customers.find(c => 
                c.name.toLowerCase().trim() === trimmedName.toLowerCase() && 
                c.id !== this.editingCustomerId
            );
            if (existingCustomer) {
                errors.push('A customer with this name already exists');
            }
        }

        // Category validation
        if (!customerData.category || customerData.category.trim() === '') {
            errors.push('Customer category is required');
        } else {
            const validCategories = ['Contractor', 'Engineer', 'Other Party'];
            if (!validCategories.includes(customerData.category.trim())) {
                errors.push('Please select a valid customer category');
            }
        }

        // Phone validation (optional field)
        if (customerData.phone && customerData.phone.trim() !== '') {
            const cleanPhone = customerData.phone.replace(/\D/g, '');
            
            // Check phone number length
            if (cleanPhone.length < 10) {
                errors.push('Phone number must be at least 10 digits');
            } else if (cleanPhone.length > 15) {
                errors.push('Phone number must not exceed 15 digits');
            }
            
            // Check for valid Indian phone number patterns (if 10 digits)
            if (cleanPhone.length === 10) {
                const indianPhoneRegex = /^[6-9]\d{9}$/;
                if (!indianPhoneRegex.test(cleanPhone)) {
                    errors.push('Invalid Indian phone number (must start with 6, 7, 8, or 9)');
                }
            }
            
            // Check for duplicate phone numbers (only if phone is provided)
            const existingCustomer = this.customers.find(c => 
                c.phone && c.phone.replace(/\D/g, '') === cleanPhone && 
                c.id !== this.editingCustomerId
            );
            if (existingCustomer) {
                errors.push('A customer with this phone number already exists');
            }
        }

        // Balance validation
        if (customerData.balance === '' || customerData.balance === null || customerData.balance === undefined) {
            errors.push('Balance is required');
        } else {
            const balanceStr = customerData.balance.toString().trim();
            
            // Check for valid number format (allow negative numbers and decimals)
            const balanceRegex = /^-?\d+(\.\d{1,2})?$/;
            if (!balanceRegex.test(balanceStr)) {
                errors.push('Balance must be a valid number with up to 2 decimal places');
            } else {
                const balance = parseFloat(balanceStr);
                if (isNaN(balance)) {
                    errors.push('Balance must be a valid number');
                } else {
                    // Check reasonable balance limits
                    if (balance < -1000000) {
                        errors.push('Balance cannot be less than -₹10,00,000');
                    } else if (balance > 1000000) {
                        errors.push('Balance cannot exceed ₹10,00,000');
                    }
                }
            }
        }

        // Notes validation (optional field)
        if (customerData.notes && customerData.notes.trim().length > 500) {
            errors.push('Notes must not exceed 500 characters');
        }

        return errors;
    }

    async saveCustomer(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const customerData = {
            name: formData.get('customerName').trim(),
            phone: formData.get('customerPhone').trim(),
            category: formData.get('customerCategory').trim(),
            balance: formData.get('customerBalance'),
            notes: formData.get('customerNotes').trim(),
            lastUpdated: DateUtils.getISTDateTime()
        };
        
        // Comprehensive validation
        const validationErrors = this.validateCustomerData(customerData);
        if (validationErrors.length > 0) {
            ToastManager.showError(validationErrors[0]); // Show first error
            return;
        }
        
        // Convert balance to number after validation
        customerData.balance = parseFloat(customerData.balance) || 0;
        
        try {
            this.showLoadingSpinner(true);
            
            if (this.editingCustomerId) {
                // Update existing customer
                const index = this.customers.findIndex(c => c.id === this.editingCustomerId);
                if (index !== -1) {
                    this.customers[index] = { ...this.customers[index], ...customerData };
                }
                ToastManager.showSuccess('Customer updated successfully!');
            } else {
                // Add new customer
                customerData.id = Date.now();
                
                // Create individual Google Sheet if signed in
                if (this.googleSheetsService.isSignedIn) {
                    try {
                        const sheetId = await this.googleSheetsService.createCustomerSheet(customerData);
                        customerData.sheetId = sheetId;
                        ToastManager.showSuccess(`Customer added with individual Google Sheet created!`);
                    } catch (error) {
                        console.error('Failed to create customer sheet:', error);
                        ToastManager.showError('Customer added but failed to create individual sheet');
                    }
                } else {
                    ToastManager.showSuccess('Customer added successfully!');
                }
                
                this.customers.push(customerData);
            }
            
            this.saveToLocalStorage();
            await this.googleSheetsService.updateMasterSheet(this.customers);
            this.renderCustomers();
            this.updateStats();
            this.closeCustomerModal();
            
        } catch (error) {
            console.error('Error saving customer:', error);
            ToastManager.showError('Failed to save customer: ' + error.message);
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
            ToastManager.showError('Balance modal not available');
            return;
        }
        
        // Find the current customer by name to ensure we have the latest ID
        const currentCustomer = this.customers.find(c => c.name === customer.name);
        if (!currentCustomer) {
            console.error('Customer not found in current data:', customer.name);
            ToastManager.showError('Customer data is outdated. Please refresh the page.');
            return;
        }
        
        console.log('Opening balance modal for customer:', currentCustomer.name, 'ID:', currentCustomer.id);
        
        balanceCustomerName.textContent = currentCustomer.name;
        currentBalance.textContent = FormatUtils.formatCurrency(currentCustomer.balance);
        currentBalance.className = FormatUtils.getBalanceClass(currentCustomer.balance);
        
        balanceForm.reset();
        balanceModal.classList.add('active');
        overlay.classList.add('active');
        
        // Use the current customer ID, not the potentially outdated one
        balanceModal.dataset.customerId = currentCustomer.id;
    }

    closeBalanceModal() {
        document.getElementById('balanceModal').classList.remove('active');
        document.getElementById('overlay').classList.remove('active');
    }

    validateTransactionData(transactionData) {
        const errors = [];
        
        // Amount validation
        if (!transactionData.amount || transactionData.amount === '') {
            errors.push('Transaction amount is required');
        } else {
            const amountStr = transactionData.amount.toString().trim();
            
            // Check for valid positive number format
            const amountRegex = /^\d+(\.\d{1,2})?$/;
            if (!amountRegex.test(amountStr)) {
                errors.push('Amount must be a positive number with up to 2 decimal places');
            } else {
                const amount = parseFloat(amountStr);
                if (isNaN(amount) || amount <= 0) {
                    errors.push('Amount must be greater than 0');
                } else if (amount > 1000000) {
                    errors.push('Amount cannot exceed ₹10,00,000');
                } else if (amount < 0.01) {
                    errors.push('Amount must be at least ₹0.01');
                }
            }
        }
        
        // Transaction type validation
        if (!transactionData.transactionType || !['add', 'subtract', 'return'].includes(transactionData.transactionType)) {
            errors.push('Please select a valid transaction type');
        }
        
        // Payment method validation (required for customer payments)
        if (transactionData.transactionType === 'subtract') {
            if (!transactionData.paymentMethod || transactionData.paymentMethod.trim() === '') {
                errors.push('Payment method is required for customer payments');
            } else {
                const validPaymentMethods = ['Cash', 'GPay', 'PhonePe', 'NEFT', 'QR Code', 'Cheque', 'Other'];
                if (!validPaymentMethods.includes(transactionData.paymentMethod.trim())) {
                    errors.push('Please select a valid payment method');
                }
            }
        }
        
        // Product category validation (required for add and return transactions)
        if (transactionData.transactionType === 'add' || transactionData.transactionType === 'return') {
            if (!transactionData.productCategory || transactionData.productCategory.trim() === '') {
                errors.push('Product category is required for sales and returns');
            } else if (!CONFIG.PRODUCT_CATEGORIES.includes(transactionData.productCategory.trim())) {
                errors.push('Please select a valid product category');
            }
        }
        
        // Note validation (optional)
        if (transactionData.note && transactionData.note.trim().length > 200) {
            errors.push('Transaction note must not exceed 200 characters');
        }
        
        return errors;
    }

    async updateBalance(e) {
        e.preventDefault();
        
        const customerIdStr = document.getElementById('balanceModal').dataset.customerId;
        
        console.log('=== CUSTOMER LOOKUP DEBUG ===');
        console.log('Customer ID from dataset:', customerIdStr, 'Type:', typeof customerIdStr);
        console.log('Total customers in array:', this.customers.length);
        console.log('All customers with IDs and types:');
        this.customers.forEach((c, index) => {
            console.log(`  [${index}] ID: ${c.id} (${typeof c.id}) - Name: ${c.name}`);
        });
        console.log('Dataset element:', document.getElementById('balanceModal').dataset);
        console.log('================================');
        
        const formData = new FormData(e.target);
        const transactionData = {
            transactionType: formData.get('transactionType'),
            amount: formData.get('transactionAmount'),
            note: formData.get('transactionDescription').trim(),
            productCategory: formData.get('productCategory'),
            paymentMethod: formData.get('paymentMethod')
        };
        
        // Comprehensive validation
        const validationErrors = this.validateTransactionData(transactionData);
        if (validationErrors.length > 0) {
            ToastManager.showError(validationErrors[0]); // Show first error
            return;
        }
        
        // Convert to proper types after validation
        const amount = parseFloat(transactionData.amount);
        const transactionType = transactionData.transactionType;
        const note = transactionData.note;
        
        // Find customer using multiple comparison methods to handle type mismatches
        let customer = null;
        
        // Try direct string comparison first
        customer = this.customers.find(c => String(c.id) === String(customerIdStr));
        
        // If not found, try numeric comparison
        if (!customer) {
            const customerIdNum = parseInt(customerIdStr);
            if (!isNaN(customerIdNum)) {
                customer = this.customers.find(c => c.id === customerIdNum);
            }
        }
        
        // If still not found, try loose equality
        if (!customer) {
            customer = this.customers.find(c => c.id == customerIdStr);
        }
        
        if (!customer) {
            console.error('Customer not found after all attempts. Looking for ID:', customerIdStr);
            console.error('Available customer IDs and types:', this.customers.map(c => ({ id: c.id, type: typeof c.id, stringId: String(c.id) })));
            ToastManager.showError('Customer not found. Please try refreshing the page.');
            return;
        }
        
        
        try {
            this.showLoadingSpinner(true);
            
            const previousBalance = customer.balance;
            
            if (transactionType === 'add') {
                // New sale - add to balance (they bought something, increasing what they owe)
                customer.balance += amount;
            } else if (transactionType === 'subtract') {
                // Customer payment - subtract from balance (they paid, reducing what they owe)
                customer.balance -= amount;
            } else if (transactionType === 'return') {
                // Product return - subtract from customer balance (refund to customer)
                customer.balance -= amount;
            }
            
            // Round to 2 decimal places to avoid floating point precision issues
            customer.balance = Math.round(customer.balance * 100) / 100;
            
            customer.lastUpdated = DateUtils.getISTDateTime();
            
            // Build comprehensive transaction note with all details
            let transactionNote = '';
            let detailedNote = '';
            
            if (transactionType === 'add') {
                // New sale - include product category
                if (transactionData.productCategory) {
                    transactionNote = transactionData.productCategory;
                    detailedNote = `Sale: ${transactionData.productCategory}`;
                    if (note) {
                        transactionNote += ` - ${note}`;
                        detailedNote += ` - ${note}`;
                    }
                }
            } else if (transactionType === 'subtract') {
                // Customer payment - include payment method
                if (transactionData.paymentMethod) {
                    transactionNote = `Payment via ${transactionData.paymentMethod}`;
                    detailedNote = `Payment via ${transactionData.paymentMethod}`;
                    if (note) {
                        transactionNote += ` - ${note}`;
                        detailedNote += ` - ${note}`;
                    }
                }
            } else if (transactionType === 'return') {
                // Product return - include product category
                if (transactionData.productCategory) {
                    transactionNote = transactionData.productCategory;
                    detailedNote = `Return: ${transactionData.productCategory}`;
                    if (note) {
                        transactionNote += ` - ${note}`;
                        detailedNote += ` - ${note}`;
                    }
                }
            }
            
            if (transactionNote) {
                customer.notes = customer.notes ? 
                    `${customer.notes}\n${DateUtils.getISTDateString()}: ${transactionNote}` : 
                    `${DateUtils.getISTDateString()}: ${transactionNote}`;
            }
            
            // Update individual customer sheet with comprehensive details
            if (customer.sheetId && this.googleSheetsService.isSignedIn) {
                let transactionTypeForSheet, amountForSheet, noteForSheet;
                
                if (transactionType === 'add') {
                    transactionTypeForSheet = `Sale: ${transactionData.productCategory || 'Unknown Category'}`;
                    amountForSheet = amount;
                    noteForSheet = note || `Sale of ${transactionData.productCategory || 'Unknown Category'}`;
                } else if (transactionType === 'subtract') {
                    transactionTypeForSheet = `Payment Received (${transactionData.paymentMethod || 'Unknown Method'})`;
                    amountForSheet = -amount;
                    noteForSheet = note || `Payment via ${transactionData.paymentMethod || 'Unknown Method'}`;
                } else if (transactionType === 'return') {
                    transactionTypeForSheet = `Return: ${transactionData.productCategory || 'Unknown Category'}`;
                    amountForSheet = -amount;
                    noteForSheet = note || `Return of ${transactionData.productCategory || 'Unknown Category'}`;
                }
                
                await this.googleSheetsService.updateCustomerSheet(customer, {
                    type: transactionTypeForSheet,
                    amount: amountForSheet,
                    note: noteForSheet,
                    paymentMethod: transactionData.paymentMethod,
                    productCategory: transactionData.productCategory
                });
            }
            
            this.saveToLocalStorage();
            await this.googleSheetsService.updateMasterSheet(this.customers);
            this.renderCustomers();
            this.updateStats();
            this.closeBalanceModal();
            
            let action;
            if (transactionType === 'add') {
                action = 'sale recorded, added to';
            } else if (transactionType === 'subtract') {
                action = 'payment received, subtracted from';
            } else if (transactionType === 'return') {
                action = 'product return processed, refunded from';
            }
            
            ToastManager.showSuccess(`₹${amount.toFixed(2)} ${action} ${customer.name}'s balance (Previous: ₹${previousBalance.toFixed(2)}, New: ₹${customer.balance.toFixed(2)})`);
            
        } catch (error) {
            console.error('Error updating balance:', error);
            ToastManager.showError('Failed to update balance: ' + error.message);
        } finally {
            this.showLoadingSpinner(false);
        }
    }

    async deleteCustomer(customerId) {
        const customer = this.customers.find(c => c.id === customerId);
        if (!customer) return;
        
        if (customer.balance !== 0) {
            ToastManager.showError('Cannot delete customer with outstanding balance');
            return;
        }
        
        if (confirm('Are you sure you want to delete this customer? This will also delete their individual Google Sheet. This action cannot be undone.')) {
            try {
                this.showLoadingSpinner(true);
                
                // Delete individual Google Sheet if it exists
                if (customer.sheetId && this.googleSheetsService.isSignedIn) {
                    await this.googleSheetsService.deleteCustomerSheet(customer);
                }
                
                // Remove customer from local data
                this.customers = this.customers.filter(c => c.id !== customerId);
                this.saveToLocalStorage();
                
                // Update master sheet
                await this.googleSheetsService.updateMasterSheet(this.customers);
                
                this.renderCustomers();
                this.updateStats();
                ToastManager.showSuccess('Customer and individual sheet deleted successfully');
                
            } catch (error) {
                console.error('Error deleting customer:', error);
                ToastManager.showError('Failed to delete customer: ' + error.message);
            } finally {
                this.showLoadingSpinner(false);
            }
        }
    }

    // Advanced Filtering System
    setupAdvancedFiltering() {
        // Setup quick filter buttons
        this.setupQuickFilters();
        
        // Setup advanced filter panel
        this.setupAdvancedFilterPanel();
        
        // Initialize filter counts
        this.updateFilterCounts();
        
        // Close panel when clicking on sidebar overlay
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', () => {
                this.closeAdvancedFilterPanel();
            });
        }
    }
    
    setupQuickFilters() {
        const quickFilterBtns = document.querySelectorAll('.quick-filter-btn');
        
        quickFilterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = btn.dataset.filter;
                this.applyQuickFilter(filter);
            });
        });
    }
    
    setupAdvancedFilterPanel() {
        const advancedFilterBtn = document.getElementById('advancedFilterBtn');
        const closeFilterPanelBtn = document.getElementById('closeFilterPanelBtn');
        const clearAllFiltersBtn = document.getElementById('clearAllFiltersBtn');
        const resetFiltersBtn = document.getElementById('resetFiltersBtn');
        const applyAdvancedFiltersBtn = document.getElementById('applyAdvancedFiltersBtn');
        const activityFilter = document.getElementById('activityFilter');
        const clearAllActiveBtn = document.getElementById('clearAllActiveBtn');
        
        // Toggle advanced filter panel
        if (advancedFilterBtn) {
            advancedFilterBtn.addEventListener('click', () => {
                this.toggleAdvancedFilterPanel();
            });
        }
        
        // Close panel
        if (closeFilterPanelBtn) {
            closeFilterPanelBtn.addEventListener('click', () => {
                this.closeAdvancedFilterPanel();
            });
        }
        
        // Clear all filters
        if (clearAllFiltersBtn) {
            clearAllFiltersBtn.addEventListener('click', () => {
                this.clearAllAdvancedFilters();
            });
        }
        
        // Reset filters
        if (resetFiltersBtn) {
            resetFiltersBtn.addEventListener('click', () => {
                this.resetAdvancedFilters();
            });
        }
        
        // Apply filters
        if (applyAdvancedFiltersBtn) {
            applyAdvancedFiltersBtn.addEventListener('click', () => {
                this.applyAdvancedFilters();
            });
        }
        
        // Activity filter change
        if (activityFilter) {
            activityFilter.addEventListener('change', (e) => {
                this.handleActivityFilterChange(e.target.value);
            });
        }
        
        // Clear all active filters
        if (clearAllActiveBtn) {
            clearAllActiveBtn.addEventListener('click', () => {
                this.clearAllActiveFilters();
            });
        }
        
        // Setup real-time filter preview
        this.setupFilterPreview();
    }
    
    setupFilterPreview() {
        const inputs = document.querySelectorAll('#advancedFilterPanel input, #advancedFilterPanel select');
        
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                this.updateFilterPreview();
            });
            
            input.addEventListener('change', () => {
                this.updateFilterPreview();
            });
        });
    }
    
    applyQuickFilter(filter) {
        // Clear current filters
        this.currentFilter = filter;
        this.clearAllAdvancedFilters();
        
        // Update active states
        document.querySelectorAll('.quick-filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
        
        // Apply filter and render
        this.applyFiltersAndSearch();
        
        // Show success message
        const filterNames = {
            'all': 'All Customers',
            'positive': 'Customers with Receivable Balance',
            'negative': 'Customers with Payable Balance',
            'recent': 'Recently Updated Customers'
        };
        
        ToastManager.showSuccess(`Showing: ${filterNames[filter] || filter}`);
    }
    
    toggleAdvancedFilterPanel() {
        const panel = document.getElementById('advancedFilterPanel');
        const btn = document.getElementById('advancedFilterBtn');
        
        if (panel.classList.contains('active')) {
            this.closeAdvancedFilterPanel();
        } else {
            this.openAdvancedFilterPanel();
        }
    }
    
    openAdvancedFilterPanel() {
        const panel = document.getElementById('advancedFilterPanel');
        const btn = document.getElementById('advancedFilterBtn');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        
        panel.classList.add('active');
        btn.classList.add('active');
        sidebarOverlay.classList.add('active');
        this.isAdvancedFilterPanelOpen = true;
        
        // Update filter preview
        this.updateFilterPreview();
    }
    
    closeAdvancedFilterPanel() {
        const panel = document.getElementById('advancedFilterPanel');
        const btn = document.getElementById('advancedFilterBtn');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        
        panel.classList.remove('active');
        btn.classList.remove('active');
        sidebarOverlay.classList.remove('active');
        this.isAdvancedFilterPanelOpen = false;
    }
    
    handleActivityFilterChange(value) {
        const dateRangeInputs = document.getElementById('dateRangeInputs');
        
        if (value === 'custom') {
            dateRangeInputs.style.display = 'flex';
        } else {
            dateRangeInputs.style.display = 'none';
        }
        
        this.updateFilterPreview();
    }
    
    clearAllAdvancedFilters() {
        // Reset advanced filters object
        this.advancedFilters = {
            categories: [],
            balanceStatus: [],
            productCategories: [],
            minBalance: null,
            maxBalance: null,
            activityPeriod: '',
            startDate: null,
            endDate: null,
            sortBy: 'name-asc'
        };
        
        // Reset form inputs
        document.getElementById('minBalance').value = '';
        document.getElementById('maxBalance').value = '';
        document.getElementById('activityFilter').value = '';
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';
        document.getElementById('sortFilter').value = 'name-asc';
        document.getElementById('dateRangeInputs').style.display = 'none';
        
        // Uncheck all checkboxes
        document.querySelectorAll('#advancedFilterPanel input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });
        
        this.updateFilterPreview();
        this.updateActiveFiltersDisplay();
    }
    
    resetAdvancedFilters() {
        this.clearAllAdvancedFilters();
        this.currentFilter = 'all';
        
        // Reset quick filters
        document.querySelectorAll('.quick-filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector('[data-filter="all"]').classList.add('active');
        
        this.applyFiltersAndSearch();
        ToastManager.showSuccess('All filters reset');
    }
    
    applyAdvancedFilters() {
        this.collectAdvancedFilters();
        this.applyFiltersAndSearch();
        this.updateActiveFiltersDisplay();
        this.closeAdvancedFilterPanel();
        
        const activeCount = this.getActiveAdvancedFiltersCount();
        if (activeCount > 0) {
            ToastManager.showSuccess(`Applied ${activeCount} advanced filter(s)`);
        } else {
            ToastManager.showSuccess('Showing all customers');
        }
    }
    
    collectAdvancedFilters() {
        // Collect category filters
        this.advancedFilters.categories = Array.from(
            document.querySelectorAll('input[data-filter="category"]:checked')
        ).map(cb => cb.value);
        
        // Collect balance status filters
        this.advancedFilters.balanceStatus = Array.from(
            document.querySelectorAll('input[data-filter="balance-status"]:checked')
        ).map(cb => cb.value);
        
        // Collect product category filters
        this.advancedFilters.productCategories = Array.from(
            document.querySelectorAll('input[data-filter="product-category"]:checked')
        ).map(cb => cb.value);
        
        // Collect range filters
        this.advancedFilters.minBalance = parseFloat(document.getElementById('minBalance').value) || null;
        this.advancedFilters.maxBalance = parseFloat(document.getElementById('maxBalance').value) || null;
        
        // Collect activity filters
        this.advancedFilters.activityPeriod = document.getElementById('activityFilter').value;
        this.advancedFilters.startDate = document.getElementById('startDate').value || null;
        this.advancedFilters.endDate = document.getElementById('endDate').value || null;
        
        // Collect sort option
        this.advancedFilters.sortBy = document.getElementById('sortFilter').value;
    }
    
    updateFilterPreview() {
        if (!this.isAdvancedFilterPanelOpen) return;
        
        this.collectAdvancedFilters();
        const previewCount = this.getFilteredCustomersCount();
        
        const resultSpan = document.getElementById('filterResultsCount');
        if (resultSpan) {
            resultSpan.textContent = `${previewCount} customer${previewCount !== 1 ? 's' : ''} match your filters`;
        }
    }
    
    getFilteredCustomersCount() {
        return this.applyAdvancedFiltersToCustomers(this.customers).length;
    }
    
    getActiveAdvancedFiltersCount() {
        let count = 0;
        
        count += this.advancedFilters.categories.length;
        count += this.advancedFilters.balanceStatus.length;
        count += this.advancedFilters.productCategories.length;
        if (this.advancedFilters.minBalance !== null) count++;
        if (this.advancedFilters.maxBalance !== null) count++;
        if (this.advancedFilters.activityPeriod) count++;
        if (this.advancedFilters.startDate) count++;
        if (this.advancedFilters.endDate) count++;
        
        return count;
    }
    
    updateActiveFiltersDisplay() {
        const display = document.getElementById('activeFiltersDisplay');
        const tagsContainer = document.getElementById('activeFiltersTags');
        const badge = document.getElementById('activeFiltersBadge');
        
        const activeCount = this.getActiveAdvancedFiltersCount();
        
        if (activeCount === 0) {
            display.style.display = 'none';
            badge.style.display = 'none';
            return;
        }
        
        display.style.display = 'flex';
        badge.style.display = 'flex';
        badge.textContent = activeCount;
        
        // Build filter tags
        const tags = [];
        
        this.advancedFilters.categories.forEach(cat => {
            tags.push({ type: 'category', value: cat, label: cat });
        });
        
        this.advancedFilters.balanceStatus.forEach(status => {
            const labels = {
                'high-receivable': 'High Receivable',
                'high-payable': 'High Payable',
                'settled': 'Settled'
            };
            tags.push({ type: 'balance-status', value: status, label: labels[status] });
        });
        
        if (this.advancedFilters.minBalance !== null) {
            tags.push({ type: 'min-balance', value: this.advancedFilters.minBalance, label: `Min: ₹${this.advancedFilters.minBalance}` });
        }
        
        if (this.advancedFilters.maxBalance !== null) {
            tags.push({ type: 'max-balance', value: this.advancedFilters.maxBalance, label: `Max: ₹${this.advancedFilters.maxBalance}` });
        }
        
        if (this.advancedFilters.activityPeriod) {
            const labels = {
                'today': 'Today',
                'week': 'This Week',
                'month': 'This Month',
                'quarter': 'Last 3 Months',
                'custom': 'Custom Date Range'
            };
            tags.push({ type: 'activity', value: this.advancedFilters.activityPeriod, label: labels[this.advancedFilters.activityPeriod] });
        }
        
        tagsContainer.innerHTML = tags.map(tag => `
            <div class="filter-tag">
                <span>${tag.label}</span>
                <button class="remove-tag" onclick="window.customerManager.removeFilterTag('${tag.type}', '${tag.value}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');
    }
    
    removeFilterTag(type, value) {
        switch (type) {
            case 'category':
                this.advancedFilters.categories = this.advancedFilters.categories.filter(c => c !== value);
                document.querySelector(`input[data-filter="category"][value="${value}"]`).checked = false;
                break;
            case 'balance-status':
                this.advancedFilters.balanceStatus = this.advancedFilters.balanceStatus.filter(s => s !== value);
                document.querySelector(`input[data-filter="balance-status"][value="${value}"]`).checked = false;
                break;
            case 'min-balance':
                this.advancedFilters.minBalance = null;
                document.getElementById('minBalance').value = '';
                break;
            case 'max-balance':
                this.advancedFilters.maxBalance = null;
                document.getElementById('maxBalance').value = '';
                break;
            case 'activity':
                this.advancedFilters.activityPeriod = '';
                this.advancedFilters.startDate = null;
                this.advancedFilters.endDate = null;
                document.getElementById('activityFilter').value = '';
                document.getElementById('startDate').value = '';
                document.getElementById('endDate').value = '';
                document.getElementById('dateRangeInputs').style.display = 'none';
                break;
        }
        
        this.applyFiltersAndSearch();
        this.updateActiveFiltersDisplay();
    }
    
    clearAllActiveFilters() {
        this.resetAdvancedFilters();
    }
    
    updateFilterCounts() {
        const allCount = this.customers.length;
        const positiveCount = this.customers.filter(c => c.balance > 0).length;
        const negativeCount = this.customers.filter(c => c.balance < 0).length;
        const recentCount = this.getRecentCustomersCount();
        
        document.getElementById('allCount').textContent = allCount;
        document.getElementById('positiveCount').textContent = positiveCount;
        document.getElementById('negativeCount').textContent = negativeCount;
        document.getElementById('recentCount').textContent = recentCount;
    }
    
    getRecentCustomersCount() {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        return this.customers.filter(customer => {
            if (!customer.lastUpdated) return false;
            const lastUpdated = new Date(customer.lastUpdated);
            return lastUpdated >= sevenDaysAgo;
        }).length;
    }

    // Product Category Engagement Helper Method
    hasProductCategoryEngagement(customer, productCategories) {
        if (!customer.notes || !productCategories.length) return false;
        
        // Check if customer's transaction notes contain any of the selected product categories
        const notes = customer.notes.toLowerCase();
        
        return productCategories.some(category => {
            const categoryLower = category.toLowerCase();
            
            // Check for exact category matches in transaction notes
            // Look for patterns like "Steel - description" or "Sale: Steel" or "Return: Steel"
            const patterns = [
                categoryLower,
                `sale: ${categoryLower}`,
                `return: ${categoryLower}`,
                `${categoryLower} -`,
                `${categoryLower}:`
            ];
            
            return patterns.some(pattern => notes.includes(pattern));
        });
    }

    // Get Product Category Sales Count
    getProductCategorySalesCount(customer, productCategories) {
        if (!customer.notes || !productCategories.length) return 0;
        
        const notes = customer.notes.toLowerCase();
        let totalSales = 0;
        
        // Split notes by lines to count individual transactions
        const noteLines = customer.notes.split('\n');
        
        // Debug logging
        console.log(`Checking sales count for ${customer.name}:`, {
            productCategories,
            noteLines,
            notes
        });
        
        productCategories.forEach(category => {
            const categoryLower = category.toLowerCase();
            
            // Count occurrences of this category in transaction notes
            noteLines.forEach(line => {
                const lineLower = line.toLowerCase();
                
                // Look for patterns that indicate a sale/transaction
                const patterns = [
                    categoryLower,
                    `sale: ${categoryLower}`,
                    `return: ${categoryLower}`,
                    `${categoryLower} -`,
                    `${categoryLower}:`
                ];
                
                const matchedPattern = patterns.find(pattern => lineLower.includes(pattern));
                if (matchedPattern) {
                    console.log(`Found match for ${category}: "${line}" matches pattern "${matchedPattern}"`);
                    totalSales++;
                }
            });
        });
        
        console.log(`Total sales count for ${customer.name}:`, totalSales);
        return totalSales;
    }

    // UI and Display Methods
    filterCustomers(searchTerm) {
        this.currentSearchTerm = searchTerm.trim();
        this.applyFiltersAndSearch();
    }

    applyFiltersAndSearch() {
        let filtered = [...this.customers];
        
        // Apply quick filters first
        if (this.currentFilter !== 'all') {
            filtered = this.applyQuickFilterToCustomers(filtered);
        }
        
        // Apply advanced filters
        filtered = this.applyAdvancedFiltersToCustomers(filtered);
        
        // Apply search filter if there's a search term
        if (this.currentSearchTerm) {
            const term = this.currentSearchTerm.toLowerCase();
            filtered = filtered.filter(customer =>
                customer.name.toLowerCase().includes(term) ||
                (customer.phone && customer.phone.includes(term)) ||
                (customer.category && customer.category.toLowerCase().includes(term))
            );
        }
        
        // Apply sorting
        filtered = this.applySortingToCustomers(filtered);
        
        this.filteredCustomers = filtered;
        this.renderCustomers();
        this.updateFilterCounts();
    }
    
    applyQuickFilterToCustomers(customers) {
        switch (this.currentFilter) {
            case 'positive':
                return customers.filter(c => c.balance > 0);
            case 'negative':
                return customers.filter(c => c.balance < 0);
            case 'recent':
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                return customers.filter(customer => {
                    if (!customer.lastUpdated) return false;
                    const lastUpdated = new Date(customer.lastUpdated);
                    return lastUpdated >= sevenDaysAgo;
                });
            default:
                return customers;
        }
    }
    
    applyAdvancedFiltersToCustomers(customers) {
        let filtered = [...customers];
        
        // Apply category filters
        if (this.advancedFilters.categories.length > 0) {
            filtered = filtered.filter(customer => 
                this.advancedFilters.categories.includes(customer.category)
            );
        }
        
        // Apply balance status filters
        if (this.advancedFilters.balanceStatus.length > 0) {
            filtered = filtered.filter(customer => {
                return this.advancedFilters.balanceStatus.some(status => {
                    switch (status) {
                        case 'high-receivable':
                            return customer.balance > 10000;
                        case 'high-payable':
                            return customer.balance < -10000;
                        case 'settled':
                            return customer.balance === 0;
                        default:
                            return false;
                    }
                });
            });
        }
        
        // Apply product category engagement filters
        if (this.advancedFilters.productCategories.length > 0) {
            filtered = filtered.filter(customer => {
                // Check if customer has transaction history with any of the selected product categories
                return this.hasProductCategoryEngagement(customer, this.advancedFilters.productCategories);
            });
        }
        
        // Apply balance range filters
        if (this.advancedFilters.minBalance !== null) {
            filtered = filtered.filter(customer => customer.balance >= this.advancedFilters.minBalance);
        }
        
        if (this.advancedFilters.maxBalance !== null) {
            filtered = filtered.filter(customer => customer.balance <= this.advancedFilters.maxBalance);
        }
        
        // Apply activity period filters
        if (this.advancedFilters.activityPeriod) {
            filtered = this.applyActivityFilter(filtered);
        }
        
        return filtered;
    }
    
    applyActivityFilter(customers) {
        const now = new Date();
        let startDate, endDate;
        
        switch (this.advancedFilters.activityPeriod) {
            case 'today':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
                break;
            case 'week':
                const weekStart = new Date(now);
                weekStart.setDate(now.getDate() - now.getDay());
                weekStart.setHours(0, 0, 0, 0);
                startDate = weekStart;
                endDate = new Date(weekStart);
                endDate.setDate(weekStart.getDate() + 7);
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                break;
            case 'quarter':
                const threeMonthsAgo = new Date(now);
                threeMonthsAgo.setMonth(now.getMonth() - 3);
                startDate = threeMonthsAgo;
                endDate = now;
                break;
            case 'custom':
                if (this.advancedFilters.startDate) {
                    startDate = new Date(this.advancedFilters.startDate);
                }
                if (this.advancedFilters.endDate) {
                    endDate = new Date(this.advancedFilters.endDate);
                    endDate.setHours(23, 59, 59, 999); // End of day
                }
                break;
            default:
                return customers;
        }
        
        return customers.filter(customer => {
            if (!customer.lastUpdated) return false;
            const lastUpdated = new Date(customer.lastUpdated);
            
            if (startDate && lastUpdated < startDate) return false;
            if (endDate && lastUpdated > endDate) return false;
            
            return true;
        });
    }
    
    applySortingToCustomers(customers) {
        const sortBy = this.advancedFilters.sortBy || 'name-asc';
        
        return customers.sort((a, b) => {
            switch (sortBy) {
                case 'name-asc':
                    return a.name.localeCompare(b.name);
                case 'name-desc':
                    return b.name.localeCompare(a.name);
                case 'balance-desc':
                    return b.balance - a.balance;
                case 'balance-asc':
                    return a.balance - b.balance;
                case 'updated-desc':
                    const aDate = new Date(a.lastUpdated || 0);
                    const bDate = new Date(b.lastUpdated || 0);
                    return bDate - aDate;
                case 'updated-asc':
                    const aDateAsc = new Date(a.lastUpdated || 0);
                    const bDateAsc = new Date(b.lastUpdated || 0);
                    return aDateAsc - bDateAsc;
                default:
                    return 0;
            }
        });
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
        
        // Use filtered customers (which are already processed by applyFiltersAndSearch)
        const customersToShow = this.filteredCustomers;
        
        if (customersToShow.length === 0) {
            document.getElementById('noResults').style.display = 'block';
            container.innerHTML = '';
            return;
        }
        
        document.getElementById('noResults').style.display = 'none';
        
        if (this.currentView === 'card') {
            container.innerHTML = customersToShow.map(customer => CustomerRenderer.createCustomerCard(customer)).join('');
        } else {
            container.innerHTML = CustomerRenderer.createCustomersTable(customersToShow);
        }
    }

    updateStats() {
        const totalCustomers = this.customers.length;
        const totalPositive = this.customers.reduce((sum, c) => sum + (c.balance > 0 ? c.balance : 0), 0);
        const totalNegative = this.customers.reduce((sum, c) => sum + (c.balance < 0 ? Math.abs(c.balance) : 0), 0);
        
        document.getElementById('totalCustomers').textContent = totalCustomers;
        document.getElementById('totalPositive').textContent = FormatUtils.formatCurrency(totalPositive);
        document.getElementById('totalNegative').textContent = FormatUtils.formatCurrency(totalNegative);
    }

    async refreshData() {
        if (this.googleSheetsService.isSignedIn) {
            await this.syncWithGoogleSheets();
        } else {
            this.renderCustomers();
            this.updateStats();
            ToastManager.showSuccess('Data refreshed from local storage');
        }
    }

    showLoadingSpinner(show) {
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) {
            spinner.style.display = show ? 'block' : 'none';
        }
    }

    setupTransactionTypeHandler() {
        const transactionTypeSelect = document.getElementById('transactionType');
        const productCategoryGroup = document.getElementById('productCategoryGroup');
        const productCategorySelect = document.getElementById('productCategory');
        const paymentMethodGroup = document.getElementById('paymentMethodGroup');
        const paymentMethodSelect = document.getElementById('paymentMethod');
        
        if (transactionTypeSelect && productCategoryGroup && productCategorySelect && paymentMethodGroup && paymentMethodSelect) {
            transactionTypeSelect.addEventListener('change', (e) => {
                const descriptionField = document.getElementById('transactionDescription');
                const typeValue = e.target.value;
                
                // Show/hide fields based on transaction type
                if (typeValue === 'subtract') {
                    // Customer payment - show payment method, hide product category
                    paymentMethodGroup.style.display = 'block';
                    paymentMethodSelect.required = true;
                    productCategoryGroup.style.display = 'none';
                    productCategorySelect.required = false;
                    productCategorySelect.value = '';
                } else if (typeValue === 'add' || typeValue === 'return') {
                    // Sale or return - show product category, hide payment method
                    productCategoryGroup.style.display = 'block';
                    productCategorySelect.required = true;
                    paymentMethodGroup.style.display = 'none';
                    paymentMethodSelect.required = false;
                    paymentMethodSelect.value = '';
                } else {
                    // Hide both
                    productCategoryGroup.style.display = 'none';
                    productCategorySelect.required = false;
                    productCategorySelect.value = '';
                    paymentMethodGroup.style.display = 'none';
                    paymentMethodSelect.required = false;
                    paymentMethodSelect.value = '';
                }
                
                // Update placeholder text based on transaction type
                if (descriptionField) {
                    switch (typeValue) {
                        case 'add':
                            descriptionField.placeholder = 'e.g., Payment for previous purchases, advance payment, etc.';
                            break;
                        case 'subtract':
                            descriptionField.placeholder = 'e.g., Steel rods purchase, Cement bags, etc.';
                            break;
                        case 'return':
                            descriptionField.placeholder = 'e.g., Defective steel rods returned, Wrong cement grade, etc.';
                            break;
                        default:
                            descriptionField.placeholder = 'Enter transaction details...';
                    }
                }
            });
        }
    }

    // Authentication Methods
    setupWelcomeMessage() {
        const welcomeSpan = document.getElementById('welcomeMessage');
        const username = sessionStorage.getItem('username');
        
        if (welcomeSpan && username) {
            welcomeSpan.textContent = `Welcome, ${username}!`;
        }
    }

    logout() {
        if (confirm('Are you sure you want to logout?')) {
            // Clear session storage
            sessionStorage.removeItem('isLoggedIn');
            sessionStorage.removeItem('username');
            
            // Show success message
            ToastManager.showSuccess('Logged out successfully!');
            
            // Redirect to login page after a short delay
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1000);
        }
    }
}
