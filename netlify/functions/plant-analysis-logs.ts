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

interface AnalysisLog {
  _id?: ObjectId;
  userId: string;
  userPlantId: ObjectId;
  plantId: string; // References plant_basics._id
  analysisDate: string;
  currentStage: {
    stageName: string;
    stageDisplayName: string;
    estimatedLifeDays: number;
    currentStageStartDays: number;
    currentStageEndDays: number;
    daysIntoStage: number;
    stageDurationDays: number;
    stageProgressPercent: number;
    daysLeftInStage: number;
    nextStageName: string;
    nextStageDisplayName: string;
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
  actionItemIds: string[]; // Array of custom action IDs
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
    const analysisLogsCollection = db.collection<AnalysisLog>('user_plant_analysis_logs')
    const actionItemsCollection = db.collection('action_items')

    const method = event.httpMethod

    switch (method) {
      case 'POST': {
        // Create new analysis log with action items
        const analysisData = JSON.parse(event.body || '{}')
        
        // Validate required fields
        if (!analysisData.userPlantId || !analysisData.plantId || !analysisData.currentStage) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Missing required fields: userPlantId, plantId, currentStage' })
          }
        }

        // Generate action item IDs
        const actionItemIds: string[] = []
        const actionItemsToCreate: any[] = []

        if (analysisData.actionItems && Array.isArray(analysisData.actionItems)) {
          for (const actionItem of analysisData.actionItems) {
            const actionId = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            actionItemIds.push(actionId)
            
            actionItemsToCreate.push({
              actionId,
              userPlantId: new ObjectId(analysisData.userPlantId),
              userId: authorizedUserId,
              plantId: analysisData.plantId,
              task: actionItem.task,
              priority: actionItem.priority || 'medium',
              category: actionItem.category || 'general',
              dueDate: actionItem.dueDate,
              createdDate: new Date().toISOString(),
              status: 'pending'
            })
          }
        }

        // Create analysis log
        const analysisLog: AnalysisLog = {
          userId: authorizedUserId,
          userPlantId: new ObjectId(analysisData.userPlantId),
          plantId: analysisData.plantId,
          analysisDate: new Date().toISOString(),
          currentStage: analysisData.currentStage,
          careInstructions: analysisData.careInstructions,
          nextCheckupDate: analysisData.nextCheckupDate,
          actionItemIds
        }

        // Insert analysis log
        const logResult = await analysisLogsCollection.insertOne(analysisLog)
        
        // Insert action items with reference to analysis log
        if (actionItemsToCreate.length > 0) {
          const actionItemsWithLogId = actionItemsToCreate.map(item => ({
            ...item,
            analysisLogId: logResult.insertedId
          }))
          
          await actionItemsCollection.insertMany(actionItemsWithLogId)
        }

        return {
          statusCode: 201,
          headers: corsHeaders,
          body: JSON.stringify({
            message: 'Analysis log created successfully',
            analysisLogId: logResult.insertedId,
            actionItemIds
          })
        }
      }

      case 'GET': {
        const userPlantId = event.queryStringParameters?.userPlantId
        const analysisLogId = event.queryStringParameters?.analysisLogId
        
        if (analysisLogId) {
          // Get specific analysis log
          const log = await analysisLogsCollection.findOne({
            _id: new ObjectId(analysisLogId),
            userId: authorizedUserId
          })

          if (!log) {
            return {
              statusCode: 404,
              headers: corsHeaders,
              body: JSON.stringify({ error: 'Analysis log not found' })
            }
          }

          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(log)
          }
        }

        if (userPlantId) {
          // Get all analysis logs for a user plant
          const logs = await analysisLogsCollection
            .find({ 
              userPlantId: new ObjectId(userPlantId),
              userId: authorizedUserId 
            })
            .sort({ analysisDate: -1 })
            .toArray()

          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(logs)
          }
        }

        // Get all analysis logs for user
        const logs = await analysisLogsCollection
          .find({ userId: authorizedUserId })
          .sort({ analysisDate: -1 })
          .toArray()

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(logs)
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
    console.error('Error in plant-analysis-logs function:', error)
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