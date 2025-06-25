import React, { useState, useEffect } from 'react';
import { MapPin, ChevronDown, ArrowLeft, Search } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface LocationSelectorProps {
  currentLocation?: string;
  onLocationChange?: (location: string, coordinates?: { lat: number; lng: number }) => void;
  className?: string;
}

interface PlaceResult {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
    main_text_matched_substrings?: Array<{
      length: number;
      offset: number;
    }>;
  };
  terms: Array<{
    offset: number;
    value: string;
  }>;
  types: string[];
}

export const LocationSelector: React.FC<LocationSelectorProps> = ({
  currentLocation = 'Asian Games Village',
  onLocationChange,
  className = ''
}) => {
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);

  // Debounced search for Google Places API
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      await searchPlaces(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const searchPlaces = async (query: string) => {
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch(
        `/.netlify/functions/search-locations?query=${encodeURIComponent(query)}`,
        {
          method: 'GET',
        }
      );
      
      const data = await response.json();
      
      if (data.status === 'OK' && data.predictions) {
        setSearchResults(data.predictions);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching places:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLocationSelect = async (location: PlaceResult | 'current') => {
    if (location === 'current') {
      // Handle current location selection
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            
            // Get location name from coordinates using OpenWeatherMap reverse geocoding
            try {
              const weatherApiKey = import.meta.env.VITE_WEATHER_API_KEY;
              const response = await fetch(
                `https://api.openweathermap.org/geo/1.0/reverse?lat=${latitude}&lon=${longitude}&limit=1&appid=${weatherApiKey}`
              );
              const data = await response.json();
              
              const locationName = data && data.length > 0 
                ? (data[0].name || data[0].local_names?.en || 'Current Location')
                : 'Current Location';
              
              onLocationChange?.(locationName, { lat: latitude, lng: longitude });
            } catch (error) {
              console.error('Error reverse geocoding:', error);
              onLocationChange?.('Current Location', { lat: latitude, lng: longitude });
            }
          },
          (error) => {
            console.error('Error getting current location:', error);
            onLocationChange?.('Current Location');
          }
        );
      } else {
        onLocationChange?.('Current Location');
      }
    } else {
      // For now, just pass the city name. The weather service will handle geocoding
      onLocationChange?.(location.structured_formatting.main_text);
    }
    setShowLocationSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  if (showLocationSearch) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center px-4 py-4 border-b border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowLocationSearch(false)}
            className="mr-3 p-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Select a location</h1>
        </div>

        {/* Search Bar */}
        <div className="px-4 py-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search for a city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-3 text-base bg-background text-foreground"
              autoFocus
            />
          </div>
        </div>

        {/* Search Results */}
        <div className="flex-1 overflow-auto">
          <div className="py-2">
            {/* Always show Current Location option at the top */}
            <div
              onClick={() => handleLocationSelect('current')}
              className="flex items-center px-4 py-3 hover:bg-accent hover:text-accent-foreground cursor-pointer border-b border-border"
            >
              <MapPin className="w-5 h-5 text-blue-500 mr-3 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-medium text-foreground">Current Location</div>
                <div className="text-sm text-muted-foreground">Use your current location</div>
              </div>
            </div>

            {/* Loading indicator - only when searching */}
            {loading && searchQuery && (
              <div className="flex items-center justify-center py-6">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-green-600 border-t-transparent mr-2"></div>
                <span className="text-sm text-muted-foreground">Searching...</span>
              </div>
            )}

            {/* Search Results */}
            {!loading && searchResults.length > 0 && searchResults.map((place) => (
              <div
                key={place.place_id}
                onClick={() => handleLocationSelect(place)}
                className="flex items-center px-4 py-3 hover:bg-accent hover:text-accent-foreground cursor-pointer border-b border-border"
              >
                <MapPin className="w-5 h-5 text-muted-foreground mr-3 flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-medium text-foreground">{place.structured_formatting.main_text}</div>
                  <div className="text-sm text-muted-foreground">{place.structured_formatting.secondary_text}</div>
                </div>
              </div>
            ))}

            {/* No results message */}
            {!loading && searchQuery && searchResults.length === 0 && (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <p>No locations found for "{searchQuery}"</p>
              </div>
            )}

            {/* Initial state message */}
            {!searchQuery && (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <p>Start typing to search for locations</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`cursor-pointer ${className}`}
      onClick={() => setShowLocationSearch(true)}
    >
      <div className="flex items-center text-muted-foreground text-sm">
        <MapPin className="w-4 h-4 mr-1" />
        <span>Current location</span>
        <ChevronDown className="w-4 h-4 ml-1" />
      </div>
      <div className="text-foreground font-medium text-sm mt-0.5">
        {currentLocation}
      </div>
    </div>
  );
}; 