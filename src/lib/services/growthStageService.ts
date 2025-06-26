// Growth stage image data types
export interface GrowthStageImage {
  _id: string;
  plantType: string;
  stageName: string;
  stageDescription: string;
  imageUrl: string;
  firebasePath: string;
  stageOrder: number;
  durationDays: { min: number; max: number };
  totalDaysFromStart: { start: number; end: number };
  care: string[];
  commonIssues: string[];
  indicators: string[];
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
    return ['tomato', 'pepper', 'lettuce', 'basil', 'sunflower', 'aloe'];
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
      ],
      pepper: [
        { name: 'germination', description: 'Pepper seed germination and early sprouting', order: 1 },
        { name: 'seedling', description: 'Young pepper plant development', order: 2 },
        { name: 'vegetative_growth', description: 'Rapid vegetative development and branching', order: 3 },
        { name: 'flowering', description: 'Flower bud formation and blooming', order: 4 },
        { name: 'fruiting', description: 'Pepper fruit development and growth', order: 5 },
        { name: 'ripening', description: 'Pepper fruit maturation and harvest', order: 6 }
      ],
      lettuce: [
        { name: 'germination', description: 'Lettuce seed germination', order: 1 },
        { name: 'seedling', description: 'Early lettuce leaf development', order: 2 },
        { name: 'vegetative_growth', description: 'Rapid leaf growth and head formation', order: 3 },
        { name: 'maturity', description: 'Harvest-ready lettuce', order: 4 }
      ],
      basil: [
        { name: 'germination', description: 'Basil seed germination and emergence', order: 1 },
        { name: 'seedling', description: 'Young basil plant establishment', order: 2 },
        { name: 'vegetative_growth', description: 'Rapid leaf production and bush development', order: 3 },
        { name: 'harvest', description: 'Continuous leaf harvest period', order: 4 }
      ],
      sunflower: [
        { name: 'germination', description: 'Sunflower seed germination', order: 1 },
        { name: 'seedling', description: 'Young sunflower establishment', order: 2 },
        { name: 'vegetative_growth', description: 'Rapid height increase and leaf development', order: 3 },
        { name: 'budding', description: 'Flower bud formation and development', order: 4 },
        { name: 'flowering', description: 'Full bloom and pollination', order: 5 },
        { name: 'seed_maturation', description: 'Seed development and harvest', order: 6 }
      ],
      aloe: [
        { name: 'propagation', description: 'Aloe offset or leaf propagation', order: 1 },
        { name: 'establishment', description: 'Root development and early growth', order: 2 },
        { name: 'juvenile_growth', description: 'Active leaf production and size increase', order: 3 },
        { name: 'maturity', description: 'Adult plant with potential for flowering', order: 4 }
      ]
    };

    return stageDefinitions[plantType.toLowerCase()] || [];
  }

  /**
   * Get stage details including duration and care instructions from database
   */
  async getStageDetails(plantType: string, stageName: string): Promise<GrowthStageImage | null> {
    try {
      const response = await this.getStageImages(plantType, stageName);
      
      if (response.success && response.data && response.data.length > 0) {
        return response.data[0]; // Return the first (and should be only) stage data
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching stage details:', error);
      return null;
    }
  }

  /**
   * Get static growth stage details (replaces OpenAI-based function)
   */
  async getStaticStageDetails(plantType: string, stageName: string): Promise<{
    stage: string;
    description: string;
    order: number;
    duration: string;
    totalDaysFromStart: string;
    durationDays: { min: number; max: number };
    totalDaysFromStartObject: { start: number; end: number };
    care: string[];
    issues: string[];
    indicators: string[];
    plantType: string;
    imageUrl?: string;
  } | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/get-static-growth-stage-details?plantType=${encodeURIComponent(plantType)}&stageName=${encodeURIComponent(stageName)}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        return data.details;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching static stage details:', error);
      return null;
    }
  }

  /**
   * Get duration information for a specific stage
   */
  async getStageDuration(plantType: string, stageName: string): Promise<{ min: number; max: number; totalDaysFromStart: { start: number; end: number } } | null> {
    const stageDetails = await this.getStageDetails(plantType, stageName);
    
    if (stageDetails) {
      return {
        min: stageDetails.durationDays.min,
        max: stageDetails.durationDays.max,
        totalDaysFromStart: stageDetails.totalDaysFromStart
      };
    }
    
    return null;
  }

  /**
   * Get care instructions for a specific stage
   */
  async getStageCare(plantType: string, stageName: string): Promise<{
    care: string[];
    commonIssues: string[];
    indicators: string[];
  } | null> {
    const stageDetails = await this.getStageDetails(plantType, stageName);
    
    if (stageDetails) {
      return {
        care: stageDetails.care,
        commonIssues: stageDetails.commonIssues,
        indicators: stageDetails.indicators
      };
    }
    
    return null;
  }

  /**
   * Get complete growth timeline for a plant type
   */
  async getPlantTimeline(plantType: string): Promise<Array<{
    stageName: string;
    stageDescription: string;
    order: number;
    durationDays: { min: number; max: number };
    totalDaysFromStart: { start: number; end: number };
  }> | null> {
    try {
      const response = await this.getPlantGrowthStages(plantType);
      
      if (response.success && response.stages) {
        const timeline: Array<{
          stageName: string;
          stageDescription: string;
          order: number;
          durationDays: { min: number; max: number };
          totalDaysFromStart: { start: number; end: number };
        }> = [];
        
        // Extract timeline data from all stages
        Object.values(response.stages).forEach(stageImages => {
          if (stageImages.length > 0) {
            const stage = stageImages[0]; // Take first image data for stage info
            timeline.push({
              stageName: stage.stageName,
              stageDescription: stage.stageDescription,
              order: stage.stageOrder,
              durationDays: stage.durationDays,
              totalDaysFromStart: stage.totalDaysFromStart
            });
          }
        });
        
        // Sort by stage order
        timeline.sort((a, b) => a.order - b.order);
        
        return timeline;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching plant timeline:', error);
      return null;
    }
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