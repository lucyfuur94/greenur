export interface Video {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  category: 'How to grow' | 'Care tips' | 'Facts' | 'Other';
}

const categorizeVideo = (title: string, description: string): Video['category'] => {
  const text = (title + ' ' + description).toLowerCase();
  
  if (text.includes('how to grow') || text.includes('growing') || text.includes('propagation')) {
    return 'How to grow';
  }
  if (text.includes('care') || text.includes('tips') || text.includes('guide') || text.includes('maintenance')) {
    return 'Care tips';
  }
  if (text.includes('facts') || text.includes('interesting') || text.includes('about') || text.includes('history')) {
    return 'Facts';
  }
  return 'Other';
};

export const fetchPlantVideos = async (plantName: string): Promise<Record<Video['category'], Video[]>> => {
  const emptyResults = {
    'How to grow': [],
    'Care tips': [],
    'Facts': [],
    'Other': []
  };

  try {
    const response = await fetch(
      `/.netlify/functions/get-videos?q=${encodeURIComponent(plantName + ' plant')}`
    );
    
    if (!response.ok) {
      console.error('Failed to fetch videos:', response.status, response.statusText);
      return emptyResults;
    }

    const data = await response.json();
    
    if (!data.items || !Array.isArray(data.items)) {
      console.warn('Invalid video data format:', data);
      return emptyResults;
    }

    const videos = data.items
      .filter((item: any) => {
        if (!item?.id?.videoId || !item?.snippet?.title) {
          console.warn('Invalid video item:', item);
          return false;
        }
        return true;
      })
      .map((item: any) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description || '',
        thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
        category: categorizeVideo(item.snippet.title, item.snippet.description || '')
      }));

    // Group videos by category
    return videos.reduce((acc: Record<Video['category'], Video[]>, video: Video) => {
      if (!acc[video.category]) {
        acc[video.category] = [];
      }
      acc[video.category].push(video);
      return acc;
    }, { ...emptyResults });
  } catch (error) {
    console.error('Error fetching videos:', error);
    return emptyResults;
  }
}; 