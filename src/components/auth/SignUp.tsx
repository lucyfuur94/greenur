import {
  Box,
  Button,
  Container,
  FormControl,
  FormLabel,
  Input,
  VStack,
  Text,
  Link,
  useToast,
  Flex,
  Heading,
  Divider,
} from '@chakra-ui/react';
import { FcGoogle } from 'react-icons/fc';
import { auth, googleProvider } from '../../config/firebase';
import { signInWithPopup, createUserWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

export const SignUp = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      toast({
        title: 'Account created!',
        description: 'Welcome to Greenur',
        status: 'success',
        duration: 3000,
      });
      navigate('/botanica');
    } catch (error) {
      toast({
        title: 'Error creating account',
        description: 'Please try again',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      toast({
        title: 'Welcome to Greenur!',
        status: 'success',
        duration: 3000,
      });
      navigate('/botanica');
    } catch (error) {
      toast({
        title: 'Error signing up',
        description: 'Please try again',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxW="container.xl" py={{ base: 8, md: 10 }}>
      <Flex 
        minH={{ base: "auto", md: "90vh" }}
        direction={{ base: "column", md: "row" }}
        align="center" 
        justify="space-between"
        gap={{ base: 8, md: 0 }}
      >
        <Box flex="1" pr={{ base: 0, md: 20 }}>
          <Heading
            fontSize={{ base: "4xl", md: "6xl" }}
            lineHeight="1.2"
            mb={{ base: 4, md: 6 }}
            color="brand.500"
            textAlign={{ base: "center", md: "left" }}
          >
            Join the<br />
            Green<br />
            Revolution
          </Heading>
          <Text 
            fontSize={{ base: "lg", md: "xl" }} 
            color="gray.600"
            textAlign={{ base: "center", md: "left" }}
          >
            Create an account to start your plant care journey.
          </Text>
        </Box>

        <Box
          w="full"
          maxW="md"
          p={{ base: 6, md: 8 }}
          borderWidth={1}
          borderRadius="xl"
          boxShadow="xl"
          bg="white"
          mx={{ base: 4, md: 0 }}
        >
          <VStack spacing={6} align="stretch">
            <Box>
              <Heading size="lg" mb={2}>Create Account</Heading>
              <Text color="gray.600">
                Already have an account? <Link as={RouterLink} to="/login" color="brand.500">Sign in</Link>
              </Text>
            </Box>

            <form onSubmit={handleEmailSignUp}>
              <VStack spacing={4}>
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

                <Button
                  type="submit"
                  colorScheme="brand"
                  size="lg"
                  width="full"
                  isLoading={loading}
                >
                  Sign Up
                </Button>
              </VStack>
            </form>

            <Divider />

            <Button
              leftIcon={<FcGoogle />}
              onClick={handleGoogleSignIn}
              size="lg"
              width="full"
              variant="outline"
              isLoading={loading}
            >
              Continue with Google
            </Button>
          </VStack>
        </Box>
      </Flex>
    </Container>
  );
}; 