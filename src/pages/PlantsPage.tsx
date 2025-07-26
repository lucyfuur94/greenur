import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useOnboarding } from '@/lib/OnboardingContext';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  ClipboardList, 
  Leaf,
  Camera,
  Eye,
  FileText,
  Trash2,
  Edit3,
  Check,
  X,
  Home,
  Minus,
  ArrowLeft,
  Upload,
  Loader2,
  Edit
} from "lucide-react";
import FooterNavigation from '@/components/FooterNavigation';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { getIdToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Label } from '@/components/ui/label';

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
    scientific_name: string;
    plant_type: string;
  };
  imageHistory: Array<{
    url: string;
    timestamp: string;
  }>;
  growingSpaceId?: string | null;
}

interface PlantAnalysis {
  commonName: string
  scientificName: string
  plantType?: string
  inDatabase?: boolean
  catalogId?: string
}

interface AddPlantModalProps {
  isOpen: boolean
  onClose: () => void
  spaces: { id: string; name: string }[]
  onPlantAdded: (plantId?: string) => void
}

const AddPlantModal: React.FC<AddPlantModalProps> = ({ isOpen, onClose, spaces, onPlantAdded }) => {
  const [step, setStep] = useState<'capture' | 'analyze' | 'confirm'>('capture')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [analysis, setAnalysis] = useState<PlantAnalysis | null>(null)
  const [nickname, setNickname] = useState('')
  const [selectedSpace, setSelectedSpace] = useState<string>('unassigned')
  const [error, setError] = useState<string | null>(null)
  const [existingPlants, setExistingPlants] = useState<TrackedPlant[]>([])
  const { currentUser } = useAuth()
  const { toast } = useToast()

  // Fetch existing plants for duplicate checking
  useEffect(() => {
    const fetchExistingPlants = async () => {
      if (!currentUser || !isOpen) return;
      
      try {
        const token = await currentUser.getIdToken()
        const response = await fetch(`/.netlify/functions/tracked-plants?userId=${currentUser.uid}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setExistingPlants(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('Error fetching existing plants:', error);
        setExistingPlants([]);
      }
    };

    fetchExistingPlants();
  }, [currentUser, isOpen]);

  const generateUniqueNickname = (baseName: string) => {
    const existingNicknames = existingPlants.map(plant => 
      (plant.nickname || plant.plantDetails.common_name).toLowerCase()
    );
    
    let newName = baseName;
    let counter = 1;
    
    while (existingNicknames.includes(newName.toLowerCase())) {
      counter++;
      newName = `${baseName} ${counter}`;
    }
    
    return newName;
  };

  const resetModal = () => {
    setStep('capture')
    setImageFile(null)
    setImagePreview(null)
    setIsProcessing(false)
    setAnalysis(null)
    setNickname('')
    setSelectedSpace('unassigned')
    setError(null)
  }

  const handleClose = () => {
    resetModal()
    onClose()
  }

  // HEIC to JPEG conversion utility
  const convertHeicToJpeg = async (file: File): Promise<File> => {
    console.log('convertHeicToJpeg: Starting conversion for file:', file.name, 'Type:', file.type)
    
    if (!file.type.includes('heic') && !file.name.toLowerCase().includes('.heic')) {
      console.log('convertHeicToJpeg: File is not HEIC, returning original')
      return file
    }

    try {
      console.log('convertHeicToJpeg: Attempting to convert HEIC file')
      // Dynamic import of heic2any
      const heic2any = (await import('heic2any')).default
      console.log('convertHeicToJpeg: heic2any imported successfully')
      
      const convertedBlob = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.8
      }) as Blob

      console.log('convertHeicToJpeg: Conversion successful, blob size:', convertedBlob.size)

      const convertedFile = new File([convertedBlob], file.name.replace(/\.heic$/i, '.jpg'), {
        type: 'image/jpeg'
      })
      
      console.log('convertHeicToJpeg: Created new file:', convertedFile.name, 'Type:', convertedFile.type)
      return convertedFile
    } catch (error) {
      console.error('HEIC conversion failed:', error)
      throw new Error(`Failed to convert HEIC image: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Resize image to 500x500
  const resizeImage = async (file: File): Promise<File> => {
    console.log('resizeImage: Starting resize for file:', file.name, 'Size:', file.size)
    
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      const img = new Image()
      
      img.onload = () => {
        console.log('resizeImage: Image loaded, original size:', img.width, 'x', img.height)
        
        canvas.width = 500
        canvas.height = 500
        
        // Calculate scaling to fit within 500x500 while maintaining aspect ratio
        const scale = Math.min(500 / img.width, 500 / img.height)
        const newWidth = img.width * scale
        const newHeight = img.height * scale
        
        console.log('resizeImage: New size will be:', newWidth, 'x', newHeight)
        
        // Center the image
        const x = (500 - newWidth) / 2
        const y = (500 - newHeight) / 2
        
        // Clear canvas and draw resized image
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, 500, 500)
        ctx.drawImage(img, x, y, newWidth, newHeight)
        
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Failed to create blob from canvas'))
            return
          }
          
          const resizedFile = new File([blob], file.name, {
            type: 'image/jpeg'
          })
          
          console.log('resizeImage: Resize complete, new file size:', resizedFile.size)
          resolve(resizedFile)
        }, 'image/jpeg', 0.9)
      }
      
      img.onerror = (error) => {
        console.error('resizeImage: Failed to load image:', error)
        reject(new Error('Failed to load image for resizing'))
      }
      
      console.log('resizeImage: Creating object URL for image')
      img.src = URL.createObjectURL(file)
    })
  }

  const handleImageSelect = async (file: File) => {
    console.log('handleImageSelect: Processing file:', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    })
    
    try {
      setIsProcessing(true)
      setError(null)

      // Step 1: Test if file is readable
      console.log('handleImageSelect: Step 1 - Testing file readability')
      const fileReader = new FileReader()
      await new Promise((resolve, reject) => {
        fileReader.onload = () => {
          console.log('handleImageSelect: File is readable, size:', fileReader.result?.toString().length || 0)
          resolve(null)
        }
        fileReader.onerror = reject
        fileReader.readAsArrayBuffer(file)
      })

      // Step 2: Convert HEIC to JPEG if needed
      console.log('handleImageSelect: Step 2 - HEIC conversion check')
      let convertedFile: File
      
      if (file.type.includes('heic') || file.name.toLowerCase().includes('.heic')) {
        console.log('handleImageSelect: HEIC file detected, converting...')
        try {
          convertedFile = await convertHeicToJpeg(file)
          console.log('handleImageSelect: HEIC conversion successful')
        } catch (conversionError) {
          console.error('handleImageSelect: HEIC conversion failed:', conversionError)
          throw new Error(`HEIC conversion failed: ${conversionError instanceof Error ? conversionError.message : 'Unknown error'}`)
        }
      } else {
        console.log('handleImageSelect: Non-HEIC file, using original')
        convertedFile = file
      }
      
      // Step 3: Resize image to 500x500
      console.log('handleImageSelect: Step 3 - Image resizing')
      let resizedFile: File
      try {
        resizedFile = await resizeImage(convertedFile)
        console.log('handleImageSelect: Image resize successful')
      } catch (resizeError) {
        console.error('handleImageSelect: Image resize failed:', resizeError)
        throw new Error(`Image resize failed: ${resizeError instanceof Error ? resizeError.message : 'Unknown error'}`)
      }
      
      console.log('handleImageSelect: Step 4 - Setting state and preview')
      setImageFile(resizedFile)
      setImagePreview(URL.createObjectURL(resizedFile))
      
      // Step 5: Automatically proceed to analysis
      console.log('handleImageSelect: Step 5 - Starting plant analysis')
      await analyzePlant(resizedFile)
      
    } catch (error: any) {
      console.error('handleImageSelect: Error processing image:', error)
      
      // Provide more specific error messages
      let errorMessage = 'Failed to process image'
      if (error.message) {
        errorMessage = error.message
      }
      
      // Add additional context based on error type
      if (error.message?.includes('heic2any')) {
        errorMessage += ' - HEIC converter library failed to load. Please try converting the image to JPEG first.'
      } else if (error.message?.includes('canvas')) {
        errorMessage += ' - Image resize failed. The image might be corrupted.'
      } else if (error.message?.includes('fetch')) {
        errorMessage += ' - Network error. Please check your internet connection.'
      }
      
      setError(errorMessage)
      setIsProcessing(false)
    }
  }

  const analyzePlant = async (file: File) => {
    console.log('analyzePlant: Starting analysis for file:', file.name, 'Size:', file.size)
    
    try {
      setStep('analyze')
      setIsProcessing(true)

      const formData = new FormData()
      formData.append('image', file)
      
      console.log('analyzePlant: Sending request to /.netlify/functions/analyze-plant')

      const response = await fetch('/.netlify/functions/analyze-plant', {
        method: 'POST',
        body: formData
      })

      console.log('analyzePlant: Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('analyzePlant: API error response:', errorText)
        throw new Error(`Failed to analyze plant: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log('analyzePlant: Analysis response:', data)
      
      if (data.analysis) {
        setAnalysis(data.analysis)
        // Generate unique nickname based on common name
        const uniqueName = generateUniqueNickname(data.analysis.commonName || 'My Plant')
        setNickname(uniqueName)
        setStep('confirm')
        console.log('analyzePlant: Analysis complete, moving to confirm step')
      } else {
        throw new Error('No analysis received from server')
      }
      
    } catch (error: any) {
      console.error('analyzePlant: Error during analysis:', error)
      setError(error.message || 'Failed to analyze plant')
      setStep('capture')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleAddToDatabase = async () => {
    if (!analysis || analysis.inDatabase) return

    try {
      setIsProcessing(true)

      const plantData = {
        plantName: analysis.commonName,
        scientific_name: analysis.scientificName,
        plant_type: analysis.plantType || 'Unknown'
      }

      const response = await fetch('/.netlify/functions/add-plant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(plantData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to add plant to database')
      }

      const addedPlant = await response.json()
      console.log('Plant added to catalog:', addedPlant)

      toast({
        title: "Plant Added to Database!",
        description: `${analysis.commonName} has been added to our plant database with care information.`
      })

      // Update the analysis to reflect it's now in database with the catalog ID
      setAnalysis({
        ...analysis,
        inDatabase: true,
        catalogId: addedPlant._id
      })

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || 'Failed to add plant to database',
        variant: "destructive"
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleAddPlant = async () => {
    if (!imageFile || !analysis || !currentUser) return

    // Final check for duplicate nickname before saving
    const finalNickname = nickname.trim();
    if (!finalNickname) {
      setError('Please enter a plant nickname')
      return
    }

    const existingNicknames = existingPlants.map(plant => 
      (plant.nickname || plant.plantDetails.common_name).toLowerCase()
    );
    
    if (existingNicknames.includes(finalNickname.toLowerCase())) {
      setError('A plant with this name already exists. Please choose a different name.')
      return
    }

    try {
      setIsProcessing(true)
      setError('')

      console.log('Starting plant addition process...')
      console.log('Image file:', imageFile.name, imageFile.size)
      console.log('Analysis:', analysis)
      console.log('Current user:', currentUser.uid)

      // Upload image first
      const uploadFormData = new FormData()
      uploadFormData.append('file', imageFile)
      uploadFormData.append('userId', currentUser.uid)

      console.log('Uploading image to Firebase...')
      const uploadResponse = await fetch('/.netlify/functions/upload-image', {
        method: 'POST',
        body: uploadFormData
      })

      console.log('Upload response status:', uploadResponse.status)
      
      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text()
        console.error('Upload failed:', errorText)
        throw new Error(`Failed to upload image: ${errorText}`)
      }

      const uploadData = await uploadResponse.json()
      console.log('Upload successful:', uploadData)

      // Add plant to database
      const token = await getIdToken(auth.currentUser!)
      console.log('Got auth token, adding plant to database...')
      
      const plantData = {
        userId: currentUser.uid,
        nickname: finalNickname,
        plantId: analysis.inDatabase && analysis.catalogId 
          ? analysis.catalogId 
          : `custom_${currentUser.uid.slice(-8)}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        currentImage: uploadData.url,
        plantDetails: {
          common_name: analysis.commonName,
          scientificName: analysis.scientificName,
          plant_type: analysis.plantType || 'Unknown'
        },
        growingSpaceId: selectedSpace === 'unassigned' || !selectedSpace ? null : selectedSpace
      }

      console.log('Plant data to add:', plantData)

      const addResponse = await fetch('/.netlify/functions/tracked-plants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(plantData)
      })

      console.log('Add plant response status:', addResponse.status)

      if (!addResponse.ok) {
        const errorText = await addResponse.text()
        console.error('Add plant failed:', errorText)
        throw new Error(`Failed to add plant: ${errorText}`)
      }

      const result = await addResponse.json()
      console.log('Plant added successfully:', result)

      toast({
        title: "Plant Added!",
        description: `${nickname || analysis.commonName} has been added to your collection.`
      })

      onPlantAdded(result.plantId)
      handleClose()
      
    } catch (error: any) {
      console.error('Error in handleAddPlant:', error)
      setError(error.message || 'Failed to add plant')
    } finally {
      setIsProcessing(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-[9999]"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-background rounded-lg shadow-xl z-[10000] w-96 max-w-[90vw] max-h-[90vh] overflow-auto border border-border">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Add New Plant</h2>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="text-red-600 text-sm mb-4 p-3 bg-red-50 rounded-lg">
              <div className="font-medium">Error:</div>
              <div>{error}</div>
              {/* Add test button for debugging */}
              <button 
                onClick={async () => {
                  try {
                    console.log('Testing Gemini API...')
                    const response = await fetch('/.netlify/functions/test-gemini')
                    const data = await response.json()
                    console.log('Test result:', data)
                    if (data.success) {
                      setError('Gemini API is working! Try uploading a different image.')
                    } else {
                      setError(`API Test Failed: ${data.error}`)
                    }
                  } catch (e) {
                    console.error('Test failed:', e)
                    setError('Network error during API test')
                  }
                }}
                className="mt-2 px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
              >
                Test API
              </button>
            </div>
          )}

          {/* Step: Capture */}
          {step === 'capture' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                Take a photo or upload an image of your plant
              </p>
              
              <div className="flex gap-4">
                {/* Camera Capture */}
                <label className="cursor-pointer flex-1">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-green-500 transition-colors h-full min-h-[120px] flex flex-col items-center justify-center">
                    <Camera className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <span className="text-sm text-gray-600">Take Photo</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])}
                  />
                </label>

                {/* File Upload */}
                <label className="cursor-pointer flex-1">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-green-500 transition-colors h-full min-h-[120px] flex flex-col items-center justify-center">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <span className="text-sm text-gray-600">Upload Image</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*,.heic,.heif"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])}
                  />
                </label>
              </div>
            </div>
          )}

          {/* Step: Analyzing */}
          {step === 'analyze' && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-green-500" />
              <p className="text-lg font-medium mb-2">Analyzing your plant...</p>
              <p className="text-sm text-muted-foreground">
                Our AI is identifying the plant species
              </p>
            </div>
          )}

          {/* Step: Confirm */}
          {step === 'confirm' && analysis && (
            <div className="space-y-4">
              {/* Image Preview */}
              {imagePreview && (
                <div className="flex justify-center">
                  <div className="w-32 h-32 rounded-xl bg-muted border-2 overflow-hidden transition-shadow border-border hover:shadow-md">
                    <img 
                      src={imagePreview} 
                      alt="Plant preview" 
                      className="w-full h-full object-cover object-center scale-150"
                    />
                  </div>
                </div>
              )}

              {/* Analysis Results */}
              <div className={`border rounded-lg p-4 ${
                analysis.inDatabase 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-blue-50 border-blue-200'
              }`}>
                <h3 className={`font-medium mb-2 ${
                  analysis.inDatabase ? 'text-green-800' : 'text-blue-800'
                }`}>
                  {analysis.inDatabase ? 'Plant Identified!' : 'Plant Identified (Not in Database)'}
                </h3>
                <p className={`text-sm ${analysis.inDatabase ? 'text-green-700' : 'text-blue-700'}`}>
                  <strong>Common Name:</strong> {analysis.commonName}
                </p>
                <p className={`text-sm ${analysis.inDatabase ? 'text-green-700' : 'text-blue-700'}`}>
                  <strong>Scientific Name:</strong> {analysis.scientificName}
                </p>
                {analysis.plantType && (
                  <p className={`text-sm ${analysis.inDatabase ? 'text-green-700' : 'text-blue-700'}`}>
                    <strong>Type:</strong> {analysis.plantType}
                  </p>
                )}
                
                {!analysis.inDatabase && (
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <p className="text-sm text-blue-600 mb-2">
                      This plant isn't in our care database yet.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddToDatabase}
                      className="border-blue-300 text-blue-700 hover:bg-blue-100"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add to Database
                    </Button>
                  </div>
                )}
              </div>

              {/* Plant Nickname */}
              <div>
                <Label htmlFor="nickname" className="text-sm font-medium mb-1 block">
                  Plant Nickname
                </Label>
                <Input
                  id="nickname"
                  value={nickname}
                  onChange={(e) => {
                    const value = e.target.value;
                    setNickname(value);
                    // Clear error when user starts typing
                    if (error && error.includes('name already exists')) {
                      setError(null);
                    }
                  }}
                  placeholder="Give your plant a name"
                  className={`w-full ${
                    error && error.includes('name already exists') 
                      ? 'border-red-500 focus:border-red-500' 
                      : ''
                  }`}
                />
                {/* Show warning for duplicate names */}
                {nickname.trim() && existingPlants.some(plant => 
                  (plant.nickname || plant.plantDetails.common_name).toLowerCase() === nickname.trim().toLowerCase()
                ) && (
                  <p className="text-sm text-amber-600 mt-1">
                    ⚠️ A plant with this name already exists
                  </p>
                )}
              </div>

              {/* Growing Space Selection */}
              <div>
                <Label htmlFor="space" className="text-sm font-medium mb-1 block">
                  Growing Space (Optional)
                </Label>
                <Select value={selectedSpace} onValueChange={setSelectedSpace}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a space or keep unassigned" />
                  </SelectTrigger>
                  <SelectContent className="z-[10001]">
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {spaces.map((space) => (
                      <SelectItem key={space.id} value={space.id}>
                        {space.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setStep('capture')}
                  className="flex-1"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button 
                  onClick={handleAddPlant}
                  disabled={
                    isProcessing || 
                    !nickname.trim() || 
                    !analysis?.inDatabase ||
                    existingPlants.some(plant => 
                      (plant.nickname || plant.plantDetails.common_name).toLowerCase() === nickname.trim().toLowerCase()
                    )
                  }
                  className="flex-1"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  Add Plant
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

const PlantsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { userPreferences, updateUserPreferences } = useOnboarding();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [plants, setPlants] = useState<TrackedPlant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [isEditMode, setIsEditMode] = useState(false);
  const [draggedPlant, setDraggedPlant] = useState<TrackedPlant | null>(null);
  const [dragOverSpace, setDragOverSpace] = useState<string | null>(null);
  const [showAddSpaceModal, setShowAddSpaceModal] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [plantToDelete, setPlantToDelete] = useState<TrackedPlant | null>(null);
  const [selectedPlantsForDeletion, setSelectedPlantsForDeletion] = useState<Set<string>>(new Set());
  const [showDeleteSpaceModal, setShowDeleteSpaceModal] = useState(false);
  const [spaceToDelete, setSpaceToDelete] = useState<string | null>(null);
  const [showAddPlantModal, setShowAddPlantModal] = useState(false);
  const [showRenameSpaceModal, setShowRenameSpaceModal] = useState(false);
  const [spaceToRename, setSpaceToRename] = useState<string | null>(null);
  const [renameSpaceName, setRenameSpaceName] = useState('');

  // Fetch user's tracked plants
  useEffect(() => {
    const fetchPlants = async () => {
      if (!currentUser) return;
      
      try {
        const token = await currentUser.getIdToken()
        const response = await fetch(`/.netlify/functions/tracked-plants?userId=${currentUser.uid}`, {
          headers: {
            'Authorization': `Bearer ${token}`
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
  }, [currentUser]);

  // Group plants by growing space
  const groupPlantsBySpace = () => {
    const spaces = userPreferences?.growingSpaces || [];
    const groupedPlants: Record<string, TrackedPlant[]> = {};
    
    // Initialize all spaces
    spaces.forEach(space => {
      groupedPlants[space.id] = [];
    });
    
    // Add a default space for plants without growing space
    groupedPlants['unassigned'] = [];
    
    // Group plants by their growing space
    plants.forEach(plant => {
      const spaceId = plant.growingSpaceId || 'unassigned';
      if (!groupedPlants[spaceId]) {
        groupedPlants[spaceId] = [];
      }
      groupedPlants[spaceId].push(plant);
    });
    
    return groupedPlants;
  };

  const getSpaceName = (spaceId: string) => {
    if (spaceId === 'unassigned') return 'Unassigned Plants';
    
    const space = userPreferences?.growingSpaces?.find(s => s.id === spaceId);
    return space?.name || formatSpaceType(space?.type || '');
  };

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

  const handleAddPlant = () => {
    setShowAddPlantModal(true);
  };

  const handleLogCare = () => {
    toast({ 
      title: "Log Care", 
      description: "Care logging feature coming soon!" 
    });
  };

  const handleAddSpace = () => {
    setShowAddSpaceModal(true);
  };

  const handleCreateSpace = async () => {
    if (!newSpaceName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a space name",
        variant: "destructive"
      });
      return;
    }

    try {
      // Generate a unique ID for the new space
      const newSpaceId = `space_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const newSpace = {
        id: newSpaceId,
        name: newSpaceName.trim(),
        type: 'custom' as const
      };

      // Update user preferences with new space
      const updatedGrowingSpaces = [...(userPreferences?.growingSpaces || []), newSpace];
      
      if (updateUserPreferences) {
        await updateUserPreferences({
          ...userPreferences,
          growingSpaces: updatedGrowingSpaces
        });
      }

      toast({
        title: "Space Added",
        description: `"${newSpaceName}" has been added to your growing spaces`
      });

      setNewSpaceName('');
      setShowAddSpaceModal(false);
    } catch (error) {
      console.error('Error adding space:', error);
      toast({
        title: "Error",
        description: "Failed to add space. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleCancelAddSpace = () => {
    setNewSpaceName('');
    setShowAddSpaceModal(false);
  };

  const handleEditMode = () => {
    if (isEditMode) {
      // Reset selections when exiting edit mode
      setSelectedPlantsForDeletion(new Set());
    }
    setIsEditMode(!isEditMode);
    setSelectedPlantId(null);
  };

  const handleApplyChanges = async () => {
    try {
      // Delete selected plants
      if (selectedPlantsForDeletion.size > 0) {
        const deletionPromises = Array.from(selectedPlantsForDeletion).map(async (plantId) => {
          const response = await fetch(`/.netlify/functions/tracked-plants?id=${plantId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${await currentUser?.getIdToken()}`
            }
          });
          if (!response.ok) {
            throw new Error(`Failed to delete plant ${plantId}`);
          }
          return plantId;
        });

        const deletedPlantIds = await Promise.all(deletionPromises);
        
        // Update local state to remove deleted plants
        setPlants(prevPlants => prevPlants.filter(plant => !deletedPlantIds.includes(plant._id)));
        
        toast({
          title: "Changes Applied",
          description: `${deletedPlantIds.length} plant(s) deleted successfully`
        });
      }

      // Update plant space assignments via API
      const plantsToUpdate = plants.filter(plant => !selectedPlantsForDeletion.has(plant._id));
      
      if (plantsToUpdate.length > 0) {
        const updatePromises = plantsToUpdate.map(async (plant) => {
          try {
            const response = await fetch(`/.netlify/functions/tracked-plants?id=${plant._id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${await currentUser?.getIdToken()}`
              },
              body: JSON.stringify({
                growingSpaceId: plant.growingSpaceId
              })
            });
            
            if (!response.ok) {
              console.warn(`Failed to update plant ${plant._id} space assignment`);
            }
            return plant._id;
          } catch (error) {
            console.warn(`Error updating plant ${plant._id}:`, error);
            return null;
          }
        });

        await Promise.all(updatePromises);
      }

      // Reset edit mode state
      setSelectedPlantsForDeletion(new Set());
      setIsEditMode(false);
      
      if (selectedPlantsForDeletion.size === 0) {
        toast({
          title: "Changes Applied",
          description: "Plant arrangements saved successfully"
        });
      }
    } catch (error) {
      console.error('Error applying changes:', error);
      toast({
        title: "Error",
        description: "Failed to apply some changes. Please try again.",
        variant: "destructive"
      });
    }
  };

  const togglePlantSelection = (plantId: string) => {
    setSelectedPlantsForDeletion(prev => {
      const newSet = new Set(prev);
      if (newSet.has(plantId)) {
        newSet.delete(plantId);
      } else {
        newSet.add(plantId);
      }
      return newSet;
    });
  };

  const handleDeleteSpace = (spaceId: string) => {
    setSpaceToDelete(spaceId);
    setShowDeleteSpaceModal(true);
  };

  const handleRenameSpace = (spaceId: string) => {
    const space = userPreferences?.growingSpaces?.find(s => s.id === spaceId);
    if (space) {
      setSpaceToRename(spaceId);
      setRenameSpaceName(space.name || '');
      setShowRenameSpaceModal(true);
    }
  };

  const confirmRenameSpace = async () => {
    if (!spaceToRename || !renameSpaceName.trim()) return;

    try {
      // Update space name in user preferences
      const updatedSpaces = userPreferences?.growingSpaces?.map(space => 
        space.id === spaceToRename 
          ? { ...space, name: renameSpaceName.trim() }
          : space
      ) || [];
      
      if (updateUserPreferences) {
        await updateUserPreferences({
          ...userPreferences,
          growingSpaces: updatedSpaces
        });
      }

      toast({
        title: "Space Renamed",
        description: `Space renamed to "${renameSpaceName.trim()}" successfully.`
      });
    } catch (error) {
      console.error('Error renaming space:', error);
      toast({
        title: "Error",
        description: "Failed to rename space. Please try again.",
        variant: "destructive"
      });
    }

    setShowRenameSpaceModal(false);
    setSpaceToRename(null);
    setRenameSpaceName('');
  };

  const cancelRenameSpace = () => {
    setShowRenameSpaceModal(false);
    setSpaceToRename(null);
    setRenameSpaceName('');
  };

  const confirmDeleteSpace = async () => {
    if (!spaceToDelete || spaceToDelete === 'unassigned') return;

    try {
      // Move all plants in this space to unassigned
      const plantsInSpace = plants.filter(plant => plant.growingSpaceId === spaceToDelete);
      
      // Update plants to unassigned space
      setPlants(prevPlants => 
        prevPlants.map(plant => 
          plant.growingSpaceId === spaceToDelete 
            ? { ...plant, growingSpaceId: null }
            : plant
        )
      );

      // Remove space from user preferences
      const updatedSpaces = userPreferences?.growingSpaces?.filter(space => space.id !== spaceToDelete) || [];
      
      if (updateUserPreferences) {
        await updateUserPreferences({
          ...userPreferences,
          growingSpaces: updatedSpaces
        });
      }

      toast({
        title: "Space Deleted",
        description: `Space deleted successfully. ${plantsInSpace.length} plant(s) moved to unassigned.`
      });
    } catch (error) {
      console.error('Error deleting space:', error);
      toast({
        title: "Error",
        description: "Failed to delete space. Please try again.",
        variant: "destructive"
      });
    }

    setShowDeleteSpaceModal(false);
    setSpaceToDelete(null);
  };

  const cancelDeleteSpace = () => {
    setShowDeleteSpaceModal(false);
    setSpaceToDelete(null);
  };

  const handlePlantClick = (plant: TrackedPlant, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (isEditMode) return; // Disable dropdown in edit mode
    
    if (selectedPlantId === plant._id) {
      setSelectedPlantId(null);
      return;
    }
    
    // Calculate dropdown position relative to the clicked element
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const dropdownWidth = 140; // min-w-[140px]
    
    // Position dropdown to the right of the plant, or left if not enough space
    let left = rect.right + 8; // 8px gap
    if (left + dropdownWidth > window.innerWidth) {
      left = rect.left - dropdownWidth - 8; // Position to the left instead
    }
    
    // Position dropdown vertically centered with the plant
    const top = rect.top + (rect.height / 2) - 60; // Approximate dropdown height / 2
    
    setDropdownPosition({ top, left });
    setSelectedPlantId(plant._id);
  };

  const handleDragStart = (plant: TrackedPlant, event: React.DragEvent) => {
    if (!isEditMode) return;
    setDraggedPlant(plant);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (event: React.DragEvent, spaceId: string) => {
    if (!isEditMode || !draggedPlant) return;
    event.preventDefault();
    setDragOverSpace(spaceId);
  };

  const handleDragLeave = () => {
    setDragOverSpace(null);
  };

  const handleDrop = async (event: React.DragEvent, targetSpaceId: string) => {
    if (!isEditMode || !draggedPlant) return;
    event.preventDefault();
    
    const sourceSpaceId = draggedPlant.growingSpaceId || 'unassigned';
    
    if (sourceSpaceId === targetSpaceId) {
      setDragOverSpace(null);
      setDraggedPlant(null);
      return;
    }

    // Update plant's growing space in local state immediately for better UX
    const updatedPlant = {
      ...draggedPlant,
      growingSpaceId: targetSpaceId === 'unassigned' ? null : targetSpaceId
    };

    setPlants(prevPlants => 
      prevPlants.map(plant => 
        plant._id === draggedPlant._id ? updatedPlant : plant
      )
    );

    toast({
      title: "Plant Moved",
      description: `${draggedPlant.nickname || draggedPlant.plantDetails.common_name} moved to ${getSpaceName(targetSpaceId)}`
    });

    setDragOverSpace(null);
    setDraggedPlant(null);
  };

  const handleShowDetails = (plant: TrackedPlant) => {
    navigate(`/plant-logs/${plant._id}`);  // Use the user's plant instance ID, not the plant type ID
    setSelectedPlantId(null);
  };

  const handleLogInfo = (plant: TrackedPlant) => {
    toast({ 
      title: "Log Info", 
      description: `Logging care for ${plant.nickname}` 
    });
    setSelectedPlantId(null);
  };

  const handleDeletePlant = (plant: TrackedPlant) => {
    setPlantToDelete(plant);
    setShowDeleteConfirmModal(true);
    setSelectedPlantId(null);
  };

  const confirmDeletePlant = async () => {
    if (!plantToDelete) return;

    try {
      const response = await fetch(`/.netlify/functions/tracked-plants?id=${plantToDelete._id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${await currentUser?.getIdToken()}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete plant');
      }

      // Remove plant from local state
      setPlants(prevPlants => prevPlants.filter(p => p._id !== plantToDelete._id));
      
    toast({ 
        title: "Plant Deleted",
        description: `${plantToDelete.nickname || plantToDelete.plantDetails.common_name} has been deleted successfully`
      });
    } catch (error) {
      console.error('Error deleting plant:', error);
      toast({
        title: "Error",
        description: "Failed to delete plant. Please try again.",
        variant: "destructive"
      });
    }
    
    setShowDeleteConfirmModal(false);
    setPlantToDelete(null);
  };

  const cancelDeletePlant = () => {
    setShowDeleteConfirmModal(false);
    setPlantToDelete(null);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (selectedPlantId) {
        setSelectedPlantId(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [selectedPlantId]);

  const renderPlantsLayout = () => {
    const groupedPlants = groupPlantsBySpace();
    
    return (
      <div className="space-y-6">
        {Object.entries(groupedPlants).map(([spaceId, spacePlants]) => {
          // Always show spaces in edit mode, show non-empty spaces in normal mode
          // Hide unassigned section when no plants exist
          if (!isEditMode && spacePlants.length === 0) {
            return null;
          }
          
          return (
            <div 
              key={spaceId} 
              className="space-y-3 relative"
              onDragOver={(e) => handleDragOver(e, spaceId)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, spaceId)}
            >
              {/* Drag Over Indicator - Overlay that doesn't affect layout */}
              {isEditMode && dragOverSpace === spaceId && (
                <div className="absolute inset-0 bg-primary/10 border-2 border-primary border-dashed rounded-lg pointer-events-none z-5" />
              )}
              
              <div className="flex items-center justify-between px-4">
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  {spaceId !== 'unassigned' && <Home className="w-4 h-4" />}
                  {getSpaceName(spaceId)}
                  <span className="text-sm text-muted-foreground">({spacePlants.length})</span>
                </h2>
                <div className="flex items-center gap-2">
                  {isEditMode && (
                    <span className="text-xs text-muted-foreground">
                      Drop plants here
                    </span>
                  )}
                  {isEditMode && spaceId !== 'unassigned' && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRenameSpace(spaceId)}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSpace(spaceId)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              
              <ScrollArea className="w-full">
                <div className="flex space-x-4 px-4 pb-2">
                  {spacePlants.length > 0 ? (
                    spacePlants.map((plant) => (
                      <div 
                        key={plant._id} 
                        className={`relative flex flex-col items-center min-w-[100px] pt-2 ${
                          isEditMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                        }`}
                        onClick={(e) => handlePlantClick(plant, e)}
                        draggable={isEditMode && !selectedPlantsForDeletion.has(plant._id)}
                        onDragStart={(e) => handleDragStart(plant, e)}
                      >
                        {/* Delete Circle in Edit Mode - Fixed positioning with better spacing */}
                        {isEditMode && (
                          <div 
                            className={`absolute top-0 right-0 z-10 w-6 h-6 rounded-full border-2 border-background cursor-pointer shadow-sm ${
                              selectedPlantsForDeletion.has(plant._id) 
                                ? 'bg-red-600 text-white' 
                                : 'bg-muted hover:bg-red-100 dark:hover:bg-red-900/20'
                            } flex items-center justify-center transition-colors`}
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePlantSelection(plant._id);
                            }}
                          >
                            <Minus className="w-3 h-3" />
                          </div>
                        )}
                        
                        <div className={`w-20 h-20 rounded-xl bg-muted border-2 overflow-hidden transition-shadow ${
                          isEditMode ? 'border-dashed border-primary' : 'border-border hover:shadow-md'
                        } ${
                          selectedPlantsForDeletion.has(plant._id) ? 'opacity-50' : ''
                        }`}>
                          {plant.currentImage ? (
                            <img 
                              src={plant.currentImage} 
                              alt={plant.nickname} 
                              className="w-full h-full object-cover object-center scale-150"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Leaf className="w-6 h-6 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="mt-2 text-center w-20">
                          <div className="text-xs font-medium text-foreground leading-tight">
                            {plant.nickname || plant.plantDetails.common_name}
                          </div>
                          <div className="text-xs text-muted-foreground leading-tight mt-0.5">
                            {plant.plantDetails.plant_type}
                          </div>
                        </div>
                        
                        {/* Dropdown Menu - only show when not in edit mode */}
                        {!isEditMode && selectedPlantId === plant._id && (
                          <div 
                            className="fixed z-[60] bg-background border border-border rounded-lg shadow-lg py-1 min-w-[140px]"
                            style={{
                              top: `${dropdownPosition.top}px`,
                              left: `${dropdownPosition.left}px`
                            }}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleShowDetails(plant);
                              }}
                              className="w-full px-3 py-2 text-sm text-foreground hover:bg-accent flex items-center gap-2"
                            >
                              <Eye className="w-4 h-4" />
                              Open Details
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLogInfo(plant);
                              }}
                              className="w-full px-3 py-2 text-sm text-foreground hover:bg-accent flex items-center gap-2"
                            >
                              <FileText className="w-4 h-4" />
                              Log Info
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePlant(plant);
                              }}
                              className="w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    // Empty space placeholder - only show in edit mode
                    isEditMode && (
                      <div className="flex items-center justify-center w-full min-h-[120px] border-2 border-dashed border-muted-foreground/30 rounded-lg">
                        <span className="text-muted-foreground text-sm">Drop plants here or leave empty</span>
                      </div>
                    )
                  )}
                </div>
              </ScrollArea>
            </div>
          );
        })}
        
        {plants.length === 0 && (
          <div className="text-center py-12 px-6">
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
              <Leaf className="w-12 h-12 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No Plants Yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">Start your garden journey by adding your first plant!</p>
            <Button onClick={handleAddPlant} className="bg-primary hover:bg-primary/90 min-h-[44px] px-6">
              <Camera className="w-4 h-4 mr-2" />
              Add Your First Plant
            </Button>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="relative flex flex-col h-screen w-full bg-background text-foreground overflow-hidden">
        {/* Header */}
        <div className="w-full bg-background shadow-sm sticky top-0 z-10 border-b border-border">
          <div className="flex items-center justify-between px-4 py-3">
            <h1 className="text-lg font-semibold text-primary">Plants</h1>
            <div className="flex items-center space-x-2">
              <div className="w-20 h-8 bg-muted rounded animate-pulse" />
              <div className="w-20 h-8 bg-muted rounded animate-pulse" />
              <div className="w-8 h-8 bg-muted rounded animate-pulse" />
            </div>
          </div>
        </div>
        
        {/* Loading Content */}
        <div className="flex-1 overflow-auto pb-24 p-4">
          <div className="space-y-6">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="space-y-3">
                <div className="w-32 h-6 bg-muted rounded animate-pulse" />
                <div className="flex space-x-4">
                  {Array.from({ length: 3 }, (_, j) => (
                    <div key={j} className="flex flex-col items-center">
                      <div className="w-20 h-20 bg-muted rounded-xl animate-pulse" />
                      <div className="w-16 h-4 bg-muted rounded mt-2 animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <FooterNavigation activeTab="plants" onNavigate={() => {}} />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-screen w-full bg-background text-foreground overflow-hidden">
      {/* Header */}
      <div className="w-full bg-background shadow-sm sticky top-0 z-10 border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold text-primary">Plants</h1>
          
          {plants.length > 0 && (
          <div className="flex items-center space-x-2">
          {!isEditMode ? (
            <>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleAddPlant}
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">Add Plant</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleLogCare}
            >
              <ClipboardList className="w-4 h-4" />
              <span className="text-sm">Log Care</span>
            </Button>
              {/* Edit Plants Button */}
            <Button
                variant="outline"
              size="sm"
                onClick={handleEditMode}
              >
                <Edit3 className="w-4 h-4" />
                <span className="text-sm">Edit</span>
              </Button>
            </>
          ) : (
            <>
              {/* Add Space Button in Edit Mode */}
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleAddSpace}
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm">Space</span>
              </Button>
              {/* Apply Button */}
              <Button
                variant="default"
                size="sm"
                onClick={handleApplyChanges}
                className="bg-primary text-primary-foreground"
              >
                <Check className="w-4 h-4" />
                <span className="text-sm">Apply</span>
              </Button>
            </>
          )}
        </div>
          )}
      </div>
      
      {/* Edit Mode Banner */}
      {isEditMode && (
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-primary font-medium">
              {selectedPlantsForDeletion.size > 0 
                ? `${selectedPlantsForDeletion.size} plant(s) selected for deletion`
                : "Drag plants to move them between spaces or select plants to delete"
              }
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditMode(false)}
              className="text-primary hover:text-primary/80"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
    
    {/* Main Content */}
    <div className="flex-1 overflow-auto pb-24" style={{ overflowY: 'auto', overflowX: 'visible' }}>
      <div className="py-4">
        {renderPlantsLayout()}
      </div>
    </div>
    
    {/* Add Space Modal */}
    {showAddSpaceModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
        <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-md">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Add New Space</h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="spaceName" className="block text-sm font-medium text-foreground mb-2">
                  Space Name
                </label>
                <input
                  id="spaceName"
                  type="text"
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  placeholder="e.g., Living Room, Balcony, Garden..."
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateSpace();
                    } else if (e.key === 'Escape') {
                      handleCancelAddSpace();
                    }
                  }}
                />
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  variant="outline"
                  onClick={handleCancelAddSpace}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateSpace}
                  disabled={!newSpaceName.trim()}
                  className="bg-primary hover:bg-primary/90"
                >
                  Add Space
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Rename Space Modal */}
    {showRenameSpaceModal && spaceToRename && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
        <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-md">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Rename Space</h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="renameSpaceName" className="block text-sm font-medium text-foreground mb-2">
                  Space Name
                </label>
                <input
                  id="renameSpaceName"
                  type="text"
                  value={renameSpaceName}
                  onChange={(e) => setRenameSpaceName(e.target.value)}
                  placeholder="Enter new space name..."
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      confirmRenameSpace();
                    } else if (e.key === 'Escape') {
                      cancelRenameSpace();
                    }
                  }}
                />
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  variant="outline"
                  onClick={cancelRenameSpace}
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmRenameSpace}
                  disabled={!renameSpaceName.trim()}
                  className="bg-primary hover:bg-primary/90"
                >
                  Rename Space
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Delete Space Confirmation Modal */}
    {showDeleteSpaceModal && spaceToDelete && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
        <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-md">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Delete Space</h2>
            
            <div className="mb-4">
              <p className="text-muted-foreground mb-2">
                Are you sure you want to delete this space?
              </p>
              <div className="bg-muted/30 rounded-lg p-3 border">
                <p className="font-medium text-foreground">
                  {getSpaceName(spaceToDelete)}
                </p>
              </div>
              <p className="text-sm text-amber-600 mt-2">
                All plants in this space will be moved to "Unassigned Plants".
              </p>
            </div>
            
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={cancelDeleteSpace}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDeleteSpace}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Space
              </Button>
            </div>
          </div>
        </div>
      </div>
    )}
    
    {/* Delete Plant Confirmation Modal */}
    {showDeleteConfirmModal && plantToDelete && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
        <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-md">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Delete Plant</h2>
            
            <div className="mb-4">
              <p className="text-muted-foreground mb-2">
                Are you sure you want to delete this plant?
              </p>
              <div className="bg-muted/30 rounded-lg p-3 border">
                <div className="flex items-center space-x-3">
                  {plantToDelete.currentImage ? (
                    <img 
                      src={plantToDelete.currentImage} 
                      alt={plantToDelete.nickname} 
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                      <Leaf className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-foreground">
                      {plantToDelete.nickname || plantToDelete.plantDetails.common_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {plantToDelete.plantDetails.plant_type}
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-sm text-red-600 mt-2">
                This action cannot be undone. All plant data and history will be permanently deleted.
              </p>
            </div>
            
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={cancelDeletePlant}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDeletePlant}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Plant
              </Button>
            </div>
          </div>
        </div>
      </div>
    )}
    
    {/* Bottom Navigation */}
    <FooterNavigation 
      activeTab="plants"
      onNavigate={(page) => {
        if (page === 'home') navigate('/home');
        else if (page === 'track') navigate('/track');
        else if (page === 'ai') toast({ title: "Arth AI", description: "Coming soon!" });
        // No need to navigate for 'plants' as we're already here
      }}
    />

    {/* Add Plant Modal */}
    <AddPlantModal 
      isOpen={showAddPlantModal}
      onClose={() => setShowAddPlantModal(false)}
      spaces={userPreferences?.growingSpaces?.map(space => ({ 
        id: space.id, 
        name: space.name || 'Unnamed Space'
      })) || []}
      onPlantAdded={(plantId) => {
        setShowAddPlantModal(false);
        
        if (plantId) {
          // Navigate to PlantLogs page for the newly added plant
          console.log('Navigating to plant-logs with ID:', plantId);
          navigate(`/plant-logs/${plantId}`);
        } else {
          // Fallback: refresh plants list if no plant ID provided
          const refreshPlants = async () => {
            if (!currentUser) return;
            
            try {
              const response = await fetch(`/.netlify/functions/tracked-plants?userId=${currentUser.uid}`, {
                headers: {
                  'Authorization': `Bearer ${await currentUser.getIdToken()}`
                }
              });
              
              if (response.status === 404) {
                setPlants([]);
                return;
              }
              
              if (!response.ok) {
                console.warn('Plants service unavailable:', response.status);
                return;
              }
              
              const data = await response.json();
              setPlants(Array.isArray(data) ? data : []);
            } catch (error) {
              console.error('Error refreshing plants:', error);
            }
          };
          
          refreshPlants();
        }
      }}
    />
  </div>
);
};

export default PlantsPage; 