import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
  Text,
  useToast,
  PinInput,
  PinInputField,
  HStack,
  Heading,
  Container,
  Flex,
} from '@chakra-ui/react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../../config/firebase'
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  applyActionCode,
} from 'firebase/auth'

export const SignUp = () => {
  const navigate = useNavigate()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showVerification, setShowVerification] = useState(false)

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        status: 'error',
        duration: 3000,
      })
      return
    }

    try {
      setIsLoading(true)
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      
      // Send verification email
      await sendEmailVerification(userCredential.user)
      
      setShowVerification(true)
      toast({
        title: 'Verification Email Sent',
        description: 'Please check your email for the verification code',
        status: 'success',
        duration: 5000,
      })
    } catch (error: any) {
      console.error('Error signing up:', error)
      toast({
        title: 'Error',
        description: error.message,
        status: 'error',
        duration: 5000,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerification = async () => {
    if (verificationCode.length !== 6) return

    try {
      setIsLoading(true)
      await applyActionCode(auth, verificationCode)
      
      toast({
        title: 'Success',
        description: 'Email verified successfully',
        status: 'success',
        duration: 3000,
      })

      // Navigate to onboarding
      navigate('/onboarding')
    } catch (error: any) {
      console.error('Error verifying email:', error)
      toast({
        title: 'Error',
        description: 'Invalid verification code',
        status: 'error',
        duration: 5000,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Container maxW="container.xl" py={10}>
      <Flex h="90vh" alignItems="center" justifyContent="space-between">
        <Box flex="1" pr={20}>
          <Heading
            fontSize="6xl"
            lineHeight="1.2"
            mb={6}
            color="brand.500"
          >
            Join the<br />
            Green Revolution<br />
            with Greenur
          </Heading>
          <Text fontSize="xl" color="gray.600">
            Create your account and start your plant care journey today.
          </Text>
        </Box>

        <Box
          w="full"
          maxW="md"
          p={8}
          borderWidth={1}
          borderRadius="xl"
          boxShadow="xl"
          bg="white"
        >
          {!showVerification ? (
            <form onSubmit={handleSignUp}>
              <VStack spacing={6}>
                <Heading size="lg">Create Account</Heading>
                
                <FormControl isRequired>
                  <FormLabel>Email</FormLabel>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="hi@greenur.in"
                    size="lg"
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>Password</FormLabel>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    size="lg"
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>Confirm Password</FormLabel>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    size="lg"
                  />
                </FormControl>

                <Button
                  type="submit"
                  colorScheme="brand"
                  size="lg"
                  width="full"
                  isLoading={isLoading}
                >
                  Sign Up
                </Button>
              </VStack>
            </form>
          ) : (
            <VStack spacing={6}>
              <Heading size="lg">Verify Email</Heading>
              
              <Text align="center">
                We've sent a verification code to {email}.<br />
                Please enter it below.
              </Text>

              <HStack justify="center">
                <PinInput
                  otp
                  size="lg"
                  value={verificationCode}
                  onChange={setVerificationCode}
                >
                  <PinInputField />
                  <PinInputField />
                  <PinInputField />
                  <PinInputField />
                  <PinInputField />
                  <PinInputField />
                </PinInput>
              </HStack>

              <Button
                colorScheme="brand"
                size="lg"
                width="full"
                onClick={handleVerification}
                isLoading={isLoading}
                isDisabled={verificationCode.length !== 6}
              >
                Verify Email
              </Button>
            </VStack>
          )}
        </Box>
      </Flex>
    </Container>
  )
} 