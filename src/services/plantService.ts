interface OpenFarmGuide {
  name: string;
  overview: string;
  sun_requirements: string;
  soil_requirements: string;
  water_requirements: string;
  growing_degree_days: number;
}

export const fetchOpenFarmData = async (plantName: string): Promise<OpenFarmGuide | null> => {
  try {
    const response = await fetch(
      `/.netlify/functions/get-openfarm?q=${encodeURIComponent(plantName)}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch OpenFarm data');
    }

    const data = await response.json();
    if (!data.data || data.data.length === 0) {
      return null;
    }

    const guide = data.data[0].attributes;
    return {
      name: guide.name,
      overview: guide.overview,
      sun_requirements: guide.sun_requirements,
      soil_requirements: guide.soil_requirements,
      water_requirements: guide.water_requirements,
      growing_degree_days: guide.growing_degree_days
    };
  } catch (error) {
    console.error('Error fetching OpenFarm data:', error);
    return null;
  }
}; 