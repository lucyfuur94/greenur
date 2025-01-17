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
    <Container 
      maxW={{ base: 'full', md: 'container.xl' }} 
      px={{ base: 2, md: 6 }}
      centerContent
    >
      <VStack 
        spacing={{ base: 4, md: 6 }} 
        width="full" 
        alignItems="stretch"
      >
        <Button
          leftIcon={<FaArrowLeft />}
          variant="ghost"
          onClick={() => navigate('/botanica')}
          alignSelf="flex-start"
          mb={2}
        >
          Back to Search
        </Button>

        <InputGroup 
          size={{ base: 'md', md: 'lg' }}
          width="full"
        >
          <Input 
            placeholder="Search plants..." 
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
            fontSize={{ base: 'sm', md: 'md' }}
            height={{ base: '48px', md: 'auto' }}
          />
        </InputGroup>

        {isLoading ? (
          <VStack py={8} spacing={4}>
            <Spinner size="xl" />
            <Text fontSize="lg">Searching for "{searchQuery}"...</Text>
          </VStack>
        ) : error ? (
          <Text color="gray.600" textAlign="center" py={8}>{error}</Text>
        ) : (
          <VStack spacing={8} align="stretch">
            {/* Responsive grid for search results */}
            <Grid 
              templateColumns={{ 
                base: 'repeat(2, 1fr)', 
                md: 'repeat(3, 1fr)', 
                lg: 'repeat(4, 1fr)' 
              }}
              gap={{ base: 2, md: 4 }}
              width="full"
            >
              {results.map((result) => (
                <GridItem key={result.id}>
                  <Card 
                    variant="outline" 
                    size={{ base: 'sm', md: 'md' }}
                    height="full"
                    cursor="pointer"
                    _hover={{ 
                      transform: 'scale(1.02)', 
                      transition: 'transform 0.2s ease-in-out' 
                    }}
                    onClick={() => navigate(`/botanica/plant/${result.id}`)}
                  >
                    <CardBody 
                      display="flex" 
                      flexDirection="column" 
                      alignItems="center"
                      p={{ base: 2, md: 4 }}
                    >
                      <Image 
                        src={result.image_url || '/default-plant.png'}
                        alt={result.name}
                        boxSize={{ base: '100px', md: '150px' }}
                        objectFit="cover"
                        borderRadius="md"
                      />
                      <Text 
                        mt={2} 
                        fontSize={{ base: 'xs', md: 'sm' }}
                        textAlign="center"
                      >
                        {result.preferred_common_name || result.name}
                      </Text>
                    </CardBody>
                  </Card>
                </GridItem>
              ))}
            </Grid>

            {/* Responsive pagination */}
            <HStack 
              justifyContent="center" 
              spacing={{ base: 2, md: 4 }}
              width="full"
              mt={{ base: 2, md: 4 }}
            >
              <ButtonGroup 
                size={{ base: 'sm', md: 'md' }} 
                variant="outline"
              >
                <Button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  isDisabled={currentPage === 1}
                  width={{ base: '80px', md: 'auto' }}
                >
                  Previous
                </Button>
                <Button 
                  isDisabled={true}
                  width={{ base: '80px', md: 'auto' }}
                >
                  Page {currentPage} of {totalPages}
                </Button>
                <Button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  isDisabled={currentPage === totalPages}
                  width={{ base: '80px', md: 'auto' }}
                >
                  Next
                </Button>
              </ButtonGroup>
            </HStack>
          </VStack>
        )}
      </VStack>
    </Container>
  )
}