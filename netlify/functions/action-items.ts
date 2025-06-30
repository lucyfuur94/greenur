import { Handler } from '@netlify/functions'
import { MongoClient, ObjectId } from 'mongodb'
import dotenv from 'dotenv'
import { verifyAuthToken } from './utils/firebaseAdmin'

dotenv.config()

const MONGO_URI = process.env.MONGO_URI
const DB_NAME = process.env.MONGODB_DB || 'master'

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

interface ActionItem {
  _id?: ObjectId;
  actionId: string; // Custom action ID (unique identifier)
  analysisLogId: ObjectId; // References user_plant_analysis_logs._id
  userPlantId: ObjectId; // References user_plants._id
  userId: string; // Firebase user ID
  plantId: string; // References plant_basics._id
  task: string;
  priority: 'high' | 'medium' | 'low';
  category: 'watering' | 'fertilizing' | 'pruning' | 'monitoring' | 'pest_control' | 'general';
  dueDate: string;
  createdDate: string;
  status: 'pending' | 'completed' | 'discarded';
  completedDate?: string;
  comment?: string;
  updatedDate?: string;
}

export const handler: Handler = async (event, context) => {
  if (context) {
    context.callbackWaitsForEmptyEventLoop = false;
  }

  let client: MongoClient | null = null

  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 204,
        headers: corsHeaders,
        body: '',
      }
    }

    // Verify authentication for all methods
    const authHeader = event.headers.authorization
    const authorizedUserId = await verifyAuthToken(authHeader)
    
    if (!authorizedUserId) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Unauthorized: Invalid or missing authentication token' })
      }
    }

    // Connect to MongoDB
    client = new MongoClient(MONGO_URI!)
    await client.connect()

    const db = client.db(DB_NAME)
    const collection = db.collection<ActionItem>('action_items')

    const method = event.httpMethod

    switch (method) {
      case 'GET': {
        const userPlantId = event.queryStringParameters?.userPlantId
        const actionId = event.queryStringParameters?.actionId
        const analysisLogId = event.queryStringParameters?.analysisLogId
        const status = event.queryStringParameters?.status
        
        let query: any = { userId: authorizedUserId }

        if (actionId) {
          // Get specific action item by actionId
          query.actionId = actionId
          
          const actionItem = await collection.findOne(query)
          
          if (!actionItem) {
            return {
              statusCode: 404,
              headers: corsHeaders,
              body: JSON.stringify({ error: 'Action item not found' })
            }
          }

          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(actionItem)
          }
        }

        if (userPlantId) {
          query.userPlantId = new ObjectId(userPlantId)
        }

        if (analysisLogId) {
          query.analysisLogId = new ObjectId(analysisLogId)
        }

        if (status) {
          query.status = status
        }

        // Get action items with filtering
        const actionItems = await collection
          .find(query)
          .sort({ 
            status: 1, // pending first
            priority: 1, // high priority first
            dueDate: 1 // earliest due date first
          })
          .toArray()

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
          headers: corsHeaders,
          body: JSON.stringify(sortedItems)
        }
      }

      case 'PUT': {
        // Update action item status, add comments, etc.
        const { actionId, status, comment } = JSON.parse(event.body || '{}')
        
        if (!actionId) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'actionId is required' })
          }
        }

        // Find the action item first to verify ownership
        const existingItem = await collection.findOne({
          actionId,
          userId: authorizedUserId
        })

        if (!existingItem) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Action item not found' })
          }
        }

        const updateData: any = {
          updatedDate: new Date().toISOString()
        }

        if (status) {
          updateData.status = status
          if (status === 'completed' || status === 'discarded') {
            updateData.completedDate = new Date().toISOString()
          }
        }

        if (comment !== undefined) {
          updateData.comment = comment
        }

        const result = await collection.updateOne(
          { actionId, userId: authorizedUserId },
          { $set: updateData }
        )

        if (result.matchedCount === 0) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Action item not found' })
          }
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ 
            message: 'Action item updated successfully',
            actionId
          })
        }
      }

      case 'POST': {
        // Create individual action item (usually called from analysis-logs function)
        const actionItemData = JSON.parse(event.body || '{}')
        
        // Validate required fields
        if (!actionItemData.actionId || !actionItemData.userPlantId || !actionItemData.task) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Missing required fields: actionId, userPlantId, task' })
          }
        }

        const actionItem: ActionItem = {
          actionId: actionItemData.actionId,
          analysisLogId: new ObjectId(actionItemData.analysisLogId),
          userPlantId: new ObjectId(actionItemData.userPlantId),
          userId: authorizedUserId,
          plantId: actionItemData.plantId,
          task: actionItemData.task,
          priority: actionItemData.priority || 'medium',
          category: actionItemData.category || 'general',
          dueDate: actionItemData.dueDate,
          createdDate: new Date().toISOString(),
          status: 'pending'
        }

        const result = await collection.insertOne(actionItem)

        return {
          statusCode: 201,
          headers: corsHeaders,
          body: JSON.stringify({
            message: 'Action item created successfully',
            actionId: actionItem.actionId,
            _id: result.insertedId
          })
        }
      }

      case 'DELETE': {
        // Delete action item (optional - might want to keep for history)
        const actionId = event.queryStringParameters?.actionId
        
        if (!actionId) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'actionId is required' })
          }
        }

        const result = await collection.deleteOne({
          actionId,
          userId: authorizedUserId
        })

        if (result.deletedCount === 0) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Action item not found' })
          }
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ 
            message: 'Action item deleted successfully',
            actionId
          })
        }
      }

      default:
        return {
          statusCode: 405,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Method not allowed' })
        }
    }
  } catch (error) {
    console.error('Error in action-items function:', error)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  } finally {
    if (client) {
      await client.close()
    }
  }
} 