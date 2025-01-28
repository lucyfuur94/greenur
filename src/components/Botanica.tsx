// Add missing imports at the top
import { useState, useEffect } from 'react';
import { 
  Button, 
  ModalFooter,
  useDisclosure
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';

// Update state definitions
interface PlantAnalysis {
  commonName: string;
  scientificName: string;
  problems?: string;
  treatment?: string;
}

// Update component function
const Botanica = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const navigate = useNavigate();
  
  // Update state declarations
  const [lastError, setLastError] = useState<{
    message: string;
    timestamp: number;
  } | null>(null);
  
  const [analysisResult, setAnalysisResult] = useState<PlantAnalysis | null>(null);
  const [showAnalysisPopup, setShowAnalysisPopup] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null); // Renamed from error

  // Update error handling
  const handleImageSelect = async (file: File) => {
    try {
      setLastError(null);
      setAnalysisResult(null);
      
      const response = await fetch('/.netlify/functions/analyze-plant', {
        method: 'POST',
        body: file
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error.includes('Unsupported image format')
          ? 'Unsupported image format. Please use JPEG or PNG.'
          : 'Failed to analyze plant. Please try again.';
        setSearchError(errorMessage);
        setLastError({ message: errorMessage, timestamp: Date.now() });
        return;
      }

      const data = await response.json().catch(() => null);
      
      if (!data?.analysis) {
        throw new Error(data?.error || 'Analysis failed');
      }

      // Parse and validate analysis
      const analysis: PlantAnalysis = JSON.parse(data.analysis);
      if (!analysis.commonName || !analysis.scientificName) {
        throw new Error('Incomplete analysis data');
      }

      setAnalysisResult(analysis);
      setShowAnalysisPopup(true);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Analysis failed';
      console.error('Error context:', {
        error: errorMessage,
        file: file?.name
      });
      setLastError({ message: errorMessage, timestamp: Date.now() });
    }
  };

  // Remove unused useEffect
  // Add proper type to state updates
  const updateAnalysisResult = (updateFn: (prev: PlantAnalysis | null) => PlantAnalysis | null) => {
    setAnalysisResult(prev => updateFn(prev));
  };

  // In JSX return
  <ModalFooter>
    <Button 
      colorScheme="green"
      onClick={() => {
        if (analysisResult?.commonName) {
          navigate(`/search?q=${encodeURIComponent(analysisResult.commonName)}`);
          onClose();
        }
      }}
    >
      Search {analysisResult?.commonName}
    </Button>
  </ModalFooter>
}; 