// ============================================
// STREAMER OTT - ADMIN PANEL LOGIC
// ============================================
// Handles: Login, Video Upload, Content Manage, Shortener, Settings
// ============================================

import CONFIG from '../config.js';
import { showToast, showLoading, hideLoading } from './ui.js';

// 🔥 FIREBASE
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    deleteDoc, 
    doc, 
    updateDoc,
    query,
    orderBy,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";
import { 
    getStorage, 
    ref, 
    uploadBytes, 
    getDownloadURL 
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-storage.js";

const app = initializeApp(CONFIG.FIREBASE);
const db = getFirestore(app);
const storage = getStorage(app);

// 🎯 STATE
let isLoggedIn = false;
let uploadedPoster = null;
let uploadedSubtitle = null;
let shortenerEnabled = CONFIG.SHORTENER.enabled;

// ============================================
// 🔐 ADMIN CREDENTIALS (Change in config.js)
// ============================================

const ADMIN_KEY = 'streamer_admin_2024';  // Change this!
const ADMIN_PASSWORD = 'admin123';         // Change this!

// ============================================
// 🚀 INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    checkAdminSession();
    updateDate();
});

// ============================================
// 🔐 LOGIN SYSTEM
// ============================================

window.handleLogin = function(e) {
    e.preventDefault();
    
    const key = document.getElementById('admin-key').value;
    const password = document.getElementById('admin-password').value;
    const remember = document.getElementById('remember-admin').checked;
    
    if (key === ADMIN_KEY && password === ADMIN_PASSWORD) {
        isLoggedIn = true;
        
        if (remember) {
            localStorage.setItem(CONFIG.STORAGE_KEYS.adminSession, 'true');
        } else {
            sessionStorage.setItem(CONFIG.STORAGE_KEYS.adminSession, 'true');
        }
        
        showToast('Welcome Admin!', 'success');
        showDashboard();
    } else {
        showToast('Invalid credentials!', 'error');
        
        // Shake animation
        const box = document.querySelector('.login-box');
        box.style.animation = 'shake 0.5s';
        setTimeout(() => box.style.animation = '', 500);
    }
    
    return false;
};

function checkAdminSession() {
    const session = localStorage.getItem(CONFIG.STORAGE_KEYS.adminSession) || 
                   sessionStorage.getItem(CONFIG.STORAGE_KEYS.adminSession);
    
    if (session === 'true') {
        isLoggedIn = true;
        showDashboard();
    } else {
        showLogin();
    }
}

function showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('admin-dashboard').style.display = 'none';
    hideLoading();
}

function showDashboard() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('admin-dashboard').style.display = 'block';
    
    // Load dashboard data
    loadDashboardStats();
    loadRecentUploads();
    loadContentList();
    loadCategories();
    
    hideLoading();
}

window.logout = function() {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.adminSession);
    sessionStorage.removeItem(CONFIG.STORAGE_KEYS.adminSession);
    isLoggedIn = false;
    showToast('Logged out', 'info');
    setTimeout(() => location.reload(), 500);
};

// ============================================
// 📊 DASHBOARD STATS
// ============================================

async function loadDashboardStats() {
    try {
        const videosRef = collection(db, 'videos');
        const snapshot = await getDocs(videosRef);
        
        const totalVideos = snapshot.size;
        let totalViews = 0;
        let todayViews = 0;
        let totalWatchTime = 0;
        
        const today = new Date().toDateString();
        
        snapshot.forEach(doc => {
            const data = doc.data();
            totalViews += data.views || 0;
            totalWatchTime += data.watchTime || 0;
            
            if (data.lastViewed) {
                const lastViewed = new Date(data.lastViewed.toDate()).toDateString();
                if (lastViewed === today) todayViews += data.views || 0;
            }
        });
        
        // Update UI
        document.getElementById('total-videos').textContent = totalVideos;
        document.getElementById('total-views').textContent = formatNumber(totalViews);
        document.getElementById('today-views').textContent = formatNumber(todayViews);
        document.getElementById('watch-time').textContent = Math.floor(totalWatchTime / 3600) + 'h';
        
    } catch (error) {
        console.error('Stats error:', error);
    }
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

// ============================================
// 📤 VIDEO UPLOAD
// ============================================

// 🖼️ DRAG & DROP POSTER
window.handleDragOver = function(e) {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
};

window.handleDragLeave = function(e) {
    e.currentTarget.classList.remove('dragover');
};

window.handleDrop = function(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length) handlePosterFile(files[0]);
};

window.handleFileSelect = function(e) {
    const file = e.target.files[0];
    if (file) handlePosterFile(file);
};

function handlePosterFile(file) {
    if (!file.type.startsWith('image/')) {
        showToast('Please upload an image file', 'error');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        showToast('Image too large (max 5MB)', 'error');
        return;
    }
    
    uploadedPoster = file;
    
    // Preview
    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById('poster-preview');
        const img = preview.querySelector('img');
        img.src = e.target.result;
        preview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
    
    showToast('Poster selected', 'success');
}

window.clearPoster = function() {
    uploadedPoster = null;
    document.getElementById('poster-preview').classList.add('hidden');
    document.getElementById('poster-input').value = '';
};

// 📝 SUBTITLE HANDLING
document.getElementById('subtitle-input')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        if (!file.name.match(/\.(vtt|srt)$/i)) {
            showToast('Only .vtt or .srt files allowed', 'error');
            this.value = '';
            return;
        }
        uploadedSubtitle = file;
        showToast('Subtitle file selected', 'success');
    }
});

// 🚀 FORM SUBMIT
document.getElementById('upload-form')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    if (!isLoggedIn) {
        showToast('Please login first', 'error');
        return;
    }
    
    showLoading();
    
    try {
        // Get form values
        const videoUrl = document.getElementById('video-url').value.trim();
        const title = document.getElementById('video-title').value.trim();
        const description = document.getElementById('video-description').value.trim();
        const category = document.getElementById('video-category').value;
        const genre = document.getElementById('video-genre').value;
        const year = document.getElementById('video-year').value;
        const rating = document.getElementById('video-rating').value;
        const tags = document.getElementById('video-tags').value;
        
        // Validate
        if (!videoUrl || !title || !category) {
            showToast('Please fill required fields', 'error');
            hideLoading();
            return;
        }
        
        // Extract Dailymotion ID
        const videoId = extractDailymotionId(videoUrl);
        if (!videoId) {
            showToast('Invalid Dailymotion URL', 'error');
            hideLoading();
            return;
        }
        
        // Upload poster to Firebase Storage
        let posterUrl = '';
        if (uploadedPoster) {
            const posterRef = ref(storage, `posters/${Date.now()}_${uploadedPoster.name}`);
            await uploadBytes(posterRef, uploadedPoster);
            posterUrl = await getDownloadURL(posterRef);
        }
        
        // Upload subtitle to Firebase Storage
        let subtitleData = null;
        if (uploadedSubtitle) {
            const subRef = ref(storage, `subtitles/${Date.now()}_${uploadedSubtitle.name}`);
            await uploadBytes(subRef, uploadedSubtitle);
            const subUrl = await getDownloadURL(subRef);
            const lang = document.getElementById('subtitle-lang').value;
            
            subtitleData = [{
                url: subUrl,
                lang: lang,
                label: getLangName(lang)
            }];
        }
        
        // Generate short link if enabled
        let shortLink = '';
        if (shortenerEnabled) {
            shortLink = await generateShortLink(videoUrl);
        }
        
        // Save to Firestore
        const videoData = {
            title,
            description,
            videoUrl,
            videoId,
            category,
            genre: genre || '',
            year: year || new Date().getFullYear(),
            rating: rating || 'U/A 16+',
            tags: tags || '',
            posterUrl: posterUrl || `https://via.placeholder.com/300x170?text=${encodeURIComponent(title)}`,
            subtitles: subtitleData,
            shortLink,
            views: 0,
            watchTime: 0,
            uploadedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        
        await addDoc(collection(db, 'videos'), videoData);
        
        // Also save to localStorage for offline fallback
        saveLocalVideo(videoData);
        
        showToast('Video published successfully!', 'success');
        
        // Reset form
        this.reset();
        clearPoster();
        uploadedSubtitle = null;
        
        // Refresh lists
        loadRecentUploads();
        loadContentList();
        loadDashboardStats();
        
    } catch (error) {
        console.error('Upload error:', error);
        showToast('Upload failed: ' + error.message, 'error');
    }
    
    hideLoading();
});

function extractDailymotionId(url) {
    const patterns = [
        /dailymotion\.com\/video\/([a-zA-Z0-9]+)/,
        /dai\.ly\/([a-zA-Z0-9]+)/,
        /video\/([a-zA-Z0-9]+)$/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    
    if (/^[a-zA-Z0-9]+$/.test(url)) return url;
    return null;
}

function getLangName(code) {
    const langs = {
        'en': 'English', 'hi': 'Hindi', 'es': 'Spanish',
        'fr': 'French', 'de': 'German', 'ja': 'Japanese',
        'ko': 'Korean', 'zh': 'Chinese'
    };
    return langs[code] || code;
}

function saveLocalVideo(video) {
    let local = JSON.parse(localStorage.getItem('streamer_local_videos') || '[]');
    local.unshift(video);
    localStorage.setItem('streamer_local_videos', JSON.stringify(local));
}

// ============================================
// 🔗 SHORTENER TOGGLE
// ============================================

window.toggleShortener = function() {
    shortenerEnabled = !shortenerEnabled;
    
    const btn = document.getElementById('shortener-toggle-btn');
    const status = document.getElementById('shortener-status');
    
    btn.classList.toggle('active', shortenerEnabled);
    status.textContent = shortenerEnabled ? 'Currently ON' : 'Currently OFF';
    status.classList.toggle('text-green-400', shortenerEnabled);
    status.classList.toggle('text-gray-500', !shortenerEnabled);
    
    showToast(`Shortener ${shortenerEnabled ? 'enabled' : 'disabled'}`, 'info');
};

async function generateShortLink(longUrl) {
    try {
        const response = await fetch(`${CONFIG.SHORTENER.baseUrl}/shorten`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CONFIG.SHORTENER.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                long_url: longUrl,
                domain: CONFIG.SHORTENER.domain
            })
        });
        
        const data = await response.json();
        return data.link || data.short_url || '';
        
    } catch (error) {
        console.error('Shortener error:', error);
        return '';
    }
}

// ============================================
// 📋 MANAGE CONTENT
// ============================================

async function loadContentList() {
    try {
        const videosRef = collection(db, 'videos');
        const q = query(videosRef, orderBy('uploadedAt', 'desc'));
        const snapshot = await getDocs(q);
        
        const list = document.getElementById('content-list');
        if (!snapshot.size) {
            list.innerHTML = `
                <div class="text-gray-500 text-center py-12">
                    <i class="fas fa-film text-4xl mb-4 opacity-50"></i>
                    <p>No content uploaded yet</p>
                </div>
            `;
            return;
        }
        
        list.innerHTML = snapshot.docs.map(doc => {
            const data = doc.data();
            return `
                <div class="bg-[#141414] rounded-lg p-4 flex items-center gap-4 hover:bg-[#1a1a1a] transition">
                    <img src="${data.posterUrl}" alt="${data.title}" class="w-24 h-14 object-cover rounded">
                    <div class="flex-1 min-w-0">
                        <div class="font-bold truncate">${data.title}</div>
                        <div class="text-sm text-gray-500">
                            ${data.category} • ${data.year} • ${formatNumber(data.views || 0)} views
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="editVideo('${doc.id}')" class="p-2 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deleteVideo('${doc.id}')" class="p-2 rounded bg-red-600/20 text-red-400 hover:bg-red-600/30 transition" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                        <a href="../watch.html?v=${doc.id}" target="_blank" class="p-2 rounded bg-green-600/20 text-green-400 hover:bg-green-600/30 transition" title="Preview">
                            <i class="fas fa-play"></i>
                        </a>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Load content error:', error);
    }
}

window.editVideo = function(id) {
    showToast('Edit feature coming soon', 'info');
};

window.deleteVideo = async function(id) {
    if (!confirm('Are you sure? This cannot be undone!')) return;
    
    showLoading();
    try {
        await deleteDoc(doc(db, 'videos', id));
        showToast('Video deleted', 'success');
        loadContentList();
        loadDashboardStats();
    } catch (error) {
        showToast('Delete failed', 'error');
    }
    hideLoading();
};

window.filterContent = function() {
    // Implementation for category filter
    loadContentList();
};

window.searchContent = function() {
    // Implementation for search
    loadContentList();
};

// ============================================
// 📊 RECENT UPLOADS
// ============================================

async function loadRecentUploads() {
    try {
        const videosRef = collection(db, 'videos');
        const q = query(videosRef, orderBy('uploadedAt', 'desc'), limit(5));
        const snapshot = await getDocs(q);
        
        const container = document.getElementById('recent-uploads');
        
        if (!snapshot.size) {
            container.innerHTML = '<div class="text-gray-500 text-center py-4">No recent uploads</div>';
            return;
        }
        
        container.innerHTML = snapshot.docs.map(doc => {
            const data = doc.data();
            const date = data.uploadedAt?.toDate?.() || new Date();
            return `
                <div class="flex items-center gap-3 p-3 rounded hover:bg-white/5 transition">
                    <img src="${data.posterUrl}" class="w-12 h-8 object-cover rounded">
                    <div class="flex-1 min-w-0">
                        <div class="text-sm font-medium truncate">${data.title}</div>
                        <div class="text-xs text-gray-500">${data.category} • ${timeAgo(date)}</div>
                    </div>
                    <span class="text-xs ${data.views > 0 ? 'text-green-400' : 'text-gray-600'}">
                        ${data.views || 0} views
                    </span>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Recent uploads error:', error);
    }
}

function timeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

// ============================================
// 🏷️ CATEGORIES
// ============================================

function loadCategories() {
    const grid = document.getElementById('categories-grid');
    const categories = [
        { id: 'movies', name: 'Movies', icon: 'fa-film', count: 0, color: 'bg-red-600' },
        { id: 'anime', name: 'Anime', icon: 'fa-dragon', count: 0, color: 'bg-pink-600' },
        { id: 'series', name: 'Web Series', icon: 'fa-tv', count: 0, color: 'bg-blue-600' },
        { id: 'tv', name: 'TV Shows', icon: 'fa-broadcast-tower', count: 0, color: 'bg-green-600' },
        { id: 'documentary', name: 'Documentary', icon: 'fa-book-open', count: 0, color: 'bg-yellow-600' }
    ];
    
    // Get counts from Firestore (async)
    categories.forEach(async cat => {
        const q = query(collection(db, 'videos'), where('category', '==', cat.id));
        const snapshot = await getDocs(q);
        cat.count = snapshot.size;
        
        // Re-render with counts
        renderCategories(categories);
    });
    
    renderCategories(categories);
}

function renderCategories(categories) {
    const grid = document.getElementById('categories-grid');
    if (!grid) return;
    
    grid.innerHTML = categories.map(cat => `
        <div class="bg-[#141414] rounded-lg p-6 hover:bg-[#1a1a1a] transition cursor-pointer" onclick="filterByCategory('${cat.id}')">
            <div class="flex items-center justify-between mb-4">
                <div class="w-12 h-12 ${cat.color} rounded-lg flex items-center justify-center">
                    <i class="fas ${cat.icon} text-white text-xl"></i>
                </div>
                <span class="text-2xl font-bold">${cat.count}</span>
            </div>
            <div class="font-bold text-lg">${cat.name}</div>
            <div class="text-sm text-gray-500 mt-1">${cat.count} videos</div>
        </div>
    `).join('');
}

window.filterByCategory = function(category) {
    showSection('manage');
    document.getElementById('filter-category').value = category;
    filterContent();
};

// ============================================
// ⚙️ SETTINGS
// ============================================

window.toggleSetting = function(setting) {
    const toggles = {
        'maintenance': 'maintenance-toggle',
        'rightclick': 'rightclick-toggle',
        'autoplay': 'autoplay-toggle'
    };
    
    const el = document.getElementById(toggles[setting]);
    el.classList.toggle('active');
    
    const isActive = el.classList.contains('active');
    showToast(`${setting} ${isActive ? 'enabled' : 'disabled'}`, 'info');
    
    // Save to localStorage
    localStorage.setItem(`streamer_setting_${setting}`, isActive);
};

window.clearAllData = async function() {
    if (!confirm('WARNING: This will delete ALL videos! Are you sure?')) return;
    if (!confirm('This action CANNOT be undone. Confirm?')) return;
    
    showLoading();
    try {
        const videosRef = collection(db, 'videos');
        const snapshot = await getDocs(videosRef);
        
        const deletes = snapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletes);
        
        localStorage.removeItem('streamer_local_videos');
        
        showToast('All data cleared', 'success');
        loadDashboardStats();
        loadContentList();
        
    } catch (error) {
        showToast('Clear failed', 'error');
    }
    hideLoading();
};

// ============================================
// 📱 MOBILE MENU
// ============================================

window.toggleMobileMenu = function() {
    const menu = document.getElementById('mobile-admin-menu');
    menu.classList.toggle('hidden');
    menu.classList.toggle('flex');
};

// ============================================
// 🧭 NAVIGATION
// ============================================

window.showSection = function(sectionName) {
    // Hide all sections
    document.querySelectorAll('.admin-section').forEach(s => s.classList.add('hidden'));
    
    // Show selected
    document.getElementById(`section-${sectionName}`)?.classList.remove('hidden');
    
    // Update sidebar active state
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('bg-[#e50914]/20', 'border-l-4', 'border-[#e50914]', 'text-white');
        item.classList.add('text-gray-300');
    });
    
    // Highlight current
    event?.target?.classList.add('bg-[#e50914]/20', 'border-l-4', 'border-[#e50914]', 'text-white');
    event?.target?.classList.remove('text-gray-300');
    
    // Refresh data
    if (sectionName === 'dashboard') {
        loadDashboardStats();
        loadRecentUploads();
    } else if (sectionName === 'manage') {
        loadContentList();
    } else if (sectionName === 'categories') {
        loadCategories();
    }
};

// ============================================
// 🎯 PREVIEW
// ============================================

window.previewVideo = function() {
    const url = document.getElementById('video-url').value;
    if (!url) {
        showToast('Enter a video URL first', 'warning');
        return;
    }
    
    const videoId = extractDailymotionId(url);
    if (!videoId) {
        showToast('Invalid URL', 'error');
        return;
    }
    
    // Open in new tab
    window.open(`https://www.dailymotion.com/embed/video/${videoId}`, '_blank');
};

// ============================================
// 📅 DATE
// ============================================

function updateDate() {
    const el = document.getElementById('current-date');
    if (el) {
        el.textContent = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
}

// ============================================
// 🎨 CSS ANIMATION
// ============================================

const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-10px); }
        75% { transform: translateX(10px); }
    }
`;
document.head.appendChild(style);
