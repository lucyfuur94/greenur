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
} from '@chakra-ui/react'
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPlantDetails, PlantDetails } from '../services/plantService'
import { FaArrowLeft, FaExternalLinkAlt, FaSun, FaTint, FaSeedling, FaThermometerHalf, FaBug } from 'react-icons/fa'

export const BotanicaPlant = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [plantDetails, setPlantDetails] = useState<PlantDetails | null>(null)

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

  const formatDescription = (text: string) => {
    // Remove HTML tags and decode HTML entities
    const div = document.createElement('div')
    div.innerHTML = text
    return div.textContent || div.innerText || ''
  }

  if (isLoading) {
    return (
      <Container maxW="60%" py={8}>
        <Button
          leftIcon={<FaArrowLeft />}
          variant="ghost"
          onClick={() => navigate(-1)}
          mb={8}
        >
          Back to Search
        </Button>

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
      </Container>
    )
  }

  if (error) {
    return (
      <Container maxW="60%" py={8}>
        <Button
          leftIcon={<FaArrowLeft />}
          variant="ghost"
          onClick={() => navigate(-1)}
          mb={8}
        >
          Back to Search
        </Button>

        <VStack spacing={8} align="stretch">
          <Box
            p={8}
            bg="red.50"
            color="red.600"
            borderRadius="lg"
            display="flex"
            alignItems="center"
            gap={4}
          >
            <VStack align="stretch" spacing={2}>
              <Text fontWeight="bold">Error Loading Plant Details</Text>
              <Text>{error}</Text>
            </VStack>
          </Box>
        </VStack>
      </Container>
    )
  }

  if (!plantDetails) {
    return null
  }

  return (
    <Container maxW="60%" py={8}>
      <Button
        leftIcon={<FaArrowLeft />}
        variant="ghost"
        onClick={() => navigate(-1)}
        mb={8}
      >
        Back to Search
      </Button>

      <Grid 
        templateColumns={{ base: '1fr', md: '1fr 2fr' }}
        gap={8}
      >
        {/* Left Column - Image and Basic Info */}
        <GridItem>
          <VStack spacing={6}>
            <Box
              borderRadius="lg"
              overflow="hidden"
              bg="gray.100"
              width="100%"
              height="350px"
            >
              {plantDetails.default_photo?.large_url ? (
                <Image
                  src={plantDetails.default_photo.large_url}
                  alt={plantDetails.preferred_common_name || plantDetails.name}
                  objectFit="cover"
                  width="100%"
                  height="100%"
                />
              ) : (
                <Box
                  width="100%"
                  height="100%"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Text color="gray.500">No image available</Text>
                </Box>
              )}
            </Box>

            <Card width="100%">
              <CardBody>
                <VStack spacing={4} align="stretch">
                  <Heading size="lg">{plantDetails.preferred_common_name || plantDetails.name}</Heading>
                  <Text color="gray.600" fontStyle="italic">
                    {plantDetails.name}
                  </Text>
                  <SimpleGrid columns={2} spacing={4}>
                    <HStack spacing={3}>
                      <FaSun color="#ED8936" />
                      <VStack align="start" spacing={0}>
                        <Text fontWeight="bold">Light</Text>
                        <Text fontSize="sm">Full Sun</Text>
                      </VStack>
                    </HStack>
                    <HStack spacing={3}>
                      <FaTint color="#4299E1" />
                      <VStack align="start" spacing={0}>
                        <Text fontWeight="bold">Water</Text>
                        <Text fontSize="sm">Moderate</Text>
                      </VStack>
                    </HStack>
                    <HStack spacing={3}>
                      <FaSeedling color="#48BB78" />
                      <VStack align="start" spacing={0}>
                        <Text fontWeight="bold">Fertilizer</Text>
                        <Text fontSize="sm">Monthly</Text>
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
          </VStack>
        </GridItem>

        {/* Right Column - Description and Growth Information */}
        <GridItem>
          <VStack spacing={6} align="stretch">
            <Tabs>
              <TabList>
                <Tab>Overview</Tab>
                <Tab>Growth Stages</Tab>
                <Tab>Care Instructions</Tab>
              </TabList>

              <TabPanels>
                <TabPanel>
                  <VStack spacing={4} align="stretch">
                    {plantDetails.wikipedia_summary && (
                      <Box>
                        <Heading size="md" mb={2}>Description</Heading>
                        <Text noOfLines={6}>{formatDescription(plantDetails.wikipedia_summary)}</Text>
                        {plantDetails.wikipedia_url && (
                          <Link href={plantDetails.wikipedia_url} isExternal mt={4} display="inline-flex" alignItems="center">
                            Read more on Wikipedia <FaExternalLinkAlt size={12} style={{ marginLeft: '0.5rem' }} />
                          </Link>
                        )}
                      </Box>
                    )}
                  </VStack>
                </TabPanel>

                <TabPanel>
                  <VStack spacing={4} align="stretch">
                    <Box>
                      <Heading size="md" mb={4}>Growth Stages</Heading>
                      
                      <Card mb={4}>
                        <CardHeader>
                          <Heading size="sm">1. Germination (1-2 weeks)</Heading>
                        </CardHeader>
                        <CardBody>
                          <VStack align="stretch" spacing={3}>
                            <Text>The seed absorbs water and begins to sprout.</Text>
                            <UnorderedList spacing={2}>
                              <ListItem>Temperature: 65-75°F (18-24°C)</ListItem>
                              <ListItem>Water: Keep soil consistently moist</ListItem>
                              <ListItem>Light: Not required until sprout emerges</ListItem>
                            </UnorderedList>
                          </VStack>
                        </CardBody>
                      </Card>

                      <Card mb={4}>
                        <CardHeader>
                          <Heading size="sm">2. Seedling (2-4 weeks)</Heading>
                        </CardHeader>
                        <CardBody>
                          <VStack align="stretch" spacing={3}>
                            <Text>First true leaves develop and plant establishes root system.</Text>
                            <UnorderedList spacing={2}>
                              <ListItem>Temperature: 65-75°F (18-24°C)</ListItem>
                              <ListItem>Water: Maintain even moisture</ListItem>
                              <ListItem>Light: 14-16 hours of direct sunlight or grow lights</ListItem>
                              <ListItem>Fertilizer: Start with diluted fertilizer</ListItem>
                            </UnorderedList>
                          </VStack>
                        </CardBody>
                      </Card>

                      <Card mb={4}>
                        <CardHeader>
                          <Heading size="sm">3. Vegetative Growth (4-8 weeks)</Heading>
                        </CardHeader>
                        <CardBody>
                          <VStack align="stretch" spacing={3}>
                            <Text>Plant focuses on leaf and stem growth.</Text>
                            <UnorderedList spacing={2}>
                              <ListItem>Temperature: 65-75°F (18-24°C)</ListItem>
                              <ListItem>Water: Regular watering, allow top soil to dry slightly</ListItem>
                              <ListItem>Light: Full sun or 14-16 hours of grow lights</ListItem>
                              <ListItem>Fertilizer: Regular feeding with balanced fertilizer</ListItem>
                            </UnorderedList>
                          </VStack>
                        </CardBody>
                      </Card>

                      <Card>
                        <CardHeader>
                          <Heading size="sm">4. Maturity (8-12 weeks)</Heading>
                        </CardHeader>
                        <CardBody>
                          <VStack align="stretch" spacing={3}>
                            <Text>Plant reaches full size and begins producing.</Text>
                            <UnorderedList spacing={2}>
                              <ListItem>Temperature: 65-75°F (18-24°C)</ListItem>
                              <ListItem>Water: Regular deep watering</ListItem>
                              <ListItem>Light: Full sun or 12-14 hours of grow lights</ListItem>
                              <ListItem>Fertilizer: Reduce nitrogen, increase phosphorus and potassium</ListItem>
                            </UnorderedList>
                          </VStack>
                        </CardBody>
                      </Card>
                    </Box>
                  </VStack>
                </TabPanel>

                <TabPanel>
                  <VStack spacing={4} align="stretch">
                    <Box>
                      <Heading size="md" mb={4}>Care Instructions</Heading>

                      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                        <Card>
                          <CardBody>
                            <HStack spacing={4} align="start">
                              <Box color="orange.400">
                                <FaSun size={24} />
                              </Box>
                              <VStack align="start" spacing={2}>
                                <Heading size="sm">Light Requirements</Heading>
                                <UnorderedList spacing={2}>
                                  <ListItem>Full sun (6+ hours of direct sunlight)</ListItem>
                                  <ListItem>Protect from intense afternoon sun</ListItem>
                                  <ListItem>Rotate plant regularly</ListItem>
                                </UnorderedList>
                              </VStack>
                            </HStack>
                          </CardBody>
                        </Card>

                        <Card>
                          <CardBody>
                            <HStack spacing={4} align="start">
                              <Box color="blue.400">
                                <FaTint size={24} />
                              </Box>
                              <VStack align="start" spacing={2}>
                                <Heading size="sm">Watering Schedule</Heading>
                                <UnorderedList spacing={2}>
                                  <ListItem>Water when top soil is dry</ListItem>
                                  <ListItem>Avoid overwatering</ListItem>
                                  <ListItem>Increase frequency in hot weather</ListItem>
                                </UnorderedList>
                              </VStack>
                            </HStack>
                          </CardBody>
                        </Card>

                        <Card>
                          <CardBody>
                            <HStack spacing={4} align="start">
                              <Box color="green.400">
                                <FaSeedling size={24} />
                              </Box>
                              <VStack align="start" spacing={2}>
                                <Heading size="sm">Fertilization</Heading>
                                <UnorderedList spacing={2}>
                                  <ListItem>Apply balanced fertilizer monthly</ListItem>
                                  <ListItem>Reduce feeding in winter</ListItem>
                                  <ListItem>Watch for nutrient deficiency</ListItem>
                                </UnorderedList>
                              </VStack>
                            </HStack>
                          </CardBody>
                        </Card>

                        <Card>
                          <CardBody>
                            <HStack spacing={4} align="start">
                              <Box color="red.400">
                                <FaBug size={24} />
                              </Box>
                              <VStack align="start" spacing={2}>
                                <Heading size="sm">Common Issues</Heading>
                                <UnorderedList spacing={2}>
                                  <ListItem>Monitor for pests</ListItem>
                                  <ListItem>Check for diseases</ListItem>
                                  <ListItem>Maintain good air flow</ListItem>
                                </UnorderedList>
                              </VStack>
                            </HStack>
                          </CardBody>
                        </Card>
                      </SimpleGrid>
                    </Box>
                  </VStack>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </VStack>
        </GridItem>
      </Grid>
    </Container>
  );
}; 