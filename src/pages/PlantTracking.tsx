import {
  Box,
  Button,
  VStack,
  HStack,
  Text,
  Image,
  useToast,
  Heading,
  Badge,
  Divider,
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Progress,
  Card,
  CardBody,
  List,
  ListItem,
  ListIcon,
} from '@chakra-ui/react'
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FaArrowLeft, FaCamera, FaCheckCircle, FaTimesCircle } from 'react-icons/fa'
import { useAuth } from '../contexts/AuthContext'
import { storage } from '../config/firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { analyzePlantImage } from '../services/gptService'
import type { TrackedPlant, PlantAnalysis } from '../types/plant'

interface CheckupResult {
  stage: string;
  concerns: string[];
  carePlan: string[];
  nextCheckupDate: string;
  todoItems: string[];
}

interface HistoricalReport {
  date: string;
  imageUrl: string;
  checkupResult: CheckupResult;
  completedTodos: string[];
  growthAnalysis?: {
    rate: string;
    changes: string[];
  };
}

export const PlantTracking = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { isOpen, onOpen, onClose } = useDisclosure()

  const [plant, setPlant] = useState<TrackedPlant | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [currentCheckup, setCurrentCheckup] = useState<CheckupResult | null>(null)
  const [historicalReports, setHistoricalReports] = useState<HistoricalReport[]>([])

  useEffect(() => {
    const fetchPlant = async () => {
      try {
        // Fetch plant details from MongoDB using the correct endpoint
        const response = await fetch(`/.netlify/functions/tracked-plants?id=${id}`)
        if (!response.ok) {
          throw new Error('Failed to fetch plant details')
        }
        const data = await response.json()
        setPlant(data)
        
        // Fetch historical reports
        try {
          const checkupsResponse = await fetch(`/.netlify/functions/plant-checkup?plantId=${id}`)
          if (checkupsResponse.ok) {
            const checkupsData = await checkupsResponse.json()
            setHistoricalReports(checkupsData.checkups || [])
          }
        } catch (error) {
          console.error('Error fetching checkups:', error)
        }
      } catch (error) {
        console.error('Error fetching plant:', error)
        toast({
          title: 'Error',
          description: 'Failed to load plant details',
          status: 'error',
          duration: 5000,
        })
        // Navigate back to tracker on error
        navigate('/tracker')
      } finally {
        setIsLoading(false)
      }
    }

    if (id) {
      fetchPlant()
    }
  }, [id, navigate])

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedImage(file)
      onOpen()
    }
  }

  const performCheckup = async () => {
    if (!selectedImage || !plant) return

    try {
      setIsAnalyzing(true)

      // Upload image to Firebase Storage
      const storageRef = ref(storage, `plants/${currentUser?.uid}/${plant._id}/checkups/${Date.now()}_${selectedImage.name}`)
      const uploadResult = await uploadBytes(storageRef, selectedImage)
      const imageUrl = await getDownloadURL(uploadResult.ref)

      // Analyze the new image
      const analysis = await analyzePlantImage(selectedImage)

      // If we have previous checkups, include the last image for comparison
      let growthAnalysis = null
      if (historicalReports.length > 0) {
        // TODO: Implement growth analysis by comparing with previous image
      }

      // Format checkup result
      const checkupResult: CheckupResult = {
        stage: analysis.growthStage || 'Unknown',
        concerns: analysis.problems || [],
        carePlan: analysis.treatment || [],
        nextCheckupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Default to 1 week
        todoItems: [], // Will be populated based on analysis
      }

      setCurrentCheckup(checkupResult)

      // Save checkup result
      // TODO: Implement save checkup endpoint

      toast({
        title: 'Checkup Complete',
        description: 'Plant analysis has been completed successfully',
        status: 'success',
        duration: 5000,
      })
    } catch (error) {
      console.error('Error performing checkup:', error)
      toast({
        title: 'Error',
        description: 'Failed to complete plant checkup',
        status: 'error',
        duration: 5000,
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Add back button handler
  const handleBack = () => {
    navigate('/tracker')
  }

  if (isLoading) {
    return (
      <Box p={6}>
        <HStack spacing={4} mb={6}>
          <IconButton
            aria-label="Back to tracker"
            icon={<FaArrowLeft />}
            onClick={handleBack}
            variant="ghost"
          />
          <Text>Loading plant details...</Text>
        </HStack>
        <Progress size="xs" isIndeterminate />
      </Box>
    )
  }

  if (!plant) {
    return (
      <Box p={6}>
        <HStack spacing={4} mb={6}>
          <IconButton
            aria-label="Back to tracker"
            icon={<FaArrowLeft />}
            onClick={handleBack}
            variant="ghost"
          />
          <Text>Plant not found</Text>
        </HStack>
      </Box>
    )
  }

  return (
    <Box p={6}>
      {/* Header with improved back button */}
      <HStack spacing={4} mb={6} align="center">
        <Button
          leftIcon={<FaArrowLeft />}
          onClick={handleBack}
          variant="ghost"
          size="md"
        >
          Back to Tracker
        </Button>
        <VStack align="start" spacing={1}>
          <Heading size="lg">{plant.nickname}</Heading>
          <Text color="gray.600" fontSize="sm">
            {plant.plantDetails.common_name} • <i>{plant.plantDetails.scientific_name}</i>
          </Text>
        </VStack>
      </HStack>

      {/* Main Content */}
      <HStack align="start" spacing={8}>
        {/* Left Column - Current Plant Info */}
        <VStack align="stretch" flex={1}>
          <Card>
            <CardBody>
              <Image
                src={plant.currentImage}
                alt={plant.nickname}
                borderRadius="lg"
                mb={4}
              />
              <VStack align="start" spacing={2}>
                <Badge colorScheme="green">{plant.healthStatus}</Badge>
                <Text fontSize="sm" color="gray.600">
                  Added on {new Date(plant.dateAdded).toLocaleDateString()}
                </Text>
              </VStack>
            </CardBody>
          </Card>

          <Button
            leftIcon={<FaCamera />}
            colorScheme="green"
            onClick={() => fileInputRef.current?.click()}
            mt={4}
          >
            Perform Checkup
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept="image/*"
            onChange={handleImageSelect}
          />
        </VStack>

        {/* Right Column - History & Reports */}
        <VStack align="stretch" flex={2}>
          {currentCheckup && (
            <Card mb={4}>
              <CardBody>
                <Heading size="md" mb={4}>Latest Checkup Results</Heading>
                <VStack align="stretch" spacing={4}>
                  <Box>
                    <Text fontWeight="bold">Growth Stage:</Text>
                    <Text>{currentCheckup.stage}</Text>
                  </Box>
                  
                  {currentCheckup.concerns.length > 0 && (
                    <Box>
                      <Text fontWeight="bold" mb={2}>Concerns:</Text>
                      <List spacing={2}>
                        {currentCheckup.concerns.map((concern, i) => (
                          <ListItem key={i}>
                            <ListIcon as={FaTimesCircle} color="red.500" />
                            {concern}
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  )}

                  <Box>
                    <Text fontWeight="bold" mb={2}>Care Plan:</Text>
                    <List spacing={2}>
                      {currentCheckup.carePlan.map((item, i) => (
                        <ListItem key={i}>
                          <ListIcon as={FaCheckCircle} color="green.500" />
                          {item}
                        </ListItem>
                      ))}
                    </List>
                  </Box>

                  <Divider />

                  <Box>
                    <Text fontWeight="bold">Next Checkup:</Text>
                    <Text>{new Date(currentCheckup.nextCheckupDate).toLocaleDateString()}</Text>
                  </Box>
                </VStack>
              </CardBody>
            </Card>
          )}

          {historicalReports.length > 0 && (
            <Card>
              <CardBody>
                <Heading size="md" mb={4}>Historical Reports</Heading>
                <VStack align="stretch" spacing={4}>
                  {historicalReports.map((report, index) => (
                    <Card key={index} variant="outline">
                      <CardBody>
                        <HStack spacing={4}>
                          <Image
                            src={report.imageUrl}
                            alt={`Checkup on ${new Date(report.date).toLocaleDateString()}`}
                            boxSize="100px"
                            objectFit="cover"
                            borderRadius="md"
                          />
                          <VStack align="start" spacing={2}>
                            <Text fontWeight="bold">
                              Checkup on {new Date(report.date).toLocaleDateString()}
                            </Text>
                            {report.growthAnalysis && (
                              <Text fontSize="sm">
                                Growth Rate: {report.growthAnalysis.rate}
                              </Text>
                            )}
                            <Badge colorScheme="green">
                              {report.completedTodos.length} tasks completed
                            </Badge>
                          </VStack>
                        </HStack>
                      </CardBody>
                    </Card>
                  ))}
                </VStack>
              </CardBody>
            </Card>
          )}
        </VStack>
      </HStack>

      {/* Checkup Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Plant Checkup</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {selectedImage && (
              <VStack spacing={4}>
                <Image
                  src={URL.createObjectURL(selectedImage)}
                  alt="Selected plant"
                  maxH="400px"
                  objectFit="contain"
                />
                <Button
                  colorScheme="green"
                  onClick={performCheckup}
                  isLoading={isAnalyzing}
                  width="full"
                >
                  Analyze Plant
                </Button>
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  )
} 