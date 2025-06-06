import React, { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import ProfilePage from "./ProfilePage";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, 
  Plus, 
  ClipboardList, 
  BarChart3, 
  Camera, 
  Droplet, 
  Sun, 
  Thermometer, 
  Wind,
  Home,
  Bot
} from "lucide-react";
import FooterNavigation from '@/components/FooterNavigation';

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

interface CareTask {
  id: number | string;
  plant: string;
  plantId: string;
  task: string;
  completed: boolean;
  image: string;
  dueDate: string;
}

const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [showProfile, setShowProfile] = useState(false);
  const [plants, setPlants] = useState<TrackedPlant[]>([]);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<CareTask[]>([]);
  const [weatherData, setWeatherData] = useState({
    temperature: '--',
    humidity: '--',
    lightLevel: 'Good',
    wateringNeeded: 4
  });

  // Fetch user's tracked plants
  useEffect(() => {
    const fetchPlants = async () => {
      if (!currentUser) return;
      
      try {
        const response = await fetch(`/netlify/functions/tracked-plants`, {
          headers: {
            'Authorization': `Bearer ${await currentUser.getIdToken()}`
          }
        });
        
        // If we get a 404 response, it likely means no plants exist for this user yet
        // Which is a normal condition for new users, not an error
        if (response.status === 404) {
          console.log("No plants found for user - normal for new users");
          setPlants([]);
          setTasks([]);
          setLoading(false);
          return;
        }
        
        if (!response.ok) {
          console.warn('Plants service unavailable:', response.status);
          setPlants([]);
          setTasks([]);
          setLoading(false);
          return; // Silently fail without breaking the UI
        }
        
        const data = await response.json();
        
        // If we get an empty array, that's normal for new users
        if (Array.isArray(data) && data.length === 0) {
          console.log("User has no plants yet");
          setPlants([]);
          setTasks([]);
        } else {
          setPlants(data);
          // Generate care tasks based on plants
          const plantTasks = generateTasksFromPlants(data);
          setTasks(plantTasks);
        }
      } catch (error) {
        console.error('Error fetching plants:', error);
        // Only show error toast for actual API or network failures
        setPlants([]);
        setTasks([]);
      } finally {
        setLoading(false);
      }
    };
    
    // Fetch weather data
    const fetchWeather = async () => {
      if (!currentUser) return;
      
      try {
        const response = await fetch(`/netlify/functions/get-weather`, {
          headers: {
            'Authorization': `Bearer ${await currentUser.getIdToken()}`
          }
        });
        
        if (!response.ok) {
          console.warn('Weather service unavailable:', response.status);
          return; // Silently fail without breaking the UI
        }
        
        const data = await response.json();
        
        setWeatherData({
          temperature: data.temperature ? `${Math.round(data.temperature)}°F` : '--',
          humidity: data.humidity ? `${Math.round(data.humidity)}%` : '--',
          lightLevel: data.lightLevel || 'Good',
          wateringNeeded: data.plantsNeedingWater || 0
        });
      } catch (error) {
        console.error('Error fetching weather:', error);
        // Silent failure - don't break the UI for weather errors
      }
    };
    
    fetchPlants();
    fetchWeather();
  }, [currentUser, toast]);
  
  // Generate care tasks based on plants
  const generateTasksFromPlants = (plantData: TrackedPlant[]): CareTask[] => {
    // If we don't have plant data from the API, use the local plants state as fallback
    const plantsToUse = plantData.length > 0 ? plantData : plants;
    
    return plantsToUse.slice(0, 6).map((plant, index) => {
      // Basic logic to determine task type (can be more sophisticated with real data)
      const taskTypes = ['Water', 'Mist', 'Rotate', 'Fertilize', 'Prune'];
      const taskType = taskTypes[index % taskTypes.length];
      
      return {
        id: plant._id,
        plant: plant.nickname || plant.plantDetails.common_name,
        plantId: plant._id,
        task: taskType,
        completed: false,
        image: plant.currentImage,
        dueDate: new Date().toISOString().split('T')[0]
      };
    });
  };

  const handleTaskToggle = async (id: number | string) => {
    setTasks(
      tasks.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
    
    // Update task status in database
    const task = tasks.find(t => t.id === id);
    if (task && currentUser) {
      try {
        // Call to update-action-item function
        await fetch(`/netlify/functions/update-action-item`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: currentUser.uid,
            plantId: task.plantId,
            taskType: task.task.toLowerCase(),
            completed: !task.completed,
            date: new Date().toISOString()
          })
        });
      } catch (error) {
        console.error('Error updating task:', error);
      }
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  // Get user display name or email for greeting
  const getUserDisplayName = () => {
    if (!currentUser) return "";
    return currentUser.displayName || currentUser.email?.split('@')[0] || "User";
  };

  // Get user initials for avatar fallback
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
    { id: 1, name: "Add Plant", icon: <Plus className="w-6 h-6" /> },
    { id: 2, name: "Log Care", icon: <ClipboardList className="w-6 h-6" /> },
    { id: 3, name: "View Stats", icon: <BarChart3 className="w-6 h-6" /> },
    { id: 4, name: "Scan Plant", icon: <Camera className="w-6 h-6" /> },
  ];

  // Get current date in a readable format
  const getCurrentDate = () => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return new Date().toLocaleDateString('en-US', options);
  };

  // Update Plant Health Summary section to use real data
  const renderPlantHealthSummary = () => {
    return (
      <div className="px-4 py-3">
        <Card className="bg-white shadow-md rounded-xl overflow-hidden relative">
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-md font-medium">Plant Health Summary</h2>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs text-[#2E7D32] cursor-pointer !rounded-button bg-transparent hover:bg-[#E8F5E9]"
              >
                View All
              </Button>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#2E7D32] shadow-sm">
                  <Droplet className="w-5 h-5" />
                </div>
                <span className="text-xs mt-2 font-medium">Watering</span>
                <span className="text-sm font-bold">{weatherData.wateringNeeded}</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#2E7D32] shadow-sm">
                  <Sun className="w-5 h-5" />
                </div>
                <span className="text-xs mt-2 font-medium">Light</span>
                <span className="text-sm font-bold">{weatherData.lightLevel}</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#2E7D32] shadow-sm">
                  <Thermometer className="w-5 h-5" />
                </div>
                <span className="text-xs mt-2 font-medium">Temp</span>
                <span className="text-sm font-bold">{weatherData.temperature}</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#2E7D32] shadow-sm">
                  <Wind className="w-5 h-5" />
                </div>
                <span className="text-xs mt-2 font-medium">Humidity</span>
                <span className="text-sm font-bold">{weatherData.humidity}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  };

  return (
    <div className="relative flex flex-col h-screen w-full bg-[#FFFFFF] text-[#333333] overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 overflow-auto pb-16">
        {/* Top Bar - Now part of the scrollable content */}
        <div className="w-full bg-white shadow-sm">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <h1 className="text-lg font-semibold text-[#17A34A]">
                {getGreeting()}, {getUserDisplayName()}
              </h1>
              <p className="text-xs text-gray-500">{getCurrentDate()}</p>
            </div>
            <Avatar
              className="h-10 w-10 cursor-pointer ring-2 ring-[#17A34A]/10"
              id="avatar-button"
              onClick={() => onNavigate ? onNavigate("profile") : setShowProfile(true)}
            >
              <AvatarImage src={currentUser?.photoURL || ""} />
              <AvatarFallback className="bg-[#8BC34A] text-white">{getUserInitials()}</AvatarFallback>
            </Avatar>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-4 py-3">
          <div className="relative">
            <Input
              className="pl-10 pr-4 py-3 w-full bg-[#F5F7F5] border-none rounded-xl focus:outline-none focus:ring-2 focus:ring-[#17A34A] focus:border-transparent text-base shadow-sm"
              placeholder="Search plants..."
              style={{
                WebkitAppearance: "none",
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
              }}
            />
            <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
              <Search className="w-4 h-4" />
            </span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="px-4 py-2">
          <div className="grid grid-cols-4 gap-4">
            {quickActions.map((action) => (
              <div key={action.id} className="flex flex-col items-center cursor-pointer">
                <div className="w-14 h-14 rounded-xl bg-white shadow-lg flex items-center justify-center text-2xl hover:shadow-xl transition-shadow relative">
                  {action.icon}
                </div>
                <span className="text-xs mt-2 text-center font-medium">
                  {action.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Plant Health Summary */}
        {renderPlantHealthSummary()}

        {/* Daily Care Tasks */}
        <div className="px-4 py-3">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold">Today's Plant Care</h2>
            <Badge variant="outline" className="bg-[#E8F5E9] text-[#2E7D32] border-none px-3 py-1 text-sm font-medium">
              {tasks.filter(t => !t.completed).length} remaining
            </Badge>
          </div>
          {loading ? (
            <div className="flex flex-col justify-center items-center h-40 space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-600 border-t-transparent"></div>
              <p className="text-green-700 text-sm">Looking for your green friends...</p>
            </div>
          ) : (
            <ScrollArea className="h-[320px] pr-2">
              {tasks.length > 0 ? (
                tasks.map((task) => (
                  <Card
                    key={task.id}
                    className={`mb-3 p-3 flex items-center ${
                      task.completed ? "bg-gray-50" : "bg-white"
                    } shadow-md rounded-xl hover:shadow-lg transition-shadow`}
                  >
                    <div className="h-14 w-14 rounded-lg overflow-hidden mr-3 flex-shrink-0 shadow-sm">
                      <img
                        src={task.image}
                        alt={task.plant}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className={`font-semibold ${task.completed ? "text-gray-400" : "text-gray-800"}`}>
                        {task.plant}
                      </h3>
                      <div className="flex items-center">
                        <Badge variant="outline" className={`mr-2 ${task.completed ? "bg-gray-100 text-gray-400" : "bg-[#E8F5E9] text-[#2E7D32]"} border-none`}>
                          {task.task}
                        </Badge>
                        <span className="text-xs text-gray-500">Due today</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-center">
                      <Checkbox
                        id={`task-${task.id}`}
                        checked={task.completed}
                        onCheckedChange={() => handleTaskToggle(task.id)}
                        className="h-5 w-5 cursor-pointer"
                      />
                    </div>
                  </Card>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                  <p>No plants added yet.</p>
                  <Button 
                    onClick={() => onNavigate && onNavigate("add-plant")}
                    variant="outline" 
                    className="mt-2 bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#C8E6C9]"
                  >
                    Add Your First Plant
                  </Button>
                </div>
              )}
            </ScrollArea>
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <FooterNavigation 
        activeTab="home"
        onNavigate={(page) => {
          if (page === 'track') {
            onNavigate ? onNavigate("track") : null;
          } else if (page === 'ai') {
            // Navigate to AI chat when implemented
            onNavigate ? onNavigate("ai-chat") : null;
          }
          // No need to navigate for 'home' as we're already here
        }}
      />

      {/* Profile Page */}
      {showProfile && !onNavigate && <ProfilePage onBack={() => setShowProfile(false)} />}
    </div>
  );
};

export default HomePage; 