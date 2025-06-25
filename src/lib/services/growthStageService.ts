// Growth stage image data types
export interface GrowthStageImage {
  _id: string;
  plantType: string;
  stageName: string;
  stageDescription: string;
  imageUrl: string;
  firebasePath: string;
  stageOrder: number;
  uploadedAt: string;
  uploadedBy?: string;
  metadata: {
    originalFileName: string;
    fileSize: number;
    contentType: string;
  };
}

export interface GrowthStageResponse {
  success: boolean;
  plantType?: string;
  stageCount?: number;
  totalImages?: number;
  stages?: Record<string, GrowthStageImage[]>;
  count?: number;
  data?: GrowthStageImage[];
}

export class GrowthStageService {
  private baseUrl = '/.netlify/functions';

  /**
   * Get all growth stage images for a specific plant type
   */
  async getPlantGrowthStages(plantType: string): Promise<GrowthStageResponse> {
    try {
      const response = await fetch(
        `${this.baseUrl}/get-growth-stage-images?plantType=${encodeURIComponent(plantType)}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching plant growth stages:', error);
      throw error;
    }
  }

  /**
   * Get images for a specific growth stage
   */
  async getStageImages(plantType: string, stageName: string): Promise<GrowthStageResponse> {
    try {
      const response = await fetch(
        `${this.baseUrl}/get-growth-stage-images?plantType=${encodeURIComponent(plantType)}&stageName=${encodeURIComponent(stageName)}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching stage images:', error);
      throw error;
    }
  }

  /**
   * Get all growth stage images (no filtering)
   */
  async getAllGrowthStages(limit: number = 50): Promise<GrowthStageResponse> {
    try {
      const response = await fetch(
        `${this.baseUrl}/get-growth-stage-images?limit=${limit}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching all growth stages:', error);
      throw error;
    }
  }

  /**
   * Upload a new growth stage image
   */
  async uploadGrowthStageImage(
    file: File,
    plantType: string,
    stageName: string,
    uploadedBy?: string
  ): Promise<any> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('plantType', plantType);
      formData.append('stageName', stageName);
      formData.append('contentType', file.type);
      
      if (uploadedBy) {
        formData.append('uploadedBy', uploadedBy);
      }

      const response = await fetch(
        `${this.baseUrl}/upload-growth-stage-images`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error uploading growth stage image:', error);
      throw error;
    }
  }

  /**
   * Get available plant types (from the predefined list)
   */
  getAvailablePlantTypes(): string[] {
    return ['tomato']; // Can be expanded as more plant types are added
  }

  /**
   * Get growth stage names for a plant type
   */
  getPlantStages(plantType: string): Array<{ name: string; description: string; order: number }> {
    const stageDefinitions: Record<string, Array<{ name: string; description: string; order: number }>> = {
      tomato: [
        { name: 'germination', description: 'Seed germination and early sprouting', order: 1 },
        { name: 'seedling', description: 'Young plant with first true leaves', order: 2 },
        { name: 'vegetative_growth', description: 'Rapid growth and leaf development', order: 3 },
        { name: 'flowering', description: 'Flower buds and blooming stage', order: 4 },
        { name: 'fruiting', description: 'Fruit formation and development', order: 5 },
        { name: 'ripening', description: 'Fruit maturation and ripening', order: 6 }
      ]
    };

    return stageDefinitions[plantType.toLowerCase()] || [];
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get the next stage after the current one
   */
  getNextStage(plantType: string, currentStage: string): string | null {
    const stages = this.getPlantStages(plantType);
    const currentIndex = stages.findIndex(stage => stage.name === currentStage);
    
    if (currentIndex === -1 || currentIndex === stages.length - 1) {
      return null; // Stage not found or it's the last stage
    }
    
    return stages[currentIndex + 1].name;
  }

  /**
   * Get the previous stage before the current one
   */
  getPreviousStage(plantType: string, currentStage: string): string | null {
    const stages = this.getPlantStages(plantType);
    const currentIndex = stages.findIndex(stage => stage.name === currentStage);
    
    if (currentIndex <= 0) {
      return null; // Stage not found or it's the first stage
    }
    
    return stages[currentIndex - 1].name;
  }
}

// Export a singleton instance
export const growthStageService = new GrowthStageService(); 