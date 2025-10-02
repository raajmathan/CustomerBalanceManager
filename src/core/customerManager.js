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
        
        // Initialize Google Sheets service
        this.googleSheetsService = new GoogleSheetsService();
        
        this.init();
    }

    async init() {
        // Initialize UI styles
        ToastManager.initializeStyles();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load data and render
        this.loadFromLocalStorage();
        this.renderCustomers();
        this.updateStats();
        
        // Check OAuth setup
        await this.checkOAuthSetup();
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

    async checkOAuthSetup() {
        // Show the Google Sheets modal to display sign-in interface
        this.showGoogleSheetsModal();
        
        // Since we have the Client ID configured, directly initialize
        if (CONFIG.OAUTH.CLIENT_ID) {
            await this.initializeGoogleAPI();
            return;
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
            ToastManager.showSuccess('Initializing Google API...');
            
            // Load Google API
            await this.googleSheetsService.loadGoogleAPI();
            
            // Initialize OAuth
            const hasToken = await this.googleSheetsService.initializeOAuth(() => {
                this.showSignedInState();
                ToastManager.showSuccess('Successfully signed in to Google!');
                this.syncWithGoogleSheets();
            });
            
            if (hasToken) {
                this.showSignedInState();
                ToastManager.showSuccess('Google Sheets integration enabled with full write access!');
                document.getElementById('uploadToSheetsBtn').style.display = 'inline-flex';
                await this.syncWithGoogleSheets();
            } else {
                ToastManager.showSuccess('Google API initialized. Ready to sign in.');
                this.showSignInButton();
            }
        } catch (error) {
            console.error('Failed to initialize Google API:', error);
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
        if (!this.googleSheetsService.isSignedIn) return;
        
        try {
            this.showLoadingSpinner(true);
            
            const customers = await this.googleSheetsService.syncWithGoogleSheets();
            
            if (customers && customers.length > 0) {
                this.customers = customers;
                this.saveToLocalStorage();
                this.renderCustomers();
                this.updateStats();
                ToastManager.showSuccess(`Synced ${this.customers.length} customers from Google Sheets!`);
            } else {
                await this.googleSheetsService.createSheetHeader();
                if (this.customers.length > 0) {
                    await this.uploadLocalDataToSheets();
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
        
        balanceCustomerName.textContent = customer.name;
        currentBalance.textContent = FormatUtils.formatCurrency(customer.balance);
        currentBalance.className = FormatUtils.getBalanceClass(customer.balance);
        
        balanceForm.reset();
        balanceModal.classList.add('active');
        overlay.classList.add('active');
        
        balanceModal.dataset.customerId = customer.id;
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
        
        // Note validation (optional)
        if (transactionData.note && transactionData.note.trim().length > 200) {
            errors.push('Transaction note must not exceed 200 characters');
        }
        
        return errors;
    }

    async updateBalance(e) {
        e.preventDefault();
        
        const customerId = parseInt(document.getElementById('balanceModal').dataset.customerId);
        const formData = new FormData(e.target);
        const transactionData = {
            transactionType: formData.get('transactionType'),
            amount: formData.get('transactionAmount'),
            note: formData.get('transactionNote').trim()
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
        
        const customer = this.customers.find(c => c.id === customerId);
        if (!customer) {
            ToastManager.showError('Customer not found');
            return;
        }
        
        try {
            this.showLoadingSpinner(true);
            
            const previousBalance = customer.balance;
            
            if (transactionType === 'add') {
                customer.balance += amount;
            } else if (transactionType === 'subtract') {
                customer.balance -= amount;
            } else if (transactionType === 'return') {
                // Product return - subtract from customer balance (refund)
                customer.balance -= amount;
            }
            
            // Round to 2 decimal places to avoid floating point precision issues
            customer.balance = Math.round(customer.balance * 100) / 100;
            
            customer.lastUpdated = DateUtils.getISTDateTime();
            if (note) {
                customer.notes = customer.notes ? 
                    `${customer.notes}\n${DateUtils.getISTDateString()}: ${note}` : 
                    `${DateUtils.getISTDateString()}: ${note}`;
            }
            
            // Update individual customer sheet
            if (customer.sheetId && this.googleSheetsService.isSignedIn) {
                let transactionTypeForSheet, amountForSheet;
                
                if (transactionType === 'add') {
                    transactionTypeForSheet = 'Charge/Purchase';
                    amountForSheet = amount;
                } else if (transactionType === 'subtract') {
                    transactionTypeForSheet = 'Payment Received';
                    amountForSheet = -amount;
                } else if (transactionType === 'return') {
                    transactionTypeForSheet = 'Product Return';
                    amountForSheet = -amount;
                }
                
                await this.googleSheetsService.updateCustomerSheet(customer, {
                    type: transactionTypeForSheet,
                    amount: amountForSheet,
                    note: note
                });
            }
            
            this.saveToLocalStorage();
            await this.googleSheetsService.updateMasterSheet(this.customers);
            this.renderCustomers();
            this.updateStats();
            this.closeBalanceModal();
            
            let action;
            if (transactionType === 'add') {
                action = 'added to';
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

    // UI and Display Methods
    filterCustomers(searchTerm) {
        this.currentSearchTerm = searchTerm.trim();
        this.applyFiltersAndSearch();
    }

    applyFilter(filterType) {
        this.currentFilter = filterType;
        this.applyFiltersAndSearch();
    }

    applyFiltersAndSearch() {
        let filtered = [...this.customers];
        
        // Apply balance filter first
        if (this.currentFilter !== 'all') {
            switch (this.currentFilter) {
                case 'positive':
                    filtered = filtered.filter(c => c.balance > 0);
                    break;
                case 'negative':
                    filtered = filtered.filter(c => c.balance < 0);
                    break;
                case 'zero':
                    filtered = filtered.filter(c => c.balance === 0);
                    break;
            }
        }
        
        // Apply search filter if there's a search term
        if (this.currentSearchTerm) {
            const term = this.currentSearchTerm.toLowerCase();
            filtered = filtered.filter(customer =>
                customer.name.toLowerCase().includes(term) ||
                (customer.phone && customer.phone.includes(term))
            );
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
        
        // Determine which customers to show
        let customersToShow;
        
        // If there's a search term or filter applied, use filtered results
        if (this.currentSearchTerm || this.currentFilter !== 'all') {
            customersToShow = this.filteredCustomers;
        } else {
            // Show all customers when no search or filter is applied
            customersToShow = this.customers;
        }
        
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
}
