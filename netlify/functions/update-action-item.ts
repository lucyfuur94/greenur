import { Handler } from '@netlify/functions'
import { MongoClient, ObjectId } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const MONGO_URI = process.env.MONGO_URI
const DB_NAME = process.env.MONGODB_DB || 'master'

interface ActionItemUpdate {
  checkupId: string;
  actionItemId: string;
  completed?: boolean;
  comment?: {
    text: string;
    userId: string;
  };
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
} as const;

export const handler: Handler = async (event, context) => {
  // Disable waiting for empty event loop to prevent timeouts
  if (context) {
    context.callbackWaitsForEmptyEventLoop = false;
  }

  let client: MongoClient | null = null;

  try {
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 204,
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

    const update: ActionItemUpdate = JSON.parse(event.body || '{}');
    
    if (!update.checkupId || !update.actionItemId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    client = await MongoClient.connect(MONGO_URI!);
    const db = client.db(DB_NAME);
    const checkupsCollection = db.collection('plant_checkups');

    const checkup = await checkupsCollection.findOne({ 
      _id: new ObjectId(update.checkupId)
    });

    if (!checkup) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Checkup not found' })
      };
    }

    // Initialize actionItems array if it doesn't exist
    if (!checkup.actionItems) {
      checkup.actionItems = [];
    }

    // Find the action item
    const actionItemIndex = checkup.actionItems.findIndex(
      (item: any) => item.id === update.actionItemId
    );

    if (actionItemIndex === -1) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Action item not found' })
      };
    }

    // Update completed status if provided
    if (typeof update.completed === 'boolean') {
      checkup.actionItems[actionItemIndex].completed = update.completed;
      if (update.completed) {
        checkup.actionItems[actionItemIndex].completedAt = new Date().toISOString();
      } else {
        delete checkup.actionItems[actionItemIndex].completedAt;
      }
    }

    // Add comment if provided
    if (update.comment) {
      if (!checkup.actionItems[actionItemIndex].comments) {
        checkup.actionItems[actionItemIndex].comments = [];
      }
      checkup.actionItems[actionItemIndex].comments.push({
        ...update.comment,
        timestamp: new Date().toISOString()
      });
    }

    // Update the document
    await checkupsCollection.updateOne(
      { _id: new ObjectId(update.checkupId) },
      { $set: { actionItems: checkup.actionItems } }
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Action item updated successfully',
        actionItem: checkup.actionItems[actionItemIndex]
      })
    };

  } catch (error) {
    console.error('Error updating action item:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: error instanceof Error ? error.stack : undefined
      })
    };
  } finally {
    if (client) {
      await client.close();
    }
  }
}; 