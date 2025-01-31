import { Box, Flex, Link, useColorModeValue, Menu, MenuButton, MenuList, MenuItem, Avatar, Button, HStack, useToast } from '@chakra-ui/react'
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'
import { auth } from '../config/firebase'
import { useAuth } from '../contexts/AuthContext'
import { useState, useEffect, useRef } from 'react'
import { LocationPicker } from './LocationPicker'
import { WeatherWidget } from './WeatherWidget'
import { Location } from '../services/locationService'
import { WeatherData, getWeatherData, getWeatherByCity } from '../services/weatherService'
import { env } from '../config/env'

const DEFAULT_LOCATION = {
  name: 'New Delhi',
  country: 'India',
  lat: 28.6139,
  lon: 77.2090
};

export const Navigation = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const bg = useColorModeValue('white', 'gray.800')
  const borderColor = useColorModeValue('gray.200', 'gray.700')
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null)
  const toast = useToast()
  const locationErrorHandled = useRef(false)

  const isActive = (path: string) => {
    if (path === '/botanica') {
      return location.pathname.startsWith('/botanica')
    }
    return location.pathname === path
  }

  const handleSignOut = async () => {
    try {
      await auth.signOut()
      navigate('/login')
    } catch (error) {
      console.error('[Navigation] Error signing out:', error)
    }
  }

  const handleGeolocationError = (error: GeolocationPositionError) => {
    console.error('[Navigation] Geolocation error:', error)
    if (!locationErrorHandled.current) {
      toast({
        title: 'Location Service',
        description: `${error.message || 'Geolocation unavailable'}. Showing weather for New Delhi, India.`,
        status: 'info',
        duration: 5000,
        isClosable: true,
      })
      locationErrorHandled.current = true
    }
    handleDefaultLocation()
  }

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            console.log('[Navigation] Got user location, fetching weather data...')
            const weatherData = await getWeatherData(
              position.coords.latitude,
              position.coords.longitude
            )
            console.log('[Navigation] Successfully fetched weather data')
            setWeather(weatherData)
            setCurrentLocation({
              id: 'current',
              type: 'other',
              name: weatherData.location.name,
              address: `${weatherData.location.name}, ${weatherData.location.country}`,
              lat: weatherData.location.lat,
              lon: weatherData.location.lon
            })
          } catch (error) {
            console.error('[Navigation] Error fetching weather:', error)
            // Only show toast for non-API key related errors
            if (error instanceof Error && !error.message.includes('API key')) {
              toast({
                title: 'Error fetching weather',
                description: error.message,
                status: 'error',
                duration: 5000,
                isClosable: true,
              })
            }
            // Fallback to default location
            handleDefaultLocation()
          }
        },
        handleGeolocationError
      )
    } else {
      console.log('[Navigation] Geolocation not supported, using default location')
      if (!locationErrorHandled.current) {
        toast({
          title: 'Location Service',
          description: 'Geolocation not supported. Showing weather for New Delhi, India.',
          status: 'info',
          duration: 5000,
          isClosable: true,
        })
        locationErrorHandled.current = true
      }
      handleDefaultLocation()
    }
  }, [])

  const handleDefaultLocation = async () => {
    try {
      console.log('[Navigation] Fetching weather for default location:', DEFAULT_LOCATION.name)
      const weatherData = await getWeatherByCity(`${DEFAULT_LOCATION.name}, ${DEFAULT_LOCATION.country}`)
      console.log('[Navigation] Successfully fetched default weather data')
      setWeather(weatherData)
      setCurrentLocation({
        id: 'default',
        type: 'other',
        name: DEFAULT_LOCATION.name,
        address: `${DEFAULT_LOCATION.name}, ${DEFAULT_LOCATION.country}`,
        lat: DEFAULT_LOCATION.lat,
        lon: DEFAULT_LOCATION.lon
      })
    } catch (error) {
      console.error('[Navigation] Error fetching default weather:', error)
      if (error instanceof Error && !error.message.includes('API key')) {
        toast({
          title: 'Error fetching weather',
          description: error.message,
          status: 'error',
          duration: 5000,
          isClosable: true,
        })
      }
    }
  }

  const handleLocationSelect = async (location: Location) => {
    try {
      console.log('[Navigation] Fetching weather for selected location:', location.name)
      const weatherData = await getWeatherData(location.lat, location.lon)
      console.log('[Navigation] Successfully fetched weather for selected location')
      setWeather(weatherData)
      setCurrentLocation(location)
    } catch (error) {
      console.error('[Navigation] Error fetching weather for selected location:', error)
      toast({
        title: 'Error fetching weather',
        description: error instanceof Error ? error.message : 'Failed to fetch weather data',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    }
  }

  const handleGlobalLocation = async (location: Location) => {
    try {
      console.log('[Navigation] Fetching weather for selected location:', location.name)
      const weatherData = await getWeatherData(location.lat, location.lon)
      console.log('[Navigation] Successfully fetched weather for selected location')
      setWeather(weatherData)
      setCurrentLocation(location)
    } catch (error) {
      console.error('[Navigation] Error fetching weather for selected location:', error)
      toast({
        title: 'Error fetching weather',
        description: error instanceof Error ? error.message : 'Failed to fetch weather data',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    }
  }

  return (
    <Box bg={bg} borderBottom="1px" borderColor={borderColor} position="fixed" w="100%" zIndex={1}>
      <Box maxW="60%" mx="auto">
        <Flex h={16} alignItems="center" justifyContent="space-between">
          <HStack spacing={8} flex={1} alignItems="center">
            <Link 
              as={RouterLink} 
              to="/" 
              fontWeight="bold" 
              fontSize="2xl" 
              color="brand.500"
              _hover={{ textDecoration: 'none' }}
              display="flex"
              alignItems="center"
              height="100%"
            >
              Greenur
            </Link>

            <HStack spacing={4} height="100%" alignItems="center">
              {[
                { path: '/botanica', label: 'Botanica' },
                { path: '/tracker', label: 'Tracker' },
                { path: '/connect', label: 'Connect' },
                { path: '/marketplace', label: 'Marketplace' },
              ].map(({ path, label }) => (
                <Link
                  key={path}
                  as={RouterLink}
                  to={path}
                  color={isActive(path) ? 'brand.500' : undefined}
                  fontWeight={isActive(path) ? 'bold' : 'normal'}
                  fontSize="md"
                  display="flex"
                  alignItems="center"
                  height="100%"
                  _hover={{
                    color: 'brand.500',
                    textDecoration: 'none',
                  }}
                >
                  {label}
                </Link>
              ))}
            </HStack>
          </HStack>

          <HStack spacing={4}>
            <LocationPicker
              onLocationSelect={handleGlobalLocation}
              currentLocation={currentLocation}
              onLocationError={(error) => {
                if (!locationErrorHandled.current) {
                  toast({
                    title: 'Location Service',
                    description: `${error.message}. Showing weather for New Delhi, India.`,
                    status: 'info',
                    duration: 5000,
                    isClosable: true,
                  });
                  locationErrorHandled.current = true;
                }
              }}
            />
            {weather && <WeatherWidget weather={weather} />}
            {currentUser ? (
              <Menu>
                <MenuButton
                  as={Button}
                  rounded="full"
                  variant="link"
                  cursor="pointer"
                  minW={10}
                >
                  <Avatar 
                    size="sm" 
                    src={currentUser.photoURL || undefined}
                    name={currentUser.displayName || undefined}
                    bg="brand.500"
                    color="white"
                  />
                </MenuButton>
                <MenuList>
                  <MenuItem as={RouterLink} to="/profile">Profile</MenuItem>
                  <MenuItem as={RouterLink} to="/settings">Settings</MenuItem>
                  <MenuItem onClick={handleSignOut}>Sign Out</MenuItem>
                </MenuList>
              </Menu>
            ) : (
              <HStack spacing={4}>
                <Button as={RouterLink} to="/login" variant="ghost">
                  Login
                </Button>
                <Button as={RouterLink} to="/signup">
                  Sign Up
                </Button>
              </HStack>
            )}
          </HStack>
        </Flex>
      </Box>
    </Box>
  )
}
