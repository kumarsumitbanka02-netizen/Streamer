// ============================================
// STREAMER OTT - UI COMPONENTS
// ============================================
// Handles: Toasts, Modals, Loading, Content Cards, Animations
// ============================================

import CONFIG from '../config.js';

// ============================================
// 🍞 TOAST NOTIFICATIONS
// ============================================

let toastContainer = null;

function ensureToastContainer() {
    if (!toastContainer) {
        toastContainer = document.getElementById('toast-container');
    }
    return toastContainer;
}

/**
 * Show toast notification
 * @param {String} message - Toast message
 * @param {String} type - success | error | warning | info
 * @param {Number} duration - Duration in ms
 */
export function showToast(message, type = 'info', duration = 3000) {
    const container = ensureToastContainer();
    if (!container) {
        console.warn('Toast container not found');
        return;
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Icon based on type
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    toast.innerHTML = `
        <div class="flex items-center gap-3">
            <i class="fas ${icons[type] || icons.info}"></i>
            <span>${message}</span>
        </div>
    `;
    
    container.appendChild(toast);
    
    // Animate in
    requestAnimationFrame(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        requestAnimationFrame(() => {
            toast.style.transition = 'all 0.3s ease';
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        });
    });
    
    // Auto remove
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ============================================
// ⏳ LOADING SCREEN
// ============================================

export function showLoading() {
    const loading = document.getElementById('loading-screen');
    if (loading) {
        loading.style.display = 'flex';
        loading.style.opacity = '1';
        
        // Animate loading bar
        const bar = document.getElementById('loading-bar');
        if (bar) {
            bar.style.width = '0%';
            setTimeout(() => bar.style.width = '70%', 200);
            setTimeout(() => bar.style.width = '100%', 800);
        }
    }
}

export function hideLoading() {
    const loading = document.getElementById('loading-screen');
    if (loading) {
        loading.style.opacity = '0';
        setTimeout(() => {
            loading.style.display = 'none';
        }, 500);
    }
}

// ============================================
// 🎴 CONTENT CARD CREATOR
// ============================================

/**
 * Create a content card HTML
 * @param {Object} video - Video data
 * @param {Boolean} showProgress - Show watch progress bar
 * @returns {String} HTML string
 */
export function createContentCard(video, showProgress = false) {
    if (!video) return '';
    
    const progress = showProgress ? (video.progress || 0) : 0;
    const progressPercent = Math.round(progress * 100);
    
    const posterUrl = video.posterUrl || `https://via.placeholder.com/300x170?text=${encodeURIComponent(video.title || 'No Title')}`;
    
    const isNew = video.uploadedAt ? isRecent(video.uploadedAt) : false;
    const newBadge = isNew ? '<span class="badge badge-new absolute top-2 left-2 z-10">NEW</span>' : '';
    
    const comingSoon = !video.videoUrl ? '<div class="coming-soon-badge">Coming Soon</div>' : '';
    
    const progressBar = showProgress && progress > 0 ? `
        <div class="absolute bottom-0 left-0 right-0 h-1 bg-gray-800">
            <div class="h-full bg-[#e50914]" style="width: ${progressPercent}%"></div>
        </div>
    ` : '';
    
    return `
        <div class="content-card group" data-id="${video.id}" onclick="watchVideo('${video.id}')">
            <div class="relative aspect-video overflow-hidden rounded-lg">
                <img src="${posterUrl}" 
                     alt="${video.title}" 
                     class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                     loading="lazy"
                     onerror="this.src='https://via.placeholder.com/300x170?text=No+Image'">
                
                ${newBadge}
                ${comingSoon}
                
                <!-- Hover overlay -->
                <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <div class="w-12 h-12 rounded-full bg-[#e50914] flex items-center justify-center transform scale-0 group-hover:scale-100 transition-transform duration-300">
                        <i class="fas fa-play text-white text-lg"></i>
                    </div>
                </div>
                
                ${progressBar}
            </div>
            
            <div class="mt-2">
                <div class="card-title group-hover:text-[#e50914] transition-colors">${video.title || 'Untitled'}</div>
                <div class="card-meta">
                    <span>${video.year || '2024'}</span>
                    <span class="mx-1">•</span>
                    <span>${video.rating || 'U/A'}</span>
                    <span class="mx-1">•</span>
                    <span>${video.category || 'Movie'}</span>
                </div>
                ${showProgress ? `<div class="text-xs text-gray-500 mt-1">${progressPercent}% watched</div>` : ''}
            </div>
        </div>
    `;
}

/**
 * Create a skeleton loading card
 * @returns {String} HTML string
 */
export function createSkeletonCard() {
    return `
        <div class="content-card">
            <div class="skeleton aspect-video rounded-lg"></div>
            <div class="mt-2 space-y-2">
                <div class="skeleton h-4 w-3/4 rounded"></div>
                <div class="skeleton h-3 w-1/2 rounded"></div>
            </div>
        </div>
    `;
}

/**
 * Create empty state
 * @param {String} icon - Font Awesome icon class
 * @param {String} title - Title text
 * @param {String} message - Message text
 * @returns {String} HTML string
 */
export function createEmptyState(icon, title, message) {
    return `
        <div class="empty-state">
            <i class="fas ${icon}"></i>
            <h3>${title}</h3>
            <p>${message}</p>
        </div>
    `;
}

// ============================================
// 🎚️ SCROLL ROWS
// ============================================

/**
 * Scroll a horizontal row
 * @param {String} rowId - Row element ID
 * @param {Number} direction - 1 for right, -1 for left
 */
export function scrollRow(rowId, direction) {
    const row = document.getElementById(rowId);
    if (!row) return;
    
    const scrollAmount = row.clientWidth * 0.8;
    const currentScroll = row.scrollLeft;
    const maxScroll = row.scrollWidth - row.clientWidth;
    
    let newScroll = currentScroll + (direction * scrollAmount);
    
    // Bounds check
    newScroll = Math.max(0, Math.min(newScroll, maxScroll));
    
    row.scrollTo({
        left: newScroll,
        behavior: 'smooth'
    });
}

// ============================================
// 📦 MODAL
// ============================================

let activeModal = null;

/**
 * Show modal
 * @param {String} title - Modal title
 * @param {String} content - HTML content
 * @param {Object} options - { onConfirm, onCancel, showClose }
 */
export function showModal(title, content, options = {}) {
    // Remove existing modal
    if (activeModal) activeModal.remove();
    
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h3 class="modal-title">${title}</h3>
                <button class="modal-close" onclick="closeModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                ${content}
            </div>
        </div>
    `;
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });
    
    // Close on escape
    const escapeHandler = (e) => {
        if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', escapeHandler);
    
    // Store reference
    activeModal = overlay;
    activeModal._escapeHandler = escapeHandler;
    
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
}

export function closeModal() {
    if (!activeModal) return;
    
    activeModal.classList.remove('active');
    document.removeEventListener('keydown', activeModal._escapeHandler);
    document.body.style.overflow = '';
    
    setTimeout(() => {
        activeModal.remove();
        activeModal = null;
    }, 300);
}

window.closeModal = closeModal;

// ============================================
// 🎨 ANIMATIONS
// ============================================

/**
 * Animate element entrance
 * @param {Element} element - DOM element
 * @param {String} animation - Animation name
 * @param {Number} delay - Delay in ms
 */
export function animateElement(element, animation = 'fadeIn', delay = 0) {
    if (!element) return;
    
    element.style.opacity = '0';
    element.classList.add(`animate-${animation}`);
    
    if (delay) {
        element.style.animationDelay = `${delay}ms`;
    }
    
    requestAnimationFrame(() => {
        element.style.opacity = '1';
    });
}

/**
 * Stagger animate children
 * @param {String} containerId - Container element ID
 * @param {String} childSelector - Child selector
 * @param {String} animation - Animation name
 * @param {Number} staggerDelay - Delay between each child
 */
export function staggerAnimate(containerId, childSelector = '.content-card', animation = 'fadeIn', staggerDelay = 100) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const children = container.querySelectorAll(childSelector);
    children.forEach((child, index) => {
        animateElement(child, animation, index * staggerDelay);
    });
}

// ============================================
// 🔄 LAZY LOADING
// ============================================

/**
 * Setup lazy loading for images
 * @param {String} containerId - Container to observe
 */
export function setupLazyLoading(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const images = container.querySelectorAll('img[data-src]');
    
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                observer.unobserve(img);
            }
        });
    }, {
        rootMargin: '50px'
    });
    
    images.forEach(img => imageObserver.observe(img));
}

// ============================================
// 📊 PROGRESS BAR
// ============================================

/**
 * Create progress bar HTML
 * @param {Number} percent - 0 to 100
 * @param {String} color - Bar color
 * @returns {String} HTML string
 */
export function createProgressBar(percent, color = '#e50914') {
    return `
        <div class="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
            <div class="h-full transition-all duration-500" 
                 style="width: ${Math.min(percent, 100)}%; background: ${color}">
            </div>
        </div>
    `;
}

// ============================================
// 🎯 TOOLTIP
// ============================================

/**
 * Create tooltip element
 * @param {Element} target - Target element
 * @param {String} text - Tooltip text
 */
export function createTooltip(target, text) {
    const tooltip = document.createElement('div');
    tooltip.className = 'fixed z-[4000] px-3 py-2 bg-gray-900 text-white text-xs rounded shadow-lg pointer-events-none opacity-0 transition-opacity';
    tooltip.textContent = text;
    
    document.body.appendChild(tooltip);
    
    const rect = target.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
    tooltip.style.top = `${rect.top - tooltip.offsetHeight - 8}px`;
    
    requestAnimationFrame(() => {
        tooltip.style.opacity = '1';
    });
    
    return tooltip;
}

// ============================================
// 🌙 THEME TOGGLE (Future)
// ============================================

export function toggleTheme() {
    const current = localStorage.getItem('streamer_theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('streamer_theme', next);
    
    return next;
}

export function initTheme() {
    const saved = localStorage.getItem('streamer_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
}

// ============================================
// 📱 MOILE DETECTION
// ============================================

export function isMobile() {
    return window.innerWidth < 768 || 
           /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export function isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

// ============================================
// 🛠️ UTILITY FUNCTIONS
// ============================================

function isRecent(date) {
    if (!date) return false;
    
    const uploadDate = date.toDate ? date.toDate() : new Date(date);
    const now = new Date();
    const diffDays = (now - uploadDate) / (1000 * 60 * 60 * 24);
    
    return diffDays <= 7; // Within 7 days
}

/**
 * Debounce function
 * @param {Function} func - Function to debounce
 * @param {Number} wait - Wait time in ms
 */
export function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function
 * @param {Function} func - Function to throttle
 * @param {Number} limit - Limit in ms
 */
export function throttle(func, limit = 300) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ============================================
// 🚀 EXPORTS
// ============================================

export default {
    // Toast
    showToast,
    
    // Loading
    showLoading,
    hideLoading,
    
    // Cards
    createContentCard,
    createSkeletonCard,
    createEmptyState,
    
    // Scroll
    scrollRow,
    
    // Modal
    showModal,
    closeModal,
    
    // Animation
    animateElement,
    staggerAnimate,
    
    // Lazy loading
    setupLazyLoading,
    
    // Progress
    createProgressBar,
    
    // Tooltip
    createTooltip,
    
    // Theme
    toggleTheme,
    initTheme,
    
    // Device
    isMobile,
    isTouchDevice,
    
    // Utils
    debounce,
    throttle
};
