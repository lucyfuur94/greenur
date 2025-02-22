import {
  Box,
  Button,
  Grid,
  Text,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  VStack,
  Input,
  FormControl,
  FormLabel,
  useToast,
  Image,
  Progress,
  Badge,
  HStack,
  Spinner,
  Center,
  Flex,
  SimpleGrid,
  IconButton,
  Heading,
} from '@chakra-ui/react'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { storage } from '../config/firebase'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { FaPlus, FaTrash } from 'react-icons/fa'
import { analyzePlantImage } from '../services/gptService'
import type { PlantAnalysis, TrackedPlant, PlantToAdd } from '../types/plant'
import { useLocation, useNavigate } from 'react-router-dom'
import { addTrackedPlant, getTrackedPlants, deleteTrackedPlant } from '../services/trackedPlantsService'

export const Tracker = () => {
  const { isOpen, onOpen, onClose: onDisclosureClose } = useDisclosure()
  const { currentUser } = useAuth()
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  
  const [nickname, setNickname] = useState('')
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<PlantAnalysis | null>(null)
  const [uploadedImageRef, setUploadedImageRef] = useState<string | null>(null)
  const [plantToAdd, setPlantToAdd] = useState<PlantToAdd | null>(null)
  const [isScientificNameValid, setIsScientificNameValid] = useState(false)
  const [plants, setPlants] = useState<TrackedPlant[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedPlant, setSelectedPlant] = useState<PlantToAdd | null>(null)

  useEffect(() => {
    if (!currentUser) return

    // Fetch tracked plants from MongoDB
    const fetchTrackedPlants = async () => {
      try {
        const plants = await getTrackedPlants(currentUser.uid)
        setPlants(plants)
      } catch (error) {
        console.error('Error fetching tracked plants:', error)
        if (error instanceof Error && !error.message.includes('no plants found')) {
          toast({
            title: 'Error',
            description: 'Failed to fetch your plants',
            status: 'error',
            duration: 3000,
          })
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchTrackedPlants()
  }, [currentUser])

  useEffect(() => {
    // Check if we have plant details from navigation
    const state = location.state as { plantToAdd?: PlantToAdd }
    if (state?.plantToAdd) {
      setPlantToAdd(state.plantToAdd)
      setNickname(state.plantToAdd.name)
      setIsScientificNameValid(true) // Pre-validated from Botanica
      onOpen() // Open modal when coming from Botanica
    }
  }, [location.state])

  const resetState = () => {
    setNickname('')
    setSelectedImage(null)
    setImagePreview('')
    setIsAnalyzing(false)
    setAnalysis(null)
    setUploadedImageRef(null)
    setPlantToAdd(null)
    setIsScientificNameValid(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const onClose = useCallback(async () => {
    // If there's an uploaded image but analysis was cancelled, delete it
    if (uploadedImageRef && isAnalyzing) {
      try {
        const imageRef = ref(storage, uploadedImageRef)
        await deleteObject(imageRef)
      } catch (error) {
        console.error('Error deleting image:', error)
      }
    }
    resetState()
    onDisclosureClose()
  }, [uploadedImageRef, isAnalyzing, onDisclosureClose])

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedImage(file)
      const reader = new FileReader()
      reader.onloadend = async () => {
        setImagePreview(reader.result as string)
        setIsAnalyzing(true)
        
        try {
          // Always analyze the image
          const analysis = await analyzePlantImage(file)
          
          // If we have pre-filled plant data, compare scientific names
          if (plantToAdd) {
            // Clean and compare scientific names (ignore case and spaces)
            const cleanName = (name: string) => name.toLowerCase().replace(/\s+/g, '')
            const existingName = cleanName(plantToAdd.scientificName)
            const analyzedName = cleanName(analysis.scientificName)
            
            const isValid = existingName === analyzedName
            setIsScientificNameValid(isValid)
            
            if (!isValid) {
              // Reset the image selection
              setSelectedImage(null)
              setImagePreview('')
              if (fileInputRef.current) {
                fileInputRef.current.value = ''
              }
              
              // Show warning to user
              toast({
                title: 'Different Plant Detected',
                description: `The uploaded image appears to be of ${analysis.commonName} (${analysis.scientificName}), not ${plantToAdd.name} (${plantToAdd.scientificName}). Please add this as a new plant instead.`,
                status: 'warning',
                duration: 8000,
                isClosable: true,
              })
              return
            }
          } else {
            // For direct uploads, set the plant details from analysis
            setPlantToAdd({
              id: '',
              name: analysis.commonName,
              scientificName: analysis.scientificName,
              type: analysis.plantType || 'Plant',
              image: ''
            })
            setNickname(analysis.commonName)
            setIsScientificNameValid(true) // Direct upload is always valid
          }
        } catch (error) {
          console.error('Error analyzing plant:', error)
          toast({
            title: 'Analysis Failed',
            description: error instanceof Error ? error.message : 'Failed to analyze plant image',
            status: 'error',
            duration: 3000,
          })
          
          // Reset image on error
          setSelectedImage(null)
          setImagePreview('')
          setIsScientificNameValid(false)
          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }
        } finally {
          setIsAnalyzing(false)
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async () => {
    if (!selectedImage && !plantToAdd?.image) {
      toast({
        title: 'Please select an image',
        status: 'error',
        duration: 3000,
      })
      return
    }

    if (!isScientificNameValid) {
      toast({
        title: 'Invalid Plant Image',
        description: 'Please upload an image of the correct plant species.',
        status: 'error',
        duration: 3000,
      })
      return
    }

    try {
      setIsAnalyzing(true)
      
      let imageUrl = plantToAdd?.image
      let plantDetails = plantToAdd

      // If we have a new image upload
      if (selectedImage) {
        // Upload image to Firebase Storage with correct permissions
        const storageRef = ref(storage, `plants/${currentUser?.uid}/${Date.now()}_${selectedImage.name}`)
        
        // Set metadata to allow read access
        const metadata = {
          contentType: selectedImage.type,
          customMetadata: {
            uploadedBy: currentUser?.uid || 'unknown'
          }
        }

        const uploadResult = await uploadBytes(storageRef, selectedImage, metadata)
        imageUrl = await getDownloadURL(uploadResult.ref)
        setUploadedImageRef(uploadResult.ref.fullPath)
      }

      // Generate default nickname if not provided
      const plantNickname = nickname || (plantDetails ? plantDetails.name : 'Plant') + `_${Date.now().toString().slice(-4)}`
      const now = new Date().toISOString()

      // Save to MongoDB user_plants collection
      const trackedPlant = {
        userId: currentUser?.uid || '',
        nickname: plantNickname,
        plantId: plantDetails?.id || Date.now().toString(),
        currentImage: imageUrl || '',
        dateAdded: now,
        healthStatus: 'healthy',
        plantDetails: {
          common_name: plantDetails?.name || '',
          scientific_name: plantDetails?.scientificName || '',
          plant_type: plantDetails?.type || 'Plant'
        },
        imageHistory: [{
          url: imageUrl || '',
          timestamp: now
        }]
      }

      if (!currentUser?.uid) {
        throw new Error('User not authenticated')
      }

      const result = await addTrackedPlant(trackedPlant)

      toast({
        title: 'Plant added successfully!',
        status: 'success',
        duration: 3000,
      })
      
      onClose()
      // Navigate to the plant tracking page
      navigate(`/tracker/plant/${result.plantId}`)
    } catch (error) {
      console.error('Error adding plant:', error)
      toast({
        title: 'Error adding plant',
        description: error instanceof Error ? error.message : 'Please try again',
        status: 'error',
        duration: 5000,
      })
      if (uploadedImageRef) {
        try {
          const imageRef = ref(storage, uploadedImageRef)
          await deleteObject(imageRef)
        } catch (deleteError) {
          console.error('Error deleting failed upload:', deleteError)
        }
      }
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleAddNewClick = () => {
    // Reset state when opening modal directly
    resetState()
    onOpen()
  }

  const AddNewPlantButton = ({ isLarge = false }) => (
    <Button
      onClick={handleAddNewClick}
      leftIcon={<FaPlus />}
      colorScheme="brand"
      variant={isLarge ? "outline" : "solid"}
      size={isLarge ? "lg" : "md"}
      height={isLarge ? "60px" : "40px"}
      width={isLarge ? "200px" : "auto"}
      borderWidth={isLarge ? 2 : 1}
    >
      Add New Plant
    </Button>
  )

  const handleDeletePlant = async (plantId: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent navigation when clicking delete
    
    try {
      await deleteTrackedPlant(plantId)
      setPlants(plants.filter(p => p._id !== plantId))
      toast({
        title: 'Plant removed',
        description: 'Plant has been removed from tracking',
        status: 'success',
        duration: 3000,
      })
    } catch (error) {
      console.error('Error deleting plant:', error)
      toast({
        title: 'Error',
        description: 'Failed to remove plant from tracking',
        status: 'error',
        duration: 3000,
      })
    }
  }

  const handlePlantClick = (plantId: string) => {
    navigate(`/tracker/plant/${plantId}`)
  }

  if (isLoading) {
    return (
      <Center height="calc(100vh - 100px)">
        <Spinner size="xl" />
      </Center>
    )
  }

  return (
    <Box p={6}>
      {plants.length > 0 ? (
        <VStack spacing={6} align="stretch">
          <HStack justify="space-between" align="center">
            <Heading size="lg">Plant Tracker</Heading>
            <AddNewPlantButton />
          </HStack>

          <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing={6}>
            {plants.map((plant) => (
              <Box
                key={plant._id}
                borderWidth="1px"
                borderRadius="lg"
                overflow="hidden"
                cursor="pointer"
                onClick={() => handlePlantClick(plant._id)}
                position="relative"
                transition="transform 0.2s"
                _hover={{ transform: 'scale(1.02)' }}
              >
                <Box position="relative" pb="100%">
                  <Image
                    src={plant.currentImage}
                    alt={plant.nickname}
                    objectFit="cover"
                    position="absolute"
                    top={0}
                    left={0}
                    w="100%"
                    h="100%"
                  />
                  <IconButton
                    aria-label="Delete plant"
                    icon={<FaTrash />}
                    size="sm"
                    position="absolute"
                    top={2}
                    right={2}
                    colorScheme="red"
                    opacity={0.8}
                    onClick={(e) => handleDeletePlant(plant._id, e)}
                    _hover={{ opacity: 1 }}
                  />
                </Box>
                <Box p={4}>
                  <Text fontWeight="bold" fontSize="lg" mb={1}>
                    {plant.nickname}
                  </Text>
                  <Text fontSize="sm" color="gray.600">
                    {plant.plantDetails.common_name}
                  </Text>
                  <Badge colorScheme={plant.healthStatus === 'healthy' ? 'green' : 'orange'} mt={2}>
                    {plant.healthStatus}
                  </Badge>
                </Box>
              </Box>
            ))}
          </SimpleGrid>
        </VStack>
      ) : (
        <Center minH="calc(100vh - 200px)" p={8}>
          <VStack spacing={6}>
            <Text fontSize="lg" color="gray.600">No plants being tracked yet</Text>
            <AddNewPlantButton isLarge />
          </VStack>
        </Center>
      )}

      {/* Add New Plant Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="xl" closeOnOverlayClick={!isAnalyzing}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add New Plant</ModalHeader>
          <ModalCloseButton isDisabled={isAnalyzing} />
          <ModalBody pb={6}>
            <VStack spacing={6}>
              {/* Image Upload */}
              <Box
                width="100%"
                height="300px"
                borderWidth={2}
                borderStyle="dashed"
                borderRadius="xl"
                display="flex"
                alignItems="center"
                justifyContent="center"
                position="relative"
                overflow="hidden"
                onClick={() => !isAnalyzing && fileInputRef.current?.click()}
                cursor={isAnalyzing ? 'not-allowed' : 'pointer'}
                _hover={{ borderColor: isAnalyzing ? undefined : 'brand.500' }}
              >
                {imagePreview ? (
                  <Box position="relative" width="100%" height="100%">
                    <Image src={imagePreview} alt="Plant preview" objectFit="cover" width="100%" height="100%" />
                    {isAnalyzing && (
                      <Box
                        position="absolute"
                        top={0}
                        left={0}
                        right={0}
                        bottom={0}
                        bg="blackAlpha.600"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                      >
                        <VStack spacing={4} color="white">
                          <Spinner size="xl" />
                          <Text>Analyzing plant...</Text>
                        </VStack>
                      </Box>
                    )}
                  </Box>
                ) : (
                  <VStack spacing={2}>
                    <FaPlus size={24} />
                    <Text>Upload Plant Image</Text>
                    <Text fontSize="sm" color="gray.500">
                      {location.state?.plantToAdd 
                        ? `Upload an image of ${location.state.plantToAdd.name}`
                        : 'Upload an image to identify your plant'
                      }
                    </Text>
                  </VStack>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                  accept="image/*"
                  style={{ display: 'none' }}
                  disabled={isAnalyzing}
                />
              </Box>

              {/* Plant Information - Only show after image analysis or if coming from Botanica */}
              {(plantToAdd && (imagePreview || location.state?.plantToAdd)) && (
                <VStack spacing={2} align="stretch" width="100%">
                  <HStack justify="space-between">
                    <Text fontWeight="bold">Name:</Text>
                    <Text>{plantToAdd.name}</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontWeight="bold">Scientific Name:</Text>
                    <Text fontStyle="italic">{plantToAdd.scientificName}</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontWeight="bold">Type:</Text>
                    <Text>{plantToAdd.type}</Text>
                  </HStack>
                </VStack>
              )}

              {/* Nickname Input - Only show after image analysis or if coming from Botanica */}
              {(plantToAdd && (imagePreview || location.state?.plantToAdd)) && (
                <FormControl>
                  <FormLabel>Nickname (Optional)</FormLabel>
                  <Input
                    placeholder="Give your plant a name"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    disabled={isAnalyzing}
                  />
                </FormControl>
              )}

              <Button
                colorScheme="green"
                width="100%"
                onClick={handleSubmit}
                isLoading={isAnalyzing}
                loadingText="Adding Plant..."
                isDisabled={!isScientificNameValid || isAnalyzing || (!selectedImage && !plantToAdd?.image)}
              >
                Add to My Plants
              </Button>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  )
} 