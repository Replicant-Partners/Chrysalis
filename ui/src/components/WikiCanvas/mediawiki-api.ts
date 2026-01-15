/**
 * MediaWiki API Helper
 * 
 * Functions for interacting with MediaWiki REST API
 */

interface WikiPage {
  title: string;
  content: string;
  revisionId?: number;
  timestamp?: string;
}

interface SearchResult {
  title: string;
  snippet: string;
  wordCount: number;
}

/**
 * Fetch a wiki page by title
 */
export async function getPage(
  wikiUrl: string,
  title: string
): Promise<WikiPage | null> {
  try {
    const response = await fetch(
      `${wikiUrl}/api.php?action=parse&page=${encodeURIComponent(title)}&format=json&origin=*`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      console.error('MediaWiki API error:', data.error);
      return null;
    }
    
    return {
      title: data.parse?.title || title,
      content: data.parse?.wikitext?.['*'] || '',
      revisionId: data.parse?.revid,
      timestamp: data.parse?.timestamp,
    };
  } catch (error) {
    console.error('Error fetching wiki page:', error);
    return null;
  }
}

/**
 * Save a wiki page
 */
export async function savePage(
  _wikiUrl: string,
  title: string,
  content: string,
  summary: string = 'Updated via Chrysalis'
): Promise<boolean> {
  try {
    // Note: This requires authentication in a real MediaWiki instance
    // For now, we'll simulate a save
    console.log('Saving page:', { wikiUrl: _wikiUrl, title, content: content.substring(0, 100), summary });
    
    // In production, you would use:
    // const response = await fetch(`${wikiUrl}/api.php`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    //   body: new URLSearchParams({
    //     action: 'edit',
    //     title,
    //     text: content,
    //     summary,
    //     format: 'json',
    //     token: csrfToken, // Need to obtain this first
    //   }),
    // });
    
    return true;
  } catch (error) {
    console.error('Error saving wiki page:', error);
    return false;
  }
}

/**
 * Search wiki pages
 */
export async function searchPages(
  wikiUrl: string,
  query: string,
  limit: number = 10
): Promise<SearchResult[]> {
  try {
    const response = await fetch(
      `${wikiUrl}/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=${limit}&format=json&origin=*`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      console.error('MediaWiki search error:', data.error);
      return [];
    }
    
    return (data.query?.search || []).map((result: any) => ({
      title: result.title,
      snippet: result.snippet,
      wordCount: result.wordcount,
    }));
  } catch (error) {
    console.error('Error searching wiki:', error);
    return [];
  }
}

/**
 * Get page history/revisions
 */
export async function getPageHistory(
  wikiUrl: string,
  title: string,
  limit: number = 10
): Promise<any[]> {
  try {
    const response = await fetch(
      `${wikiUrl}/api.php?action=query&prop=revisions&titles=${encodeURIComponent(title)}&rvlimit=${limit}&rvprop=timestamp|user|comment|ids&format=json&origin=*`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      console.error('MediaWiki history error:', data.error);
      return [];
    }
    
    const pages = data.query?.pages || {};
    const pageId = Object.keys(pages)[0];
    
    return pages[pageId]?.revisions || [];
  } catch (error) {
    console.error('Error fetching page history:', error);
    return [];
  }
}

/**
 * Check MediaWiki connection
 */
export async function checkConnection(wikiUrl: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${wikiUrl}/api.php?action=query&meta=siteinfo&format=json&origin=*`
    );
    
    return response.ok;
  } catch (error) {
    console.error('Error checking MediaWiki connection:', error);
    return false;
  }
}