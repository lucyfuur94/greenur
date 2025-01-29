import { getPlantType, formatScientificName } from '../utils/plantUtils';

<Flex align="center" mb={4}>
  <Heading size="xl" mr={2}>
    {formatScientificName(plant.commonName)}
  </Heading>
</Flex>

const fetchPlantDetails = async (plantId: string) => {
  try {
    const response = await fetch(`https://api.inaturalist.org/v1/taxa/${plantId}`);
    const data = await response.json();
    const plantData = data.results[0];
    
    return {
      id: plantData.id,
      commonName: formatScientificName(plantData.preferred_common_name || plantData.name),
      scientificName: formatScientificName(plantData.name),
      type: getPlantType(plantData.ancestors || []),
      // ... other fields
    };
  } catch (error) {
    console.error('Error fetching plant details:', error);
  }
}; 