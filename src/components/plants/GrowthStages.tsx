import {
  Box,
  Card,
  CardHeader,
  CardBody,
  VStack,
  Text,
  Heading,
  UnorderedList,
  ListItem,
  Progress,
  HStack,
  Badge,
} from '@chakra-ui/react';

export interface GrowthStage {
  stage: string;
  description: string;
  duration: string;
  requirements: string[];
  currentStage?: boolean;
}

export interface GrowthStagesProps {
  /**
   * Array of growth stages for the plant
   */
  stages: GrowthStage[];
  /**
   * Current stage index (0-based)
   */
  currentStage?: number;
  /**
   * Callback when a stage is selected
   */
  onStageSelect?: (index: number) => void;
}

/**
 * GrowthStages component displays the different growth stages of a plant
 * with requirements and progress tracking
 */
export const GrowthStages = ({
  stages,
  currentStage = 0,
  onStageSelect,
}: GrowthStagesProps) => {
  const progress = ((currentStage + 1) / stages.length) * 100;

  return (
    <Box width="100%">
      <VStack spacing={4} align="stretch">
        <Box>
          <Heading size="md" mb={2}>Growth Progress</Heading>
          <Progress
            value={progress}
            colorScheme="green"
            height="8px"
            borderRadius="full"
            mb={2}
          />
          <HStack justify="space-between">
            <Text fontSize="sm" color="gray.600">Stage {currentStage + 1} of {stages.length}</Text>
            <Text fontSize="sm" color="gray.600">{Math.round(progress)}% Complete</Text>
          </HStack>
        </Box>

        {stages.map((stage, index) => (
          <Card
            key={index}
            variant={index === currentStage ? 'filled' : 'outline'}
            bg={index === currentStage ? 'green.50' : undefined}
            onClick={() => onStageSelect?.(index)}
            cursor={onStageSelect ? 'pointer' : 'default'}
            _hover={onStageSelect ? { transform: 'translateY(-2px)', shadow: 'md' } : undefined}
            transition="all 0.2s"
          >
            <CardHeader pb={2}>
              <HStack justify="space-between" align="center">
                <Heading size="sm">
                  {index + 1}. {stage.stage}
                </Heading>
                {index === currentStage && (
                  <Badge colorScheme="green">Current Stage</Badge>
                )}
              </HStack>
            </CardHeader>
            <CardBody pt={0}>
              <VStack align="start" spacing={2}>
                <Text>{stage.description}</Text>
                <Text fontSize="sm" color="gray.600">
                  Duration: {stage.duration}
                </Text>
                <Box>
                  <Text fontSize="sm" fontWeight="medium" mb={1}>
                    Requirements:
                  </Text>
                  <UnorderedList spacing={1} pl={4}>
                    {stage.requirements.map((req, reqIndex) => (
                      <ListItem key={reqIndex} fontSize="sm">
                        {req}
                      </ListItem>
                    ))}
                  </UnorderedList>
                </Box>
              </VStack>
            </CardBody>
          </Card>
        ))}
      </VStack>
    </Box>
  );
};
