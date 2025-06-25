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
const UPLOAD_ENDPOINT = 'http://localhost:8888/.netlify/functions/upload-growth-stage-images'; // Change to your deployed URL when ready

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
    console.log(`Uploading ${path.basename(filePath)} as ${stageName}...`);
    
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('plantType', 'tomato');
    form.append('stageName', stageName);
    form.append('uploadedBy', 'bulk-upload-script');
    form.append('contentType', 'image/jpeg');
    
    const response = await fetch(UPLOAD_ENDPOINT, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log(`✅ Successfully uploaded ${path.basename(filePath)}`);
      console.log(`   Image URL: ${result.data.imageUrl}`);
      console.log(`   Firebase Path: ${result.data.firebasePath}`);
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

async function uploadAllTomatoImages() {
  console.log('🍅 Starting bulk upload of tomato growth stage images...');
  console.log(`📁 Source directory: ${IMAGES_DIRECTORY}`);
  console.log(`🌐 Upload endpoint: ${UPLOAD_ENDPOINT}`);
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
    process.exit(1);
  }
  
  console.log(`📸 Found ${files.length} image files to upload:`);
  files.forEach(file => {
    console.log(`   - ${file} → ${FILE_STAGE_MAPPING[file]}`);
  });
  console.log('');
  
  const results = {
    successful: [],
    failed: []
  };
  
  // Upload each file
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
  
  // Summary
  console.log('');
  console.log('📊 Upload Summary:');
  console.log(`✅ Successful: ${results.successful.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  
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
  
  console.log('\n🎉 Bulk upload completed!');
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
🍅 Tomato Growth Stage Image Uploader

Usage: node upload-tomato-images.js [options]

Options:
  --help, -h     Show this help message
  --dry-run      Show what would be uploaded without actually uploading
  
This script uploads tomato growth stage images to Firebase Storage and
creates metadata entries in MongoDB via the upload-growth-stage-images function.

Before running:
1. Make sure your Netlify dev server is running (netlify dev)
2. Or update UPLOAD_ENDPOINT to point to your deployed function
3. Ensure all tomato images are in the Datasets/Tomato directory

Image files and their mapped stages:
  - tomato-germination.jpg → germination
  - tomato-seedling.jpg → seedling  
  - tomato-vegetative_growth.jpg → vegetative_growth
  - tomato-flowering.jpg → flowering
  - tomatoe-fruiting.jpg → fruiting
  - tomato-ripening.jpg → ripening
`);
  process.exit(0);
}

if (args.includes('--dry-run')) {
  console.log('🔍 DRY RUN MODE - No files will be uploaded');
  console.log('');
  
  const files = fs.readdirSync(IMAGES_DIRECTORY)
    .filter(file => file.toLowerCase().endsWith('.jpg') || file.toLowerCase().endsWith('.jpeg') || file.toLowerCase().endsWith('.png'))
    .filter(file => FILE_STAGE_MAPPING[file]);
  
  console.log(`📸 Would upload ${files.length} files:`);
  files.forEach(file => {
    const filePath = path.join(IMAGES_DIRECTORY, file);
    const stats = fs.statSync(filePath);
    const sizeKB = Math.round(stats.size / 1024);
    console.log(`   - ${file} → ${FILE_STAGE_MAPPING[file]} (${sizeKB}KB)`);
  });
  
  process.exit(0);
}

// Run the upload
uploadAllTomatoImages().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
}); 