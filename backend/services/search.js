const { search, SafeSearchType } = require("duck-duck-scrape");
const axios = require("axios");

/**
 * Search the web using DuckDuckGo (Free/No API Key)
 */
async function freeSearch(query, options = {}) {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Search timeout")), 8000)
  );

  try {
    console.log(`[Search] Querying: "${query}"...`);
    
    // Race between search and timeout
    const searchPromise = (async () => {
      // Try DuckDuckGo Scraper
      try {
        const results = await search(query, { 
          safeSearch: SafeSearchType.MODERATE 
        });
        
        if (results && results.results && results.results.length > 0) {
          console.log(`[Search] Found ${results.results.length} results via Scraper.`);
          return {
            results: results.results.slice(0, options.maxResults || 5).map((r) => ({
              title: r.title || "No Title",
              url: r.url || "#",
              content: r.description || r.snippet || "No description available",
              score: 1.0,
            })),
            query
          };
        }
      } catch (e) {
        console.warn(`[Search] Scraper failed: ${e.message}. Moving to API...`);
      }

      // Fallback: API
      try {
        const apiRes = await axios.get(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`, { timeout: 4000 });
        if (apiRes.data && (apiRes.data.AbstractText || (apiRes.data.RelatedTopics && apiRes.data.RelatedTopics.length > 0))) {
          console.log(`[Search] Found results via API.`);
          const apiResults = (apiRes.data.RelatedTopics || []).slice(0, 3).map(t => ({
            title: t.Text?.split(" - ")[0] || "Result",
            url: t.FirstURL || "",
            content: t.Text || "No content",
            score: 0.8
          }));
          
          if (apiRes.data.AbstractText) {
            apiResults.unshift({ 
              title: apiRes.data.Heading || "Main Information", 
              url: apiRes.data.AbstractURL || "", 
              content: apiRes.data.AbstractText, 
              score: 1.0 
            });
          }
          return { results: apiResults, query };
        }
      } catch (apiErr) {
        console.error("[Search] API Fallback failed:", apiErr.message);
      }

      return { results: [], query };
    })();

    return await Promise.race([searchPromise, timeoutPromise]);
  } catch (error) {
    console.error("[Search] Critical Error:", error.message);
    return { results: [], query, error: error.message };
  }
}

module.exports = { search: freeSearch };
