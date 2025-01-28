import { Box, Image, Text, VStack, Badge, Card, CardBody, HStack } from '@chakra-ui/react';

export interface PlantCardProps {
  /** Plant name */
  name: string;
  /** Scientific name of the plant */
  scientificName: string;
  /** URL to plant's primary image */
  imageUrl: string;
  /** Type of plant (e.g., Flowering Plant, Herb, etc.) */
  type: string;
  /** Handler for when card is clicked */
  onClick?: () => void;
}

/**
 * PlantCard component displays plant information in a card format
 * Used for search results and plant listings
 */
export const PlantCard = ({
  name,
  scientificName,
  imageUrl,
  type,
  onClick,
}: PlantCardProps) => {
  return (
    <Card
      onClick={onClick}
      cursor={onClick ? 'pointer' : 'default'}
      _hover={onClick ? { transform: 'translateY(-2px)', shadow: 'lg' } : undefined}
      transition="all 0.2s"
      overflow="hidden"
    >
      <CardBody p={0}>
        <Box position="relative" height="200px">
          <Image
            src={imageUrl || '/default-plant.png'}
            alt={name}
            objectFit="cover"
            width="100%"
            height="100%"
            boxShadow="md"
            borderRadius="md"
          />
        </Box>
        <VStack align="stretch" p={4} spacing={2}>
          <Text fontWeight="semibold" fontSize="lg" noOfLines={1}>
            {name}
          </Text>
          <HStack spacing={1}>
            <Text fontSize="sm" color="gray.600">
              {type}
            </Text>
            <Text fontSize="sm" color="gray.600" fontStyle="italic">
              • {scientificName}
            </Text>
          </HStack>
        </VStack>
      </CardBody>
    </Card>
  );
};
