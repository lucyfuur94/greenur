import {
  Box,
  Container,
  Input,
  InputGroup,
  InputRightElement,
  VStack,
  Text,
  Grid,
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
  List,
  ListItem,
  useToast,
  Image,
  HStack,
  Spinner,
} from '@chakra-ui/react'
import { useState, useRef, useEffect } from 'react'
import { FaCamera } from 'react-icons/fa'
import { analyzePlantImage } from '../services/gptService'
import { searchPlants } from '../services/wikiService'
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
  difficulty: 'easy' | 'medium' | 'hard'
  tags: string[]
  image?: string
  scientificName?: string
  score?: number
  hindiName?: string
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
        currentController = new AbortController();
        handleSearch(currentController.signal);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
        setError(null);
      }
    }, 300); // Increased debounce time for better performance

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
    setIsSuggestionsLoading(true);
    setSuggestions([]); // Clear previous results while searching

    // Check minimum length requirement
    if (searchQuery.trim().length < 2) {
      setError('Please enter at least 2 characters to search');
      setIsSuggestionsLoading(false);
      return;
    }

    try {
      const results = await searchPlants(searchQuery.trim());
      
      // Convert to suggestions format
      const processedResults = results.map(r => ({
        id: r.wikiDataId,
        name: r.name.replace(/\b\w/g, c => c.toUpperCase()),  // Convert to proper case
        type: r.type,
        scientificName: r.scientificName,
        difficulty: 'medium' as const,
        tags: [],
        image: r.image,
        score: r.score,
        hindiName: r.hindiName
      }));

      // Deduplicate results based on name, type, scientific name and hindi name
      const uniqueResults = processedResults.reduce((acc, current) => {
        const key = `${current.name}-${current.type}-${current.scientificName}-${current.hindiName}`;
        const existing = acc.find(item => 
          `${item.name}-${item.type}-${item.scientificName}-${item.hindiName}` === key
        );
        
        if (!existing) {
          acc.push(current);
        } else {
          // Keep the one with more complete data (has image, score, etc.)
          const currentScore = (current.image ? 1 : 0) + (current.score || 0);
          const existingScore = (existing.image ? 1 : 0) + (existing.score || 0);
          
          if (currentScore > existingScore) {
            const index = acc.indexOf(existing);
            acc[index] = current;
          }
        }
        return acc;
      }, [] as PlantSuggestion[]);

      setSuggestions(uniqueResults);
      setShowSuggestions(uniqueResults.length > 0);
      
      if (uniqueResults.length === 0 && !signal.aborted) {
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
    <Container maxW="container.xl" py={8}>
      <VStack spacing={8} align="stretch" minH="90vh">
        <Box flex={1} display="flex" flexDirection="column" justifyContent="center">
          <Box maxW="3xl" mx="auto" w="full">
            <VStack spacing={8} mb={8}>
              <Text fontSize="xl" color="gray.600" textAlign="center">
                Discover and learn about plants from around the world
              </Text>
            </VStack>

            {/* Search Section */}
            <Box position="relative">
              <form onSubmit={(e) => {
                e.preventDefault();
                if (searchQuery.trim()) {
                  setIsSuggestionsLoading(true);  // Set loading state before navigation
                  navigate(`/botanica/search?q=${encodeURIComponent(searchQuery)}`);
                }
              }}>
                <InputGroup size="lg">
                  <Input
                    placeholder="Search plants by name..."
                    value={searchQuery}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setSearchQuery(newValue);
                      if (newValue.trim()) {
                        setIsSuggestionsLoading(true);
                        setShowSuggestions(true);
                      } else {
                        setSuggestions([]);
                        setShowSuggestions(false);
                        setError(null);
                      }
                    }}
                    onFocus={() => {
                      if (searchQuery.trim()) {
                        setShowSuggestions(true);
                      }
                      setError(null);
                    }}
                    fontSize="lg"
                    py={6}
                    boxShadow="sm"
                    _focus={{
                      boxShadow: 'md',
                    }}
                  />
                  <InputRightElement width="4.5rem" h="full">
                    <Button
                      h="1.75rem"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      isLoading={isSuggestionsLoading}
                    >
                      <FaCamera />
                    </Button>
                  </InputRightElement>
                </InputGroup>
              </form>

              {showSuggestions && searchQuery.trim() && (
                <List
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
                >
                  {isSuggestionsLoading ? (
                    <ListItem px={4} py={3}>
                      <HStack spacing={2} justify="center">
                        <Spinner size="sm" />
                        <Text>Searching for "{searchQuery}"...</Text>
                      </HStack>
                    </ListItem>
                  ) : suggestions.length > 0 ? (
                    suggestions.map((plant) => (
                      <ListItem
                        key={plant.id}
                        px={4}
                        py={3}
                        cursor="pointer"
                        _hover={{ bg: "gray.50" }}
                        onClick={() => navigate(`/botanica/plant/${plant.id}`)}
                      >
                        <HStack spacing={4}>
                          <Image
                            src={plant.image}
                            alt={plant.name}
                            boxSize="50px"
                            objectFit="cover"
                            borderRadius="md"
                            fallback={<Box boxSize="50px" bg="gray.100" borderRadius="md" />}
                          />
                          <Box flex="1">
                            <Text fontWeight="medium">{plant.name}</Text>
                            <VStack spacing={1} align="stretch">
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
                            </VStack>
                          </Box>
                        </HStack>
                      </ListItem>
                    ))
                  ) : error ? (
                    <ListItem px={4} py={3}>
                      <Text color="gray.600" textAlign="center">{error}</Text>
                    </ListItem>
                  ) : null}
                </List>
              )}

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageSelect}
                accept="image/*"
                style={{ display: 'none' }}
              />
            </Box>
          </Box>
        </Box>

        <Modal isOpen={isOpen} onClose={onClose} size="xl">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Plant Information</ModalHeader>
            <ModalCloseButton />
            <ModalBody pb={6}>
              <Tabs>
                <TabList>
                  <Tab>Details</Tab>
                  <Tab>Videos</Tab>
                  <Tab>Resources</Tab>
                </TabList>

                <TabPanels>
                  <TabPanel>
                    {imagePreview && (
                      <Box mb={4}>
                        <Image
                          src={imagePreview}
                          alt="Analyzed plant"
                          borderRadius="md"
                          maxH="300px"
                          w="100%"
                          objectFit="cover"
                        />
                      </Box>
                    )}
                    
                    {plantInfo && (
                      <VStack align="stretch" spacing={4}>
                        <Box>
                          <Text fontWeight="bold">Plant Type:</Text>
                          <Text>{plantInfo.plantType}</Text>
                        </Box>
                        <Box>
                          <Text fontWeight="bold">Growth Stage:</Text>
                          <Text>{plantInfo.growthStage}</Text>
                        </Box>
                        <Box>
                          <Text fontWeight="bold">Growing Conditions:</Text>
                          <Text>{plantInfo.growingConditions}</Text>
                        </Box>
                        <Box>
                          <Text fontWeight="bold">Care Plan:</Text>
                          <Text>{plantInfo.carePlan}</Text>
                        </Box>
                      </VStack>
                    )}
                  </TabPanel>

                  <TabPanel>
                    <VStack spacing={4}>
                      {videos.map((video) => (
                        <Box key={video.videoId} width="100%">
                          <AspectRatio ratio={16 / 9}>
                            <iframe
                              src={`https://www.youtube.com/embed/${video.videoId}`}
                              title={video.title}
                              allowFullScreen
                            />
                          </AspectRatio>
                          <Text mt={2} fontWeight="bold">{video.title}</Text>
                          <Text color="gray.500">{video.category}</Text>
                        </Box>
                      ))}
                    </VStack>
                  </TabPanel>

                  <TabPanel>
                    <VStack align="stretch" spacing={4}>
                      <Text>Additional resources and articles will be displayed here.</Text>
                    </VStack>
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </ModalBody>
          </ModalContent>
        </Modal>

        <Grid templateColumns="repeat(auto-fill, minmax(250px, 1fr))" gap={6}>
          {/* TODO: Add search results */}
        </Grid>
      </VStack>
    </Container>
  )
} 