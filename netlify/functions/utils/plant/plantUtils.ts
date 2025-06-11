import {
  get_wikidata_entity_id,
  get_entity_data,
  get_entity_labels,
  get_scientific_name,
  get_image_url,
  get_plant_type
} from './scraper'

export async function extract_plant_info(plant_id: number, plant_name: string) {
  const info = {
    _id: plant_id,
    common_name: plant_name,
    scientific_name: '',
    plant_type: '',
    names_in_languages: {},
    default_image_url: '',
    last_updated: new Date().toISOString()
  }

  try {
    // Get entity ID
    const entity_id = await get_wikidata_entity_id(plant_name)
    if (!entity_id) {
      console.error(`No Wikidata entity found for ${plant_name}`)
      return info
    }

    // Get complete entity data
    const entity_data = await get_entity_data(entity_id)
    if (!entity_data) {
      return info
    }

    // Get translations
    info.names_in_languages = await get_entity_labels(entity_id)

    // Get scientific name
    info.scientific_name = get_scientific_name(entity_data)

    // Get plant type using all methods
    info.plant_type = await get_plant_type(entity_id, info.scientific_name)

    // Get image URL
    info.default_image_url = get_image_url(entity_data)

    return info
  } catch (error) {
    console.error(`Error extracting plant info: ${error}`)
    return info
  }
} 