import { Box, Spinner, Text, VStack } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';

const pulse = keyframes`
  0% { transform: scale(0.95); opacity: 0.8; }
  50% { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(0.95); opacity: 0.8; }
`;

interface GlobalLoaderProps {
  message: string;
}

export const GlobalLoader = ({ message }: GlobalLoaderProps) => (
  <Box
    position="fixed"
    top="0"
    left="0"
    right="0"
    bottom="0"
    bg="white"
    display="flex"
    alignItems="center"
    justifyContent="center"
    zIndex="modal"
  >
    <VStack spacing={6} textAlign="center">
      <Spinner
        thickness="3px"
        speed="0.65s"
        emptyColor="gray.200"
        color="green.500"
        size="xl"
        sx={{
          animation: `${pulse} 1.5s ease-in-out infinite`,
        }}
      />
      <Text
        color="gray.600"
        fontSize="lg"
        fontWeight="medium"
        maxW="300px"
        lineHeight="tall"
        transition="opacity 0.3s ease"
      >
        {message}
      </Text>
    </VStack>
  </Box>
); 