require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const { MongoClient } = require('mongodb');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS configuration
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || ["http://localhost:5173", "http://localhost:8888", "https://greenur-webapp.netlify.app"],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Global variables
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGODB_DB || 'master';

let mongoClient = null;
let db = null;

// Middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(compression());
app.use(morgan('combined'));
app.use(cors({
  origin: process.env.FRONTEND_URL || ["http://localhost:5173", "http://localhost:8888", "https://greenur-webapp.netlify.app"],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
async function connectToMongoDB() {
  try {
    if (!MONGO_URI) {
      throw new Error('MONGO_URI environment variable is not defined');
    }
    
    mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    db = mongoClient.db(DB_NAME);
    console.log('✅ Connected to MongoDB');
    
    // Test the connection
    await db.admin().ping();
    console.log('✅ MongoDB ping successful');
    
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);
  
  // Handle user authentication and room joining
  socket.on('authenticate', async (data) => {
    try {
      const { userId, userEmail } = data;
      
      if (!userId) {
        socket.emit('auth_error', { message: 'User ID is required' });
        return;
      }
      
      // Store user info in socket
      socket.userId = userId;
      socket.userEmail = userEmail;
      
      // Join user-specific room
      socket.join(`user_${userId}`);
      
      console.log(`✅ User authenticated: ${userEmail} (${userId})`);
      socket.emit('authenticated', { message: 'Successfully authenticated' });
      
      // Send initial data if needed
      await sendUserDeviceStatuses(socket);
      
    } catch (error) {
      console.error('Authentication error:', error);
      socket.emit('auth_error', { message: 'Authentication failed' });
    }
  });
  
  // Handle device data subscription
  socket.on('subscribe_device', (data) => {
    try {
      const { deviceId } = data;
      
      if (!deviceId) {
        socket.emit('subscription_error', { message: 'Device ID is required' });
        return;
      }
      
      // Join device-specific room
      socket.join(`device_${deviceId}`);
      console.log(`📱 User ${socket.userId} subscribed to device: ${deviceId}`);
      
      socket.emit('device_subscribed', { deviceId, message: 'Subscribed to device updates' });
      
    } catch (error) {
      console.error('Device subscription error:', error);
      socket.emit('subscription_error', { message: 'Failed to subscribe to device' });
    }
  });
  
  // Handle device data unsubscription
  socket.on('unsubscribe_device', (data) => {
    try {
      const { deviceId } = data;
      
      if (!deviceId) {
        return;
      }
      
      // Leave device-specific room
      socket.leave(`device_${deviceId}`);
      console.log(`📱 User ${socket.userId} unsubscribed from device: ${deviceId}`);
      
      socket.emit('device_unsubscribed', { deviceId, message: 'Unsubscribed from device updates' });
      
    } catch (error) {
      console.error('Device unsubscription error:', error);
    }
  });
  
  // Handle manual device status check
  socket.on('check_device_status', async (data) => {
    try {
      const { deviceId } = data;
      
      if (!deviceId || !socket.userId) {
        socket.emit('device_status_error', { message: 'Device ID and authentication required' });
        return;
      }
      
      const deviceStatus = await getDeviceStatus(deviceId, socket.userId);
      socket.emit('device_status_update', deviceStatus);
      
    } catch (error) {
      console.error('Device status check error:', error);
      socket.emit('device_status_error', { message: 'Failed to check device status' });
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`🔌 User disconnected: ${socket.id} (${socket.userEmail || 'Unknown'})`);
  });
  
  // Handle errors
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// Helper functions
async function sendUserDeviceStatuses(socket) {
  try {
    if (!socket.userId || !db) return;
    
    // Get user's devices
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ uid: socket.userId });
    
    if (!user || !user.pulseDevices || user.pulseDevices.length === 0) {
      return;
    }
    
    // Get status for each device
    const deviceStatuses = [];
    for (const device of user.pulseDevices) {
      const status = await getDeviceStatus(device.deviceId, socket.userId);
      deviceStatuses.push(status);
    }
    
    socket.emit('initial_device_statuses', deviceStatuses);
    
  } catch (error) {
    console.error('Error sending user device statuses:', error);
  }
}

async function getDeviceStatus(deviceId, userId) {
  try {
    if (!db) {
      throw new Error('Database not connected');
    }
    
    const pulseDataCollection = db.collection('pulseData');
    
    // Get the most recent data point for this device
    const latestData = await pulseDataCollection
      .findOne(
        { deviceId, userId },
        { sort: { timestamp: -1 } }
      );
    
    if (!latestData) {
      return {
        deviceId,
        isOnline: false,
        lastSeen: null,
        status: 'offline',
        message: 'No data received'
      };
    }
    
    // Check if device is online (last data within 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const isOnline = latestData.timestamp > fiveMinutesAgo;
    
    return {
      deviceId,
      isOnline,
      lastSeen: latestData.timestamp,
      status: isOnline ? 'online' : 'offline',
      message: isOnline ? 'Device is online' : 'Device appears to be offline',
      latestData: {
        soilMoisture: latestData.soilMoisture,
        temperature: latestData.temperature,
        humidity: latestData.humidity,
        lightLevel: latestData.lightLevel,
        isWaterOn: latestData.isWaterOn
      }
    };
    
  } catch (error) {
    console.error('Error getting device status:', error);
    return {
      deviceId,
      isOnline: false,
      lastSeen: null,
      status: 'error',
      message: 'Error checking device status'
    };
  }
}

// REST API Routes
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: db ? 'connected' : 'disconnected',
    socketConnections: io.engine.clientsCount
  });
});

app.get('/api/socket-info', (req, res) => {
  res.json({
    socketUrl: `${req.protocol}://${req.get('host')}`,
    connectedClients: io.engine.clientsCount,
    rooms: Array.from(io.sockets.adapter.rooms.keys()),
    transports: ['websocket', 'polling']
  });
});

// Endpoint to broadcast device data updates (called by ESP32 or data ingestion)
app.post('/api/broadcast/device-data', async (req, res) => {
  try {
    const { deviceId, userId, data } = req.body;
    
    if (!deviceId || !data) {
      return res.status(400).json({ error: 'Device ID and data are required' });
    }
    
    // Broadcast to device subscribers
    io.to(`device_${deviceId}`).emit('device_data_update', {
      deviceId,
      timestamp: new Date(),
      data
    });
    
    // If userId is provided, also broadcast device status
    if (userId) {
      const deviceStatus = await getDeviceStatus(deviceId, userId);
      io.to(`user_${userId}`).emit('device_status_update', deviceStatus);
    }
    
    console.log(`📡 Broadcasted data update for device: ${deviceId}`);
    
    res.json({ 
      success: true, 
      message: 'Data broadcasted successfully',
      broadcastedTo: [`device_${deviceId}`, userId ? `user_${userId}` : null].filter(Boolean)
    });
    
  } catch (error) {
    console.error('Broadcast error:', error);
    res.status(500).json({ error: 'Failed to broadcast data' });
  }
});

// Endpoint to broadcast device status updates
app.post('/api/broadcast/device-status', async (req, res) => {
  try {
    const { deviceId, userId, status } = req.body;
    
    if (!deviceId || !status) {
      return res.status(400).json({ error: 'Device ID and status are required' });
    }
    
    // Broadcast to device subscribers
    io.to(`device_${deviceId}`).emit('device_status_update', {
      deviceId,
      ...status,
      timestamp: new Date()
    });
    
    // If userId is provided, also broadcast to user
    if (userId) {
      io.to(`user_${userId}`).emit('device_status_update', {
        deviceId,
        ...status,
        timestamp: new Date()
      });
    }
    
    console.log(`📡 Broadcasted status update for device: ${deviceId}`);
    
    res.json({ 
      success: true, 
      message: 'Status broadcasted successfully',
      broadcastedTo: [`device_${deviceId}`, userId ? `user_${userId}` : null].filter(Boolean)
    });
    
  } catch (error) {
    console.error('Status broadcast error:', error);
    res.status(500).json({ error: 'Failed to broadcast status' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🔄 SIGTERM received, shutting down gracefully...');
  
  // Close Socket.IO connections
  io.close(() => {
    console.log('✅ Socket.IO connections closed');
  });
  
  // Close MongoDB connection
  if (mongoClient) {
    await mongoClient.close();
    console.log('✅ MongoDB connection closed');
  }
  
  // Close HTTP server
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('🔄 SIGINT received, shutting down gracefully...');
  
  // Close Socket.IO connections
  io.close(() => {
    console.log('✅ Socket.IO connections closed');
  });
  
  // Close MongoDB connection
  if (mongoClient) {
    await mongoClient.close();
    console.log('✅ MongoDB connection closed');
  }
  
  // Close HTTP server
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
});

// Start server
async function startServer() {
  try {
    // Connect to MongoDB first
    await connectToMongoDB();
    
    // Start the server
    server.listen(PORT, '0.0.0.0', () => {
      console.log('\n🚀 Greenur Backend Server Started!');
      console.log(`📡 Server running on port ${PORT}`);
      console.log(`🌐 Health check: http://localhost:${PORT}/health`);
      console.log(`🔌 Socket.IO endpoint: http://localhost:${PORT}`);
      console.log(`📊 Socket info: http://localhost:${PORT}/api/socket-info`);
      console.log('💚 Ready to accept WebSocket connections!\n');
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer(); 