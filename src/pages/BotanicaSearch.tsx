import {
  Box,
  Container,
  VStack,
  Text,
  Grid,
  GridItem,
  Button,
  useToast,
  Spinner,
  HStack,
  ButtonGroup,
} from '@chakra-ui/react'
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { searchTaxa, getMatchedName, formatDisplayName } from '../services/iNaturalistService'
import { FaArrowLeft } from 'react-icons/fa'
import { SearchBar } from '../components/SearchBar'
import { SearchSuggestions, SearchSuggestion } from '../components/SearchSuggestions'
import { PlantCard } from '../components/plants/PlantCard'
import { getPlantType } from '../utils/plantUtils'

export const BotanicaSearch = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const toast = useToast()

  const query = searchParams.get('q') || ''
  const [searchResults, setSearchResults] = useState<SearchSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalResults, setTotalResults] = useState(0)

  const handleSearch = async (searchQuery: string, page: number = 1) => {
    if (!searchQuery.trim()) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const { results, total_results } = await searchTaxa(searchQuery.trim(), page);
      setTotalResults(total_results);
      
      const processedResults = await Promise.all(
        results
          .filter(plant => plant.matched_term)
          .map(async (plant) => {
            try {
              const detailsResponse = await fetch(
                `https://api.inaturalist.org/v1/taxa/${plant.id}`
              );
              const detailsData = await detailsResponse.json();
              const details = detailsData.results[0];

              const plantType = getPlantType(details.ancestors || []);
              const matchedName = getMatchedName(plant);
              const displayName = formatDisplayName(plant, matchedName, plantType);

              return {
                id: plant.id,
                name: plant.name,
                type: plantType,
                scientificName: plant.name,
                image: plant.default_photo?.medium_url,
                displayName,
                matchedTerm: plant.matched_term,
                taxon_photos: plant.taxon_photos
              };
            } catch (error) {
              console.error(`Error fetching details for plant ${plant.id}:`, error);
              const matchedName = getMatchedName(plant);
              const displayName = formatDisplayName(plant, matchedName, 'Plant');
              
              return {
                id: plant.id,
                name: plant.name,
                type: 'Plant',
                scientificName: plant.name,
                image: plant.default_photo?.medium_url,
                displayName,
                matchedTerm: plant.matched_term,
                taxon_photos: plant.taxon_photos
              };
            }
          })
      );
      setSearchResults(processedResults);
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

  const totalPages = Math.ceil(totalResults / 9);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      window.scrollTo(0, 0);
    }
  };

  const handleImageSearch = async (file: File) => {
    toast({
      title: 'Coming Soon',
      description: 'Image search functionality will be available soon!',
      status: 'info',
      duration: 5000,
    });
  };

  const handleSuggestionSelect = (suggestion: SearchSuggestion) => {
    navigate(`/botanica/plant/${suggestion.id}`, { 
      state: { 
        matchedTerm: suggestion.displayName.primary,
        taxonPhotos: suggestion.taxon_photos,
        displayName: suggestion.displayName
      } 
    });
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
                onImageSelect={() => {}}
                isLoading={isLoading}
                size="md"
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
                      name={plant.displayName.primary}
                      secondaryText={plant.displayName.secondary}
                      imageUrl={plant.image || '/default-plant.png'}
                      onClick={() => navigate(`/botanica/plant/${plant.id}`, {
                        state: {
                          matchedTerm: plant.displayName.primary,
                          taxonPhotos: plant.taxon_photos,
                          displayName: plant.displayName
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
                    Showing {((currentPage - 1) * 9) + 1}-{Math.min(currentPage * 9, totalResults)} of {totalResults}
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