import {
  Box,
  SimpleGrid,
  Card,
  CardBody,
  HStack,
  VStack,
  Text,
  Heading,
  UnorderedList,
  ListItem,
} from '@chakra-ui/react';
import { FaSun, FaTint, FaSeedling, FaThermometerHalf, FaBug } from 'react-icons/fa';

export interface CareInstruction {
  type: 'light' | 'water' | 'fertilizer' | 'temperature' | 'issues';
  title: string;
  requirements: string[];
}

export interface CareInstructionsProps {
  /**
   * Array of care instructions for the plant
   */
  instructions: CareInstruction[];
  /**
   * Optional title for the care instructions section
   */
  title?: string;
}

const iconMap = {
  light: { icon: FaSun, color: 'orange.400' },
  water: { icon: FaTint, color: 'blue.400' },
  fertilizer: { icon: FaSeedling, color: 'green.400' },
  temperature: { icon: FaThermometerHalf, color: 'red.400' },
  issues: { icon: FaBug, color: 'purple.400' },
};

/**
 * CareInstructions component displays plant care requirements
 * organized by category with icons
 */
export const CareInstructions = ({
  instructions,
  title = 'Care Instructions',
}: CareInstructionsProps) => {
  return (
    <Box width="100%">
      <Heading size="md" mb={4}>{title}</Heading>
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
        {instructions.map((instruction, index) => {
          const { icon: Icon, color } = iconMap[instruction.type];
          return (
            <Card key={index}>
              <CardBody>
                <HStack spacing={4} align="start">
                  <Box color={color}>
                    <Icon size={24} />
                  </Box>
                  <VStack align="start" spacing={2}>
                    <Heading size="sm">{instruction.title}</Heading>
                    <UnorderedList spacing={2} pl={4}>
                      {instruction.requirements.map((req, reqIndex) => (
                        <ListItem key={reqIndex}>
                          <Text fontSize="sm">{req}</Text>
                        </ListItem>
                      ))}
                    </UnorderedList>
                  </VStack>
                </HStack>
              </CardBody>
            </Card>
          );
        })}
      </SimpleGrid>
    </Box>
  );
};
