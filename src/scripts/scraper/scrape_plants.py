"""
Main script for fetching plant information from Wikidata API.
"""
import os
import time
import logging
from typing import Dict, Any, Optional, List
import requests
from urllib.parse import quote_plus
from datetime import datetime, UTC
from pymongo import MongoClient
from dotenv import load_dotenv
import ssl
import certifi

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('scraper.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Constants
USER_AGENT = 'GreenurBot/1.0 (https://github.com/greenur/greenur; contact@greenur.com) Python/3.13'
REQUEST_DELAY = 2

# Wikidata API base URL
WIKIDATA_API_BASE = 'https://www.wikidata.org/w/api.php'

# iNaturalist API base URL
INATURALIST_API_BASE = 'https://api.inaturalist.org/v1'

# MongoDB configuration
MONGO_URI = os.getenv('MONGO_URI')
DB_NAME = os.getenv('MONGODB_DB', 'master')

logger.info(f"Using database: {DB_NAME}")
if not MONGO_URI:
    logger.error("MongoDB URI not found in environment variables")
    raise Exception("MongoDB URI not found in environment variables")

# Indian languages to include with their Wikidata language codes
INDIAN_LANGUAGES = {
    'hi': 'Hindi',
    'bn': 'Bengali',
    'te': 'Telugu',
    'mr': 'Marathi',
    'ta': 'Tamil',
    'ur': 'Urdu',
    'gu': 'Gujarati',
    'kn': 'Kannada',
    'ml': 'Malayalam',
    'pa': 'Punjabi',
    'or': 'Odia',
    'as': 'Assamese',
    'mai': 'Maithili',
    'sa': 'Sanskrit'
}

# Plants to scrape - only names
PLANTS_TO_SCRAPE = {
    1: {'name': 'Tomato'},
    2: {'name': 'Rose'},
    3: {'name': 'Tulsi'},
    4: {'name': 'Neem'},
    5: {'name': 'Aloe Vera'},
    6: {'name': 'Mint'},
    7: {'name': 'Marigold'},
    8: {'name': 'Jasmine'},
    9: {'name': 'Bamboo'},
    10: {'name': 'Money Plant'},
    11: {'name': 'Petunia'}
}

def get_db_connection():
    """
    Get a connection to the MongoDB database.
    """
    try:
        logger.info("Attempting to connect to MongoDB...")
        
        # Create client with MongoDB Atlas recommended settings
        client = MongoClient(
            MONGO_URI,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            socketTimeoutMS=5000,
            tlsCAFile=certifi.where()
        )
        
        # Get database
        db = client[DB_NAME]
        
        # Test the connection
        db.command('ping')
        logger.info("Successfully connected to MongoDB")
        
        # Log database and collection info
        logger.info(f"Available databases: {client.list_database_names()}")
        logger.info(f"Available collections in {DB_NAME}: {db.list_collection_names()}")
        
        return client, db
        
    except Exception as e:
        logger.error(f"Error connecting to MongoDB: {str(e)}")
        raise

def get_wikidata_entity_id(name):
    # Try multiple search variations
    search_variations = [
        name,  # Direct name
        f"{name} (plant)",  # With plant qualifier
        f"{name} plant",  # With plant suffix
        f"{name} species",  # As a species
        f"{name} genus",  # As a genus
        f"{name} herb",  # As herb
        f"{name} tree",  # As tree
        f"{name} flower",  # As flower
        f"{name} medicinal",  # As medicinal plant
    ]
    
    # Try each search variation
    for search_term in search_variations:
        url = f"https://www.wikidata.org/w/api.php"
        params = {
            "action": "wbsearchentities",
            "format": "json",
            "language": "en",
            "search": search_term,
            "limit": 20  # Increased limit to find better matches
        }
        
        response = requests.get(url, params=params)
        data = response.json()
        
        if "search" in data and data["search"]:
            # Look for results with plant-related descriptions
            plant_terms = [
                "plant", "species", "genus", "tree", "herb", "flower",
                "medicinal", "flowering", "ornamental", "succulent",
                "grass", "vegetable", "fruit", "spice", "aromatic"
            ]
            
            # First try to find exact match with plant-related description
            for result in data["search"]:
                if "description" in result:
                    desc = result["description"].lower()
                    if any(term in desc for term in plant_terms):
                        # Check if the label matches our search term
                        if result.get("label", "").lower() == name.lower():
                            return result["id"]
            
            # If no exact match, try partial matches with plant-related description
            for result in data["search"]:
                if "description" in result:
                    desc = result["description"].lower()
                    if any(term in desc for term in plant_terms):
                        return result["id"]
            
            # If still no match, try SPARQL query with this search term
            sparql_query = f"""
            SELECT ?item ?itemLabel WHERE {{
              {{
                ?item rdfs:label ?label .
                FILTER(LANG(?label) = "en")
                FILTER(LCASE(?label) = "{search_term.lower()}"@en)
              }} UNION {{
                ?item skos:altLabel ?label .
                FILTER(LANG(?label) = "en")
                FILTER(LCASE(?label) = "{search_term.lower()}"@en)
              }}
              ?item wdt:P31 ?type .
              ?type wdt:P279* wd:Q756 .  # Instance of plant
              SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
            }}
            LIMIT 1
            """
            
            url = "https://query.wikidata.org/sparql"
            params = {
                "format": "json",
                "query": sparql_query
            }
            
            try:
                response = requests.get(url, params=params)
                if response.ok:
                    data = response.json()
                    if "results" in data and "bindings" in data["results"] and data["results"]["bindings"]:
                        return data["results"]["bindings"][0]["item"]["value"].split("/")[-1]
            except:
                pass
    
    # If no results found through any method, try one final SPARQL query
    sparql_query = f"""
    SELECT ?item WHERE {{
      {{
        ?item rdfs:label ?label .
        FILTER(LANG(?label) = "en")
        FILTER(CONTAINS(LCASE(?label), "{name.lower()}"@en))
      }} UNION {{
        ?item skos:altLabel ?label .
        FILTER(LANG(?label) = "en")
        FILTER(CONTAINS(LCASE(?label), "{name.lower()}"@en))
      }}
      ?item wdt:P31 ?type .
      ?type wdt:P279* wd:Q756 .  # Instance of plant
      ?item wdt:P225 ?scientificName .  # Must have a scientific name
    }}
    ORDER BY strlen(?label)
    LIMIT 1
    """
    
    url = "https://query.wikidata.org/sparql"
    params = {
        "format": "json",
        "query": sparql_query
    }
    
    try:
        response = requests.get(url, params=params)
        if response.ok:
            data = response.json()
            if "results" in data and "bindings" in data["results"] and data["results"]["bindings"]:
                return data["results"]["bindings"][0]["item"]["value"].split("/")[-1]
    except:
        pass
    
    return None

def get_entity_data(entity_id: str) -> Dict[str, Any]:
    """
    Get complete entity data from Wikidata API.
    """
    try:
        params = {
            'action': 'wbgetentities',
            'format': 'json',
            'ids': entity_id,
            'languages': 'en',
            'props': 'claims|labels|descriptions'
        }
        headers = {'User-Agent': USER_AGENT}
        
        response = requests.get(WIKIDATA_API_BASE, params=params, headers=headers)
        response.raise_for_status()
        data = response.json()
        
        if 'entities' in data and entity_id in data['entities']:
            return data['entities'][entity_id]
        return {}
    
    except Exception as e:
        logger.error(f"Error getting entity data for {entity_id}: {str(e)}")
        return {}

def get_entity_labels(entity_id: str) -> Dict[str, str]:
    """
    Get entity labels (translations) in Indian languages.
    """
    try:
        params = {
            'action': 'wbgetentities',
            'format': 'json',
            'ids': entity_id,
            'props': 'labels',
            'languages': '|'.join(INDIAN_LANGUAGES.keys())
        }
        headers = {'User-Agent': USER_AGENT}
        
        response = requests.get(WIKIDATA_API_BASE, params=params, headers=headers)
        response.raise_for_status()
        data = response.json()
        
        translations = {}
        if 'entities' in data and entity_id in data['entities']:
            labels = data['entities'][entity_id].get('labels', {})
            for lang_code in INDIAN_LANGUAGES:
                if lang_code in labels:
                    translations[lang_code] = labels[lang_code]['value']
        
        return translations
    
    except Exception as e:
        logger.error(f"Error getting labels for {entity_id}: {str(e)}")
        return {}

def get_plant_type_from_sparql(entity_id: str) -> Optional[str]:
    """
    Get plant type using SPARQL query to check all parent classes.
    """
    try:
        # SPARQL query to get all parent classes, properties, and their English labels
        sparql_query = f"""
        SELECT DISTINCT ?type ?typeLabel WHERE {{
          {{
            # Check instance of and its parent classes
            wd:{entity_id} wdt:P31/wdt:P279* ?type .
          }} UNION {{
            # Check parent taxon and its parent classes
            wd:{entity_id} wdt:P171/wdt:P279* ?type .
          }} UNION {{
            # Check taxon rank and its parent classes
            wd:{entity_id} wdt:P105/wdt:P279* ?type .
          }} UNION {{
            # Check properties that indicate plant type
            wd:{entity_id} ?property ?type .
            VALUES ?property {{
              wdt:P1269  # Aspect of (e.g., medicinal use)
              wdt:P1889  # Different from (can indicate type)
              wdt:P31    # Instance of
              wdt:P279   # Subclass of
              wdt:P171   # Parent taxon
              wdt:P105   # Taxon rank
              wdt:P1582  # Natural product of taxon
              wdt:P2578  # Studied by
              wdt:P1063  # Applies to taxon
            }}
          }}
          ?type rdfs:label ?typeLabel .
          FILTER(LANG(?typeLabel) = "en")
          FILTER(?type IN (
            wd:Q25031,    # herb
            wd:Q506,      # flower
            wd:Q33971,    # fruit
            wd:Q7979,     # tree
            wd:Q11004,    # grass
            wd:Q190390,   # succulent
            wd:Q23668,    # ornamental plant
            wd:Q19088,    # flowering plant
            wd:Q47154513, # medicinal plant
            wd:Q181172,   # vegetable
            wd:Q3314483,  # fruit plant
            wd:Q42295,    # spice
            wd:Q37692,    # garden plant
            wd:Q156578,   # aromatic plant
            wd:Q183332,   # culinary plant
            wd:Q127421,   # ornamental flower
            wd:Q27349,    # perennial plant
            wd:Q161726,   # medicinal herb
            wd:Q28377,    # cultivated plant
            wd:Q11292,    # spice plant
            wd:Q25390,    # houseplant
            wd:Q200250,   # vine
            wd:Q756      # plant
          ))
        }}
        ORDER BY ?type
        """
        
        sparql_url = "https://query.wikidata.org/sparql"
        params = {
            'format': 'json',
            'query': sparql_query
        }
        headers = {'User-Agent': USER_AGENT}
        
        response = requests.get(sparql_url, params=params, headers=headers)
        response.raise_for_status()
        data = response.json()
        
        # Map Wikidata types to our types with priority
        type_mapping = {
            'herb': 'Herb',
            'flower': 'Flowering',
            'fruit': 'Fruit/Vegetable',
            'tree': 'Tree',
            'grass': 'Grass',
            'succulent': 'Succulent',
            'ornamental plant': 'Ornamental',
            'flowering plant': 'Flowering',
            'medicinal plant': 'Herb',
            'vegetable': 'Fruit/Vegetable',
            'fruit plant': 'Fruit/Vegetable',
            'spice': 'Herb',
            'garden plant': 'Flowering',
            'aromatic plant': 'Herb',
            'culinary plant': 'Herb',
            'ornamental flower': 'Flowering',
            'perennial plant': 'Flowering',
            'medicinal herb': 'Herb',
            'cultivated plant': 'Fruit/Vegetable',
            'spice plant': 'Herb',
            'houseplant': 'Ornamental',
            'vine': 'Flowering',
            'plant': 'Plant'  # Fallback type
        }
        
        # Prioritize more specific types
        type_priority = {
            'Herb': 5,
            'Flowering': 4,
            'Fruit/Vegetable': 4,
            'Tree': 4,
            'Grass': 4,
            'Succulent': 4,
            'Ornamental': 3,
            'Plant': 1
        }
        
        if data.get('results', {}).get('bindings'):
            # Collect all possible types with their priority
            found_types = []
            for result in data['results']['bindings']:
                type_label = result['typeLabel']['value'].lower()
                if type_label in type_mapping:
                    plant_type = type_mapping[type_label]
                    priority = type_priority.get(plant_type, 2)
                    found_types.append((priority, plant_type))
            
            # Sort by priority (highest first) and return the most specific type
            if found_types:
                found_types.sort(reverse=True)
                return found_types[0][1]
        
        return None
    
    except Exception as e:
        logger.error(f"Error getting plant type from SPARQL: {str(e)}")
        return None

def get_plant_type_from_family(scientific_name):
    # Generic family to type mapping
    family_type_mapping = {
        # Herbs and Spices
        "Lamiaceae": "Herb",  # Mint family
        "Apiaceae": "Herb",  # Carrot family
        "Zingiberaceae": "Herb",  # Ginger family
        
        # Flowering Plants
        "Rosaceae": "Flowering",  # Rose family
        "Asteraceae": "Flowering",  # Sunflower family
        "Orchidaceae": "Flowering",  # Orchid family
        "Oleaceae": "Flowering",  # Jasmine family
        
        # Fruits and Vegetables
        "Solanaceae": "Fruit/Vegetable",  # Nightshade family
        "Cucurbitaceae": "Fruit/Vegetable",  # Gourd family
        "Fabaceae": "Fruit/Vegetable",  # Legume family
        
        # Trees
        "Meliaceae": "Tree",  # Mahogany family
        "Pinaceae": "Tree",  # Pine family
        "Fagaceae": "Tree",  # Oak family
        
        # Grasses
        "Poaceae": "Grass",  # Grass family
        
        # Succulents
        "Asphodelaceae": "Succulent",  # Aloe family
        "Cactaceae": "Succulent",  # Cactus family
        
        # Ornamentals
        "Araceae": "Ornamental",  # Arum family
        "Begoniaceae": "Ornamental"  # Begonia family
    }
    
    if not scientific_name:
        return None
        
    # Try to get family information from iNaturalist
    try:
        url = f"https://api.inaturalist.org/v1/taxa/autocomplete?q={scientific_name}"
        response = requests.get(url)
        if response.ok:
            data = response.json()
            if data["results"]:
                result = data["results"][0]
                if "ancestor_ids" in result:
                    # Get all ancestor names
                    ancestors_url = f"https://api.inaturalist.org/v1/taxa/{','.join(map(str, result['ancestor_ids']))}"
                    ancestors_response = requests.get(ancestors_url)
                    if ancestors_response.ok:
                        ancestors_data = ancestors_response.json()
                        for taxon in ancestors_data["results"]:
                            if taxon["rank"] == "family" and taxon["name"] in family_type_mapping:
                                return family_type_mapping[taxon["name"]]
    except:
        pass
    
    return None

def get_plant_type(entity_id, scientific_name=None):
    # First try to get type from SPARQL
    sparql_query = """
    SELECT ?type WHERE {
      wd:%s wdt:P31 ?class.
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
    """ % entity_id
    
    url = "https://query.wikidata.org/sparql"
    params = {
        "format": "json",
        "query": sparql_query
    }
    
    try:
        response = requests.get(url, params=params)
        if response.ok:
            data = response.json()
            if "results" in data and "bindings" in data["results"] and data["results"]["bindings"]:
                type_id = data["results"]["bindings"][0]["type"]["value"].split("/")[-1]
                type_mapping = {
                    "Q11004": "Herb",
                    "Q506": "Flowering",
                    "Q23501": "Fruit/Vegetable",
                    "Q193647": "Tree",
                    "Q11369": "Grass",
                    "Q27744": "Succulent",
                    "Q188771": "Ornamental"
                }
                if type_id in type_mapping:
                    return type_mapping[type_id]
    except:
        pass
    
    # Try to get type from family if scientific name is available
    if scientific_name:
        family_type = get_plant_type_from_family(scientific_name)
        if family_type:
            return family_type
    
    # Fallback to checking claims
    url = f"https://www.wikidata.org/w/api.php"
    params = {
        "action": "wbgetclaims",
        "format": "json",
        "entity": entity_id,
        "property": "P31"  # instance of
    }
    
    try:
        response = requests.get(url, params=params)
        data = response.json()
        if "claims" in data and "P31" in data["claims"]:
            for claim in data["claims"]["P31"]:
                if "mainsnak" in claim and "datavalue" in claim["mainsnak"]:
                    type_id = claim["mainsnak"]["datavalue"]["value"]["id"]
                    # Check if it's a plant type
                    type_url = f"https://www.wikidata.org/w/api.php"
                    type_params = {
                        "action": "wbgetentities",
                        "format": "json",
                        "ids": type_id,
                        "props": "labels|descriptions"
                    }
                    type_response = requests.get(type_url, type_params)
                    type_data = type_response.json()
                    if "entities" in type_data and type_id in type_data["entities"]:
                        entity = type_data["entities"][type_id]
                        if "descriptions" in entity and "en" in entity["descriptions"]:
                            desc = entity["descriptions"]["en"]["value"].lower()
                            if "herb" in desc:
                                return "Herb"
                            elif "flower" in desc or "flowering" in desc:
                                return "Flowering"
                            elif "fruit" in desc or "vegetable" in desc:
                                return "Fruit/Vegetable"
                            elif "tree" in desc:
                                return "Tree"
                            elif "grass" in desc:
                                return "Grass"
                            elif "succulent" in desc:
                                return "Succulent"
                            elif "ornamental" in desc:
                                return "Ornamental"
    except:
        pass
    
    return "Plant"  # Default type if nothing else matches

def get_scientific_name(entity_data: Dict[str, Any]) -> str:
    """
    Get scientific name from Wikidata entity data.
    """
    try:
        claims = entity_data.get('claims', {})
        
        # Try to get scientific name from P225 (taxon name)
        if 'P225' in claims:
            for statement in claims['P225']:
                mainsnak = statement.get('mainsnak', {})
                if mainsnak.get('snaktype') == 'value':
                    return mainsnak.get('datavalue', {}).get('value', '')
        
        # Try to get from labels if available
        labels = entity_data.get('labels', {})
        if 'la' in labels:  # Latin label
            return labels['la']['value']
        
        # Try to get from P225 (taxon name) through referenced statements
        if 'P225' in claims:
            for statement in claims['P225']:
                if 'references' in statement:
                    for ref in statement['references']:
                        if 'snaks' in ref and 'P225' in ref['snaks']:
                            for snak in ref['snaks']['P225']:
                                if snak.get('snaktype') == 'value':
                                    return snak.get('datavalue', {}).get('value', '')
        
        return ''
        
    except Exception as e:
        logger.error(f"Error getting scientific name: {str(e)}")
        return ''

def get_image_url(entity_data: Dict[str, Any]) -> str:
    """
    Get image URL from Wikidata entity data.
    """
    try:
        claims = entity_data.get('claims', {})
        
        # Try to get image from P18 (image)
        if 'P18' in claims:
            for statement in claims['P18']:
                mainsnak = statement.get('mainsnak', {})
                if mainsnak.get('snaktype') == 'value':
                    filename = mainsnak.get('datavalue', {}).get('value', '')
                    if filename:
                        return f"https://commons.wikimedia.org/wiki/Special:FilePath/{filename}?width=300"
        
        return ''
        
    except Exception as e:
        logger.error(f"Error getting image URL: {str(e)}")
        return ''

def get_plant_family_from_inaturalist(scientific_name: str) -> Optional[Dict[str, str]]:
    """
    Get plant family information from iNaturalist API using scientific name.
    """
    try:
        if not scientific_name:
            return None
        
        # Search for the taxon using scientific name
        search_url = f"{INATURALIST_API_BASE}/taxa"
        params = {
            'q': scientific_name,
            'rank': 'species,genus',  # Look for both species and genus level
            'per_page': 1  # We only need the first result
        }
        headers = {'User-Agent': USER_AGENT}
        
        response = requests.get(search_url, params=params, headers=headers)
        response.raise_for_status()
        data = response.json()
        
        if data.get('results') and len(data['results']) > 0:
            taxon = data['results'][0]
            
            # Get the complete taxon information including ancestors
            taxon_id = taxon['id']
            detail_url = f"{INATURALIST_API_BASE}/taxa/{taxon_id}"
            
            response = requests.get(detail_url, headers=headers)
            response.raise_for_status()
            detail_data = response.json()
            
            if detail_data.get('results') and len(detail_data['results']) > 0:
                taxon_detail = detail_data['results'][0]
                ancestors = taxon_detail.get('ancestors', [])
                
                # Find the family from ancestors
                family_info = next(
                    (a for a in ancestors if a.get('rank') == 'family'),
                    None
                )
                
                if family_info:
                    return {
                        'family_name': family_info.get('name', ''),
                        'family_common_name': family_info.get('preferred_common_name', ''),
                        'taxonomic_rank': taxon_detail.get('rank', ''),
                        'complete_name': taxon_detail.get('name', ''),
                        'common_names': [n.get('name', '') for n in taxon_detail.get('names', []) if n.get('name')]
                    }
        
        return None
    
    except Exception as e:
        logger.error(f"Error getting plant family from iNaturalist: {str(e)}")
        return None

def extract_plant_info(plant_id: int, plant_name: str) -> Dict[str, Any]:
    """
    Extract plant information from Wikidata and iNaturalist.
    """
    info = {
        '_id': plant_id,
        'common_name': plant_name,
        'scientific_name': '',
        'plant_type': '',
        'names_in_languages': {},
        'default_image_url': '',
        'last_updated': datetime.now(UTC).isoformat()
    }
    
    try:
        # Get entity ID
        entity_id = get_wikidata_entity_id(plant_name)
        if not entity_id:
            logger.error(f"No Wikidata entity found for {plant_name}")
            return info
        
        # Get complete entity data
        entity_data = get_entity_data(entity_id)
        if not entity_data:
            return info
        
        # Get translations
        info['names_in_languages'] = get_entity_labels(entity_id)
        
        # Get scientific name
        info['scientific_name'] = get_scientific_name(entity_data)
        
        # Get plant type using all methods
        info['plant_type'] = get_plant_type(entity_id, info['scientific_name'])
        
        # Get image URL
        info['default_image_url'] = get_image_url(entity_data)
        
        return info
    
    except Exception as e:
        logger.error(f"Error extracting plant info: {str(e)}")
        return info

def update_plant_basics(plants_data: Dict[str, Dict[str, Any]]) -> bool:
    """
    Update plant_basics collection in MongoDB.
    """
    client = None
    try:
        logger.info("Getting database connection...")
        client, db = get_db_connection()
        
        # Get or create plant_basics collection
        collection = db.plant_basics
        logger.info(f"Using collection: {collection.name}")
        
        # Log initial collection state
        initial_count = collection.count_documents({})
        logger.info(f"Initial documents in collection: {initial_count}")
        
        success_count = 0
        error_count = 0
        
        # Update each plant
        for plant_id, plant_data in plants_data.items():
            try:
                # Convert _id to int for MongoDB
                plant_data['_id'] = int(plant_data['_id'])
                
                # Convert last_updated to datetime object
                plant_data['last_updated'] = datetime.fromisoformat(plant_data['last_updated'])
                
                # Log the data being inserted
                logger.info(f"Processing plant {plant_data['_id']}: {plant_data['common_name']}")
                
                # Use upsert to insert or update
                result = collection.update_one(
                    {'_id': plant_data['_id']},
                    {'$set': plant_data},
                    upsert=True
                )
                
                if result.modified_count > 0:
                    logger.info(f"Updated existing document for plant {plant_data['_id']}")
                    success_count += 1
                elif result.upserted_id is not None:
                    logger.info(f"Inserted new document for plant {plant_data['_id']}")
                    success_count += 1
                else:
                    logger.warning(f"No changes made for plant {plant_data['_id']}")
                
            except Exception as e:
                logger.error(f"Error processing plant {plant_id}: {str(e)}")
                error_count += 1
                continue
        
        # Log final results
        final_count = collection.count_documents({})
        logger.info(f"Final documents in collection: {final_count}")
        logger.info(f"Successfully processed {success_count} plants")
        if error_count > 0:
            logger.warning(f"Failed to process {error_count} plants")
        
        # Verify some data exists
        if final_count == 0:
            logger.error("No documents found in collection after update")
            return False
        
        logger.info("Successfully updated plant_basics collection")
        return True
        
    except Exception as e:
        logger.error(f"Error updating plant_basics collection: {str(e)}")
        return False
        
    finally:
        if client:
            client.close()
            logger.info("MongoDB connection closed")

def main():
    """
    Main function to fetch plant information from Wikidata and store in MongoDB.
    """
    # First get database connection to check existing plants
    try:
        client, db = get_db_connection()
        collection = db.plant_basics
        
        # Get existing plant IDs from database
        existing_plants = set(doc['_id'] for doc in collection.find({}, {'_id': 1}))
        logger.info(f"Found {len(existing_plants)} existing plants in database")
        
        all_plants_data = {}
        plants_to_scrape = {
            plant_id: plant_info 
            for plant_id, plant_info in PLANTS_TO_SCRAPE.items() 
            if plant_id not in existing_plants
        }
        
        if not plants_to_scrape:
            logger.info("No new plants to scrape. All plants already exist in database.")
            return
            
        logger.info(f"Found {len(plants_to_scrape)} new plants to scrape")
        
        for plant_id, plant_info in plants_to_scrape.items():
            logger.info(f"\n{'#' * 40}")
            logger.info(f"Starting data fetch for {plant_info['name']}")
            logger.info(f"{'#' * 40}\n")
            
            # Extract information from Wikidata
            plant_data = extract_plant_info(plant_id, plant_info['name'])
            
            # Add to all plants data
            all_plants_data[str(plant_id)] = plant_data
            
            # Wait before next request
            time.sleep(REQUEST_DELAY)
        
        # Update database only if we have new plants
        if all_plants_data:
            if update_plant_basics(all_plants_data):
                logger.info("Successfully updated database with new plants")
            else:
                logger.error("Failed to update database with new plants")
        
    except Exception as e:
        logger.error(f"Error in main function: {str(e)}")
    finally:
        if client:
            client.close()
            logger.info("MongoDB connection closed")

if __name__ == '__main__':
    main() 