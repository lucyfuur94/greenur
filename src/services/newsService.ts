export interface NewsArticle {
  title: string;
  url: string;
  source: string;
  description: string;
  provider: string;
  datePublished: string;
}

export const fetchPlantNews = async (plantName: string): Promise<NewsArticle[]> => {
  try {
    console.log(`[News Service] Fetching news for plant: ${plantName}`);
    const response = await fetch(`/.netlify/functions/get-news?q=${encodeURIComponent(plantName)}`);
    
    if (!response.ok) {
      console.error(`[News Service] HTTP Error: ${response.status} ${response.statusText}`);
      return [];
    }
    
    const scienceNews = await response.json();
    console.log(`[News Service] Received response:`, scienceNews);
    
    // Check if articles exist and are iterable
    if (!scienceNews.articles || !Array.isArray(scienceNews.articles)) {
      console.warn('[News Service] Invalid articles data:', scienceNews);
      return [];
    }

    const filteredArticles = scienceNews.articles
      .filter((article: any) => {
        if (!article?.title || !article?.url) {
          console.warn('[News Service] Skipping article due to missing required fields:', article);
          return false;
        }
        return true;
      })
      .map((article: any) => ({
        title: article.title,
        url: article.url,
        source: article.source?.name || 'Unknown Source',
        description: article.description || article.content || '',
        provider: article.source?.name || 'Unknown Provider',
        datePublished: article.publishedAt || new Date().toISOString()
      }))
      .slice(0, 5);

    console.log(`[News Service] Returning ${filteredArticles.length} articles`);
    return filteredArticles;
  } catch (error) {
    console.error('[News Service] Error fetching news:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      plantName
    });
    return [];
  }
}; 