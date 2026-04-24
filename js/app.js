// ============================================
// STREAMER OTT - MAIN APP LOGIC
// ============================================
// Handles: Homepage, Content Rows, Search, Watchlist, History
// ============================================

import CONFIG from '../config.js';
import { initStorage, getWatchlist, getHistory, addToHistory, toggleWatchlistItem, isInWatchlist } from './storage.js';
import { showToast, showLoading, hideLoading, createContentCard, scrollRow } from './ui.js';
import { searchContent } from './search.js';

// 🔥 FIREBASE IMPORTS
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy, limit, where, onSnapshot } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

// Initialize Firebase
const app = initializeApp(CONFIG.FIREBASE);
const db = getFirestore(app);

// 🎯 STATE
let allVideos = [];
let trendingVideos = [];
let isAdmin = false;

// ============================================
// 🚀 INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    showLoading();
    
    // Init local storage
    initStorage();
    
    // Setup UI
    setupNavbar();
    setupSearch();
    setupMobileMenu();
    
    // Load content
    await loadAllContent();
    
    // Render sections
    renderContinueWatching();
    renderTrending();
    renderCategoryRows();
    renderWatchlist();
    
    // Hide loading
    setTimeout(hideLoading, 500);
    
    // Update watchlist count
    updateWatchlistCount();
});

// ============================================
// 📥 LOAD CONTENT FROM FIREBASE
// ============================================

async function loadAllContent() {
    try {
        // Get all videos ordered by upload date
        const videosRef = collection(db, 'videos');
        const q = query(videosRef, orderBy('uploadedAt', 'desc'));
        
        const snapshot = await getDocs(q);
        allVideos = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Separate trending (first 10)
        trendingVideos = allVideos.slice(0, 10);
        
        // Real-time updates
        onSnapshot(q, (snapshot) => {
            allVideos = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            trendingVideos = allVideos.slice(0, 10);
            refreshAllSections();
        });
        
    } catch (error) {
        console.error('Error loading content:', error);
        showToast('Failed to load content', 'error');
        
        // Load from localStorage fallback
        loadLocalFallback();
    }
}

function loadLocalFallback() {
    const local = localStorage.getItem('streamer_local_videos');
    if (local) {
        allVideos = JSON.parse(local);
        trendingVideos = allVideos.slice(0, 10);
    }
}

// ============================================
// 🎬 RENDER SECTIONS
// ============================================

function renderContinueWatching() {
    const history = getHistory();
    const section = document.getElementById('continue-section');
    const row = document.getElementById('continue-row');
    
    if (!history.length) {
        section.classList.add('hidden');
        return;
    }
    
    section.classList.remove('hidden');
    row.innerHTML = history.slice(0, 10).map(video => createContentCard(video, true)).join('');
}

function renderTrending() {
    const row = document.getElementById('trending-row');
    if (!trendingVideos.length) {
        row.innerHTML = '<div class="text-gray-500 p-4">No trending content yet</div>';
        return;
    }
    row.innerHTML = trendingVideos.map(video => createContentCard(video)).join('');
}

function renderCategoryRows() {
    const categories = ['movies', 'anime', 'series', 'tv', 'documentary'];
    const categoryNames = {
        'movies': 'movies-row',
        'anime': 'anime-row',
        'series': 'series-row',
        'tv': 'tv-row',
        'documentary': 'doc-row'
    };
    
    categories.forEach(cat => {
        const rowId = categoryNames[cat];
        const row = document.getElementById(rowId);
        if (!row) return;
        
        const catVideos = allVideos.filter(v => v.category === cat);
        
        if (!catVideos.length) {
            // Show coming soon placeholder cards
            row.innerHTML = generateComingSoonCards(6);
        } else {
            row.innerHTML = catVideos.map(video => createContentCard(video)).join('');
        }
    });
}

function generateComingSoonCards(count) {
    const placeholders = [
        { title: 'Coming Soon', genre: 'Action' },
        { title: 'Coming Soon', genre: 'Drama' },
        { title: 'Coming Soon', genre: 'Comedy' },
        { title: 'Coming Soon', genre: 'Thriller' },
        { title: 'Coming Soon', genre: 'Romance' },
        { title: 'Coming Soon', genre: 'Sci-Fi' }
    ];
    
    return Array(count).fill(0).map((_, i) => `
        <div class="content-card opacity-60">
            <div class="relative aspect-video bg-gray-800 rounded-lg flex items-center justify-center">
                <div class="text-center">
                    <i class="fas fa-clock text-4xl text-gray-600 mb-2"></i>
                    <div class="text-gray-500 text-sm">Coming Soon</div>
                </div>
                <div class="coming-soon-badge">Coming Soon</div>
            </div>
            <div class="mt-2">
                <div class="text-sm font-medium text-gray-400">${placeholders[i]?.genre || 'Various'}</div>
            </div>
        </div>
    `).join('');
}

function renderWatchlist() {
    const watchlist = getWatchlist();
    const section = document.getElementById('watchlist-section');
    const row = document.getElementById('watchlist-row');
    const empty = document.getElementById('watchlist-empty');
    
    if (!watchlist.length) {
        section.classList.add('hidden');
        return;
    }
    
    section.classList.remove('hidden');
    row.innerHTML = watchlist.map(video => createContentCard(video)).join('');
    
    if (watchlist.length === 0) {
        empty.classList.remove('hidden');
    } else {
        empty.classList.add('hidden');
    }
}

function refreshAllSections() {
    renderContinueWatching();
    renderTrending();
    renderCategoryRows();
    renderWatchlist();
    updateWatchlistCount();
}

// ============================================
// 🔍 SEARCH
// ============================================

function setupSearch() {
    const searchBtn = document.getElementById('search-btn');
    const searchOverlay = document.getElementById('search-overlay');
    const searchInput = document.getElementById('search-input');
    const searchClose = document.getElementById('search-close');
    const searchResults = document.getElementById('search-results');
    
    searchBtn?.addEventListener('click', () => {
        searchOverlay.classList.add('active');
        searchInput.focus();
    });
    
    searchClose?.addEventListener('click', closeSearch);
    
    searchOverlay?.addEventListener('click', (e) => {
        if (e.target === searchOverlay) closeSearch();
    });
    
    let searchTimeout;
    searchInput?.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        
        if (!query) {
            searchResults.innerHTML = '';
            return;
        }
        
        searchTimeout = setTimeout(() => performSearch(query), 300);
    });
    
    // Keyboard shortcut - press / to search
    document.addEventListener('keydown', (e) => {
        if (e.key === '/' && !searchOverlay.classList.contains('active')) {
            e.preventDefault();
            searchOverlay.classList.add('active');
            searchInput.focus();
        }
        if (e.key === 'Escape' && searchOverlay.classList.contains('active')) {
            closeSearch();
        }
    });
}

function performSearch(query) {
    const searchResults = document.getElementById('search-results');
    const results = searchContent(allVideos, query);
    
    if (!results.length) {
        searchResults.innerHTML = `
            <div class="empty-state py-8">
                <i class="fas fa-search text-4xl"></i>
                <h3>No results found</h3>
                <p>Try different keywords</p>
            </div>
        `;
        return;
    }
    
    searchResults.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            ${results.map(video => createContentCard(video)).join('')}
        </div>
    `;
}

function closeSearch() {
    const searchOverlay = document.getElementById('search-overlay');
    const searchInput = document.getElementById('search-input');
    searchOverlay.classList.remove('active');
    searchInput.value = '';
    document.getElementById('search-results').innerHTML = '';
}

// ============================================
// 🧭 NAVBAR
// ============================================

function setupNavbar() {
    const navbar = document.getElementById('navbar');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });
}

// ============================================
// 📱 MOBILE MENU
// ============================================

function setupMobileMenu() {
    const menuToggle = document.getElementById('menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    
    menuToggle?.addEventListener('click', () => {
        mobileMenu.classList.remove('hidden');
        mobileMenu.classList.add('flex');
    });
}

window.closeMobileMenu = function() {
    const mobileMenu = document.getElementById('mobile-menu');
    mobileMenu.classList.add('hidden');
    mobileMenu.classList.remove('flex');
};

// ============================================
// ⭐ WATCHLIST FUNCTIONS
// ============================================

window.addToWatchlist = function(videoId) {
    const video = allVideos.find(v => v.id === videoId);
    if (!video) return;
    
    const added = toggleWatchlistItem(video);
    
    if (added) {
        showToast('Added to My List', 'success');
    } else {
        showToast('Removed from My List', 'info');
    }
    
    updateWatchlistCount();
    renderWatchlist();
};

window.toggleWatchlist = function() {
    // Get current video from URL
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('v');
    
    if (videoId) {
        addToWatchlist(videoId);
    }
};

function updateWatchlistCount() {
    const count = getWatchlist().length;
    const badge = document.getElementById('watchlist-count');
    
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
}

// ============================================
// 🎬 WATCH VIDEO
// ============================================

window.watchVideo = function(videoId) {
    const video = allVideos.find(v => v.id === videoId);
    if (!video) {
        showToast('Video not found', 'error');
        return;
    }
    
    // Add to history
    addToHistory(video);
    
    // Navigate to watch page
    window.location.href = `./watch.html?v=${videoId}`;
};

// ============================================
// 🎚️ SCROLL ROWS
// ============================================

window.scrollRow = function(rowId, direction) {
    const row = document.getElementById(rowId);
    if (!row) return;
    
    const scrollAmount = row.clientWidth * 0.8;
    row.scrollBy({
        left: direction * scrollAmount,
        behavior: 'smooth'
    });
};

// ============================================
// 🔒 SECURITY
// ============================================

if (CONFIG.SECURITY.disableRightClick) {
    document.addEventListener('contextmenu', (e) => {
        if (e.target.closest('.content-card') || e.target.closest('.player-container')) {
            e.preventDefault();
        }
    });
}

// ============================================
// 📤 EXPORTS
// ============================================

export { allVideos, trendingVideos, db };
