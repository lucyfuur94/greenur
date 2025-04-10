import {
  Box,
  Container,
  VStack,
  Text,
  Grid,
  Button,
  useToast,
  Spinner,
  HStack,
  ButtonGroup,
} from '@chakra-ui/react'
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FaArrowLeft } from 'react-icons/fa'
import { SearchBar } from '../components/SearchBar'
import { PlantCard } from '../components/plants/PlantCard'

interface SearchResult {
  id: string;
  name: string;
  type: string;
  scientificName: string;
  image: string;
  displayName: string;
  matchedTerm: string;
  taxon_photos: Array<{ url: string }>;
}

interface SearchResponse {
  total: number;
  page: number;
  limit: number;
  results: SearchResult[];
}

export const BotanicaSearch = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const toast = useToast()

  const query = searchParams.get('q') || ''
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalResults, setTotalResults] = useState(0)
  const [itemsPerPage] = useState(9)

  const handleSearch = async (searchQuery: string, page: number = 1) => {
    if (!searchQuery.trim()) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/.netlify/functions/search-plants?q=${encodeURIComponent(searchQuery.trim())}&page=${page}&limit=${itemsPerPage}`);
      
      if (!response.ok) {
        throw new Error('Failed to search plants');
      }

      const data: SearchResponse = await response.json();
      setSearchResults(data.results);
      setTotalResults(data.total);
    } catch (error) {
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
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (query) {
      handleSearch(query, currentPage);
    }
  }, [query, currentPage]);

  const totalPages = Math.ceil(totalResults / itemsPerPage);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      window.scrollTo(0, 0);
    }
  };

  return (
    <Box bg="gray.50" minH="100vh" pt={4}>
      <Container maxW="container.lg" px={4}>
        <VStack spacing={8} align="stretch">
          {/* Header with Back Button and Search */}
          <HStack spacing={4}>
            <Button
              leftIcon={<FaArrowLeft />}
              variant="ghost"
              onClick={() => navigate('/botanica')}
              size="sm"
            >
              Back
            </Button>
            <Box width="100%">
              <SearchBar
                initialValue={query}
                onSearch={(q) => {
                  setCurrentPage(1);
                  handleSearch(q, 1);
                }}
                isLoading={isLoading}
                size="md"
                hideImageUpload={true}
              />
            </Box>
          </HStack>

          {/* Search Results */}
          {isLoading ? (
            <VStack py={8}>
              <Spinner size="xl" color="brand.500" />
              <Text>Searching plants...</Text>
            </VStack>
          ) : error ? (
            <Box p={8} bg="red.50" color="red.600" borderRadius="lg">
              <Text fontWeight="bold">{error}</Text>
            </Box>
          ) : searchResults.length > 0 ? (
            <VStack spacing={4} align="stretch">
              <Box maxH="calc(100vh - 300px)" overflowY="auto" px={2}>
                <Grid
                  templateColumns={{
                    base: '1fr',
                    sm: 'repeat(2, 1fr)',
                    md: 'repeat(3, 1fr)',
                  }}
                  gap={4}
                  pb={4}
                >
                  {searchResults.map((plant) => (
                    <PlantCard
                      key={plant.id}
                      name={plant.name}
                      secondaryText={plant.scientificName}
                      imageUrl={plant.image || '/default-plant.png'}
                      onClick={() => navigate(`/botanica/plant/${plant.id}`, {
                        state: {
                          matchedTerm: plant.matchedTerm,
                          taxon_photos: plant.taxon_photos,
                          displayName: {
                            primary: plant.name,
                            secondary: `${plant.type} • ${plant.scientificName}`
                          }
                        }
                      })}
                    />
                  ))}
                </Grid>
              </Box>

              {/* Pagination */}
              {totalPages > 1 && (
                <HStack justify="center" spacing={4} py={4}>
                  <ButtonGroup variant="outline" spacing={2}>
                    <Button
                      onClick={() => handlePageChange(currentPage - 1)}
                      isDisabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        variant={currentPage === page ? 'solid' : 'outline'}
                        colorScheme={currentPage === page ? 'green' : 'gray'}
                      >
                        {page}
                      </Button>
                    ))}
                    <Button
                      onClick={() => handlePageChange(currentPage + 1)}
                      isDisabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </ButtonGroup>
                  <Text color="gray.600">
                    Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalResults)} of {totalResults}
                  </Text>
                </HStack>
              )}
            </VStack>
          ) : query ? (
            <VStack py={8} spacing={2}>
              <Text fontSize="lg" fontWeight="medium">No plants found</Text>
              <Text color="gray.600">Try searching with a different term</Text>
            </VStack>
          ) : null}
        </VStack>
      </Container>
    </Box>
  );
};