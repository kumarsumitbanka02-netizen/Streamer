// ============================================
// STREAMER OTT - MASTER CONFIGURATION FILE
// ============================================
// ⚠️ SIRF IS FILE KO CHANGE KARO AGAR UPGRADE KARNA HO
// ============================================

const CONFIG = {
    // 🎬 APP INFO
    APP_NAME: "STREAMER",
    APP_VERSION: "1.0.0",
    
    // 🔥 FIREBASE CONFIG (Tu ne diya)
    FIREBASE: {
        apiKey: "AIzaSyC203H8isoltOx66YZ_wddqpWB4nBIMQZU",
        authDomain: "streamer-a5ea9.firebaseapp.com",
        projectId: "streamer-a5ea9",
        storageBucket: "streamer-a5ea9.firebasestorage.app",
        messagingSenderId: "821781298641",
        appId: "1:821781298641:web:1fcec50709460dcdd8f4f0",
        measurementId: "G-21LF69JH1Q"
    },
    
    // 🔗 SHORTENER CONFIG (Tu ne diya - Bitly API Key)
    SHORTENER: {
        enabled: false,  // Admin panel se ON/OFF hoga
        apiKey: "4781dda60de45370543f3f7ed251c841fff46c56fb",
        baseUrl: "https://api-ssl.bitly.com/v4",
        domain: "bit.ly"
    },
    
    // 🛡️ SECURITY
    SECURITY: {
        adminPanelHidden: true,
        disableRightClick: true,
        disableDevTools: false,  // Production mein true karna
        maxLoginAttempts: 3
    },
    
    // 🎨 UI CONFIG
    UI: {
        theme: "dark",
        primaryColor: "#e50914",  // Netflix red
        secondaryColor: "#141414",
        accentColor: "#ffffff",
        mobileFirst: true
    },
    
    // 📺 VIDEO CONFIG
    VIDEO: {
        defaultQuality: "auto",
        autoplay: false,
        showSubtitles: true,
        embedProvider: "dailymotion"
    },
    
    // 🗄️ LOCAL STORAGE KEYS
    STORAGE_KEYS: {
        watchlist: "streamer_watchlist",
        history: "streamer_history",
        favorites: "streamer_favorites",
        continueWatching: "streamer_continue",
        adminSession: "streamer_admin"
    }
};

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
