import React, { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Send, History, Plus, Trash2, Maximize2, Minimize2, X, Leaf, Paperclip, Phone, PhoneOff } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Message, StreamingState, ChatSession } from '../../types/chat';
import { sendMessageToBotanist, streamMessageToBotanist } from '../../services/botanistService';
import { initWebRTCService, startCall, endCall, CallState, CallStatus } from '../../services/webRTCService';
import { Button } from './button';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';
import { useToast } from '../../hooks/useToast';
import chatbotIcon from '../../assets/images/chatbot-icon.png';
import { useAuth } from '../../hooks/useAuth';
import { updateUserKeywordProfile } from '../../services/articleService';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../../utils/cn';

// Chat components
import {
  ExpandableChat,
  ExpandableChatHeader,
  ExpandableChatBody,
  ExpandableChatFooter,
} from './chat/expandable-chat';
import { ChatInput } from './chat/chat-input';
import { ChatMessageList } from './chat/chat-message-list';
import {
  ChatBubble,
  ChatBubbleAvatar,
  ChatBubbleMessage,
} from './chat/chat-bubble';

interface AssistantProps {
  initialMessages?: Message[];
  pageContext?: any;
}

// Create a global state for the assistant to persist across page navigation
let globalAssistantState = {
  isOpen: false,
  messages: [] as Message[],
  conversationId: null as string | null,
  isInCall: false
};

interface PageContext {
  currentPath: string;
  pageName: string;
  params?: Record<string, string>;
}

// Custom header component that includes the history button and call button
interface AssistantHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  onClose?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  user: any;
  chatHistory: ChatSession[];
  isLoadingHistory: boolean;
  loadChatSession: (session: ChatSession) => void;
  deleteChatSession: (sessionId: string) => void;
  startNewChat: () => void;
  getChatPreview: (messages: Message[]) => string;
  formatRelativeTime: (date: Date | string) => string;
  currentConversationId?: string | null;
  isInCall: boolean;
  toggleCall: () => void;
}

const AssistantHeader: React.FC<AssistantHeaderProps> = ({
  children,
  onClose,
  isExpanded,
  onToggleExpand,
  user,
  chatHistory,
  isLoadingHistory,
  loadChatSession,
  deleteChatSession,
  startNewChat,
  getChatPreview,
  formatRelativeTime,
  currentConversationId,
  isInCall,
  toggleCall,
  ...props
}) => {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  
  // Function to handle loading a chat session
  const handleLoadChatSession = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Only load if we're not already on this session
    if (session._id !== currentConversationId) {
      loadChatSession(session);
      
      // Close the dropdown
      setIsHistoryOpen(false);
    }
  };

  // Function to handle starting a new chat
  const handleStartNewChat = (e: React.MouseEvent) => {
    // Stop event propagation to prevent the dropdown from closing the chat window
    e.stopPropagation();
    e.preventDefault();
    
    // Only start a new chat if we're not already on a new chat
    startNewChat();
    
    // Close the dropdown
    setIsHistoryOpen(false);
  };

  // Function to handle deleting a chat session
  const handleDeleteChatSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (sessionId) {
      deleteChatSession(sessionId);
    }
  };

  // Check if we're on a new chat (no messages)
  const isOnNewChat = !currentConversationId;

  return (
    <div
      className="flex items-center justify-between px-4 py-3 border-b"
      {...props}
    >
      <div className="flex items-center gap-2">{children}</div>
      <div className="flex items-center">
        {/* Call Button */}
        <Button 
          variant={isInCall ? "destructive" : "ghost"} 
          size="icon" 
          className="h-8 w-8 mr-1" 
          onClick={toggleCall}
        >
          {isInCall ? (
            <PhoneOff className="h-4 w-4" />
          ) : (
            <Phone className="h-4 w-4" />
          )}
          <span className="sr-only">{isInCall ? "End call" : "Start call"}</span>
        </Button>
        
        {/* Chat History Dropdown */}
        {user && (
          <DropdownMenu open={isHistoryOpen} onOpenChange={(open) => {
            setIsHistoryOpen(open);
          }}>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 mr-1" 
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <History className="h-4 w-4" />
                <span className="sr-only">Chat History</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="end" 
              className="w-[250px]" 
              onCloseAutoFocus={(e) => e.preventDefault()}
              onClick={(e) => e.stopPropagation()}
              data-dropdown-menu
            >
              {isLoadingHistory ? (
                <div className="py-2 px-4 text-center text-sm text-muted-foreground">
                  Loading...
                </div>
              ) : chatHistory.length === 0 ? (
                <div className="py-2 px-4 text-center text-sm text-muted-foreground">
                  No chat history found
                </div>
              ) : (
                chatHistory.map((session) => {
                  // Check if this is the current session
                  const isCurrentSession = session._id === currentConversationId;
                  
                  return (
                    <div key={session._id} className="flex justify-between items-center p-0 hover:bg-transparent">
                      <div 
                        className={cn(
                          "flex-1 truncate py-1.5 px-2 rounded-l-sm",
                          isCurrentSession 
                            ? "bg-accent text-accent-foreground cursor-default" 
                            : "cursor-pointer hover:bg-accent hover:text-accent-foreground"
                        )}
                        onClick={(e) => {
                          if (!isCurrentSession) {
                            handleLoadChatSession(session, e);
                          }
                        }}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium truncate mr-2 text-sm">
                            {getChatPreview(session.messages)}
                          </span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatRelativeTime(session.lastUpdatedAt)}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-l-none hover:bg-destructive hover:text-destructive-foreground"
                        onClick={(e) => handleDeleteChatSession(session._id!, e)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  );
                })
              )}
              
              <DropdownMenuSeparator />
              <div 
                className={cn(
                  "relative flex select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
                  isOnNewChat 
                    ? "opacity-50 cursor-not-allowed" 
                    : "cursor-pointer hover:bg-accent hover:text-accent-foreground"
                )}
                onClick={(e) => {
                  // Only proceed if not on a new chat
                  if (!isOnNewChat) {
                    // Prevent default behavior and stop propagation
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Call startNewChat
                    startNewChat();
                    
                    // Close the dropdown
                    setIsHistoryOpen(false);
                  }
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                <span className="text-sm">New Chat</span>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {onToggleExpand && (
          <Button
            onClick={onToggleExpand}
            size="icon"
            variant="ghost"
            className="h-8 w-8 mr-1"
            aria-label={isExpanded ? "Minimize chat" : "Maximize chat"}
          >
            {isExpanded ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        )}
        <Button
          onClick={onClose}
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          aria-label="Close chat"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export const Assistant = ({ initialMessages = [], pageContext }: AssistantProps) => {
  const [isOpen, setIsOpen] = useState(globalAssistantState.isOpen);
  const [messages, setMessages] = useState<Message[]>(
    globalAssistantState.messages.length > 0 ? globalAssistantState.messages : initialMessages
  );
  const [conversationId, setConversationId] = useState<string | null>(globalAssistantState.conversationId);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [preventClose, setPreventClose] = useState(false);
  const [streaming, setStreaming] = useState<StreamingState>({
    isStreaming: false,
    partialResponse: '',
  });
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  // Image upload states
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  
  const { toast } = useToast();
  const location = useLocation();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useAuth();
  const [isInCall, setIsInCall] = useState(globalAssistantState.isInCall);
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [callError, setCallError] = useState<string | undefined>(undefined);

  // Update global state when local state changes
  useEffect(() => {
    globalAssistantState.isOpen = isOpen;
    globalAssistantState.messages = messages;
    globalAssistantState.conversationId = conversationId;
    globalAssistantState.isInCall = isInCall;
  }, [isOpen, messages, conversationId, isInCall]);

  // Load chat history when user is authenticated
  useEffect(() => {
    if (user) {
      fetchChatHistory();
    }
  }, [user]);

  // Add event listener for opening assistant with a message
  useEffect(() => {
    const handleOpenAssistantWithMessage = (event: CustomEvent) => {
      console.log('Received openAssistantWithMessage event:', event.detail);
      
      // Extract message and context from the event
      const { message, context } = event.detail;
      
      // Open the assistant
      setIsOpen(true);
      globalAssistantState.isOpen = true;
      
      // Set the current message
      if (message) {
        setCurrentMessage(message);
      }
      
      // If we have a new context, start a new chat
      if (context) {
        // Reset the messages and conversation ID
        setMessages([]);
        setConversationId(null);
        globalAssistantState.messages = [];
        globalAssistantState.conversationId = null;
        
        // Focus the input after a short delay
        setTimeout(() => {
          inputRef.current?.focus();
        }, 300);
      }
    };
    
    // Add event listener
    window.addEventListener('openAssistantWithMessage', handleOpenAssistantWithMessage as EventListener);
    
    // Clean up
    return () => {
      window.removeEventListener('openAssistantWithMessage', handleOpenAssistantWithMessage as EventListener);
    };
  }, []);

  // Fetch chat history from MongoDB
  const fetchChatHistory = async () => {
    if (!user) return;
    
    try {
      setIsLoadingHistory(true);
      const response = await fetch(`/.netlify/functions/get-chat-history?userId=${user.uid}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch chat history');
      }
      
      const data = await response.json();
      setChatHistory(data.sessions || []);
    } catch (error) {
      console.error('Error fetching chat history:', error);
      toast({
        title: 'Error',
        description: 'Failed to load chat history',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Save chat session to MongoDB
  const saveChatSession = async (newMessages: Message[]) => {
    if (!user || newMessages.length === 0) return;

    try {
      const currentPageContext = getCurrentPageContext();
      
      if (!conversationId) {
        // Create a new session
        const response = await fetch('/.netlify/functions/save-chat-history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.uid,
            messages: newMessages,
            startedAt: new Date(),
            lastUpdatedAt: new Date(),
            pageContext: currentPageContext
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save chat session');
        }

        const data = await response.json();
        setConversationId(data.sessionId);
        
        // Refresh chat history
        fetchChatHistory();
      } else {
        // Update existing session
        const response = await fetch('/.netlify/functions/update-chat-history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: conversationId,
            messages: newMessages,
            pageContext: currentPageContext,
            lastUpdatedAt: new Date()
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to update chat session');
        }
        
        // Refresh chat history
        fetchChatHistory();
      }
    } catch (error) {
      console.error('Error saving chat session:', error);
      toast({
        title: 'Error',
        description: 'Failed to save chat history',
        variant: 'destructive',
      });
    }
  };

  // Delete a chat session
  const deleteChatSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/.netlify/functions/delete-chat-history?sessionId=${sessionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete chat session');
      }

      // If we're deleting the current conversation, reset the state
      if (sessionId === conversationId) {
        setMessages([]);
        setConversationId(null);
        globalAssistantState.messages = [];
        globalAssistantState.conversationId = null;
      }
      
      // Refresh chat history
      fetchChatHistory();
      
      // Ensure the chat window stays open
      if (!isOpen) {
        handleOpenChange(true);
      }
    } catch (error) {
      console.error('Error deleting chat session:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete chat history',
        variant: 'destructive',
      });
    }
  };

  // Load a specific chat session
  const loadChatSession = async (session: ChatSession) => {
    if (!session._id) return;
    
    // If we're already on this chat session, do nothing
    if (session._id === conversationId) {
      return;
    }
    
    // Update the messages and conversation ID
    setMessages(session.messages);
    setConversationId(session._id);
    globalAssistantState.messages = session.messages;
    globalAssistantState.conversationId = session._id;
    
    // Ensure the chat window stays open
    if (!isOpen) {
      handleOpenChange(true);
    }
  };

  // Start a new chat session
  const startNewChat = () => {
    console.log('startNewChat called, current state:', { messages: messages.length, conversationId, isOpen });
    
    // Set the preventClose flag to true to prevent the chat from closing
    setPreventClose(true);
    
    // If we're already on a new chat (no messages or conversation ID), do nothing
    if (messages.length === 0 && !conversationId) {
      console.log('Already on a new chat, doing nothing');
      return;
    }
    
    // Reset the messages and conversation ID
    setMessages([]);
    setConversationId(null);
    globalAssistantState.messages = [];
    globalAssistantState.conversationId = null;
    
    // Force the chat window to stay open
    setIsOpen(true);
    globalAssistantState.isOpen = true;
    
    console.log('Started new chat, chat window state:', true);
  };

  // Get current page context
  const getCurrentPageContext = (): PageContext => {
    // If pageContext is provided, use it
    if (pageContext) {
      return pageContext;
    }

    // Otherwise, create a basic context based on the current route
    const path = location.pathname;
    const context: PageContext = {
      currentPath: path,
      pageName: path.split('/').pop() || 'home',
    };

    // Add query parameters if any
    if (location.search) {
      const searchParams = new URLSearchParams(location.search);
      const params: Record<string, string> = {};
      searchParams.forEach((value, key) => {
        params[key] = value;
      });
      context.params = params;
    }

    return context;
  };

  // Get user profile information
  const getUserProfile = () => {
    if (!user) return null;

    return {
      uid: user.uid,
      displayName: user.displayName,
      email: user.email,
      // Add any other relevant user information here
    };
  };

  // Extract keywords from conversation
  const extractKeywordsFromConversation = (messages: Message[]): string[] => {
    // Simple keyword extraction - in a real app, this would be more sophisticated
    const allText = messages
      .map(msg => msg.text.toLowerCase())
      .join(' ');
    
    // Remove common words and punctuation
    const cleanedText = allText
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Split into words and filter out common words and short words
    const commonWords = new Set([
      'the', 'and', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
      'do', 'does', 'did', 'can', 'could', 'will', 'would', 'should', 'may',
      'might', 'must', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'this',
      'that', 'these', 'those', 'my', 'your', 'his', 'her', 'its', 'our', 'their'
    ]);
    
    const words = cleanedText
      .split(' ')
      .filter(word => word.length > 2 && !commonWords.has(word));
    
    // Count word frequency
    const wordCounts: Record<string, number> = {};
    words.forEach(word => {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    });
    
    // Sort by frequency and take top 10
    return Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  };

  // Process conversation for knowledge extraction
  const processConversationForKnowledge = async (messages: Message[]) => {
    if (!user || messages.length < 3) return;
    
    try {
      // Extract keywords from the conversation
      const keywords = extractKeywordsFromConversation(messages);
      
      // Update user's keyword profile
      await updateUserKeywordProfile(user.uid, keywords);
    } catch (error) {
      console.error('Error processing conversation for knowledge:', error);
    }
  };

  // Handle image upload
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check if the file is an image
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image file',
        variant: 'destructive',
      });
      return;
    }
    
    // Check file size (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please select an image smaller than 5MB',
        variant: 'destructive',
      });
      return;
    }
    
    // Create a preview
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    
    setSelectedImage(file);
  };

  // Clear selected image
  const clearSelectedImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Convert image to base64
  const convertImageToBase64 = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result as string;
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  // Resize and compress image before sending
  const processImageForChat = async (file: File): Promise<string> => {
    try {
      // Create a temporary image element
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          // Create a canvas and resize the image
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          
          // Calculate dimensions while maintaining aspect ratio
          const maxDimension = 800;
          let width = img.width;
          let height = img.height;
          
          if (width > height && width > maxDimension) {
            height = Math.round(height * (maxDimension / width));
            width = maxDimension;
          } else if (height > maxDimension) {
            width = Math.round(width * (maxDimension / height));
            height = maxDimension;
          }
          
          // Set canvas dimensions and draw resized image
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to base64 and reduce quality
          const base64String = canvas.toDataURL('image/jpeg', 0.8);
          resolve(base64String);
        };
        
        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };
        
        // Load image from file
        const reader = new FileReader();
        reader.onload = (e) => {
          img.src = e.target?.result as string;
        };
        reader.onerror = (e) => {
          reject(new Error('Failed to read file'));
        };
        reader.readAsDataURL(file);
      });
    } catch (error) {
      console.error('Error processing image:', error);
      // If processing fails, fall back to basic conversion
      return convertImageToBase64(file);
    }
  };

  // Start voice recording
  const startRecording = async () => {
    try {
      // Reset recording state
      audioChunksRef.current = [];
      setRecordingTime(0);
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create media recorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      // Set up recording timer
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      // Store audio chunks
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      
      // Handle recording stop
      mediaRecorder.onstop = () => {
        // Stop all audio tracks
        stream.getTracks().forEach(track => track.stop());
        
        // Clear recording timer
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        
        // Create audio blob
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordedAudio(audioBlob);
        
        // Convert speech to text
        handleSpeechToText(audioBlob);
      };
      
      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
      
      toast({
        title: 'Recording started',
        description: 'Speak now...',
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: 'Microphone access denied',
        description: 'Please allow microphone access to use voice recording',
        variant: 'destructive',
      });
    }
  };

  // Stop voice recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Clear recording timer
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  // Convert speech to text
  const handleSpeechToText = async (audioBlob: Blob) => {
    try {
      // Create a FormData object
      const formData = new FormData();
      formData.append('audio', audioBlob);
      
      // Set loading state
      setCurrentMessage('Transcribing...');
      
      // Send to speech-to-text API
      const response = await fetch('/.netlify/functions/speech-to-text', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to transcribe audio');
      }
      
      const data = await response.json();
      
      // Set transcribed text as current message
      setCurrentMessage(data.text);
      
      // Focus input after transcription
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } catch (error) {
      console.error('Error transcribing audio:', error);
      toast({
        title: 'Transcription failed',
        description: 'Could not convert speech to text',
        variant: 'destructive',
      });
      setCurrentMessage('');
    } finally {
      // Clear recorded audio
      setRecordedAudio(null);
    }
  };

  const handleSendMessage = async () => {
    if ((!currentMessage.trim() && !selectedImage) || streaming.isStreaming) return;

    try {
      // Handle image processing if there's an image
      let imageData = null;
      if (selectedImage) {
        try {
          const base64Image = await processImageForChat(selectedImage);
          imageData = {
            url: base64Image,
            alt: selectedImage.name,
            fileType: 'image/jpeg', // We're converting to JPEG in the processImageForChat function
          };
        } catch (error) {
          console.error('Error processing image:', error);
          toast({
            title: 'Image processing failed',
            description: 'Could not process image',
            variant: 'destructive',
          });
          return;
        }
      }

      // Create user message
      const userMessage: Message = {
        id: uuidv4(),
        text: currentMessage.trim(),
        sender: 'user',
        timestamp: new Date(),
        ...(imageData && { image: imageData }),
      };

      // Add user message to chat
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setCurrentMessage('');
      
      // Clear image after sending
      if (selectedImage) {
        clearSelectedImage();
      }

      // Create a placeholder for the assistant's response
      const assistantMessageId = uuidv4();
      const assistantMessage: Message = {
        id: assistantMessageId,
        text: '',
        sender: 'assistant',
        timestamp: new Date(),
      };

      // Add placeholder message
      const messagesWithAssistant = [...updatedMessages, assistantMessage];
      setMessages(messagesWithAssistant);

      // Start streaming
      setStreaming({
        isStreaming: true,
        partialResponse: '',
      });

      // Get user profile and page context
      const userProfile = getUserProfile();
      const currentPageContext = getCurrentPageContext();
      
      // Stream the response
      let fullResponse = '';
      
      await streamMessageToBotanist(
        updatedMessages, 
        (chunk) => {
          fullResponse += chunk;
          setStreaming(prev => ({
            ...prev,
            partialResponse: fullResponse,
          }));
        },
        userProfile,
        currentPageContext
      );

      // Update the assistant message with the full response
      const finalMessages = messagesWithAssistant.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, text: fullResponse } 
          : msg
      );
      
      setMessages(finalMessages);
      
      // Save chat session to MongoDB
      saveChatSession(finalMessages);
      
      // Process the conversation for knowledge extraction
      processConversationForKnowledge(finalMessages);
      
    } catch (error) {
      console.error('Error getting botanist response:', error);
      toast({
        title: 'Error',
        description: 'Failed to get response from the botanist assistant.',
        variant: 'destructive',
      });

      // Update the assistant message with an error
      setMessages(prev => 
        prev.map(msg => 
          msg.id === prev[prev.length - 1].id
            ? { ...msg, text: 'Sorry, I encountered an error while processing your request. Please try again.' } 
            : msg
        )
      );
    } finally {
      // End streaming
      setStreaming({
        isStreaming: false,
        partialResponse: '',
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Format date for chat history as relative time
  const formatRelativeTime = (date: Date | string) => {
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      
      // Get the relative time using date-fns
      const relativeTime = formatDistanceToNow(dateObj, { addSuffix: false });
      
      // Convert to shorter format
      return relativeTime
        .replace(' seconds', 's')
        .replace(' second', 's')
        .replace(' minutes', 'm')
        .replace(' minute', 'm')
        .replace(' hours', 'h')
        .replace(' hour', 'h')
        .replace(' days', 'd')
        .replace(' day', 'd')
        .replace(' weeks', 'w')
        .replace(' week', 'w')
        .replace(' months', 'mo')
        .replace(' month', 'mo')
        .replace(' years', 'y')
        .replace(' year', 'y')
        .replace('about ', '')
        .replace('less than ', '<')
        .replace('almost ', '~')
        .replace('over ', '>')
        .replace('ago', '');
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Unknown';
    }
  };

  // Get chat preview text
  const getChatPreview = (messages: Message[]) => {
    if (messages.length === 0) return 'New conversation';
    
    // Find the first user message
    const userMessages = messages.filter(msg => msg.sender === 'user');
    if (userMessages.length === 0) return 'New conversation';
    
    // Get the first user message
    const firstUserMessage = userMessages[0].text;
    
    // If it's short enough, use the whole message
    if (firstUserMessage.length <= 30) {
      return firstUserMessage;
    }
    
    // Otherwise, truncate it
    return firstUserMessage.substring(0, 27) + '...';
  };

  // Function to handle chat window open/close
  const handleOpenChange = (open: boolean) => {
    console.log('handleOpenChange called with:', open);
    
    // If trying to close the chat and we should prevent closing
    if (!open && preventClose) {
      console.log('Preventing chat from closing due to preventClose flag');
      setPreventClose(false); // Reset the flag
      return;
    }
    
    // Only update if the state is actually changing
    if (open !== isOpen) {
      console.log('Changing chat window state:', open);
      setIsOpen(open);
      globalAssistantState.isOpen = open;
    }
  };

  // Function to toggle expand/collapse
  const toggleExpand = () => {
    console.log('Toggling expand state from', isExpanded, 'to', !isExpanded);
    setIsExpanded(!isExpanded);
  };

  // Initialize WebRTC service
  useEffect(() => {
    // Initialize the WebRTC service with callbacks
    initWebRTCService(
      // Call state change handler
      (callState: CallState) => {
        setCallStatus(callState.status);
        setCallError(callState.error);
        
        if (callState.status === 'ended') {
          setIsInCall(false);
          globalAssistantState.isInCall = false;
        } else if (callState.status === 'connected') {
          setIsInCall(true);
          globalAssistantState.isInCall = true;
        }
      },
      // Message handler for transcribed text from the bot
      (message: Message) => {
        // Add the assistant message to the chat
        setMessages(prev => [...prev, message]);
      }
    );
    
    // No cleanup needed as the service handles its own cleanup
  }, []);

  // Replace the mock toggleCall function with the real implementation
  const toggleCall = async () => {
    if (isInCall) {
      // End the call
      endCall();
    } else {
      // Start the call
      setIsInCall(true);
      
      try {
        await startCall();
      } catch (error) {
        console.error('Failed to start call:', error);
        setIsInCall(false);
        setCallError((error as Error).message);
      }
    }
  };

  return (
    <ExpandableChat
      position="bottom-right"
      size={isExpanded ? "xl" : "md"}
      icon={<Avatar className="h-10 w-10">
        <AvatarImage src={chatbotIcon} alt="Botanist" />
        <AvatarFallback>🌱</AvatarFallback>
      </Avatar>}
      className="z-50"
      isOpen={isOpen}
      isExpanded={isExpanded}
      onOpenChange={handleOpenChange}
    >
      {/* Use custom header component */}
      <AssistantHeader
        user={user}
        chatHistory={chatHistory}
        isLoadingHistory={isLoadingHistory}
        loadChatSession={(session) => {
          // Set the preventClose flag to true to prevent the chat from closing
          setPreventClose(true);
          loadChatSession(session);
        }}
        deleteChatSession={(sessionId) => {
          // Set the preventClose flag to true to prevent the chat from closing
          setPreventClose(true);
          deleteChatSession(sessionId);
        }}
        startNewChat={() => {
          // Set the preventClose flag to true to prevent the chat from closing
          setPreventClose(true);
          startNewChat();
        }}
        getChatPreview={getChatPreview}
        formatRelativeTime={formatRelativeTime}
        isExpanded={isExpanded}
        onToggleExpand={toggleExpand}
        onClose={() => handleOpenChange(false)}
        currentConversationId={conversationId}
        isInCall={isInCall}
        toggleCall={toggleCall}
      >
        <Avatar className="h-8 w-8">
          <AvatarImage src={chatbotIcon} alt="Botanist" />
          <AvatarFallback>🌱</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h3 className="text-sm font-medium">Greenur Botanist</h3>
          <p className="text-xs text-muted-foreground">Plant Expert</p>
        </div>
      </AssistantHeader>

      <ExpandableChatBody>
        {/* Call UI */}
        {isInCall && (
          <div className="absolute inset-0 z-10 bg-background/95 flex flex-col items-center justify-center">
            <Avatar className="h-20 w-20 mb-4">
              <AvatarImage src={chatbotIcon} alt="Botanist AI" />
              <AvatarFallback><Leaf className="h-8 w-8" /></AvatarFallback>
            </Avatar>
            <h3 className="text-xl font-semibold mb-2">Botanist AI Assistant</h3>
            <p className="text-muted-foreground mb-6">
              {callStatus === 'connecting' && "Connecting..."}
              {callStatus === 'connected' && "Call in progress"}
              {callStatus === 'ended' && callError ? `Call ended: ${callError}` : "Call ended"}
            </p>
            {callStatus === 'connected' && (
              <div className="flex flex-col items-center">
                <div className="w-full max-w-xs bg-primary/10 rounded-lg p-4 mb-4">
                  <p className="text-sm text-center">Talking to Botanist AI. Ask about any plant care questions!</p>
                </div>
                <div className="flex items-center space-x-2 mb-4">
                  <div className="animate-pulse h-2 w-2 bg-green-500 rounded-full"></div>
                  <div className="text-xs text-muted-foreground">Listening...</div>
                </div>
                <Button
                  variant="destructive"
                  size="lg"
                  className="rounded-full"
                  onClick={toggleCall}
                >
                  <PhoneOff className="h-5 w-5 mr-2" />
                  End Call
                </Button>
              </div>
            )}
            {callStatus === 'connecting' && (
              <div className="flex items-center justify-center">
                <div className="animate-pulse h-3 w-3 bg-primary rounded-full mr-1"></div>
                <div className="animate-pulse h-3 w-3 bg-primary rounded-full mr-1" style={{ animationDelay: '0.2s' }}></div>
                <div className="animate-pulse h-3 w-3 bg-primary rounded-full" style={{ animationDelay: '0.4s' }}></div>
              </div>
            )}
            {callStatus === 'ended' && callError && (
              <div className="text-destructive text-sm mt-2 max-w-xs text-center">
                {callError}
              </div>
            )}
          </div>
        )}
        
        <div 
          className="h-full transition-all duration-300 ease-in-out overflow-hidden"
        >
          <ChatMessageList smooth>
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-2 p-4">
                  <Avatar className="h-12 w-12 mx-auto">
                    <AvatarImage src={chatbotIcon} alt="Botanist" className="opacity-50" />
                    <AvatarFallback>🌱</AvatarFallback>
                  </Avatar>
                  <h3 className="text-lg font-medium">Welcome to Greenur Botanist</h3>
                  <p className="text-sm text-muted-foreground">
                    Ask me anything about plants, gardening, or plant care!
                  </p>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <ChatBubble
                  key={message.id}
                  variant={message.sender === 'user' ? 'sent' : 'received'}
                >
                  {message.sender === 'assistant' && (
                    <ChatBubbleAvatar>
                      <AvatarImage src={chatbotIcon} alt="Botanist" />
                      <AvatarFallback>🌱</AvatarFallback>
                    </ChatBubbleAvatar>
                  )}
                  <ChatBubbleMessage
                    isLoading={
                      streaming.isStreaming &&
                      message.id === messages[messages.length - 1].id &&
                      message.sender === 'assistant'
                    }
                  >
                    {/* Image attachment */}
                    {message.image && (
                      <div className="mb-2 mt-1">
                        <div className="relative rounded-md overflow-hidden max-w-[240px]">
                          <img 
                            src={message.image.url} 
                            alt={message.image.alt || "Attached image"}
                            className="w-full h-auto object-cover rounded-md shadow-sm"
                          />
                        </div>
                      </div>
                    )}
                    
                    {/* Message text */}
                    {streaming.isStreaming &&
                    message.id === messages[messages.length - 1].id &&
                    message.sender === 'assistant'
                      ? streaming.partialResponse || 'Thinking...'
                      : message.text}
                  </ChatBubbleMessage>
                </ChatBubble>
              ))
            )}
          </ChatMessageList>
        </div>
      </ExpandableChatBody>

      <ExpandableChatFooter className="p-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex flex-col w-full"
        >
          {/* Image preview area */}
          {imagePreview && (
            <div className="relative mb-2 flex items-center p-2 bg-muted/30 rounded-md">
              <div className="relative rounded-md overflow-hidden w-16 h-16">
                <img 
                  src={imagePreview} 
                  alt="Selected image" 
                  className="object-cover rounded-md w-full h-full"
                />
                <button 
                  type="button"
                  onClick={clearSelectedImage}
                  className="absolute top-1 right-1 bg-black/60 p-1 rounded-full"
                >
                  <X className="h-3 w-3 text-white" />
                </button>
              </div>
              <span className="ml-3 text-xs text-muted-foreground">
                {selectedImage && selectedImage.name ? 
                  (selectedImage.name.length > 20 
                    ? selectedImage.name.substring(0, 20) + '...' 
                    : selectedImage.name)
                  : 'Image'}
              </span>
            </div>
          )}
          
          {/* Voice recording indicator */}
          {isRecording && (
            <div className="flex items-center gap-2 mb-2 mx-2 px-3 py-1.5 bg-red-100 dark:bg-red-900/20 rounded-md">
              <div className="animate-pulse w-2 h-2 bg-red-500 rounded-full"></div>
              <span className="text-xs font-medium text-red-600 dark:text-red-400">
                Recording... {recordingTime}s
              </span>
              <button 
                type="button"
                onClick={stopRecording} 
                className="ml-auto text-red-600 dark:text-red-400"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          
          <div className="relative">
            {/* Hidden file input */}
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleImageSelect}
              accept="image/*"
              className="hidden"
            />
            
            <ChatInput
              ref={inputRef}
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask about plants..."
              disabled={streaming.isStreaming || isRecording}
              className="min-h-10 pr-28 rounded-xl border bg-background/50 backdrop-blur-sm shadow-sm focus-visible:ring-1 focus-visible:ring-ring"
            />
            
            {/* Floating action buttons */}
            <div className="absolute right-3 bottom-3 flex items-center gap-1">
              {/* Attachment button */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={streaming.isStreaming || isRecording}
                title="Attach image"
                className="h-7 w-7 rounded-full"
              >
                <Paperclip className="h-3.5 w-3.5" />
                <span className="sr-only">Attach image</span>
              </Button>
              
              {/* Voice recording button */}
              
              {/* Send button */}
              <Button
                type="submit"
                size="icon"
                disabled={(!currentMessage.trim() && !selectedImage) || streaming.isStreaming}
                className="h-7 w-7 rounded-full"
              >
                <Send className="h-3.5 w-3.5" />
                <span className="sr-only">Send</span>
              </Button>
            </div>
          </div>
        </form>
      </ExpandableChatFooter>
    </ExpandableChat>
  );
}; 