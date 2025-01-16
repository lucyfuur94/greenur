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
  try {
    const response = await fetch(
      `/.netlify/functions/get-videos?q=${encodeURIComponent(plantName + ' plant')}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch videos');
    }

    const data = await response.json();
    const videos = data.items.map((item: any) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails.medium.url,
      category: categorizeVideo(item.snippet.title, item.snippet.description)
    }));

    // Group videos by category
    return videos.reduce((acc: Record<Video['category'], Video[]>, video: Video) => {
      if (!acc[video.category]) {
        acc[video.category] = [];
      }
      acc[video.category].push(video);
      return acc;
    }, {
      'How to grow': [],
      'Care tips': [],
      'Facts': [],
      'Other': []
    });
  } catch (error) {
    console.error('Error fetching videos:', error);
    throw error;
  }
}; 