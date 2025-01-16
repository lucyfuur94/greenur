interface TranslationResponse {
  text: string;
  language: string;
}

export const translateToHindi = async (text: string): Promise<TranslationResponse | null> => {
  try {
    const response = await fetch(
      `/.netlify/functions/translate?text=${encodeURIComponent(text)}&target=hi`
    );
    
    if (!response.ok) {
      throw new Error('Failed to translate text');
    }

    const data = await response.json();
    return {
      text: data.translatedText,
      language: 'hi'
    };
  } catch (error) {
    console.error('Error translating text:', error);
    return null;
  }
}; 