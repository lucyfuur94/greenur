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
} from '@chakra-ui/react'
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPlantDetails, PlantDetails } from '../services/plantService'
import { FaArrowLeft, FaExternalLinkAlt, FaSun, FaTint, FaSeedling, FaThermometerHalf, FaBug } from 'react-icons/fa'
import { CareInstructions, CareInstruction } from '../components/plants/CareInstructions'
import { GrowthStages, GrowthStage } from '../components/plants/GrowthStages'
import { WeatherCare } from '../components/plants/WeatherCare'

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

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [plantDetails, setPlantDetails] = useState<PlantDetails | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [showImageGallery, setShowImageGallery] = useState(false)
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
      setPlantDetails(details)
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

  const plantImages: PlantImage[] = [...(plantDetails?.images || [])]
  if (plantDetails?.default_photo?.large_url) {
    plantImages.unshift({ url: plantDetails.default_photo.large_url })
  }

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

  return (
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
        ) : plantDetails && (
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
                  onClick={() => plantImages.length > 1 && setShowImageGallery(true)}
                >
                  <Image
                    src={plantImages[selectedImageIndex]?.url || '/default-plant.png'}
                    alt={plantDetails.preferred_common_name || plantDetails.name}
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
                      +{plantImages.length - 1} more
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
                        onClick={() => setSelectedImageIndex(index)}
                        border="2px solid"
                        borderColor={selectedImageIndex === index ? 'brand.500' : 'transparent'}
                      >
                        <Image
                          src={image.url}
                          alt={`${plantDetails.name} ${index + 1}`}
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
                      <Heading size="lg">{plantDetails.preferred_common_name || plantDetails.name}</Heading>
                      <Text color="gray.600" fontStyle="italic">
                        {plantDetails.name}
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
                  plantType={plantDetails.preferred_common_name || plantDetails.name}
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

        {/* Image Gallery Modal */}
        <Modal isOpen={showImageGallery} onClose={() => setShowImageGallery(false)} size="6xl">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Plant Images</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <SimpleGrid columns={{ base: 2, md: 3 }} spacing={4} pb={6}>
                {plantImages.map((image, index) => (
                  <Box
                    key={index}
                    borderRadius="lg"
                    overflow="hidden"
                    cursor="pointer"
                    onClick={() => setSelectedImageIndex(index)}
                  >
                    <Image
                      src={image.url}
                      alt={`${plantDetails?.name} ${index + 1}`}
                      objectFit="cover"
                      width="100%"
                      height="200px"
                    />
                  </Box>
                ))}
              </SimpleGrid>
            </ModalBody>
          </ModalContent>
        </Modal>
      </Container>
    </Box>
  )
} 