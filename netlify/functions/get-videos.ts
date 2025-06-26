import { Handler } from '@netlify/functions'

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY
const YOUTUBE_API_ENDPOINT = 'https://www.googleapis.com/youtube/v3/search'
const YOUTUBE_VIDEOS_ENDPOINT = 'https://www.googleapis.com/youtube/v3/videos'

export const handler: Handler = async (event) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    }
  }

  if (!YOUTUBE_API_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'API key not configured' })
    }
  }

  const { q, limit = '10' } = event.queryStringParameters || {}
  if (!q) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Query parameter is required' })
    }
  }

  try {
    // First, search for videos
    const searchResponse = await fetch(
      `${YOUTUBE_API_ENDPOINT}?part=snippet&q=${encodeURIComponent(q)}&maxResults=${limit}&type=video&key=${YOUTUBE_API_KEY}`,
      {
        headers: {
          'Accept': 'application/json'
        }
      }
    )

    if (!searchResponse.ok) {
      throw new Error(`YouTube API responded with ${searchResponse.status}`)
    }

    const searchData = await searchResponse.json()
    
    // Get video IDs for additional details
    const videoIds = searchData.items?.map((item: any) => item.id.videoId).join(',')
    
    if (!videoIds) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          videos: [],
          total: 0 
        })
      }
    }

    // Get additional video details including duration
    const videosResponse = await fetch(
      `${YOUTUBE_VIDEOS_ENDPOINT}?part=contentDetails,statistics&id=${videoIds}&key=${YOUTUBE_API_KEY}`,
      {
        headers: {
          'Accept': 'application/json'
        }
      }
    )

         let videosData: any = null
     if (videosResponse.ok) {
       videosData = await videosResponse.json()
     }

     // Transform the data to match our expected format
     const transformedVideos = searchData.items?.map((item: any, index: number) => {
       const videoDetail = videosData?.items?.[index]
      
      // Convert ISO 8601 duration to readable format
      const duration = videoDetail?.contentDetails?.duration || 'PT0M0S'
      const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
      const hours = match?.[1] || '0'
      const minutes = match?.[2] || '0'
      const seconds = match?.[3] || '0'
      
      let formattedDuration = ''
      if (parseInt(hours) > 0) {
        formattedDuration = `${hours}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`
      } else {
        formattedDuration = `${minutes}:${seconds.padStart(2, '0')}`
      }

      return {
        id: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
        channel: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt,
        duration: formattedDuration,
        embedUrl: `https://www.youtube.com/embed/${item.id.videoId}`,
        watchUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        viewCount: videoDetail?.statistics?.viewCount || '0'
      }
    }) || []

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        videos: transformedVideos,
        total: transformedVideos.length
      })
    }
  } catch (error) {
    console.error('Error fetching videos:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch videos' })
    }
  }
} 