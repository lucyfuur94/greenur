import { Box, VStack, HStack, Text, Image, Badge } from '@chakra-ui/react';

export interface SearchSuggestion {
  id: number;
  name: string;
  type: string;
  scientificName: string;
  image?: string;
}

export interface SearchSuggestionsProps {
  suggestions: SearchSuggestion[];
  onSelect: (suggestion: SearchSuggestion) => void;
  isLoading?: boolean;
  error?: string;
}

export const SearchSuggestions = ({ 
  suggestions,
  onSelect,
  isLoading,
  error
}: SearchSuggestionsProps) => {
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
      maxH="400px"
      overflowY="auto"
      zIndex={10}
      border="1px"
      borderColor="gray.200"
    >
      {isLoading ? (
        <VStack py={4}>
          <Text>Searching...</Text>
        </VStack>
      ) : error ? (
        <Text p={4} color="gray.500">{error}</Text>
      ) : suggestions.length > 0 ? (
        <VStack spacing={0} align="stretch">
          {suggestions.map((suggestion) => (
            <Box
              key={suggestion.id}
              p={3}
              _hover={{ bg: 'gray.50' }}
              cursor="pointer"
              onClick={() => onSelect(suggestion)}
            >
              <HStack spacing={4}>
                <Image
                  src={suggestion.image || '/default-plant.png'}
                  alt={suggestion.name}
                  boxSize="50px"
                  objectFit="cover"
                  borderRadius="md"
                />
                <VStack align="start" spacing={1}>
                  <Text fontWeight="medium">{suggestion.name}</Text>
                  <HStack spacing={1}>
                    <Text fontSize="sm" color="gray.600">
                      {suggestion.type}
                    </Text>
                    <Text fontSize="sm" color="gray.600" fontStyle="italic">
                      • {suggestion.scientificName}
                    </Text>
                  </HStack>
                </VStack>
              </HStack>
            </Box>
          ))}
        </VStack>
      ) : (
        <Text p={4} color="gray.500">No plants found</Text>
      )}
    </Box>
  );
}; 