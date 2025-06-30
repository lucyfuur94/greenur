import { Handler } from '@netlify/functions';
import { MongoClient, ObjectId } from 'mongodb';
import { verifyAuthToken } from './utils/firebaseAdmin';

interface ActionItem {
  id: string;
  task: string;
  priority: 'high' | 'medium' | 'low';
  category: 'watering' | 'fertilizing' | 'pruning' | 'monitoring' | 'pest_control' | 'general';
  dueDate: string;
  status: 'pending' | 'completed' | 'discarded';
  completedDate?: string;
  comment?: string;
  createdDate: string;
}

interface PlantImageAnalysis {
  id: string;
  timestamp: string;
  currentStage: {
    stageName: string;
    stageDisplayName?: string;
    estimatedLifeDays: number;
    daysLeftInStage: number;
    nextStageName?: string;
    nextStageDisplayName?: string;
  };
  careInstructions: {
    light_requirement: string;
    water_requirement: string;
    soil_type: string;
    suitable_temperature: string;
    fertilizer: string;
    common_diseases: string;
  };
  nextCheckupDate: string;
  actionItems: ActionItem[];
}

const handler: Handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  let client: MongoClient | null = null;

  try {
    // Verify Firebase token using the utility
    const authHeader = event.headers.authorization;
    const userId = await verifyAuthToken(authHeader);
    
    if (!userId) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'No valid authorization token provided' })
      };
    }

    const { plantId, imageUrl, analysisResult } = JSON.parse(event.body || '{}');

    if (!plantId || !imageUrl || !analysisResult) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Plant ID, image URL, and analysis result are required' })
      };
    }

    // Connect to MongoDB
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI environment variable is not set');
    }

    client = new MongoClient(process.env.MONGO_URI);
    await client.connect();
    const db = client.db('master'); // Use correct database name
    const userPlantsCollection = db.collection('user_plants');
    const actionItemsCollection = db.collection('action_items');

    // Create analysis object with unique ID and timestamp
    const analysis: PlantImageAnalysis = {
      id: `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...analysisResult
    };

    // Update the plant's image history with the analysis
    // First, check if the image exists in imageHistory
    const plant = await userPlantsCollection.findOne({
      _id: new ObjectId(plantId),
      userId: userId
    });

    if (!plant) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Plant not found or access denied' })
      };
    }

    // Check if the image exists in imageHistory
    const imageExists = plant.imageHistory?.some((img: any) => img.url === imageUrl);
    
    let result;
    
    if (imageExists) {
      // Image exists, update its analysis
      result = await userPlantsCollection.updateOne(
        { 
          _id: new ObjectId(plantId),
          userId: userId,
          'imageHistory.url': imageUrl
        },
        {
          $set: {
            'imageHistory.$.analysis': analysis
          }
        }
      );
    } else {
      // Image doesn't exist, add it to imageHistory with the analysis
      const updateOperation: any = {
        $push: {
          imageHistory: {
            url: imageUrl,
            timestamp: new Date().toISOString(),
            analysis: analysis
          }
        },
        $set: {
          currentImage: imageUrl // Also update current image
        }
      };
      
      result = await userPlantsCollection.updateOne(
        { 
          _id: new ObjectId(plantId),
          userId: userId
        },
        updateOperation
      );
    }

    if (result.matchedCount === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Failed to update plant with analysis' })
      };
    }

    // Get the user's plant to access the plant type ID (refresh after update)
    const userPlant = await userPlantsCollection.findOne({
      _id: new ObjectId(plantId),
      userId: userId
    });

    // Store action items in the separate action_items collection
    if (analysis.actionItems && Array.isArray(analysis.actionItems) && analysis.actionItems.length > 0 && userPlant) {
      const actionItemsToCreate = analysis.actionItems.map(item => ({
        actionId: item.id,
        userPlantId: new ObjectId(plantId), // User's plant instance ID
        userId: userId,
        plantId: userPlant.plantId, // Plant type ID from plant_basics
        task: item.task,
        priority: item.priority,
        category: item.category,
        dueDate: item.dueDate,
        createdDate: item.createdDate,
        status: item.status,
        completedDate: item.completedDate,
        comment: item.comment
      }));

      await actionItemsCollection.insertMany(actionItemsToCreate);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true,
        analysisId: analysis.id,
        message: 'Analysis stored successfully'
      })
    };

  } catch (error) {
    console.error('Error storing plant analysis:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to store analysis',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  } finally {
    if (client) {
      await client.close();
    }
  }
};

export { handler }; 