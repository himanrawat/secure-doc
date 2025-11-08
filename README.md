# 🔒 Secure Document Viewer Platform

A comprehensive document viewing platform with military-grade security controls, camera-based verification, AI-powered monitoring, and real-time violation tracking.

## 🎯 Features

### 🔴 Category 1: Critical MVP Features
- ✅ Screen recording detection and prevention
- ✅ Screenshot blocking and monitoring
- ✅ Screen sharing detection
- ✅ Focus loss blur + Alt-Tab black overlay
- ✅ Developer tools detection and auto-closure
- ✅ Mandatory camera verification
- ✅ Obstruction/tape detection
- ✅ External camera/phone detection (AI)
- ✅ Continuous face match verification
- ✅ Dynamic visible watermarking
- ✅ Text selection and copy prevention
- ✅ Download/print/save blocking
- ✅ Permission-based access control
- ✅ AES-256 encryption
- ✅ Remote kill switch
- ✅ Real-time activity logging
- ✅ Violation notifications

### 🟡 Category 2: High Priority Features
- ✅ View count limits and expiration rules
- ✅ Device and IP whitelisting
- ✅ Concurrent session blocking
- ✅ Multi-monitor detection
- ✅ Invisible forensic watermarking
- ✅ Screenshot attempt logging with evidence
- ✅ Complete audit trail
- ✅ DDoS protection and rate limiting
- ✅ Violation warning system
- ✅ Security status indicator

### 🟢 Category 3: AI + Analytics Layer
- ✅ Liveness detection (blink/movement)
- ✅ Eye tracking and attention monitoring
- ✅ Multiple person detection
- ✅ Environment change alerts
- ✅ User behavior analytics
- ✅ Attention heatmap visualization
- ✅ Cryptographic integrity verification

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- MongoDB 6+
- Modern browser with camera support

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/secure-doc-viewer.git
cd secure-doc-viewer

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your configuration
nano .env

# Start MongoDB (if local)
mongod

# Run the application
npm run dev
```

The server will start at `http://localhost:3000`

## 📁 Project Structure

```
secure-doc-viewer/
├── server/
│   ├── index.js                 # Main server entry
│   ├── config/                  # Configuration files
│   ├── models/                  # Database models
│   ├── routes/                  # API routes
│   ├── controllers/             # Business logic
│   ├── middleware/              # Auth, security middleware
│   ├── services/                # Core services
│   └── utils/                   # Utility functions
├── public/
│   ├── index.html               # Landing page
│   ├── dashboard.html           # Owner dashboard
│   ├── viewer.html              # Secure document viewer
│   ├── css/                     # Stylesheets
│   └── js/                      # Client-side JavaScript
│       ├── security/            # Security modules
│       ├── camera/              # Camera verification
│       ├── ai/                  # AI detection systems
│       ├── monitoring/          # Activity tracking
│       └── utils/               # Helper functions
├── uploads/                     # Encrypted documents
├── logs/                        # Application logs
├── .env                         # Environment variables
└── package.json                 # Dependencies
```

## 🔐 Security Architecture

### Encryption
- **At-Rest**: AES-256-GCM encryption for stored documents
- **In-Transit**: TLS 1.3 for all communications
- **Zero-Knowledge**: Server never accesses plaintext content

### Camera Verification
1. Mandatory camera access before document opens
2. Initial face capture for identity verification
3. Continuous monitoring (5-second intervals)
4. Obstruction detection (black frame analysis)
5. External camera detection (AI object detection)
6. Face matching throughout session

### Screen Security
- Real-time screen recording detection
- Screenshot attempt blocking
- Screen sharing detection
- Focus loss handling (blur + black overlay)
- DevTools detection and auto-closure
- Multi-monitor blocking (optional)

### Content Protection
- Canvas-based dynamic watermarking
- CSS pointer-events blocking
- Text selection prevention
- Right-click context menu blocking
- Print/download interception
- DOM integrity validation

## 📊 Permission Model

```json
{
  "documentId": "uuid",
  "ownerId": "uuid",
  "permissions": {
    "maxViews": 3,
    "expiryDate": "2025-12-31T23:59:59Z",
    "allowedDevices": ["fingerprint_1", "fingerprint_2"],
    "allowedIPs": ["192.168.1.1"],
    "securityLevel": "HIGH",
    "allowScreenshot": false,
    "allowPrint": false,
    "allowCopy": false,
    "requireCamera": true,
    "blockMultipleMonitors": true,
    "blockConcurrentSessions": true
  },
  "logs": [],
  "violations": []
}
```

## 🎮 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout

### Documents
- `POST /api/documents/upload` - Upload encrypted document
- `GET /api/documents/:id` - Get document metadata
- `GET /api/documents/:id/view` - Access document viewer
- `DELETE /api/documents/:id` - Delete document
- `POST /api/documents/:id/revoke` - Remote kill switch

### Permissions
- `PUT /api/documents/:id/permissions` - Update permissions
- `GET /api/documents/:id/permissions` - Get current permissions

### Monitoring
- `GET /api/documents/:id/logs` - Get activity logs
- `GET /api/documents/:id/violations` - Get violations
- `GET /api/dashboard/live-sessions` - Get active sessions
- `POST /api/monitoring/heartbeat` - Session heartbeat
- `POST /api/monitoring/violation` - Report violation

### Camera Verification
- `POST /api/camera/verify` - Initial camera verification
- `POST /api/camera/validate` - Continuous validation

## 🔔 Webhook Notifications

Configure webhook URL in `.env` to receive real-time notifications:

```json
{
  "event": "violation_detected",
  "documentId": "uuid",
  "userId": "uuid",
  "violationType": "screenshot_attempt",
  "timestamp": "2025-11-08T10:30:00Z",
  "evidence": {
    "screenshot": "base64_image",
    "cameraSnapshot": "base64_image"
  }
}
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --testPathPattern=security

# Run with coverage
npm test -- --coverage
```

## 🚢 Deployment

### Production Checklist
- [ ] Change all default secrets in `.env`
- [ ] Set `NODE_ENV=production`
- [ ] Enable HTTPS with valid SSL certificate
- [ ] Configure MongoDB with authentication
- [ ] Set up email service (SendGrid/AWS SES)
- [ ] Configure webhook endpoint
- [ ] Enable rate limiting
- [ ] Set up log rotation
- [ ] Configure firewall rules
- [ ] Enable DDoS protection
- [ ] Set up automated backups

### Docker Deployment

```bash
# Build image
docker build -t secure-doc-viewer .

# Run container
docker run -p 3000:3000 --env-file .env secure-doc-viewer
```

## 📈 Monitoring Dashboard

Access the owner dashboard at `/dashboard.html` to:
- View live active sessions
- Monitor real-time violations
- Review activity logs
- Analyze user behavior
- Export audit trails
- Manage permissions
- Execute remote kill switch

## 🛡️ Security Levels

### LOW
- Basic watermarking
- Copy/download blocking
- Activity logging

### MEDIUM
- + Screenshot detection
- + Camera verification
- + Focus loss blur

### HIGH
- + Continuous face matching
- + External camera detection
- + DevTools blocking
- + Screen sharing detection

### MAXIMUM
- + Multi-monitor blocking
- + Concurrent session blocking
- + Liveness detection
- + Eye tracking
- + Environment monitoring
- + Forensic watermarking

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first.

## 📄 License

MIT License - see LICENSE file for details

## ⚠️ Disclaimer

This platform provides strong security controls but cannot guarantee 100% protection against all bypass methods. Use appropriate legal agreements and NDAs in conjunction with technical controls.

## 📞 Support

For issues, questions, or feature requests, please open a GitHub issue.
