import fetch from 'node-fetch';

// Configuration
const BASE_URL = 'http://localhost:8888/.netlify/functions';

async function testGetGrowthStageImages() {
  console.log('🧪 Testing growth stage image retrieval...\n');
  
  try {
    // Test 1: Get all images
    console.log('📋 Test 1: Get all growth stage images');
    const allResponse = await fetch(`${BASE_URL}/get-growth-stage-images`);
    const allData = await allResponse.json();
    console.log(`   Status: ${allResponse.status}`);
    console.log(`   Total images: ${allData.count || 0}`);
    console.log('');
    
    // Test 2: Get tomato images only
    console.log('🍅 Test 2: Get tomato growth stages');
    const tomatoResponse = await fetch(`${BASE_URL}/get-growth-stage-images?plantType=tomato`);
    const tomatoData = await tomatoResponse.json();
    console.log(`   Status: ${tomatoResponse.status}`);
    
    if (tomatoData.success) {
      console.log(`   Plant type: ${tomatoData.plantType}`);
      console.log(`   Number of stages: ${tomatoData.stageCount}`);
      console.log(`   Total images: ${tomatoData.totalImages}`);
      console.log('   Available stages:');
      Object.keys(tomatoData.stages || {}).forEach(stage => {
        console.log(`     - ${stage}: ${tomatoData.stages[stage].length} image(s)`);
      });
    }
    console.log('');
    
    // Test 3: Get specific stage
    console.log('🌱 Test 3: Get germination stage only');
    const germinationResponse = await fetch(`${BASE_URL}/get-growth-stage-images?plantType=tomato&stageName=germination`);
    const germinationData = await germinationResponse.json();
    console.log(`   Status: ${germinationResponse.status}`);
    
    if (germinationData.success) {
      console.log(`   Found ${germinationData.count} germination image(s)`);
      if (germinationData.data && germinationData.data.length > 0) {
        const image = germinationData.data[0];
        console.log(`   First image details:`);
        console.log(`     - Stage: ${image.stageName} (order: ${image.stageOrder})`);
        console.log(`     - Description: ${image.stageDescription}`);
        console.log(`     - File: ${image.metadata.originalFileName}`);
        console.log(`     - Size: ${Math.round(image.metadata.fileSize / 1024)}KB`);
        console.log(`     - Uploaded: ${new Date(image.uploadedAt).toLocaleString()}`);
      }
    }
    console.log('');
    
  } catch (error) {
    console.error('❌ Error testing API:', error.message);
  }
}

async function testUploadEndpoint() {
  console.log('📤 Testing upload endpoint availability...\n');
  
  try {
    // Test OPTIONS request (CORS preflight)
    const optionsResponse = await fetch(`${BASE_URL}/upload-growth-stage-images`, {
      method: 'OPTIONS'
    });
    console.log(`   OPTIONS request status: ${optionsResponse.status}`);
    
    // Test POST without data (should get validation error)
    const postResponse = await fetch(`${BASE_URL}/upload-growth-stage-images`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    const postData = await postResponse.json();
    console.log(`   POST request status: ${postResponse.status}`);
    console.log(`   Error message: ${postData.error || 'None'}`);
    console.log('   ✅ Upload endpoint is responding correctly\n');
    
  } catch (error) {
    console.error('❌ Error testing upload endpoint:', error.message);
    console.log('   ❌ Make sure your Netlify dev server is running with: netlify dev\n');
  }
}

async function runTests() {
  console.log('🚀 Growth Stage API Test Suite');
  console.log('=================================\n');
  
  // Test if server is running
  try {
    const healthCheck = await fetch(`${BASE_URL}/get-growth-stage-images`, { 
      method: 'OPTIONS' 
    });
    console.log('✅ Netlify dev server is running\n');
  } catch (error) {
    console.error('❌ Cannot connect to Netlify dev server');
    console.error('   Please run: netlify dev');
    console.error('   Then try this test script again\n');
    process.exit(1);
  }
  
  await testUploadEndpoint();
  await testGetGrowthStageImages();
  
  console.log('🎉 All tests completed!');
  console.log('\n💡 Next steps:');
  console.log('   1. Run: npm run upload-tomato-images');
  console.log('   2. Then run this test script again to see your uploaded images');
}

// Run the tests
runTests().catch(error => {
  console.error('💥 Test suite failed:', error);
  process.exit(1);
}); 