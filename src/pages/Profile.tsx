import {
  Box,
  VStack,
  Text,
  Button,
  Avatar,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Input,
  FormControl,
  FormLabel,
  HStack,
  Badge,
  SimpleGrid,
  Icon,
  Flex,
  Container,
} from '@chakra-ui/react'
import { useState, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { updateProfile } from 'firebase/auth'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../config/firebase'
import { FaLeaf, FaHome, FaSun, FaMapMarkerAlt } from 'react-icons/fa'

export const Profile = () => {
  const { currentUser, userPreferences } = useAuth()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  const handleUpdateProfile = async () => {
    if (!currentUser) return;

    try {
      await updateProfile(currentUser, {
        displayName: displayName
      });

      toast({
        title: 'Success',
        description: 'Profile updated successfully',
        status: 'success',
        duration: 3000,
      });
      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update profile',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    try {
      const photoRef = ref(storage, `profiles/${currentUser.uid}/${Date.now()}_${file.name}`);
      const uploadResult = await uploadBytes(photoRef, file);
      const photoURL = await getDownloadURL(uploadResult.ref);

      await updateProfile(currentUser, { photoURL });

      toast({
        title: 'Success',
        description: 'Profile photo updated successfully',
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update profile photo',
        status: 'error',
        duration: 5000,
      });
    }
  };

  return (
    <Container maxW="container.xl" p={{ base: 4, md: 8 }}>
      <VStack spacing={{ base: 6, md: 8 }} align="stretch">
        <Flex 
          direction={{ base: "column", md: "row" }} 
          align={{ base: "center", md: "flex-start" }}
          gap={{ base: 4, md: 6 }}
        >
          <Box position="relative">
            <Avatar
              size={{ base: "xl", md: "2xl" }}
              src={currentUser?.photoURL || undefined}
              name={currentUser?.displayName || currentUser?.email || 'User'}
            />
            <Button
              size="sm"
              position="absolute"
              bottom={0}
              right={0}
              rounded="full"
              onClick={() => fileInputRef.current?.click()}
            >
              📷
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              style={{ display: 'none' }}
            />
          </Box>
          <VStack 
            align={{ base: "center", md: "flex-start" }} 
            spacing={2}
            textAlign={{ base: "center", md: "left" }}
          >
            <Text 
              fontSize={{ base: "xl", md: "2xl" }} 
              fontWeight="bold"
            >
              {userPreferences?.name || currentUser?.displayName || 'Welcome!'}
            </Text>
            <Text color="gray.600">{currentUser?.email}</Text>
            <Button size="sm" onClick={onOpen}>
              Edit Profile
            </Button>
          </VStack>
        </Flex>

        {userPreferences && (
          <Box 
            bg="white" 
            p={{ base: 4, md: 6 }} 
            borderRadius="lg" 
            boxShadow="sm"
          >
            <Text 
              fontSize={{ base: "lg", md: "xl" }} 
              fontWeight="bold" 
              color="brand.500"
              mb={4}
            >
              Your Preferences
            </Text>

            <SimpleGrid 
              columns={{ base: 1, sm: 2 }} 
              spacing={{ base: 4, md: 6 }}
            >
              <Box>
                <HStack spacing={2} mb={2}>
                  <Icon as={FaLeaf} color="brand.500" />
                  <Text fontWeight="bold">Experience Level</Text>
                </HStack>
                <Badge colorScheme="brand" fontSize={{ base: "sm", md: "md" }}>
                  {userPreferences.experience.charAt(0).toUpperCase() + userPreferences.experience.slice(1)}
                </Badge>
              </Box>

              <Box>
                <HStack spacing={2} mb={2}>
                  <Icon as={FaHome} color="brand.500" />
                  <Text fontWeight="bold">Garden Type</Text>
                </HStack>
                <Badge colorScheme="brand" fontSize={{ base: "sm", md: "md" }}>
                  {userPreferences.gardenType.charAt(0).toUpperCase() + userPreferences.gardenType.slice(1)}
                </Badge>
              </Box>

              <Box>
                <HStack spacing={2} mb={2}>
                  <Icon as={FaSun} color="brand.500" />
                  <Text fontWeight="bold">Interests</Text>
                </HStack>
                <Flex gap={2} flexWrap="wrap">
                  {userPreferences.interests.map((interest, index) => (
                    <Badge 
                      key={index} 
                      colorScheme="brand" 
                      fontSize={{ base: "xs", md: "sm" }}
                    >
                      {interest}
                    </Badge>
                  ))}
                </Flex>
              </Box>

              {userPreferences.location && (
                <Box>
                  <HStack spacing={2} mb={2}>
                    <Icon as={FaMapMarkerAlt} color="brand.500" />
                    <Text fontWeight="bold">Location</Text>
                  </HStack>
                  <Text 
                    fontSize={{ base: "sm", md: "md" }} 
                    color="gray.600"
                  >
                    {userPreferences.location.city}, {userPreferences.location.country}
                  </Text>
                </Box>
              )}
            </SimpleGrid>
          </Box>
        )}
      </VStack>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent mx={4}>
          <ModalHeader>Edit Profile</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <FormControl>
              <FormLabel>Display Name</FormLabel>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your name"
              />
            </FormControl>
            <Button mt={4} colorScheme="brand" onClick={handleUpdateProfile}>
              Save Changes
            </Button>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Container>
  );
}; 