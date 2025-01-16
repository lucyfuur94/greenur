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
      const errorText = await response.text();
      console.error(`[News Service] HTTP Error: ${response.status} ${response.statusText}`);
      console.error(`[News Service] Error details:`, errorText);
      throw new Error(`Failed to fetch news: ${response.status} ${response.statusText}`);
    }
    
    const scienceNews = await response.json();
    console.log(`[News Service] Received response:`, scienceNews);
    
    // Check if articles exist and are iterable
    if (!scienceNews.articles) {
      console.warn('[News Service] No articles property in response');
      return [];
    }
    
    if (!Array.isArray(scienceNews.articles)) {
      console.warn('[News Service] Articles is not an array:', typeof scienceNews.articles);
      return [];
    }

    const filteredArticles = scienceNews.articles
      .filter((article: any) => {
        if (!article.title || !article.url) {
          console.warn('[News Service] Skipping article due to missing required fields:', article);
          return false;
        }
        return true;
      })
      .map((article: any) => {
        console.log(`[News Service] Processing article: ${article.title}`);
        return {
          title: article.title,
          url: article.url,
          source: article.source?.name || 'Unknown Source',
          description: article.description || article.content || '',
          provider: article.source?.name || 'Unknown Provider',
          datePublished: article.publishedAt || new Date().toISOString()
        };
      })
      .slice(0, 5);

    console.log(`[News Service] Returning ${filteredArticles.length} articles`);
    return filteredArticles;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[News Service] Error fetching news:', {
      error,
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      plantName
    });
    return [];
  }
}; 