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
  ButtonGroup,
} from '@chakra-ui/react'
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { searchPlants } from '../services/plantService'
import { FaArrowLeft } from 'react-icons/fa'

interface SearchResult {
  id: number
  name: string
  preferred_common_name?: string
  type: string
  image_url?: string
}

export const BotanicaSearch = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const getPlantType = (ancestors: Array<{ name: string; rank: string }>) => {
    // Look for common plant types in the ancestry
    const typeMap: { [key: string]: string } = {
      'angiosperms': 'Flowering Plant',
      'eudicots': 'Flowering Plant',
      'monocots': 'Flowering Plant',
      'asterids': 'Flowering Plant',
      'rosids': 'Flowering Plant',
      'magnoliids': 'Flowering Plant',
      'gymnosperms': 'Conifer',
      'ferns': 'Fern',
      'mosses': 'Moss',
      'algae': 'Algae',
      'fungi': 'Fungus',
      'solanales': 'Vegetable/Fruit',
      'fabales': 'Legume',
      'poales': 'Grass/Grain',
      'asparagales': 'Ornamental',
      'arecales': 'Palm',
      'pinales': 'Conifer',
      'lamiales': 'Herb/Ornamental'
    };

    for (const ancestor of ancestors) {
      const name = ancestor.name.toLowerCase();
      for (const [key, value] of Object.entries(typeMap)) {
        if (name.includes(key)) {
          return value;
        }
      }
    }

    return 'Plant';
  };

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
    }, 300);

    return () => {
      clearTimeout(delayDebounceFn);
      if (currentController) {
        currentController.abort();
      }
    };
  }, [searchQuery, currentPage]);

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
      const response = await searchPlants(searchQuery.trim(), currentPage);
      
      // Process the results to include type information
      const processedResults = response.results.map(plant => ({
        id: plant.id,
        name: plant.name,
        preferred_common_name: plant.preferred_common_name,
        type: getPlantType(plant.ancestors || []),
        image_url: plant.default_photo?.medium_url
      }));

      setResults(processedResults);
      setTotalPages(Math.ceil(response.total_results / response.per_page));
      
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
    <Container maxW="60%" py={8}>
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
                setCurrentPage(1);
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
            <Spinner size="xl" />
            <Text fontSize="lg">Searching for "{searchQuery}"...</Text>
          </VStack>
        ) : error ? (
          <Text color="gray.600" textAlign="center" py={8}>{error}</Text>
        ) : (
          <VStack spacing={8} align="stretch">
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
                            src={plant.image_url}
                            alt={plant.preferred_common_name || plant.name}
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
                            {plant.preferred_common_name || plant.name}
                          </Text>
                          <HStack spacing={2} mt={1}>
                            <Text fontSize="sm" color="gray.600">{plant.type}</Text>
                            <Text fontSize="sm" color="gray.600">•</Text>
                            <Text fontSize="sm" color="gray.600" fontStyle="italic">{plant.name}</Text>
                          </HStack>
                        </Box>
                      </VStack>
                    </CardBody>
                  </Card>
                </GridItem>
              ))}
            </Grid>

            {totalPages > 1 && (
              <ButtonGroup spacing={2} justifyContent="center">
                <Button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  isDisabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Text alignSelf="center">
                  Page {currentPage} of {totalPages}
                </Text>
                <Button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  isDisabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </ButtonGroup>
            )}
          </VStack>
        )}
      </VStack>
    </Container>
  );
}; 