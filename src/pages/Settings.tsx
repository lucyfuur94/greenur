import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Select,
  Stack,
  Switch,
  useToast,
  VStack,
} from '@chakra-ui/react'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../config/firebase'
import { updateEmail } from 'firebase/auth'

export const Settings = () => {
  const { currentUser } = useAuth()
  const toast = useToast()
  
  const [email, setEmail] = useState(currentUser?.email || '')
  const [language, setLanguage] = useState('en')
  const [theme, setTheme] = useState('light')
  const [notifications, setNotifications] = useState(true)
  const [isLoading, setIsLoading] = useState(false)

  const handleEmailChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value
    setEmail(newEmail)
  }

  const handleLanguageChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = e.target.value
    setLanguage(newLanguage)
    
    try {
      if (!currentUser) return;
      
      await updateDoc(doc(db, 'users', currentUser.uid), {
        language: newLanguage
      });
      
      toast({
        title: 'Language updated',
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: 'Error updating language',
        description: 'Please try again',
        status: 'error',
        duration: 3000,
      });
    }
  }

  const handleThemeChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTheme = e.target.value
    setTheme(newTheme)
    
    try {
      if (!currentUser) return;
      
      await updateDoc(doc(db, 'users', currentUser.uid), {
        theme: newTheme
      });
      
      toast({
        title: 'Theme updated',
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: 'Error updating theme',
        description: 'Please try again',
        status: 'error',
        duration: 3000,
      });
    }
  }

  const handleNotificationsChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = e.target.checked
    setNotifications(enabled)
    
    try {
      if (!currentUser) return;
      
      await updateDoc(doc(db, 'users', currentUser.uid), {
        notifications: enabled
      });
      
      toast({
        title: `Notifications ${enabled ? 'enabled' : 'disabled'}`,
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: 'Error updating notification settings',
        description: 'Please try again',
        status: 'error',
        duration: 3000,
      });
    }
  }

  const handleSaveEmail = async () => {
    if (!currentUser || !email || email === currentUser.email) return;
    
    setIsLoading(true);
    try {
      await updateEmail(currentUser, email);
      await updateDoc(doc(db, 'users', currentUser.uid), {
        email
      });
      
      toast({
        title: 'Email updated',
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: 'Error updating email',
        description: 'Please try again later or re-authenticate',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box maxW="container.md" mx="auto" py={8}>
      <VStack spacing={8} align="stretch">
        <Heading>Settings</Heading>

        <Card>
          <CardHeader>
            <Heading size="md">Account Settings</Heading>
          </CardHeader>
          <CardBody>
            <Stack spacing={6}>
              <FormControl>
                <FormLabel>Email</FormLabel>
                <Input
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  placeholder="Enter your email"
                />
                <Button
                  mt={2}
                  colorScheme="brand"
                  size="sm"
                  onClick={handleSaveEmail}
                  isLoading={isLoading}
                  isDisabled={!email || email === currentUser?.email}
                >
                  Update Email
                </Button>
              </FormControl>

              <FormControl>
                <FormLabel>Language</FormLabel>
                <Select value={language} onChange={handleLanguageChange}>
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                  <option value="hi">हिंदी</option>
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>Theme</FormLabel>
                <Select value={theme} onChange={handleThemeChange}>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </Select>
              </FormControl>

              <FormControl display="flex" alignItems="center">
                <FormLabel mb="0">
                  Enable Notifications
                </FormLabel>
                <Switch
                  isChecked={notifications}
                  onChange={handleNotificationsChange}
                  colorScheme="brand"
                />
              </FormControl>
            </Stack>
          </CardBody>
        </Card>
      </VStack>
    </Box>
  )
} 