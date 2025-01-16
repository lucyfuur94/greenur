import {
  Box,
  Container,
  Input,
  InputGroup,
  VStack,
  Text,
  Grid,
  GridItem,
  Card,
  CardBody,
  Image,
  Button,
  useToast,
  Spinner,
  HStack,
} from '@chakra-ui/react'
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { searchPlants } from '../services/wikiService'
import { FaArrowLeft } from 'react-icons/fa'

interface SearchResult {
  id: string
  name: string
  type: string
  scientificName: string
  image: string
  hindiName?: string
}

export const BotanicaSearch = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let currentController: AbortController | null = null;
    const delayDebounceFn = setTimeout(() => {
      // Cancel previous request
      if (currentController) {
        currentController.abort();
      }
      
      // Create new controller for this request
      if (searchQuery.trim()) {
        currentController = new AbortController();
        handleSearch(currentController.signal);
      } else {
        setResults([]);
        setError(null);
      }
    }, 300); // Same debounce time as home page

    return () => {
      clearTimeout(delayDebounceFn);
      if (currentController) {
        currentController.abort();
      }
    };
  }, [searchQuery]);

  const handleSearch = async (signal: AbortSignal) => {
    if (!searchQuery.trim()) return;
    
    setError(null);
    setIsLoading(true);
    setResults([]); // Clear previous results while searching

    // Check minimum length requirement
    if (searchQuery.trim().length < 2) {
      setError('Please enter at least 2 characters to search');
      setIsLoading(false);
      return;
    }

    try {
      const searchResults = await searchPlants(searchQuery.trim());
      
      // Convert to our format - we know these fields exist from the SPARQL query
      const processedResults = searchResults.map(r => ({
        id: r.wikiDataId,
        name: r.name.replace(/\b\w/g, c => c.toUpperCase()),
        type: r.type,
        scientificName: r.scientificName,
        image: r.image,
        hindiName: r.hindiName
      })) as SearchResult[];

      setResults(processedResults);
      
      if (processedResults.length === 0 && !signal.aborted) {
        setError('No plants found matching your search');
      }
    } catch (error) {
      if (signal.aborted) return;
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to search plants';
      console.error('Error searching plants:', error);
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
      });
    } finally {
      if (!signal.aborted) {
        setIsLoading(false);
      }
    }
  };

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={8} align="stretch">
        <Button
          leftIcon={<FaArrowLeft />}
          variant="ghost"
          onClick={() => navigate('/botanica')}
          alignSelf="flex-start"
        >
          Back to Search
        </Button>

        <Box>
          <InputGroup size="lg">
            <Input
              placeholder="Search plants by name..."
              value={searchQuery}
              onChange={(e) => {
                const newValue = e.target.value;
                setSearchQuery(newValue);
                if (!newValue.trim()) {
                  setResults([]);
                  setError(null);
                }
              }}
              fontSize="lg"
              py={6}
              boxShadow="sm"
              _focus={{
                boxShadow: 'md',
              }}
            />
          </InputGroup>
        </Box>

        {isLoading ? (
          <VStack py={8} spacing={4}>
            <Spinner />
            <Text>Searching for "{searchQuery}"...</Text>
          </VStack>
        ) : error ? (
          <Text color="gray.600" textAlign="center" py={8}>{error}</Text>
        ) : (
          <Grid templateColumns="repeat(auto-fill, minmax(300px, 1fr))" gap={6}>
            {results.map((plant) => (
              <GridItem key={plant.id}>
                <Card
                  cursor="pointer"
                  onClick={() => navigate(`/botanica/plant/${plant.id}`)}
                  _hover={{ transform: 'translateY(-2px)', shadow: 'md' }}
                  transition="all 0.2s"
                >
                  <CardBody>
                    <VStack spacing={4} align="stretch">
                      <Box
                        height="200px"
                        borderRadius="md"
                        overflow="hidden"
                        bg="gray.100"
                      >
                        <Image
                          src={plant.image}
                          alt={plant.name}
                          width="100%"
                          height="100%"
                          objectFit="cover"
                          fallback={
                            <Box
                              width="100%"
                              height="100%"
                              display="flex"
                              alignItems="center"
                              justifyContent="center"
                            >
                              <Text color="gray.500">No image available</Text>
                            </Box>
                          }
                        />
                      </Box>
                      <Box>
                        <Text fontSize="xl" fontWeight="semibold">
                          {plant.name}
                        </Text>
                        <HStack spacing={2} mt={1}>
                          <Text fontSize="sm" color="gray.600">{plant.type}</Text>
                          <Text fontSize="sm" color="gray.600">•</Text>
                          <Text fontSize="sm" color="gray.600" fontStyle="italic">{plant.scientificName}</Text>
                          {plant.hindiName && (
                            <>
                              <Text fontSize="sm" color="gray.600">•</Text>
                              <Text fontSize="sm" color="gray.600">{plant.hindiName}</Text>
                            </>
                          )}
                        </HStack>
                      </Box>
                    </VStack>
                  </CardBody>
                </Card>
              </GridItem>
            ))}
          </Grid>
        )}
      </VStack>
    </Container>
  );
}; 