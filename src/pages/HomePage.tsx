import React, { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import ProfilePage from "./ProfilePage";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { 
  Search,
  Plus,
  ClipboardList,
  BarChart3,
  Camera, 
  Leaf
} from "lucide-react";
import FooterNavigation from '@/components/FooterNavigation';
import SearchOverlay from '@/components/SearchOverlay';
import { WateringRecommendations } from '@/components/WateringRecommendations';
import { LocationSelector } from '@/components/LocationSelector';
import { weatherService, type WeatherData } from '@/lib/services/weatherService';

interface HomePageProps {
  onNavigate?: (page: string) => void;
}

interface TrackedPlant {
  _id: string;
  nickname: string;
  currentImage: string;
  plantDetails: {
    common_name: string;
    scientific_name: string;
    plant_type: string;
  };
  lastWatered?: string;
  healthStatus?: 'healthy' | 'needs_attention' | 'unhealthy';
}

interface PlantSearchResult {
  id: string;
  name: string;
  type: string;
  scientificName: string;
  image: string;
  displayName: string;
  matchedTerm: string;
}

const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [showProfile, setShowProfile] = useState(false);
  const [plants, setPlants] = useState<TrackedPlant[]>([]);
  const [loading, setLoading] = useState(true);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [currentLocation, setCurrentLocation] = useState('Asian Games Village');

  // Search related state
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);

  // Handle plant selection from search overlay
  const handlePlantSelect = (plant: PlantSearchResult) => {
    toast({
      title: "Plant Selected",
      description: `Selected ${plant.name}. Add this plant to your collection?`,
    });
    setShowSearchOverlay(false);
  };

  // Fetch weather data
  const fetchWeatherData = async (location?: string, coordinates?: { lat: number; lng: number }) => {
    if (!currentUser) return;
    
    try {
      const userToken = await currentUser.getIdToken();
      let weather;
      
      if (coordinates) {
        // Fetch weather by coordinates for current location
        weather = await weatherService.getWeatherByCoordinates(userToken, coordinates.lat, coordinates.lng);
      } else if (location && location !== 'Current Location') {
        // For city names, we'll use a simple geocoding approach
        try {
          // Try to geocode the city name using OpenWeatherMap's free geocoding service
          const weatherApiKey = import.meta.env.VITE_WEATHER_API_KEY;
          const geocodeResponse = await fetch(
            `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(location)}&limit=1&appid=${weatherApiKey}`
          );
          const geocodeData = await geocodeResponse.json();
          
          if (geocodeData && geocodeData.length > 0) {
            const { lat, lon } = geocodeData[0];
            weather = await weatherService.getWeatherByCoordinates(userToken, lat, lon);
          } else {
            // Fallback to default weather
            weather = await weatherService.getWeatherData(userToken);
          }
        } catch (geocodeError) {
          console.error('Geocoding failed, using default location:', geocodeError);
          weather = await weatherService.getWeatherData(userToken);
        }
      } else {
        // Default weather fetch
        weather = await weatherService.getWeatherData(userToken);
      }
      
      setWeatherData(weather);
    } catch (error) {
      console.error('Error fetching weather data:', error);
    }
  };

  // Handle location change
  const handleLocationChange = async (location: string, coordinates?: { lat: number; lng: number }) => {
    setCurrentLocation(location);
    await fetchWeatherData(location, coordinates);
  };

  // Initialize with current location on component mount
  useEffect(() => {
    if (!currentUser) return;

    // Get current location automatically when the page loads
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
            
            setCurrentLocation(locationName);
            await fetchWeatherData(locationName, { lat: latitude, lng: longitude });
          } catch (error) {
            console.error('Error reverse geocoding:', error);
            setCurrentLocation('Current Location');
            await fetchWeatherData('Current Location', { lat: latitude, lng: longitude });
          }
        },
        (error) => {
          console.error('Error getting current location:', error);
          // Fallback to default weather without location
          setCurrentLocation('Unknown Location');
          fetchWeatherData();
        }
      );
    } else {
      // Geolocation not supported
      setCurrentLocation('Unknown Location');
      fetchWeatherData();
    }
  }, [currentUser]);

  // Fetch user's tracked plants
  useEffect(() => {
    const fetchPlants = async () => {
      if (!currentUser) return;
      
      try {
        const response = await fetch(`/.netlify/functions/tracked-plants?userId=${currentUser.uid}`, {
          headers: {
            'Authorization': `Bearer ${await currentUser.getIdToken()}`
          }
        });
        
        if (response.status === 404) {
          console.log("No plants found for user - normal for new users");
          setPlants([]);
          setLoading(false);
          return;
        }
        
        if (!response.ok) {
          console.warn('Plants service unavailable:', response.status);
          setPlants([]);
          setLoading(false);
          return;
        }
        
        const data = await response.json();
        
        if (Array.isArray(data) && data.length === 0) {
          console.log("User has no plants yet");
          setPlants([]);
        } else {
          setPlants(data);
        }
      } catch (error) {
        console.error('Error fetching plants:', error);
        setPlants([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPlants();
  }, [currentUser, toast]);

  const getUserInitials = () => {
    if (!currentUser) return "U";
    if (currentUser.displayName) {
      const nameParts = currentUser.displayName.split(' ');
      if (nameParts.length >= 2) {
        return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
      }
      return currentUser.displayName[0].toUpperCase();
    }
    return currentUser.email ? currentUser.email[0].toUpperCase() : "U";
  };

  const quickActions = [
    { id: 1, name: "Add Plant", iconType: "plus", action: () => toast({ title: "Add Plant", description: "Adding Plant feature coming soon!" }) },
    { id: 2, name: "Log Care", iconType: "clipboard", action: () => toast({ title: "Log Care", description: "Care logging feature coming soon!" }) },
    { id: 3, name: "View Stats", iconType: "chart", action: () => onNavigate && onNavigate("track") },
    { id: 4, name: "Scan Plant", iconType: "camera", action: () => toast({ title: "Scan Plant", description: "AI plant scanning feature coming soon!" }) },
  ];

  const renderIcon = (iconType: string) => {
    switch (iconType) {
      case "plus":
        return <Plus className="w-6 h-6 text-primary" />;
      case "clipboard":
        return <ClipboardList className="w-6 h-6 text-primary" />;
      case "chart":
        return <BarChart3 className="w-6 h-6 text-primary" />;
      case "camera":
        return <Camera className="w-6 h-6 text-primary" />;
      default:
        return <Plus className="w-6 h-6 text-primary" />;
    }
  };

  // Render weather widget


  // Render quick actions
  const renderQuickActions = () => {
    return (
      <div className="px-4 py-2">
        <div className="grid grid-cols-4 gap-2">
          {quickActions.map((action) => (
            <div key={action.id} className="flex flex-col items-center cursor-pointer" onClick={action.action}>
              <div className="w-16 h-16 rounded-xl bg-card shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow">
                {renderIcon(action.iconType)}
              </div>
              <span className="text-xs mt-2 text-center font-medium text-card-foreground">
                {action.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render my plants section
  const renderMyPlants = () => {
    return (
      <div className="px-4 py-3">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-base font-semibold text-foreground">My Plants</h2>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs text-primary hover:bg-accent"
            onClick={() => toast({ title: "My Plants", description: "Plants section coming soon!" })}
          >
            View All
          </Button>
        </div>
        
        <ScrollArea className="w-full">
          <div className="flex space-x-4 pb-2">
            {plants.length > 0 ? (
              plants.slice(0, 6).map((plant) => (
                <div key={plant._id} className="flex flex-col items-center min-w-[80px]">
                  <div className="w-16 h-16 rounded-lg bg-muted border-2 border-border overflow-hidden">
                    {plant.currentImage ? (
                      <img 
                        src={plant.currentImage} 
                        alt={plant.nickname} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Leaf className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <span className="text-xs mt-1 text-center font-medium text-foreground truncate max-w-[80px]">
                    {plant.nickname || plant.plantDetails.common_name}
                  </span>
                </div>
              ))
            ) : (
              Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="flex flex-col items-center min-w-[80px]">
                  <div className="w-16 h-16 rounded-lg bg-muted border-2 border-border flex items-center justify-center">
                    <Plus className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <span className="text-xs mt-1 text-center text-muted-foreground">
                    Add Plant
                  </span>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    );
  };

  return (
    <div className="relative flex flex-col h-screen w-full bg-background text-foreground overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 overflow-auto pb-24">
        {/* Header with location and profile */}
        <div className="w-full bg-background">
          <div className="flex items-start justify-between px-4 py-4">
            <LocationSelector
              currentLocation={currentLocation}
              onLocationChange={handleLocationChange}
              className="flex-1"
            />
            <Avatar
              className="h-10 w-10 cursor-pointer ring-2 ring-border ml-3"
              onClick={() => onNavigate ? onNavigate("profile") : setShowProfile(true)}
            >
              <AvatarImage src={currentUser?.photoURL || ""} />
              <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>

        {/* Weather & Watering Guide Combined */}
        {weatherData && (
          <div className="px-4 py-3">
            <WateringRecommendations weatherData={weatherData} />
          </div>
        )}

        {/* Quick Actions */}
        {renderQuickActions()}

        {/* My Plants Overview */}
        {renderMyPlants()}

        {/* Pending To-do List */}
        <div className="px-4 py-3">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-base font-semibold text-foreground">Pending To-do</h2>
          </div>
          
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }, (_, i) => (
                <Card key={i} className="p-3">
                  <div className="animate-pulse">
                    <div className="h-4 bg-muted rounded mb-2"></div>
                    <div className="h-3 bg-muted rounded w-3/4"></div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>To-do coming soon wrt your plants! 🌱</p>
            </div>
          )}
        </div>
      </div>

      {/* Floating Search Bar */}
      <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-10">
        <Button
          onClick={() => setShowSearchOverlay(true)}
          className="bg-card border border-border text-muted-foreground hover:bg-accent rounded-full px-6 py-2 shadow-lg"
          variant="outline"
        >
          <Search className="w-4 h-4 mr-2" />
          search
        </Button>
      </div>

      {/* Bottom Navigation */}
      <FooterNavigation 
        activeTab="home"
        onNavigate={(page) => {
          if (page === 'track') {
            onNavigate ? onNavigate("track") : null;
          } else if (page === 'ai') {
            toast({ title: "Arth AI", description: "Coming soon!" });
          } else if (page === 'plants') {
            toast({ title: "Plants", description: "Coming soon!" });
          }
        }}
      />

      {/* Profile Page */}
      {showProfile && !onNavigate && <ProfilePage onBack={() => setShowProfile(false)} />}

      {/* Search Overlay */}
      {showSearchOverlay && (
        <SearchOverlay
          onClose={() => setShowSearchOverlay(false)}
          onSelectPlant={handlePlantSelect}
        />
      )}
    </div>
  );
};

export default HomePage; 