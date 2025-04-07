import { Message } from '../types/chat';
import { getSelectedModel } from '../config/aiConfig';

// Define the call state types
export type CallStatus = 'idle' | 'connecting' | 'connected' | 'ended';

export interface CallState {
  status: CallStatus;
  error?: string;
}

/**
 * WebRTC configuration
 */
const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

// Websocket connection for signaling
let wsConnection: WebSocket | null = null;
// WebRTC peer connection
let peerConnection: RTCPeerConnection | null = null;
// Local media stream
let localStream: MediaStream | null = null;
// Remote media stream
let remoteStream: MediaStream | null = null;
// Audio element for playing remote audio
let remoteAudio: HTMLAudioElement | null = null;

// Event callbacks
type CallEventCallback = (state: CallState) => void;
type MessageCallback = (message: Message) => void;

let onCallStateChange: CallEventCallback | null = null;
let onBotMessage: MessageCallback | null = null;

/**
 * Initialize the WebRTC service
 */
export function initWebRTCService(
  callStateCallback: CallEventCallback, 
  messageCallback: MessageCallback
): void {
  onCallStateChange = callStateCallback;
  onBotMessage = messageCallback;
  
  // Create audio element for remote stream if it doesn't exist
  if (!remoteAudio) {
    remoteAudio = new Audio();
    remoteAudio.autoplay = true;
  }
}

/**
 * Initialize WebSocket connection for signaling
 */
function initSignaling(): Promise<void> {
  return new Promise((resolve, reject) => {
    // In production, this would use Netlify function with environment variable
    const wsUrl = import.meta.env.VITE_NETLIFY_WS_PORT 
      ? `ws://localhost:${import.meta.env.VITE_NETLIFY_WS_PORT}` 
      : 'wss://olympic-perry-greenur.koyeb.app/ws';
      
    wsConnection = new WebSocket(wsUrl);
    
    wsConnection.onopen = () => {
      console.log('WebSocket connection established');
      resolve();
    };
    
    wsConnection.onerror = (error) => {
      console.error('WebSocket error:', error);
      reject(new Error('Failed to connect to signaling server'));
    };
    
    wsConnection.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        
        // Handle different message types
        switch (message.type) {
          case 'offer':
            handleRemoteOffer(message);
            break;
          case 'answer':
            handleRemoteAnswer(message);
            break;
          case 'ice-candidate':
            handleRemoteIceCandidate(message);
            break;
          case 'bot-message':
            // Handle transcribed text from the bot
            if (onBotMessage && message.text) {
              onBotMessage({
                id: message.id || Date.now().toString(),
                text: message.text,
                sender: 'assistant',
                timestamp: new Date()
              });
            }
            break;
          case 'error':
            console.error('Error from signaling server:', message.error);
            if (onCallStateChange) {
              onCallStateChange({
                status: 'ended',
                error: message.error
              });
            }
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    wsConnection.onclose = () => {
      console.log('WebSocket connection closed');
      endCall();
    };
  });
}

/**
 * Initialize WebRTC peer connection
 */
async function setupPeerConnection(): Promise<void> {
  // Create a new RTCPeerConnection
  peerConnection = new RTCPeerConnection(rtcConfig);
  
  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate && wsConnection) {
      wsConnection.send(JSON.stringify({
        type: 'ice-candidate',
        candidate: event.candidate.toJSON()
      }));
    }
  };
  
  // Handle connection state changes
  peerConnection.onconnectionstatechange = () => {
    if (peerConnection) {
      console.log('Connection state:', peerConnection.connectionState);
      
      if (peerConnection.connectionState === 'connected') {
        if (onCallStateChange) {
          onCallStateChange({ status: 'connected' });
        }
      } else if (peerConnection.connectionState === 'failed' || 
                peerConnection.connectionState === 'disconnected' || 
                peerConnection.connectionState === 'closed') {
        endCall();
      }
    }
  };
  
  // Handle remote stream
  peerConnection.ontrack = (event) => {
    if (event.streams && event.streams[0]) {
      remoteStream = event.streams[0];
      
      // Play the remote stream
      if (remoteAudio && remoteStream.getAudioTracks().length > 0) {
        remoteAudio.srcObject = remoteStream;
      }
    }
  };
  
  // Create local stream (audio only)
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    
    // Add local tracks to peer connection
    localStream.getAudioTracks().forEach(track => {
      if (peerConnection && localStream) {
        peerConnection.addTrack(track, localStream);
      }
    });
  } catch (error) {
    console.error('Error getting user media:', error);
    throw new Error('Failed to access microphone');
  }
}

/**
 * Handle remote offer
 */
async function handleRemoteOffer(message: any): Promise<void> {
  if (!peerConnection) {
    await setupPeerConnection();
  }
  
  if (peerConnection) {
    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(message.offer));
      
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      if (wsConnection) {
        wsConnection.send(JSON.stringify({
          type: 'answer',
          answer
        }));
      }
    } catch (error) {
      console.error('Error handling remote offer:', error);
    }
  }
}

/**
 * Handle remote answer
 */
async function handleRemoteAnswer(message: any): Promise<void> {
  if (peerConnection && message.answer) {
    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer));
    } catch (error) {
      console.error('Error handling remote answer:', error);
    }
  }
}

/**
 * Handle remote ICE candidate
 */
async function handleRemoteIceCandidate(message: any): Promise<void> {
  if (peerConnection && message.candidate) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
    } catch (error) {
      console.error('Error handling remote ICE candidate:', error);
    }
  }
}

/**
 * Start a call with the Botanist AI assistant
 */
export async function startCall(): Promise<void> {
  try {
    if (onCallStateChange) {
      onCallStateChange({ status: 'connecting' });
    }
    
    // Initialize WebSocket connection
    await initSignaling();
    
    // Initialize WebRTC
    await setupPeerConnection();
    
    // Get the configured AI model from local storage
    const modelId = getSelectedModel();
    
    // Create and send offer
    if (peerConnection && wsConnection) {
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });
      
      await peerConnection.setLocalDescription(offer);
      
      // Send the offer to the server with model configuration
      wsConnection.send(JSON.stringify({
        type: 'offer',
        offer,
        modelId
      }));
      
      // Also send a separate config message to ensure model is set
      wsConnection.send(JSON.stringify({
        type: 'config',
        modelId
      }));
    }
  } catch (error) {
    console.error('Error starting call:', error);
    
    if (onCallStateChange) {
      onCallStateChange({
        status: 'ended',
        error: 'Failed to start call: ' + (error as Error).message
      });
    }
    
    // Clean up resources
    cleanupResources();
  }
}

/**
 * End the call
 */
export function endCall(): void {
  // Notify of call ending
  if (onCallStateChange) {
    onCallStateChange({ status: 'ended' });
  }
  
  // Clean up WebRTC resources
  cleanupResources();
}

/**
 * Clean up WebRTC resources
 */
function cleanupResources(): void {
  // Close peer connection
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  
  // Close WebSocket connection
  if (wsConnection) {
    wsConnection.close();
    wsConnection = null;
  }
  
  // Stop local stream tracks
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  
  // Clear remote stream
  if (remoteAudio) {
    remoteAudio.srcObject = null;
  }
  remoteStream = null;
} 