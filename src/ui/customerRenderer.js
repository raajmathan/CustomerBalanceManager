// Customer UI rendering components
import { FormatUtils } from '../utils/formatUtils.js';

export class CustomerRenderer {
    // Create customer card HTML
    static createCustomerCard(customer) {
        const balanceClass = FormatUtils.getBalanceClass(customer.balance);
        const canDelete = customer.balance === 0;
        const hasIndividualSheet = customer.sheetId ? '📊' : '📋';
        
        return `
            <div class="customer-card fade-in">
                <div class="customer-header">
                    <div class="customer-info">
                        <h3>${FormatUtils.escapeHtml(customer.name)} ${hasIndividualSheet}</h3>
                        <div class="customer-contact">
                            ${customer.phone ? `📞 ${FormatUtils.escapeHtml(customer.phone)}` : ''}
                        </div>
                    </div>
                    <div class="balance-display ${balanceClass}">
                        ${FormatUtils.formatCurrency(customer.balance)}
                    </div>
                </div>
                ${customer.notes ? `<p style="color: #718096; font-size: 14px; margin-bottom: 15px;">${FormatUtils.escapeHtml(customer.notes.split('\n').slice(-1)[0])}</p>` : ''}
                <div class="customer-actions">
                    <button class="btn btn-small btn-edit" onclick="customerManager.openCustomerModal(${FormatUtils.escapeJsonForHtml(customer)})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-small btn-balance" onclick="customerManager.openBalanceModal(${FormatUtils.escapeJsonForHtml(customer)})">
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

    // Create customers table HTML
    static createCustomersTable(customers) {
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
                    ${customers.map(customer => this.createTableRow(customer)).join('')}
                </tbody>
            </table>
        `;
    }

    // Create table row for a customer
    static createTableRow(customer) {
        const canDelete = customer.balance === 0;
        const hasIndividualSheet = customer.sheetId ? '📊' : '📋';
        
        return `
            <tr>
                <td>
                    <strong>${FormatUtils.escapeHtml(customer.name)} ${hasIndividualSheet}</strong>
                    ${customer.notes ? `<br><small style="color: #718096;">${FormatUtils.escapeHtml(customer.notes.split('\n').slice(-1)[0])}</small>` : ''}
                </td>
                <td>
                    ${customer.phone ? `📞 ${FormatUtils.escapeHtml(customer.phone)}` : 'No phone'}
                </td>
                <td>
                    <span class="${FormatUtils.getBalanceClass(customer.balance)}" style="font-weight: 600;">
                        ${FormatUtils.formatCurrency(customer.balance)}
                    </span>
                </td>
                <td>${new Date(customer.lastUpdated).toLocaleDateString()}</td>
                <td>
                    <button class="btn btn-small btn-edit" onclick="customerManager.openCustomerModal(${FormatUtils.escapeJsonForHtml(customer)})" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-small btn-balance" onclick="customerManager.openBalanceModal(${FormatUtils.escapeJsonForHtml(customer)})" title="Update Balance">
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
    }
}
