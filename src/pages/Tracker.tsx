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
} from '@chakra-ui/react'
import { useState, useRef, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { storage, db } from '../config/firebase'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { FaPlus } from 'react-icons/fa'
import { analyzePlantImage, type PlantAnalysis } from '../services/gptService'

export const Tracker = () => {
  const { isOpen, onOpen, onClose: onDisclosureClose } = useDisclosure()
  const { currentUser } = useAuth()
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [nickname, setNickname] = useState('')
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<PlantAnalysis | null>(null)
  const [uploadedImageRef, setUploadedImageRef] = useState<string | null>(null)

  const resetState = () => {
    setNickname('')
    setSelectedImage(null)
    setImagePreview('')
    setIsAnalyzing(false)
    setAnalysis(null)
    setUploadedImageRef(null)
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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedImage(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const analyzePlant = async (imageUrl: string) => {
    try {
      const analysis = await analyzePlantImage(imageUrl)
      return analysis
    } catch (error) {
      console.error('Error analyzing plant:', error)
      throw new Error('Failed to analyze plant image')
    }
  }

  const handleCancel = async () => {
    if (isAnalyzing && uploadedImageRef) {
      try {
        const imageRef = ref(storage, uploadedImageRef)
        await deleteObject(imageRef)
      } catch (error) {
        console.error('Error deleting image:', error)
      }
    }
    setIsAnalyzing(false)
    setUploadedImageRef(null)
  }

  const handleSubmit = async () => {
    if (!selectedImage) {
      toast({
        title: 'Please select an image',
        status: 'error',
        duration: 3000,
      })
      return
    }

    try {
      setIsAnalyzing(true)
      
      // Upload image to Firebase Storage
      const imagePath = `plants/${currentUser?.uid}/${Date.now()}_${selectedImage.name}`
      const imageRef = ref(storage, imagePath)
      const uploadResult = await uploadBytes(imageRef, selectedImage)
      const imageUrl = await getDownloadURL(uploadResult.ref)
      setUploadedImageRef(imagePath)

      // Analyze the plant using GPT
      const plantAnalysis = await analyzePlant(imageUrl)
      setAnalysis(plantAnalysis)

      // Generate default nickname if not provided
      const plantNickname = nickname || `${plantAnalysis.plantType.split(' ')[0]}_${Date.now().toString().slice(-4)}`

      // Save to Firestore
      await addDoc(collection(db, 'plants'), {
        userId: currentUser?.uid,
        nickname: plantNickname,
        ...plantAnalysis,
        imageUrl,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
      })

      toast({
        title: 'Plant added successfully!',
        status: 'success',
        duration: 3000,
      })
      
      onClose()
    } catch (error) {
      console.error('Error adding plant:', error)
      toast({
        title: 'Error adding plant',
        description: 'Please try again',
        status: 'error',
        duration: 3000,
      })
      if (uploadedImageRef) {
        try {
          const imageRef = ref(storage, uploadedImageRef)
          await deleteObject(imageRef)
        } catch (error) {
          console.error('Error deleting image:', error)
        }
      }
      setIsAnalyzing(false)
      setUploadedImageRef(null)
    }
  }

  return (
    <Box>
      <Grid templateColumns="repeat(auto-fill, minmax(250px, 1fr))" gap={6}>
        {/* Add New Plant Tile */}
        <Box
          as="button"
          height="300px"
          borderWidth={2}
          borderStyle="dashed"
          borderRadius="xl"
          display="flex"
          alignItems="center"
          justifyContent="center"
          onClick={onOpen}
          _hover={{ borderColor: 'brand.500', color: 'brand.500' }}
          transition="all 0.2s"
        >
          <VStack spacing={4}>
            <FaPlus size={24} />
            <Text fontWeight="medium">Add New Plant</Text>
          </VStack>
        </Box>

        {/* Plant tiles will be mapped here */}
      </Grid>

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
                  <Image src={imagePreview} alt="Plant preview" objectFit="cover" width="100%" height="100%" />
                ) : (
                  <VStack spacing={2}>
                    <FaPlus size={24} />
                    <Text>Upload Plant Image</Text>
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

              {/* Nickname Input */}
              <FormControl>
                <FormLabel>Nickname (Optional)</FormLabel>
                <Input
                  placeholder="Give your plant a name"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  disabled={isAnalyzing}
                />
              </FormControl>

              {isAnalyzing && (
                <Box width="100%">
                  <Text mb={2}>Analyzing your plant...</Text>
                  <Progress size="xs" isIndeterminate colorScheme="brand" mb={4} />
                  <Button
                    width="full"
                    onClick={handleCancel}
                    variant="outline"
                  >
                    Cancel Analysis
                  </Button>
                </Box>
              )}

              {analysis && (
                <VStack align="stretch" width="100%" spacing={4}>
                  <Box>
                    <Text fontWeight="bold">Plant Type:</Text>
                    <Text>{analysis.plantType}</Text>
                  </Box>
                  <Box>
                    <Text fontWeight="bold">Growth Stage:</Text>
                    <Badge colorScheme="brand" fontSize="md" px={3} py={1}>
                      {analysis.growthStage}
                    </Badge>
                  </Box>
                  <Box>
                    <Text fontWeight="bold">Growing Conditions:</Text>
                    <Text>{analysis.growingConditions}</Text>
                  </Box>
                  <Box>
                    <Text fontWeight="bold">Care Plan:</Text>
                    <Text>{analysis.carePlan}</Text>
                  </Box>
                </VStack>
              )}

              <Button
                colorScheme="brand"
                width="100%"
                onClick={handleSubmit}
                isLoading={isAnalyzing}
                isDisabled={!selectedImage || isAnalyzing}
              >
                Add Plant
              </Button>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  )
} 