// ============================================
// STREAMER OTT - SEARCH & FILTER ENGINE
// ============================================
// Handles: Smart Search, Auto-suggestions, Filters, Sorting
// ============================================

import CONFIG from '../config.js';

// 🎯 SEARCH CONFIGURATION
const SEARCH_CONFIG = {
    minQueryLength: 2,
    maxResults: 50,
    debounceMs: 300,
    highlightMatches: true,
    searchFields: ['title', 'description', 'tags', 'category', 'genre', 'year'],
    fuzzyThreshold: 0.6  // 0-1, higher = stricter
};

// ============================================
// 🔍 MAIN SEARCH FUNCTION
// ============================================

/**
 * Search content across all fields
 * @param {Array} videos - Array of video objects
 * @param {String} query - Search query
 * @param {Object} options - Optional filters
 * @returns {Array} Filtered and sorted results
 */
export function searchContent(videos, query, options = {}) {
    if (!query || query.length < SEARCH_CONFIG.minQueryLength) {
        return [];
    }
    
    const normalizedQuery = normalizeText(query);
    const queryWords = normalizedQuery.split(/\s+/);
    
    // Score and filter videos
    const scoredResults = videos.map(video => {
        const score = calculateSearchScore(video, queryWords, normalizedQuery);
        return { video, score };
    }).filter(item => item.score > 0);
    
    // Sort by score (highest first)
    scoredResults.sort((a, b) => b.score - a.score);
    
    // Apply additional filters
    let results = scoredResults.map(item => item.video);
    
    if (options.category) {
        results = results.filter(v => v.category === options.category);
    }
    
    if (options.genre) {
        results = results.filter(v => v.genre === options.genre);
    }
    
    if (options.year) {
        results = results.filter(v => v.year === options.year);
    }
    
    if (options.rating) {
        results = results.filter(v => v.rating === options.rating);
    }
    
    // Limit results
    return results.slice(0, options.limit || SEARCH_CONFIG.maxResults);
}

// ============================================
// 🎯 SCORING ALGORITHM
// ============================================

function calculateSearchScore(video, queryWords, fullQuery) {
    let score = 0;
    const fields = SEARCH_CONFIG.searchFields;
    
    fields.forEach(field => {
        const fieldValue = normalizeText(String(video[field] || ''));
        if (!fieldValue) return;
        
        // Exact match in field (highest score)
        if (fieldValue === fullQuery) {
            score += field === 'title' ? 100 : 50;
        }
        
        // Starts with query (high score)
        if (fieldValue.startsWith(fullQuery)) {
            score += field === 'title' ? 80 : 40;
        }
        
        // Contains full query (medium score)
        if (fieldValue.includes(fullQuery)) {
            score += field === 'title' ? 60 : 30;
        }
        
        // Individual word matches (lower score)
        queryWords.forEach(word => {
            if (fieldValue.includes(word)) {
                score += field === 'title' ? 20 : 10;
            }
            
            // Fuzzy match (partial word match)
            if (isFuzzyMatch(fieldValue, word)) {
                score += field === 'title' ? 10 : 5;
            }
        });
    });
    
    // Boost recent content
    if (video.year) {
        const currentYear = new Date().getFullYear();
        const yearDiff = currentYear - parseInt(video.year);
        if (yearDiff <= 1) score += 5;
    }
    
    // Boost popular content
    if (video.views) {
        score += Math.min(video.views / 1000, 10);
    }
    
    return score;
}

// ============================================
// 🔤 TEXT NORMALIZATION
// ============================================

function normalizeText(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, '')  // Remove special chars
        .replace(/\s+/g, ' ')      // Normalize spaces
        .trim();
}

// ============================================
// 🎯 FUZZY MATCHING
// ============================================

function isFuzzyMatch(text, query) {
    if (query.length < 3) return false;
    
    // Simple Levenshtein distance check
    const distance = levenshteinDistance(text.slice(0, query.length + 2), query);
    const maxDistance = Math.floor(query.length * (1 - SEARCH_CONFIG.fuzzyThreshold));
    
    return distance <= maxDistance;
}

function levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    
    return matrix[str2.length][str1.length];
}

// ============================================
// 💡 AUTO-SUGGESTIONS
// ============================================

/**
 * Get search suggestions based on partial query
 * @param {Array} videos - All videos
 * @param {String} query - Partial query
 * @param {Number} limit - Max suggestions
 * @returns {Array} Suggestion strings
 */
export function getSuggestions(videos, query, limit = 5) {
    if (!query || query.length < 2) return [];
    
    const normalizedQuery = normalizeText(query);
    const suggestions = new Set();
    
    // Title suggestions
    videos.forEach(video => {
        const title = normalizeText(video.title || '');
        if (title.includes(normalizedQuery)) {
            // Extract matching phrase
            const words = title.split(' ');
            const matchIndex = words.findIndex(w => w.includes(normalizedQuery));
            if (matchIndex >= 0) {
                const suggestion = words.slice(0, Math.min(matchIndex + 3, words.length)).join(' ');
                suggestions.add(suggestion);
            }
        }
    });
    
    // Category suggestions
    const categories = [...new Set(videos.map(v => v.category).filter(Boolean))];
    categories.forEach(cat => {
        if (normalizeText(cat).includes(normalizedQuery)) {
            suggestions.add(`Category: ${capitalize(cat)}`);
        }
    });
    
    // Genre suggestions
    const genres = [...new Set(videos.map(v => v.genre).filter(Boolean))];
    genres.forEach(genre => {
        if (normalizeText(genre).includes(normalizedQuery)) {
            suggestions.add(`Genre: ${capitalize(genre)}`);
        }
    });
    
    return Array.from(suggestions).slice(0, limit);
}

// ============================================
// 🏷️ FILTER FUNCTIONS
// ============================================

/**
 * Filter videos by multiple criteria
 * @param {Array} videos - All videos
 * @param {Object} filters - Filter criteria
 * @returns {Array} Filtered videos
 */
export function filterVideos(videos, filters = {}) {
    return videos.filter(video => {
        // Category filter
        if (filters.category && video.category !== filters.category) {
            return false;
        }
        
        // Genre filter
        if (filters.genre && video.genre !== filters.genre) {
            return false;
        }
        
        // Year range
        if (filters.yearFrom && video.year < filters.yearFrom) {
            return false;
        }
        if (filters.yearTo && video.year > filters.yearTo) {
            return false;
        }
        
        // Rating filter
        if (filters.rating && video.rating !== filters.rating) {
            return false;
        }
        
        // Has subtitles
        if (filters.hasSubtitles && (!video.subtitles || !video.subtitles.length)) {
            return false;
        }
        
        // Minimum views
        if (filters.minViews && (video.views || 0) < filters.minViews) {
            return false;
        }
        
        return true;
    });
}

// ============================================
// 📊 SORT FUNCTIONS
// ============================================

export const SORT_OPTIONS = {
    NEWEST: 'newest',
    OLDEST: 'oldest',
    VIEWS_HIGH: 'views_high',
    VIEWS_LOW: 'views_low',
    TITLE_ASC: 'title_asc',
    TITLE_DESC: 'title_desc',
    RATING: 'rating'
};

export function sortVideos(videos, sortBy = SORT_OPTIONS.NEWEST) {
    const sorted = [...videos];
    
    switch (sortBy) {
        case SORT_OPTIONS.NEWEST:
            return sorted.sort((a, b) => {
                const dateA = a.uploadedAt?.toDate?.() || new Date(a.year || 0);
                const dateB = b.uploadedAt?.toDate?.() || new Date(b.year || 0);
                return dateB - dateA;
            });
            
        case SORT_OPTIONS.OLDEST:
            return sorted.sort((a, b) => {
                const dateA = a.uploadedAt?.toDate?.() || new Date(a.year || 0);
                const dateB = b.uploadedAt?.toDate?.() || new Date(b.year || 0);
                return dateA - dateB;
            });
            
        case SORT_OPTIONS.VIEWS_HIGH:
            return sorted.sort((a, b) => (b.views || 0) - (a.views || 0));
            
        case SORT_OPTIONS.VIEWS_LOW:
            return sorted.sort((a, b) => (a.views || 0) - (b.views || 0));
            
        case SORT_OPTIONS.TITLE_ASC:
            return sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
            
        case SORT_OPTIONS.TITLE_DESC:
            return sorted.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
            
        case SORT_OPTIONS.RATING:
            const ratingOrder = { 'U': 1, 'U/A 7+': 2, 'U/A 13+': 3, 'U/A 16+': 4, 'A': 5 };
            return sorted.sort((a, b) => (ratingOrder[a.rating] || 0) - (ratingOrder[b.rating] || 0));
            
        default:
            return sorted;
    }
}

// ============================================
// 🎯 ADVANCED SEARCH
// ============================================

/**
 * Advanced search with query parsing
 * Supports: "action movies 2024", "genre:horror", "year:>2020"
 */
export function advancedSearch(videos, query) {
    const filters = {};
    let searchTerms = query;
    
    // Parse special syntax
    const patterns = {
        category: /category:(\w+)/i,
        genre: /genre:(\w+)/i,
        year: /year:(\d{4})/i,
        yearRange: /year:(\d{4})-(\d{4})/i,
        rating: /rating:([\w\/+]+)/i
    };
    
    // Extract filters
    Object.entries(patterns).forEach(([key, pattern]) => {
        const match = query.match(pattern);
        if (match) {
            if (key === 'yearRange') {
                filters.yearFrom = match[1];
                filters.yearTo = match[2];
            } else {
                filters[key] = match[1];
            }
            searchTerms = searchTerms.replace(match[0], '').trim();
        }
    });
    
    // First filter, then search
    let results = filterVideos(videos, filters);
    
    if (searchTerms) {
        results = searchContent(results, searchTerms);
    }
    
    return results;
}

// ============================================
// 📈 SEARCH ANALYTICS (Local)
// ============================================

export function saveSearchQuery(query, resultsCount) {
    const searches = JSON.parse(localStorage.getItem('streamer_searches') || '[]');
    
    searches.unshift({
        query,
        resultsCount,
        timestamp: new Date().toISOString()
    });
    
    // Keep last 100 searches
    if (searches.length > 100) searches.pop();
    
    localStorage.setItem('streamer_searches', JSON.stringify(searches));
}

export function getPopularSearches(limit = 10) {
    const searches = JSON.parse(localStorage.getItem('streamer_searches') || '[]');
    
    // Count frequency
    const frequency = {};
    searches.forEach(s => {
        frequency[s.query] = (frequency[s.query] || 0) + 1;
    });
    
    // Sort by frequency
    return Object.entries(frequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([query, count]) => ({ query, count }));
}

// ============================================
// 🛠️ UTILITY FUNCTIONS
// ============================================

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Highlight matching text in search results
 */
export function highlightText(text, query) {
    if (!SEARCH_CONFIG.highlightMatches || !query) return text;
    
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return text.replace(regex, '<mark class="bg-[#e50914]/30 text-white px-1 rounded">$1</mark>');
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if video matches search query
 */
export function matchesQuery(video, query) {
    const results = searchContent([video], query);
    return results.length > 0;
}

// ============================================
// 🚀 EXPORTS
// ============================================

export default {
    searchContent,
    getSuggestions,
    filterVideos,
    sortVideos,
    advancedSearch,
    saveSearchQuery,
    getPopularSearches,
    highlightText,
    matchesQuery,
    SORT_OPTIONS
};
