import {
  Box,
  Card,
  CardBody,
  Text,
  VStack,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Icon,
} from '@chakra-ui/react';
import { FaSun, FaTint, FaThermometerHalf } from 'react-icons/fa';

export interface WeatherCareProps {
  temperature: number;
  humidity: number;
  sunlight: 'low' | 'medium' | 'high';
  plantType: string;
}

interface CareRecommendation {
  type: 'watering' | 'sunlight' | 'temperature';
  message: string;
  status: 'info' | 'warning' | 'error';
}

const iconMap = {
  temperature: { icon: FaThermometerHalf, color: 'red.400' },
  watering: { icon: FaTint, color: 'blue.400' },
  sunlight: { icon: FaSun, color: 'orange.400' },
};

/**
 * WeatherCare component displays weather-based care recommendations
 * for plants based on current conditions
 */
export const WeatherCare = ({
  temperature,
  humidity,
  sunlight,
  plantType,
}: WeatherCareProps) => {
  const getCareRecommendations = (): CareRecommendation[] => {
    const recommendations: CareRecommendation[] = [];
    
    // Temperature checks
    if (temperature > 30) {
      recommendations.push({
        type: 'temperature',
        message: `High temperature alert! Consider moving your ${plantType} to a cooler spot.`,
        status: 'warning',
      });
    }

    // Humidity checks
    if (humidity < 40) {
      recommendations.push({
        type: 'watering',
        message: 'Low humidity detected. Consider using a humidity tray.',
        status: 'info',
      });
    }

    // Sunlight checks
    if (sunlight === 'high') {
      recommendations.push({
        type: 'sunlight',
        message: 'Strong sunlight detected. Monitor for leaf burn.',
        status: 'info',
      });
    }

    return recommendations;
  };

  const recommendations = getCareRecommendations();

  if (recommendations.length === 0) {
    return (
      <Card>
        <CardBody>
          <Alert status="success" variant="subtle">
            <AlertIcon />
            <AlertDescription>
              Current conditions are optimal for your {plantType}.
            </AlertDescription>
          </Alert>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <Text fontSize="lg" fontWeight="semibold" mb={4}>
          Weather-Based Care
        </Text>
        <VStack spacing={3} align="stretch">
          {recommendations.map((rec, index) => {
            const { icon, color } = iconMap[rec.type];
            return (
              <Alert
                key={index}
                status={rec.status}
                variant="left-accent"
                alignItems="flex-start"
              >
                <Icon as={icon} color={color} boxSize={5} mr={3} mt={1} />
                <Box flex={1}>
                  <AlertTitle>
                    {rec.type.charAt(0).toUpperCase() + rec.type.slice(1)} Alert
                  </AlertTitle>
                  <AlertDescription>
                    {rec.message}
                  </AlertDescription>
                </Box>
              </Alert>
            );
          })}
        </VStack>
      </CardBody>
    </Card>
  );
};
