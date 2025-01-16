import inshorts from 'inshorts-news-api';

export interface NewsArticle {
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
  provider: string;
  datePublished: string;
}

export const fetchPlantNews = async (plantName: string): Promise<NewsArticle[]> => {
  try {
    // First try science category
    const scienceNews = await inshorts.getNews({
      language: 'en',
      category: 'science'
    });

    // Then try miscellaneous category
    const miscNews = await inshorts.getNews({
      language: 'en',
      category: 'miscellaneous'
    });

    // Combine and filter news related to the plant
    const allNews = [...scienceNews.articles, ...miscNews.articles];
    const plantNews = allNews.filter(article => 
      article.title.toLowerCase().includes(plantName.toLowerCase()) ||
      article.content.toLowerCase().includes(plantName.toLowerCase())
    );

    // Transform to our NewsArticle format
    return plantNews.map(article => ({
      title: article.title,
      description: article.content,
      url: article.source_url,
      imageUrl: article.image_url,
      provider: article.source_name,
      datePublished: new Date(article.created_at).toLocaleDateString()
    }));
  } catch (error) {
    console.error('Error fetching news:', error);
    return [];
  }
}; 