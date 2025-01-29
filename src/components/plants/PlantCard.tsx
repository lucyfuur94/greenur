import { Box, Image, Text, VStack } from '@chakra-ui/react';

interface PlantCardProps {
  name: string;
  secondaryText: string;
  imageUrl: string;
  onClick: () => void;
}

/**
 * PlantCard component displays plant information in a card format
 * Used for search results and plant listings
 */
export const PlantCard = ({
  name,
  secondaryText,
  imageUrl,
  onClick
}: PlantCardProps) => {
  return (
    <Box
      as="article"
      borderWidth="1px"
      borderRadius="lg"
      overflow="hidden"
      cursor="pointer"
      onClick={onClick}
      transition="all 0.2s"
      _hover={{
        transform: 'translateY(-2px)',
        boxShadow: 'md'
      }}
    >
      <Image
        src={imageUrl}
        alt={name}
        height="200px"
        width="100%"
        objectFit="cover"
      />
      <Box p={4}>
        <Text fontSize="sm" fontWeight="medium" mb={1}>
          {name}
        </Text>
        <Text fontSize="sm" color="gray.600">
          {secondaryText}
        </Text>
      </Box>
    </Box>
  );
};
