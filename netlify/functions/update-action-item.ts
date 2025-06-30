import { Handler } from '@netlify/functions'
import { MongoClient, ObjectId } from 'mongodb'
import dotenv from 'dotenv'
import { verifyAuthToken } from './utils/firebaseAdmin'

dotenv.config()

const MONGO_URI = process.env.MONGO_URI
const DB_NAME = process.env.MONGODB_DB || 'master'

interface ActionItem {
  _id?: ObjectId;
  actionId: string; // Custom action ID (unique identifier)
  userPlantId: ObjectId; // References user_plants._id
  userId: string; // Firebase user ID
  plantId: string; // References plant_basics._id
  task: string
  priority: 'high' | 'medium' | 'low'
  category: 'watering' | 'fertilizing' | 'pruning' | 'monitoring' | 'pest_control' | 'general'
  dueDate: string
  status: 'pending' | 'completed' | 'discarded'
  completedDate?: string
  comment?: string
  createdDate: string
  updatedDate?: string
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
} as const

const handler: Handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  let client: MongoClient | null = null;

  try {
    // Verify authentication for all methods
    const authHeader = event.headers.authorization
    const authorizedUserId = await verifyAuthToken(authHeader)
    
    if (!authorizedUserId) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Unauthorized: Invalid or missing authentication token' })
      }
    }

    const userId = authorizedUserId;

    // Connect to MongoDB
    if (!MONGO_URI) {
      throw new Error('MONGO_URI environment variable is not set');
    }

    client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const actionItemsCollection = db.collection<ActionItem>('action_items');
    const userPlantsCollection = db.collection('user_plants');

    if (event.httpMethod === 'GET') {
      // Get action items for a plant
      const plantId = event.queryStringParameters?.plantId;
      
      if (!plantId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Plant ID is required' })
        };
      }

      // Verify user owns the plant
      const plant = await userPlantsCollection.findOne({
        _id: new ObjectId(plantId),
        userId: userId
      });

      if (!plant) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Plant not found' })
        };
      }

      // Get action items from the action_items collection
      const actionItems = await actionItemsCollection
        .find({ 
          userPlantId: new ObjectId(plantId),
          userId: userId 
        })
        .sort({
          status: 1, // pending first
          priority: 1, // high priority first
          dueDate: 1 // earliest due date first
        })
        .toArray();

      // Sort with custom logic
      const sortedItems = actionItems.sort((a, b) => {
        // First sort by status (pending first)
        if (a.status !== b.status) {
          if (a.status === 'pending') return -1;
          if (b.status === 'pending') return 1;
          if (a.status === 'completed') return -1;
          if (b.status === 'completed') return 1;
        }
        
        // Then by overdue items (past due date)
        const now = new Date();
        const aDue = new Date(a.dueDate);
        const bDue = new Date(b.dueDate);
        const aOverdue = aDue < now;
        const bOverdue = bDue < now;
        
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;
        
        // Then by priority
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        
        // Finally by due date
        return aDue.getTime() - bDue.getTime();
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true,
          actionItems: sortedItems
        })
      };
    }

    if (event.httpMethod === 'POST') {
      // Add new action items (usually from analysis)
      const { plantId, actionItems: newActionItems } = JSON.parse(event.body || '{}');

      if (!plantId || !Array.isArray(newActionItems)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Plant ID and action items array are required' })
        };
      }

      // Verify user owns the plant
      const plant = await userPlantsCollection.findOne({
        _id: new ObjectId(plantId),
        userId: userId
      });

      if (!plant) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Plant not found' })
        };
      }

      // Create action items with IDs and timestamps
      const formattedActionItems = newActionItems.map(item => ({
        actionId: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userPlantId: new ObjectId(plantId), // This is the user's plant instance ID
        userId: userId,
        plantId: plant.plantId, // This should always be the plant type ID from plant_basics
        task: item.task,
        priority: item.priority,
        category: item.category,
        dueDate: item.dueDate,
        status: 'pending' as const,
        createdDate: new Date().toISOString()
      }));

      // Insert into action_items collection
      const result = await actionItemsCollection.insertMany(formattedActionItems);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true,
          added: result.insertedCount,
          message: 'Action items added successfully'
        })
      };
    }

    if (event.httpMethod === 'PUT') {
      // Update action item status
      const { actionId, status, comment } = JSON.parse(event.body || '{}');

      if (!actionId || !status) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Action ID and status are required' })
        };
      }

      // Find the action item first to verify ownership
      const existingItem = await actionItemsCollection.findOne({
        actionId,
        userId: userId
      });

      if (!existingItem) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Action item not found' })
        };
      }

      const updateData: any = {
        status,
        updatedDate: new Date().toISOString()
      };

      if (status === 'completed' || status === 'discarded') {
        updateData.completedDate = new Date().toISOString();
      }

      if (comment !== undefined) {
        updateData.comment = comment;
      }

      // Update the action item
      const result = await actionItemsCollection.updateOne(
        { actionId, userId },
        { $set: updateData }
      );

      if (result.matchedCount === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Action item not found' })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true,
          message: 'Action item updated successfully'
        })
      };
    }

    if (event.httpMethod === 'DELETE') {
      // Delete action item
      const actionId = event.queryStringParameters?.actionId;

      if (!actionId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Action ID is required' })
        };
      }

      // Delete the action item (verify ownership)
      const result = await actionItemsCollection.deleteOne({
        actionId,
        userId: userId
      });

      if (result.deletedCount === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Action item not found' })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true,
          message: 'Action item deleted successfully'
        })
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };

  } catch (error) {
    console.error('Error in action item handler:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
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