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
} from '@chakra-ui/react'
import { useState, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { updateProfile } from 'firebase/auth'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../config/firebase'

export const Profile = () => {
  const { currentUser } = useAuth()
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
    <Box p={8}>
      <VStack spacing={8} align="stretch">
        <HStack spacing={4} align="center">
          <Box position="relative">
            <Avatar
              size="xl"
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
          <VStack align="start" spacing={1}>
            <Text fontSize="2xl" fontWeight="bold">
              {currentUser?.displayName || 'Welcome!'}
            </Text>
            <Text color="gray.600">{currentUser?.email}</Text>
            <Button size="sm" onClick={onOpen}>
              Edit Profile
            </Button>
          </VStack>
        </HStack>
      </VStack>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
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
    </Box>
  );
}; 