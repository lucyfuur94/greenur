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
  Badge,
  Button,
  HStack,
  Link,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Spinner,
} from '@chakra-ui/react'
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPlantDetails } from '../services/wikiService'
import { fetchOpenFarmData } from '../services/plantService'
import { fetchPlantNews } from '../services/newsService'
import { fetchPlantVideos, Video } from '../services/videoService'
import { FaArrowLeft, FaExclamationTriangle, FaExternalLinkAlt } from 'react-icons/fa'

interface NewsArticle {
  title: string
  description: string
  url: string
  imageUrl?: string
  provider: string
  datePublished: string
}

interface PlantDetails {
  name: string;
  scientificName: string;
  family: string;
  description: string;
  type: string;
  growthHabit: string;
  nativeTo: string[];
  careInstructions: Record<string, string>;
  images: string[];
}

export const BotanicaPlant = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingOpenFarm, setIsLoadingOpenFarm] = useState(true)
  const [isLoadingNews, setIsLoadingNews] = useState(true)
  const [isLoadingVideos, setIsLoadingVideos] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [plantDetails, setPlantDetails] = useState<PlantDetails | null>(null)
  const [openFarmData, setOpenFarmData] = useState<any>(null)
  const [news, setNews] = useState<NewsArticle[]>([])
  const [videos, setVideos] = useState<Record<Video['category'], Video[]>>({
    'How to grow': [],
    'Care tips': [],
    'Facts': [],
    'Other': []
  })

  useEffect(() => {
    if (id) {
      loadPlantDetails()
    }
  }, [id])

  const loadPlantDetails = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const details = await getPlantDetails(id!)
      setPlantDetails(details)

      // Fetch additional data in parallel
      Promise.all([
        fetchOpenFarmData(details.name).then(data => {
          setOpenFarmData(data)
          setIsLoadingOpenFarm(false)
        }),
        fetchPlantNews(details.name).then(articles => {
          setNews(articles)
          setIsLoadingNews(false)
        }),
        fetchPlantVideos(details.name).then(videoData => {
          setVideos(videoData)
          setIsLoadingVideos(false)
        })
      ]).catch(error => {
        console.error('Error fetching additional data:', error)
      })

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

  const hasCareInstructions = (data: any) => {
    if (!data) return false;
    if (data.overview || data.sun_requirements || data.soil_requirements || data.water_requirements) {
      return true;
    }
    return Object.values(plantDetails?.careInstructions || {}).some(value => value);
  };

  if (isLoading) {
    return (
      <Container maxW="container.xl" py={8}>
        <VStack spacing={8} align="stretch">
          <Button
            leftIcon={<FaArrowLeft />}
            variant="ghost"
            onClick={() => navigate(-1)}
            alignSelf="flex-start"
          >
            Back to Search
          </Button>
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
      <Container maxW="container.xl" py={8}>
        <VStack spacing={8} align="stretch">
          <Button
            leftIcon={<FaArrowLeft />}
            variant="ghost"
            onClick={() => navigate(-1)}
            alignSelf="flex-start"
          >
            Back to Search
          </Button>
          <Box
            p={8}
            bg="red.50"
            color="red.600"
            borderRadius="lg"
            display="flex"
            alignItems="center"
            gap={4}
          >
            <FaExclamationTriangle size={24} />
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
    <Box>
      {/* Sticky Header */}
      <Box 
        position="sticky" 
        top={0} 
        bg="white" 
        borderBottom="1px" 
        borderColor="gray.200"
        zIndex={10}
        py={4}
        px={8}
      >
        <Container maxW="container.xl">
          <Button
            leftIcon={<FaArrowLeft />}
            variant="ghost"
            onClick={() => navigate(-1)}
          >
            Back to Search
          </Button>
        </Container>
      </Box>

      <Container maxW="container.xl" py={8}>
        <Grid 
          templateColumns={{ base: '1fr', xl: '350px 1fr 350px' }}
          gap={8}
        >
          {/* Left Column - Image and Basic Info */}
          <GridItem>
            <VStack spacing={6} position="sticky" top="100px">
              <Box
                borderRadius="lg"
                overflow="hidden"
                bg="gray.100"
                width="100%"
                height="350px"
              >
                {plantDetails.images?.[0] ? (
                  <Image
                    src={plantDetails.images[0]}
                    alt={plantDetails.name}
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
                    <Heading size="lg">{plantDetails.name}</Heading>
                    <Text color="gray.600" fontStyle="italic">
                      {plantDetails.scientificName}
                    </Text>
                    {plantDetails.family && (
                      <Box>
                        <Text fontWeight="bold">Family</Text>
                        <Text>{plantDetails.family}</Text>
                      </Box>
                    )}
                    {plantDetails.type && (
                      <Box>
                        <Text fontWeight="bold">Type</Text>
                        <Text>{plantDetails.type}</Text>
                      </Box>
                    )}
                    {plantDetails.growthHabit && (
                      <Box>
                        <Text fontWeight="bold">Growth Habit</Text>
                        <Text>{plantDetails.growthHabit}</Text>
                      </Box>
                    )}
                    {plantDetails.nativeTo?.length > 0 && (
                      <Box>
                        <Text fontWeight="bold">Native To</Text>
                        <HStack spacing={2} flexWrap="wrap">
                          {plantDetails.nativeTo.map((region: string) => (
                            <Badge key={region} colorScheme="brand">
                              {region}
                            </Badge>
                          ))}
                        </HStack>
                      </Box>
                    )}
                  </VStack>
                </CardBody>
              </Card>
            </VStack>
          </GridItem>

          {/* Middle Column - Description and Care */}
          <GridItem>
            <VStack spacing={6} align="stretch">
              {plantDetails.description && (
                <Card>
                  <CardHeader>
                    <Heading size="md">Description</Heading>
                  </CardHeader>
                  <CardBody>
                    <Text>{plantDetails.description}</Text>
                  </CardBody>
                </Card>
              )}

              {(isLoadingOpenFarm || hasCareInstructions(openFarmData) || hasCareInstructions(plantDetails)) && (
                <Card>
                  <CardHeader>
                    <Heading size="md">Care Instructions</Heading>
                  </CardHeader>
                  <CardBody>
                    {isLoadingOpenFarm ? (
                      <VStack spacing={4} align="center">
                        <Spinner />
                        <Text>Fetching care information...</Text>
                      </VStack>
                    ) : openFarmData && hasCareInstructions(openFarmData) ? (
                      <VStack spacing={4} align="stretch">
                        {openFarmData.overview && (
                          <Box>
                            <Text fontWeight="bold">Overview</Text>
                            <Text>{openFarmData.overview}</Text>
                          </Box>
                        )}
                        {openFarmData.sun_requirements && (
                          <Box>
                            <Text fontWeight="bold">Sun Requirements</Text>
                            <Text>{openFarmData.sun_requirements}</Text>
                          </Box>
                        )}
                        {openFarmData.soil_requirements && (
                          <Box>
                            <Text fontWeight="bold">Soil Requirements</Text>
                            <Text>{openFarmData.soil_requirements}</Text>
                          </Box>
                        )}
                        {openFarmData.water_requirements && (
                          <Box>
                            <Text fontWeight="bold">Water Requirements</Text>
                            <Text>{openFarmData.water_requirements}</Text>
                          </Box>
                        )}
                      </VStack>
                    ) : hasCareInstructions(plantDetails) ? (
                      <VStack spacing={4} align="stretch">
                        {Object.entries(plantDetails.careInstructions)
                          .filter(([_, value]) => value)
                          .map(([key, value]) => (
                            <Box key={key}>
                              <Text fontWeight="bold" textTransform="capitalize">
                                {key}
                              </Text>
                              <Text>{value}</Text>
                            </Box>
                          ))}
                      </VStack>
                    ) : null}
                  </CardBody>
                </Card>
              )}
            </VStack>
          </GridItem>

          {/* Right Column - News and Videos */}
          <GridItem>
            <VStack spacing={6} position="sticky" top="100px">
              {(isLoadingNews || news.length > 0) && (
                <Card width="100%">
                  <CardHeader>
                    <Heading size="md">Recent News</Heading>
                  </CardHeader>
                  <CardBody>
                    {isLoadingNews ? (
                      <VStack spacing={4} align="center">
                        <Spinner />
                        <Text>Loading news articles...</Text>
                      </VStack>
                    ) : (
                      <VStack spacing={4} align="stretch">
                        {news.map((article, index) => (
                          <Card key={index} variant="outline">
                            <CardBody>
                              <VStack spacing={3} align="stretch">
                                {article.imageUrl && (
                                  <Image
                                    src={article.imageUrl}
                                    alt={article.title}
                                    borderRadius="md"
                                    height="150px"
                                    objectFit="cover"
                                  />
                                )}
                                <Heading size="sm">{article.title}</Heading>
                                <Text noOfLines={2} fontSize="sm">
                                  {article.description}
                                </Text>
                                <Link href={article.url} isExternal>
                                  <Button
                                    rightIcon={<FaExternalLinkAlt />}
                                    size="sm"
                                    variant="outline"
                                    width="full"
                                  >
                                    Read More
                                  </Button>
                                </Link>
                              </VStack>
                            </CardBody>
                          </Card>
                        ))}
                      </VStack>
                    )}
                  </CardBody>
                </Card>
              )}

              {(isLoadingVideos || Object.values(videos).some(v => v.length > 0)) && (
                <Card width="100%">
                  <CardHeader>
                    <Heading size="md">Videos</Heading>
                  </CardHeader>
                  <CardBody>
                    {isLoadingVideos ? (
                      <VStack spacing={4} align="center">
                        <Spinner />
                        <Text>Loading videos...</Text>
                      </VStack>
                    ) : (
                      <Tabs>
                        <TabList>
                          {Object.entries(videos)
                            .filter(([_, videos]) => videos.length > 0)
                            .map(([category]) => (
                              <Tab key={category}>{category}</Tab>
                            ))}
                        </TabList>
                        <TabPanels>
                          {Object.entries(videos)
                            .filter(([_, videos]) => videos.length > 0)
                            .map(([category, categoryVideos]) => (
                              <TabPanel key={category} p={0} mt={4}>
                                <VStack spacing={4} align="stretch">
                                  {categoryVideos.map((video) => (
                                    <Card key={video.id} variant="outline">
                                      <CardBody>
                                        <VStack spacing={3} align="stretch">
                                          <Box
                                            position="relative"
                                            paddingBottom="56.25%"
                                            height="0"
                                            overflow="hidden"
                                            borderRadius="md"
                                          >
                                            <Box
                                              as="iframe"
                                              position="absolute"
                                              top="0"
                                              left="0"
                                              width="100%"
                                              height="100%"
                                              src={`https://www.youtube.com/embed/${video.id}`}
                                              title={video.title}
                                              allowFullScreen={true}
                                              border="0"
                                            />
                                          </Box>
                                          <Heading size="sm" noOfLines={2}>
                                            {video.title}
                                          </Heading>
                                        </VStack>
                                      </CardBody>
                                    </Card>
                                  ))}
                                </VStack>
                              </TabPanel>
                            ))}
                        </TabPanels>
                      </Tabs>
                    )}
                  </CardBody>
                </Card>
              )}
            </VStack>
          </GridItem>
        </Grid>
      </Container>
    </Box>
  )
} 