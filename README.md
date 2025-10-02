# Customer Balance Manager

A comprehensive web-based customer balance management system with Google Sheets integration.

## Features

- **Customer Management**: Add, edit, and delete customers with comprehensive validation
- **Balance Tracking**: Track customer balances with positive (receivable) and negative (payable) amounts
- **Transaction Management**: 
  - Add money (new purchases/services)
  - Subtract money (payments received)
  - Product returns (refunds to customers)
- **Google Sheets Integration**: 
  - Individual customer sheets with transaction history
  - Master sheet with all customer data
  - Real-time synchronization
- **Search & Filter**: Search by name/phone and filter by balance type
- **Responsive Design**: Works on desktop and mobile devices
- **Data Validation**: Comprehensive validation for all inputs
- **Local Storage**: Works offline with local data storage

## Live Demo

🔗 **[Access the Application](https://raajmathanrajavel.github.io/CustomerBalanceManager/)**

## Technologies Used

- **Frontend**: HTML5, CSS3, JavaScript (ES6 modules)
- **APIs**: Google Sheets API v4, Google Drive API
- **Authentication**: OAuth 2.0 with Google Identity Services
- **Storage**: Local Storage + Google Sheets
- **Deployment**: GitHub Pages

## Getting Started

### Online Usage
Simply visit the [live application](https://raajmathanrajavel.github.io/CustomerBalanceManager/) and start managing your customers!

### Local Development
1. Clone the repository
2. Serve the files using a local HTTP server:
   ```bash
   python3 -m http.server 8000
   ```
3. Open `http://localhost:8000` in your browser

## Google Sheets Setup (Optional)

For full functionality with Google Sheets integration:

1. Go to [Google Cloud Console](https://console.developers.google.com)
2. Create a new project or select existing one
3. Enable Google Sheets API and Google Drive API
4. Create OAuth 2.0 credentials
5. Add your domain to authorized origins
6. Configure the application with your credentials

## Usage

1. **Add Customers**: Click "Add Customer" to create new customer records
2. **Update Balances**: Click on any customer to update their balance
3. **Transaction Types**:
   - **Add Money**: For new purchases or services
   - **Subtract Money**: For payments received
   - **Return Product**: For product returns and refunds
4. **Search & Filter**: Use the search bar and filter dropdown to find customers
5. **Google Sheets**: Sign in to enable automatic synchronization

## Features in Detail

### Customer Management
- Name validation with duplicate prevention
- Optional phone number with Indian number validation
- Balance tracking with currency formatting
- Notes and timestamps for all changes

### Transaction System
- Three transaction types for different business scenarios
- Comprehensive amount validation
- Transaction notes and history
- Real-time balance updates

### Google Sheets Integration
- Individual sheets for each customer with transaction history
- Master sheet with all customer summaries
- Automatic sheet creation and deletion
- Bold headers and proper formatting

### Data Security
- Local data storage for offline usage
- OAuth 2.0 for secure Google API access
- Input validation and sanitization
- No sensitive data stored in code

## Browser Compatibility

- Chrome (recommended)
- Firefox
- Safari
- Edge

## License

This project is open source and available under the [MIT License](LICENSE).

## Author

**Raaj Mathan Rajavel**
- Email: raajmathanrajavel@gmail.com
- GitHub: [@raajmathanrajavel](https://github.com/raajmathanrajavel)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
