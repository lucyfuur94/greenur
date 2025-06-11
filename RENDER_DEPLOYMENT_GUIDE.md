# Greenur Backend Deployment Guide - Render Setup

This guide will walk you through deploying your Greenur backend with Socket.IO to Render for real-time WebSocket functionality.

## 📋 Prerequisites

- GitHub repository with your backend code
- Render account (free tier available)
- MongoDB database (MongoDB Atlas recommended)
- Your frontend deployed on Netlify

## 🚀 Step 1: Prepare Your Repository

### 1.1 Commit Backend Files

Make sure your `backend/` directory is committed to your repository:

```bash
git add backend/
git commit -m "Add Render backend with Socket.IO support"
git push origin main
```

### 1.2 Repository Structure

Your repository should look like this:

```
greenur-webapp/
├── backend/
│   ├── package.json
│   ├── server.js
│   ├── README.md
│   ├── env.example
│   └── .gitignore
├── src/
├── package.json
└── ... (other frontend files)
```

## 🌐 Step 2: Create Render Web Service

### 2.1 Connect GitHub Repository

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New"** → **"Web Service"**
3. Choose **"Build and deploy from a Git repository"**
4. Click **"Connect"** next to your GitHub repository
5. If you don't see your repo, click **"Configure account"** to grant access

### 2.2 Service Configuration

Fill in the service details:

- **Name**: `greenur-backend` (or your preferred name)
- **Region**: Choose the closest to your users (e.g., Oregon for US West)
- **Branch**: `main` (or your default branch)
- **Root Directory**: `backend`
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`

### 2.3 Environment Variables

Add these environment variables in the **"Environment"** section:

```
PORT=10000
NODE_ENV=production
FRONTEND_URL=https://greenur-webapp.netlify.app
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/
MONGODB_DB=master
```

**Important Notes:**
- Replace `FRONTEND_URL` with your actual Netlify app URL
- Replace `MONGO_URI` with your actual MongoDB connection string
- Render automatically sets `PORT=10000`, but you can specify it explicitly

### 2.4 Advanced Settings (Optional)

- **Instance Type**: Free tier is sufficient for development
- **Auto-Deploy**: Enable for automatic deployments on code push
- **Health Check Path**: `/health` (our server provides this endpoint)

## 🔐 Step 3: Configure Environment Variables

### 3.1 Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port (Render provides this) | `10000` |
| `NODE_ENV` | Environment type | `production` |
| `FRONTEND_URL` | Your Netlify app URL | `https://greenur-webapp.netlify.app` |
| `MONGO_URI` | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/` |
| `MONGODB_DB` | Database name | `master` |

### 3.2 MongoDB Setup

If you don't have MongoDB Atlas set up:

1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas/database)
2. Create a free cluster
3. Create a database user
4. Whitelist Render's IP addresses (or use `0.0.0.0/0` for testing)
5. Get your connection string

## 🚀 Step 4: Deploy

### 4.1 Initial Deployment

1. Click **"Create Web Service"**
2. Render will automatically start building and deploying
3. Watch the build logs for any errors
4. Deployment typically takes 2-5 minutes

### 4.2 Verify Deployment

Once deployed, you'll get a URL like: `https://greenur-backend-xyz.onrender.com`

Test the endpoints:

```bash
# Health check
curl https://your-backend-url.onrender.com/health

# Socket.IO info
curl https://your-backend-url.onrender.com/api/socket-info
```

Expected health check response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 123.456,
  "mongodb": "connected",
  "socketConnections": 0
}
```

## ⚙️ Step 5: Update Frontend Configuration

### 5.1 Add Environment Variable

Add your Render backend URL to your Netlify environment variables:

1. Go to Netlify Dashboard → Your Site → Site settings → Environment variables
2. Add: `VITE_BACKEND_URL` = `https://your-backend-url.onrender.com`

### 5.2 Update Socket Service

The Socket service will automatically use the `VITE_BACKEND_URL` environment variable.

For development, you can add it to your local `.env` file:

```env
VITE_BACKEND_URL=https://your-backend-url.onrender.com
```

### 5.3 Test Frontend Integration

Use the Socket service in your components:

```javascript
import { useSocket } from '../hooks/useSocket';

function TrackPage() {
  const { isConnected, deviceStatuses, subscribeToDevice } = useSocket({
    autoConnect: true,
    deviceIds: ['ESP32-FC3FFF000'] // Your device IDs
  });

  return (
    <div>
      <p>Socket Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
      {/* Your component content */}
    </div>
  );
}
```

## 🔧 Step 6: Configure CORS (Important!)

### 6.1 Update CORS Settings

Make sure your Render backend allows your Netlify frontend:

In your `server.js`, the CORS configuration should include your Netlify URL:

```javascript
app.use(cors({
  origin: [
    "https://greenur-webapp.netlify.app",  // Your production URL
    "http://localhost:5173",               // Local development
    "http://localhost:8888"                // Netlify dev
  ],
  credentials: true
}));
```

### 6.2 Socket.IO CORS

The Socket.IO server also needs CORS configuration:

```javascript
const io = socketIo(server, {
  cors: {
    origin: [
      "https://greenur-webapp.netlify.app",
      "http://localhost:5173",
      "http://localhost:8888"
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});
```

## 📊 Step 7: Monitoring & Maintenance

### 7.1 View Logs

- Go to your Render dashboard
- Click on your service
- Navigate to **"Logs"** tab
- Monitor for any errors or connection issues

### 7.2 Health Monitoring

Set up monitoring for your backend:

1. **Built-in Health Check**: `/health` endpoint
2. **External Monitoring**: Use services like UptimeRobot or Pingdom
3. **Socket.IO Monitoring**: `/api/socket-info` endpoint

### 7.3 Performance Optimization

For production:

1. **Scale up** if you have many concurrent connections
2. **Enable compression** (already included in server.js)
3. **Use connection pooling** for MongoDB
4. **Implement rate limiting** if needed

## 🐛 Troubleshooting

### Common Issues

#### 1. Build Failures

```bash
# Check your package.json in backend directory
# Ensure all dependencies are listed
# Check for syntax errors in server.js
```

#### 2. Environment Variable Issues

- Verify all required env vars are set in Render dashboard
- Check for typos in variable names
- Ensure MongoDB connection string is correct

#### 3. CORS Errors

```javascript
// Browser console error: "CORS policy"
// Solution: Add your frontend URL to CORS origins
```

#### 4. Socket.IO Connection Issues

```javascript
// Enable debugging in browser console:
localStorage.debug = 'socket.io-client:socket';

// Check network tab for WebSocket connection attempts
```

#### 5. MongoDB Connection Failed

- Verify MongoDB Atlas network access
- Check database user permissions
- Ensure connection string format is correct

### Debug Commands

```bash
# Test backend directly
curl https://your-backend-url.onrender.com/health

# Check Socket.IO
curl https://your-backend-url.onrender.com/api/socket-info

# Test from frontend console
fetch('https://your-backend-url.onrender.com/health')
  .then(r => r.json())
  .then(console.log);
```

## 🔄 Step 8: Continuous Deployment

### 8.1 Auto-Deploy Setup

Render automatically deploys when you push to your connected branch:

```bash
# Make changes to backend
git add backend/
git commit -m "Update backend functionality"
git push origin main
# Render automatically deploys
```

### 8.2 Branch Protection

For production:
1. Create a `production` branch
2. Connect Render to the production branch
3. Use PR workflow for changes

## 📚 Next Steps

### 1. Integrate ESP32 Data Broadcasting

Update your ESP32 data logging to also broadcast via Socket.IO:

```javascript
// In your log-pulse-data Netlify function
// After saving to MongoDB, also broadcast:
fetch('https://your-backend-url.onrender.com/api/broadcast/device-data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    deviceId: 'ESP32-FC3FFF000',
    userId: 'user-firebase-uid',
    data: sensorData
  })
});
```

### 2. Add Real-time Features

- Device status indicators in UI
- Live data charts that update automatically
- Push notifications for device alerts
- Real-time plant care recommendations

### 3. Scale for Production

- Implement Redis for Socket.IO scaling
- Add rate limiting and authentication
- Set up proper logging and monitoring
- Implement connection limits

## 🆘 Getting Help

If you encounter issues:

1. **Check Render logs** first
2. **Test endpoints** manually with curl
3. **Verify environment variables**
4. **Check MongoDB connection**
5. **Review CORS configuration**

Common log patterns to look for:
- `✅ Connected to MongoDB` - MongoDB is working
- `🚀 Greenur Backend Server Started!` - Server started successfully
- `🔌 User connected:` - Socket.IO connections working

---

Your Render backend should now be running with Socket.IO support for real-time device monitoring! 🎉 