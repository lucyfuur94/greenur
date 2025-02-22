import {
  Box,
  HStack,
  Text,
  Image,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  PopoverArrow,
  VStack,
  Divider,
  Spinner,
} from '@chakra-ui/react';
import { WeatherData } from '../services/weatherService';

interface WeatherWidgetProps {
  weather?: WeatherData;
  isLoading?: boolean;
}

export const WeatherWidget = ({ weather, isLoading = false }: WeatherWidgetProps) => {
  if (isLoading) {
    return (
      <HStack spacing={2} p={2}>
        <Spinner size="sm" />
        <Text fontSize="sm">Loading weather...</Text>
      </HStack>
    );
  }

  if (!weather?.current) {
    return null;
  }

  const hasForecast = weather?.forecast?.forecastday && weather.forecast.forecastday.length > 0;

  return (
    <Popover trigger="hover" placement="bottom-start">
      <PopoverTrigger>
        <HStack
          spacing={2}
          p={2}
          borderRadius="md"
          cursor="pointer"
          _hover={{ bg: 'gray.50' }}
        >
          <Image
            src={`https:${weather.current.condition.icon}`}
            alt={weather.current.condition.text}
            boxSize="24px"
          />
          <Text fontSize="sm">
            {Math.round(weather.current.temp_c)}°C
          </Text>
        </HStack>
      </PopoverTrigger>
      <PopoverContent width="300px">
        <PopoverArrow />
        <PopoverBody p={4}>
          <VStack spacing={4} align="stretch">
            {/* Current Weather */}
            <Box>
              <Text fontSize="sm" fontWeight="medium" color="gray.600" mb={2}>
                Current Weather
              </Text>
              <HStack spacing={4}>
                <Image
                  src={`https:${weather.current.condition.icon}`}
                  alt={weather.current.condition.text}
                  boxSize="40px"
                />
                <VStack align="start" spacing={0}>
                  <Text fontWeight="medium">{Math.round(weather.current.temp_c)}°C</Text>
                  <Text fontSize="sm" color="gray.600">
                    {weather.current.condition.text}
                  </Text>
                </VStack>
                <VStack align="start" spacing={0} ml="auto">
                  <Text fontSize="sm">Humidity: {weather.current.humidity}%</Text>
                  <Text fontSize="sm">Wind: {Math.round(weather.current.wind_kph)} km/h</Text>
                </VStack>
              </HStack>
            </Box>

            {/* Forecast - Only show if forecast data exists */}
            {hasForecast && (
              <>
                <Divider />
                <Box>
                  <Text fontSize="sm" fontWeight="medium" color="gray.600" mb={2}>
                    7-Day Forecast
                  </Text>
                  <VStack spacing={2} align="stretch">
                    {weather.forecast.forecastday.map((day) => (
                      <HStack key={day.date} spacing={4}>
                        <Text fontSize="sm" width="100px">
                          {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                        </Text>
                        <Image
                          src={`https:${day.day.condition.icon}`}
                          alt={day.day.condition.text}
                          boxSize="24px"
                        />
                        <Text fontSize="sm" flex={1}>
                          {Math.round(day.day.mintemp_c)}° - {Math.round(day.day.maxtemp_c)}°C
                        </Text>
                      </HStack>
                    ))}
                  </VStack>
                </Box>
              </>
            )}
          </VStack>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
};