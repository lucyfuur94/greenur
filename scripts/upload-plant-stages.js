import fetch from 'node-fetch';
import FormData from 'form-data';

// Configuration
const UPLOAD_ENDPOINT = 'http://localhost:8888/.netlify/functions/upload-growth-stage-images';

// Plant types to upload (without images, just metadata)
const PLANT_TYPES = ['tomato', 'pepper', 'lettuce', 'basil', 'sunflower', 'aloe'];

// Create a simple SVG placeholder image
const createDummyImage = () => {
  const svg = `<svg width="80" height="80" xmlns="http://www.w3.org/2000/svg">
    <rect width="80" height="80" fill="#f0f0f0" stroke="#ccc" stroke-width="2"/>
    <text x="40" y="35" font-family="Arial, sans-serif" font-size="10" text-anchor="middle" fill="#666">Plant</text>
    <text x="40" y="50" font-family="Arial, sans-serif" font-size="8" text-anchor="middle" fill="#888">Stage</text>
  </svg>`;
  
  // Convert SVG to buffer
  return Buffer.from(svg, 'utf8');
};

// Get stage names for a plant type (matching the backend definitions)
const getStageNames = (plantType) => {
  const stageMap = {
    tomato: ['germination', 'seedling', 'vegetative_growth', 'flowering', 'fruiting', 'ripening'],
    pepper: ['germination', 'seedling', 'vegetative_growth', 'flowering', 'fruiting', 'ripening'],
    lettuce: ['germination', 'seedling', 'vegetative_growth', 'maturity'],
    basil: ['germination', 'seedling', 'vegetative_growth', 'harvest'],
    sunflower: ['germination', 'seedling', 'vegetative_growth', 'budding', 'flowering', 'seed_maturation'],
    aloe: ['propagation', 'establishment', 'juvenile_growth', 'maturity']
  };
  
  return stageMap[plantType] || [];
};

async function uploadPlantStageData(plantType, stageName) {
  try {
    console.log(`Uploading ${plantType} - ${stageName}...`);
    
    const form = new FormData();
    
    // Create a dummy image since we don't have real images yet
    const dummyImage = createDummyImage();
    form.append('file', dummyImage, {
      filename: `${plantType}-${stageName}-placeholder.svg`,
      contentType: 'image/svg+xml'
    });
    
    form.append('plantType', plantType);
    form.append('stageName', stageName);
    form.append('uploadedBy', 'automated-data-upload');
    form.append('contentType', 'image/svg+xml');
    
    const response = await fetch(UPLOAD_ENDPOINT, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log(`✅ Successfully uploaded ${plantType} - ${stageName}`);
      console.log(`   Stage Order: ${result.data.stageOrder}`);
      return result;
    } else {
      console.error(`❌ Failed to upload ${plantType} - ${stageName}:`, result.error || result);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error uploading ${plantType} - ${stageName}:`, error.message);
    return null;
  }
}

async function uploadAllPlantStages() {
  console.log('🌱 Starting bulk upload of plant growth stage data...');
  console.log(`🌐 Upload endpoint: ${UPLOAD_ENDPOINT}`);
  console.log('');
  
  const results = {
    successful: [],
    failed: []
  };
  
  for (const plantType of PLANT_TYPES) {
    console.log(`\n📋 Processing ${plantType.toUpperCase()}:`);
    
    const stages = getStageNames(plantType);
    console.log(`   Found ${stages.length} stages: ${stages.join(', ')}`);
    
    for (const stageName of stages) {
      const result = await uploadPlantStageData(plantType, stageName);
      
      if (result) {
        results.successful.push({ plantType, stageName, result });
      } else {
        results.failed.push({ plantType, stageName });
      }
      
      // Small delay between uploads
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Summary
  console.log('\n📊 Upload Summary:');
  console.log(`✅ Successful: ${results.successful.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  
  if (results.successful.length > 0) {
    console.log('\n✅ Successfully uploaded:');
    results.successful.forEach(({ plantType, stageName }) => {
      console.log(`   - ${plantType}: ${stageName}`);
    });
  }
  
  if (results.failed.length > 0) {
    console.log('\n❌ Failed uploads:');
    results.failed.forEach(({ plantType, stageName }) => {
      console.log(`   - ${plantType}: ${stageName}`);
    });
  }
  
  console.log('\n🎉 Upload process completed!');
  console.log('\n💡 Note: Placeholder images were used. You can replace them with real images later.');
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
🌱 Plant Growth Stage Data Uploader

Usage: node upload-plant-stages.js [options]

Options:
  --help, -h     Show this help message
  
This script uploads growth stage data for multiple plant types to Firebase Storage and
creates metadata entries in MongoDB via the upload-growth-stage-images function.

Plant types included:
  - Tomato (6 stages): germination → ripening
  - Pepper (6 stages): germination → ripening
  - Lettuce (4 stages): germination → maturity
  - Basil (4 stages): germination → harvest
  - Sunflower (6 stages): germination → seed_maturation
  - Aloe (4 stages): propagation → maturity

Before running:
1. Make sure your Netlify dev server is running (netlify dev)
2. Or update UPLOAD_ENDPOINT to point to your deployed function

Note: This script uses placeholder images since real images aren't available yet.
The static growth stage data (durations, care instructions, etc.) will be stored.
`);
  process.exit(0);
}

// Run the upload
uploadAllPlantStages().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
}); 