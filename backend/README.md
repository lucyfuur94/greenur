# Greenur Backend Server

A real-time backend server built with Express.js and Socket.IO for the Greenur plant monitoring system. This server handles WebSocket connections for real-time device status updates and data broadcasting.

## 🚀 Features

- **Real-time WebSocket communication** using Socket.IO
- **Device status monitoring** with live updates
- **User authentication** and room-based subscriptions
- **MongoDB integration** for data persistence
- **RESTful API endpoints** for health checks and broadcasting
- **Graceful shutdown** handling
- **CORS configuration** for frontend integration
- **Production-ready** with security middleware

## 🛠️ Tech Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Socket.IO** - WebSocket library
- **MongoDB** - Database
- **Helmet** - Security middleware
- **Compression** - Response compression
- **Morgan** - HTTP request logger

## 📋 Prerequisites

- Node.js 18.0.0 or higher
- MongoDB database
- Render account (for deployment)

## 🔧 Installation & Setup

### 1. Local Development

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Copy environment file and configure
cp env.example .env
# Edit .env with your actual values

# Start development server
npm run dev
```

### 2. Environment Variables

Create a `.env` file in the backend directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Frontend URLs (for CORS)
FRONTEND_URL=https://greenur-webapp.netlify.app,http://localhost:5173,http://localhost:8888

# MongoDB Configuration
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/
MONGODB_DB=master

# Optional: Firebase Admin
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=your-firebase-service-account-email
FIREBASE_PRIVATE_KEY=your-firebase-private-key
```

## 🌐 Deployment to Render

### 1. Create Render Web Service

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `greenur-backend`
   - **Region**: Choose closest to your users
   - **Branch**: `main` (or your preferred branch)
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

### 2. Environment Variables in Render

Add these environment variables in Render dashboard:

```
PORT=10000
NODE_ENV=production
FRONTEND_URL=https://greenur-webapp.netlify.app
MONGO_URI=your-mongodb-connection-string
MONGODB_DB=master
```

### 3. Deploy

- Push your code to the connected repository
- Render will automatically build and deploy
- Your backend will be available at: `https://your-service-name.onrender.com`

## 📡 API Endpoints

### Health Check
```
GET /health
```
Returns server status and connection info.

### Socket Info
```
GET /api/socket-info
```
Returns Socket.IO connection information.

### Broadcast Device Data
```
POST /api/broadcast/device-data
Content-Type: application/json

{
  "deviceId": "ESP32-FC3FFF000",
  "userId": "user-firebase-uid",
  "data": {
    "soilMoisture": 45,
    "temperature": 24.5,
    "humidity": 60,
    "lightLevel": 75,
    "isWaterOn": false
  }
}
```

### Broadcast Device Status
```
POST /api/broadcast/device-status
Content-Type: application/json

{
  "deviceId": "ESP32-FC3FFF000",
  "userId": "user-firebase-uid",
  "status": {
    "isOnline": true,
    "lastSeen": "2024-01-15T10:30:00.000Z",
    "message": "Device is online"
  }
}
```

## 🔌 Socket.IO Events

### Client to Server Events

#### Authentication
```javascript
socket.emit('authenticate', {
  userId: 'firebase-user-id',
  userEmail: 'user@example.com'
});
```

#### Subscribe to Device
```javascript
socket.emit('subscribe_device', {
  deviceId: 'ESP32-FC3FFF000'
});
```

#### Unsubscribe from Device
```javascript
socket.emit('unsubscribe_device', {
  deviceId: 'ESP32-FC3FFF000'
});
```

#### Check Device Status
```javascript
socket.emit('check_device_status', {
  deviceId: 'ESP32-FC3FFF000'
});
```

### Server to Client Events

#### Authentication Success
```javascript
socket.on('authenticated', (data) => {
  console.log('Authenticated:', data.message);
});
```

#### Device Data Update
```javascript
socket.on('device_data_update', (data) => {
  console.log('New device data:', data);
});
```

#### Device Status Update
```javascript
socket.on('device_status_update', (status) => {
  console.log('Device status:', status);
});
```

#### Initial Device Statuses
```javascript
socket.on('initial_device_statuses', (statuses) => {
  console.log('User devices status:', statuses);
});
```

## 🧪 Testing

### Test Health Endpoint
```bash
curl https://your-backend-url.onrender.com/health
```

### Test Socket.IO Connection
```bash
curl https://your-backend-url.onrender.com/api/socket-info
```

## 🔧 Frontend Integration

Add Socket.IO client to your frontend:

```bash
npm install socket.io-client
```

Example frontend integration:

```javascript
import io from 'socket.io-client';

const socket = io('https://your-backend-url.onrender.com');

// Authenticate
socket.emit('authenticate', {
  userId: currentUser.uid,
  userEmail: currentUser.email
});

// Listen for device updates
socket.on('device_status_update', (status) => {
  updateDeviceStatus(status);
});

// Subscribe to device
socket.emit('subscribe_device', {
  deviceId: 'ESP32-FC3FFF000'
});
```

## 📊 Monitoring

### Logs
- Check Render dashboard for application logs
- Use `console.log` statements in your code for debugging

### Health Monitoring
- Use the `/health` endpoint for monitoring
- Set up uptime monitoring (UptimeRobot, Pingdom, etc.)

### Performance
- Monitor Socket.IO connection count via `/api/socket-info`
- Check MongoDB connection status in health endpoint

## 🔒 Security Features

- **Helmet.js** - Sets security headers
- **CORS** - Configured for your frontend domains
- **Input validation** - Validates Socket.IO events
- **Graceful shutdown** - Properly closes connections
- **Error handling** - Catches and logs errors

## 🚨 Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure `FRONTEND_URL` includes your frontend domain
   - Check browser network tab for exact error

2. **MongoDB Connection Failed**
   - Verify `MONGO_URI` is correct
   - Check MongoDB Atlas whitelist
   - Ensure database user has proper permissions

3. **Socket.IO Connection Issues**
   - Check if Render service is running
   - Verify WebSocket support (should work on Render)
   - Test with Socket.IO client debugging enabled

4. **Environment Variables**
   - Ensure all required env vars are set in Render
   - Check for typos in variable names

### Debug Mode

Enable Socket.IO debugging in frontend:
```javascript
localStorage.debug = 'socket.io-client:socket';
```

## 📝 Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run build` - No build step (Node.js server)

## 📦 Dependencies

### Production
- `express` - Web framework
- `socket.io` - WebSocket library
- `cors` - CORS middleware
- `dotenv` - Environment variables
- `mongodb` - MongoDB driver
- `helmet` - Security middleware
- `compression` - Response compression
- `morgan` - HTTP logger

### Development
- `nodemon` - Development server restart

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details 