require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const path = require('path');
const mongoose = require('mongoose');

// Import routes
const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const monitoringRoutes = require('./routes/monitoring');
const cameraRoutes = require('./routes/camera');
const permissionRoutes = require('./routes/permissions');
const dashboardRoutes = require('./routes/dashboard');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const sessionManager = require('./services/sessionManager');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST']
  }
});

// Database connection
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // We'll set custom CSP
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// CORS
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true
}));

// Body parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Compression
app.use(compression());

// Data sanitization against NoSQL injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Prevent HTTP parameter pollution
app.use(hpp());

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// Socket.io setup for real-time monitoring
global.io = io;
io.on('connection', (socket) => {
  console.log('📡 Client connected:', socket.id);
  
  socket.on('join-session', (data) => {
    if (data && data.sessionId) {
      socket.join(`session-${data.sessionId}`);
      sessionManager.trackConnection(data.sessionId, socket.id);
    }
  });
  
  socket.on('join-dashboard', (data) => {
    if (data && data.userId) {
      socket.join(`dashboard-${data.userId}`);
    }
  });
  
  socket.on('heartbeat', (data) => {
    if (data && data.sessionId) {
      sessionManager.updateHeartbeat(data.sessionId, data);
    }
  });
  
  socket.on('violation', (data) => {
    if (data) {
      sessionManager.handleViolation(data);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('📴 Client disconnected:', socket.id);
    sessionManager.handleDisconnect(socket.id);
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/camera', cameraRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Serve HTML pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

app.get('/viewer/:documentId', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/viewer.html'));
});

// Public viewer route (share link)
app.get('/view/:token', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/view-document.html'));
});

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║         🔒 SECURE DOCUMENT VIEWER PLATFORM 🔒            ║
║                                                           ║
║  Server running on: http://localhost:${PORT}              ║
║  Environment: ${process.env.NODE_ENV || 'development'}                        ║
║                                                           ║
║  Features Active:                                        ║
║  ✅ Screen Recording Detection                           ║
║  ✅ Camera Verification                                  ║
║  ✅ Dynamic Watermarking                                 ║
║  ✅ Real-time Monitoring                                 ║
║  ✅ AI Detection Systems                                 ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

module.exports = { app, server, io };
