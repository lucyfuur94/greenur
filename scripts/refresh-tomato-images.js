import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const IMAGES_DIRECTORY = path.join(__dirname, '..', 'Datasets', 'Tomato');
const UPLOAD_ENDPOINT = 'http://localhost:8888/.netlify/functions/upload-growth-stage-images';

// Mapping of file names to growth stages
const FILE_STAGE_MAPPING = {
  'tomato-germination.jpg': 'germination',
  'tomato-seedling.jpg': 'seedling',
  'tomato-vegetative_growth.jpg': 'vegetative_growth',
  'tomato-flowering.jpg': 'flowering',
  'tomatoe-fruiting.jpg': 'fruiting',  // Note: keeping original filename spelling
  'tomato-ripening.jpg': 'ripening'
};

async function uploadImage(filePath, stageName) {
  try {
    console.log(`📤 Uploading ${path.basename(filePath)} as ${stageName}...`);
    
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('plantType', 'tomato');
    form.append('stageName', stageName);
    form.append('uploadedBy', 'refresh-script');
    form.append('contentType', 'image/jpeg');
    
    const response = await fetch(UPLOAD_ENDPOINT, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log(`✅ Successfully uploaded ${path.basename(filePath)}`);
      console.log(`   Stage: ${stageName} (order: ${result.data.stageOrder})`);
      console.log(`   Image URL: ${result.data.imageUrl.substring(0, 50)}...`);
      return result;
    } else {
      console.error(`❌ Failed to upload ${path.basename(filePath)}:`, result.error || result);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error uploading ${path.basename(filePath)}:`, error.message);
    return null;
  }
}

async function verifyUploads() {
  try {
    console.log('🔍 Verifying uploads...');
    
    const response = await fetch('http://localhost:8888/.netlify/functions/get-growth-stage-images?plantType=tomato');
    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log(`✅ Verification successful:`);
      console.log(`   Plant type: ${result.plantType}`);
      console.log(`   Number of stages: ${result.stageCount}`);
      console.log(`   Total images: ${result.totalImages}`);
      console.log('   Available stages:');
      
      Object.keys(result.stages || {}).forEach(stage => {
        const images = result.stages[stage];
        console.log(`     - ${stage}: ${images.length} image(s)`);
        if (images.length > 0) {
          console.log(`       Order: ${images[0].stageOrder}, File: ${images[0].metadata.originalFileName}`);
        }
      });
      
      return result.stageCount === 6; // Should have all 6 stages
    } else {
      console.error(`❌ Verification failed:`, result.error || result);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error during verification:`, error.message);
    return false;
  }
}

async function refreshTomatoImages() {
  console.log('🍅 Tomato Growth Stage Images Refresh Tool');
  console.log('===========================================');
  console.log(`📁 Source directory: ${IMAGES_DIRECTORY}`);
  console.log(`📤 Upload endpoint: ${UPLOAD_ENDPOINT}`);
  console.log('');
  console.log('ℹ️  Note: Using upsert functionality to replace existing images');
  console.log('');
  
  // Check if directory exists
  if (!fs.existsSync(IMAGES_DIRECTORY)) {
    console.error(`❌ Directory not found: ${IMAGES_DIRECTORY}`);
    process.exit(1);
  }
  
  // Get list of image files
  const files = fs.readdirSync(IMAGES_DIRECTORY)
    .filter(file => file.toLowerCase().endsWith('.jpg') || file.toLowerCase().endsWith('.jpeg') || file.toLowerCase().endsWith('.png'))
    .filter(file => FILE_STAGE_MAPPING[file]);
  
  if (files.length === 0) {
    console.error('❌ No matching image files found');
    console.error('Expected files:');
    Object.keys(FILE_STAGE_MAPPING).forEach(file => {
      console.error(`   - ${file}`);
    });
    process.exit(1);
  }
  
  console.log(`📸 Found ${files.length} image files to process:`);
  files.forEach(file => {
    const filePath = path.join(IMAGES_DIRECTORY, file);
    const stats = fs.statSync(filePath);
    const sizeKB = Math.round(stats.size / 1024);
    console.log(`   - ${file} → ${FILE_STAGE_MAPPING[file]} (${sizeKB}KB)`);
  });
  console.log('');
  
  console.log('📤 Uploading/Replacing images...');
  
  const results = {
    successful: [],
    failed: []
  };
  
  // Upload each file (will replace existing due to upsert)
  for (const file of files) {
    const filePath = path.join(IMAGES_DIRECTORY, file);
    const stageName = FILE_STAGE_MAPPING[file];
    
    const result = await uploadImage(filePath, stageName);
    
    if (result) {
      results.successful.push({ file, stageName, result });
    } else {
      results.failed.push({ file, stageName });
    }
    
    // Add a small delay between uploads
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('');
  
  // Verify uploads
  const verifySuccess = await verifyUploads();
  
  console.log('');
  console.log('📊 Final Summary:');
  console.log(`✅ Successful uploads: ${results.successful.length}`);
  console.log(`❌ Failed uploads: ${results.failed.length}`);
  console.log(`🔍 Verification: ${verifySuccess ? 'PASSED' : 'FAILED'}`);
  
  if (results.successful.length > 0) {
    console.log('\n✅ Successfully uploaded:');
    results.successful.forEach(({ file, stageName }) => {
      console.log(`   - ${file} (${stageName})`);
    });
  }
  
  if (results.failed.length > 0) {
    console.log('\n❌ Failed uploads:');
    results.failed.forEach(({ file, stageName }) => {
      console.log(`   - ${file} (${stageName})`);
    });
  }
  
  if (verifySuccess) {
    console.log('\n🎉 Tomato images refresh completed successfully!');
    console.log('Your tomato growth stages should now display properly in the app.');
  } else {
    console.log('\n⚠️  Refresh completed with issues. Please check the logs above.');
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
🍅 Tomato Growth Stage Images Refresh Tool

Usage: node refresh-tomato-images.js [options]

Options:
  --help, -h     Show this help message
  
This script will:
1. Upload all tomato images from the Datasets/Tomato directory
2. Use upsert functionality to replace any existing images
3. Verify that all stages are properly uploaded

Before running:
1. Make sure your Netlify dev server is running (netlify dev)
2. Ensure all tomato images are in the Datasets/Tomato directory

Expected image files:
  - tomato-germination.jpg → germination
  - tomato-seedling.jpg → seedling  
  - tomato-vegetative_growth.jpg → vegetative_growth
  - tomato-flowering.jpg → flowering
  - tomatoe-fruiting.jpg → fruiting
  - tomato-ripening.jpg → ripening
`);
  process.exit(0);
}

// Run the refresh
refreshTomatoImages().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
}); 