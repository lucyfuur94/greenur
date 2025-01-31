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
  ModalFooter,
} from '@chakra-ui/react'
import { useState, useRef, useEffect } from 'react'
import { FaCamera } from 'react-icons/fa'
import { analyzePlantImage } from '../services/gptService'
import { useNavigate } from 'react-router-dom'
import { SearchBar } from '../components/SearchBar'
import { SearchSuggestions, SearchSuggestion } from '../components/SearchSuggestions'
import type { PlantAnalysis } from '../types/plant'
import { useCollection } from 'react-firebase-hooks/firestore'
import { collection } from 'firebase/firestore'
import { db } from '../config/firebase'
import { getPlantType } from '../utils/plantUtils'
import { searchTaxa, getMatchedName, formatDisplayName } from '../services/iNaturalistService'

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
      // Always log to terminal
      originalConsoleError.apply(console, args);
      
      // Filter sensitive errors
      const message = args.join(' ');
      if (message.includes('[Navigation] Geolocation error')) {
        return;
      }

      // Log to error array
      errorLogs.push(message);
      
      // Show toast for user-facing errors
      if (!message.includes('[Expected]')) {
        toast({
          title: 'Application Error',
          description: 'Check console for details',
          status: 'error',
          duration: 5000,
        });
      }
    };

    return () => {
      console.error = originalConsoleError;
    };
  }, [toast]);

  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [videos, setVideos] = useState<VideoInfo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showAnalysisPopup, setShowAnalysisPopup] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<PlantAnalysis | null>(null)

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let currentController: AbortController | null = null;
    const delayDebounceFn = setTimeout(() => {
      // Cancel previous request
      if (currentController) {
        currentController.abort();
      }
      
      // Create new controller for this request
      if (searchQuery.trim()) {
        setIsLoading(true);
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

  const handleSearch = async (signal: AbortSignal) => {
    if (!searchQuery.trim()) return;
    
    setError(null);
    setSuggestions([]); // Clear previous results while searching

    if (searchQuery.trim().length < 2) {
      setError('Please enter at least 2 characters to search');
      setIsLoading(false);
      return;
    }

    try {
      const { results } = await searchTaxa(searchQuery.trim(), 1, true);
      
      // Get detailed information for each plant to determine its type
      const plantPromises = results
        .filter(result => result.matched_term)
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
        });

      const processedResults = await Promise.all(plantPromises);
      setSuggestions(processedResults);
      
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

  const handleImageSelect = async (file: File) => {
    try {
      // Check file type first
      const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!supportedTypes.includes(file.type)) {
        toast({
          title: 'Unsupported File Type',
          description: 'Please upload a JPEG, PNG or WebP image',
          status: 'error',
          duration: 5000,
        });
        return;
      }

      // Create image preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Open modal and start analysis
      onOpen();
      setAnalysisResult(null);

      const info = await analyzePlantImage(file);
      console.log('Analysis result:', info);
      setAnalysisResult(info);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to analyze image';
      console.error('Error analyzing image:', error);
      
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleSuggestionSelect = (suggestion: SearchSuggestion) => {
    navigate(`/botanica/plant/${suggestion.id}`, { 
      state: { 
        matchedTerm: suggestion.matchedTerm,
        taxonPhotos: suggestion.taxon_photos
      }
    });
  };

  const [value, loading, errorCollection] = useCollection(
    collection(db, 'plants'),
    {
      snapshotListenOptions: { includeMetadataChanges: true },
    }
  )

  return (
    <Box bg="white" h="calc(100vh - 60px)" pt={0} overflow="hidden" display="flex" flexDirection="column">
      <Container maxW="100vw" width="100%" flex="1" px={{ base: 4, md: 6 }} py={4} overflow="hidden">
        <VStack spacing={6} align="stretch">
          {/* Hero Section */}
          <VStack spacing={4} align="center">
            <Image
              src="/images/plant-line-art.jpg"
              alt="Line art plant illustration"
              maxW="275px"
              mx="auto"
              pt={6}
              pb={6}
            />
            <Text
              fontSize={{ base: "lg", md: "xl" }}
              fontWeight="normal"
              textAlign="center"
              color="gray.800"
              mb={2}
            >
              Discover and learn about plants from around the world
            </Text>
            <Box position="relative" width="100%" maxW="600px" ref={dropdownRef}>
              <SearchBar
                initialValue={searchQuery}
                onSearch={(query) => {
                  setSearchQuery(query);
                  if (!query.trim()) {
                    setSuggestions([]);
                    setError(null);
                    setShowSuggestions(false);
                  }
                }}
                onImageSelect={handleImageSelect}
                isLoading={isLoading}
                placeholder="Search plants by name.."
                size="lg"
              />
              {showSuggestions && (
                <SearchSuggestions
                  suggestions={suggestions}
                  onSelect={handleSuggestionSelect}
                  isLoading={isLoading}
                  error={error || undefined}
                />
              )}
            </Box>
          </VStack>

          {/* Rest of the component ... */}
        </VStack>
      </Container>

      {/* Image Analysis Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Plant Analysis</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {imagePreview && (
              <AspectRatio ratio={4/3} mb={4}>
                <Image 
                  src={imagePreview} 
                  alt="Uploaded plant" 
                  objectFit="contain"
                  backgroundColor="gray.50"
                />
              </AspectRatio>
            )}
            {analysisResult ? (
              <VStack align="stretch" spacing={4}>
                <Box>
                  <Text fontWeight="bold">Common Name:</Text>
                  <Text>{analysisResult.commonName}</Text>
                </Box>
                <Box>
                  <Text fontWeight="bold">Scientific Name:</Text>
                  <Text>{analysisResult.scientificName}</Text>
                </Box>
                <ModalFooter>
                  <Button 
                    colorScheme="green"
                    onClick={() => {
                      if (analysisResult?.commonName) {
                        navigate(`/botanica/search?q=${encodeURIComponent(analysisResult.commonName)}`);
                        onClose();
                      }
                    }}
                  >
                    Search
                  </Button>
                </ModalFooter>
              </VStack>
            ) : (
              <VStack py={8}>
                <Spinner size="xl" color="brand.500" />
                <Text>Analyzing your plant...</Text>
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};