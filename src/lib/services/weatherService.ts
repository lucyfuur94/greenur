interface WeatherData {
  current: {
    temp: number;
    humidity: number;
    condition: string;
    description: string;
    windSpeed: number;
    windDeg?: number;
    pressure: number;
    location: string;
  };
  hourlyForecast: Array<{
    time: string;
    datetime: string;
    temp: number;
    humidity: number;
    condition: string;
    description: string;
    windSpeed: number;
    precipitation: number;
  }>;
  dailyForecast: Array<{
    date: string;
    min: number;
    max: number;
    condition: string;
    description: string;
    humidity: number;
  }>;
}



class WeatherService {
  private userLocation: { lat: number; lon: number } | null = null;

  // Get user's geolocation
  async getUserLocation(): Promise<{ lat: number; lon: number }> {
    if (this.userLocation) {
      return this.userLocation;
    }

    // Check if geolocation is supported
    if (!navigator.geolocation) {
      throw new Error('Geolocation is not supported by this browser');
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lon: position.coords.longitude
          };
          this.userLocation = location;
          resolve(location);
        },
        (error) => {
          console.error('Error getting location:', error);
          // Fallback to a default location (e.g., San Francisco)
          const fallbackLocation = { lat: 37.7749, lon: -122.4194 };
          this.userLocation = fallbackLocation;
          resolve(fallbackLocation);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes cache
        }
      );
    });
  }

  // Fetch weather data from API
  async getWeatherData(userToken: string): Promise<WeatherData> {
    try {
      const location = await this.getUserLocation();
      
      const response = await fetch(
        `/.netlify/functions/get-weather?lat=${location.lat}&lon=${location.lon}`,
        {
          headers: {
            'Authorization': `Bearer ${userToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching weather data:', error);
      throw error;
    }
  }

  // Fetch weather data by coordinates
  async getWeatherByCoordinates(userToken: string, lat: number, lng: number): Promise<WeatherData> {
    try {
      const response = await fetch(
        `/.netlify/functions/get-weather?lat=${lat}&lon=${lng}`,
        {
          headers: {
            'Authorization': `Bearer ${userToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching weather data by coordinates:', error);
      throw error;
    }
  }





  // Clear cached location (useful for testing or location changes)
  clearLocation(): void {
    this.userLocation = null;
  }
}

export const weatherService = new WeatherService();
export type { WeatherData }; 