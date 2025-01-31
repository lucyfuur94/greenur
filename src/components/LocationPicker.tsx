import {
  Box,
  Button,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
  PopoverArrow,
  PopoverCloseButton,
  VStack,
  HStack,
  Text,
  Input,
  IconButton,
  useToast,
  Divider,
  List,
  ListItem,
  Spinner,
} from '@chakra-ui/react';
import { FaMapMarkerAlt, FaPlus, FaHome, FaBriefcase, FaMapPin, FaTrash } from 'react-icons/fa';
import { useState, useEffect, useCallback } from 'react';
import { Location, getCurrentPosition, saveUserLocation, getUserLocations, searchLocations, deleteUserLocation } from '../services/locationService';
import { useAuth } from '../contexts/AuthContext';
import debounce from 'lodash/debounce';

interface LocationPickerProps {
  onLocationSelect: (location: Location) => void;
  currentLocation: Location | null;
  onLocationError?: (error: GeolocationPositionError) => void;
}

export const LocationPicker = ({ onLocationSelect, currentLocation, onLocationError }: LocationPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [savedLocations, setSavedLocations] = useState<Location[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Location[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { currentUser } = useAuth();
  const toast = useToast();
  const [savingLocationIds, setSavingLocationIds] = useState<string[]>([]);
  const [deletingLocationIds, setDeletingLocationIds] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (!currentUser) return;
      
      try {
        console.log('[LocationPicker] Loading saved locations for user:', currentUser.uid);
        const locations = await getUserLocations(currentUser.uid);
        if (isMounted) {
          console.log('[LocationPicker] Loaded saved locations:', locations.saved);
          setSavedLocations(locations.saved);
        }
      } catch (error) {
        if (isMounted) {
          console.error('[LocationPicker] Error loading saved locations:', error);
          toast({
            title: 'Error',
            description: 'Failed to load saved locations',
            status: 'error',
            duration: 3000,
          });
        }
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [currentUser, toast]);

  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (query.trim()) {
        setIsSearching(true);
        try {
          console.log('[LocationPicker] Searching locations for query:', query);
          const results = await searchLocations(query);
          console.log('[LocationPicker] Search results:', results);
          setSearchResults(results);
        } catch (error) {
          console.error('[LocationPicker] Error searching locations:', error);
          toast({
            title: 'Error',
            description: 'Failed to search locations',
            status: 'error',
            duration: 3000,
          });
        }
        setIsSearching(false);
      } else {
        setSearchResults([]);
      }
    }, 500),
    []
  );

  useEffect(() => {
    console.log('[LocationPicker] Search query changed:', searchQuery);
    debouncedSearch(searchQuery);
    return () => debouncedSearch.cancel();
  }, [searchQuery, debouncedSearch]);

  const handleLocationError = (error: GeolocationPositionError) => {
    if (onLocationError) {
      onLocationError(error);
    } else {
      const errorMessage = error.message || 'Location permission denied. Please enable location services';
      
      toast({
        title: 'Location Access',
        description: `${errorMessage}. Using default location: New Delhi, India. Change via navigation bar.`,
        status: 'info',
        duration: 5000,
        isClosable: true,
      });
    }

    onLocationSelect({
      id: 'default',
      type: 'other',
      name: 'New Delhi, India',
      address: '28.6139, 77.2090',
      lat: 28.6139,
      lon: 77.2090
    });
    setIsOpen(false);
  };

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      handleLocationError({
        code: 2,
        message: 'Geolocation not supported',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3
      } as GeolocationPositionError);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude: lat, longitude: lon } = position.coords;
        const location: Location = {
          id: 'current',
          type: 'other',
          name: 'Current Location',
          address: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
          lat,
          lon
        };
        onLocationSelect(location);
        setIsOpen(false);
      },
      handleLocationError
    );
  };

  const handleSaveLocation = async (location: Location) => {
    if (!currentUser) return;

    try {
      setSavingLocationIds(prev => [...prev, location.id]);
      
      // Local duplicate check
      const exists = savedLocations.some(loc => 
        loc.address === location.address || 
        (loc.lat === location.lat && loc.lon === location.lon)
      );
      
      if (exists) {
        throw new Error('Location already saved');
      }

      await saveUserLocation(currentUser.uid, location);
      setSavedLocations(prev => [...prev, { ...location, id: Date.now().toString() }]);
      
      toast({
        title: 'Location saved',
        description: 'Location has been added to your saved places',
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
      console.error('[LocationPicker] Error saving location:', error);
      toast({
        title: 'Error saving location',
        description: error instanceof Error ? error.message : 'Failed to save location',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setSavingLocationIds(prev => prev.filter(id => id !== location.id));
    }
  };

  const handleDeleteLocation = async (locationId: string) => {
    if (!currentUser) return;

    try {
      setDeletingLocationIds(prev => [...prev, locationId]);
      await deleteUserLocation(currentUser.uid, locationId);
      setSavedLocations(prev => prev.filter(loc => loc.id !== locationId));
      
      toast({
        title: 'Location deleted',
        description: 'Location has been removed from your saved places',
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
      console.error('[LocationPicker] Error deleting location:', error);
      toast({
        title: 'Error deleting location',
        description: 'Failed to delete location',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setDeletingLocationIds(prev => prev.filter(id => id !== locationId));
    }
  };

  const getLocationIcon = (type: Location['type']) => {
    switch (type) {
      case 'home':
        return <FaHome />;
      case 'work':
        return <FaBriefcase />;
      default:
        return <FaMapPin />;
    }
  };

  return (
    <Popover
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      placement="bottom-start"
    >
      <PopoverTrigger>
        <Button
          leftIcon={<FaMapMarkerAlt />}
          variant="ghost"
          onClick={() => setIsOpen(true)}
          size="sm"
        >
          {currentLocation ? currentLocation.name : 'Select Location'}
        </Button>
      </PopoverTrigger>
      <PopoverContent width="300px">
        <PopoverArrow />
        <PopoverCloseButton />
        <PopoverHeader fontWeight="semibold">Choose Location</PopoverHeader>
        <PopoverBody>
          <VStack spacing={4} align="stretch">
            <Button
              leftIcon={<FaMapMarkerAlt />}
              onClick={handleCurrentLocation}
              size="sm"
              colorScheme="blue"
            >
              Use Current Location
            </Button>

            <Box>
              <Input
                placeholder="Search location..."
                size="sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {isSearching && (
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Searching...
                </Text>
              )}
              {searchResults.length > 0 && (
                <List spacing={2} mt={2}>
                  {searchResults.map((location) => (
                    <ListItem key={location.id}>
                      <HStack>
                        <Button
                          size="sm"
                          variant="ghost"
                          justifyContent="flex-start"
                          width="full"
                          onClick={() => {
                            onLocationSelect(location);
                            setIsOpen(false);
                          }}
                          whiteSpace="normal"
                          wordBreak="break-word"
                          textAlign="left"
                        >
                          <Text fontSize="sm" noOfLines={2} textAlign="left">
                            {location.address}
                          </Text>
                        </Button>
                        <IconButton
                          icon={savingLocationIds.includes(location.id) ? <Spinner size="xs" /> : <FaPlus />}
                          aria-label="Save location"
                          size="xs"
                          onClick={() => handleSaveLocation(location)}
                          isDisabled={savingLocationIds.includes(location.id)}
                        />
                      </HStack>
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>

            {savedLocations.length > 0 && (
              <>
                <Divider />
                <Text fontSize="sm" fontWeight="medium" color="gray.600">
                  Saved Locations
                </Text>
                <VStack align="stretch" spacing={2}>
                  {savedLocations.map((location) => (
                    <HStack key={location.id} spacing={2}>
                      <Button
                        leftIcon={getLocationIcon(location.type)}
                        variant="ghost"
                        justifyContent="flex-start"
                        size="sm"
                        flex={1}
                        onClick={() => {
                          onLocationSelect(location);
                          setIsOpen(false);
                        }}
                        whiteSpace="normal"
                        wordBreak="break-word"
                      >
                        <VStack align="start" spacing={0}>
                          <Text noOfLines={1}>{location.name}</Text>
                          <Text fontSize="xs" color="gray.600" noOfLines={1}>
                            {location.address}
                          </Text>
                        </VStack>
                      </Button>
                      <IconButton
                        icon={deletingLocationIds.includes(location.id) ? <Spinner size="xs" /> : <FaTrash />}
                        aria-label="Delete location"
                        size="xs"
                        colorScheme="red"
                        variant="ghost"
                        onClick={() => handleDeleteLocation(location.id)}
                        isDisabled={deletingLocationIds.includes(location.id)}
                      />
                    </HStack>
                  ))}
                </VStack>
              </>
            )}
          </VStack>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}; 