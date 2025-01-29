import { Box, VStack, Text, Spinner, Flex, Image, HStack } from '@chakra-ui/react';

export interface SearchSuggestion {
  id: number;
  name: string;
  type: string;
  scientificName: string;
  image?: string;
  displayName: {
    primary: string;
    secondary: string;
  };
  taxon_photos?: Array<{
    photo: {
      url: string;
      medium_url: string;
      large_url: string;
      attribution?: string;
      license_code?: string;
    };
  }>;
}

interface SearchSuggestionsProps {
  suggestions: SearchSuggestion[];
  onSelect: (suggestion: SearchSuggestion) => void;
  isLoading?: boolean;
  error?: string;
}

export const SearchSuggestions = ({ suggestions, onSelect, isLoading, error }: SearchSuggestionsProps) => {
  if (isLoading) {
    return (
      <Box
        position="absolute"
        top="100%"
        left={0}
        right={0}
        bg="white"
        boxShadow="lg"
        borderRadius="md"
        mt={2}
        zIndex={10}
        maxH="400px"
        overflowY="auto"
      >
        <Flex justify="center" align="center" p={4}>
          <Spinner size="sm" mr={2} />
          <Text>Searching...</Text>
        </Flex>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        position="absolute"
        top="100%"
        left={0}
        right={0}
        bg="white"
        boxShadow="lg"
        borderRadius="md"
        mt={2}
        zIndex={10}
        p={4}
      >
        <Text color="red.500">{error}</Text>
      </Box>
    );
  }

  if (!suggestions.length) {
    return null;
  }

  return (
    <Box
      position="absolute"
      top="100%"
      left={0}
      right={0}
      bg="white"
      boxShadow="lg"
      borderRadius="md"
      mt={2}
      zIndex={10}
      maxH="400px"
      overflowY="auto"
    >
      <VStack spacing={0} align="stretch">
        {suggestions.map((suggestion) => (
          <Box
            key={suggestion.id}
            p={3}
            cursor="pointer"
            _hover={{ bg: 'gray.50' }}
            onClick={() => onSelect(suggestion)}
            borderBottom="1px"
            borderColor="gray.100"
            _last={{ borderBottom: 'none' }}
          >
            <HStack spacing={4}>
              <Image
                src={suggestion.image || '/default-plant.png'}
                alt={suggestion.displayName.primary}
                boxSize="50px"
                objectFit="cover"
                borderRadius="md"
              />
              <VStack align="start" spacing={1}>
                <Text fontSize="sm" fontWeight="medium">
                  {suggestion.displayName.primary}
                </Text>
                <Text fontSize="sm" color="gray.600">
                  {suggestion.displayName.secondary}
                </Text>
              </VStack>
            </HStack>
          </Box>
        ))}
      </VStack>
    </Box>
  );
}; 