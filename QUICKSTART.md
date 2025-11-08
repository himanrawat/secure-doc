# 🚀 Quick Start Guide

## Prerequisites

- Node.js 18+ installed
- MongoDB 6+ running (local or Atlas)
- Modern browser (Chrome, Firefox, Edge, Safari)

## Installation (5 Minutes)

### 1. Install Dependencies

```bash
cd c:\work\secure-doc
npm install
```

### 2. Configure Environment

```bash
# Copy the example environment file
copy .env.example .env

# Edit .env with your settings
notepad .env
```

**Required Configuration:**

```env
# Server
NODE_ENV=development
PORT=3000

# Database
MONGODB_URI=mongodb://localhost:27017/securedoc
# Or MongoDB Atlas: mongodb+srv://user:pass@cluster.mongodb.net/securedoc

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Encryption (Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
ENCRYPTION_MASTER_KEY=<your-generated-key>

# Session Configuration
SESSION_TIMEOUT_MS=1800000
HEARTBEAT_INTERVAL_MS=5000
```

**Optional Configuration:**

```env
# Email Notifications (Optional - for violation alerts)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-specific-password
EMAIL_FROM=noreply@securedoc.com

# Webhook Notifications (Optional)
WEBHOOK_TIMEOUT_MS=5000
```

### 3. Start MongoDB

**Option A: Local MongoDB**
```bash
# Windows (if installed as service)
net start MongoDB

# Or run manually
mongod --dbpath C:\data\db
```

**Option B: MongoDB Atlas** (Recommended)
- Create free cluster at https://cloud.mongodb.com
- Get connection string
- Add to .env as MONGODB_URI

### 4. Start the Server

```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

You should see:
```
🚀 Server running on port 3000
✅ MongoDB connected successfully
🔌 Socket.IO initialized
```

### 5. Access the Platform

Open your browser and navigate to:

- **Landing Page**: http://localhost:3000/
- **Register**: http://localhost:3000/register.html
- **Login**: http://localhost:3000/login.html
- **Dashboard**: http://localhost:3000/dashboard.html

---

## First-Time Setup

### 1. Create Your Account

1. Go to http://localhost:3000/register.html
2. Enter your details:
   - Full Name
   - Email Address
   - Password (min 8 characters)
3. Click "Register"
4. You'll be automatically logged in and redirected to the dashboard

### 2. Upload Your First Document

1. In the dashboard, click **"Upload"** in the sidebar
2. Drag & drop a file or click "Browse Files"
   - Supported formats: PDF, DOCX, TXT, PNG, JPG
   - Max size: 100MB
3. Configure security settings:
   - **Title**: Give your document a name
   - **Security Level**: Choose LOW, MEDIUM, HIGH, or MAXIMUM
   - **Access Limits**: Set max views or expiry date (optional)
   - **Features**: Enable/disable screenshot blocking, printing, camera verification
4. Configure watermark (optional):
   - Enable watermark checkbox
   - Set text, position, and opacity
5. Click "Upload Document"

### 3. Share Your Document

1. Go to **"Documents"** section
2. Find your uploaded document
3. Click the **🔗 Share** button
4. Enter the recipient's email address
5. They'll be granted access

### 4. Monitor Access

1. Go to **"Live Sessions"** section
2. See real-time viewing sessions
3. Monitor violations
4. Use **🚫 Terminate** button if needed (kill switch)

---

## Testing the Security Features

### Test Camera Verification

1. Upload a document with **"Require Camera Verification"** enabled
2. Set security level to **MAXIMUM**
3. View the document
4. You'll be prompted for camera access
5. Position your face in the frame
6. Click "Start Verification"
7. Once verified, the camera feed will appear in bottom-right corner
8. Try covering your face → Violation detected!

### Test Screenshot Detection

1. View any document
2. Try pressing:
   - **Windows**: PrintScreen, Win+Shift+S
   - **Mac**: Cmd+Shift+3, Cmd+Shift+4
   - **Linux**: Print key
3. Violation warning will appear!

### Test DevTools Detection

1. View a document with security level **MEDIUM** or higher
2. Open DevTools (F12 or Ctrl+Shift+I)
3. Session will auto-terminate after 3 seconds!

### Test Copy/Paste Blocking

1. View any document
2. Try to select text → Selection prevented
3. Try Ctrl+C → Blocked
4. Try right-click → Context menu blocked

### Test Remote Kill Switch

1. Open a document in one browser
2. In another browser, go to dashboard → Documents
3. Click **🚫 Revoke** on that document
4. First browser's session will terminate immediately!

---

## Project Structure Overview

```
secure-doc/
├── server/              # Backend Express.js API
│   ├── models/          # MongoDB schemas (Document, User, Session)
│   ├── routes/          # API endpoints (6 route files)
│   ├── services/        # Business logic (encryption, notifications, session management)
│   └── middleware/      # Authentication & error handling
│
├── public/              # Frontend static files
│   ├── *.html           # UI pages (index, login, register, viewer, dashboard)
│   ├── css/             # Stylesheets (main, auth, viewer, dashboard)
│   └── js/
│       ├── security/    # 13 security detector modules
│       ├── camera/      # Face-api.js camera monitoring
│       └── utils/       # Watermarking & device fingerprinting
│
├── uploads/             # Encrypted document storage (created automatically)
├── package.json         # Dependencies & scripts
├── .env                 # Environment configuration (create from .env.example)
└── README.md            # Full documentation
```

---

## Common Issues & Solutions

### ❌ "MongoDB connection failed"

**Solution:**
```bash
# Check if MongoDB is running
# Windows:
tasklist | findstr mongod

# If not running, start it:
net start MongoDB
```

Or use MongoDB Atlas (cloud) instead.

### ❌ "JWT_SECRET is not defined"

**Solution:**
```bash
# Make sure .env file exists and has JWT_SECRET
# Check file location: c:\work\secure-doc\.env
```

### ❌ "Cannot find module 'express'"

**Solution:**
```bash
# Reinstall dependencies
npm install
```

### ❌ Camera not working in viewer

**Solution:**
- Allow camera permission in browser
- Use HTTPS in production (camera requires secure context)
- Check browser compatibility (Chrome, Firefox, Edge, Safari 12+)

### ❌ Face-api.js models not loading

**Solution:**
- Check internet connection (models loaded from CDN)
- Wait a few seconds for models to download
- Open DevTools → Network tab to see model loading status

### ❌ Port 3000 already in use

**Solution:**
```bash
# Change PORT in .env file
PORT=3001
```

Or kill the process using port 3000:
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <process-id> /F
```

---

## Next Steps

### 1. Production Deployment

See `IMPLEMENTATION.md` for detailed production deployment guide:
- HTTPS/TLS setup
- Environment variable configuration
- MongoDB Atlas setup
- Process manager (PM2)
- Domain configuration

### 2. Advanced Features

Explore the platform capabilities:
- **4 Security Levels**: LOW → MEDIUM → HIGH → MAXIMUM
- **Watermarking**: 4 position options (diagonal, center, corners, floating)
- **Access Control**: Email/device/IP whitelisting, max views, expiry dates
- **Analytics**: Session duration, violation breakdown, top documents
- **Audit Trail**: Full activity log export for compliance

### 3. API Integration

Use the REST API for custom integrations:
- Programmatic document upload
- Automated permission management
- Webhook notifications for events
- Real-time monitoring via Socket.IO

See `IMPLEMENTATION.md` → "API Endpoints" section for full API documentation.

---

## Support

### Documentation Files

- `README.md` - Original comprehensive documentation
- `IMPLEMENTATION.md` - Complete implementation details & deployment guide
- `QUICKSTART.md` - This file (getting started)

### Logs

Check console output for errors:
```bash
# Server logs show:
# - MongoDB connection status
# - API requests
# - Socket.IO connections
# - Violation events
```

### Testing

```bash
# Run in development mode for detailed logs
npm run dev
```

---

## 🎉 You're Ready!

The secure document platform is now running. Here's what you can do:

1. ✅ Upload sensitive documents
2. ✅ Configure security settings (4 levels)
3. ✅ Add watermarks (visible + forensic)
4. ✅ Share with specific users
5. ✅ Monitor live viewing sessions
6. ✅ Track security violations
7. ✅ Revoke access instantly (kill switch)
8. ✅ Export audit trails

**Platform Status: 🟢 Production Ready**

All Category 1, 2, and 3 features implemented and functional!

---

## Quick Command Reference

```bash
# Install
npm install

# Start (development)
npm run dev

# Start (production)
npm start

# MongoDB (local)
net start MongoDB

# Generate encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Check running services
netstat -ano | findstr :3000

# View logs (if using PM2)
pm2 logs
```

Happy securing! 🔒
