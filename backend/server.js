const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const { OpenAI } = require('openai');
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
const { SpeechClient } = require('@google-cloud/speech');
const wrtc = require('wrtc'); // WebRTC implementation for Node.js
const fs = require('fs');
const path = require('path');

// Set up Google credentials - either use file path or JSON content from env var
if (process.env.GOOGLE_CREDENTIALS_JSON) {
  try {
    // Parse the JSON credentials from environment variable
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
    
    // Write credentials to a temporary file
    const tempCredentialsPath = path.join(__dirname, 'google-credentials-temp.json');
    fs.writeFileSync(tempCredentialsPath, JSON.stringify(credentials, null, 2));
    
    // Set the path for Google client libraries to use
    process.env.GOOGLE_APPLICATION_CREDENTIALS = tempCredentialsPath;
    
    console.log('Using Google credentials from environment variable JSON');
  } catch (error) {
    console.error('Error setting up Google credentials from JSON:', error);
    process.exit(1);
  }
} else if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('No Google credentials configured. Set either GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_CREDENTIALS_JSON environment variable');
  process.exit(1);
}

// Initialize Express app
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Google Speech-to-Text client
const speechClient = new SpeechClient();

// Initialize Google Text-to-Speech client
const ttsClient = new TextToSpeechClient();

// Set up logging
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const logger = {
  error: (...args) => console.error(...args),
  warn: (...args) => console.warn(...args),
  info: (...args) => LOG_LEVEL !== 'error' && console.log(...args),
  debug: (...args) => LOG_LEVEL === 'debug' && console.log('[DEBUG]', ...args)
};

// Store active connections
const activeConnections = new Map();

// System prompt for the botanist assistant
const BOTANIST_SYSTEM_PROMPT = `
You are Greenur's plant expert botanist assistant. Your role is to help users with their plant-related questions.

You should:
- Always answer in brief, concise responses for a natural conversation
- Provide accurate, helpful information about plants, gardening, plant care, and related topics
- Answer questions about plant identification, care requirements, troubleshooting plant problems, etc.
- Be friendly, supportive, and encouraging to gardeners of all experience levels
- Use scientific names when appropriate, but explain concepts in accessible language
- If you're unsure about something, acknowledge the limits of your knowledge
- ONLY answer questions related to plants, gardening, botany, and closely related topics
- For non-plant related questions, politely explain that you're a plant specialist and can only help with plant-related topics

DO NOT:
- Provide advice on non-plant topics
- Engage in discussions about politics, controversial topics, or anything unrelated to plants
- Generate harmful content of any kind
- Provide lengthy responses - keep them short and natural for a voice conversation
`;

// WebRTC configuration
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

// Handle WebSocket connections
wss.on('connection', (ws) => {
  const connectionId = uuidv4();
  console.log(`New connection established: ${connectionId}`);
  
  // Store connection and its associated data
  const connectionData = {
    ws,
    peerConnection: null,
    dataChannel: null,
    audioTransceiver: null,
    conversationContext: [],
    modelId: null,
  };
  
  activeConnections.set(connectionId, connectionData);
  
  // Handle WebSocket messages
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      switch(data.type) {
        case 'offer':
          // Store model ID if provided
          if (data.modelId) {
            connectionData.modelId = data.modelId;
          }
          await handleOffer(connectionId, data.offer);
          break;
        case 'answer':
          await handleAnswer(connectionId, data.answer);
          break;
        case 'ice-candidate':
          await handleIceCandidate(connectionId, data.candidate);
          break;
        case 'config':
          // Handle configuration updates
          if (data.modelId) {
            connectionData.modelId = data.modelId;
          }
          break;
        default:
          console.warn(`Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendError(ws, 'Failed to process message');
    }
  });
  
  // Handle WebSocket disconnection
  ws.on('close', () => {
    console.log(`Connection closed: ${connectionId}`);
    cleanupConnection(connectionId);
    activeConnections.delete(connectionId);
  });
  
  // Handle WebSocket errors
  ws.on('error', (error) => {
    console.error(`WebSocket error for ${connectionId}:`, error);
    cleanupConnection(connectionId);
    activeConnections.delete(connectionId);
  });
});

/**
 * Handle WebRTC offer from client
 */
async function handleOffer(connectionId, offer) {
  const connectionData = activeConnections.get(connectionId);
  if (!connectionData) return;
  
  try {
    // Create a new RTCPeerConnection
    const peerConnection = new wrtc.RTCPeerConnection(rtcConfig);
    connectionData.peerConnection = peerConnection;
    
    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        sendToClient(connectionData.ws, {
          type: 'ice-candidate',
          candidate: event.candidate,
        });
      }
    };
    
    // Create an audio transceiver
    connectionData.audioTransceiver = peerConnection.addTransceiver('audio', {
      direction: 'sendrecv',
    });
    
    // Handle incoming audio stream
    peerConnection.ontrack = async (event) => {
      console.log('Received audio track from client');
      
      // Set up audio processing pipeline
      setupAudioProcessingPipeline(connectionId, event.streams[0]);
    };
    
    // Set the remote description (client's offer)
    await peerConnection.setRemoteDescription(new wrtc.RTCSessionDescription(offer));
    
    // Create an answer
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    
    // Send the answer to the client
    sendToClient(connectionData.ws, {
      type: 'answer',
      answer: peerConnection.localDescription,
    });
  } catch (error) {
    console.error('Error handling offer:', error);
    sendError(connectionData.ws, 'Failed to process offer');
  }
}

/**
 * Handle WebRTC answer from client
 */
async function handleAnswer(connectionId, answer) {
  const connectionData = activeConnections.get(connectionId);
  if (!connectionData || !connectionData.peerConnection) return;
  
  try {
    await connectionData.peerConnection.setRemoteDescription(
      new wrtc.RTCSessionDescription(answer)
    );
  } catch (error) {
    console.error('Error handling answer:', error);
    sendError(connectionData.ws, 'Failed to process answer');
  }
}

/**
 * Handle ICE candidate from client
 */
async function handleIceCandidate(connectionId, candidate) {
  const connectionData = activeConnections.get(connectionId);
  if (!connectionData || !connectionData.peerConnection) return;
  
  try {
    await connectionData.peerConnection.addIceCandidate(
      new wrtc.RTCIceCandidate(candidate)
    );
  } catch (error) {
    console.error('Error handling ICE candidate:', error);
    // Non-critical error, don't send to client
  }
}

/**
 * Set up the audio processing pipeline
 */
async function setupAudioProcessingPipeline(connectionId, audioStream) {
  const connectionData = activeConnections.get(connectionId);
  if (!connectionData) return;
  
  // Create a recognizeStream from Google Speech-to-Text
  const recognizeStream = speechClient
    .streamingRecognize({
      config: {
        encoding: 'LINEAR16',
        sampleRateHertz: 48000,
        languageCode: 'en-US',
        model: 'default',
        useEnhanced: true,
        enableAutomaticPunctuation: true,
        enableSpokenPunctuation: true,
      },
      interimResults: false,
    })
    .on('error', (error) => {
      console.error('Speech recognition error:', error);
    })
    .on('data', async (data) => {
      if (data.results[0] && data.results[0].alternatives[0]) {
        const transcript = data.results[0].alternatives[0].transcript;
        console.log(`Transcribed: "${transcript}"`);
        
        // Process user message with OpenAI
        await processUserMessage(connectionId, transcript);
      }
    });
  
  // Create a MediaStreamTrackProcessor to process audio data
  // Note: This is a mock implementation since Node.js doesn't have MediaStreamTrackProcessor
  // In a real implementation, you'd use audio processing libraries like node-audiorecorder
  // For simplicity, we're assuming the audio is being processed and sent to the recognizeStream
  
  // TODO: Add actual audio processing implementation
  // For now, we'll simulate reception with a test message after 3 seconds
  setTimeout(() => {
    // Simulate a user message
    processUserMessage(connectionId, "Can you tell me how to care for a peace lily?");
  }, 3000);
}

/**
 * Process a user message using OpenAI and respond
 */
async function processUserMessage(connectionId, userMessage) {
  const connectionData = activeConnections.get(connectionId);
  if (!connectionData) return;
  
  try {
    // Add user message to conversation context
    connectionData.conversationContext.push({
      role: 'user',
      content: userMessage,
    });
    
    // Keep conversation context limited to last 10 messages
    if (connectionData.conversationContext.length > 10) {
      connectionData.conversationContext = connectionData.conversationContext.slice(-10);
    }
    
    // Prepare messages for LLM
    const messages = [
      { role: 'system', content: BOTANIST_SYSTEM_PROMPT },
      ...connectionData.conversationContext,
    ];
    
    // Get model from connection data or use default
    const model = connectionData.modelId || "gpt-4o-mini";
    
    // Get response from OpenAI with dynamic model
    const response = await openai.chat.completions.create({
      model: model,
      messages,
      temperature: 0.3,
      max_tokens: 200,
      stream: true,
    });
    
    let assistantResponse = '';
    
    // Process streamed response
    for await (const chunk of response) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        assistantResponse += content;
      }
    }
    
    // Add assistant response to conversation context
    connectionData.conversationContext.push({
      role: 'assistant',
      content: assistantResponse,
    });
    
    console.log(`Assistant response: "${assistantResponse}"`);
    
    // Send the response text to the client
    sendToClient(connectionData.ws, {
      type: 'bot-message',
      id: uuidv4(),
      text: assistantResponse,
    });
    
    // Convert text to speech
    await textToSpeech(connectionId, assistantResponse);
  } catch (error) {
    console.error('Error processing user message:', error);
    sendError(connectionData.ws, 'Failed to process your message');
  }
}

/**
 * Convert text to speech and send to client
 */
async function textToSpeech(connectionId, text) {
  const connectionData = activeConnections.get(connectionId);
  if (!connectionData || !connectionData.peerConnection) return;
  
  try {
    // Request text-to-speech from Google
    const [response] = await ttsClient.synthesizeSpeech({
      input: { text },
      voice: { languageCode: 'en-US', ssmlGender: 'FEMALE', name: 'en-US-Neural2-F' },
      audioConfig: { audioEncoding: 'MP3' },
    });
    
    // Create audio stream
    // Note: This is a simplified implementation
    // In a real scenario, you'd need to convert the audio data to the right format
    // and use WebRTC's RTCPeerConnection.addTrack method to stream it to the client
    
    // For now, we'll simulate with a console message
    console.log('TTS audio generated and would be sent to client');
    
    // TODO: Implement actual audio streaming via WebRTC
  } catch (error) {
    console.error('Error in text-to-speech:', error);
  }
}

/**
 * Send data to client
 */
function sendToClient(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

/**
 * Send error to client
 */
function sendError(ws, errorMessage) {
  sendToClient(ws, {
    type: 'error',
    error: errorMessage,
  });
}

/**
 * Clean up connection resources
 */
function cleanupConnection(connectionId) {
  const connectionData = activeConnections.get(connectionId);
  if (!connectionData) return;
  
  if (connectionData.peerConnection) {
    connectionData.peerConnection.close();
  }
  
  // Other cleanup as needed
}

// Basic route for health check
app.get('/', (req, res) => {
  res.send('Botanist AI Voice Service is running');
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 