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
import { auth } from '../../config/firebase';
import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export const Login = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      toast({
        title: isSignUp ? 'Account created!' : 'Welcome back!',
        status: 'success',
        duration: 3000,
      });
      navigate('/tracker');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Please check your credentials and try again',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast({
        title: 'Welcome to Greenur!',
        status: 'success',
        duration: 3000,
      });
      navigate('/tracker');
    } catch (error) {
      toast({
        title: 'Error signing in',
        description: 'Please try again',
        status: 'error',
        duration: 3000,
      });
    }
  };

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
            Enter<br />
            the Future<br />
            of Plant Care,<br />
            today
          </Heading>
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
          <VStack spacing={6} align="stretch">
            <Box>
              <Heading size="lg" mb={2}>Get Started</Heading>
              <Text color="gray.600">
                Welcome to Greenur - Let's create your account
              </Text>
            </Box>

            <form onSubmit={handleEmailAuth}>
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
                  {isSignUp ? 'Sign up' : 'Sign in'}
                </Button>
              </VStack>
            </form>

            <Flex align="center" my={4}>
              <Divider />
              <Text px={4} color="gray.500">or</Text>
              <Divider />
            </Flex>

            <Button
              w="full"
              size="lg"
              variant="outline"
              leftIcon={<FcGoogle />}
              onClick={handleGoogleSignIn}
              colorScheme="gray"
            >
              Continue with Google
            </Button>

            <Text textAlign="center">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <Link
                color="brand.500"
                onClick={() => setIsSignUp(!isSignUp)}
                _hover={{ textDecoration: 'none', color: 'brand.600' }}
              >
                {isSignUp ? 'Sign in' : 'Sign up'}
              </Link>
            </Text>
          </VStack>
        </Box>
      </Flex>
    </Container>
  );
}; 