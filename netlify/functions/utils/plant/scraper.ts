import axios from 'axios'

type Dict<T> = { [key: string]: T }

const USER_AGENT = 'GreenurBot/1.0 (https://github.com/greenur/greenur; contact@greenur.com) Python/3.13'
const WIKIDATA_API_BASE = 'https://www.wikidata.org/w/api.php'

export async function get_wikidata_entity_id(name: string): Promise<string | null> {
  const search_variations = [
    name,
    `${name} (plant)`,
    `${name} plant`,
    `${name} species`,
    `${name} genus`,
    `${name} herb`,
    `${name} tree`,
    `${name} flower`,
    `${name} medicinal`,
  ]

  for (const search_term of search_variations) {
    const params = {
      action: 'wbsearchentities',
      format: 'json',
      language: 'en',
      search: search_term,
      limit: 20
    }

    try {
      const response = await axios.get(WIKIDATA_API_BASE, { params })
      const data = response.data

      if (data.search && data.search.length > 0) {
        const plant_terms = [
          'plant', 'species', 'genus', 'tree', 'herb', 'flower',
          'medicinal', 'flowering', 'ornamental', 'succulent',
          'grass', 'vegetable', 'fruit', 'spice', 'aromatic'
        ]

        // First try exact match with plant-related description
        for (const result of data.search) {
          if (result.description) {
            const desc = result.description.toLowerCase()
            if (plant_terms.some(term => desc.includes(term))) {
              if (result.label?.toLowerCase() === name.toLowerCase()) {
                return result.id
              }
            }
          }
        }

        // Then try partial matches with plant-related description
        for (const result of data.search) {
          if (result.description) {
            const desc = result.description.toLowerCase()
            if (plant_terms.some(term => desc.includes(term))) {
              return result.id
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error searching for ${search_term}:`, error)
    }
  }

  return null
}

export async function get_entity_data(entity_id: string): Promise<Dict<any> | null> {
  try {
    const params = {
      action: 'wbgetentities',
      format: 'json',
      ids: entity_id,
      languages: 'en',
      props: 'claims|labels|descriptions'
    }

    const response = await axios.get(WIKIDATA_API_BASE, {
      params,
      headers: { 'User-Agent': USER_AGENT }
    })

    const data = response.data
    if (data.entities && data.entities[entity_id]) {
      return data.entities[entity_id]
    }
    return null
  } catch (error) {
    console.error(`Error getting entity data for ${entity_id}:`, error)
    return null
  }
}

export async function get_entity_labels(entity_id: string): Promise<Record<string, string>> {
  const INDIAN_LANGUAGES = [
    'hi', 'bn', 'te', 'mr', 'ta', 'ur', 'gu', 'kn',
    'ml', 'pa', 'or', 'as', 'mai', 'sa'
  ]

  try {
    const params = {
      action: 'wbgetentities',
      format: 'json',
      ids: entity_id,
      props: 'labels',
      languages: INDIAN_LANGUAGES.join('|')
    }

    const response = await axios.get(WIKIDATA_API_BASE, {
      params,
      headers: { 'User-Agent': USER_AGENT }
    })

    const data = response.data
    const translations: Record<string, string> = {}

    if (data.entities && data.entities[entity_id]) {
      const labels = data.entities[entity_id].labels || {}
      for (const lang of INDIAN_LANGUAGES) {
        if (labels[lang]) {
          translations[lang] = labels[lang].value
        }
      }
    }

    return translations
  } catch (error) {
    console.error(`Error getting labels for ${entity_id}:`, error)
    return {}
  }
}

export function get_scientific_name(entity_data: Dict<any>): string {
  try {
    const claims = entity_data.claims || {}

    // Try to get scientific name from P225 (taxon name)
    if (claims.P225) {
      for (const statement of claims.P225) {
        const mainsnak = statement.mainsnak
        if (mainsnak?.snaktype === 'value') {
          return mainsnak.datavalue?.value || ''
        }
      }
    }

    // Try to get from labels if available
    const labels = entity_data.labels || {}
    if (labels.la) { // Latin label
      return labels.la.value
    }

    return ''
  } catch (error) {
    console.error('Error getting scientific name:', error)
    return ''
  }
}

export function get_image_url(entity_data: Dict<any>): string {
  try {
    const claims = entity_data.claims || {}

    // Try to get image from P18 (image)
    if (claims.P18) {
      for (const statement of claims.P18) {
        const mainsnak = statement.mainsnak
        if (mainsnak?.snaktype === 'value') {
          const filename = mainsnak.datavalue?.value
          if (filename) {
            return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=300`
          }
        }
      }
    }

    return ''
  } catch (error) {
    console.error('Error getting image URL:', error)
    return ''
  }
}

export async function get_plant_type(entity_id: string, scientific_name: string | null): Promise<string> {
  try {
    const sparql_query = `
      SELECT ?type WHERE {
        wd:${entity_id} wdt:P31 ?class.
        ?class wdt:P279* ?type.
        VALUES ?type {
          wd:Q11004 # Herb
          wd:Q506 # Flower
          wd:Q23501 # Fruit
          wd:Q193647 # Tree
          wd:Q11369 # Grass
          wd:Q27744 # Succulent
          wd:Q188771 # Ornamental plant
        }
      }
      LIMIT 1
    `

    const params = {
      format: 'json',
      query: sparql_query
    }

    const response = await axios.get('https://query.wikidata.org/sparql', { params })
    const data = response.data

    if (data.results?.bindings?.length > 0) {
      const type_id = data.results.bindings[0].type.value.split('/').pop()
      const type_mapping: Record<string, string> = {
        'Q11004': 'Herb',
        'Q506': 'Flowering',
        'Q23501': 'Fruit/Vegetable',
        'Q193647': 'Tree',
        'Q11369': 'Grass',
        'Q27744': 'Succulent',
        'Q188771': 'Ornamental'
      }
      if (type_id && type_id in type_mapping) {
        return type_mapping[type_id]
      }
    }

    return 'Plant'
  } catch (error) {
    console.error('Error getting plant type:', error)
    return 'Plant'
  }
} 