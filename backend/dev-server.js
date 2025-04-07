const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

// Port from environment variable or default to 9999
const PORT = process.env.VITE_NETLIFY_WS_PORT || 9999;

// Create a simple HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Greenur Botanist AI Voice Service Dev Server');
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

console.log(`Starting development signaling server on port ${PORT}...`);

// Store active connections
const connections = new Map();

// Handle WebSocket connections
wss.on('connection', (ws) => {
  const connectionId = uuidv4();
  console.log(`New connection: ${connectionId}`);
  
  // Store connection
  connections.set(connectionId, { ws, messages: [] });
  
  // Send initial mock data after 1 second
  setTimeout(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'status',
        message: 'Connected to development signaling server'
      }));
    }
  }, 1000);
  
  // Handle messages
  ws.on('message', (message) => {
    try {
      console.log(`Message from ${connectionId}:`, message.toString());
      const data = JSON.parse(message);
      
      // Store message
      connections.get(connectionId).messages.push(data);
      
      // Echo back the message with some delay to simulate network
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          // Handle message based on type
          switch (data.type) {
            case 'offer':
              // Send mock answer
              ws.send(JSON.stringify({
                type: 'answer',
                answer: {
                  type: 'answer',
                  sdp: 'mock answer sdp'
                }
              }));
              break;
              
            case 'ice-candidate':
              // Echo back ice candidate 
              ws.send(JSON.stringify({
                type: 'ice-candidate',
                candidate: data.candidate
              }));
              break;
              
            default:
              // Echo back the message
              ws.send(JSON.stringify({
                type: 'echo',
                original: data
              }));
          }
        }
      }, 300);
      
      // Send mock bot response after 3 seconds on any message
      if (data.type === 'offer') {
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'bot-message',
              id: uuidv4(),
              text: "Hello! I'm the Botanist AI assistant. How can I help you with your plants today?"
            }));
          }
        }, 3000);
      }
      
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });
  
  // Handle disconnection
  ws.on('close', () => {
    console.log(`Connection closed: ${connectionId}`);
    connections.delete(connectionId);
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Dev signaling server running at http://localhost:${PORT}`);
});

// Print instructions
console.log('\n=== Development Signaling Server ===');
console.log('This server simulates the backend WebRTC signaling service');
console.log('Use this for local development and testing only');
console.log('Press Ctrl+C to stop the server');
console.log('=====================================\n'); 