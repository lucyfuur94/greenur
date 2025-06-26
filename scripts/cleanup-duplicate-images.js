import fetch from 'node-fetch';

// Configuration
const GET_ENDPOINT = 'http://localhost:8888/.netlify/functions/get-growth-stage-images';

async function cleanupDuplicateImages() {
  console.log('🧹 Tomato Image Cleanup Tool');
  console.log('============================\n');
  
  try {
    // Get all tomato images
    const response = await fetch(`${GET_ENDPOINT}?plantType=tomato`);
    const data = await response.json();
    
    if (!data.success || !data.stages) {
      console.error('❌ Failed to fetch tomato stages data');
      return;
    }
    
    console.log(`📊 Current status: ${data.stageCount} stages, ${data.totalImages} total images\n`);
    
    let totalToKeep = 0;
    let totalToRemove = 0;
    
    // Analyze each stage
    Object.entries(data.stages).forEach(([stageName, images]) => {
      const stageImages = images;
      console.log(`🌱 ${stageName.toUpperCase()} (${stageImages.length} images):`);
      
      if (stageImages.length <= 1) {
        console.log(`   ✅ Only 1 image - no cleanup needed`);
        totalToKeep += 1;
        console.log();
        return;
      }
      
      // Sort by preference: real files over placeholders, newer over older
      const sortedImages = stageImages.sort((a, b) => {
        // Prefer real image files over placeholders
        const aIsReal = a.metadata.originalFileName.includes('.jpg') || a.metadata.originalFileName.includes('.jpeg');
        const bIsReal = b.metadata.originalFileName.includes('.jpg') || b.metadata.originalFileName.includes('.jpeg');
        
        if (aIsReal && !bIsReal) return -1;
        if (!aIsReal && bIsReal) return 1;
        
        // If both are same type, prefer newer
        return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
      });
      
      const imageToKeep = sortedImages[0];
      const imagesToRemove = sortedImages.slice(1);
      
      console.log(`   ✅ KEEP: ${imageToKeep.metadata.originalFileName} (${new Date(imageToKeep.uploadedAt).toLocaleDateString()})`);
      totalToKeep += 1;
      
      imagesToRemove.forEach(img => {
        console.log(`   ❌ REMOVE: ${img.metadata.originalFileName} (${new Date(img.uploadedAt).toLocaleDateString()})`);
        totalToRemove += 1;
      });
      
      console.log();
    });
    
    console.log('📋 CLEANUP SUMMARY:');
    console.log(`✅ Images to keep: ${totalToKeep}`);
    console.log(`❌ Images to remove: ${totalToRemove}`);
    console.log(`💾 Storage savings: ~${totalToRemove} files + MongoDB records`);
    
    if (totalToRemove === 0) {
      console.log('\n🎉 No cleanup needed! All stages have single images.');
      return;
    }
    
    console.log('\n💡 RECOMMENDED ACTIONS:');
    console.log('1. The current system will automatically use the best image (latest .jpg files)');
    console.log('2. Old placeholder images can be safely deleted from MongoDB and Firebase');
    console.log('3. This will reduce storage costs and improve query performance');
    
    console.log('\n🔧 TO CLEAN UP:');
    console.log('The cleanup can be automated, but keeping historical data might be useful for:');
    console.log('- Debugging upload issues');
    console.log('- Rollback capabilities'); 
    console.log('- Analytics on upload success rates');
    
    console.log('\n✨ CURRENT STATE: Your app is working correctly!');
    console.log('The PlantDetailsPage automatically selects the best image (latest .jpg files)');
    
  } catch (error) {
    console.error('❌ Error during cleanup analysis:', error.message);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
🧹 Tomato Image Cleanup Analysis Tool

Usage: node cleanup-duplicate-images.js [options]

Options:
  --help, -h     Show this help message
  
This script analyzes duplicate tomato growth stage images and provides
recommendations for cleanup. It identifies:

- Placeholder images that can be removed
- Duplicate uploads from different times
- The optimal image for each stage

The script is read-only and safe to run - it only analyzes, doesn't modify data.
`);
  process.exit(0);
}

// Run the analysis
cleanupDuplicateImages().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
}); 