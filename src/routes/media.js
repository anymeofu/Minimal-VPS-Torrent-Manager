const express = require('express');
const router = express.Router();
const Imdb = require('imdb-api');

// IMPORTANT: You need an OMDb API key for reliable results.
// Get one from https://www.omdbapi.com/apikey.aspx
const OMDB_API_KEY = process.env.OMDB_API_KEY || null; // Or replace null with your actual key

let imdbClient;
if (OMDB_API_KEY) {
  imdbClient = new Imdb.Client({ apiKey: OMDB_API_KEY });
} else {
  console.warn('OMDB_API_KEY not provided. IMDB lookups may be unreliable or fail.');
  // imdb-api can perform some searches without a key, but it's limited.
  // For this example, we'll proceed, but functionality might be restricted.
  // A simple way to handle this if no key:
  // imdbClient = { get: () => Promise.reject(new Error("OMDB_API_KEY is required for IMDB lookups.")) };
  // However, let's try to let it work in its limited capacity if no key.
  // The library itself might throw errors or return empty results.
  // A more robust approach would be to instantiate client only if key exists,
  // and return an error if not. For now, let's see how it behaves.
  // The imdb-api library seems to default to not needing a client for basic name search.
}


module.exports = function(db) {

  // GET /api/media/match/:filename
  // Tries to parse a filename and find a match on IMDB
  router.get('/match/:filename', async (req, res) => {
    const { filename } = req.params;
    if (!filename) {
      return res.status(400).json({ error: 'Filename is required.' });
    }

    // Basic filename parsing (very naive, can be improved significantly)
    // Remove extension, replace dots/underscores with spaces
    let searchTerm = filename.substring(0, filename.lastIndexOf('.')) || filename;
    searchTerm = searchTerm.replace(/[._]/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Attempt to extract year (e.g., "Movie Title 2023")
    const yearMatch = searchTerm.match(/(.*)\b(\d{4})\b$/);
    let searchYear = null;
    if (yearMatch) {
      searchTerm = yearMatch[1].trim();
      searchYear = yearMatch[2];
    }

    if (!searchTerm) {
        return res.status(400).json({ error: 'Could not derive a search term from the filename.' });
    }

    try {
      let movie;
      if (imdbClient) { // Use client if API key was provided
        movie = await imdbClient.get({ name: searchTerm, year: searchYear });
      } else { // Fallback to basic search if no API key (may not work well or at all)
         // The library's top-level functions like Imdb.get() might work for basic searches.
         // Let's try that. If it requires a client instance, this will fail.
         // According to docs, Imdb.get itself can be used.
        movie = await Imdb.get({ name: searchTerm, year: searchYear }, { apiKey: OMDB_API_KEY, timeout: 5000 });
      }
      
      if (movie && movie.imdbid) {
        // Optionally, store this match in media_files table if filename is a path
        // For now, just return the match
        res.json({
          imdbId: movie.imdbid,
          title: movie.title,
          year: movie.year,
          posterUrl: movie.poster,
          plot: movie.plot,
          rating: movie.rating,
          genres: movie.genres ? movie.genres.split(', ') : [],
        });
      } else {
        res.status(404).json({ error: 'No IMDB match found for the given filename.' });
      }
    } catch (e) {
      console.error(`IMDB API error for "${searchTerm}" (year: ${searchYear || 'any'}):`, e.message);
      // imdb-api throws specific error types, e.g., e.constructor.name === 'NotFoundError'
      if (e.message && e.message.toLowerCase().includes('movie not found')) {
        res.status(404).json({ error: `IMDB: Movie not found. (${e.message})` });
      } else if (e.message && e.message.toLowerCase().includes('incorrect imdb id')) {
         res.status(400).json({ error: `IMDB: Invalid search. (${e.message})` });
      }
      else {
        res.status(500).json({ error: `Failed to fetch IMDB data. (${e.message})` });
      }
    }
  });

  return router;
};
