import { INATURALIST_API_CONFIG } from '../config/iNaturalistConfig';

const toTitleCase = (str: string): string => {
  return str.replace(/\w\S*/g, (txt) => {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
};

interface INaturalistName {
  name: string;
  lexicon: string;
  is_valid: boolean;
  position?: number;
}

interface INaturalistTaxonResult {
  id: number;
  matched_term?: string;
  name: string;
  preferred_common_name?: string;
  default_photo?: {
    medium_url?: string;
  };
  ancestors?: any[];
  names?: INaturalistName[];
  taxon_photos?: Array<{
    photo: {
      url: string;
      medium_url: string;
      large_url: string;
      attribution?: string;
      license_code?: string;
    };
  }>;
}

interface INaturalistSearchResponse {
  results: INaturalistTaxonResult[];
  total_results: number;
}

export const getMatchedName = (result: INaturalistTaxonResult): { name: string; lexicon: string } => {
  if (!result.matched_term || !result.names) {
    return { name: toTitleCase(result.name), lexicon: 'unknown' };
  }

  const matchedName = result.names.find(n => 
    n.name.toLowerCase() === result.matched_term?.toLowerCase()
  );

  return matchedName 
    ? { name: toTitleCase(matchedName.name), lexicon: matchedName.lexicon }
    : { name: toTitleCase(result.matched_term), lexicon: 'unknown' };
};

const formatSecondaryText = (parts: string[]): string => {
  // Filter out empty strings and join with dots
  return parts.filter(Boolean).join(' • ');
};

export const formatDisplayName = (
  result: INaturalistTaxonResult,
  matchedName: { name: string; lexicon: string } | null,
  plantType: string
): { primary: string; secondary: string } => {
  const formattedPlantType = toTitleCase(plantType);

  // Handle case when matchedName is null (direct URL access)
  if (!matchedName) {
    return {
      primary: result.preferred_common_name ? toTitleCase(result.preferred_common_name) : toTitleCase(result.name),
      secondary: formatSecondaryText([formattedPlantType, result.name])
    };
  }

  const { name, lexicon } = matchedName;
  const formattedCommonName = result.preferred_common_name ? toTitleCase(result.preferred_common_name) : '';

  if (lexicon === 'english' || !matchedName) {
    return {
      primary: name,
      secondary: formatSecondaryText([formattedPlantType, result.name])
    };
  } else if (lexicon === 'scientific-names') {
    return {
      primary: `${name} (Scientific)`,
      secondary: formatSecondaryText([formattedCommonName, formattedPlantType])
    };
  } else {
    return {
      primary: `${name} (${toTitleCase(lexicon)})`,
      secondary: formatSecondaryText([formattedCommonName, formattedPlantType, result.name])
    };
  }
};

export const searchTaxa = async (
  searchQuery: string,
  page: number = 1,
  isSearchSuggestion: boolean = false
): Promise<INaturalistSearchResponse> => {
  try {
    const config = isSearchSuggestion 
      ? INATURALIST_API_CONFIG.SEARCH_SUGGESTIONS_PARAMS 
      : INATURALIST_API_CONFIG.TAXA_PARAMS;

    const params = new URLSearchParams({
      ...config,
      q: searchQuery.trim(),
      page: page.toString(),
    } as any);

    // Convert array parameters to multiple entries
    params.delete('taxon_id');
    config.taxon_id.forEach(id => {
      params.append('taxon_id[]', id.toString());
    });

    params.delete('rank');
    config.rank.forEach(rank => {
      params.append('rank[]', rank);
    });

    const response = await fetch(
      `${INATURALIST_API_CONFIG.BASE_URL}/taxa?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch taxa');
    }

    const data = await response.json();
    return {
      results: data.results,
      total_results: data.total_results
    };
  } catch (error) {
    console.error('Error searching taxa:', error);
    throw error;
  }
}; 