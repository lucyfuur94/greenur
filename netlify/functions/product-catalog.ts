import { Handler } from '@netlify/functions'
import { MongoClient, ObjectId } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const MONGO_URI = process.env.MONGO_URI
const DB_NAME = process.env.MONGODB_DB || 'master'

interface Product {
  _id?: string;
  name: string;
  category: string;
  links: ProductLink[];
  createdAt?: Date;
  lastUpdated?: Date;
}

interface ProductLink {
  id: string;
  url: string;
  title: string;
  addedAt: Date | string;
}

interface ProductMention {
  name: string;
  category: string;
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE, PUT'
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

    // Connect to MongoDB
    if (!MONGO_URI) {
      throw new Error('MongoDB URI is not defined');
    }
    
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    const productsCollection = db.collection('products');

    // GET - Fetch all products or a specific product
    if (event.httpMethod === 'GET') {
      const productId = event.queryStringParameters?.id;
      
      if (productId) {
        // Fetch a specific product
        const product = await productsCollection.findOne({ 
          _id: ObjectId.isValid(productId) ? new ObjectId(productId) : productId 
        });
        
        if (!product) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Product not found' })
          };
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(product)
        };
      } else {
        // Fetch all products
        const products = await productsCollection.find({}).toArray();
        
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(products)
        };
      }
    }

    // POST - Add a new product or process product mentions
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      
      // Check if we're processing product mentions
      if (body.action === 'process-mentions' && Array.isArray(body.mentions)) {
        const mentions: ProductMention[] = body.mentions;
        const newProducts: Product[] = [];
        
        // Get all existing products to minimize database queries
        const existingProducts = await productsCollection.find({}).toArray();
        const existingProductNames = new Set(existingProducts.map(p => p.name.toLowerCase()));
        
        for (const mention of mentions) {
          // Normalize product name for comparison
          const normalizedName = mention.name.toLowerCase();
          
          // Check if product already exists (case-insensitive)
          if (!existingProductNames.has(normalizedName)) {
            console.log(`Adding new product to catalog: ${mention.name} (${mention.category})`);
            
            // Add the product to the database
            const newProduct: Product = {
              name: mention.name,
              category: mention.category,
              links: [],
              createdAt: new Date(),
              lastUpdated: new Date()
            };
            
            const result = await productsCollection.insertOne(newProduct);
            newProduct._id = result.insertedId.toString();
            
            // Track for reporting
            newProducts.push(newProduct);
            
            // Add to our local set to prevent duplicates in the same batch
            existingProductNames.add(normalizedName);
          } else {
            console.log(`Product already exists in catalog: ${mention.name}`);
          }
        }
        
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            message: `Processed ${mentions.length} product mentions, added ${newProducts.length} new products`,
            newProducts
          })
        };
      } else {
        // Add a new product
        const product: Product = {
          name: body.name,
          category: body.category || 'Other',
          links: body.links || [],
          createdAt: new Date(),
          lastUpdated: new Date()
        };
        
        const result = await productsCollection.insertOne(product);
        
        return {
          statusCode: 201,
          headers: corsHeaders,
          body: JSON.stringify({
            message: 'Product added successfully',
            product: {
              ...product,
              _id: result.insertedId.toString()
            }
          })
        };
      }
    }

    // PUT - Update a product
    if (event.httpMethod === 'PUT') {
      const productId = event.queryStringParameters?.id;
      if (!productId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Product ID is required' })
        };
      }
      
      const updates = JSON.parse(event.body || '{}');
      
      // Handle link operations
      if (updates.action === 'add-link' && updates.link) {
        const product = await productsCollection.findOne({ 
          _id: ObjectId.isValid(productId) ? new ObjectId(productId) : productId 
        });
        
        if (!product) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Product not found' })
          };
        }
        
        const newLink = {
          id: updates.link.id || new ObjectId().toString(),
          url: updates.link.url,
          title: updates.link.title,
          addedAt: new Date()
        };
        
        const result = await productsCollection.updateOne(
          { _id: ObjectId.isValid(productId) ? new ObjectId(productId) : productId },
          { 
            $push: { links: newLink },
            $set: { lastUpdated: new Date() }
          }
        );
        
        if (result.modifiedCount === 0) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Failed to add link to product' })
          };
        }
        
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            message: 'Link added successfully',
            link: newLink
          })
        };
      } else if (updates.action === 'remove-link' && updates.linkId) {
        const result = await productsCollection.updateOne(
          { _id: ObjectId.isValid(productId) ? new ObjectId(productId) : productId },
          { 
            $pull: { links: { id: updates.linkId } },
            $set: { lastUpdated: new Date() }
          }
        );
        
        if (result.modifiedCount === 0) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Failed to remove link from product' })
          };
        }
        
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            message: 'Link removed successfully'
          })
        };
      } else {
        // Regular product update
        delete updates._id; // Prevent _id modification
        
        const result = await productsCollection.updateOne(
          { _id: ObjectId.isValid(productId) ? new ObjectId(productId) : productId },
          { 
            $set: {
              ...updates,
              lastUpdated: new Date()
            }
          }
        );
        
        if (result.modifiedCount === 0) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Product not found or no changes made' })
          };
        }
        
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            message: 'Product updated successfully'
          })
        };
      }
    }

    // DELETE - Delete a product
    if (event.httpMethod === 'DELETE') {
      const productId = event.queryStringParameters?.id;
      if (!productId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Product ID is required' })
        };
      }
      
      const result = await productsCollection.deleteOne({ 
        _id: ObjectId.isValid(productId) ? new ObjectId(productId) : productId 
      });
      
      if (result.deletedCount === 0) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Product not found' })
        };
      }
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'Product deleted successfully'
        })
      };
    }

    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };

  } catch (error) {
    console.error('Error handling product catalog operation:', error);
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