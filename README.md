# LeadSender - WhatsApp Campaign Desktop Application

A powerful desktop application for managing WhatsApp campaigns with support for multiple accounts, automated messaging, contact management, and account warm-up.

## Features

### Account Management
- Connect multiple WhatsApp accounts
- QR code authentication
- Proxy support (SOCKS/HTTP with authentication)
- Persistent sessions (accounts stay logged in after app restart)
- Real-time connection status monitoring

### Campaign Management
- Create and manage multiple campaigns
- Send messages to large contact lists
- Configurable delays between messages (min/max)
- Daily message limits per account
- Working hours restrictions
- Round-robin account selection
- Progress tracking and statistics
- Variable substitution (`{{name}}`, `{{phone}}`)

### Inbox Management
- Unified inbox for all connected accounts
- Filter messages by account
- Manual replies
- Mark chats as handled
- Real-time message notifications

### Contact Management
- Import contacts from XLSX/CSV files
- Tag-based organization
- Filter contacts by tags
- Bulk contact management

### Account Warm-up
- Automated conversation between accounts
- Configurable message delays
- Helps prevent account bans
- Multiple account support

### Dashboard
- Real-time statistics
- Connected accounts count
- Messages sent today
- Active campaigns
- Quick actions

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Desktop Framework**: Electron
- **UI Library**: shadcn/ui + Tailwind CSS
- **WhatsApp Integration**: Baileys (multi-device API)
- **Database**: SQLite (better-sqlite3)
- **State Management**: Zustand
- **Forms**: React Hook Form + Zod
- **Icons**: Lucide React

## Installation

### Prerequisites
- Node.js 18 or higher
- npm or yarn

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd leadsender
```

2. Install dependencies:
```bash
npm install
```

3. Run in development mode:
```bash
npm run electron:dev
```

4. Build for production:
```bash
npm run electron:build
```

## Project Structure

```
leadsender/
├── electron/              # Electron main process
│   ├── main.ts           # Main entry point
│   ├── preload.ts        # Preload script
│   ├── ipc.ts            # IPC handlers
│   ├── database/         # Database setup and schema
│   └── services/         # Backend services
│       ├── WhatsAppManager.ts
│       ├── CampaignScheduler.ts
│       ├── WarmUpService.ts
│       └── InboxManager.ts
├── src/                  # React frontend
│   ├── components/       # React components
│   ├── pages/           # Page components
│   ├── lib/             # Utilities
│   └── types/           # TypeScript types
└── package.json
```

## Usage

### Connecting WhatsApp Accounts

1. Navigate to the **Accounts** page
2. Click "Add Account"
3. (Optional) Configure proxy settings
4. Scan the QR code with your WhatsApp mobile app
5. Wait for the connection to establish

### Creating a Campaign

1. Navigate to the **Campaigns** page
2. Click "Create Campaign"
3. Fill in campaign details:
   - Campaign name
   - Message content (use `{{name}}` and `{{phone}}` for personalization)
   - Select participating accounts
   - Configure delays and limits
   - Set working hours
   - Select contact tags
4. Click "Create Campaign"
5. Click "Start" to begin sending

### Importing Contacts

1. Navigate to the **Contacts** page
2. Click "Import"
3. Select a CSV or XLSX file
4. File should have columns: `phone_number` (required), `name` (optional)
5. Contacts will be imported automatically

### Starting Account Warm-up

1. Navigate to the **Warm-up** page
2. Select at least 2 connected accounts
3. Configure min/max delay between messages
4. Click "Start Warm-up Session"
5. Accounts will send automated messages to each other

## Database Schema

The application uses SQLite with the following main tables:
- `accounts` - WhatsApp account information
- `campaigns` - Campaign configurations
- `campaign_contacts` - Contacts for each campaign
- `contacts` - Master contact list
- `tags` - Contact tags for organization
- `messages` - Message history
- `warmup_sessions` - Warm-up session configurations

## Configuration

### Proxy Settings
- SOCKS5 proxies with authentication are supported
- Configure per account in the Add Account dialog
- Format: `host:port` with optional username/password

### Working Hours
- Configure start and end hours (0-23) for campaigns
- Messages will only be sent during these hours
- Campaigns pause outside working hours and resume automatically

### Rate Limits
- Set maximum messages per day per account
- Prevents accounts from being flagged for spam
- Counter resets at midnight

## Development

### Adding New Features

1. Backend services go in `electron/services/`
2. IPC handlers go in `electron/ipc.ts`
3. UI components go in `src/components/`
4. Pages go in `src/pages/`

### Building

```bash
# Development mode
npm run electron:dev

# Build for production
npm run electron:build
```

## Troubleshooting

### WhatsApp Connection Issues
- Ensure your phone has internet connection
- Make sure WhatsApp is up to date
- Try removing and re-adding the account

### Messages Not Sending
- Check account connection status
- Verify you're within working hours
- Ensure you haven't hit daily message limits
- Check campaign status is "running"

### Database Issues
- Database is stored in user data directory
- On Windows: `C:\Users\<username>\AppData\Roaming\leadsender\`
- Delete `leadsender.db` to reset (will lose all data)

## License

MIT License - see LICENSE file for details

## Support

For issues and questions, please open an issue on the GitHub repository.
