export interface PlantAnalysis {
  commonName: string;
  scientificName: string;
  plantType?: string;
  growthStage?: string;
  growingConditions?: string;
  carePlan?: string;
  problems?: string;
  treatment?: string;
}

export interface PlantDetails {
  id: number;
  name: string;
  preferred_common_name?: string;
  ancestors?: any[];
  default_photo?: {
    medium_url?: string;
  };
  taxon_photos?: Array<{
    photo: {
      medium_url: string;
      attribution?: string;
      license_code?: string;
    };
  }>;
  matched_term?: string;
  names?: Array<{
    name: string;
    lexicon: string;
    is_valid: boolean;
    position?: number;
  }>;
}

/**
 * Example iNaturalist response:
 * {
 *   "id": 12345,
 *   "name": "Rosa rubiginosa",
 *   "preferred_common_name": "Sweet Briar Rose"
 * }
 */
export interface PlantIdentification {
  // ... existing interface
} 