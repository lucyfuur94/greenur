import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useOnboarding } from '@/lib/OnboardingContext';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { UserPreferences, GrowingSpace, PlantItem } from '@/lib/types';
import { 
  Home, 
  Sun, 
  Leaf, 
  Search, 
  Camera, 
  Image as ImageIcon, 
  Info, 
  Check, 
  DropletIcon as Droplet, 
  Plus,
  X,
  ArrowLeft
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface OnboardingFlowProps {
  onComplete?: () => void;
}

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const { userPreferences, updateUserPreferences } = useOnboarding();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  // Extract step from URL path if available, otherwise default to 1
  const getStepFromPath = () => {
    const pathParts = location.pathname.split('/');
    const stepFromPath = parseInt(pathParts[pathParts.length - 1]);
    return !isNaN(stepFromPath) && stepFromPath >= 1 && stepFromPath <= 5 ? stepFromPath : 1;
  };

  // State with initialization from URL
  const [step, setStep] = useState(getStepFromPath);
  const [formData, setFormData] = useState<Partial<UserPreferences>>({
    name: '',
    experience: 'beginner',
    gardenType: 'indoor',
    growingSpaces: [],
    interests: [],
    checkupFrequency: '',
    checkupDays: [],
    firstPlant: {
      plantName: '',
      plantId: '',
      imageUrl: '',
      growingSpaceId: ''
    },
    completedOnboarding: false
  });
  const [isCompleting, setIsCompleting] = useState(false);
  const [initialSetupDone, setInitialSetupDone] = useState(false);

  // Remaining state variables
  const [newSpace, setNewSpace] = useState<Partial<GrowingSpace>>({
    type: '',
    name: ''
  });
  const [plantSearchResults, setPlantSearchResults] = useState<PlantItem[]>([]);
  const [showPlantSearchResults, setShowPlantSearchResults] = useState(false);
  const [plantSearchQuery, setPlantSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPlant, setSelectedPlant] = useState<PlantItem | null>(null);
  const [plantImagePreview, setPlantImagePreview] = useState<string | null>(null);
  const [isImageUploading, setIsImageUploading] = useState(false);

  // Initialize form data from existing preferences only once
  useEffect(() => {
    if (userPreferences && !initialSetupDone) {
      // If user already skipped onboarding, navigate to home
      if (userPreferences.skippedOnboarding === true) {
        console.log("User previously skipped onboarding, redirecting to home");
        navigate('/home');
        return;
      }

      // Handle the migration of data structure if needed
      const migratedPreferences: Partial<UserPreferences> = {
        ...userPreferences,
        growingSpaces: userPreferences.growingSpaces || [],
        completedOnboarding: false // We're in onboarding, so mark as incomplete until done
      };
      
      setFormData(migratedPreferences);
      
      // Resume from saved step if available
      if (userPreferences.onboardingStep && userPreferences.onboardingStep > 1 && userPreferences.onboardingStep <= 5) {
        const savedStep = userPreferences.onboardingStep;
        console.log("Resuming from saved step:", savedStep);
        setStep(savedStep);
        
        // Update URL to match the step (only if URL doesn't already match)
        if (getStepFromPath() !== savedStep) {
          navigate(`/onboarding/${savedStep}`, { replace: true });
        }
      }
      
      setInitialSetupDone(true);
    }
  }, [userPreferences, initialSetupDone, navigate]);

  // Keep URL in sync with step changes
  useEffect(() => {
    if (initialSetupDone) {
      navigate(`/onboarding/${step}`, { replace: true });
    }
  }, [step, navigate, initialSetupDone]);

  // Save progress function
  const saveProgress = async () => {
    if (!userPreferences || !currentUser) return false;
    
    try {
      // Save current form data and step
      console.log("Saving progress for step:", step);
      await updateUserPreferences({
        ...formData,
        onboardingStep: step,
        onboardingProgress: Math.min(Math.floor((step / 5) * 100), 100),
        lastUpdated: new Date().toISOString()
      });
      return true;
    } catch (error) {
      console.error('Error saving onboarding progress:', error);
      return false;
    }
  };

  const handleInputChange = (name: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleNestedInputChange = (parent: string, name: string, value: any) => {
    setFormData(prev => {
      const parentObj = prev[parent as keyof UserPreferences] || {};
      return {
        ...prev,
        [parent]: {
          ...(parentObj as object),
          [name]: value
        }
      };
    });
  };

  const handleInterestToggle = (value: string) => {
    const currentInterests = formData.interests || [];
    if (currentInterests.includes(value)) {
      handleInputChange('interests', currentInterests.filter(item => item !== value));
    } else {
      handleInputChange('interests', [...currentInterests, value]);
    }
  };

  const handleDayToggle = (value: string) => {
    const currentDays = formData.checkupDays || [];
    if (currentDays.includes(value)) {
      handleInputChange('checkupDays', currentDays.filter(day => day !== value));
    } else {
      handleInputChange('checkupDays', [...currentDays, value]);
    }
  };

  // Function to add a new growing space
  const addGrowingSpace = () => {
    if (newSpace.type) {
      const spaceId = uuidv4();
      const spaceName = newSpace.name || `${formatSpaceType(newSpace.type)} ${(formData.growingSpaces || []).filter(s => s.type === newSpace.type).length + 1}`;
      
      const newSpaceComplete: GrowingSpace = {
        id: spaceId,
        type: newSpace.type,
        name: spaceName
      };
      
      setFormData(prev => ({
        ...prev,
        growingSpaces: [...(prev.growingSpaces || []), newSpaceComplete]
      }));
      
      // Reset the new space form
      setNewSpace({
        type: '',
        name: ''
      });
    }
  };
  
  // Function to remove a growing space
  const removeGrowingSpace = (spaceId: string) => {
    setFormData(prev => ({
      ...prev,
      growingSpaces: (prev.growingSpaces || []).filter(space => space.id !== spaceId)
    }));
  };
  
  // Helper function to format space type for display
  const formatSpaceType = (type: string) => {
    switch (type) {
      case 'livingRoom': return 'Living Room';
      case 'bedroom': return 'Bedroom';
      case 'kitchen': return 'Kitchen';
      case 'bathroom': return 'Bathroom';
      case 'office': return 'Office';
      case 'balcony': return 'Balcony';
      case 'patio': return 'Patio';
      case 'garden': return 'Garden';
      default: return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  // Function to search plants
  const searchPlants = async (query: string) => {
    if (!query.trim()) {
      setPlantSearchResults([]);
      setShowPlantSearchResults(false);
      return;
    }
    
    setIsSearching(true);
    
    try {
      // Call to the search-plants function with the query parameter
      const response = await fetch(`/netlify/functions/search-plants?q=${encodeURIComponent(query)}`);
      
      if (!response.ok) {
        throw new Error('Failed to search plants');
      }
      
      const data = await response.json();
      
      // Map to our PlantItem interface
      const formattedResults: PlantItem[] = data.results || [];
      
      setPlantSearchResults(formattedResults);
      setShowPlantSearchResults(true);
    } catch (error) {
      console.error('Error searching plants:', error);
      setPlantSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };
  
  // Function to handle plant selection from search results
  const selectPlant = (plant: PlantItem) => {
    setSelectedPlant(plant);
    setShowPlantSearchResults(false);
    setPlantSearchQuery(plant.name);
    
    // Update the first plant details
    if (formData.growingSpaces && formData.growingSpaces.length > 0) {
      handleNestedInputChange('firstPlant', 'plantName', plant.name);
      handleNestedInputChange('firstPlant', 'plantId', plant.id);
      handleNestedInputChange('firstPlant', 'imageUrl', plant.image || '');
      handleNestedInputChange('firstPlant', 'growingSpaceId', formData.growingSpaces[0].id);
    }
  };
  
  // Function to handle plant image upload
  const handlePlantImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      setPlantImagePreview(previewUrl);
      
      // Analyze the plant image
      analyzePlantImage(file);
    }
  };
  
  // Function to analyze plant image
  const analyzePlantImage = async (file: File) => {
    setIsImageUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('image', file);
      
      // Call to analyze-plant function
      const response = await fetch('/netlify/functions/analyze-plant', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        console.error('Error status:', response.status);
        throw new Error('Failed to analyze plant image');
      }
      
      const data = await response.json();
      
      if (data.analysis) {
        // Handle the analysis result appropriately
        const analysis = data.analysis;
        const plantName = analysis.commonName || 'Unknown Plant';
        
        // Update UI with plant name from analysis
        if (plantName !== 'Unknown Plant') {
          setPlantSearchQuery(plantName);
          // Search for the plant to get additional details
          searchPlants(plantName);
        } else {
          // If plant not recognized, allow user to search manually
          setPlantSearchQuery('');
          setSelectedPlant(null);
        }
      }
    } catch (error) {
      console.error('Error analyzing plant image:', error);
      // Show error state in UI
      toast({
        title: "Analysis Failed",
        description: "We couldn't identify your plant. Please try again or search manually.",
        variant: "destructive",
      });
    } finally {
      setIsImageUploading(false);
    }
  };

  // Simple navigation functions
  const nextStep = async () => {
    if (step >= 5) return; // Don't go beyond step 5
    
    try {
      // Save progress before advancing
      console.log(`Moving from step ${step} to step ${step + 1}`);
      const saved = await saveProgress();
      
      if (!saved) {
        console.error("Failed to save progress");
        toast({
          title: "Error",
          description: "Had trouble saving your progress. Please try again.",
          variant: "destructive",
        });
        return;
      }
      
      // Update the step state (URL will be updated by the useEffect hook)
      setStep(step + 1);
      
    } catch (error) {
      console.error("Error in nextStep:", error);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
  };

  const prevStep = async () => {
    if (step <= 1) return; // Don't go below step 1
    
    try {
      console.log(`Moving from step ${step} to step ${step - 1}`);
      // Set the step first for immediate UI update (URL will be updated by the useEffect hook)
      setStep(step - 1);
      
      // Then save the progress with the new step
      await saveProgress();
      
    } catch (error) {
      console.error("Error in prevStep:", error);
      // Don't show toast for back button errors
    }
  };

  const completeOnboarding = async (skipped = false) => {
    try {
      setIsCompleting(true);
      
      // First save current progress
      await saveProgress();
      
      // Calculate onboarding progress based on current step
      const totalSteps = 5;
      const currentProgress = Math.min(Math.floor((step / totalSteps) * 100), 100);
      
      // Mark onboarding as complete with skip status and progress percentage
      await updateUserPreferences({
        ...formData,
        completedOnboarding: true,
        skippedOnboarding: skipped,
        onboardingProgress: currentProgress,
        onboardingStep: step // Store the current step for resuming later
      });
      
      // If user added a first plant and didn't skip, save it to the database
      if (!skipped && formData.firstPlant?.plantName && formData.firstPlant?.plantId) {
        try {
          const plantData = {
            userId: currentUser?.uid,
            nickname: formData.firstPlant.plantName,
            plantId: formData.firstPlant.plantId,
            currentImage: formData.firstPlant.imageUrl || '',
            plantDetails: {
              common_name: formData.firstPlant.plantName,
              scientific_name: selectedPlant?.scientificName || '',
              plant_type: selectedPlant?.type || 'Unknown'
            },
            growingSpaceId: formData.firstPlant.growingSpaceId || null
          };
          
          // Add the plant using the tracked-plants function
          const response = await fetch('/netlify/functions/tracked-plants', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(plantData)
          });
          
          if (!response.ok) {
            throw new Error(`Failed to add plant: ${response.statusText}`);
          }
        } catch (plantError) {
          console.error('Error adding plant:', plantError);
          // Continue with completion even if plant addition fails
        }
      }
      
      // Navigate to the home page
      navigate('/home', { replace: true });
      
      // Call onComplete if provided
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('Error completing onboarding:', error);
      setIsCompleting(false);
      
      toast({
        title: "Error",
        description: "Failed to complete setup. Please try again.",
        variant: "destructive",
      });
    }
  };

  const renderStep1 = () => {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-auto px-1">
          <div className="mb-6">
            <img 
              src="https://readdy.ai/api/search-image?query=Beautiful%20arrangement%20of%20indoor%20plants%20with%20lush%20green%20leaves%2C%20including%20monstera%2C%20fiddle%20leaf%20fig%2C%20and%20snake%20plants%2C%20arranged%20in%20stylish%20pots%2C%20soft%20natural%20lighting%2C%20clean%20white%20background%2C%20high%20quality%20professional%20photography%2C%20centered%20composition%2C%20detailed%20plant%20textures&width=375&height=200&seq=1&orientation=landscape" 
              alt="Welcome Plants" 
              className="w-full h-48 object-cover rounded-lg"
            />
          </div>
          
          <h1 className="text-2xl font-bold text-green-700 mb-4">Welcome to Botanica</h1>
          <p className="text-gray-600 mb-6">Let's set up your plant care assistant to help your green friends thrive. We'll need a few details to get started.</p>
          
          <div className="mb-6">
            <Label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">What should we call you?</Label>
            <Input 
              id="name" 
              type="text" 
              placeholder="Your name" 
              value={formData.name || ''} 
              onChange={(e) => handleInputChange('name', e.target.value)} 
              className="w-full px-3"
            />
          </div>
          
          <div className="mb-6">
            <Label className="block text-sm font-medium text-gray-700 mb-3">What's your gardening experience?</Label>
            <RadioGroup 
              value={formData.experience} 
              onValueChange={(value: 'beginner' | 'intermediate' | 'expert') => handleInputChange('experience', value)} 
              className="flex flex-col space-y-2"
            >
              <div className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:border-green-500 cursor-pointer">
                <RadioGroupItem value="beginner" id="beginner" className="text-green-600 bg-white" />
                <Label htmlFor="beginner" className="flex items-center cursor-pointer">
                  <Leaf className="w-4 h-4 mr-2 text-green-600" />
                  <span>Beginner - Just getting started</span>
                </Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:border-green-500 cursor-pointer">
                <RadioGroupItem value="intermediate" id="intermediate" className="text-green-600 bg-white" />
                <Label htmlFor="intermediate" className="flex items-center cursor-pointer">
                  <Leaf className="w-4 h-4 mr-2 text-green-600" />
                  <span>Intermediate - Some experience</span>
                </Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:border-green-500 cursor-pointer">
                <RadioGroupItem value="expert" id="expert" className="text-green-600 bg-white" />
                <Label htmlFor="expert" className="flex items-center cursor-pointer">
                  <Leaf className="w-4 h-4 mr-2 text-green-600" />
                  <span>Expert - Green thumb certified</span>
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>
        
        <Button 
          onClick={nextStep} 
          className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg !rounded-button mt-4"
          disabled={!formData.name || !formData.experience}
        >
          Next
        </Button>
      </div>
    );
  };

  const renderStep2 = () => {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-auto px-1">
          <h1 className="text-2xl font-bold text-green-700 mb-4">Growing Spaces</h1>
          <p className="text-gray-600 mb-6">Tell us about your growing environments so we can help you organize your plants.</p>
          
          <div className="mb-6">
            <Label className="block text-sm font-medium text-gray-700 mb-3">Where do you grow your plants?</Label>
            <div className="grid grid-cols-3 gap-3">
              <div 
                className={`flex flex-col items-center p-4 rounded-lg border cursor-pointer ${formData.gardenType === 'indoor' ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
                onClick={() => handleInputChange('gardenType', 'indoor')}
              >
                <Home className="w-6 h-6 text-green-600 mb-2" />
                <span className="text-sm font-medium">Indoor</span>
              </div>
              <div 
                className={`flex flex-col items-center p-4 rounded-lg border cursor-pointer ${formData.gardenType === 'outdoor' ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
                onClick={() => handleInputChange('gardenType', 'outdoor')}
              >
                <Sun className="w-6 h-6 text-green-600 mb-2" />
                <span className="text-sm font-medium">Outdoor</span>
              </div>
              <div 
                className={`flex flex-col items-center p-4 rounded-lg border cursor-pointer ${formData.gardenType === 'both' ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
                onClick={() => handleInputChange('gardenType', 'both')}
              >
                <Leaf className="w-6 h-6 text-green-600 mb-2" />
                <span className="text-sm font-medium">Both</span>
              </div>
            </div>
          </div>
          
          {/* Added spaces list */}
          {(formData.growingSpaces || []).length > 0 && (
            <div className="mb-6">
              <Label className="block text-sm font-medium text-gray-700 mb-3">Your Growing Spaces</Label>
              <div className="space-y-3">
                {(formData.growingSpaces || []).map((space) => (
                  <div key={space.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mr-3">
                        {space.type.includes('garden') || space.type.includes('patio') || space.type.includes('balcony') ? (
                          <Sun className="w-5 h-5 text-green-600" />
                        ) : (
                          <Home className="w-5 h-5 text-green-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{space.name}</p>
                        <p className="text-xs text-gray-500">{formatSpaceType(space.type)}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeGrowingSpace(space.id)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Add new space form */}
          <div className="p-4 border border-dashed border-gray-300 rounded-lg mb-4">
            <Label className="block text-sm font-medium text-gray-700 mb-3">Add a Growing Space</Label>
            
            <div className="mb-4">
              <Label htmlFor="spaceType" className="block text-sm font-medium text-gray-700 mb-1">Space Type <span className="text-red-500">*</span></Label>
              <Select 
                value={newSpace.type} 
                onValueChange={(value: string) => setNewSpace(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger id="spaceType" className="w-full px-3">
                  <SelectValue placeholder="Select space type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="livingRoom">Living Room</SelectItem>
                  <SelectItem value="bedroom">Bedroom</SelectItem>
                  <SelectItem value="kitchen">Kitchen</SelectItem>
                  <SelectItem value="bathroom">Bathroom</SelectItem>
                  <SelectItem value="office">Office</SelectItem>
                  <SelectItem value="balcony">Balcony</SelectItem>
                  <SelectItem value="patio">Patio</SelectItem>
                  <SelectItem value="garden">Garden</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="mb-4">
              <Label htmlFor="spaceName" className="block text-sm font-medium text-gray-700 mb-1">Name (Optional)</Label>
              <Input 
                id="spaceName" 
                type="text" 
                placeholder="e.g., South Balcony, Kitchen Window" 
                value={newSpace.name || ''} 
                onChange={(e) => setNewSpace(prev => ({ ...prev, name: e.target.value }))} 
                className="w-full px-3"
              />
              <p className="text-xs text-gray-500 mt-1">
                If left empty, we'll auto-name based on space type
              </p>
            </div>
            
            <Button
              onClick={addGrowingSpace}
              disabled={!newSpace.type}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Space
            </Button>
          </div>
        </div>
        
        <div className="flex space-x-3 mt-4">
          <Button 
            onClick={prevStep} 
            variant="outline"
            className="flex-1 py-3 !rounded-button"
          >
            Back
          </Button>
          <Button 
            onClick={nextStep} 
            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 !rounded-button"
            disabled={(formData.growingSpaces || []).length === 0}
          >
            Next
          </Button>
        </div>
      </div>
    );
  };

  const renderStep3 = () => {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-auto px-1">
          <h1 className="text-2xl font-bold text-green-700 mb-4">Plant Interests</h1>
          <p className="text-gray-600 mb-4">Select at least 3 categories that interest you. We'll customize your experience based on your selections.</p>
          
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[
              { id: 'vegetables', label: 'Vegetables', icon: <Leaf className="text-green-600" /> },
              { id: 'fruits', label: 'Fruits', icon: <Leaf className="text-green-600" /> },
              { id: 'herbs', label: 'Herbs', icon: <Leaf className="text-green-600" /> },
              { id: 'flowers', label: 'Flowers', icon: <Leaf className="text-green-600" /> },
              { id: 'indoorPlants', label: 'Indoor Plants', icon: <Home className="text-green-600" /> },
              { id: 'succulents', label: 'Succulents', icon: <Leaf className="text-green-600" /> },
              { id: 'organicGardening', label: 'Organic Gardening', icon: <Leaf className="text-green-600" /> },
              { id: 'hydroponics', label: 'Hydroponics', icon: <Droplet className="text-green-600" /> },
              { id: 'permaculture', label: 'Permaculture', icon: <Leaf className="text-green-600" /> },
              { id: 'composting', label: 'Composting', icon: <Leaf className="text-green-600" /> }
            ].map((interest) => (
              <div 
                key={interest.id}
                className={`flex flex-col items-center p-3 rounded-lg border cursor-pointer relative ${(formData.interests || []).includes(interest.id) ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
                onClick={() => handleInterestToggle(interest.id)}
              >
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-2">
                  {interest.icon}
                </div>
                <span className="text-sm font-medium text-center">{interest.label}</span>
                {(formData.interests || []).includes(interest.id) && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-green-600 rounded-full flex items-center justify-center">
                    <Check className="text-white w-3 h-3" />
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <p className="text-sm text-gray-500 italic">
            {(formData.interests || []).length < 3 
              ? `Please select ${3 - (formData.interests || []).length} more categories` 
              : `${(formData.interests || []).length} categories selected`}
          </p>
        </div>
        
        <div className="flex space-x-3 mt-4">
          <Button 
            onClick={prevStep} 
            variant="outline"
            className="flex-1 py-3 !rounded-button"
          >
            Back
          </Button>
          <Button 
            onClick={nextStep} 
            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 !rounded-button"
            disabled={(formData.interests || []).length < 3}
          >
            Next
          </Button>
        </div>
      </div>
    );
  };

  const renderStep4 = () => {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-auto px-1">
          <h1 className="text-2xl font-bold text-green-700 mb-4">Add Your First Plant</h1>
          <p className="text-gray-600 mb-6">Let's add your first plant to start tracking its care needs.</p>
          
          {/* Plant search section */}
          <div className="mb-6">
            <Label className="block text-sm font-medium text-gray-700 mb-1">Search for a plant from our catalog</Label>
            <div className="relative">
              <Input 
                type="text" 
                placeholder="Search by plant name" 
                value={plantSearchQuery} 
                onChange={(e) => {
                  setPlantSearchQuery(e.target.value);
                  searchPlants(e.target.value);
                }} 
                className="w-full pl-10 px-3"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              
              {/* Search results dropdown */}
              {showPlantSearchResults && plantSearchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                  {plantSearchResults.map((plant) => (
                    <div 
                      key={plant.id}
                      className="flex items-center p-2 hover:bg-gray-100 cursor-pointer"
                      onClick={() => selectPlant(plant)}
                    >
                      {plant.image ? (
                        <img src={plant.image} alt={plant.name} className="w-10 h-10 rounded-full object-cover mr-3" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mr-3">
                          <Leaf className="w-5 h-5 text-green-600" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{plant.name}</p>
                        {plant.scientificName && (
                          <p className="text-xs text-gray-500 italic">{plant.scientificName}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {isSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                </div>
              )}
            </div>
          </div>
          
          {/* Take photo / Upload photo section */}
          <div className="mb-6">
            <Label className="block text-sm font-medium text-gray-700 mb-3">Or add a photo of your plant</Label>
            <div className="flex space-x-3">
              <div className="flex-1 border border-dashed border-gray-300 rounded-lg p-3 flex flex-col items-center justify-center cursor-pointer hover:border-green-500">
                <label className="cursor-pointer w-full h-full flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mb-1">
                    <Camera className="text-green-600 w-4 h-4" />
                  </div>
                  <span className="text-xs text-gray-600">Take Photo</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment"
                    className="hidden" 
                    onChange={handlePlantImageChange}
                  />
                </label>
              </div>
              <div className="flex-1 border border-dashed border-gray-300 rounded-lg p-3 flex flex-col items-center justify-center cursor-pointer hover:border-green-500">
                <label className="cursor-pointer w-full h-full flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mb-1">
                    <ImageIcon className="text-green-600 w-4 h-4" />
                  </div>
                  <span className="text-xs text-gray-600">Upload Photo</span>
                  <input 
                    type="file" 
                    accept="image/*"
                    className="hidden" 
                    onChange={handlePlantImageChange}
                  />
                </label>
              </div>
            </div>
            
            {isImageUploading && (
              <div className="mt-3 flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600 mr-2"></div>
                <span className="text-sm text-gray-600">Analyzing plant image...</span>
              </div>
            )}
          </div>
          
          {/* Selected plant preview */}
          {selectedPlant && (
            <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-white">
              <div className="flex items-center">
                {selectedPlant.image || plantImagePreview ? (
                  <img 
                    src={plantImagePreview || selectedPlant.image} 
                    alt={selectedPlant.name} 
                    className="w-20 h-20 object-cover rounded-lg mr-4"
                  />
                ) : (
                  <div className="w-20 h-20 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                    <Leaf className="text-green-600 w-8 h-8" />
                  </div>
                )}
                <div>
                  <h3 className="font-medium">{selectedPlant.name}</h3>
                  {selectedPlant.scientificName && (
                    <p className="text-sm text-gray-500 italic">{selectedPlant.scientificName}</p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Growing space selection */}
          {selectedPlant && (
            <div className="mb-6">
              <Label htmlFor="growingSpace" className="block text-sm font-medium text-gray-700 mb-1">Where is this plant located?</Label>
              <Select 
                value={formData.firstPlant?.growingSpaceId || ''} 
                onValueChange={(value: string) => handleNestedInputChange('firstPlant', 'growingSpaceId', value)}
              >
                <SelectTrigger id="growingSpace" className="w-full px-3">
                  <SelectValue placeholder="Select growing space" />
                </SelectTrigger>
                <SelectContent>
                  {(formData.growingSpaces || []).map((space) => (
                    <SelectItem key={space.id} value={space.id}>
                      {space.name || formatSpaceType(space.type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        
        <div className="flex space-x-3 mt-4">
          <Button 
            onClick={prevStep} 
            variant="outline"
            className="flex-1 py-3 !rounded-button"
          >
            Back
          </Button>
          <Button 
            onClick={nextStep} 
            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 !rounded-button"
            disabled={!selectedPlant || !formData.firstPlant?.growingSpaceId}
          >
            Next
          </Button>
        </div>
      </div>
    );
  };

  const renderStep5 = () => {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-auto px-1">
          <h1 className="text-2xl font-bold text-green-700 mb-4">Care Preferences</h1>
          <p className="text-gray-600 mb-6">Let us know how you'd like to manage your plant care routine.</p>
          
          <div className="mb-6">
            <Label className="block text-sm font-medium text-gray-700 mb-3">How often would you like to check on your plants?</Label>
            <div className="grid grid-cols-4 gap-3">
              {['1', '2', '3', '4'].map((frequency) => (
                <div 
                  key={frequency}
                  className={`flex flex-col items-center p-3 rounded-lg border cursor-pointer ${formData.checkupFrequency === frequency ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
                  onClick={() => handleInputChange('checkupFrequency', frequency)}
                >
                  <span className="text-lg font-medium text-green-700">{frequency}</span>
                  <span className="text-xs text-gray-500">times/week</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="mb-6">
            <Label className="block text-sm font-medium text-gray-700 mb-3">Preferred days for plant care</Label>
            <div className="grid grid-cols-7 gap-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <div 
                  key={day}
                  className={`flex items-center justify-center p-2 rounded-full cursor-pointer ${(formData.checkupDays || []).includes(day) ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                  onClick={() => handleDayToggle(day)}
                >
                  <span className="text-xs font-medium">{day}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="p-4 border border-green-100 rounded-lg bg-green-50 mb-6">
            <div className="flex items-start">
              <Info className="text-green-600 mt-1 mr-3 w-5 h-5" />
              <div>
                <h3 className="font-medium text-green-800">Almost done!</h3>
                <p className="text-sm text-green-700">We'll use this information to create your personalized plant care schedule.</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex space-x-3 mt-4">
          <Button 
            onClick={prevStep} 
            variant="outline"
            className="flex-1 py-3 !rounded-button"
          >
            Back
          </Button>
          <Button 
            onClick={nextStep} 
            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 !rounded-button"
            disabled={!formData.checkupFrequency || (formData.checkupDays || []).length === 0}
          >
            Complete Setup
          </Button>
        </div>
      </div>
    );
  };

  const renderStep6 = () => {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mb-6">
          <Check className="text-green-600 w-10 h-10" />
        </div>
        <h1 className="text-2xl font-bold text-green-700 mb-3">Setup Complete!</h1>
        <p className="text-gray-600 mb-8">Your plant care assistant is ready to help your green friends thrive.</p>
        <Button 
          className="w-full bg-green-600 hover:bg-green-700 text-white py-3 !rounded-button"
          onClick={() => completeOnboarding(false)}
        >
          Get Started
        </Button>
      </div>
    );
  };

  const renderStep = () => {
    console.log("Rendering step:", step);
    
    // Safety check to ensure step is within valid range
    if (step < 1 || step > 6) {
      console.warn(`Invalid step number: ${step}, defaulting to step 1`);
      return renderStep1();
    }
    
    switch (step) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      case 6: return renderStep6();
      default: return renderStep1();
    }
  };

  // Render loading overlay when completing onboarding
  const renderLoadingOverlay = () => {
    if (!isCompleting) return null;
    
    return (
      <div className="fixed inset-0 bg-green-900/80 flex flex-col items-center justify-center z-50 text-white">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-white border-t-transparent mb-4"></div>
        <h3 className="text-xl font-semibold mb-2">Setting up your garden</h3>
        <p className="text-green-100">Preparing your plant care experience...</p>
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {renderLoadingOverlay()}
      {/* Fixed header */}
      <div className="fixed top-0 left-0 right-0 bg-white z-10 shadow-sm">
        <div className="flex items-center justify-center p-4 relative">
          {step < 6 && (
            <>
              {step > 1 && (
                <button 
                  onClick={prevStep} 
                  className="text-green-600 cursor-pointer absolute left-4"
                  disabled={isCompleting}
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <div className="text-sm text-gray-500">Step {step} of 5</div>
              <Button 
                variant="ghost"
                className="text-green-600 hover:text-green-700 absolute right-4"
                onClick={() => completeOnboarding(true)}
                disabled={isCompleting}
              >
                {isCompleting ? "Setting Up..." : "Complete Later"}
              </Button>
            </>
          )}
          {step === 6 && <div className="w-full"></div>}
        </div>
        {step < 6 && (
          <Progress value={(step / 5) * 100} className="h-1 bg-gray-200" />
        )}
      </div>

      {/* Main content with padding for fixed header and footer */}
      <div className="flex-1 pt-16 pb-4 px-4">
        {renderStep()}
      </div>
    </div>
  );
};

export default OnboardingFlow; 