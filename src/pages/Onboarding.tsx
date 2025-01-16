import {
  Box,
  Container,
  VStack,
  Heading,
  Text,
  Button,
  Progress,
  FormControl,
  FormLabel,
  Input,
  Radio,
  RadioGroup,
  Stack,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  Spinner,
} from '@chakra-ui/react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../config/firebase'
import { FaMapMarkerAlt } from 'react-icons/fa'

interface UserPreferences {
  name: string
  experience: 'beginner' | 'intermediate' | 'expert'
  interests: string[]
  gardenType: 'indoor' | 'outdoor' | 'both'
  notifications: boolean
  location?: {
    latitude: number
    longitude: number
    city?: string
    country?: string
    timezone: string
  }
}

export const Onboarding = () => {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [step, setStep] = useState(1)
  const [preferences, setPreferences] = useState<UserPreferences>({
    name: '',
    experience: 'beginner',
    interests: [],
    gardenType: 'indoor',
    notifications: true,
  })
  const [isCompleting, setIsCompleting] = useState(false)
  const [isLoadingLocation, setIsLoadingLocation] = useState(false)

  const totalSteps = 5
  const progress = (step / totalSteps) * 100

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1)
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  const handleComplete = async () => {
    if (!currentUser) {
      toast({
        title: 'Authentication Error',
        description: 'Please sign in to continue.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      return
    }

    setIsCompleting(true)

    try {
      // Create user document reference
      const userRef = doc(db, 'users', currentUser.uid)

      // Prepare user data
      const userData = {
        id: currentUser.uid,
        email: currentUser.email,
        preferences: {
          ...preferences,
          updatedAt: new Date().toISOString()
        },
        onboardingCompleted: true,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      }

      // Save to Firestore with merge option
      await setDoc(userRef, userData, { merge: true })

      // Artificial delay for better UX
      await new Promise(resolve => setTimeout(resolve, 1500))

      toast({
        title: 'Welcome to Greenur!',
        description: "We've personalized your experience based on your preferences.",
        status: 'success',
        duration: 5000,
        isClosable: true,
      })

      navigate('/botanica')
    } catch (error) {
      console.error('Error saving preferences:', error)
      
      let errorMessage = 'Failed to save your preferences.'
      if (error instanceof Error) {
        errorMessage += ` Error: ${error.message}`
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setIsCompleting(false)
    }
  }

  const detectLocation = async () => {
    setIsLoadingLocation(true)
    try {
      // Get user's coordinates
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject)
      })

      // Get timezone
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

      // Reverse geocode to get city and country
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${position.coords.latitude}&lon=${position.coords.longitude}&format=json`
      )
      const data = await response.json()

      setPreferences(prev => ({
        ...prev,
        location: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          city: data.address?.city || data.address?.town || data.address?.village,
          country: data.address?.country,
          timezone
        }
      }))

      toast({
        title: 'Location detected',
        description: "We'll use this to provide better plant care recommendations.",
        status: 'success',
        duration: 3000
      })
    } catch (error) {
      console.error('Error detecting location:', error)
      toast({
        title: 'Location detection failed',
        description: 'Please check your browser settings and try again.',
        status: 'error',
        duration: 5000
      })
    } finally {
      setIsLoadingLocation(false)
    }
  }

  return (
    <Box minH="100vh" bg="gray.50">
      <Container maxW="container.md" py={10}>
        <VStack spacing={8} align="stretch">
          {/* Progress Bar */}
          <Progress
            value={progress}
            size="sm"
            colorScheme="brand"
            borderRadius="full"
          />

          {/* Step 1: Welcome & Name */}
          {step === 1 && (
            <VStack spacing={6} align="stretch">
              <Box>
                <Heading size="xl" color="brand.500" mb={4}>
                  Welcome to Greenur! 🌱
                </Heading>
                <Text fontSize="lg" color="gray.600">
                  Let's personalize your plant care experience. First, tell us your name.
                </Text>
              </Box>
              <FormControl isRequired>
                <FormLabel>What should we call you?</FormLabel>
                <Input
                  size="lg"
                  placeholder="Your name"
                  value={preferences.name}
                  onChange={(e) => setPreferences({ ...preferences, name: e.target.value })}
                />
              </FormControl>
            </VStack>
          )}

          {/* Step 2: Experience Level */}
          {step === 2 && (
            <VStack spacing={6} align="stretch">
              <Box>
                <Heading size="lg" color="brand.500" mb={4}>
                  Your Plant Care Experience
                </Heading>
                <Text fontSize="lg" color="gray.600">
                  Help us understand your gardening expertise.
                </Text>
              </Box>
              <FormControl as="fieldset">
                <RadioGroup
                  value={preferences.experience}
                  onChange={(value) => setPreferences({ ...preferences, experience: value as UserPreferences['experience'] })}
                >
                  <Stack spacing={4}>
                    <Radio value="beginner" size="lg" colorScheme="brand">
                      <Box ml={3}>
                        <Text fontWeight="bold">Beginner</Text>
                        <Text fontSize="sm" color="gray.600">Just starting my plant journey</Text>
                      </Box>
                    </Radio>
                    <Radio value="intermediate" size="lg" colorScheme="brand">
                      <Box ml={3}>
                        <Text fontWeight="bold">Intermediate</Text>
                        <Text fontSize="sm" color="gray.600">Have some experience with plants</Text>
                      </Box>
                    </Radio>
                    <Radio value="expert" size="lg" colorScheme="brand">
                      <Box ml={3}>
                        <Text fontWeight="bold">Expert</Text>
                        <Text fontSize="sm" color="gray.600">Experienced plant enthusiast</Text>
                      </Box>
                    </Radio>
                  </Stack>
                </RadioGroup>
              </FormControl>
            </VStack>
          )}

          {/* Step 3: Garden Type */}
          {step === 3 && (
            <VStack spacing={6} align="stretch">
              <Box>
                <Heading size="lg" color="brand.500" mb={4}>
                  Your Growing Space
                </Heading>
                <Text fontSize="lg" color="gray.600">
                  Tell us about your gardening environment.
                </Text>
              </Box>
              <FormControl as="fieldset">
                <RadioGroup
                  value={preferences.gardenType}
                  onChange={(value) => setPreferences({ ...preferences, gardenType: value as UserPreferences['gardenType'] })}
                >
                  <Stack spacing={4}>
                    <Radio value="indoor" size="lg" colorScheme="brand">
                      <Box ml={3}>
                        <Text fontWeight="bold">Indoor Garden</Text>
                        <Text fontSize="sm" color="gray.600">Growing plants inside your home</Text>
                      </Box>
                    </Radio>
                    <Radio value="outdoor" size="lg" colorScheme="brand">
                      <Box ml={3}>
                        <Text fontWeight="bold">Outdoor Garden</Text>
                        <Text fontSize="sm" color="gray.600">Growing plants in your yard or balcony</Text>
                      </Box>
                    </Radio>
                    <Radio value="both" size="lg" colorScheme="brand">
                      <Box ml={3}>
                        <Text fontWeight="bold">Both Indoor & Outdoor</Text>
                        <Text fontSize="sm" color="gray.600">I grow plants both inside and outside</Text>
                      </Box>
                    </Radio>
                  </Stack>
                </RadioGroup>
              </FormControl>
            </VStack>
          )}

          {/* Step 4: Location */}
          {step === 4 && (
            <VStack spacing={6} align="stretch">
              <Box>
                <Heading size="lg" color="brand.500" mb={4}>
                  Your Location
                </Heading>
                <Text fontSize="lg" color="gray.600">
                  We'll use your location to provide weather-based plant care recommendations.
                </Text>
              </Box>
              <Button
                size="lg"
                colorScheme="brand"
                onClick={detectLocation}
                isLoading={isLoadingLocation}
                leftIcon={<FaMapMarkerAlt />}
              >
                Detect My Location
              </Button>
              {preferences.location && (
                <Box p={4} bg="gray.50" borderRadius="md">
                  <Text><strong>City:</strong> {preferences.location.city || 'Unknown'}</Text>
                  <Text><strong>Country:</strong> {preferences.location.country || 'Unknown'}</Text>
                  <Text><strong>Timezone:</strong> {preferences.location.timezone}</Text>
                </Box>
              )}
            </VStack>
          )}

          {/* Step 5: Notifications */}
          {step === 5 && (
            <VStack spacing={6} align="stretch">
              <Box>
                <Heading size="lg" color="brand.500" mb={4}>
                  Stay Updated
                </Heading>
                <Text fontSize="lg" color="gray.600">
                  Would you like to receive care reminders and tips?
                </Text>
              </Box>
              <FormControl as="fieldset">
                <RadioGroup
                  value={preferences.notifications.toString()}
                  onChange={(value) => setPreferences({ ...preferences, notifications: value === 'true' })}
                >
                  <Stack spacing={4}>
                    <Radio value="true" size="lg" colorScheme="brand">
                      <Box ml={3}>
                        <Text fontWeight="bold">Yes, keep me updated</Text>
                        <Text fontSize="sm" color="gray.600">Get care reminders and plant tips</Text>
                      </Box>
                    </Radio>
                    <Radio value="false" size="lg" colorScheme="brand">
                      <Box ml={3}>
                        <Text fontWeight="bold">No, thanks</Text>
                        <Text fontSize="sm" color="gray.600">I'll check manually</Text>
                      </Box>
                    </Radio>
                  </Stack>
                </RadioGroup>
              </FormControl>
            </VStack>
          )}

          {/* Navigation Buttons */}
          <Stack direction="row" spacing={4} justify="flex-end" pt={6}>
            {step > 1 && (
              <Button
                size="lg"
                variant="outline"
                onClick={handleBack}
                colorScheme="brand"
              >
                Back
              </Button>
            )}
            <Button
              size="lg"
              colorScheme="brand"
              onClick={step === totalSteps ? handleComplete : handleNext}
            >
              {step === totalSteps ? 'Get Started' : 'Next'}
            </Button>
          </Stack>

          {/* Loading Modal */}
          <Modal isOpen={isCompleting} onClose={() => {}} isCentered closeOnOverlayClick={false}>
            <ModalOverlay />
            <ModalContent bg="transparent" boxShadow="none">
              <ModalBody>
                <VStack spacing={6} color="white">
                  <Spinner size="xl" color="brand.500" thickness="4px" />
                  <Text fontSize="lg" fontWeight="medium" color="brand.500">
                    Setting up your personalized experience...
                  </Text>
                </VStack>
              </ModalBody>
            </ModalContent>
          </Modal>
        </VStack>
      </Container>
    </Box>
  )
} 