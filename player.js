// ============================================
// STREAMER OTT - VIDEO PLAYER LOGIC
// ============================================
// Handles: Dailymotion Embed, Subtitles, Watch Time, Controls
// ============================================

import CONFIG from '../config.js';
import { getHistory, addToHistory, getWatchlist, toggleWatchlistItem, isInWatchlist } from './storage.js';
import { showToast, showLoading, hideLoading } from './ui.js';
import { allVideos } from './app.js';

// 🔥 FIREBASE
import { getFirestore, doc, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";
import { getApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";

const app = getApp();
const db = getFirestore(app);

// 🎯 STATE
let currentVideo = null;
let watchStartTime = null;
let subtitleEnabled = false;
let player = null;

// ============================================
// 🚀 INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    showLoading();
    
    // Get video ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('v');
    
    if (!videoId) {
        showToast('No video selected', 'error');
        setTimeout(() => window.location.href = './index.html', 2000);
        return;
    }
    
    // Load video data
    await loadVideo(videoId);
    
    // Setup UI
    setupPlayer();
    setupControls();
    setupSubtitles();
    
    // Update watchlist button state
    updateWatchlistButton();
    
    // Load related videos
    loadRelatedVideos();
    
    hideLoading();
});

// ============================================
// 📥 LOAD VIDEO DATA
// ============================================

async function loadVideo(videoId) {
    try {
        // Try Firebase first
        const docRef = doc(db, 'videos', videoId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            currentVideo = { id: docSnap.id, ...docSnap.data() };
        } else {
            // Fallback: check allVideos from app.js
            currentVideo = allVideos.find(v => v.id === videoId);
        }
        
        if (!currentVideo) {
            showToast('Video not found', 'error');
            setTimeout(() => window.location.href = './index.html', 2000);
            return;
        }
        
        // Update views count
        await updateViews(videoId);
        
        // Render video info
        renderVideoInfo();
        
        // Setup Dailymotion embed
        setupDailymotionEmbed();
        
        // Add to history
        addToHistory(currentVideo);
        
        // Start watch time tracking
        watchStartTime = Date.now();
        
    } catch (error) {
        console.error('Error loading video:', error);
        showToast('Failed to load video', 'error');
    }
}

async function updateViews(videoId) {
    try {
        const docRef = doc(db, 'videos', videoId);
        await updateDoc(docRef, {
            views: increment(1)
        });
    } catch (error) {
        console.log('Views update failed (offline mode)');
    }
}

// ============================================
// 🎬 DAILYMOTION EMBED
// ============================================

function setupDailymotionEmbed() {
    const iframe = document.getElementById('dailymotion-player');
    if (!iframe || !currentVideo) return;
    
    // Extract video ID from Dailymotion URL
    const dailymotionId = extractDailymotionId(currentVideo.videoUrl);
    
    if (!dailymotionId) {
        showToast('Invalid video URL', 'error');
        return;
    }
    
    // Build embed URL with parameters
    const embedUrl = buildEmbedUrl(dailymotionId);
    
    iframe.src = embedUrl;
    
    // Track when user leaves page
    window.addEventListener('beforeunload', saveWatchTime);
}

function extractDailymotionId(url) {
    if (!url) return null;
    
    // Patterns:
    // https://www.dailymotion.com/video/x8m39t1
    // https://dai.ly/x8m39t1
    
    const patterns = [
        /dailymotion\.com\/video\/([a-zA-Z0-9]+)/,
        /dai\.ly\/([a-zA-Z0-9]+)/,
        /video\/([a-zA-Z0-9]+)$/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    
    // If URL is just the ID
    if (/^[a-zA-Z0-9]+$/.test(url)) return url;
    
    return null;
}

function buildEmbedUrl(videoId) {
    const params = new URLSearchParams({
        autoplay: CONFIG.VIDEO.autoplay ? '1' : '0',
        mute: '0',
        controls: '1',
        ui: 'light',  // Clean UI
        logo: '0',    // Hide Dailymotion logo
        quality: CONFIG.VIDEO.defaultQuality
    });
    
    return `https://www.dailymotion.com/embed/video/${videoId}?${params.toString()}`;
}

// ============================================
// ℹ️ RENDER VIDEO INFO
// ============================================

function renderVideoInfo() {
    if (!currentVideo) return;
    
    // Title
    const titleEl = document.getElementById('video-title');
    if (titleEl) titleEl.textContent = currentVideo.title || 'Untitled';
    
    // Meta
    const yearEl = document.getElementById('video-year');
    if (yearEl) yearEl.textContent = currentVideo.year || '2024';
    
    const ratingEl = document.getElementById('video-rating');
    if (ratingEl) ratingEl.textContent = currentVideo.rating || 'U/A 16+';
    
    const durationEl = document.getElementById('video-duration');
    if (durationEl) durationEl.textContent = currentVideo.duration || '2h 15m';
    
    // Description
    const descEl = document.getElementById('video-description');
    if (descEl) descEl.textContent = currentVideo.description || 'No description available.';
    
    // Tags
    const tagsEl = document.getElementById('video-tags');
    if (tagsEl && currentVideo.tags) {
        const tags = currentVideo.tags.split(',').map(t => t.trim());
        tagsEl.innerHTML = tags.map(tag => 
            `<span class="px-3 py-1 bg-gray-800 rounded-full text-xs text-gray-300">${tag}</span>`
        ).join('');
    }
    
    // Update page title
    document.title = `${currentVideo.title} - STREAMER`;
}

// ============================================
// 🎚️ PLAYER CONTROLS
// ============================================

function setupControls() {
    // Fullscreen button
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    fullscreenBtn?.addEventListener('click', toggleFullscreen);
    
    // Play/Pause (for custom controls overlay)
    const playPauseBtn = document.getElementById('play-pause-btn');
    playPauseBtn?.addEventListener('click', () => {
        // Dailymotion handles this internally
        showToast('Use player controls', 'info');
    });
    
    // Volume
    const volumeBtn = document.getElementById('volume-btn');
    volumeBtn?.addEventListener('click', () => {
        showToast('Use player controls', 'info');
    });
    
    // Picture in Picture
    const pipBtn = document.getElementById('pip-btn');
    pipBtn?.addEventListener('click', togglePictureInPicture);
}

window.toggleFullscreen = function() {
    const iframe = document.getElementById('dailymotion-player');
    if (!iframe) return;
    
    if (!document.fullscreenElement) {
        iframe.requestFullscreen?.() || 
        iframe.webkitRequestFullscreen?.() ||
        iframe.mozRequestFullScreen?.();
    } else {
        document.exitFullscreen?.() ||
        document.webkitExitFullscreen?.() ||
        document.mozCancelFullScreen?.();
    }
};

function togglePictureInPicture() {
    const iframe = document.getElementById('dailymotion-player');
    if (!iframe) return;
    
    if (document.pictureInPictureElement) {
        document.exitPictureInPicture();
    } else {
        iframe.requestPictureInPicture?.().catch(err => {
            showToast('PIP not supported', 'warning');
        });
    }
}

window.playVideo = function() {
    const iframe = document.getElementById('dailymotion-player');
    if (iframe) {
        // Focus iframe to enable keyboard controls
        iframe.focus();
        showToast('Press play in the player', 'info');
    }
};

// ============================================
// 📝 SUBTITLES
// ============================================

function setupSubtitles() {
    const toggle = document.getElementById('subtitle-toggle');
    if (!toggle) return;
    
    toggle.addEventListener('click', () => {
        subtitleEnabled = !subtitleEnabled;
        toggle.classList.toggle('active', subtitleEnabled);
        
        if (subtitleEnabled && currentVideo?.subtitles) {
            loadSubtitles();
            showToast('Subtitles enabled', 'success');
        } else if (subtitleEnabled) {
            showToast('No subtitles available', 'warning');
            subtitleEnabled = false;
            toggle.classList.remove('active');
        } else {
            hideSubtitles();
            showToast('Subtitles disabled', 'info');
        }
    });
    
    // Show subtitle section if available
    if (currentVideo?.subtitles) {
        const section = document.getElementById('subtitle-section');
        if (section) section.classList.remove('hidden');
        
        const list = document.getElementById('subtitle-list');
        if (list) {
            list.innerHTML = currentVideo.subtitles.map(sub => `
                <button onclick="selectSubtitle('${sub.lang}')" 
                    class="px-4 py-2 bg-gray-800 rounded-lg text-sm hover:bg-gray-700 transition">
                    ${getLangName(sub.lang)}
                </button>
            `).join('');
        }
    }
}

window.toggleSubtitles = function() {
    const toggle = document.getElementById('subtitle-toggle');
    toggle?.click();
};

function loadSubtitles() {
    // Dailymotion handles subtitles internally if provided in their system
    // For custom subtitles, we'd need a custom player implementation
    console.log('Loading subtitles...');
}

function hideSubtitles() {
    console.log('Hiding subtitles...');
}

window.selectSubtitle = function(lang) {
    showToast(`Subtitle: ${getLangName(lang)}`, 'success');
};

function getLangName(code) {
    const langs = {
        'en': 'English', 'hi': 'Hindi', 'es': 'Spanish',
        'fr': 'French', 'de': 'German', 'ja': 'Japanese',
        'ko': 'Korean', 'zh': 'Chinese'
    };
    return langs[code] || code;
}

window.downloadSubtitle = function() {
    if (!currentVideo?.subtitles?.length) {
        showToast('No subtitles available', 'warning');
        return;
    }
    
    // In real implementation, download from Firebase Storage
    showToast('Subtitle download started', 'success');
};

// ============================================
// ⭐ WATCHLIST
// ============================================

function updateWatchlistButton() {
    if (!currentVideo) return;
    
    const btn = document.getElementById('add-watchlist-btn');
    if (!btn) return;
    
    const inList = isInWatchlist(currentVideo.id);
    
    if (inList) {
        btn.innerHTML = '<i class="fas fa-check"></i> In My List';
        btn.classList.add('bg-green-600');
    } else {
        btn.innerHTML = '<i class="fas fa-plus"></i> Add to List';
        btn.classList.remove('bg-green-600');
    }
}

window.toggleWatchlist = function() {
    if (!currentVideo) return;
    
    const added = toggleWatchlistItem(currentVideo);
    
    if (added) {
        showToast('Added to My List', 'success');
    } else {
        showToast('Removed from My List', 'info');
    }
    
    updateWatchlistButton();
};

// ============================================
// 📤 SHARE
// ============================================

window.shareVideo = function() {
    if (!currentVideo) return;
    
    const url = `${window.location.origin}/watch.html?v=${currentVideo.id}`;
    
    if (navigator.share) {
        navigator.share({
            title: currentVideo.title,
            text: `Watch ${currentVideo.title} on STREAMER`,
            url: url
        });
    } else {
        // Copy to clipboard
        navigator.clipboard.writeText(url).then(() => {
            showToast('Link copied to clipboard', 'success');
        });
    }
};

// ============================================
// 🎬 RELATED VIDEOS
// ============================================

function loadRelatedVideos() {
    if (!currentVideo) return;
    
    const relatedRow = document.getElementById('related-row');
    if (!relatedRow) return;
    
    // Filter same category, exclude current
    const related = allVideos.filter(v => 
        v.id !== currentVideo.id && 
        v.category === currentVideo.category
    ).slice(0, 10);
    
    if (!related.length) {
        // Show trending as fallback
        const trending = allVideos.filter(v => v.id !== currentVideo.id).slice(0, 10);
        relatedRow.innerHTML = trending.map(v => createRelatedCard(v)).join('');
        return;
    }
    
    relatedRow.innerHTML = related.map(v => createRelatedCard(v)).join('');
}

function createRelatedCard(video) {
    return `
        <div class="content-card" onclick="window.location.href='./watch.html?v=${video.id}'">
            <img src="${video.posterUrl || 'https://via.placeholder.com/300x170?text=No+Poster'}" 
                 alt="${video.title}" loading="lazy">
            <div class="card-info">
                <div class="card-title">${video.title}</div>
                <div class="card-meta">
                    <span>${video.year || '2024'}</span>
                    <span>${video.rating || 'U/A'}</span>
                </div>
            </div>
        </div>
    `;
}

// ============================================
// ⏱️ WATCH TIME TRACKING
// ============================================

function saveWatchTime() {
    if (!watchStartTime || !currentVideo) return;
    
    const duration = Math.floor((Date.now() - watchStartTime) / 1000); // seconds
    const progress = Math.min(duration / 120, 1); // Assume 2 min video, cap at 100%
    
    // Save to localStorage for "Continue Watching"
    const history = getHistory();
    const existing = history.find(h => h.id === currentVideo.id);
    
    if (existing) {
        existing.progress = progress;
        existing.watchedAt = new Date().toISOString();
    }
    
    localStorage.setItem(CONFIG.STORAGE_KEYS.history, JSON.stringify(history));
}

// ============================================
// 🎚️ SCROLL ROWS (for related)
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
        if (e.target.closest('.player-container')) {
            e.preventDefault();
        }
    });
}

// Prevent iframe manipulation
document.addEventListener('keydown', (e) => {
    // Disable F12, Ctrl+Shift+I, Ctrl+U
    if (e.key === 'F12' || 
        (e.ctrlKey && e.shiftKey && e.key === 'I') ||
        (e.ctrlKey && e.key === 'u')) {
        e.preventDefault();
    }
});
