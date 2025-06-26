import { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import * as admin from 'firebase-admin';
import { getStorage } from 'firebase-admin/storage';
import { MongoClient, ServerApiVersion } from 'mongodb';
import busboy from 'busboy';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { tmpdir } from 'os';

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGODB_DB || 'master';

// Initialize Firebase Admin with service account
if (!admin.apps.length) {
  try {
    const serviceAccount = require('./utils/serviceAccountKey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: 'aegisg-494e1.firebasestorage.app'
    });
    console.log('[upload-growth-stage-images] Firebase Admin initialized successfully');
  } catch (error) {
    console.error('[upload-growth-stage-images] Error initializing Firebase Admin:', error);
    throw error;
  }
}

const bucket = getStorage().bucket();

// Growth stage interface
interface GrowthStageImage {
  plantType: string;
  stageName: string;
  stageDescription: string;
  imageUrl: string;
  firebasePath: string;
  stageOrder: number;
  durationDays: { min: number; max: number };
  totalDaysFromStart: { start: number; end: number };
  care: string[];
  commonIssues: string[];
  indicators: string[];
  uploadedAt: Date;
  uploadedBy?: string;
  metadata: {
    originalFileName: string;
    fileSize: number;
    contentType: string;
  };
}

// Define growth stages for different plants
const PLANT_GROWTH_STAGES = {
  // VEGETABLES
  tomato: [
    { 
      name: 'germination', 
      description: 'Seed germination and early sprouting', 
      order: 1,
      durationDays: { min: 5, max: 14 },
      totalDaysFromStart: { start: 1, end: 14 },
      care: [
        'Keep soil consistently moist but not waterlogged',
        'Maintain temperature between 18-24°C',
        'Provide bright, indirect light',
        'Cover with plastic wrap or humidity dome to retain moisture',
        'Check daily for germination signs'
      ],
      commonIssues: [
        'Seeds not germinating (old seeds, incorrect temperature)',
        'Damping off disease from overwatering',
        'Seeds drying out from insufficient moisture'
      ],
      indicators: [
        'Small green shoots emerging from soil',
        'First cotyledon leaves appearing',
        'Root development visible if using clear containers'
      ]
    },
    { 
      name: 'seedling', 
      description: 'Young plant with first true leaves', 
      order: 2,
      durationDays: { min: 14, max: 21 },
      totalDaysFromStart: { start: 15, end: 35 },
      care: [
        'Water when top inch of soil feels dry',
        'Provide 12-16 hours of bright light daily',
        'Maintain temperature between 16-21°C',
        'Begin light fertilization with diluted liquid fertilizer',
        'Gradually introduce to outdoor conditions (hardening off)'
      ],
      commonIssues: [
        'Leggy growth from insufficient light',
        'Yellowing leaves from overwatering or nutrient deficiency',
        'Stunted growth from cold temperatures'
      ],
      indicators: [
        'First true leaves with serrated edges appearing',
        'Stem becoming stronger and more upright',
        'Root system developing and filling small containers'
      ]
    },
    { 
      name: 'vegetative_growth', 
      description: 'Rapid growth and leaf development', 
      order: 3,
      durationDays: { min: 28, max: 42 },
      totalDaysFromStart: { start: 36, end: 77 },
      care: [
        'Water deeply but less frequently (2-3 times per week)',
        'Provide full sun (6-8 hours daily)',
        'Fertilize every 2 weeks with balanced fertilizer',
        'Begin staking or supporting the plant',
        'Pinch off suckers between main stem and branches'
      ],
      commonIssues: [
        'Excessive leaf growth with poor fruit development',
        'Pest infestations (aphids, whiteflies)',
        'Nutrient deficiencies showing in leaf color'
      ],
      indicators: [
        'Rapid increase in height and leaf production',
        'Strong, thick main stem development',
        'Formation of multiple branch nodes'
      ]
    },
    { 
      name: 'flowering', 
      description: 'Flower buds and blooming stage', 
      order: 4,
      durationDays: { min: 14, max: 28 },
      totalDaysFromStart: { start: 78, end: 105 },
      care: [
        'Maintain consistent watering schedule',
        'Switch to phosphorus-rich fertilizer to promote flowering',
        'Ensure good air circulation around plants',
        'Hand pollinate flowers if needed (gently shake plants)',
        'Remove lower leaves touching the ground'
      ],
      commonIssues: [
        'Flower drop from temperature stress or inconsistent watering',
        'Poor pollination leading to few fruits',
        'Blossom end rot from calcium deficiency'
      ],
      indicators: [
        'Yellow flower clusters appearing at branch tips',
        'Flowers opening and showing stamens',
        'First small green fruits beginning to form'
      ]
    },
    { 
      name: 'fruiting', 
      description: 'Fruit formation and development', 
      order: 5,
      durationDays: { min: 21, max: 35 },
      totalDaysFromStart: { start: 106, end: 140 },
      care: [
        'Increase watering frequency as fruits develop',
        'Apply potassium-rich fertilizer to support fruit development',
        'Provide additional support for heavy fruit-laden branches',
        'Mulch around base to retain moisture and suppress weeds',
        'Monitor for fruit-specific pests like hornworms'
      ],
      commonIssues: [
        'Fruit splitting from irregular watering',
        'Catfacing or misshapen fruits from poor pollination',
        'Slow fruit development from insufficient nutrients'
      ],
      indicators: [
        'Green fruits rapidly increasing in size',
        'Fruits reaching full size but still green',
        'Plant requiring more support due to fruit weight'
      ]
    },
    { 
      name: 'ripening', 
      description: 'Fruit maturation and ripening', 
      order: 6,
      durationDays: { min: 14, max: 21 },
      totalDaysFromStart: { start: 141, end: 161 },
      care: [
        'Reduce watering slightly to concentrate flavors',
        'Remove lower leaves to improve air circulation',
        'Harvest fruits as they begin to turn color',
        'Continue pest monitoring and control',
        'Prepare for season-end cleanup'
      ],
      commonIssues: [
        'Fruits cracking from heavy watering after dry periods',
        'Uneven ripening from temperature fluctuations',
        'End-of-season pest pressure'
      ],
      indicators: [
        'Fruits beginning to change from green to red/orange',
        'Fruits giving slightly to gentle pressure when ripe',
        'Easy separation of ripe fruits from vine'
      ]
    }
  ],

  // VEGETABLES
  pepper: [
    {
      name: 'germination',
      description: 'Pepper seed germination and early sprouting',
      order: 1,
      durationDays: { min: 7, max: 21 },
      totalDaysFromStart: { start: 1, end: 21 },
      care: [
        'Keep soil consistently warm (24-29°C) for optimal germination',
        'Maintain constant moisture without waterlogging',
        'Provide bright light but not direct sun',
        'Use heating mat if necessary to maintain temperature',
        'Be patient - peppers can take up to 3 weeks to germinate'
      ],
      commonIssues: [
        'Slow germination due to cold temperatures',
        'Poor germination rate from old or poor quality seeds',
        'Damping off from excessive moisture'
      ],
      indicators: [
        'Small cotyledon leaves emerging from soil',
        'Root development visible in transparent containers',
        'Seed coat shedding from young shoots'
      ]
    },
    {
      name: 'seedling',
      description: 'Young pepper plant development',
      order: 2,
      durationDays: { min: 21, max: 35 },
      totalDaysFromStart: { start: 22, end: 56 },
      care: [
        'Maintain temperature between 21-24°C during day, 18-21°C at night',
        'Provide 14-16 hours of bright light daily',
        'Water when soil surface begins to dry',
        'Begin light fertilization with balanced liquid fertilizer',
        'Ensure good air circulation to prevent fungal issues'
      ],
      commonIssues: [
        'Leggy growth from insufficient light',
        'Purple leaves from temperature stress or phosphorus deficiency',
        'Stunted growth from cold conditions'
      ],
      indicators: [
        'First true leaves with characteristic pepper leaf shape',
        'Stronger stem development',
        'Active root growth filling container'
      ]
    },
    {
      name: 'vegetative_growth',
      description: 'Rapid vegetative development and branching',
      order: 3,
      durationDays: { min: 35, max: 49 },
      totalDaysFromStart: { start: 57, end: 105 },
      care: [
        'Transplant to larger containers or garden after hardening off',
        'Provide full sun (6-8 hours daily)',
        'Deep watering 2-3 times per week',
        'Apply balanced fertilizer every 2-3 weeks',
        'Pinch off early flower buds to encourage vegetative growth'
      ],
      commonIssues: [
        'Transplant shock if not properly hardened off',
        'Nutrient deficiencies showing in leaf color',
        'Pest issues like aphids and spider mites'
      ],
      indicators: [
        'Rapid height increase and branching',
        'Dark green, healthy foliage',
        'Strong root system establishment'
      ]
    },
    {
      name: 'flowering',
      description: 'Flower bud formation and blooming',
      order: 4,
      durationDays: { min: 14, max: 28 },
      totalDaysFromStart: { start: 106, end: 133 },
      care: [
        'Continue consistent watering but avoid overhead watering',
        'Switch to phosphorus-rich fertilizer',
        'Maintain warm temperatures (21-29°C)',
        'Provide support for branches as they develop',
        'Encourage pollination by gentle shaking or using small brush'
      ],
      commonIssues: [
        'Flower drop from temperature stress or inconsistent watering',
        'Poor fruit set from inadequate pollination',
        'Blossom end rot from calcium deficiency'
      ],
      indicators: [
        'Small white or purple flowers appearing',
        'Successful pollination evident by small fruit formation',
        'Continued vegetative growth alongside flowering'
      ]
    },
    {
      name: 'fruiting',
      description: 'Pepper fruit development and growth',
      order: 5,
      durationDays: { min: 28, max: 42 },
      totalDaysFromStart: { start: 134, end: 175 },
      care: [
        'Increase watering frequency as fruits develop',
        'Apply potassium-rich fertilizer to support fruit development',
        'Provide support for heavy fruit-laden branches',
        'Maintain consistent soil moisture to prevent fruit cracking',
        'Monitor for fruit pests like hornworms'
      ],
      commonIssues: [
        'Fruit cracking from irregular watering',
        'Sunscald on fruits from intense heat',
        'Slow fruit development from inadequate nutrition'
      ],
      indicators: [
        'Fruits rapidly increasing in size',
        'Color development beginning',
        'Plant requiring additional support due to fruit weight'
      ]
    },
    {
      name: 'ripening',
      description: 'Pepper fruit maturation and harvest',
      order: 6,
      durationDays: { min: 14, max: 28 },
      totalDaysFromStart: { start: 176, end: 203 },
      care: [
        'Continue consistent watering but avoid overwatering',
        'Harvest peppers at desired color stage',
        'Regular harvesting encourages continued production',
        'Reduce fertilization as season ends',
        'Protect from early frost if necessary'
      ],
      commonIssues: [
        'Fruit splitting from heavy watering after dry periods',
        'Uneven ripening from temperature fluctuations',
        'End-of-season pest pressure'
      ],
      indicators: [
        'Color change from green to red, yellow, or purple',
        'Fruits firm but give slightly when ripe',
        'Easy harvest without damaging plant'
      ]
    }
  ],

  lettuce: [
    {
      name: 'germination',
      description: 'Lettuce seed germination',
      order: 1,
      durationDays: { min: 3, max: 10 },
      totalDaysFromStart: { start: 1, end: 10 },
      care: [
        'Keep soil consistently moist but not waterlogged',
        'Maintain cool temperature (15-20°C) for best germination',
        'Provide bright but indirect light',
        'Sow seeds shallowly (3-6mm deep)',
        'Keep seeds in darkness until germination begins'
      ],
      commonIssues: [
        'Poor germination in hot weather',
        'Seeds drying out from insufficient moisture',
        'Damping off in overly wet conditions'
      ],
      indicators: [
        'Small cotyledon leaves emerging',
        'Quick germination in cool conditions',
        'Even emergence across seed bed'
      ]
    },
    {
      name: 'seedling',
      description: 'Early lettuce leaf development',
      order: 2,
      durationDays: { min: 14, max: 21 },
      totalDaysFromStart: { start: 11, end: 31 },
      care: [
        'Maintain cool growing conditions (15-18°C)',
        'Provide 12-14 hours of light daily',
        'Water gently to avoid disturbing young plants',
        'Begin very light fertilization with nitrogen-rich fertilizer',
        'Thin seedlings to prevent overcrowding'
      ],
      commonIssues: [
        'Bolting in warm weather',
        'Overcrowding leading to weak plants',
        'Aphid infestations on tender leaves'
      ],
      indicators: [
        'First true leaves developing',
        'Compact, bushy growth pattern',
        'Healthy green color'
      ]
    },
    {
      name: 'vegetative_growth',
      description: 'Rapid leaf growth and head formation',
      order: 3,
      durationDays: { min: 28, max: 42 },
      totalDaysFromStart: { start: 32, end: 73 },
      care: [
        'Maintain consistent soil moisture',
        'Apply balanced fertilizer every 2 weeks',
        'Provide partial shade in hot weather',
        'Ensure good air circulation',
        'Space plants adequately for full development'
      ],
      commonIssues: [
        'Bolting in hot weather or long days',
        'Tip burn from calcium deficiency',
        'Slugs and snails damaging leaves'
      ],
      indicators: [
        'Rapid leaf production',
        'Head formation beginning (for head lettuce)',
        'Crisp, tender leaves developing'
      ]
    },
    {
      name: 'maturity',
      description: 'Harvest-ready lettuce',
      order: 4,
      durationDays: { min: 7, max: 14 },
      totalDaysFromStart: { start: 74, end: 87 },
      care: [
        'Harvest outer leaves continuously for leaf lettuce',
        'Cut whole head for head lettuce varieties',
        'Harvest in early morning for best quality',
        'Keep harvested lettuce cool and moist',
        'Plan succession plantings for continuous harvest'
      ],
      commonIssues: [
        'Bitter taste from heat stress',
        'Bolting if harvest is delayed',
        'Pest damage affecting quality'
      ],
      indicators: [
        'Full-sized leaves or heads',
        'Crisp texture and good color',
        'Optimal flavor before bolting'
      ]
    }
  ],

  // HERBS
  basil: [
    {
      name: 'germination',
      description: 'Basil seed germination and emergence',
      order: 1,
      durationDays: { min: 5, max: 14 },
      totalDaysFromStart: { start: 1, end: 14 },
      care: [
        'Keep soil warm (21-24°C) and consistently moist',
        'Provide bright light but avoid direct hot sun',
        'Maintain high humidity around seeds',
        'Sow seeds 6mm deep in fine seed starting mix',
        'Cover with plastic to retain moisture until germination'
      ],
      commonIssues: [
        'Poor germination in cool conditions',
        'Damping off from excessive moisture',
        'Uneven germination from temperature fluctuations'
      ],
      indicators: [
        'Small oval cotyledon leaves appearing',
        'Sweet basil aroma beginning to develop',
        'Quick emergence in warm conditions'
      ]
    },
    {
      name: 'seedling',
      description: 'Young basil plant establishment',
      order: 2,
      durationDays: { min: 14, max: 28 },
      totalDaysFromStart: { start: 15, end: 42 },
      care: [
        'Maintain warm growing conditions (18-24°C)',
        'Provide 14-16 hours of bright light',
        'Water when soil surface begins to dry',
        'Begin light fertilization with balanced fertilizer',
        'Pinch off flower buds to encourage leaf growth'
      ],
      commonIssues: [
        'Cold damage from temperatures below 15°C',
        'Leggy growth from insufficient light',
        'Fungal issues in cool, damp conditions'
      ],
      indicators: [
        'First true leaves showing characteristic basil shape',
        'Strong aromatic oils developing',
        'Bushy growth pattern beginning'
      ]
    },
    {
      name: 'vegetative_growth',
      description: 'Rapid leaf production and bush development',
      order: 3,
      durationDays: { min: 28, max: 42 },
      totalDaysFromStart: { start: 43, end: 84 },
      care: [
        'Transplant to larger containers or garden after hardening',
        'Provide full sun to partial shade',
        'Water regularly but allow soil to dry slightly between waterings',
        'Fertilize every 2-3 weeks with balanced fertilizer',
        'Pinch growing tips to encourage bushy growth'
      ],
      commonIssues: [
        'Transplant shock if not properly hardened',
        'Bacterial leaf spot in humid conditions',
        'Aphid infestations on tender growth'
      ],
      indicators: [
        'Rapid leaf production',
        'Strong branching and bushy growth',
        'Intense aromatic oils in leaves'
      ]
    },
    {
      name: 'harvest',
      description: 'Continuous leaf harvest period',
      order: 4,
      durationDays: { min: 60, max: 90 },
      totalDaysFromStart: { start: 85, end: 174 },
      care: [
        'Harvest leaves regularly to encourage new growth',
        'Pinch off flower spikes to maintain leaf production',
        'Continue regular watering and fertilization',
        'Harvest in early morning for best flavor',
        'Preserve excess harvest by drying or freezing'
      ],
      commonIssues: [
        'Reduced leaf quality if allowed to flower',
        'Cold damage as temperatures drop',
        'Reduced production in very hot weather'
      ],
      indicators: [
        'Abundant, flavorful leaves',
        'Continuous new growth after harvesting',
        'Strong aromatic qualities'
      ]
    }
  ],

  // FLOWERS
  sunflower: [
    {
      name: 'germination',
      description: 'Sunflower seed germination',
      order: 1,
      durationDays: { min: 7, max: 14 },
      totalDaysFromStart: { start: 1, end: 14 },
      care: [
        'Plant seeds 2.5cm deep in well-draining soil',
        'Keep soil consistently moist but not waterlogged',
        'Maintain temperature between 18-24°C',
        'Provide full sun location',
        'Protect from birds and rodents'
      ],
      commonIssues: [
        'Poor germination in cold or wet soil',
        'Seed predation by birds or rodents',
        'Damping off in overly moist conditions'
      ],
      indicators: [
        'Large cotyledon leaves emerging',
        'Strong taproot development',
        'Quick emergence in warm soil'
      ]
    },
    {
      name: 'seedling',
      description: 'Young sunflower establishment',
      order: 2,
      durationDays: { min: 14, max: 21 },
      totalDaysFromStart: { start: 15, end: 35 },
      care: [
        'Provide full sun (6-8 hours daily)',
        'Water deeply but infrequently',
        'Begin light fertilization with balanced fertilizer',
        'Protect from strong winds',
        'Thin multiple seedlings to strongest plant'
      ],
      commonIssues: [
        'Wind damage to tender stems',
        'Cutworm damage at soil level',
        'Competition from weeds'
      ],
      indicators: [
        'First true leaves developing',
        'Rapid vertical growth beginning',
        'Strong central stem formation'
      ]
    },
    {
      name: 'vegetative_growth',
      description: 'Rapid height increase and leaf development',
      order: 3,
      durationDays: { min: 35, max: 56 },
      totalDaysFromStart: { start: 36, end: 91 },
      care: [
        'Provide consistent deep watering',
        'Apply phosphorus-rich fertilizer',
        'Stake tall varieties if needed',
        'Mulch around base to retain moisture',
        'Monitor for pest issues'
      ],
      commonIssues: [
        'Lodging from wind or heavy rain',
        'Nutrient deficiencies in poor soil',
        'Insect damage to leaves and stems'
      ],
      indicators: [
        'Rapid height increase (30-60cm per month)',
        'Large, heart-shaped leaves developing',
        'Strong, thick main stem'
      ]
    },
    {
      name: 'budding',
      description: 'Flower bud formation and development',
      order: 4,
      durationDays: { min: 14, max: 21 },
      totalDaysFromStart: { start: 92, end: 112 },
      care: [
        'Increase watering as buds develop',
        'Apply potassium-rich fertilizer',
        'Provide support for heavy flower heads',
        'Protect from strong winds',
        'Monitor for pest activity'
      ],
      commonIssues: [
        'Bud drop from water stress',
        'Pest damage to developing flower heads',
        'Lodging from weight of developing heads'
      ],
      indicators: [
        'Large green buds forming at stem tips',
        'Buds beginning to show color',
        'Plant reaching maximum height'
      ]
    },
    {
      name: 'flowering',
      description: 'Full bloom and pollination',
      order: 5,
      durationDays: { min: 14, max: 28 },
      totalDaysFromStart: { start: 113, end: 140 },
      care: [
        'Continue consistent watering',
        'Support heavy flower heads',
        'Deadhead spent flowers to prolong blooming',
        'Allow some flowers to go to seed if desired',
        'Enjoy peak ornamental value'
      ],
      commonIssues: [
        'Flower head drooping from weight',
        'Bird damage to seeds',
        'Weather damage to petals'
      ],
      indicators: [
        'Full flower heads with bright yellow petals',
        'Active pollinator activity',
        'Seeds beginning to form in center'
      ]
    },
    {
      name: 'seed_maturation',
      description: 'Seed development and harvest',
      order: 6,
      durationDays: { min: 21, max: 35 },
      totalDaysFromStart: { start: 141, end: 175 },
      care: [
        'Reduce watering as seeds mature',
        'Protect seed heads from birds with netting',
        'Harvest when back of flower head turns brown',
        'Allow seeds to dry before storage',
        'Cut stems for indoor arrangements'
      ],
      commonIssues: [
        'Bird predation of seeds',
        'Premature seed drop',
        'Mold issues in wet weather'
      ],
      indicators: [
        'Petals dropping and head turning downward',
        'Seeds plump and fully formed',
        'Back of flower head turning brown'
      ]
    }
  ],

  // SUCCULENT
  aloe: [
    {
      name: 'propagation',
      description: 'Aloe offset or leaf propagation',
      order: 1,
      durationDays: { min: 14, max: 28 },
      totalDaysFromStart: { start: 1, end: 28 },
      care: [
        'Allow cut surfaces to callus for 3-7 days before planting',
        'Use well-draining cactus soil mix',
        'Place in bright, indirect light',
        'Wait to water until roots develop',
        'Maintain temperature between 18-24°C'
      ],
      commonIssues: [
        'Rot from watering too early',
        'Failure to root in poor drainage',
        'Sunburn from direct sun too early'
      ],
      indicators: [
        'Callus formation on cut surfaces',
        'Small root development beginning',
        'Offset remaining plump and healthy'
      ]
    },
    {
      name: 'establishment',
      description: 'Root development and early growth',
      order: 2,
      durationDays: { min: 28, max: 56 },
      totalDaysFromStart: { start: 29, end: 84 },
      care: [
        'Begin light watering once roots are established',
        'Gradually increase light exposure',
        'Use diluted succulent fertilizer monthly',
        'Ensure excellent drainage',
        'Avoid overwatering'
      ],
      commonIssues: [
        'Root rot from overwatering',
        'Stretching from insufficient light',
        'Shock from rapid environmental changes'
      ],
      indicators: [
        'Strong root system development',
        'New leaf growth appearing',
        'Plant becoming more stable in pot'
      ]
    },
    {
      name: 'juvenile_growth',
      description: 'Active leaf production and size increase',
      order: 3,
      durationDays: { min: 84, max: 168 },
      totalDaysFromStart: { start: 85, end: 252 },
      care: [
        'Water thoroughly but infrequently',
        'Provide bright, indirect to partial direct light',
        'Fertilize monthly during growing season',
        'Repot when roots fill container',
        'Monitor for pests like mealybugs'
      ],
      commonIssues: [
        'Overwatering leading to soft, mushy leaves',
        'Pest infestations in warm conditions',
        'Insufficient light causing pale coloration'
      ],
      indicators: [
        'Steady production of new leaves',
        'Increasing plant size and thickness',
        'Healthy green coloration with possible red edges'
      ]
    },
    {
      name: 'maturity',
      description: 'Adult plant with potential for flowering',
      order: 4,
      durationDays: { min: 365, max: 730 },
      totalDaysFromStart: { start: 253, end: 982 },
      care: [
        'Maintain established watering routine',
        'Provide bright light for best coloration',
        'Allow soil to dry completely between waterings',
        'Remove dead or damaged leaves',
        'Harvest outer leaves for medicinal use if desired'
      ],
      commonIssues: [
        'Scale or mealybug infestations',
        'Rot from accumulated dead leaves',
        'Etiolation in insufficient light'
      ],
      indicators: [
        'Full-sized rosette formation',
        'Thick, succulent leaves with gel',
        'Potential for flower spike production'
      ]
    }
  ]
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('[upload-growth-stage-images] Starting upload process');

    // Parse form data
    const parseFormData = () => {
      return new Promise<{ fields: Record<string, string>; filePath: string; originalName: string; fileSize: number }>((resolve, reject) => {
        const fields: Record<string, string> = {};
        let filePath = '';
        let originalName = '';
        let fileSize = 0;
        let fileWriteStream: fs.WriteStream | null = null;

        const bb = busboy({ 
          headers: event.headers as Record<string, string>,
          limits: {
            fileSize: 10 * 1024 * 1024, // 10MB limit for high quality images
            files: 1
          }
        });

        bb.on('field', (fieldname: string, value: string) => {
          fields[fieldname] = value;
        });

        bb.on('file', (fieldname: string, file: NodeJS.ReadableStream, info: { filename: string; encoding: string; mimeType: string }) => {
          const tmpPath = path.join(tmpdir(), `growth_stage_${Date.now()}_${info.filename}`);
          filePath = tmpPath;
          originalName = info.filename;

          fileWriteStream = fs.createWriteStream(tmpPath);
          file.pipe(fileWriteStream);

          file.on('data', (chunk) => {
            fileSize += chunk.length;
          });

          file.on('limit', () => {
            if (fileWriteStream) {
              fileWriteStream.end();
              fs.unlinkSync(tmpPath);
            }
            reject(new Error('File size limit exceeded (10MB)'));
          });
        });

        bb.on('finish', () => {
          if (fileWriteStream) {
            fileWriteStream.end();
          }
          resolve({ fields, filePath, originalName, fileSize });
        });

        bb.on('error', (error: Error) => {
          if (fileWriteStream) {
            fileWriteStream.end();
            if (filePath && fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          }
          reject(error);
        });

        if (event.body) {
          const stream = new Readable({
            read() {
              this.push(Buffer.from(event.body as string, event.isBase64Encoded ? 'base64' : 'utf8'));
              this.push(null);
            }
          });
          stream.pipe(bb);
        } else {
          reject(new Error('No request body'));
        }
      });
    };

    const { fields, filePath, originalName, fileSize } = await parseFormData();
    
    const { plantType, stageName, uploadedBy } = fields;

    if (!filePath || !plantType || !stageName) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing required fields: file, plantType, or stageName' })
      };
    }

    // Validate plant type and stage
    const plantStages = PLANT_GROWTH_STAGES[plantType.toLowerCase() as keyof typeof PLANT_GROWTH_STAGES];
    if (!plantStages) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: `Unsupported plant type: ${plantType}` })
      };
    }

    const stageInfo = plantStages.find(stage => stage.name === stageName.toLowerCase());
    if (!stageInfo) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: `Invalid stage name: ${stageName}` })
      };
    }

    // Create Firebase path
    const timestamp = Date.now();
    const sanitizedFileName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const firebasePath = `growth-stages/${plantType.toLowerCase()}/${stageName.toLowerCase()}/${timestamp}_${sanitizedFileName}`;

    console.log('[upload-growth-stage-images] Uploading to Firebase:', firebasePath);

    // Upload to Firebase Storage
    await bucket.upload(filePath, {
      destination: firebasePath,
      metadata: {
        contentType: fields.contentType || 'image/jpeg',
        metadata: {
          plantType: plantType.toLowerCase(),
          stageName: stageName.toLowerCase(),
          stageOrder: stageInfo.order.toString(),
          uploadedBy: uploadedBy || 'system',
          originalName: originalName,
          timestamp: timestamp.toString(),
        },
      },
    });

    // Get the download URL
    const [url] = await bucket.file(firebasePath).getSignedUrl({
      action: 'read',
      expires: '03-01-2500', // Long expiration
    });

    console.log('[upload-growth-stage-images] File uploaded, got URL:', url);

    // Store metadata in MongoDB
    const growthStageData: GrowthStageImage = {
      plantType: plantType.toLowerCase(),
      stageName: stageName.toLowerCase(),
      stageDescription: stageInfo.description,
      imageUrl: url,
      firebasePath: firebasePath,
      stageOrder: stageInfo.order,
      durationDays: stageInfo.durationDays,
      totalDaysFromStart: stageInfo.totalDaysFromStart,
      care: stageInfo.care,
      commonIssues: stageInfo.commonIssues,
      indicators: stageInfo.indicators,
      uploadedAt: new Date(),
      uploadedBy: uploadedBy || 'system',
      metadata: {
        originalFileName: originalName,
        fileSize: fileSize,
        contentType: fields.contentType || 'image/jpeg'
      }
    };

    // Connect to MongoDB and save
    const client = new MongoClient(MONGO_URI!, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      }
    });

    try {
      await client.connect();
      const db = client.db(DB_NAME);
      const collection = db.collection('plant_growth_stages');

      // Create index for efficient querying
      await collection.createIndex({ plantType: 1, stageName: 1, stageOrder: 1 });
      
      // Use upsert to replace existing records instead of creating duplicates
      const filter = { 
        plantType: plantType.toLowerCase(), 
        stageName: stageName.toLowerCase() 
      };
      
      const result = await collection.replaceOne(filter, growthStageData, { upsert: true });
      console.log('[upload-growth-stage-images] Saved to MongoDB - matched:', result.matchedCount, 'modified:', result.modifiedCount, 'upserted:', result.upsertedId);

    } finally {
      await client.close();
    }

    // Clean up temporary file
    fs.unlinkSync(filePath);
    console.log('[upload-growth-stage-images] Temporary file cleaned up');

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        data: {
          id: growthStageData,
          imageUrl: url,
          firebasePath: firebasePath,
          plantType: plantType.toLowerCase(),
          stageName: stageName.toLowerCase(),
          stageOrder: stageInfo.order
        }
      })
    };

  } catch (error) {
    console.error('[upload-growth-stage-images] Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

export { handler }; 