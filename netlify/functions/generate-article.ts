import { Handler } from '@netlify/functions'
import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const MONGO_URI = process.env.MONGO_URI
const DB_NAME = process.env.MONGODB_DB || 'master'
const OPENAI_API_KEY = process.env.VITE_OPENAI_API_KEY

interface ArticleGenerationRequest {
  userQueries: string[];
  assistantResponses: string[];
  userId: string;
}

interface GeneratedArticle {
  title: string;
  content: string;
  keywords: string[];
}

const handler: Handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    }
  }

  // Parse the request body
  let request: ArticleGenerationRequest
  try {
    request = JSON.parse(event.body || '{}')
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid request body' }),
    }
  }

  // Validate required fields
  if (!request.userQueries || !request.assistantResponses || !request.userId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields' }),
    }
  }

  // Connect to MongoDB
  let client: MongoClient | null = null
  try {
    // Generate article using OpenAI
    const article = await generateArticleWithAI(request)
    
    if (!article) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to generate article' }),
      }
    }
    
    // Connect to MongoDB
    client = new MongoClient(MONGO_URI || '')
    await client.connect()
    
    const db = client.db(DB_NAME)
    const collection = db.collection('mini_articles')
    
    // Check if a similar article already exists
    const existingArticle = await collection.findOne({
      keywords: { $in: article.keywords }
    })
    
    if (existingArticle) {
      // Update the existing article with new content if needed
      const result = await collection.updateOne(
        { _id: existingArticle._id },
        { 
          $set: { 
            updatedAt: new Date(),
            // Only update content if the new article is longer or more detailed
            ...(article.content.length > existingArticle.content.length ? 
              { content: article.content } : {}),
            // Add any new keywords
            keywords: [...new Set([...existingArticle.keywords, ...article.keywords])]
          },
          $inc: { views: 1 } // Increment view count
        }
      )
      
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true,
          articleId: existingArticle._id.toString(),
          isNew: false
        }),
      }
    } else {
      // Insert the new article
      const result = await collection.insertOne({
        title: article.title,
        content: article.content,
        keywords: article.keywords,
        sourceUserId: request.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        views: 1,
        likes: 0
      })
      
      // Also update the user's keyword profile
      await updateUserKeywords(db, request.userId, article.keywords)
      
      return {
        statusCode: 201,
        body: JSON.stringify({ 
          success: true,
          articleId: result.insertedId.toString(),
          isNew: true
        }),
      }
    }
  } catch (error) {
    console.error('Error generating article:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to generate article' }),
    }
  } finally {
    if (client) {
      await client.close()
    }
  }
}

/**
 * Generate an article using OpenAI
 */
async function generateArticleWithAI(request: ArticleGenerationRequest): Promise<GeneratedArticle | null> {
  try {
    // Combine user queries and assistant responses into a conversation
    const conversation = request.userQueries.map((query, index) => {
      return `User: ${query}\nAssistant: ${request.assistantResponses[index] || ''}`
    }).join('\n\n')
    
    // Create a prompt for OpenAI
    const prompt = `
    Based on the following conversation about plants, create a concise, informative mini-article.
    
    CONVERSATION:
    ${conversation}
    
    Please generate:
    1. A clear, descriptive title (max 10 words)
    2. A concise article (250-400 words) that captures the key information from the conversation
    3. A list of 5-8 relevant keywords (single words or short phrases) that describe the topics covered
    
    Format your response as a JSON object with the following structure:
    {
      "title": "Your Title Here",
      "content": "Your article content here...",
      "keywords": ["keyword1", "keyword2", "keyword3", ...]
    }
    
    Make sure the article is factually accurate, well-structured, and helpful for plant enthusiasts.
    `
    
    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a plant expert who creates concise, informative articles.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    })
    
    if (!response.ok) {
      console.error('OpenAI API error:', await response.text())
      return null
    }
    
    const data = await response.json()
    const content = data.choices[0].message.content
    
    // Parse the JSON response
    try {
      // Extract JSON from the response (in case there's additional text)
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }
      
      const article = JSON.parse(jsonMatch[0])
      
      // Validate the article structure
      if (!article.title || !article.content || !Array.isArray(article.keywords)) {
        throw new Error('Invalid article structure')
      }
      
      return article
    } catch (error) {
      console.error('Error parsing article JSON:', error, content)
      return null
    }
  } catch (error) {
    console.error('Error generating article with AI:', error)
    return null
  }
}

/**
 * Update user keywords in the database
 */
async function updateUserKeywords(db: any, userId: string, keywords: string[]): Promise<void> {
  try {
    const collection = db.collection('user_keyword_profiles')
    
    // Get existing profile or create a new one
    const profile = await collection.findOne({ userId })
    
    if (profile) {
      // Update existing profile
      const existingKeywords = profile.keywords || []
      const updatedKeywords = [...existingKeywords]
      
      // Update weights for existing keywords or add new ones
      for (const keyword of keywords) {
        const existingIndex = updatedKeywords.findIndex(k => k.keyword.toLowerCase() === keyword.toLowerCase())
        
        if (existingIndex >= 0) {
          // Increase weight for existing keyword
          updatedKeywords[existingIndex] = {
            ...updatedKeywords[existingIndex],
            weight: updatedKeywords[existingIndex].weight + 1,
            lastUsed: new Date()
          }
        } else {
          // Add new keyword
          updatedKeywords.push({
            keyword,
            weight: 1,
            lastUsed: new Date()
          })
        }
      }
      
      // Update the profile
      await collection.updateOne(
        { _id: profile._id },
        { 
          $set: { 
            keywords: updatedKeywords,
            updatedAt: new Date()
          } 
        }
      )
    } else {
      // Create a new profile
      await collection.insertOne({
        userId,
        keywords: keywords.map(keyword => ({
          keyword,
          weight: 1,
          lastUsed: new Date()
        })),
        updatedAt: new Date()
      })
    }
  } catch (error) {
    console.error('Error updating user keywords:', error)
  }
}

export { handler } 