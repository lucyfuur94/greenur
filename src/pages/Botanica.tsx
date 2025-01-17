import {
  Box,
  Container,
  Input,
  InputGroup,
  InputRightElement,
  VStack,
  Text,
  Button,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  AspectRatio,
  useToast,
  Image,
  HStack,
  Spinner,
  Badge,
  List,
  ListItem,
  Grid,
  GridItem,
  Card,
  CardBody,
} from '@chakra-ui/react'
import { useState, useRef, useEffect } from 'react'
import { FaCamera } from 'react-icons/fa'
import { analyzePlantImage } from '../services/gptService'
import { useNavigate } from 'react-router-dom'

interface PlantInfo {
  plantType: string
  growthStage: string
  growingConditions: string
  carePlan: string
}

interface PlantSuggestion {
  id: string
  name: string
  type: string
  scientificName?: string
  image?: string
  tags: string[]
}

interface VideoInfo {
  title: string
  videoId: string
  thumbnail: string
  category: 'tutorial' | 'timelapse' | 'creative'
}

export const Botanica = () => {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const navigate = useNavigate()
  
  // Add console error handler
  useEffect(() => {
    const originalConsoleError = console.error;
    const errorLogs: string[] = [];

    console.error = (...args) => {
      // Log to our array
      errorLogs.push(args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' '));
      
      // Still call original console.error
      originalConsoleError.apply(console, args);
      
      // Show toast for new errors
      if (errorLogs.length > 0) {
        toast({
          title: 'Console Error Detected',
          description: `Check console for details. Latest error: ${errorLogs[errorLogs.length - 1].slice(0, 100)}...`,
          status: 'warning',
          duration: 5000,
          isClosable: true,
        });
      }
    };

    // Cleanup
    return () => {
      console.error = originalConsoleError;
    };
  }, [toast]);

  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<PlantSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [plantInfo, setPlantInfo] = useState<PlantInfo | null>(null)
  const [videos, setVideos] = useState<VideoInfo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false)

  useEffect(() => {
    let currentController: AbortController | null = null;
    const delayDebounceFn = setTimeout(() => {
      // Cancel previous request
      if (currentController) {
        currentController.abort();
      }
      
      // Create new controller for this request
      if (searchQuery.trim()) {
        setIsSuggestionsLoading(true);
        setShowSuggestions(true);
        currentController = new AbortController();
        handleSearch(currentController.signal);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
        setError(null);
      }
    }, 300);

    return () => {
      clearTimeout(delayDebounceFn);
      if (currentController) {
        currentController.abort();
      }
    };
  }, [searchQuery]);

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

  const handleSearch = async (signal: AbortSignal) => {
    if (!searchQuery.trim()) return;
    
    setError(null);
    setSuggestions([]); // Clear previous results while searching

    // Check minimum length requirement
    if (searchQuery.trim().length < 2) {
      setError('Please enter at least 2 characters to search');
      setIsSuggestionsLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(searchQuery.trim())}&per_page=20&iconic_taxa=Plantae`,
        { signal }
      );
      
      if (!response.ok) {
        throw new Error('Failed to search plants');
      }

      const data = await response.json();
      
      // Get detailed information for each plant to determine its type
      const plantPromises = data.results
        .filter((result: any) => {
          // Only include results where the common name matches the search term
          const searchTerm = searchQuery.trim().toLowerCase();
          const commonName = result.preferred_common_name?.toLowerCase() || '';
          return result.iconic_taxon_name === "Plantae" && commonName.includes(searchTerm);
        })
        .map(async (plant: any) => {
          try {
            const detailsResponse = await fetch(
              `https://api.inaturalist.org/v1/taxa/${plant.id}`
            );
            const detailsData = await detailsResponse.json();
            const details = detailsData.results[0];
            
            return {
              id: plant.id.toString(),
              name: plant.preferred_common_name || plant.name,
              type: getPlantType(details.ancestors || []),
              scientificName: plant.name,
              image: plant.default_photo?.medium_url,
              tags: [details.establishment_means, details.preferred_establishment_means].filter(Boolean)
            };
          } catch (error) {
            console.error(`Error fetching details for plant ${plant.id}:`, error);
            return {
              id: plant.id.toString(),
              name: plant.preferred_common_name || plant.name,
              type: 'Plant',
              scientificName: plant.name,
              image: plant.default_photo?.medium_url,
              tags: []
            };
          }
        });

      const processedResults = await Promise.all(plantPromises);
      
      // Format names to title case
      const formattedResults = processedResults.map(result => ({
        ...result,
        name: result.name
          .toLowerCase()
          .split(' ')
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' '),
        scientificName: result.scientificName
          .toLowerCase()
          .split(' ')
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
      }));

      setSuggestions(formattedResults);
      setShowSuggestions(formattedResults.length > 0);
      
      if (formattedResults.length === 0 && !signal.aborted) {
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
        setIsSuggestionsLoading(false);
      }
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
      
      try {
        setIsSuggestionsLoading(true)
        
        // Analyze the plant directly
        const analysis = await analyzePlantImage(file)
        setPlantInfo(analysis)

        // TODO: Fetch related videos
        const mockVideos: VideoInfo[] = [
          {
            title: 'How to Care for Your Plant',
            videoId: 'example1',
            thumbnail: 'https://img.youtube.com/vi/example1/0.jpg',
            category: 'tutorial'
          },
        ]
        setVideos(mockVideos)

        onOpen()
      } catch (error) {
        console.error('Error analyzing image:', error)
        toast({
          title: 'Error',
          description: 'Failed to analyze the plant image. Please try again.',
          status: 'error',
          duration: 5000,
        })
      } finally {
        setIsSuggestionsLoading(false)
      }
    }
  }

  // Add weather-based recommendations
  const [weatherInfo, setWeatherInfo] = useState<{
    temp: number;
    humidity: number;
    description: string;
  } | null>(null)

  const getWeatherRecommendations = async (latitude: number, longitude: number) => {
    try {
      const response = await fetch(
        `/.netlify/functions/get-weather?lat=${latitude}&lon=${longitude}`
      )
      if (!response.ok) throw new Error('Failed to fetch weather data')
      
      const data = await response.json()
      setWeatherInfo(data)
      
      // Add weather-specific care instructions to plantInfo if available
      if (plantInfo) {
        const weatherBasedCare = generateWeatherBasedCare(data, plantInfo)
        setPlantInfo(prev => ({
          ...prev!,
          carePlan: prev!.carePlan + '\n\nWeather-based recommendations:\n' + weatherBasedCare
        }))
      }
    } catch (error) {
      console.error('Error fetching weather:', error)
    }
  }

  const generateWeatherBasedCare = (weather: typeof weatherInfo, plant: PlantInfo) => {
    if (!weather) return ''

    const recommendations: string[] = []
    const plantType = plant.plantType.toLowerCase()

    // Temperature recommendations
    if (weather.temp > 30) {
      recommendations.push('• High temperature alert: Increase watering frequency and provide shade if possible')
      if (plantType.includes('succulent') || plantType.includes('cactus')) {
        recommendations.push('• Your plant is heat-tolerant but still needs protection from extreme heat')
      } else if (plantType.includes('tropical')) {
        recommendations.push('• Mist tropical plants frequently in high temperatures')
      }
    } else if (weather.temp < 10) {
      recommendations.push('• Low temperature alert: Move sensitive plants indoors or provide frost protection')
      if (plantType.includes('tropical')) {
        recommendations.push('• Tropical plants are particularly sensitive to cold - move indoors immediately')
      }
    }

    // Humidity recommendations
    if (weather.humidity < 40) {
      recommendations.push('• Low humidity alert: Consider using a humidifier or misting your plants')
      if (plantType.includes('tropical') || plantType.includes('fern')) {
        recommendations.push('• Your plant prefers high humidity - group plants together or use a pebble tray')
      }
    } else if (weather.humidity > 80) {
      recommendations.push('• High humidity alert: Ensure good air circulation to prevent fungal growth')
      if (plantType.includes('succulent') || plantType.includes('cactus')) {
        recommendations.push('• Your plant prefers lower humidity - improve air circulation and reduce watering')
      }
    }

    return recommendations.join('\n')
  }

  // Get weather data when plant info is displayed
  useEffect(() => {
    if (plantInfo) {
      // Get user's location for weather data
      navigator.geolocation.getCurrentPosition(
        position => {
          getWeatherRecommendations(position.coords.latitude, position.coords.longitude)
        },
        error => {
          console.error('Error getting location:', error)
        }
      )
    }
  }, [plantInfo])

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
        {/* Mobile-Friendly Hero Image */}
        <Box 
          width="full" 
          height={{ base: '200px', md: '300px' }} 
          overflow="hidden" 
          borderRadius="md"
        >
          <Image 
            src="https://img.freepik.com/premium-vector/single-one-line-drawing-plants-herbs-concept-continuous-line-draw-design-graphic-vector-illustration_638785-2231.jpg"
            alt="Line art plant illustration"
            width="full"
            height="full"
            objectFit="cover"
            objectPosition="center"
          />
        </Box>

        {/* Mobile-Optimized Title */}
        <Text 
          fontSize={{ base: 'xl', md: '2xl' }} 
          fontWeight="medium" 
          textAlign="center" 
          color="gray.700" 
          whiteSpace="normal"
          px={2}
        >
          Discover and learn about plants from around the world
        </Text>

        {/* Search Input with Camera */}
        <Box position="relative" width="full">
          <form onSubmit={(e) => {
            e.preventDefault();
            if (searchQuery.trim()) {
              navigate(`/botanica/search?q=${encodeURIComponent(searchQuery.trim())}`);
            }
          }}>
            <InputGroup 
              size={{ base: 'md', md: 'lg' }}
              width="full"
            >
              <Input 
                placeholder="Search plants by name..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                fontSize={{ base: 'sm', md: 'md' }}
                height={{ base: '48px', md: 'auto' }}
                borderColor="green.300"
                _focus={{ 
                  borderColor: 'green.500', 
                  boxShadow: 'outline' 
                }}
              />
              <InputRightElement 
                width={{ base: '3rem', md: '4rem' }}
                height="full"
              >
                <Button 
                  variant="ghost" 
                  onClick={() => fileInputRef.current?.click()}
                  p={0}
                  size={{ base: 'sm', md: 'md' }}
                  color="green.500"
                  _hover={{ color: 'green.600' }}
                >
                  <FaCamera 
                    size={{ base: 16, md: 24 }} 
                  />
                </Button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                  accept="image/*"
                  style={{ display: 'none' }}
                />
              </InputRightElement>
            </InputGroup>
          </form>
        </Box>

        {/* Responsive Plant Suggestions */}
        <Grid 
          templateColumns={{ 
            base: 'repeat(2, 1fr)', 
            md: 'repeat(3, 1fr)', 
            lg: 'repeat(4, 1fr)' 
          }}
          gap={{ base: 2, md: 4 }}
          width="full"
        >
          {suggestions.map((plant) => (
            <GridItem key={plant.id}>
              <Card 
                variant="outline" 
                size={{ base: 'sm', md: 'md' }}
                height="full"
                cursor="pointer"
                _hover={{ 
                  transform: 'scale(1.02)', 
                  transition: 'transform 0.2s ease-in-out',
                  boxShadow: 'md'
                }}
                onClick={() => navigate(`/botanica/plant/${plant.id}`)}
              >
                <CardBody 
                  display="flex" 
                  flexDirection="column" 
                  alignItems="center"
                  p={{ base: 2, md: 4 }}
                >
                  <Box 
                    width="full" 
                    height={{ base: '120px', md: '180px' }} 
                    borderRadius="md" 
                    overflow="hidden"
                  >
                    <Image 
                      src={plant.image || '/default-plant.png'}
                      alt={plant.name}
                      width="full"
                      height="full"
                      objectFit="cover"
                      objectPosition="center"
                      fallback={
                        <Box 
                          width="full" 
                          height="full" 
                          bg="gray.100" 
                          display="flex" 
                          alignItems="center" 
                          justifyContent="center"
                        >
                          <Text color="gray.500" fontSize="sm">No Image</Text>
                        </Box>
                      }
                    />
                  </Box>
                  <VStack 
                    spacing={1} 
                    mt={2} 
                    width="full" 
                    alignItems="center"
                  >
                    <Text 
                      fontSize={{ base: 'xs', md: 'sm' }} 
                      fontWeight="medium" 
                      textAlign="center"
                      noOfLines={2}
                    >
                      {plant.name}
                    </Text>
                    {plant.scientificName && (
                      <Text 
                        fontSize={{ base: 'x-small', md: 'xs' }} 
                        color="gray.500" 
                        fontStyle="italic"
                        textAlign="center"
                        noOfLines={1}
                      >
                        {plant.scientificName}
                      </Text>
                    )}
                    <HStack 
                      spacing={1} 
                      mt={1} 
                      width="full" 
                      justifyContent="center"
                    >
                      {plant.tags.slice(0, 2).map((tag) => (
                        <Badge 
                          key={tag} 
                          colorScheme="green" 
                          size="sm" 
                          variant="subtle"
                          fontSize={{ base: 'x-small', md: 'xs' }}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </HStack>
                  </VStack>
                </CardBody>
              </Card>
            </GridItem>
          ))}
        </Grid>
      </VStack>
    </Container>
  )
}