import React, { useState, useEffect, useRef } from 'react'; // Import useRef
import { Card, CardContent } from './ui/card';
import { 
  Droplets, 
  Droplet,
  Clock, 
  AlertTriangle,
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Wind,
  CloudDrizzle,
  ChevronRight,
  ChevronLeft // Add ChevronLeft for left scroll indicator
} from 'lucide-react';
import { wateringRecommendationService } from '../lib/services/wateringRecommendationService';
import type { 
  WateringRecommendation
} from '../lib/services/wateringRecommendationService';

interface WateringRecommendationsProps {
  weatherData: any;
  className?: string;
}

export const WateringRecommendations: React.FC<WateringRecommendationsProps> = ({ 
  weatherData, 
  className = "" 
}) => {
  const [currentRecommendation, setCurrentRecommendation] = useState<WateringRecommendation | null>(null);
  const [selectedHour, setSelectedHour] = useState<{
    time: string, 
    hour: number,
    score: number, 
    temp: number, 
    rain: number,
    condition: string,
    isOptimal: boolean,
    reason: string
  } | null>(null);
  const [hourlyData, setHourlyData] = useState<{
    time: string, 
    hour: number,
    score: number, 
    temp: number, 
    rain: number,
    condition: string,
    isOptimal: boolean,
    reason: string
  }[]>([]);
  
  // Enhanced scroll indicator state
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({
    showLeftIndicator: false,
    showRightIndicator: false,
    isScrollable: false
  });

  const generateHourlyData = () => {
    if (!weatherData?.hourlyForecast || !Array.isArray(weatherData.hourlyForecast)) return;

    const now = new Date();
    const hourlyInfo = [];

    // Get next 12 hours of data (or as many as available)
    const maxHours = Math.min(12, weatherData.hourlyForecast.length);
    for (let i = 0; i < maxHours; i++) {
      const hour = new Date(now.getTime() + i * 60 * 60 * 1000);
      const hourData = weatherData.hourlyForecast[i];
      
      if (!hourData) continue;

      // Calculate watering score for this hour using simplified logic
      let score = 50; // Base score
      let reasons = [];
      
      // Temperature scoring
      if (hourData.temp >= 15 && hourData.temp <= 25) {
        score += 20;
      } else if (hourData.temp > 30) {
        score -= 25;
        reasons.push("too hot");
      } else if (hourData.temp < 10) {
        score -= 15;
        reasons.push("too cold");
      }

      // Time of day scoring
      const hourOfDay = hour.getHours();
      if ((hourOfDay >= 6 && hourOfDay <= 8) || (hourOfDay >= 18 && hourOfDay <= 20)) {
        score += 20; // Optimal times
        reasons.push("ideal time");
      } else if (hourOfDay >= 11 && hourOfDay <= 15) {
        score -= 30; // Avoid midday
        reasons.push("midday heat");
      } else if (hourOfDay >= 21 || hourOfDay <= 5) {
        score -= 30; // Avoid night
        reasons.push("nighttime");
      }

      // Rain penalty
      if (hourData.precipitation >= 3) {
        score -= 40;
        reasons.push("heavy rain");
      } else if (hourData.precipitation >= 1) {
        score -= 20;
        reasons.push("light rain");
      } else if (hourData.precipitation > 0) {
        score -= 10;
        reasons.push("drizzle");
      }

      // Humidity adjustment
      if (hourData.humidity >= 40 && hourData.humidity <= 70) {
        score += 10;
      } else if (hourData.humidity > 80) {
        score -= 10;
        reasons.push("high humidity");
      }

      // Wind adjustment
      if (hourData.windSpeed > 15) {
        score -= 15;
        reasons.push("windy");
      }

      const finalScore = Math.max(0, Math.min(100, score));
      const isOptimal = finalScore >= 70;

      hourlyInfo.push({
        time: hour.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }),
        hour: hourOfDay,
        score: finalScore,
        temp: hourData.temp,
        rain: hourData.precipitation || 0,
        condition: hourData.condition,
        isOptimal,
        reason: reasons.length > 0 ? reasons.join(', ') : 'good conditions'
      });
    }

    setHourlyData(hourlyInfo);
  };

  useEffect(() => {
    if (!weatherData) return;

    try {
      // Analyze current conditions
      const current = wateringRecommendationService.analyzeCurrentConditions(weatherData);
      setCurrentRecommendation(current);

      // Generate hourly data for timeline
      generateHourlyData();
    } catch (error) {
      console.error('Error processing weather data:', error);
    }
  }, [weatherData]);

  // Enhanced scroll indicator management
  useEffect(() => {
    const checkScrollState = () => {
      const container = scrollContainerRef.current;
      if (!container) return;
      
      const { scrollLeft, scrollWidth, clientWidth } = container;
      const isScrollable = scrollWidth > clientWidth;
      const showLeftIndicator = scrollLeft > 5; // Show left indicator when scrolled past 5px
      const showRightIndicator = isScrollable && (scrollLeft < scrollWidth - clientWidth - 5); // Hide right indicator when near end
      
      setScrollState({
        showLeftIndicator,
        showRightIndicator,
        isScrollable
      });
    };

    const container = scrollContainerRef.current;
    if (container) {
      // Check initial state
      checkScrollState();
      
      // Add scroll event listener
      container.addEventListener('scroll', checkScrollState);
      
      // Add resize listener
      window.addEventListener('resize', checkScrollState);
      
      return () => {
        container.removeEventListener('scroll', checkScrollState);
        window.removeEventListener('resize', checkScrollState);
      };
    }
  }, [hourlyData]);

  // Helper function to get weather icon
  const getWeatherIcon = (condition: string, size = "w-4 h-4") => {
    switch (condition.toLowerCase()) {
      case 'rain':
        return <CloudRain className={`${size} text-blue-500`} />;
      case 'drizzle':
        return <CloudDrizzle className={`${size} text-blue-400`} />;
      case 'snow':
        return <CloudSnow className={`${size} text-blue-300`} />;
      case 'thunderstorm':
        return <CloudLightning className={`${size} text-purple-500`} />;
      case 'clear':
      case 'sunny':
        return <Sun className={`${size} text-yellow-500`} />;
      default:
        return <Cloud className={`${size} text-muted-foreground`} />;
    }
  };

  // Get main message based on current conditions
  const getMainMessage = () => {
    if (!currentRecommendation) return { icon: '🕒', message: 'Analyzing conditions...' };

    const timeWindow = wateringRecommendationService.isCurrentTimeOptimal(weatherData);
    
    if (timeWindow.isOptimal) {
      return { icon: '✅', message: 'Now is a great time to water!' };
    }
    
    if (timeWindow.nextWindow) {
      return { 
        icon: '🕒', 
        message: `Best time to water is around ${timeWindow.nextWindow.startTime}.` 
      };
    }

    if (currentRecommendation.score < 30 && weatherData?.current?.condition === 'rain') {
      return { icon: '🌧️', message: 'No need to water today.' };
    }

    return { icon: '❌', message: 'Avoid watering for now.' };
  };

  if (!weatherData || !currentRecommendation) {
    return (
      <Card className={`bg-card shadow-md rounded-xl border border-border ${className}`}>
        <CardContent className="p-4">
          <div className="animate-pulse">
                    <div className="h-4 bg-muted rounded mb-2"></div>
        <div className="h-32 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const mainMessage = getMainMessage();

  return (
    <Card className={`bg-card shadow-md rounded-xl border border-border ${className}`}>
      <CardContent className="p-3 sm:p-4">
        {/* Best time to water message at the top */}
        <div className="mb-3 text-left">
          <span className="text-xs sm:text-sm text-card-foreground">{mainMessage.message}</span>
        </div>
        
        <div className="flex gap-3 sm:gap-4">
          {/* Left Section - Weather Conditions */}
          <div className="flex-shrink-0" style={{ flexBasis: '20%' }}>
            <div className="text-center">
              {/* Weather stats */}
              <div className="space-y-1 text-xs">
                {/* Temperature with weather icon */}
                <div className="flex items-center justify-between">
                  {getWeatherIcon(weatherData.current.condition, "w-3 h-3")}
                  <span className="font-medium text-card-foreground">{weatherData.current.temp}°C</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <Droplet className="w-3 h-3 text-blue-500" />
                  <span className="font-medium">{weatherData.current.humidity}%</span>
                </div>
                
                {weatherData.current.windSpeed && (
                  <div className="flex items-center justify-between">
                    <Wind 
                      className="w-3 h-3 text-muted-foreground" 
                      style={{ transform: `rotate(${weatherData.current.windDeg || 0}deg)` }}
                    />
                    <span className="font-medium">{Math.round(weatherData.current.windSpeed)} km/h</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Section - Watering Guide */}
          <div className="flex-1 border-l pl-3 overflow-hidden" style={{ flexBasis: '80%' }}>

            {/* Enhanced Hourly Timeline with Better Scroll Indicators */}
            <div className="relative w-full overflow-hidden">
              {/* Left scroll indicator with shadow */}
              {scrollState.showLeftIndicator && (
                <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background via-background/90 to-transparent pointer-events-none flex items-center justify-start pl-1 z-10">
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
              
              <div
                ref={scrollContainerRef}
                className="flex space-x-1 sm:space-x-2 overflow-x-auto scrollbar-hide"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {hourlyData.length > 0 ? hourlyData.map((hour, index) => (
                  <div
                    key={index}
                    onClick={() => setSelectedHour(hour)}
                    className={`flex-shrink-0 basis-[50px] sm:basis-[60px] px-1 py-1.5 rounded border h-12 flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-md transition-shadow ${
                      hour.isOptimal
                        ? 'bg-green-500/10 border-green-500/30 dark:bg-green-500/20 dark:border-green-500/40'
                        : hour.score >= 50
                        ? 'bg-yellow-500/10 border-yellow-500/30 dark:bg-yellow-500/20 dark:border-yellow-500/40'
                        : 'bg-red-500/10 border-red-500/30 dark:bg-red-500/20 dark:border-red-500/40'
                    }`}
                  >
                    {/* Time */}
                    <div className="text-xs font-medium text-foreground mb-0.5 whitespace-nowrap">
                      {hour.time}
                    </div>
                    
                    {/* Watering Indicator */}
                    <div className="flex justify-center">
                      {hour.isOptimal ? (
                        <Droplets className="w-3.5 h-3.5 text-green-600" />
                      ) : hour.score >= 50 ? (
                        <Clock className="w-3.5 h-3.5 text-yellow-600" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                      )}
                    </div>
                  </div>
                )) : (
                  <div className="text-xs text-muted-foreground p-2">No hourly data available</div>
                )}
              </div>
              
              {/* Right scroll indicator with shadow */}
              {scrollState.showRightIndicator && (
                <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background via-background/90 to-transparent pointer-events-none flex items-center justify-end pr-1 z-10">
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Hour Detail Modal */}
        {selectedHour && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-background rounded-xl p-6 m-4 max-w-sm w-full border border-border">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-foreground">
                  {selectedHour.time} Details
                </h3>
                <button
                  onClick={() => setSelectedHour(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-3">
                {/* Weather info */}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Weather</span>
                  <div className="flex items-center">
                    {getWeatherIcon(selectedHour.condition, "w-4 h-4")}
                    <span className="ml-1 capitalize">{selectedHour.condition}</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Temperature</span>
                  <span className="font-medium">{Math.round(selectedHour.temp)}°C</span>
                </div>
                
                {selectedHour.rain > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Precipitation</span>
                    <span className="font-medium">{selectedHour.rain}mm</span>
                  </div>
                )}
                
                {/* Watering score */}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Watering Score</span>
                  <div className="flex items-center">
                    <span className="font-medium mr-2">{selectedHour.score}/100</span>
                    {selectedHour.isOptimal ? (
                      <Droplets className="w-4 h-4 text-green-600" />
                    ) : selectedHour.score >= 50 ? (
                      <Clock className="w-4 h-4 text-yellow-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                </div>
                
                {/* Recommendation */}
                <div className="mt-4 p-3 rounded-lg bg-muted">
                  <p className="text-sm text-foreground">
                    <strong>
                      {selectedHour.isOptimal 
                        ? "✅ Great time to water!" 
                        : selectedHour.score >= 50 
                        ? "⚠️ Acceptable time to water" 
                        : "❌ Not recommended"}
                    </strong>
                  </p>
                  {selectedHour.reason && (
                    <p className="text-xs text-muted-foreground mt-1 capitalize">
                      {selectedHour.reason}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}; 