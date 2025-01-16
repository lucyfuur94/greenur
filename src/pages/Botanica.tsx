import {
  Box,
  Container,
  Input,
  InputGroup,
  InputRightElement,
  VStack,
  Text,
  Grid,
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
  Image,
  AspectRatio,
  Link,
  Divider,
} from '@chakra-ui/react'
import { useState, useRef } from 'react'
import { FaSearch, FaCamera } from 'react-icons/fa'
import { analyzePlantImage } from '../services/gptService'
import { storage } from '../config/firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { useAuth } from '../contexts/AuthContext'

interface PlantInfo {
  plantType: string
  growthStage: string
  growingConditions: string
  carePlan: string
}

interface VideoInfo {
  title: string
  videoId: string
  thumbnail: string
  category: 'tutorial' | 'timelapse' | 'creative'
}

export const Botanica = () => {
  const { currentUser } = useAuth()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [plantInfo, setPlantInfo] = useState<PlantInfo | null>(null)
  const [videos, setVideos] = useState<VideoInfo[]>([])

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedImage(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
      handleImageAnalysis(file)
    }
  }

  const handleImageAnalysis = async (file: File) => {
    try {
      setIsAnalyzing(true)
      
      // Upload image to Firebase Storage
      const imageRef = ref(storage, `temp/${currentUser?.uid}/${Date.now()}_${file.name}`)
      const uploadResult = await uploadBytes(imageRef, file)
      const imageUrl = await getDownloadURL(uploadResult.ref)

      // Analyze the plant
      const analysis = await analyzePlantImage(imageUrl)
      setPlantInfo(analysis)

      // TODO: Fetch related videos
      // This would be implemented in a separate Netlify function
      const mockVideos: VideoInfo[] = [
        {
          title: 'How to Care for Your Plant',
          videoId: 'example1',
          thumbnail: 'https://img.youtube.com/vi/example1/0.jpg',
          category: 'tutorial'
        },
        // Add more mock videos
      ]
      setVideos(mockVideos)

      onOpen()
    } catch (error) {
      console.error('Error analyzing image:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={8} align="stretch">
        {/* Search Section */}
        <Box>
          <InputGroup size="lg">
            <Input
              placeholder="Search plants by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <InputRightElement width="4.5rem">
              <Button h="1.75rem" size="sm" onClick={() => fileInputRef.current?.click()}>
                <FaCamera />
              </Button>
            </InputRightElement>
          </InputGroup>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/*"
            style={{ display: 'none' }}
          />
        </Box>

        {/* Plant Information Modal */}
        <Modal isOpen={isOpen} onClose={onClose} size="xl">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Plant Information</ModalHeader>
            <ModalCloseButton />
            <ModalBody pb={6}>
              <Tabs>
                <TabList>
                  <Tab>Details</Tab>
                  <Tab>Videos</Tab>
                  <Tab>Resources</Tab>
                </TabList>

                <TabPanels>
                  {/* Plant Details */}
                  <TabPanel>
                    {plantInfo && (
                      <VStack align="stretch" spacing={4}>
                        <Box>
                          <Text fontWeight="bold">Plant Type:</Text>
                          <Text>{plantInfo.plantType}</Text>
                        </Box>
                        <Box>
                          <Text fontWeight="bold">Growth Stage:</Text>
                          <Text>{plantInfo.growthStage}</Text>
                        </Box>
                        <Box>
                          <Text fontWeight="bold">Growing Conditions:</Text>
                          <Text>{plantInfo.growingConditions}</Text>
                        </Box>
                        <Box>
                          <Text fontWeight="bold">Care Plan:</Text>
                          <Text>{plantInfo.carePlan}</Text>
                        </Box>
                      </VStack>
                    )}
                  </TabPanel>

                  {/* Videos */}
                  <TabPanel>
                    <VStack spacing={4}>
                      {videos.map((video) => (
                        <Box key={video.videoId} width="100%">
                          <AspectRatio ratio={16 / 9}>
                            <iframe
                              src={`https://www.youtube.com/embed/${video.videoId}`}
                              title={video.title}
                              allowFullScreen
                            />
                          </AspectRatio>
                          <Text mt={2} fontWeight="bold">{video.title}</Text>
                          <Text color="gray.500">{video.category}</Text>
                        </Box>
                      ))}
                    </VStack>
                  </TabPanel>

                  {/* Additional Resources */}
                  <TabPanel>
                    <VStack align="stretch" spacing={4}>
                      <Text>Additional resources and articles will be displayed here.</Text>
                      {/* TODO: Add scraped content */}
                    </VStack>
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </ModalBody>
          </ModalContent>
        </Modal>

        {/* Search Results */}
        <Grid templateColumns="repeat(auto-fill, minmax(250px, 1fr))" gap={6}>
          {/* TODO: Add search results */}
        </Grid>
      </VStack>
    </Container>
  )
} 