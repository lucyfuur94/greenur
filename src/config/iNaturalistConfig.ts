export const INATURALIST_API_CONFIG = {
  BASE_URL: 'https://api.inaturalist.org/v1',
  TAXA_PARAMS: {
    is_active: true,
    taxon_id: [47126, 47104, 47434, 48626, 47122, 47440, 47605, 47448, 47450],
    rank: ['species'],
    rank_level: 10,
    per_page: 9,
    locale: 'en',
    order: 'desc',
    order_by: 'observations_count',
    all_names: true
  },
  SEARCH_SUGGESTIONS_PARAMS: {
    is_active: true,
    taxon_id: [47126, 47104, 47434, 48626, 47122, 47440, 47605, 47448, 47450],
    rank: ['species'],
    rank_level: 10,
    per_page: 10,
    locale: 'en',
    order: 'desc',
    order_by: 'observations_count',
    all_names: true
  }
}; 