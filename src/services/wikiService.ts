// Interfaces for Trefle API responses
interface TreflePlant {
  id: number;
  common_name: string;
  scientific_name: string;
  family: string;
  family_common_name: string;
  image_url: string;
  year: number;
  bibliography: string;
  author: string;
  rank: string;
  genus: string;
}

interface TrefleSearchResponse {
  data: TreflePlant[];
  links: {
    self: string;
    first: string;
    next: string;
    last: string;
  };
  meta: {
    total: number;
  };
}

interface TreflePlantDetails extends TreflePlant {
  main_species: {
    growth: {
      light: number;
      atmospheric_humidity: number;
      minimum_temperature: { deg_c: number };
      maximum_temperature: { deg_c: number };
      soil_nutriments: number;
      soil_humidity: number;
    };
    specifications: {
      growth_habit: string;
      growth_form: string;
      growth_rate: string;
      average_height: { cm: number };
    };
    distribution: {
      native: string[];
    };
  };
  images: {
    flower: { image_url: string }[];
    leaf: { image_url: string }[];
    habit: { image_url: string }[];
    fruit: { image_url: string }[];
    bark: { image_url: string }[];
  };
}

export interface PlantSearchResult {
  name: string;
  scientificName: string;
  type: string;
  wikiDataId: string;
  score: number;
  image?: string;
  hindiName?: string;
}

export interface PlantDetails {
  name: string;
  scientificName: string;
  family: string;
  description: string;
  type: string;
  nativeTo: string[];
  growthHabit: string;
  careInstructions: {
    light: string;
    water: string;
    soil: string;
    temperature: string;
    humidity: string;
  };
  images: string[];
  hindiName?: string;
}

export const searchPlants = async (searchTerm: string): Promise<PlantSearchResult[]> => {
  try {
    if (searchTerm.length < 2) return [];

    console.log(`[Plant Service] Searching for: ${searchTerm}`);
    
    const response = await fetch(
      `/.netlify/functions/trefle-api/plants/search?q=${encodeURIComponent(searchTerm)}`
    );

    if (!response.ok) {
      throw new Error('Failed to search plants');
    }

    const data = await response.json() as TrefleSearchResponse;
    console.log(`[Plant Service] Found ${data.meta.total} results`);

    // Map Trefle results to our format
    return data.data.map((plant, index) => ({
      name: plant.common_name || plant.scientific_name,
      scientificName: plant.scientific_name,
      type: plant.family_common_name || plant.family || 'Plant',
      wikiDataId: plant.id.toString(),
      score: 1 - (index * 0.1),
      image: plant.image_url
    }));

  } catch (error) {
    console.error('[Plant Service] Error searching plants:', error);
    throw error;
  }
};

export const getPlantDetails = async (plantId: string): Promise<PlantDetails> => {
  try {
    const response = await fetch(
      `/.netlify/functions/trefle-api/plants/${plantId}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch plant details');
    }

    const data = await response.json() as { data: TreflePlantDetails };
    const plant = data.data;
    const species = plant.main_species;

    // Convert light level to descriptive text
    const getLightText = (light: number) => {
      if (light >= 8) return 'Full sun';
      if (light >= 6) return 'Partial sun';
      if (light >= 4) return 'Partial shade';
      return 'Full shade';
    };

    // Collect all available images
    const allImages = [
      plant.image_url,
      ...(plant.images?.flower?.map(i => i.image_url) || []),
      ...(plant.images?.leaf?.map(i => i.image_url) || []),
      ...(plant.images?.habit?.map(i => i.image_url) || []),
      ...(plant.images?.fruit?.map(i => i.image_url) || []),
      ...(plant.images?.bark?.map(i => i.image_url) || [])
    ].filter(Boolean);

    return {
      name: plant.common_name || plant.scientific_name,
      scientificName: plant.scientific_name,
      family: plant.family,
      description: `${plant.scientific_name} is a ${species?.specifications?.growth_form || ''} plant from the ${plant.family} family.`,
      type: plant.family_common_name || plant.family,
      nativeTo: species?.distribution?.native || [],
      growthHabit: species?.specifications?.growth_habit || '',
      careInstructions: {
        light: getLightText(species?.growth?.light || 0),
        water: `Soil humidity: ${species?.growth?.soil_humidity || 'Unknown'}`,
        soil: `Nutriment requirements: ${species?.growth?.soil_nutriments || 'Unknown'}`,
        temperature: species?.growth?.minimum_temperature?.deg_c !== undefined ? 
          `${species.growth.minimum_temperature.deg_c}°C to ${species.growth.maximum_temperature?.deg_c || '?'}°C` : 
          'Temperature requirements unknown',
        humidity: `Atmospheric humidity: ${species?.growth?.atmospheric_humidity || 'Unknown'}`
      },
      images: allImages
    };
  } catch (error) {
    console.error('[Plant Service] Error fetching plant details:', error);
    throw error;
  }
}; 