import {
  Box,
  Container,
  VStack,
  Text,
  Heading,
  Image,
  Grid,
  GridItem,
  Skeleton,
  useToast,
  Card,
  CardHeader,
  CardBody,
  Button,
  HStack,
  Link,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  UnorderedList,
  ListItem,
  SimpleGrid,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  Badge,
  AspectRatio,
  useDisclosure,
  IconButton,
  Flex,
} from '@chakra-ui/react'
import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { getPlantDetails, PlantDetails } from '../services/plantService'
import { FaArrowLeft, FaExternalLinkAlt, FaSun, FaTint, FaSeedling, FaThermometerHalf, FaBug, FaChevronLeft, FaChevronRight } from 'react-icons/fa'
import { CareInstructions, CareInstruction } from '../components/plants/CareInstructions'
import { GrowthStages, GrowthStage } from '../components/plants/GrowthStages'
import { WeatherCare } from '../components/plants/WeatherCare'
import { getPlantType, formatScientificName } from '../utils/plantUtils'
import { getMatchedName, formatDisplayName } from '../services/iNaturalistService'

interface PlantImage {
  url: string;
  attribution?: string;
  license_code?: string;
}

interface GlossaryTerm {
  term: string;
  definition: string;
}

const BOTANICAL_GLOSSARY: GlossaryTerm[] = [
  { term: 'perennial', definition: 'A plant that lives for more than two years' },
  { term: 'annual', definition: 'A plant that completes its life cycle in one growing season' },
  { term: 'biennial', definition: 'A plant that takes two years to complete its life cycle' },
  { term: 'deciduous', definition: 'Plants that shed their leaves seasonally' },
  { term: 'evergreen', definition: 'Plants that retain their leaves throughout the year' },
  { term: 'herbaceous', definition: 'Plants with non-woody stems that die back to the ground' },
  { term: 'cultivar', definition: 'A plant variety produced by selective breeding' },
  { term: 'propagation', definition: 'The process of growing new plants from seeds, cuttings, etc.' },
  // Add more terms as needed
];

export const BotanicaPlant = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const location = useLocation()
  const { matchedTerm, taxonPhotos } = location.state || {}

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [plantDetails, setPlantDetails] = useState<PlantDetails | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [displayName, setDisplayName] = useState<{ primary: string; secondary: string } | null>(null)
  const [showGlossary, setShowGlossary] = useState(false)

  // Mock weather data (in a real app, this would come from a weather API)
  const [weatherData] = useState({
    temperature: 25,
    humidity: 60,
    sunlight: 'medium' as const,
  });

  // Add state for selected growth stage
  const [selectedStage, setSelectedStage] = useState(0);

  useEffect(() => {
    if (id) {
      loadPlantDetails()
    }
  }, [id])

  const loadPlantDetails = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const details = await getPlantDetails(parseInt(id!))
      setPlantDetails({
        ...details,
        preferred_common_name: formatScientificName(details.preferred_common_name || ''),
        name: formatScientificName(details.name)
      })

      // Format display name
      const plantType = getPlantType(details.ancestors || [])
      
      // If we have a matched term from navigation state, use it directly
      if (location.state?.displayName) {
        setDisplayName(location.state.displayName)
      } else {
        // Otherwise format based on API data
        const matchedName = matchedTerm ? { name: matchedTerm, lexicon: matchedTerm.includes('(') ? matchedTerm.split('(')[1].replace(')', '').toLowerCase() : 'english' } : null
        const formattedDisplayName = formatDisplayName(details, matchedName, plantType)
        setDisplayName(formattedDisplayName)
      }
      
      // Use passed taxonPhotos if available, otherwise use images from details
      const images = taxonPhotos || details.images || [];
      if (images.length > 0) {
        setSelectedImage(images[0].url || images[0].photo?.medium_url)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load plant details'
      console.error('Error loading plant details:', error)
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const addGlossaryTooltips = (text: string) => {
    let processedText = text;
    BOTANICAL_GLOSSARY.forEach(({ term, definition }) => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      processedText = processedText.replace(regex, `<span class="glossary-term" title="${definition}" style="border-bottom: 1px dotted #718096; cursor: help">${term}</span>`);
    });
    return processedText;
  };

  const formatDescription = (text: string) => {
    // Remove HTML tags and decode HTML entities
    const div = document.createElement('div');
    div.innerHTML = text;
    const plainText = div.textContent || div.innerText || '';
    // Add glossary tooltips
    return { __html: addGlossaryTooltips(plainText) };
  };

  const plantImages: PlantImage[] = [
    ...new Map(
      [
        ...(taxonPhotos || plantDetails?.taxon_photos || []).map((p: any) => ({ 
          url: p.photo.large_url || p.photo.medium_url,
          attribution: p.photo.attribution,
          license_code: p.photo.license_code
        })),
        // Only add images if they're not from taxon_photos
        ...(!taxonPhotos ? (plantDetails?.images || []).map(img => ({
          url: img.url,
          attribution: img.attribution,
          license_code: img.license_code
        })) : []),
        // Only add default photo if no other images exist
        (!taxonPhotos && (!plantDetails?.images || plantDetails.images.length === 0) && plantDetails?.default_photo) ? { 
          url: plantDetails.default_photo.large_url || plantDetails.default_photo.medium_url
        } : null
      ]
        .filter(Boolean)
        .map((img) => [img.url, img])
    ).values(),
  ];

  // Generate care instructions based on plant details
  const getCareInstructions = (): CareInstruction[] => {
    if (!plantDetails) return [];

    const instructions: CareInstruction[] = [];

    // Light requirements
    if (plantDetails.light) {
      instructions.push({
        type: 'light',
        title: 'Light Requirements',
        requirements: [
          plantDetails.light,
          'Rotate plant regularly for even growth',
          'Protect from intense direct sunlight in summer',
        ],
      });
    }

    // Water requirements
    if (plantDetails.watering) {
      instructions.push({
        type: 'water',
        title: 'Watering Schedule',
        requirements: [
          plantDetails.watering,
          'Use well-draining soil mix',
          'Avoid overwatering to prevent root rot',
          'Adjust watering based on season and humidity',
        ],
      });
    }

    // Add general care instructions
    instructions.push(
      {
        type: 'fertilizer',
        title: 'Fertilization',
        requirements: [
          'Feed with balanced fertilizer during growing season',
          'Reduce feeding in winter months',
          'Use organic fertilizer when possible',
        ],
      },
      {
        type: 'temperature',
        title: 'Temperature Control',
        requirements: [
          'Maintain temperature between 65-75°F (18-24°C)',
          'Protect from cold drafts',
          'Maintain moderate humidity',
        ],
      },
      {
        type: 'issues',
        title: 'Common Issues',
        requirements: [
          'Monitor for pest infestations',
          'Check regularly for signs of disease',
          'Remove dead or yellowing leaves',
          'Ensure good air circulation',
        ],
      }
    );

    return instructions;
  };

  // Generate growth stages based on plant type
  const getGrowthStages = (): GrowthStage[] => {
    if (!plantDetails) return [];

    // Default growth stages for most plants
    const stages: GrowthStage[] = [
      {
        stage: 'Germination',
        description: 'The seed absorbs water and begins to sprout.',
        duration: '1-2 weeks',
        requirements: [
          'Temperature: 65-75°F (18-24°C)',
          'Keep soil consistently moist',
          'Light not required until sprout emerges',
        ],
      },
      {
        stage: 'Seedling',
        description: 'First true leaves develop and plant establishes root system.',
        duration: '2-4 weeks',
        requirements: [
          'Temperature: 65-75°F (18-24°C)',
          'Maintain even moisture',
          '14-16 hours of direct sunlight',
          'Start with diluted fertilizer',
        ],
      },
      {
        stage: 'Vegetative Growth',
        description: 'Plant focuses on leaf and stem growth.',
        duration: '4-8 weeks',
        requirements: [
          'Temperature: 65-75°F (18-24°C)',
          'Regular watering, allow top soil to dry',
          'Full sun or 14-16 hours of grow lights',
          'Regular balanced fertilizer',
        ],
      },
      {
        stage: 'Maturity',
        description: 'Plant reaches full size and begins producing.',
        duration: '8-12 weeks',
        requirements: [
          'Temperature: 65-75°F (18-24°C)',
          'Regular deep watering',
          'Full sun or 12-14 hours of grow lights',
          'Reduce nitrogen, increase P and K',
        ],
      },
    ];

    return stages;
  };

  const handleImageClick = (imageUrl: string, index: number) => {
    setSelectedImage(imageUrl)
    setCurrentImageIndex(index)
    onOpen()
  }

  const handlePrevImage = () => {
    if (plantImages.length > 0 && currentImageIndex > 0) {
      const newIndex = currentImageIndex - 1;
      setCurrentImageIndex(newIndex);
      setSelectedImage(plantImages[newIndex].url);
    }
  }

  const handleNextImage = () => {
    if (plantImages.length > 0 && currentImageIndex < plantImages.length - 1) {
      const newIndex = currentImageIndex + 1;
      setCurrentImageIndex(newIndex);
      setSelectedImage(plantImages[newIndex].url);
    }
  }

  if (!plantDetails || !displayName) {
    return null;
  }

  return (
    <div className="plant-page">
      <Box bg="gray.50" minH="100vh" pt={4}>
        <Container maxW="60%" px={{ base: 4, md: 6 }}>
          {/* Header Section */}
          <HStack spacing={4} bg="white" p={4} borderRadius="lg" boxShadow="sm" mb={6}>
            <Button
              leftIcon={<FaArrowLeft />}
              variant="ghost"
              onClick={() => navigate(-1)}
              size="sm"
            >
              Back
            </Button>
          </HStack>

          {isLoading ? (
            <VStack spacing={8} align="stretch">
              <Grid templateColumns={{ base: '1fr', md: '1fr 2fr' }} gap={8}>
                <GridItem>
                  <Skeleton height="400px" borderRadius="lg" />
                </GridItem>
                <GridItem>
                  <VStack spacing={6} align="stretch">
                    <Skeleton height="40px" width="60%" />
                    <Skeleton height="24px" width="40%" />
                    <Skeleton height="200px" />
                  </VStack>
                </GridItem>
              </Grid>
            </VStack>
          ) : error ? (
            <Box p={8} bg="red.50" color="red.600" borderRadius="lg">
              <VStack align="stretch" spacing={2}>
                <Text fontWeight="bold">Error Loading Plant Details</Text>
                <Text>{error}</Text>
              </VStack>
            </Box>
          ) : (
            <Grid templateColumns={{ base: '1fr', md: '1fr 2fr' }} gap={8}>
              {/* Left Column - Image Gallery and Basic Info */}
              <GridItem>
                <VStack spacing={6}>
                  {/* Main Image */}
                  <Box
                    position="relative"
                    borderRadius="lg"
                    overflow="hidden"
                    bg="white"
                    boxShadow="sm"
                    cursor={plantImages.length > 1 ? 'pointer' : 'default'}
                    onClick={() => handleImageClick(selectedImage || '', currentImageIndex)}
                  >
                    <Image
                      src={selectedImage || '/default-plant.png'}
                      alt={displayName.primary}
                      objectFit="cover"
                      width="100%"
                      height="350px"
                    />
                    {plantImages.length > 1 && (
                      <Text
                        position="absolute"
                        bottom={2}
                        right={2}
                        bg="blackAlpha.700"
                        color="white"
                        px={2}
                        py={1}
                        borderRadius="md"
                        fontSize="sm"
                      >
                        +{Math.max(plantImages.length - 1, 0)} more
                      </Text>
                    )}
                  </Box>

                  {/* Thumbnail Gallery */}
                  {plantImages.length > 1 && (
                    <SimpleGrid columns={4} spacing={2} width="100%">
                      {plantImages.slice(0, 4).map((image, index) => (
                        <Box
                          key={index}
                          borderRadius="md"
                          overflow="hidden"
                          cursor="pointer"
                          onClick={() => handleImageClick(image.url, index)}
                          border="2px solid"
                          borderColor={selectedImage === image.url ? 'brand.500' : 'transparent'}
                        >
                          <Image
                            src={image.url}
                            alt={`${displayName.primary} ${index + 1}`}
                            objectFit="cover"
                            width="100%"
                            height="60px"
                          />
                        </Box>
                      ))}
                    </SimpleGrid>
                  )}

                  {/* Basic Info Card */}
                  <Card width="100%">
                    <CardBody>
                      <VStack spacing={4} align="start">
                        <Heading size="lg" textTransform="capitalize">
                          {displayName.primary}
                        </Heading>
                        <Text color="gray.600" fontSize="lg">
                          {displayName.secondary}
                        </Text>
                        <SimpleGrid columns={2} spacing={4} width="100%">
                          <HStack spacing={3}>
                            <FaSun color="#ED8936" />
                            <VStack align="start" spacing={0}>
                              <Text fontWeight="bold">Light</Text>
                              <Text fontSize="sm">{plantDetails.light || 'Full Sun'}</Text>
                            </VStack>
                          </HStack>
                          <HStack spacing={3}>
                            <FaTint color="#4299E1" />
                            <VStack align="start" spacing={0}>
                              <Text fontWeight="bold">Water</Text>
                              <Text fontSize="sm">{plantDetails.watering || 'Moderate'}</Text>
                            </VStack>
                          </HStack>
                          <HStack spacing={3}>
                            <FaSeedling color="#48BB78" />
                            <VStack align="start" spacing={0}>
                              <Text fontWeight="bold">Type</Text>
                              <Text fontSize="sm">{getPlantType(plantDetails.ancestors || [])}</Text>
                            </VStack>
                          </HStack>
                          <HStack spacing={3}>
                            <FaThermometerHalf color="#F56565" />
                            <VStack align="start" spacing={0}>
                              <Text fontWeight="bold">Temperature</Text>
                              <Text fontSize="sm">65-75°F</Text>
                            </VStack>
                          </HStack>
                        </SimpleGrid>
                      </VStack>
                    </CardBody>
                  </Card>

                  {/* Weather Care Card */}
                  <WeatherCare
                    temperature={weatherData.temperature}
                    humidity={weatherData.humidity}
                    sunlight={weatherData.sunlight}
                    plantType={displayName.primary}
                  />
                </VStack>
              </GridItem>

              {/* Right Column - Description and Growth Stages */}
              <GridItem>
                <Card>
                  <CardBody>
                    <Tabs>
                      <TabList>
                        <Tab>Overview</Tab>
                        <Tab>Growth Stages</Tab>
                      </TabList>

                      <TabPanels>
                        <TabPanel>
                          <VStack spacing={6} align="stretch">
                            <Box dangerouslySetInnerHTML={formatDescription(plantDetails.wikipedia_summary || plantDetails.description || '')} />
                            <HStack spacing={4}>
                              {plantDetails.wikipedia_url && (
                                <Link
                                  href={plantDetails.wikipedia_url}
                                  isExternal
                                  color="brand.500"
                                  fontSize="sm"
                                >
                                  Learn more on Wikipedia
                                </Link>
                              )}
                              <Link
                                href="#"
                                color="brand.500"
                                fontSize="sm"
                                onClick={() => setShowGlossary(true)}
                              >
                                View Full Glossary
                              </Link>
                            </HStack>
                          </VStack>
                        </TabPanel>
                        <TabPanel>
                          <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap={6}>
                            <Box>
                              <VStack spacing={4} align="stretch">
                                {getGrowthStages().map((stage, index) => (
                                  <Box
                                    key={index}
                                    p={4}
                                    bg={selectedStage === index ? 'brand.50' : 'white'}
                                    borderRadius="lg"
                                    cursor="pointer"
                                    onClick={() => setSelectedStage(index)}
                                    borderWidth={1}
                                    borderColor={selectedStage === index ? 'brand.500' : 'gray.200'}
                                  >
                                    <Text fontWeight="medium">{stage.stage}</Text>
                                    <Text fontSize="sm" color="gray.600">{stage.duration}</Text>
                                  </Box>
                                ))}
                              </VStack>
                            </Box>
                            <Card>
                              <CardBody>
                                <VStack spacing={4} align="stretch">
                                  <Heading size="md">Care Instructions</Heading>
                                  <Text fontWeight="medium">
                                    {getGrowthStages()[selectedStage].stage}
                                  </Text>
                                  <Text>
                                    {getGrowthStages()[selectedStage].description}
                                  </Text>
                                  <Box>
                                    <Text fontWeight="medium" mb={2}>Requirements:</Text>
                                    <UnorderedList spacing={2}>
                                      {getGrowthStages()[selectedStage].requirements.map((req, index) => (
                                        <ListItem key={index}>{req}</ListItem>
                                      ))}
                                    </UnorderedList>
                                  </Box>
                                </VStack>
                              </CardBody>
                            </Card>
                          </Grid>
                        </TabPanel>
                      </TabPanels>
                    </Tabs>
                  </CardBody>
                </Card>
              </GridItem>
            </Grid>
          )}

          {/* Glossary Modal */}
          <Modal isOpen={showGlossary} onClose={() => setShowGlossary(false)} size="xl">
            <ModalOverlay />
            <ModalContent>
              <ModalHeader>Botanical Glossary</ModalHeader>
              <ModalCloseButton />
              <ModalBody pb={6}>
                <VStack spacing={4} align="stretch">
                  {BOTANICAL_GLOSSARY.map(({ term, definition }, index) => (
                    <Box key={index} p={4} bg="gray.50" borderRadius="md">
                      <Text fontWeight="bold">{term}</Text>
                      <Text>{definition}</Text>
                    </Box>
                  ))}
                </VStack>
              </ModalBody>
            </ModalContent>
          </Modal>

          {/* Image Popup Modal */}
          <Modal isOpen={isOpen} onClose={onClose} size="4xl">
            <ModalOverlay />
            <ModalContent bg="white" maxW="80vw">
              <ModalHeader>Plant Images</ModalHeader>
              <ModalCloseButton />
              <ModalBody p={4}>
                <VStack spacing={4}>
                  {/* Main Image Container */}
                  <Box position="relative" width="100%" bg="blackAlpha.50" borderRadius="lg" overflow="hidden">
                    <Box maxW="100%" maxH="60vh" margin="0 auto">
                      <Image
                        src={selectedImage || ''}
                        alt={displayName?.primary || 'Plant image'}
                        objectFit="contain"
                        maxH="60vh"
                        width="auto"
                        height="auto"
                        margin="0 auto"
                      />
                    </Box>
                    
                    {/* Navigation Arrows */}
                    <HStack 
                      position="absolute" 
                      top="50%" 
                      left="0" 
                      right="0" 
                      transform="translateY(-50%)" 
                      justify="space-between" 
                      px={4}
                    >
                      <IconButton
                        icon={<FaChevronLeft />}
                        aria-label="Previous image"
                        onClick={handlePrevImage}
                        isDisabled={currentImageIndex === 0}
                        variant="solid"
                        colorScheme="blackAlpha"
                        size="md"
                      />
                      <IconButton
                        icon={<FaChevronRight />}
                        aria-label="Next image"
                        onClick={handleNextImage}
                        isDisabled={currentImageIndex === (plantImages.length - 1)}
                        variant="solid"
                        colorScheme="blackAlpha"
                        size="md"
                      />
                    </HStack>
                  </Box>

                  {/* Thumbnails */}
                  <Box width="100%" overflowX="auto" py={2}>
                    <HStack spacing={2} minW="min-content">
                      {plantImages.map((image, index) => (
                        <Box
                          key={index}
                          cursor="pointer"
                          onClick={() => {
                            setSelectedImage(image.url)
                            setCurrentImageIndex(index)
                          }}
                          borderWidth={2}
                          borderColor={currentImageIndex === index ? 'brand.500' : 'transparent'}
                          borderRadius="md"
                          overflow="hidden"
                          transition="all 0.2s"
                          _hover={{ transform: 'scale(1.05)' }}
                        >
                          <Image
                            src={image.url}
                            alt={`${displayName?.primary || 'Plant'} ${index + 1}`}
                            boxSize="80px"
                            objectFit="cover"
                          />
                        </Box>
                      ))}
                    </HStack>
                  </Box>

                  {/* Image Attribution */}
                  {plantImages[currentImageIndex]?.attribution && (
                    <Text fontSize="sm" color="gray.600" textAlign="center">
                      Photo by: {plantImages[currentImageIndex].attribution}
                    </Text>
                  )}
                </VStack>
              </ModalBody>
            </ModalContent>
          </Modal>
        </Container>
      </Box>
    </div>
  )
} 