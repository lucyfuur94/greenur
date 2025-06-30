import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Sun, 
  Droplets, 
  Thermometer, 
  Mountain,
  ChevronRight,
  AlertTriangle,
  Sprout,
  Shield,
  X,
  Play,
  ChevronUp,
  ChevronDown,
  ChevronLeft,

  Camera
} from "lucide-react";

interface CareInstruction {
  compact: string;
  detailed?: string;
}

interface PlantBasicInfo {
  id: string;
  name: string;
  scientificName: string;
  type: string;
  image: string;
  care: {
    light_requirement: CareInstruction;
    water_requirement: CareInstruction;
    soil_type: CareInstruction;
    suitable_temperature: CareInstruction;
    fertilizer: CareInstruction;
    common_diseases: CareInstruction;
  };
}

interface GrowthStage {
  stageName: string;
  stageDescription: string;
  stageOrder: number;
  imageUrl: string;
  durationDays: { min: number; max: number };
  totalDaysFromStart: { start: number; end: number };
  care: string[];
  commonIssues: string[];
  indicators: string[];
}

interface VideoItem {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  channel: string;
  embedUrl: string;
  watchUrl: string;
  description?: string;
  viewCount?: string;
}

interface DetailPopup {
  isOpen: boolean;
  title: string;
  detail: string;
}

interface StagePopup {
  isOpen: boolean;
  currentStageIndex: number;
}

const PlantDetailsPage: React.FC = () => {
  const { plantId } = useParams<{ plantId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [plantData, setPlantData] = useState<PlantBasicInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [growthStages, setGrowthStages] = useState<GrowthStage[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<string>('delhi');
  const [detailPopup, setDetailPopup] = useState<DetailPopup>({
    isOpen: false,
    title: '',
    detail: ''
  });
  const [stagePopup, setStagePopup] = useState<StagePopup>({
    isOpen: false,
    currentStageIndex: 0
  });

  const videoContainerRef = useRef<HTMLDivElement>(null);
  const videoPlayerRef = useRef<HTMLDivElement>(null);
  const stageScrollRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  const touchEndY = useRef<number>(0);

  useEffect(() => {
    const fetchPlantData = async () => {
      if (!plantId) {
        navigate('/home');
        return;
      }

      try {
        // Always fetch fresh data from MongoDB to ensure we have complete care information
        const response = await fetch(`/.netlify/functions/get-plant-basics?id=${encodeURIComponent(plantId)}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch plant data');
        }
        
        const plant = await response.json();
        
        if (plant && plant._id) {
          // Use actual care data from database with new format
          const careData = plant.care || {};
          
          const formattedPlant: PlantBasicInfo = {
            id: plant._id.toString(),
            name: plant.common_name,
            scientificName: plant.scientific_name,
            type: plant.plant_type,
            image: plant.default_image_url || '/placeholder-plant.png',
            care: {
              light_requirement: careData.light_requirement || { compact: 'Full sun' },
              water_requirement: careData.water_requirement || { compact: 'Moderate' },
              soil_type: careData.soil_type || { compact: 'Well-draining' },
              suitable_temperature: careData.suitable_temperature || { compact: '18-27°C' },
              fertilizer: careData.fertilizer || { compact: 'Balanced' },
              common_diseases: careData.common_diseases || { compact: 'Blight' }
            }
          };
          setPlantData(formattedPlant);
        } else {
          throw new Error('Plant not found');
        }
      } catch (error) {
        console.error('Error fetching plant data:', error);
        toast({
          title: "Error",
          description: "Failed to load plant details. Please try again.",
          variant: "destructive",
        });
        navigate('/home');
      } finally {
        setLoading(false);
      }
    };

    fetchPlantData();
  }, [plantId, navigate, toast]);

  // Get user location from localStorage or default to delhi
  useEffect(() => {
    const storedLocation = localStorage.getItem('userLocation');
    if (storedLocation) {
      try {
        const locationData = JSON.parse(storedLocation);
        setUserLocation(locationData.city || 'delhi');
      } catch (error) {
        setUserLocation('delhi');
      }
    }
  }, []);

  // Fetch additional data for plant details
  useEffect(() => {
    if (plantData) {
      // Fetch real videos
      fetchVideos(plantData.name);

      // Fetch growth stage data from API
      fetchGrowthStageData(plantData.name.toLowerCase());
    }
  }, [plantData, userLocation]);

  const fetchVideos = async (plantName: string) => {
    setVideosLoading(true);
    try {
      const response = await fetch(`/.netlify/functions/get-videos?q=${encodeURIComponent(plantName + ' growing guide care')}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.videos) {
          // Sort by views/duration ratio (more views, less duration first)
          const sortedVideos = data.videos
            .filter((video: any) => {
              if (!video.duration) return true;
              const duration = video.duration;
              // Parse duration like "8:32" or "12:15"
              const parts = duration.split(':');
              if (parts.length === 2) {
                const minutes = parseInt(parts[0]);
                return minutes < 20; // Only videos under 20 minutes
              }
              return true;
            })
            .sort((a: any, b: any) => {
              // Calculate score: views / duration_in_seconds
              const getScore = (video: any) => {
                const views = parseInt(video.viewCount) || 0;
                if (!video.duration) return 0;
                
                const parts = video.duration.split(':');
                let durationInSeconds = 0;
                if (parts.length === 2) {
                  durationInSeconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
                } else if (parts.length === 3) {
                  durationInSeconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
                }
                
                return durationInSeconds > 0 ? views / durationInSeconds : views;
              };
              
              return getScore(b) - getScore(a); // Higher score first
            });
          setVideos(sortedVideos);
        }
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
      // Fallback to simulated data
      setVideos([
        {
          id: '1',
          title: `How to Grow ${plantName}`,
          thumbnail: '/placeholder-video.png',
          duration: '8:32',
          channel: 'Garden Guru',
          embedUrl: '',
          watchUrl: '',
          description: `Complete guide to growing ${plantName}`,
          viewCount: '50000'
        },
        {
          id: '2',
          title: `${plantName} Care Tips`,
          thumbnail: '/placeholder-video.png',
          duration: '6:15',
          channel: 'Plant Expert',
          embedUrl: '',
          watchUrl: '',
          description: 'Expert tips for healthy plants',
          viewCount: '35000'
        }
      ]);
    } finally {
      setVideosLoading(false);
    }
  };

  const fetchGrowthStageData = async (plantType: string) => {
    try {
      const response = await fetch(`/.netlify/functions/get-growth-stage-images?plantType=${encodeURIComponent(plantType)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.stages) {
          // Convert stages object to array and sort by stage order
          const stagesArray: GrowthStage[] = [];
          Object.entries(data.stages).forEach(([, stageImages]) => {
            const stageImagesArray = stageImages as any[];
            if (stageImagesArray.length > 0) {
              // Find the record with complete data (duration, care, etc.)
              const completeStageData = stageImagesArray.find(stage => 
                stage.durationDays && stage.totalDaysFromStart && stage.care
              ) || stageImagesArray[0];
              
              stagesArray.push({
                stageName: completeStageData.stageName || 'Unknown Stage',
                stageDescription: completeStageData.stageDescription || 'Growth stage description',
                stageOrder: completeStageData.stageOrder || 0,
                imageUrl: completeStageData.imageUrl || '/placeholder-plant.png',
                durationDays: completeStageData.durationDays || { min: 0, max: 0 },
                totalDaysFromStart: completeStageData.totalDaysFromStart || { start: 0, end: 0 },
                care: completeStageData.care || [],
                commonIssues: completeStageData.commonIssues || [],
                indicators: completeStageData.indicators || []
              });
            }
          });
          
          // Sort by stage order and filter valid stages
          stagesArray.sort((a, b) => a.stageOrder - b.stageOrder);
          const validStages = stagesArray.filter(stage => {
            return stage.totalDaysFromStart && stage.totalDaysFromStart.start > 0;
          });
          
          setGrowthStages(validStages);
        }
      }
    } catch (error) {
      console.error('Error fetching growth stage data:', error);
    }
  };

  const handleAddToMyPlants = () => {
    if (plantData) {
      navigate('/home', { 
        state: { 
          shouldAddPlant: true, 
          plantToAdd: plantData 
        } 
      });
    }
  };



  const handleAskArth = () => {
    navigate('/home', { 
      state: { 
        shouldOpenChat: true,
        initialMessage: plantData ? `Tell me more about growing ${plantData.name}` : undefined
      } 
    });
  };

  const handleCareClick = (title: string, careInstruction: CareInstruction) => {
    if (careInstruction.detailed) {
      setDetailPopup({
        isOpen: true,
        title,
        detail: careInstruction.detailed
      });
    }
  };

  const closeDetailPopup = () => {
    setDetailPopup({
      isOpen: false,
      title: '',
      detail: ''
    });
  };

  const handleVideoNavigation = (direction: 'up' | 'down') => {
    if (selectedVideoIndex === null || videos.length === 0) return;
    
    let newIndex;
    if (direction === 'up') {
      newIndex = selectedVideoIndex > 0 ? selectedVideoIndex - 1 : videos.length - 1;
    } else {
      newIndex = selectedVideoIndex < videos.length - 1 ? selectedVideoIndex + 1 : 0;
    }
    
    setSelectedVideoIndex(newIndex);
  };

  // Handle swipe gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.targetTouches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndY.current = e.targetTouches[0].clientY;
  };

  const handleTouchEnd = () => {
    if (!touchStartY.current || !touchEndY.current) return;
    
    const distance = touchStartY.current - touchEndY.current;
    const isSwipeUp = distance > 50;
    const isSwipeDown = distance < -50;

    if (isSwipeUp) {
      // Swipe up - move to next video
      handleVideoNavigation('down');
    } else if (isSwipeDown) {
      // Swipe down - move to previous video
      handleVideoNavigation('up');
    }

    // Reset touch positions
    touchStartY.current = 0;
    touchEndY.current = 0;
  };

  const renderCareInfo = (careInstruction: CareInstruction, title: string) => {
    const hasDetails = careInstruction.detailed;
    return (
      <span 
        className={`text-sm text-gray-700 ${hasDetails ? 'underline cursor-pointer hover:text-blue-600' : ''}`}
        onClick={() => hasDetails && handleCareClick(title, careInstruction)}
      >
        {careInstruction.compact}
      </span>
    );
  };

  const handleStageClick = (stageIndex: number) => {
    setStagePopup({
      isOpen: true,
      currentStageIndex: stageIndex
    });
  };

  const closeStagePopup = () => {
    setStagePopup({
      isOpen: false,
      currentStageIndex: 0
    });
  };

  const navigateStage = (direction: 'prev' | 'next') => {
    let newIndex;
    if (direction === 'prev') {
      newIndex = stagePopup.currentStageIndex > 0 ? stagePopup.currentStageIndex - 1 : growthStages.length - 1;
    } else {
      newIndex = stagePopup.currentStageIndex < growthStages.length - 1 ? stagePopup.currentStageIndex + 1 : 0;
    }
    
    setStagePopup(prev => ({
      ...prev,
      currentStageIndex: newIndex
    }));
  };

  const formatDayRange = (totalDays: { start: number; end: number } | undefined) => {
    if (!totalDays || typeof totalDays.start === 'undefined' || typeof totalDays.end === 'undefined') {
      return '(Duration TBD)';
    }
    if (totalDays.start === totalDays.end) {
      return `(${totalDays.start} days)`;
    }
    return `(${totalDays.start} - ${totalDays.end} days)`;
  };

  const capitalizeFirstLetter = (string: string) => {
    return string.charAt(0).toUpperCase() + string.slice(1).replace(/_/g, ' ');
  };

  const formatPlantType = (type: string) => {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const getPlantImageUrl = () => {
    // Prioritize Firebase growth stage images from the LAST stage instead of first
    if (growthStages.length > 0) {
      return growthStages[growthStages.length - 1].imageUrl;
    }
    
    // Fallback to default image URL
    if (plantData?.image && plantData.image !== '/placeholder-plant.png') {
      return plantData.image;
    }
    
    return null;
  };

  if (loading) {
    return (
      <div className="relative flex flex-col h-screen w-full bg-white overflow-hidden">
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#17A34A]"></div>
        </div>
      </div>
    );
  }

  if (!plantData) {
    return (
      <div className="relative flex flex-col h-screen w-full bg-white overflow-hidden">
        <div className="flex flex-col items-center justify-center h-full">
          <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
          <p className="text-gray-600">Plant not found</p>
          <Button 
            onClick={() => navigate('/home')} 
            className="mt-4"
            variant="outline"
          >
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-screen w-full bg-white text-gray-900 overflow-hidden">
      {/* Fixed Header */}
      <div className="fixed top-0 left-0 w-full bg-white z-10 border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/home')}
            className="p-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold text-gray-900">{plantData.name}</h1>
          <div className="w-9" /> {/* Spacer for centering */}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 pt-16 pb-20 overflow-auto">
        <div className="px-4 py-6 space-y-6">
          
          {/* Plant Info Card */}
          <div className="flex gap-4">
            {/* Plant Image */}
            <div className="w-24 h-24 rounded-lg border-2 border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
              {getPlantImageUrl() ? (
                <img 
                  src={getPlantImageUrl()!} 
                  alt={plantData.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    console.log('Image failed to load:', getPlantImageUrl());
                    // Show placeholder
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).parentElement!.innerHTML = 
                      '<div class="w-full h-full flex items-center justify-center bg-gray-100"><span class="text-gray-400 text-xs">No Image</span></div>';
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                  <span className="text-gray-400 text-xs">No Image</span>
                </div>
              )}
            </div>

            {/* Plant Details */}
            <div className="flex-1 space-y-2">
              <div>
                <p className="text-sm font-medium text-gray-600">{formatPlantType(plantData.type)} | {plantData.scientificName}</p>
              </div>
              
              {/* Care Requirements - New Compact/Detailed Format */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sun className="w-4 h-4 text-yellow-500" />
                  {renderCareInfo(plantData.care.light_requirement, 'Light Requirements')}
                  <Droplets className="w-4 h-4 text-blue-500 ml-2" />
                  {renderCareInfo(plantData.care.water_requirement, 'Watering Requirements')}
                </div>
                
                <div className="flex items-center gap-2">
                  <Mountain className="w-4 h-4 text-amber-600" />
                  {renderCareInfo(plantData.care.soil_type, 'Soil Requirements')}
                  <Thermometer className="w-4 h-4 text-red-500 ml-2" />
                  {renderCareInfo(plantData.care.suitable_temperature, 'Temperature Requirements')}
                </div>
                
                <div className="flex items-center gap-2">
                  <Sprout className="w-4 h-4 text-green-500" />
                  {renderCareInfo(plantData.care.fertilizer, 'Fertilizer Requirements')}
                  <Shield className="w-4 h-4 text-purple-500 ml-2" />
                  {renderCareInfo(plantData.care.common_diseases, 'Common Diseases')}
                </div>
              </div>
            </div>
          </div>

                    {/* Growth Stages Section */}
          {growthStages.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-800">Growth Stages</h2>
              
              {/* All stages in horizontal scroll */}
              <div className="relative">
                <div 
                  ref={stageScrollRef}
                  className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar"
                >
                   <style>{`
                      .hide-scrollbar::-webkit-scrollbar {
                        display: none;
                      }
                      .hide-scrollbar {
                        scrollbar-width: none;
                        -ms-overflow-style: none;
                      }
                    `}</style>
                   
                  {growthStages.map((stage, index) => (
                    <React.Fragment key={stage.stageName}>
                      <div 
                        className="flex-shrink-0 flex flex-col items-center cursor-pointer"
                        onClick={() => handleStageClick(index)}
                      >
                        <div className="w-20 h-20 rounded-lg border-2 border-gray-200 overflow-hidden bg-gray-50">
                          <img 
                            src={stage.imageUrl} 
                            alt={stage.stageName}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjZjBmMGYwIiBzdHJva2U9IiNjY2MiIHN0cm9rZS13aWR0aD0iMiIvPgo8dGV4dCB4PSI0MCIgeT0iMzUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzY2NiI+UGxhbnQ8L3RleHQ+Cjx0ZXh0IHg9IjQwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM4ODgiPlN0YWdlPC90ZXh0Pgo8L3N2Zz4K';
                            }}
                          />
                        </div>
                        <div className="mt-2 text-center w-20">
                          <p className="text-xs font-medium text-gray-700 leading-tight break-words">
                            {capitalizeFirstLetter(stage.stageName)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDayRange(stage.totalDaysFromStart)}
                          </p>
                        </div>
                      </div>
                      
                      {/* Arrow between stages */}
                      {index < growthStages.length - 1 && (
                        <div className="flex-shrink-0 flex items-center h-20 mt-0">
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
                
                {/* Scroll indicator */}
                {growthStages.length > 4 && (
                  <div className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-gradient-to-l from-white via-white to-transparent w-8 h-full flex items-center justify-end pr-2">
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Trending Videos Section */}
          <div>
            <div className="mb-4">
              <h2 className="text-base font-semibold text-gray-800">Trending Videos</h2>
            </div>
            
            {videosLoading ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="h-48 bg-gray-100 rounded-lg animate-pulse"></div>
                <div className="h-48 bg-gray-100 rounded-lg animate-pulse"></div>
              </div>
            ) : videos.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto pb-2" ref={videoContainerRef}>
                {videos.slice(0, 6).map((video, index) => (
                  <div 
                    key={video.id}
                    className="flex-shrink-0 w-48 cursor-pointer"
                    onClick={() => setSelectedVideoIndex(index)}
                  >
                    <div className="h-48 bg-gray-100 rounded-lg border-2 border-gray-200 overflow-hidden relative group">
                      {video.thumbnail ? (
                        <>
                          <img 
                            src={video.thumbnail} 
                            alt="Video thumbnail"
                            className="w-full h-full object-cover"
                          />
                          {/* Duration overlay */}
                          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                            {video.duration}
                          </div>
                          {/* View count overlay */}
                          <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                            {parseInt(video.viewCount || '0').toLocaleString()} views
                          </div>
                          {/* Play button overlay */}
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                              <Play className="w-6 h-6 text-white ml-1" />
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-6 h-6 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>
                    <div className="mt-2">
                      <h3 className="text-sm font-medium text-gray-800 line-clamp-2">{video.title}</h3>
                      <p className="text-xs text-gray-500 mt-1">{video.channel}</p>
                    </div>
                  </div>
                ))}
                {/* Show more indicator */}
                {videos.length > 6 && (
                  <div className="flex-shrink-0 w-48 flex items-center justify-center">
                    <ChevronRight className="w-6 h-6 text-gray-400" />
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">No videos available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fixed Bottom Action Buttons */}
      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-100 px-4 py-4">
        <div className="flex gap-4">
          <Button 
            onClick={handleAddToMyPlants}
            variant="outline"
            className="flex-1 border-gray-900 text-gray-900 hover:bg-gray-50 rounded-lg py-3 flex items-center justify-center gap-2"
          >
            <Camera className="w-5 h-5" />
            Add Plant
          </Button>
          <Button 
            onClick={handleAskArth}
            variant="outline"
            className="flex-1 border-gray-900 text-gray-900 hover:bg-gray-50 rounded-lg py-3 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C17.523 2 22 6.477 22 12C22 17.523 17.523 22 12 22C10.298 22 8.696 21.613 7.292 20.924L3 22L4.076 17.708C3.387 16.304 3 14.702 3 13C3 7.477 7.477 3 13 3H12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8 12H8.01M12 12H12.01M16 12H16.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Ask Arth
          </Button>
        </div>
      </div>

      {/* Detail Popup */}
      {detailPopup.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">{detailPopup.title}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={closeDetailPopup}
                  className="p-1"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-700 leading-relaxed">{detailPopup.detail}</p>
            </div>
          </div>
        </div>
      )}

      {/* Video Player Modal */}
      {selectedVideoIndex !== null && videos[selectedVideoIndex] && (
        <div 
          className="fixed inset-0 bg-black z-50 flex flex-col"
          ref={videoPlayerRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Close button - top right */}
          <div className="absolute top-4 right-4 z-10">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedVideoIndex(null)}
              className="text-white hover:bg-white/20 bg-black/50 rounded-full"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Video Player */}
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full h-full">
              <iframe
                src={videos[selectedVideoIndex].embedUrl}
                className="w-full h-full"
                frameBorder="0"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            </div>
          </div>

          {/* Navigation Controls - bottom */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
            <div className="flex items-center gap-4 px-4 py-2 bg-black/50 rounded-full">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleVideoNavigation('up')}
                className="text-white hover:bg-white/20"
                disabled={videos.length <= 1}
              >
                <ChevronUp className="w-5 h-5" />
              </Button>
              <span className="text-white text-sm">
                {selectedVideoIndex + 1} / {videos.length}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleVideoNavigation('down')}
                className="text-white hover:bg-white/20"
                disabled={videos.length <= 1}
              >
                <ChevronDown className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Stage Detail Popup */}
      {stagePopup.isOpen && growthStages[stagePopup.currentStageIndex] && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateStage('prev')}
                className="p-1"
                disabled={growthStages.length <= 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              
              <div className="text-center flex-1">
                <h3 className="font-semibold text-gray-800">
                  {capitalizeFirstLetter(growthStages[stagePopup.currentStageIndex].stageName)}
                </h3>
                <p className="text-xs text-gray-500">
                  Stage {stagePopup.currentStageIndex + 1} of {growthStages.length}
                </p>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateStage('next')}
                className="p-1"
                disabled={growthStages.length <= 1}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              
              <div className="w-2"></div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={closeStagePopup}
                className="p-1"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Large Image */}
            <div className="p-4">
              <div className="w-full h-48 rounded-lg overflow-hidden bg-gray-50 mb-4 relative">
                <img 
                  src={growthStages[stagePopup.currentStageIndex].imageUrl} 
                  alt={growthStages[stagePopup.currentStageIndex].stageName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjZjBmMGYwIiBzdHJva2U9IiNjY2MiIHN0cm9rZS13aWR0aD0iMiIvPgo8dGV4dCB4PSI0MCIgeT0iMzUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzY2NiI+UGxhbnQ8L3RleHQ+Cjx0ZXh0IHg9IjQwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM4ODgiPlN0YWdlPC90ZXh0Pgo8L3N2Zz4K';
                  }}
                />
                {/* Duration floating on bottom-right */}
                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                  {formatDayRange(growthStages[stagePopup.currentStageIndex].totalDaysFromStart).replace('(', '').replace(')', '')}
                </div>
              </div>

              {/* Description directly below image */}
              <p className="text-sm text-gray-600 mb-4">
                {growthStages[stagePopup.currentStageIndex].stageDescription}
              </p>

              {/* Stage Details */}
              <div className="space-y-4">
                {/* Care Instructions */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">Care Instructions</h4>
                  {growthStages[stagePopup.currentStageIndex].care.length > 0 ? (
                    <div className="space-y-2">
                      {growthStages[stagePopup.currentStageIndex].care.map((instruction, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <span className="text-gray-400 text-xs mt-0.5">•</span>
                          <span className="text-sm text-gray-700 flex-1">{instruction}</span>
                          {/* Icon at the end based on instruction content - fertilizer check first */}
                          {instruction.toLowerCase().includes('fertiliz') || instruction.toLowerCase().includes('feed') || instruction.toLowerCase().includes('nutrient') ? (
                            <Sprout className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                          ) : instruction.toLowerCase().includes('water') || instruction.toLowerCase().includes('moist') ? (
                            <Droplets className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                          ) : instruction.toLowerCase().includes('light') || instruction.toLowerCase().includes('sun') ? (
                            <Sun className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                          ) : instruction.toLowerCase().includes('temperature') || instruction.toLowerCase().includes('warm') || instruction.toLowerCase().includes('cool') ? (
                            <Thermometer className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                          ) : instruction.toLowerCase().includes('soil') || instruction.toLowerCase().includes('drainage') ? (
                            <Mountain className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                          ) : instruction.toLowerCase().includes('disease') || instruction.toLowerCase().includes('pest') || instruction.toLowerCase().includes('protect') ? (
                            <Shield className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">Care instructions will be available soon.</p>
                  )}
                </div>

                {/* Indicators */}
                {growthStages[stagePopup.currentStageIndex].indicators.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800 mb-2">What to Look For</h4>
                    <div className="space-y-1">
                      {growthStages[stagePopup.currentStageIndex].indicators.map((indicator, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <span className="text-blue-500 text-xs mt-0.5">•</span>
                          <span className="text-sm text-gray-700">{indicator}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Common Issues */}
                {growthStages[stagePopup.currentStageIndex].commonIssues.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="text-sm font-semibold text-gray-800">Common Issues</h4>
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                    </div>
                    <div className="space-y-1">
                      {growthStages[stagePopup.currentStageIndex].commonIssues.map((issue, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <span className="text-orange-500 text-xs mt-0.5">•</span>
                          <span className="text-sm text-gray-700">{issue}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlantDetailsPage; 