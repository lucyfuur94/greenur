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
} from '@chakra-ui/react'
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { searchPlants } from '../services/plantService'
import { FaArrowLeft } from 'react-icons/fa'
import { SearchBar } from '../components/SearchBar'
import { SearchSuggestions, SearchSuggestion } from '../components/SearchSuggestions'
import { PlantCard } from '../components/plants/PlantCard'

export const BotanicaSearch = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const toast = useToast()

  const query = searchParams.get('q') || ''
  const [searchResults, setSearchResults] = useState<SearchSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showSuggestions, setShowSuggestions] = useState(false)

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

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const response = await searchPlants(searchQuery);
      const processedResults = response.results
        .filter(plant => {
          const searchTerm = searchQuery.toLowerCase();
          const commonName = plant.preferred_common_name?.toLowerCase() || '';
          return plant.iconic_taxon_name === "Plantae" && commonName.includes(searchTerm);
        })
        .map(plant => ({
          id: plant.id,
          name: plant.preferred_common_name || plant.name,
          type: getPlantType(plant.ancestors || []),
          image: plant.default_photo?.medium_url,
          scientificName: plant.scientific_name || plant.name,
          tags: []
        }));
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
      handleSearch(query);
    }
  }, [query]);

  const handleImageSearch = async (file: File) => {
    toast({
      title: 'Coming Soon',
      description: 'Image search functionality will be available soon!',
      status: 'info',
      duration: 5000,
    });
  };

  const handleSuggestionSelect = (suggestion: SearchSuggestion) => {
    navigate(`/botanica/plant/${suggestion.id}`);
  };

  return (
    <Box bg="gray.50" minH="100vh" pt={4}>
      <Container maxW="full" px={0}>
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
                onSearch={handleSearch}
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
            <Grid
              templateColumns={{
                base: '1fr',
                md: 'repeat(2, 1fr)',
                lg: 'repeat(3, 1fr)',
              }}
              gap={6}
            >
              {searchResults.map((plant) => (
                <PlantCard
                  key={plant.id}
                  name={plant.name}
                  scientificName={plant.scientificName || ''}
                  imageUrl={plant.image || '/default-plant.png'}
                  type={plant.type}
                  onClick={() => navigate(`/botanica/plant/${plant.id}`)}
                />
              ))}
            </Grid>
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