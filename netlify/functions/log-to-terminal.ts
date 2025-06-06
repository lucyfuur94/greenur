import { Handler } from '@netlify/functions'

/**
 * Netlify function to log visualization data to the terminal
 * This allows the browser to send data that will be displayed in the server terminal
 */
export const handler: Handler = async (event, context) => {
  try {
    // Only accept POST requests
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ message: 'Method not allowed' }),
      }
    }

    // Parse the request body
    const body = JSON.parse(event.body || '{}')
    const { pageName, visualLayout } = body

    if (!pageName || !visualLayout) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing required fields' }),
      }
    }

    // Log to terminal with clear formatting
    console.log('\n\n')
    console.log('==============================================')
    console.log(`GREENUR ${pageName.toUpperCase()} PAGE STRUCTURE`)
    console.log('==============================================')
    console.log('\nVISUAL LAYOUT:')
    console.log('-------------')
    console.log(visualLayout)
    console.log('==============================================')
    console.log('\n\n')

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Visualization logged to terminal' }),
    }
  } catch (error) {
    console.error('Error logging to terminal:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error logging to terminal' }),
    }
  }
} 