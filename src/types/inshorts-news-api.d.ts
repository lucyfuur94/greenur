declare module 'inshorts-news-api' {
  interface InshortsOptions {
    language: 'en' | 'hi';
    category: string;
    news_offset?: string;
  }

  interface InshortsArticle {
    title: string;
    content: string;
    source_url: string;
    image_url: string;
    source_name: string;
    created_at: number;
  }

  interface InshortsResponse {
    articles: InshortsArticle[];
    news_offset: string;
  }

  function getNews(options: InshortsOptions): Promise<InshortsResponse>;

  export = {
    getNews
  };
} 