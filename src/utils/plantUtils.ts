export const getPlantType = (ancestors: Array<{ name: string; rank: string }>): string => {
  const typeMap: { [key: string]: string } = {
    'angiosperms': 'Flowering Plant',
    'eudicots': 'Flowering Plant',
    'monocots': 'Flowering Plant',
    'asterids': 'Flowering Plant',
    'rosids': 'Flowering Plant',
    'magnoliids': 'Flowering Plant',
    'gymnosperms': 'Conifer',
    'ferns': 'Fern',
    'mosses': 'Moss',
    'algae': 'Algae',
    'fungi': 'Fungus',
    'solanales': 'Vegetable/Fruit',
    'fabales': 'Legume',
    'poales': 'Grass/Grain',
    'asparagales': 'Ornamental',
    'arecales': 'Palm',
    'pinales': 'Conifer',
    'lamiales': 'Herb/Ornamental'
  };

  for (const ancestor of ancestors) {
    const name = ancestor.name.toLowerCase();
    for (const [key, value] of Object.entries(typeMap)) {
      if (name.includes(key)) {
        return value;
      }
    }
  }

  return 'Plant';
};

export const formatScientificName = (name: string): string => {
  return name
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}; 