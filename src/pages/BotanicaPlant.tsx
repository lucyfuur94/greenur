import React, { useEffect, useState } from 'react'
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
  CardBody,
  Button,
  HStack,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Spinner,
  UnorderedList,
  ListItem,
  CardHeader,
  List,
  ListIcon,
  Divider,
} from '@chakra-ui/react'
import { useParams, useNavigate } from 'react-router-dom'
import { FaArrowLeft, FaLeaf, FaInfoCircle } from 'react-icons/fa'
import { MdCheckCircle, MdInfo, MdWarning } from 'react-icons/md'
import { useAuth } from '../hooks/useAuth'
import { User } from '../types/user'

interface PlantDetails {
  _id: string;
  common_name: string;
  scientific_name: string;
  plant_type: string;
  default_image_url: string;
  names_in_languages?: Record<string, string>;
  last_updated: string;
}

interface GrowthStage {
  stage: string;
  duration: string;
  care: string[];
  issues: string[];
  indicators: string[];
}

interface CareCalendar {
  seasonal: {
    spring: string[];
    summer: string[];
    fall: string[];
    winter: string[];
  };
  watering: {
    frequency: string;
    amount: string;
    notes: string[];
  };
  maintenance: {
    pruning: string;
    repotting: string;
    fertilizing: string;
  };
}

interface AdditionalInfo {
  basicRecommendations: {
    experienceLevel: string;
    locationAdvice: string;
    temperatureAdaptability: string;
    bestSeason: string;
    placement: string;
  };
  growingConditions: {
    light: string;
    water: string;
    soil: string;
    temperature: string;
    wind: string;
    fertilizer: string;
  };
  growthStages: GrowthStage[];
  careCalendar: CareCalendar;
}

interface PlantDetailsRequest {
  plantName: string;
  scientificName: string;
  plantType: string;
  plantData: string;
  experience: 'beginner' | 'intermediate' | 'expert';
  gardenType: 'indoor' | 'outdoor' | 'greenhouse';
  interests: string[];
  location: string;
  currentWeather?: {
    temp: number;
    humidity: number;
    precipitation: number;
  } | null;
  forecast?: Array<{
    date: string;
    temp: number;
    condition: string;
  }> | null;
}

interface PlantDetailsResponse {
  details: AdditionalInfo;
  rawData: string;
}

export const BotanicaPlant = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()

  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [plantDetails, setPlantDetails] = useState<PlantDetails | null>(null)
  const [additionalInfo, setAdditionalInfo] = useState<AdditionalInfo | null>(null)

  useEffect(() => {
    if (id) {
      loadPlantDetails()
    }
  }, [id])

  const loadPlantDetails = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/.netlify/functions/get-plant-basics?id=${id}`);
      if (!response.ok) {
        throw new Error('Failed to load plant details');
      }
      const data = await response.json();
      setPlantDetails(data);
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

  const fetchAdditionalInfo = async () => {
    if (!plantDetails) {
      toast({
        title: 'Error',
        description: 'Plant details not available',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    setIsLoadingDetails(true);
    try {
      // Prepare request data with optional fields
      const requestData: PlantDetailsRequest = {
        plantName: plantDetails.common_name,
        scientificName: plantDetails.scientific_name,
        plantType: plantDetails.plant_type,
        plantData: JSON.stringify(plantDetails),
        // Set default values for optional fields
        experience: user?.experience || 'beginner',
        gardenType: user?.gardenType || 'indoor',
        interests: user?.interests || [],
        location: user?.location || 'Unknown',
        // Make these fields optional in the request
        ...(user?.currentWeather && { currentWeather: user.currentWeather }),
        ...(user?.forecast && { forecast: user.forecast })
      };

      const response: Response = await fetch('/.netlify/functions/get-plant-details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch plant details');
      }
      
      const data: PlantDetailsResponse = await response.json();
      setAdditionalInfo(data.details);

      // Show success toast with personalization status
      toast({
        title: 'Plant Details Retrieved',
        description: !user ? 
          'Basic plant care information retrieved. Sign in for personalized recommendations.' :
          (!user.location || !user.currentWeather) ?
          'Plant care information retrieved. Complete your profile for location-specific advice.' :
          'Personalized plant care information retrieved based on your profile.',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Error fetching plant details',
        description: 'Failed to load additional plant information',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleTrackPlant = () => {
    if (plantDetails) {
      navigate('/tracker', { 
        state: { 
          plantToAdd: {
            id: plantDetails._id,
            name: plantDetails.common_name,
            scientificName: plantDetails.scientific_name,
            type: plantDetails.plant_type,
            image: plantDetails.default_image_url
          }
        }
      });
    }
  };

  if (!plantDetails && !isLoading && !error) {
    return null;
  }

  return (
    <Box bg="gray.50" minH="100vh" pt={4}>
      <Container maxW="container.lg" px={{ base: 4, md: 6 }}>
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
            {/* Left Column - Image and Basic Info */}
            <GridItem>
              <VStack spacing={6}>
                {/* Main Image */}
                <Box
                  position="relative"
                  borderRadius="lg"
                  overflow="hidden"
                  bg="white"
                  boxShadow="sm"
                >
                  <Image
                    src={plantDetails?.default_image_url || '/default-plant.png'}
                    alt={plantDetails?.common_name}
                    objectFit="cover"
                    width="100%"
                    height="350px"
                  />
                </Box>

                {/* Basic Info Card */}
                <Card width="100%">
                  <CardBody>
                    <VStack spacing={4} align="start">
                      <Heading size="lg" textTransform="capitalize">
                        {plantDetails?.common_name}
                      </Heading>
                      <Text color="gray.600" fontSize="lg" fontStyle="italic">
                        {plantDetails?.scientific_name}
                      </Text>
                      <Text color="gray.600">
                        Type: {plantDetails?.plant_type}
                      </Text>
                      
                      {/* Track Plant Button */}
                      <Button
                        leftIcon={<FaLeaf />}
                        variant="outline"
                        colorScheme="green"
                        onClick={handleTrackPlant}
                        width="100%"
                      >
                        Track this Plant
                      </Button>
                    </VStack>
                  </CardBody>
                </Card>
              </VStack>
            </GridItem>

            {/* Right Column - Additional Details */}
            <GridItem>
              <VStack spacing={6} align="stretch">
                {!additionalInfo && !isLoadingDetails && (
                  <Card>
                    <CardHeader>
                      <Heading size="md" display="flex" alignItems="center">
                        <MdInfo style={{ marginRight: '8px' }} />
                        Plant Details
                      </Heading>
                    </CardHeader>
                    <CardBody>
                      <Text mb={4}>
                        Get personalized care instructions and detailed information about this plant.
                      </Text>
                      <Button colorScheme="green" onClick={fetchAdditionalInfo}>
                        Fetch Plant Details
                      </Button>
                    </CardBody>
                  </Card>
                )}

                {isLoadingDetails && (
                  <Card>
                    <CardBody display="flex" justifyContent="center" alignItems="center" py={8}>
                      <Spinner size="lg" />
                    </CardBody>
                  </Card>
                )}

                {additionalInfo && (
                  <VStack spacing={4}>
                    {/* Basic Recommendations */}
                    <Card>
                      <CardHeader>
                        <Heading size="md">Basic Recommendations</Heading>
                      </CardHeader>
                      <CardBody>
                        <List spacing={2}>
                          <ListItem>
                            <ListIcon as={MdCheckCircle} color="green.500" />
                            <Text as="span" fontWeight="bold">Experience Level:</Text> {additionalInfo.basicRecommendations.experienceLevel}
                          </ListItem>
                          <ListItem>
                            <ListIcon as={MdCheckCircle} color="green.500" />
                            <Text as="span" fontWeight="bold">Location Advice:</Text> {additionalInfo.basicRecommendations.locationAdvice}
                          </ListItem>
                          <ListItem>
                            <ListIcon as={MdCheckCircle} color="green.500" />
                            <Text as="span" fontWeight="bold">Best Season:</Text> {additionalInfo.basicRecommendations.bestSeason}
                          </ListItem>
                          <ListItem>
                            <ListIcon as={MdCheckCircle} color="green.500" />
                            <Text as="span" fontWeight="bold">Placement:</Text> {additionalInfo.basicRecommendations.placement}
                          </ListItem>
                        </List>
                      </CardBody>
                    </Card>

                    {/* Growing Conditions */}
                    <Card>
                      <CardHeader>
                        <Heading size="md">Growing Conditions</Heading>
                      </CardHeader>
                      <CardBody>
                        <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                          <Box>
                            <Text fontWeight="bold">Light</Text>
                            <Text>{additionalInfo.growingConditions.light}</Text>
                          </Box>
                          <Box>
                            <Text fontWeight="bold">Water</Text>
                            <Text>{additionalInfo.growingConditions.water}</Text>
                          </Box>
                          <Box>
                            <Text fontWeight="bold">Soil</Text>
                            <Text>{additionalInfo.growingConditions.soil}</Text>
                          </Box>
                          <Box>
                            <Text fontWeight="bold">Temperature</Text>
                            <Text>{additionalInfo.growingConditions.temperature}</Text>
                          </Box>
                          <Box>
                            <Text fontWeight="bold">Wind</Text>
                            <Text>{additionalInfo.growingConditions.wind}</Text>
                          </Box>
                          <Box>
                            <Text fontWeight="bold">Fertilizer</Text>
                            <Text>{additionalInfo.growingConditions.fertilizer}</Text>
                          </Box>
                        </Grid>
                      </CardBody>
                    </Card>

                    {/* Growth Stages */}
                    <Card>
                      <CardHeader>
                        <Heading size="md">Growth Stages</Heading>
                      </CardHeader>
                      <CardBody>
                        <VStack spacing={4} align="stretch">
                          {additionalInfo.growthStages.map((stage: GrowthStage, index: number) => (
                            <Box key={index}>
                              <Heading size="sm" mb={2}>{stage.stage} ({stage.duration})</Heading>
                              <Text fontWeight="bold" color="green.600">Care Points:</Text>
                              <List spacing={1} mb={2}>
                                {stage.care.map((point: string, i: number) => (
                                  <ListItem key={i}>
                                    <ListIcon as={MdCheckCircle} color="green.500" />
                                    {point}
                                  </ListItem>
                                ))}
                              </List>
                              <Text fontWeight="bold" color="orange.600">Watch Out For:</Text>
                              <List spacing={1} mb={2}>
                                {stage.issues.map((issue: string, i: number) => (
                                  <ListItem key={i}>
                                    <ListIcon as={MdWarning} color="orange.500" />
                                    {issue}
                                  </ListItem>
                                ))}
                              </List>
                              <Text fontWeight="bold" color="blue.600">Success Indicators:</Text>
                              <List spacing={1}>
                                {stage.indicators.map((indicator: string, i: number) => (
                                  <ListItem key={i}>
                                    <ListIcon as={MdInfo} color="blue.500" />
                                    {indicator}
                                  </ListItem>
                                ))}
                              </List>
                              {index < additionalInfo.growthStages.length - 1 && <Divider my={2} />}
                            </Box>
                          ))}
                        </VStack>
                      </CardBody>
                    </Card>

                    {/* Care Calendar */}
                    <Card>
                      <CardHeader>
                        <Heading size="md">Care Calendar</Heading>
                      </CardHeader>
                      <CardBody>
                        <VStack spacing={4} align="stretch">
                          <Box>
                            <Heading size="sm" mb={2}>Seasonal Care</Heading>
                            <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                              {Object.entries(additionalInfo.careCalendar.seasonal).map(([season, tasks]) => (
                                <Box key={season}>
                                  <Text fontWeight="bold" textTransform="capitalize">{season}</Text>
                                  <List spacing={1}>
                                    {tasks.map((task, i) => (
                                      <ListItem key={i}>
                                        <ListIcon as={MdCheckCircle} color="green.500" />
                                        {task}
                                      </ListItem>
                                    ))}
                                  </List>
                                </Box>
                              ))}
                            </Grid>
                          </Box>

                          <Box>
                            <Heading size="sm" mb={2}>Watering Schedule</Heading>
                            <Text><strong>Frequency:</strong> {additionalInfo.careCalendar.watering.frequency}</Text>
                            <Text><strong>Amount:</strong> {additionalInfo.careCalendar.watering.amount}</Text>
                            <Text fontWeight="bold" mt={2}>Notes:</Text>
                            <List spacing={1}>
                              {additionalInfo.careCalendar.watering.notes.map((note, i) => (
                                <ListItem key={i}>
                                  <ListIcon as={MdInfo} color="blue.500" />
                                  {note}
                                </ListItem>
                              ))}
                            </List>
                          </Box>

                          <Box>
                            <Heading size="sm" mb={2}>Maintenance Schedule</Heading>
                            <List spacing={2}>
                              <ListItem>
                                <ListIcon as={MdCheckCircle} color="green.500" />
                                <Text as="span" fontWeight="bold">Pruning:</Text> {additionalInfo.careCalendar.maintenance.pruning}
                              </ListItem>
                              <ListItem>
                                <ListIcon as={MdCheckCircle} color="green.500" />
                                <Text as="span" fontWeight="bold">Repotting:</Text> {additionalInfo.careCalendar.maintenance.repotting}
                              </ListItem>
                              <ListItem>
                                <ListIcon as={MdCheckCircle} color="green.500" />
                                <Text as="span" fontWeight="bold">Fertilizing:</Text> {additionalInfo.careCalendar.maintenance.fertilizing}
                              </ListItem>
                            </List>
                          </Box>
                        </VStack>
                      </CardBody>
                    </Card>
                  </VStack>
                )}
              </VStack>
            </GridItem>
          </Grid>
        )}
      </Container>
    </Box>
  );
};