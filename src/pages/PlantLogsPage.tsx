import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useOnboarding } from '@/lib/OnboardingContext';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Camera,
  Activity,
  ChevronRight,
  Loader2,
  AlertTriangle,
  X,
  Clock,
  CheckCircle2,
  Droplets,
  Sprout,
  Shield,
  Home,
  History,
  Thermometer,
  MessageCircle,
  Edit,
  Trash2,
  Plus,
  Send
} from "lucide-react";
import { SheetBackdrop } from '../components/ui/sheet-backdrop';

interface TrackedPlant {
  _id: string;
  userId: string;
  nickname: string;
  plantId: string;
  currentImage: string;
  dateAdded: string;
  lastWatered?: string;
  notes?: string;
  healthStatus?: 'healthy' | 'needs_attention' | 'unhealthy';
  plantDetails: {
    common_name: string;
    scientificName: string;
    plant_type: string;
  };
  imageHistory: Array<{
    url: string;
    timestamp: string;
    analysis?: PlantImageAnalysis;
  }>;
  growingSpaceId?: string | null;
}

interface PlantImageAnalysis {
  id: string;
  timestamp: string;
  healthStatus?: {
    status: string;
    reason: string;
  };
  currentStage: {
    stageName: string;
    estimatedLifeDays: number;
    daysLeftInStage: number;
  };
  careInstructions: {
    light_requirement: string;
    water_requirement: string;
    soil_type: string;
    suitable_temperature: string;
    fertilizer: string;
    common_diseases: string;
  };
  nextCheckupDate: string;
  actionItems: string[];
}

interface ActionItemComment {
  id: string;
  text: string;
  timestamp: string;
}

interface ActionItem {
  id: string;
  task: string;
  priority: 'high' | 'medium' | 'low';
  category: 'watering' | 'fertilizing' | 'pruning' | 'monitoring' | 'pest_control' | 'general';
  dueDate: string;
  status: 'pending' | 'completed' | 'discarded';
  completedDate?: string;
  comment?: string;
  createdDate: string;
  comments?: ActionItemComment[];
}

interface AnalysisResult {
  healthStatus?: {
    status: string;
    reason: string;
  };
  currentStage: {
    stageName: string;
    stageDisplayName: string;
    estimatedLifeDays: number;
    currentStageStartDays: number;
    currentStageEndDays: number;
    daysIntoStage: number;
    stageDurationDays: number;
    stageProgressPercent: number;
    daysLeftInStage: number;
    nextStageName: string;
    nextStageDisplayName: string;
  };
  careInstructions: {
    light_requirement: string;
    water_requirement: string;
    soil_type: string;
    suitable_temperature: string;
    fertilizer: string;
    common_diseases: string;
  };
  nextCheckupDate: string;
  actionItems: ActionItem[];
}

// Helper function to format plant type to proper case
const formatPlantType = (type: string) => {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// Helper function to calculate completion percentage
const calculateStageCompletion = (estimatedLifeDays: number, daysLeftInStage: number) => {
  if (daysLeftInStage >= estimatedLifeDays) return 0;
  return Math.round(((estimatedLifeDays - daysLeftInStage) / estimatedLifeDays) * 100);
};

// Helper function to get plant health status
const getPlantHealthStatus = (analysisResult: AnalysisResult | null) => {
  if (!analysisResult?.healthStatus) {
    return { status: 'Unknown', color: 'text-gray-500' };
  }
  
  const status = analysisResult.healthStatus.status;
  
  switch (status.toLowerCase()) {
    case 'healthy':
      return { status: 'Healthy', color: 'text-green-600' };
    case 'good':
      return { status: 'Good', color: 'text-yellow-600' };
    case 'needs attention':
      return { status: 'Needs Attention', color: 'text-orange-600' };
    case 'unhealthy':
      return { status: 'Unhealthy', color: 'text-red-600' };
    default:
      return { status: status, color: 'text-gray-600' };
  }
};

const PlantLogsPage: React.FC = () => {
  const { plantId } = useParams<{ plantId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { userPreferences } = useOnboarding();
  const { toast } = useToast();

  const [plant, setPlant] = useState<TrackedPlant | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const [refreshingHistory, setRefreshingHistory] = useState(false);
  const [commentingItemId, setCommentingItemId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [showCommentsForItem, setShowCommentsForItem] = useState<string | null>(null);
  const [careInstructionsExpanded, setCareInstructionsExpanded] = useState(false);
  const [actionItemsExpanded, setActionItemsExpanded] = useState(false);
  

  // Plant care quotes for loading animation
  const plantCareQuotes = [
    "🌱 The best time to plant a tree was 20 years ago. The second best time is now.",
    "🌿 Plants are the lungs of our planet - treat them with love and care.",
    "🌸 Every flower is a soul blossoming in nature.",
    "🌳 In every walk with nature, one receives far more than they seek.",
    "🌺 A plant's growth mirrors our own - with patience and care, we flourish.",
    "🍃 The earth laughs in flowers - keep your plants happy and healthy.",
    "🌼 Gardens require patient labor and attention. But the rewards are worth it.",
    "🌲 A garden is a grand teacher. It teaches patience, careful watching, and growth.",
    "🌻 Plants are like people - they respond to care and attention.",
    "🌹 To plant a garden is to believe in tomorrow."
  ];

  // Rotate quotes every 3 seconds during analysis
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (analyzing) {
      interval = setInterval(() => {
        setCurrentQuoteIndex((prev) => (prev + 1) % plantCareQuotes.length);
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [analyzing, plantCareQuotes.length]);

  // Helper function to get space name from space ID
  const getSpaceName = (spaceId: string | null | undefined) => {
    if (!spaceId || spaceId === 'unassigned') return 'Unassigned';
    
    const space = userPreferences?.growingSpaces?.find(s => s.id === spaceId);
    return space?.name || space?.type || 'Unknown Space';
  };

  // Helper function to format stage names properly
  const formatStageName = (stageName: string) => {
    return stageName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Helper function to get next stage name
  const getNextStageName = (plantType: string, currentStage: string) => {
    const stageSequences: Record<string, string[]> = {
      'tomato': ['germination', 'seedling', 'vegetative_growth', 'flowering', 'fruiting', 'ripening'],
      'pepper': ['germination', 'seedling', 'vegetative_growth', 'flowering', 'fruiting', 'ripening'],
      'lettuce': ['germination', 'seedling', 'vegetative_growth', 'maturity'],
      'basil': ['germination', 'seedling', 'vegetative_growth', 'harvest'],
      'sunflower': ['germination', 'seedling', 'vegetative_growth', 'budding', 'flowering', 'seed_maturation'],
      'aloe': ['propagation', 'establishment', 'juvenile_growth', 'maturity'],
      'default': ['germination', 'seedling', 'vegetative_growth', 'flowering', 'maturity']
    };

    const stages = stageSequences[plantType.toLowerCase()] || stageSequences['default'];
    const currentIndex = stages.indexOf(currentStage);
    
    if (currentIndex >= 0 && currentIndex < stages.length - 1) {
      return formatStageName(stages[currentIndex + 1]);
    }
    
    return 'Final Stage';
  };

  // Fetch plant data function
  const fetchPlant = async (showLoadingState = true) => {
    if (!plantId || !currentUser) return;

    try {
      if (showLoadingState) {
        setLoading(true);
      }

      const token = await currentUser.getIdToken();
      const response = await fetch(`/.netlify/functions/tracked-plants?id=${plantId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Plant not found');
      }

      const plantData = await response.json();
      setPlant(plantData);

      // Check if there's existing analysis data in the latest image
      const latestImage = plantData.imageHistory?.[plantData.imageHistory.length - 1];
      if (latestImage?.analysis) {
        console.log('Found existing analysis data:', latestImage.analysis);
        
        // Set the analysis result from existing data
        setAnalysisResult(latestImage.analysis);
        
        // Set action items from the analysis data instead of making separate API call
        if (latestImage.analysis.actionItems) {
          const formattedActionItems = latestImage.analysis.actionItems.map((item: any, index: number) => ({
            id: item.id || `existing_${index}`,
            task: item.task,
            priority: item.priority,
            category: item.category,
            dueDate: item.dueDate,
            status: item.status || 'pending',
            createdDate: item.createdDate || latestImage.timestamp
          }));
          setActionItems(formattedActionItems);
        }
      } else {
        // Only load action items from database if no analysis data exists
        await loadActionItems(plantData._id);
      }
    } catch (error) {
      console.error('Error fetching plant:', error);
      toast({
        title: "Error",
        description: "Failed to load plant data",
        variant: "destructive"
      });
      navigate('/plants');
    } finally {
      if (showLoadingState) {
        setLoading(false);
      }
    }
  };

  // Fetch plant data on component mount
  useEffect(() => {
    fetchPlant();
  }, [plantId, currentUser, navigate, toast]);

  // Load action items for the plant
  const loadActionItems = async (plantId: string) => {
    if (!currentUser) return;

    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(`/.netlify/functions/update-action-item?plantId=${plantId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setActionItems(data.actionItems || []);
      }
    } catch (error) {
      console.error('Error loading action items:', error);
    }
  };

  // Update action item status
  const updateActionItem = async (actionItemId: string, status: 'completed' | 'discarded', comment?: string) => {
    if (!currentUser || !plant) return;

    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/.netlify/functions/update-action-item', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          plantId: plant._id,
          actionItemId,
          status,
          comment
        })
      });

      if (response.ok) {
        // Reload action items
        await loadActionItems(plant._id);
        toast({
          title: "Success",
          description: `Action item ${status}`
        });
      }
    } catch (error) {
      console.error('Error updating action item:', error);
      toast({
        title: "Error",
        description: "Failed to update action item",
        variant: "destructive"
      });
    }
  };

  // Add new action items from analysis
  const addActionItems = async (newItems: ActionItem[]) => {
    if (!currentUser || !plant) return;

    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/.netlify/functions/update-action-item', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          plantId: plant._id,
          actionItems: newItems
        })
      });

      if (response.ok) {
        // Reload action items
        await loadActionItems(plant._id);
      }
    } catch (error) {
      console.error('Error adding action items:', error);
    }
  };

  // Comment functionality
  const addComment = async (actionItemId: string, text: string) => {
    if (!currentUser || !plant || !text.trim()) return;

    try {
      const newComment: ActionItemComment = {
        id: Date.now().toString(),
        text: text.trim(),
        timestamp: new Date().toISOString()
      };

      // Update local state
      setActionItems(prev => prev.map(item => 
        item.id === actionItemId 
          ? { ...item, comments: [...(item.comments || []), newComment] }
          : item
      ));

      // Reset comment form
      setCommentingItemId(null);
      setCommentText('');

      toast({
        title: "Comment Added",
        description: "Your comment has been added successfully"
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: "Error",
        description: "Failed to add comment",
        variant: "destructive"
      });
    }
  };

  const editComment = async (actionItemId: string, commentId: string, newText: string) => {
    if (!currentUser || !plant || !newText.trim()) return;

    try {
      // Update local state
      setActionItems(prev => prev.map(item => 
        item.id === actionItemId 
          ? { 
              ...item, 
              comments: item.comments?.map(comment => 
                comment.id === commentId 
                  ? { ...comment, text: newText.trim() }
                  : comment
              ) || []
            }
          : item
      ));

      // Reset editing state
      setEditingCommentId(null);
      setCommentText('');

      toast({
        title: "Comment Updated",
        description: "Your comment has been updated successfully"
      });
    } catch (error) {
      console.error('Error editing comment:', error);
      toast({
        title: "Error",
        description: "Failed to update comment",
        variant: "destructive"
      });
    }
  };

  const deleteComment = async (actionItemId: string, commentId: string) => {
    if (!currentUser || !plant) return;

    try {
      // Update local state
      setActionItems(prev => prev.map(item => 
        item.id === actionItemId 
          ? { 
              ...item, 
              comments: item.comments?.filter(comment => comment.id !== commentId) || []
            }
          : item
      ));

      toast({
        title: "Comment Deleted",
        description: "Comment has been deleted successfully"
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({
        title: "Error",
        description: "Failed to delete comment",
        variant: "destructive"
      });
    }
  };

  const handleBack = () => {
    navigate('/plants');
  };

  const handleDetails = () => {
    if (plant && plant.plantId) {
      // Use the plant's plantId, which should be the catalog ID
      navigate(`/plant/${plant.plantId}`);
    }
  };

  const handleShowHistory = async () => {
    try {
      setRefreshingHistory(true);
      // Refresh plant data to get the latest history
      await fetchPlant(false); // Don't show main loading state
      setShowHistory(true);
    } catch (error) {
      console.error('Error refreshing plant data:', error);
      toast({
        title: "Error",
        description: "Failed to refresh plant data",
        variant: "destructive"
      });
    } finally {
      setRefreshingHistory(false);
    }
  };

  const getLatestImage = () => {
    if (!plant?.imageHistory || plant.imageHistory.length === 0) {
      // Return currentImage as an object structure if no imageHistory
      return plant?.currentImage ? {
        url: plant.currentImage,
        timestamp: plant.dateAdded || new Date().toISOString(),
        analysis: undefined
      } : null;
    }
    return plant.imageHistory[plant.imageHistory.length - 1];
  };

  const isLatestImageAnalyzed = () => {
    const latestImage = getLatestImage();
    return latestImage && latestImage.analysis;
  };

  const handleScanPlant = () => {
    if (!isLatestImageAnalyzed()) {
      toast({
        title: "Cannot Scan",
        description: "Please analyze the current image before uploading a new one",
        variant: "destructive"
      });
      return;
    }

    // Create file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.heic,.heif';
    input.capture = 'environment';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        await uploadNewImage(file);
      }
    };
    
    input.click();
  };

  const uploadNewImage = async (file: File) => {
    if (!currentUser || !plant) return;

    try {
      setUploadingImage(true);

      // Upload image
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('userId', currentUser.uid);

      const uploadResponse = await fetch('/.netlify/functions/upload-image', {
        method: 'POST',
        body: uploadFormData
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image');
      }

      const uploadResult = await uploadResponse.json();

      // Add to plant's image history
      const token = await currentUser.getIdToken();
      const updateResponse = await fetch('/.netlify/functions/update-plant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          plantId: plant._id,
          imageUrl: uploadResult.secure_url,
          action: 'add_image'
        })
      });

      if (!updateResponse.ok) {
        throw new Error('Failed to update plant');
      }

      // Refresh plant data
      window.location.reload();

      toast({
        title: "Image Uploaded",
        description: "New image added to plant history"
      });

    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAnalyzePlant = async () => {
    if (!plant || !currentUser) return;

    const latestImage = getLatestImage();
    if (!latestImage) {
      toast({
        title: "No Image",
        description: "Please upload an image first",
        variant: "destructive"
      });
      return;
    }

    try {
      setAnalyzing(true);

      // Call analysis function
      const token = await currentUser.getIdToken();
      const analysisResponse = await fetch('/.netlify/functions/analyze-plant-detailed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          imageUrl: latestImage.url,
          plantType: plant.plantDetails.plant_type,
          scientificName: plant.plantDetails.scientificName,
          commonName: plant.plantDetails.common_name
        })
      });

      if (!analysisResponse.ok) {
        throw new Error('Analysis failed');
      }

      const analysis = await analysisResponse.json();
      
      // Ensure proper formatting of stage names if not provided by LLM
      if (!analysis.currentStage.stageDisplayName) {
        analysis.currentStage.stageDisplayName = formatStageName(analysis.currentStage.stageName);
      }
      if (!analysis.currentStage.nextStageDisplayName) {
        analysis.currentStage.nextStageDisplayName = getNextStageName(plant.plantDetails.plant_type, analysis.currentStage.stageName);
      }

      setAnalysisResult(analysis);

      // Add new action items to the persistent list
      await addActionItems(analysis.actionItems);

      // Store analysis result
      const storeResponse = await fetch('/.netlify/functions/store-plant-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          plantId: plant._id,
          imageUrl: latestImage.url,
          analysisResult: analysis
        })
      });

      if (!storeResponse.ok) {
        console.warn('Failed to store analysis, but continuing...');
      }

      toast({
        title: "Analysis Complete",
        description: "Plant analysis has been completed successfully"
      });

    } catch (error) {
      console.error('Error analyzing plant:', error);
      toast({
        title: "Analysis Failed",
        description: "Failed to analyze plant. Please try again.",
        variant: "destructive"
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  };

  const formatDateTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return dateString;
    }
  };

  const getRelativeTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInMs = now.getTime() - date.getTime();
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

      if (diffInMinutes < 60) {
        return diffInMinutes <= 1 ? '1 min ago' : `${diffInMinutes} mins ago`;
      } else if (diffInHours < 24) {
        return diffInHours === 1 ? '1 hour ago' : `${diffInHours} hours ago`;
      } else {
        return diffInDays === 1 ? '1 day ago' : `${diffInDays} days ago`;
      }
    } catch (error) {
      return 'Recently';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'watering': return <Droplets className="w-4 h-4 text-blue-500" />;
      case 'fertilizing': return <Sprout className="w-4 h-4 text-green-500" />;
      case 'pruning': return <Activity className="w-4 h-4 text-purple-500" />;
      case 'monitoring': return <Activity className="w-4 h-4 text-yellow-500" />;
      case 'pest_control': return <Shield className="w-4 h-4 text-red-500" />;
      default: return <CheckCircle2 className="w-4 h-4 text-gray-500" />;
    }
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date();
  };

  // Remove history log
  const removeHistoryLog = async (timestamp: string, imageUrl: string) => {
    if (!currentUser || !plant) return;

    try {
      // Find the log being removed to check if it has analysis data
      const removedLog = plant.imageHistory?.find(item => 
        item.timestamp === timestamp && item.url === imageUrl
      );
      
      const token = await currentUser.getIdToken();
      
      // If the removed log has analysis data, clean up its action items from database first
      if (removedLog?.analysis?.actionItems) {
        console.log('Cleaning up action items from deleted analysis...');
        
        // Get current action items from database to see which ones need to be removed
        const actionItemsResponse = await fetch(`/.netlify/functions/update-action-item?plantId=${plant._id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (actionItemsResponse.ok) {
          const data = await actionItemsResponse.json();
          const currentActionItems = data.actionItems || [];
          
          // Find action items that match the removed analysis timestamp (approximately)
          const analysisDate = new Date(removedLog.timestamp);
          const actionItemsToRemove = currentActionItems.filter((item: ActionItem) => {
            const itemDate = new Date(item.createdDate);
            // Remove action items created within 1 minute of the analysis timestamp
            const timeDiff = Math.abs(itemDate.getTime() - analysisDate.getTime());
            return timeDiff < 60000; // 1 minute tolerance
          });
          
          // Remove each matching action item
          for (const actionItem of actionItemsToRemove) {
            await fetch('/.netlify/functions/update-action-item', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                plantId: plant._id,
                actionItemId: actionItem.id,
                status: 'discarded',
                comment: 'Auto-removed due to history log deletion'
              })
            });
          }
        }
      }

      // Remove the history log
      const response = await fetch('/.netlify/functions/update-plant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          plantId: plant._id,
          imageUrl: imageUrl,
          timestamp: timestamp,
          action: 'remove_image'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to remove history log');
      }

      // Refresh plant data
      const updatedPlantResponse = await fetch(`/.netlify/functions/tracked-plants?id=${plant._id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (updatedPlantResponse.ok) {
        const updatedPlant = await updatedPlantResponse.json();
        setPlant(updatedPlant);
        
        // Check if we removed the analysis that was currently being displayed
        if (removedLog?.analysis && analysisResult) {
          // Check if this was the latest analysis using the UPDATED plant data
          const newLatestImage = updatedPlant.imageHistory?.[updatedPlant.imageHistory.length - 1];
          
          if (removedLog.timestamp === plant.imageHistory?.[plant.imageHistory.length - 1]?.timestamp) {
            // We removed the latest analysis, need to update UI
            if (newLatestImage?.analysis) {
              // There's still analysis data in the new latest image
              setAnalysisResult(newLatestImage.analysis);
              if (newLatestImage.analysis.actionItems) {
                const formattedActionItems = newLatestImage.analysis.actionItems.map((item: any, index: number) => ({
                  id: item.id || `existing_${index}`,
                  task: item.task,
                  priority: item.priority,
                  category: item.category,
                  dueDate: item.dueDate,
                  status: item.status || 'pending',
                  createdDate: item.createdDate || newLatestImage.timestamp
                }));
                setActionItems(formattedActionItems);
              } else {
                setActionItems([]);
              }
            } else {
              // No analysis data in new latest image, clear everything and load from database
              setAnalysisResult(null);
              await loadActionItems(updatedPlant._id);
            }
          }
        }
      }

      toast({
        title: "Log Removed",
        description: "Plant history log and associated analysis have been removed successfully"
      });

    } catch (error) {
      console.error('Error removing history log:', error);
      toast({
        title: "Error",
        description: "Failed to remove history log. Please try again.",
        variant: "destructive"
      });
    }
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

  if (!plant) {
    return (
      <div className="relative flex flex-col h-screen w-full bg-white overflow-hidden">
        <div className="flex flex-col items-center justify-center h-full">
          <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
          <p className="text-gray-600">Plant not found</p>
          <Button 
            onClick={handleBack} 
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
        <div className="flex items-center px-4 py-3 relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="p-2 absolute left-4"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold text-gray-900 w-full text-center px-16">
            {plant.nickname || plant.plantDetails.common_name}
          </h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDetails}
            className="p-2 border border-gray-300 absolute right-4"
          >
            Details
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 pt-16 pb-20 overflow-auto">
        <div className="px-4 py-4 space-y-4">
          
          {/* Plant Info Card */}
          <div className="space-y-3">
            <div className="flex gap-4">
              {/* Plant Image */}
              <div className="w-32 h-32 rounded-lg border-2 border-gray-200 overflow-hidden bg-gray-50 flex-shrink-0">
                {plant.currentImage ? (
                  <img 
                    src={plant.currentImage} 
                    alt={plant.nickname || plant.plantDetails.common_name}
                    className="w-full h-full object-cover object-center"
                    onError={(e) => {
                      console.log('Image failed to load:', plant.currentImage);
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
                  {/* Space Display with Home Icon */}
                  <div className="flex items-center gap-2 mb-2">
                    {plant.growingSpaceId && plant.growingSpaceId !== 'unassigned' && (
                      <Home className="w-4 h-4 text-gray-500" />
                    )}
                    <p className="text-sm text-gray-600">
                      {getSpaceName(plant.growingSpaceId)}
                    </p>
                  </div>
                  
                  {/* Plant Type and Scientific Name */}
                  <p className="text-sm font-medium text-gray-600 mb-2">
                    {formatPlantType(plant.plantDetails.plant_type)}{plant.plantDetails.scientificName ? ` | ${plant.plantDetails.scientificName}` : ''}
                  </p>
                
                  {/* Growth Stage Section - Compact */}
                  {analysisResult ? (
                    <div className="space-y-2">
                      {/* Compact Growth Stage Text */}
                      <p className="text-sm font-medium text-gray-600">
                        {analysisResult.currentStage.stageDisplayName} | {analysisResult.currentStage.daysLeftInStage} days to {analysisResult.currentStage.nextStageDisplayName || 'Maturity'}
                      </p>
                      
                      <div className="relative">
                        {/* Progress Bar with embedded text */}
                        <div className="w-full bg-gray-200 rounded h-4 mb-1 relative">
                          <div 
                            className="bg-green-600 h-4 rounded transition-all duration-500 relative" 
                            style={{ width: `${analysisResult.currentStage.stageProgressPercent || calculateStageCompletion(analysisResult.currentStage.estimatedLifeDays, analysisResult.currentStage.daysLeftInStage)}%` }}
                          >
                            {(() => {
                              const progressPercent = analysisResult.currentStage.stageProgressPercent || calculateStageCompletion(analysisResult.currentStage.estimatedLifeDays, analysisResult.currentStage.daysLeftInStage);
                              const days = analysisResult.currentStage.estimatedLifeDays || 180;
                              const progressText = `${days} days (${progressPercent}%)`;
                              
                              // Check if text fits in completed bar (rough estimation: 8px per character)
                              const textWidth = progressText.length * 8;
                              const barWidth = (progressPercent / 100) * 200; // Assuming 200px bar width
                              
                              if (textWidth < barWidth && progressPercent > 30) {
                                // Text fits inside completed bar - center aligned
                                return (
                                  <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-medium">
                                    {progressText}
                                  </span>
                                );
                              } else {
                                // Text doesn't fit or bar too small - show in non-completed section
                                return (
                                  <span className="absolute top-0 left-full ml-2 h-4 flex items-center text-gray-700 text-xs font-medium whitespace-nowrap">
                                    {progressText}
                                  </span>
                                );
                              }
                            })()}
                          </div>
                        </div>
                        
                        {/* Timeline markers - only start and end */}
                        <div className="flex justify-between text-xs text-gray-600">
                          <div className="text-center">
                            <div className="text-xs font-medium">{analysisResult.currentStage.currentStageStartDays || 30}</div>
                            <div className="text-xs">days</div>
                          </div>
                          <div className="text-center">
                            <div className="text-xs font-medium">{analysisResult.currentStage.currentStageEndDays || 200}</div>
                            <div className="text-xs">days</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 italic">
                      Run analysis to see growth stage and progress
                    </div>
                  )}
                </div>
              </div>
            </div>

                      {/* Health Status Section */}
          {analysisResult && (
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-gray-900">Health</h3>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    getPlantHealthStatus(analysisResult).color === 'text-green-600' 
                      ? 'bg-green-100 text-green-800' 
                      : getPlantHealthStatus(analysisResult).color === 'text-yellow-600'
                      ? 'bg-yellow-100 text-yellow-800'
                      : getPlantHealthStatus(analysisResult).color === 'text-orange-600'
                      ? 'bg-orange-100 text-orange-800'
                      : getPlantHealthStatus(analysisResult).color === 'text-red-600'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {getPlantHealthStatus(analysisResult).status}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-500">
                    {getRelativeTime(plant.imageHistory?.[plant.imageHistory.length - 1]?.timestamp || plant.dateAdded)}
                  </span>
                </div>
              </div>
              {analysisResult.healthStatus?.reason && (
                <p className="text-sm text-gray-700">{analysisResult.healthStatus.reason}</p>
              )}
            </div>
          )}
          </div>

          {/* Analysis Results */}
          {analysisResult && (
            <div className="space-y-3">
              {/* Summary Section - Updated with bullet points and right-aligned icons */}
              <div className="bg-white rounded-lg border border-gray-200 p-3">
                <div 
                  className="flex items-center justify-between cursor-pointer hover:bg-gray-50 -m-3 p-3 rounded-lg transition-colors"
                  onClick={() => setCareInstructionsExpanded(!careInstructionsExpanded)}
                >
                  <h3 className="text-base font-semibold text-gray-900">Care Instructions</h3>
                  <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${careInstructionsExpanded ? 'rotate-90' : ''}`} />
                </div>
                {careInstructionsExpanded && (
                  <div className="space-y-2 text-sm text-gray-700 mt-2">
                  
                  {/* Care Instructions with bullet points and right-aligned icons */}
                  <div className="flex justify-between">
                    <div className="flex items-start gap-2 flex-1">
                      <span className="text-gray-400 text-sm leading-none mt-1">•</span>
                      <span className="text-sm leading-5">{analysisResult.careInstructions.water_requirement}</span>
                    </div>
                    <Droplets className="w-4 h-4 text-blue-500 mt-0.5 ml-3 flex-shrink-0" />
                  </div>
                  
                  <div className="flex justify-between">
                    <div className="flex items-start gap-2 flex-1">
                      <span className="text-gray-400 text-sm leading-none mt-1">•</span>
                      <span className="text-sm leading-5">{analysisResult.careInstructions.light_requirement}</span>
                    </div>
                    <svg className="w-4 h-4 text-yellow-500 mt-0.5 ml-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="5"/>
                      <line x1="12" y1="1" x2="12" y2="3"/>
                      <line x1="12" y1="21" x2="12" y2="23"/>
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                      <line x1="1" y1="12" x2="3" y2="12"/>
                      <line x1="21" y1="12" x2="23" y2="12"/>
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                    </svg>
                  </div>
                  
                  <div className="flex justify-between">
                    <div className="flex items-start gap-2 flex-1">
                      <span className="text-gray-400 text-sm leading-none mt-1">•</span>
                      <span className="text-sm leading-5">{analysisResult.careInstructions.suitable_temperature}</span>
                    </div>
                    <Thermometer className="w-4 h-4 text-red-500 mt-0.5 ml-3 flex-shrink-0" />
                  </div>
                  
                  <div className="flex justify-between">
                    <div className="flex items-start gap-2 flex-1">
                      <span className="text-gray-400 text-sm leading-none mt-1">•</span>
                      <span className="text-sm leading-5">{analysisResult.careInstructions.soil_type}</span>
                    </div>
                    <Sprout className="w-4 h-4 text-green-500 mt-0.5 ml-3 flex-shrink-0" />
                  </div>
                  
                  <div className="flex justify-between">
                    <div className="flex items-start gap-2 flex-1">
                      <span className="text-gray-400 text-sm leading-none mt-1">•</span>
                      <span className="text-sm leading-5">{analysisResult.careInstructions.fertilizer}</span>
                    </div>
                    <Sprout className="w-4 h-4 text-green-500 mt-0.5 ml-3 flex-shrink-0" />
                  </div>
                  
                  <div className="flex justify-between">
                    <div className="flex items-start gap-2 flex-1">
                      <span className="text-gray-400 text-sm leading-none mt-1">•</span>
                      <span className="text-sm leading-5">{analysisResult.careInstructions.common_diseases}</span>
                    </div>
                    <Shield className="w-4 h-4 text-red-500 mt-0.5 ml-3 flex-shrink-0" />
                  </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Items - Compact with Comments */}
          {actionItems.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <div 
                className="flex items-center justify-between cursor-pointer hover:bg-gray-50 -m-3 p-3 rounded-lg transition-colors"
                onClick={() => setActionItemsExpanded(!actionItemsExpanded)}
              >
                <h3 className="text-base font-semibold text-gray-900">Action Items</h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">
                    {actionItems.filter(item => item.status === 'pending').length} pending
                  </span>
                  <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${actionItemsExpanded ? 'rotate-90' : ''}`} />
                </div>
              </div>
              {actionItemsExpanded && (
                <div className="space-y-2 mt-2">
                {actionItems.filter(item => item.status === 'pending').map((item) => (
                  <div key={item.id} className="bg-gray-50 rounded-lg p-2">
                    <div className="flex items-start gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        {getCategoryIcon(item.category)}
                        <div className="flex-1">
                          <p className="text-sm text-gray-900">{item.task}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${getPriorityColor(item.priority)}`}>
                              {item.priority}
                            </span>
                            <span className="text-xs text-gray-500">
                              Due: {formatDate(item.dueDate)}
                            </span>
                            {isOverdue(item.dueDate) && (
                              <span className="text-xs text-red-600">Overdue</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setShowCommentsForItem(showCommentsForItem === item.id ? null : item.id);
                          }}
                          className="p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          title="View/Add comments"
                        >
                          <MessageCircle className="w-4 h-4" />
                          {item.comments && item.comments.length > 0 && (
                            <span className="text-xs ml-1">{item.comments.length}</span>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => updateActionItem(item.id, 'completed')}
                          className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                          title="Mark as completed"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => updateActionItem(item.id, 'discarded')}
                          className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Discard"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Comments Section */}
                    {showCommentsForItem === item.id && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        {/* Existing Comments */}
                        {item.comments && item.comments.length > 0 && (
                          <div className="space-y-2 mb-2">
                            {item.comments.map((comment) => (
                              <div key={comment.id} className="bg-white p-2 rounded border">
                                {editingCommentId === comment.id ? (
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      value={commentText}
                                      onChange={(e) => setCommentText(e.target.value)}
                                      onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                          editComment(item.id, comment.id, commentText);
                                        }
                                      }}
                                      className="flex-1 text-xs p-1 border rounded"
                                      placeholder="Edit comment..."
                                      autoFocus
                                    />
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => editComment(item.id, comment.id, commentText)}
                                      className="p-1 text-green-600 hover:bg-green-50"
                                    >
                                      <Send className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setEditingCommentId(null);
                                        setCommentText('');
                                      }}
                                      className="p-1 text-gray-600 hover:bg-gray-50"
                                    >
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <p className="text-xs text-gray-700">{comment.text}</p>
                                      <p className="text-xs text-gray-500 mt-1">{formatDateTime(comment.timestamp)}</p>
                                    </div>
                                    <div className="flex gap-1">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          setEditingCommentId(comment.id);
                                          setCommentText(comment.text);
                                        }}
                                        className="p-1 text-blue-600 hover:bg-blue-50"
                                      >
                                        <Edit className="w-3 h-3" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => deleteComment(item.id, comment.id)}
                                        className="p-1 text-red-600 hover:bg-red-50"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add Comment Form */}
                        {commentingItemId === item.id ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={commentText}
                              onChange={(e) => setCommentText(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  addComment(item.id, commentText);
                                }
                              }}
                              className="flex-1 text-xs p-1 border rounded"
                              placeholder="Add a comment..."
                              autoFocus
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => addComment(item.id, commentText)}
                              className="p-1 text-green-600 hover:bg-green-50"
                            >
                              <Send className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setCommentingItemId(null);
                                setCommentText('');
                              }}
                              className="p-1 text-gray-600 hover:bg-gray-50"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setCommentingItemId(item.id)}
                            className="text-xs text-blue-600 hover:bg-blue-50 p-1"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add comment
                          </Button>
                        )}
                      </div>
                    )}
                                     </div>
                 ))}
                 </div>
               )}
              </div>
            )}

          {/* Analysis State */}
          {!analysisResult && (
            <div className="flex flex-col items-center justify-center min-h-[35vh] text-center py-8">
              {analyzing ? (
                <div className="flex flex-col items-center space-y-4">
                  {/* Simple spinner */}
                  <div className="w-8 h-8 border-3 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                  
                  {/* Loading Text */}
                  <div className="space-y-2">
                    <h3 className="text-lg font-medium text-gray-800">Analyzing Your Plant...</h3>
                    <p className="text-sm text-gray-600">Our AI is examining your plant's health and growth stage</p>
                  </div>
                  
                  {/* Rotating Quote */}
                  <div className="max-w-xs mx-auto p-4 bg-green-50 rounded-lg border border-green-200 transition-all duration-500">
                    <p className="text-sm text-green-800 font-medium text-center leading-relaxed">
                      {plantCareQuotes[currentQuoteIndex]}
                    </p>
                  </div>
                  
                  {/* Progress Dots */}
                  <div className="flex space-x-2">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-full ${
                          (currentQuoteIndex + i) % 3 === 0 ? 'bg-green-600' : 'bg-green-300'
                        } transition-colors duration-300`}
                        style={{
                          animationDelay: `${i * 0.2}s`,
                          animation: 'pulse 1.5s infinite'
                        }}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                    <Activity className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-base font-normal text-gray-600">Run analysis to get insights on your plant health!</h3>
              <Button 
                className="bg-[#17A34A] hover:bg-[#15803d] text-white rounded-lg px-8 py-3 flex items-center justify-center gap-2 shadow-lg mx-auto"
                onClick={handleAnalyzePlant}
                disabled={analyzing}
              >
                  <Activity className="w-5 h-5" />
                Analyse Plant
              </Button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Fixed Bottom Action Buttons - Reverted styling */}
      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 px-4 py-4">
        <div className="flex gap-3">
          <Button 
            variant="outline"
            className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg py-3 flex items-center justify-center gap-2"
            onClick={handleScanPlant}
            disabled={!isLatestImageAnalyzed() || uploadingImage}
          >
            {uploadingImage ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Camera className="w-5 h-5" />
            )}
            Scan Plant
          </Button>
          
          <Button 
            variant="outline"
            className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg py-3 flex items-center justify-center gap-2"
            onClick={handleShowHistory}
            disabled={refreshingHistory}
          >
            {refreshingHistory ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <History className="w-5 h-5" />
            )}
            Logs
          </Button>
          
          <Button 
            variant="outline"
            className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg py-3 flex items-center justify-center gap-2"
            onClick={() => {
              navigate('/home', { 
                state: { 
                  shouldOpenChat: true,
                  initialMessage: plant ? `Tell me more about caring for my ${plant.plantDetails.common_name}` : undefined
                } 
              });
            }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C17.523 2 22 6.477 22 12C22 17.523 17.523 22 12 22C10.298 22 8.696 21.613 7.292 20.924L3 22L4.076 17.708C3.387 16.304 3 14.702 3 13C3 7.477 7.477 3 13 3H12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8 12H8.01M12 12H12.01M16 12H16.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Ask Arth
          </Button>
        </div>
      </div>

      {/* History Backdrop */}
      {showHistory && (
        <SheetBackdrop 
          isOpen={showHistory} 
          onClose={() => setShowHistory(false)}
          title="Plant History"
        >
          {(() => {
            // Create complete timeline: initial plant addition + all image history
            const timeline: Array<{
              type: string;
              timestamp: string;
              url?: string;
              isPlantAdded: boolean;
              analysis?: PlantImageAnalysis;
            }> = [];
            
            // Add initial plant addition entry with image
            if (plant?.dateAdded) {
              timeline.push({
                type: 'plant_added',
                timestamp: plant.dateAdded,
                url: plant.currentImage, // Include the image that was added with the plant
                isPlantAdded: true
              });
            }
            
            // Add all image history entries with analysis
            if (plant?.imageHistory && plant.imageHistory.length > 0) {
              plant.imageHistory.forEach(item => {
                if (item.analysis) {
                  timeline.push({
                    type: 'plant_analyzed',
                    timestamp: item.timestamp,
                    url: item.url,
                    analysis: item.analysis,
                    isPlantAdded: false
                  });
                }
              });
            }
            
            // Sort timeline by timestamp (newest first)
            timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            
            return timeline.length > 0 ? (
              <div className="relative max-w-md mx-auto">
                {/* Timeline line */}
                <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-300"></div>
                
                <div className="space-y-6">
                  {timeline.map((item, index) => (
                    <div key={`${item.type}_${index}`} className="relative">
                      {/* Timeline dot */}
                      <div className={`absolute left-2 w-3 h-3 rounded-full border-2 border-white ${
                        item.isPlantAdded ? 'bg-green-500' : 'bg-blue-500'
                      } shadow-sm`}></div>
                      
                      {/* Date/time row */}
                      <div className="ml-8 mb-2">
                        <p className="text-xs text-gray-500 font-medium">
                          {formatDateTime(item.timestamp)}
                        </p>
                      </div>
                      
                      {/* Log content */}
                      <div className="ml-8 flex items-start justify-between">
                        <div className="flex-1">
                          {item.isPlantAdded ? (
                            <div className="flex items-center gap-3">
                              {item.url && (
                                <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-50 flex-shrink-0">
                                  <img 
                                    src={item.url} 
                                    alt="Plant added"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                              <p className="text-sm font-medium text-gray-900">Plant added to collection</p>
                            </div>
                          ) : item.analysis ? (
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-3">
                                <p className="text-sm font-medium text-gray-900">Plant analysed</p>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  item.analysis.healthStatus?.status === 'Healthy' || item.analysis.healthStatus?.status === 'Good'
                                    ? 'bg-green-100 text-green-800' 
                                    : item.analysis.healthStatus?.status === 'Fair' || item.analysis.healthStatus?.status === 'Moderate'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : item.analysis.healthStatus?.status === 'Poor' || item.analysis.healthStatus?.status === 'Needs Attention'
                                    ? 'bg-orange-100 text-orange-800'
                                    : item.analysis.healthStatus?.status === 'Critical' || item.analysis.healthStatus?.status === 'Unhealthy'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {item.analysis.healthStatus?.status || 'Good'}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm font-medium text-gray-900">Image uploaded</p>
                          )}
                        </div>

                        {/* Delete Button - Only show if analysis exists and it's not the plant added entry */}
                        {item.analysis && !item.isPlantAdded && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeHistoryLog(item.timestamp, item.url || '')}
                            className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md ml-4"
                            title="Remove this log"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 max-w-md mx-auto">
                <p className="text-gray-500">No history available</p>
              </div>
            );
          })()}
        </SheetBackdrop>
      )}
    </div>
  );
};

export default PlantLogsPage;
