import Fuse from 'fuse.js';

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

interface WikiDataResult {
  item: { value: string };
  itemLabel: { value: string };
  scientificName?: { value: string };
  typeLabel: { value: string };
  image?: { value: string };
  hindiLabel?: { value: string };
}

// SPARQL query to search plants by name
const buildSearchQuery = (searchTerm: string) => `
  SELECT DISTINCT ?item ?itemLabel ?scientificName ?typeLabel ?image ?hindiLabel WHERE {
    {
      ?item wdt:P31/wdt:P279* wd:Q756 .  # instance of plant or subclass of plant
      {
        ?item rdfs:label ?label .
        FILTER(CONTAINS(LCASE(STR(?label)), LCASE("${searchTerm}")))
        FILTER(LANG(?label) = "en")
      } UNION {
        ?item wdt:P225 ?scientificName .
        FILTER(CONTAINS(LCASE(STR(?scientificName)), LCASE("${searchTerm}")))
      }
    }
    OPTIONAL { ?item wdt:P31 ?type }
    OPTIONAL { ?item wdt:P18 ?image }  # Add image property
    OPTIONAL { ?item rdfs:label ?hindiLabel . FILTER(LANG(?hindiLabel) = "hi") }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }
  LIMIT 50
`;

// SPARQL query to get detailed plant information
const buildDetailsQuery = (wikiDataId: string) => `
  SELECT ?item ?itemLabel ?scientificName ?familyLabel ?description ?nativeToLabel ?growthHabitLabel ?hindiLabel WHERE {
    BIND(wd:${wikiDataId} AS ?item)
    OPTIONAL { ?item wdt:P225 ?scientificName . }
    OPTIONAL { ?item wdt:P171 ?family . }
    OPTIONAL { ?item schema:description ?description FILTER(LANG(?description) = "en") . }
    OPTIONAL { ?item wdt:P183 ?nativeTo . }
    OPTIONAL { ?item wdt:P3485 ?growthHabit . }
    OPTIONAL { ?item rdfs:label ?hindiLabel . FILTER(LANG(?hindiLabel) = "hi") }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
  }
`;

export const searchPlants = async (searchTerm: string): Promise<PlantSearchResult[]> => {
  try {
    const url = new URL('https://query.wikidata.org/sparql');
    url.searchParams.append('query', buildSearchQuery(searchTerm));
    url.searchParams.append('format', 'json');
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Greenur Plant App (https://greenur.app)'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      throw new Error(`Failed to search plants: ${errorText}`);
    }

    const data = await response.json();
    const results = data.results.bindings as WikiDataResult[];

    if (!results.length) {
      return [];
    }

    // Use Fuse.js for better fuzzy matching
    const fuse = new Fuse(results, {
      keys: ['itemLabel.value', 'scientificName.value'],
      threshold: 0.4,
      includeScore: true,
      shouldSort: true
    });

    const searchResults = fuse.search(searchTerm);
    return searchResults.map(result => {
      const wikiDataId = result.item.item.value.split('/').pop();
      if (!wikiDataId) throw new Error('Invalid WikiData ID');
      
      return {
        name: result.item.itemLabel.value,
        scientificName: result.item.scientificName?.value || '',
        type: result.item.typeLabel?.value || 'Plant',
        wikiDataId,
        score: result.score || 1,
        image: result.item.image?.value || '',
        hindiName: result.item.hindiLabel?.value
      };
    });
  } catch (error) {
    console.error('Error searching plants:', error);
    throw error;
  }
};

export const getPlantDetails = async (wikiDataId: string): Promise<PlantDetails> => {
  try {
    // Fetch from Wikidata
    const url = new URL('https://query.wikidata.org/sparql');
    url.searchParams.append('query', buildDetailsQuery(wikiDataId));
    url.searchParams.append('format', 'json');
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Greenur Plant App (https://greenur.app)'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      throw new Error(`Failed to fetch plant details: ${errorText}`);
    }

    const data = await response.json();
    const result = data.results.bindings[0];

    if (!result) {
      throw new Error('Plant details not found');
    }

    // Also fetch Wikipedia summary for richer description
    const wikipediaResponse = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(result.itemLabel.value)}`
    );

    if (!wikipediaResponse.ok) {
      if (wikipediaResponse.status === 429) {
        throw new Error('Wikipedia rate limit exceeded. Please try again later.');
      }
      throw new Error('Failed to fetch Wikipedia data');
    }

    const wikipediaData = await wikipediaResponse.json();

    return {
      name: result.itemLabel.value,
      scientificName: result.scientificName?.value || '',
      family: result.familyLabel?.value || '',
      description: wikipediaData.extract || result.description?.value || 'No description available',
      type: result.typeLabel?.value || 'Plant',
      nativeTo: result.nativeToLabel ? [result.nativeToLabel.value] : [],
      growthHabit: result.growthHabitLabel?.value || '',
      careInstructions: {
        light: '',
        water: '',
        soil: '',
        temperature: '',
        humidity: ''
      },
      images: wikipediaData.originalimage ? [wikipediaData.originalimage.source] : [],
      hindiName: result.hindiLabel?.value
    };
  } catch (error) {
    console.error('Error fetching plant details:', error);
    throw error;
  }
}; 