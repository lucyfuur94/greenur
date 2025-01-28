interface PlantSearchResult {
  id: number;
  name: string;
  preferred_common_name?: string;
  rank: string;
  establishment_means?: string;
  preferred_establishment_means?: string;
  default_photo?: {
    medium_url: string;
  };
  iconic_taxon_name: string;
  scientific_name?: string;
  ancestors: Array<{
    name: string;
    rank: string;
  }>;
}

export interface PlantDetails {
  id: number;
  name: string;
  preferred_common_name?: string;
  wikipedia_url?: string;
  rank: string;
  establishment_means?: string;
  preferred_establishment_means?: string;
  default_photo?: {
    medium_url: string;
    large_url: string;
  };
  images?: Array<{
    url: string;
    attribution?: string;
    license_code?: string;
  }>;
  ancestors?: Array<{
    name: string;
    rank: string;
  }>;
  observations_count?: number;
  complete_species_count?: number;
  native_status_in_place?: string;
  conservation_status?: {
    status: string;
    description: string;
  };
  wikipedia_summary?: string;
  description?: string;
  url?: string;
  light?: string;
  watering?: string;
}

interface SearchResponse {
  total_results: number;
  page: number;
  per_page: number;
  results: PlantSearchResult[];
}

export const searchPlants = async (query: string, page: number = 1): Promise<SearchResponse> => {
  const response = await fetch(
    `https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(query)}&per_page=100&page=${page}&iconic_taxa=Plantae&order=desc&order_by=observations_count&locale=en&preferred_place_id=1`
  );

  if (!response.ok) {
    throw new Error('Failed to search plants');
  }

  const data = await response.json();
  
  // Filter results to only include plants with images and matching common names
  const filteredResults = data.results
    .filter((result: any) => {
      const searchTerm = query.toLowerCase();
      const commonName = result.preferred_common_name?.toLowerCase() || '';
      return (
        result.iconic_taxon_name === "Plantae" && // Ensure it's a plant
        result.default_photo && // Has an image
        commonName.includes(searchTerm) // Matches search term
      );
    })
    .map((result: any) => ({
      ...result,
      preferred_common_name: result.preferred_common_name ? 
        result.preferred_common_name
          .toLowerCase()
          .split(' ')
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ') : 
        undefined,
      name: result.name
        .toLowerCase()
        .split(' ')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    }));

  return {
    ...data,
    results: filteredResults,
    total_results: filteredResults.length
  };
};

export const getPlantDetails = async (id: number): Promise<PlantDetails> => {
  try {
    const response = await fetch(
      `https://api.inaturalist.org/v1/taxa/${id}?all_photos=true`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch plant details');
    }

    const data = await response.json();
    if (!data.results || data.results.length === 0) {
      throw new Error('Plant not found');
    }

    const details = data.results[0];
    
    // Process all available photos
    const allPhotos = details.taxon_photos || [];
    details.images = allPhotos.map((photo: any) => ({
      url: photo.photo.large_url || photo.photo.medium_url || photo.photo.url,
      attribution: photo.photo.attribution,
      license_code: photo.photo.license_code
    }));
    
    // Ensure we have the default photo URLs
    if (details.default_photo) {
      details.default_photo = {
        medium_url: details.default_photo.medium_url || details.default_photo.url,
        large_url: details.default_photo.large_url || details.default_photo.medium_url || details.default_photo.url
      };
    }

    return details;
  } catch (error) {
    console.error('Error fetching plant details:', error);
    throw error;
  }
}; 