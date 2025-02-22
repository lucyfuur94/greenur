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
  Center,
} from '@chakra-ui/react'
import { useState, useRef, useEffect } from 'react'
import { FaCamera, FaBook } from 'react-icons/fa'
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
import { PlantCatalog } from '../components/plants/PlantCatalog'

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

interface PlantSearchResult {
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
  results: PlantSearchResult[];
}

export const Botanica = () => {
  const { 
    isOpen: isImageModalOpen, 
    onOpen: onImageModalOpen, 
    onClose: onImageModalClose 
  } = useDisclosure()
  const {
    isOpen: isCatalogOpen,
    onOpen: onCatalogOpen,
    onClose: onCatalogClose
  } = useDisclosure()
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
  const [isSearchEnabled, setIsSearchEnabled] = useState(false);
  const [detectedPlantId, setDetectedPlantId] = useState<string | null>(null);

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
      const response = await fetch(
        `/.netlify/functions/search-plants?q=${encodeURIComponent(searchQuery.trim())}&page=1&limit=5`,
        { signal }
      );
      
      if (!response.ok) {
        throw new Error('Failed to search plants');
      }

      const data: SearchResponse = await response.json();
      const processedResults = data.results.map((plant: PlantSearchResult) => ({
        id: plant.id,
        name: plant.name,
        type: plant.type,
        scientificName: plant.scientificName,
        image: plant.image,
        displayName: {
          primary: plant.name,
          secondary: `${plant.type} • ${plant.scientificName}`
        },
        matchedTerm: plant.matchedTerm,
        taxon_photos: plant.taxon_photos
      }));
      
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

  const checkAndAddPlantToCatalog = async (plantName: string, scientificName: string) => {
    try {
      // First check if plant exists
      const searchResponse = await fetch(
        `/.netlify/functions/search-plants?q=${encodeURIComponent(plantName.trim())}&page=1&limit=1`
      );
      
      if (!searchResponse.ok) {
        throw new Error('Failed to search plant catalog');
      }

      const searchData = await searchResponse.json();
      
      // If plant not found, add it to catalog
      if (searchData.results.length === 0) {
        const addResponse = await fetch('/.netlify/functions/add-plant', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ plantName, scientificName })
        });

        if (!addResponse.ok) {
          throw new Error('Failed to add plant to catalog');
        }

        const addData = await addResponse.json();
        setDetectedPlantId(addData._id);

        toast({
          title: 'New Plant Detected!',
          description: `${plantName} has been added to our plant catalog.`,
          status: 'success',
          duration: 5000,
        });
      } else {
        setDetectedPlantId(searchData.results[0].id);
      }
      
      setIsSearchEnabled(true);
    } catch (error) {
      console.error('Error checking/adding plant:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to process plant catalog operation',
        status: 'error',
        duration: 5000,
      });
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
      reader.onloadend = async () => {
        setImagePreview(reader.result as string);
        setIsLoading(true);
        setError(null);
        setIsSearchEnabled(false);
        setDetectedPlantId(null);
        onImageModalOpen();
        
        try {
          const analysis = await analyzePlantImage(file);
          setAnalysisResult(analysis);
          setShowAnalysisPopup(true);

          // Check and add to catalog if needed
          await checkAndAddPlantToCatalog(
            analysis.commonName,
            analysis.scientificName
          );
        } catch (error) {
          console.error('Error analyzing image:', error);
          toast({
            title: 'Analysis Failed',
            description: error instanceof Error ? error.message : 'Failed to analyze plant image',
            status: 'error',
            duration: 5000,
          });
          onImageModalClose();
        } finally {
          setIsLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error handling image:', error);
      toast({
        title: 'Error',
        description: 'Failed to process image',
        status: 'error',
        duration: 5000,
      });
      setIsLoading(false);
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
            <Button
              leftIcon={<FaBook />}
              colorScheme="green"
              variant="outline"
              onClick={onCatalogOpen}
              size="lg"
              mt={4}
            >
              Open Plant Catalog
            </Button>
          </VStack>
        </VStack>
      </Container>

      {/* Image Analysis Modal */}
      <Modal isOpen={isImageModalOpen} onClose={onImageModalClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Plant Analysis</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {imagePreview && (
              <Box position="relative">
                <AspectRatio ratio={4/3} mb={4}>
                  <Image 
                    src={imagePreview} 
                    alt="Uploaded plant" 
                    objectFit="contain"
                    backgroundColor="gray.50"
                  />
                </AspectRatio>
                {isLoading && (
                  <Box
                    position="absolute"
                    top={0}
                    left={0}
                    right={0}
                    bottom={4}
                    bg="blackAlpha.600"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    borderRadius="md"
                  >
                    <VStack spacing={4} color="white">
                      <Spinner size="xl" color="white" />
                      <Text fontWeight="medium">Analyzing plant...</Text>
                    </VStack>
                  </Box>
                )}
              </Box>
            )}
            {analysisResult && !isLoading ? (
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
                      if (detectedPlantId) {
                        navigate(`/botanica/plant/${detectedPlantId}`);
                        onImageModalClose();
                      }
                    }}
                    isDisabled={!isSearchEnabled}
                  >
                    {isSearchEnabled ? 'Search' : 'Processing...'}
                  </Button>
                </ModalFooter>
              </VStack>
            ) : null}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Plant Catalog Modal */}
      <Modal 
        isOpen={isCatalogOpen} 
        onClose={onCatalogClose} 
        size="6xl"
        scrollBehavior="inside"
      >
        <ModalOverlay />
        <ModalContent maxH="85vh" mt="80px">
          <ModalHeader>Plant Catalog</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <PlantCatalog />
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};