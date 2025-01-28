import { useState } from 'react';
import {
  Box,
  Image,
  SimpleGrid,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  Text,
} from '@chakra-ui/react';

export interface PlantImage {
  url: string;
  alt?: string;
  attribution?: string;
}

export interface ImageGalleryProps {
  /**
   * Array of images to display in the gallery
   */
  images: PlantImage[];
  /**
   * Optional title for the gallery
   */
  title?: string;
}

/**
 * ImageGallery component displays a collection of plant images
 * with modal view for larger images
 */
export const ImageGallery = ({
  images,
  title,
}: ImageGalleryProps) => {
  const [selectedImage, setSelectedImage] = useState<number | null>(null);

  const handleImageClick = (index: number) => {
    setSelectedImage(index);
  };

  const handleCloseModal = () => {
    setSelectedImage(null);
  };

  if (images.length === 0) {
    return (
      <Box p={4} textAlign="center">
        <Text color="gray.500">No images available</Text>
      </Box>
    );
  }

  return (
    <Box>
      {title && (
        <Text fontSize="lg" fontWeight="semibold" mb={4}>
          {title}
        </Text>
      )}
      
      <SimpleGrid columns={{ base: 2, md: 3, lg: 4 }} spacing={4}>
        {images.map((image, index) => (
          <Box
            key={index}
            borderRadius="lg"
            overflow="hidden"
            cursor="pointer"
            onClick={() => handleImageClick(index)}
            transition="transform 0.2s"
            _hover={{ transform: 'scale(1.05)' }}
          >
            <Image
              src={image.url}
              alt={image.alt || `Plant image ${index + 1}`}
              objectFit="cover"
              width="100%"
              height="200px"
            />
          </Box>
        ))}
      </SimpleGrid>

      <Modal
        isOpen={selectedImage !== null}
        onClose={handleCloseModal}
        size="4xl"
        isCentered
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {selectedImage !== null && images[selectedImage].alt}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {selectedImage !== null && (
              <Box>
                <Image
                  src={images[selectedImage].url}
                  alt={images[selectedImage].alt || `Plant image ${selectedImage + 1}`}
                  objectFit="contain"
                  width="100%"
                  maxH="70vh"
                />
                {images[selectedImage].attribution && (
                  <Text fontSize="sm" color="gray.500" mt={2}>
                    {images[selectedImage].attribution}
                  </Text>
                )}
              </Box>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};
