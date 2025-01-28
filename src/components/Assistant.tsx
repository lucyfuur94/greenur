import {
  IconButton,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  useDisclosure,
  Avatar,
  VStack,
  HStack,
  Text,
  Box,
  Input,
  Button,
  useToast,
} from '@chakra-ui/react'
import { FaRobot, FaPaperPlane } from 'react-icons/fa'
import { useState } from 'react'

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

export interface AssistantProps {
  name?: string;
  avatar?: string;
  status?: 'active' | 'idle' | 'offline';
}

export const Assistant = ({
  name = 'Plant Care Assistant',
  avatar = '/assistant-avatar.png',
  status = 'active',
}: AssistantProps) => {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [messages, setMessages] = useState<Message[]>([])
  const [currentMessage, setCurrentMessage] = useState('')
  const toast = useToast()

  const statusColors = {
    active: 'green.500',
    idle: 'orange.500',
    offline: 'gray.500',
  }

  const handleSendMessage = async () => {
    if (!currentMessage.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: currentMessage,
      sender: 'user',
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setCurrentMessage('')

    // TODO: Implement actual AI response
    // For now, just show a placeholder response
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "I'm here to help you with your plant care questions! However, I'm still learning and not fully functional yet.",
        sender: 'assistant',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, assistantMessage])
    }, 1000)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <>
      <IconButton
        aria-label="Open AI Assistant"
        icon={<FaRobot size="20" />}
        position="fixed"
        bottom="4"
        right="4"
        size="lg"
        colorScheme="brand"
        rounded="full"
        shadow="lg"
        onClick={onOpen}
        zIndex={2}
      >
        <Box
          position="absolute"
          top="-1"
          right="-1"
          width="3"
          height="3"
          bg={statusColors[status]}
          rounded="full"
          border="2px"
          borderColor="white"
        />
      </IconButton>
      <Drawer
        isOpen={isOpen}
        placement="right"
        onClose={onClose}
        size="md"
      >
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth="1px">
            <HStack spacing={3}>
              <Avatar
                size="sm"
                name={name}
                src={avatar}
                bg="brand.500"
              />
              <VStack spacing={0} align="start">
                <Text fontWeight="bold">{name}</Text>
                <Text fontSize="xs" color={statusColors[status]}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
              </VStack>
            </HStack>
          </DrawerHeader>
          <DrawerBody>
            <VStack h="full" spacing={4}>
              <Box flex="1" w="full" overflowY="auto">
                <VStack spacing={4} align="stretch" p={2}>
                  {messages.map(message => (
                    <Box
                      key={message.id}
                      alignSelf={message.sender === 'user' ? 'flex-end' : 'flex-start'}
                      maxW="80%"
                    >
                      <Box
                        bg={message.sender === 'user' ? 'brand.500' : 'gray.100'}
                        color={message.sender === 'user' ? 'white' : 'black'}
                        p={3}
                        rounded="lg"
                      >
                        <Text>{message.text}</Text>
                      </Box>
                      <Text
                        fontSize="xs"
                        color="gray.500"
                        textAlign={message.sender === 'user' ? 'right' : 'left'}
                        mt={1}
                      >
                        {message.timestamp.toLocaleTimeString()}
                      </Text>
                    </Box>
                  ))}
                </VStack>
              </Box>
              <HStack w="full" spacing={2}>
                <Input
                  placeholder="Ask about plant care..."
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                />
                <Button
                  colorScheme="brand"
                  onClick={handleSendMessage}
                  isDisabled={!currentMessage.trim()}
                >
                  <FaPaperPlane />
                </Button>
              </HStack>
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  )
} 