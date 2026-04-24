// ============================================
// STREAMER OTT - LOCAL STORAGE MANAGER
// ============================================
// Handles: Watchlist, History, Favorites, Continue Watching
// All data stored locally in user's browser
// ============================================

import CONFIG from '../config.js';

// ============================================
// 🚀 INITIALIZATION
// ============================================

export function initStorage() {
    // Ensure all storage keys exist
    const keys = Object.values(CONFIG.STORAGE_KEYS);
    
    keys.forEach(key => {
        if (!localStorage.getItem(key)) {
            localStorage.setItem(key, JSON.stringify([]));
        }
    });
    
    // Migrate old data if needed
    migrateOldData();
}

function migrateOldData() {
    // Check for old format data and migrate
    const oldWatchlist = localStorage.getItem('watchlist');
    if (oldWatchlist && !localStorage.getItem(CONFIG.STORAGE_KEYS.watchlist)) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.watchlist, oldWatchlist);
    }
}

// ============================================
// ⭐ WATCHLIST
// ============================================

/**
 * Get all watchlist items
 * @returns {Array} Watchlist videos
 */
export function getWatchlist() {
    try {
        return JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.watchlist) || '[]');
    } catch {
        return [];
    }
}

/**
 * Add/remove item from watchlist
 * @param {Object} video - Video object
 * @returns {Boolean} true if added, false if removed
 */
export function toggleWatchlistItem(video) {
    const watchlist = getWatchlist();
    const index = watchlist.findIndex(item => item.id === video.id);
    
    if (index >= 0) {
        // Remove
        watchlist.splice(index, 1);
        localStorage.setItem(CONFIG.STORAGE_KEYS.watchlist, JSON.stringify(watchlist));
        return false;
    } else {
        // Add (store minimal data)
        const watchlistItem = {
            id: video.id,
            title: video.title,
            posterUrl: video.posterUrl,
            category: video.category,
            year: video.year,
            rating: video.rating,
            addedAt: new Date().toISOString()
        };
        watchlist.unshift(watchlistItem);
        localStorage.setItem(CONFIG.STORAGE_KEYS.watchlist, JSON.stringify(watchlist));
        return true;
    }
}

/**
 * Check if video is in watchlist
 * @param {String} videoId - Video ID
 * @returns {Boolean}
 */
export function isInWatchlist(videoId) {
    const watchlist = getWatchlist();
    return watchlist.some(item => item.id === videoId);
}

/**
 * Remove from watchlist by ID
 * @param {String} videoId
 */
export function removeFromWatchlist(videoId) {
    const watchlist = getWatchlist();
    const filtered = watchlist.filter(item => item.id !== videoId);
    localStorage.setItem(CONFIG.STORAGE_KEYS.watchlist, JSON.stringify(filtered));
}

// ============================================
// 📺 WATCH HISTORY
// ============================================

/**
 * Get watch history
 * @returns {Array} History items with progress
 */
export function getHistory() {
    try {
        return JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.history) || '[]');
    } catch {
        return [];
    }
}

/**
 * Add video to history
 * @param {Object} video - Video object
 * @param {Number} progress - Watch progress (0-1)
 */
export function addToHistory(video, progress = 0) {
    const history = getHistory();
    
    // Remove if exists
    const filtered = history.filter(item => item.id !== video.id);
    
    // Add to front
    const historyItem = {
        id: video.id,
        title: video.title,
        posterUrl: video.posterUrl,
        category: video.category,
        year: video.year,
        progress: progress,
        duration: video.duration,
        watchedAt: new Date().toISOString()
    };
    
    filtered.unshift(historyItem);
    
    // Keep last 50
    if (filtered.length > 50) filtered.pop();
    
    localStorage.setItem(CONFIG.STORAGE_KEYS.history, JSON.stringify(filtered));
}

/**
 * Update watch progress
 * @param {String} videoId
 * @param {Number} progress - 0 to 1
 */
export function updateProgress(videoId, progress) {
    const history = getHistory();
    const item = history.find(h => h.id === videoId);
    
    if (item) {
        item.progress = Math.min(progress, 1);
        item.watchedAt = new Date().toISOString();
        localStorage.setItem(CONFIG.STORAGE_KEYS.history, JSON.stringify(history));
    }
}

/**
 * Get video progress
 * @param {String} videoId
 * @returns {Number} Progress 0-1
 */
export function getProgress(videoId) {
    const history = getHistory();
    const item = history.find(h => h.id === videoId);
    return item?.progress || 0;
}

/**
 * Clear history
 */
export function clearHistory() {
    localStorage.setItem(CONFIG.STORAGE_KEYS.history, JSON.stringify([]));
}

// ============================================
// ❤️ FAVORITES
// ============================================

export function getFavorites() {
    try {
        return JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.favorites) || '[]');
    } catch {
        return [];
    }
}

export function toggleFavorite(video) {
    const favorites = getFavorites();
    const index = favorites.findIndex(item => item.id === video.id);
    
    if (index >= 0) {
        favorites.splice(index, 1);
        localStorage.setItem(CONFIG.STORAGE_KEYS.favorites, JSON.stringify(favorites));
        return false;
    } else {
        const favItem = {
            id: video.id,
            title: video.title,
            posterUrl: video.posterUrl,
            category: video.category,
            addedAt: new Date().toISOString()
        };
        favorites.unshift(favItem);
        localStorage.setItem(CONFIG.STORAGE_KEYS.favorites, JSON.stringify(favorites));
        return true;
    }
}

export function isFavorite(videoId) {
    const favorites = getFavorites();
    return favorites.some(item => item.id === videoId);
}

// ============================================
// ⏯️ CONTINUE WATCHING
// ============================================

export function getContinueWatching() {
    const history = getHistory();
    // Filter items with progress > 0 but < 0.9 (not finished)
    return history.filter(item => item.progress > 0 && item.progress < 0.9);
}

export function removeFromContinue(videoId) {
    const history = getHistory();
    const item = history.find(h => h.id === videoId);
    if (item) {
        item.progress = 0; // Mark as not started
        localStorage.setItem(CONFIG.STORAGE_KEYS.history, JSON.stringify(history));
    }
}

// ============================================
// 📊 USER STATS
// ============================================

export function getUserStats() {
    const history = getHistory();
    const watchlist = getWatchlist();
    const favorites = getFavorites();
    
    const totalWatchTime = history.reduce((sum, item) => {
        // Estimate: progress * duration (if available)
        const duration = parseDuration(item.duration);
        return sum + (duration * (item.progress || 0));
    }, 0);
    
    const categoryBreakdown = {};
    history.forEach(item => {
        categoryBreakdown[item.category] = (categoryBreakdown[item.category] || 0) + 1;
    });
    
    return {
        totalWatched: history.length,
        totalWatchTime: Math.floor(totalWatchTime / 60), // minutes
        watchlistCount: watchlist.length,
        favoritesCount: favorites.length,
        categoryBreakdown,
        lastActive: history[0]?.watchedAt || null
    };
}

function parseDuration(durationStr) {
    if (!durationStr) return 120; // Default 2 hours (minutes)
    
    // Parse "2h 15m" format
    const hours = durationStr.match(/(\d+)h/);
    const minutes = durationStr.match(/(\d+)m/);
    
    let total = 0;
    if (hours) total += parseInt(hours[1]) * 60;
    if (minutes) total += parseInt(minutes[1]);
    
    return total || 120;
}

// ============================================
// 🗑️ CLEAR DATA
// ============================================

export function clearAllUserData() {
    Object.values(CONFIG.STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
    });
}

export function clearSpecificData(type) {
    const keyMap = {
        'watchlist': CONFIG.STORAGE_KEYS.watchlist,
        'history': CONFIG.STORAGE_KEYS.history,
        'favorites': CONFIG.STORAGE_KEYS.favorites,
        'continue': CONFIG.STORAGE_KEYS.continueWatching
    };
    
    const key = keyMap[type];
    if (key) {
        localStorage.setItem(key, JSON.stringify([]));
    }
}

// ============================================
// 💾 BACKUP & RESTORE
// ============================================

export function exportUserData() {
    const data = {
        watchlist: getWatchlist(),
        history: getHistory(),
        favorites: getFavorites(),
        exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `streamer_backup_${Date.now()}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
}

export function importUserData(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        
        if (data.watchlist) {
            localStorage.setItem(CONFIG.STORAGE_KEYS.watchlist, JSON.stringify(data.watchlist));
        }
        if (data.history) {
            localStorage.setItem(CONFIG.STORAGE_KEYS.history, JSON.stringify(data.history));
        }
        if (data.favorites) {
            localStorage.setItem(CONFIG.STORAGE_KEYS.favorites, JSON.stringify(data.favorites));
        }
        
        return true;
    } catch {
        return false;
    }
}

// ============================================
// 🔄 SYNC (Optional - for future use)
// ============================================

export function syncToFirebase(userId) {
    // Future implementation: sync local data to Firebase
    console.log('Sync to Firebase:', userId);
}

export function syncFromFirebase(userId) {
    // Future implementation: sync from Firebase to local
    console.log('Sync from Firebase:', userId);
}

// ============================================
// 🚀 EXPORTS
// ============================================

export default {
    initStorage,
    
    // Watchlist
    getWatchlist,
    toggleWatchlistItem,
    isInWatchlist,
    removeFromWatchlist,
    
    // History
    getHistory,
    addToHistory,
    updateProgress,
    getProgress,
    clearHistory,
    
    // Favorites
    getFavorites,
    toggleFavorite,
    isFavorite,
    
    // Continue Watching
    getContinueWatching,
    removeFromContinue,
    
    // Stats
    getUserStats,
    
    // Management
    clearAllUserData,
    clearSpecificData,
    exportUserData,
    importUserData,
    
    // Sync
    syncToFirebase,
    syncFromFirebase
};
