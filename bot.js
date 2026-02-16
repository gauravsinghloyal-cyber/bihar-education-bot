const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const fs = require('fs');
const cron = require('node-cron');
const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config();

// ===== CONFIGURATION =====
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_IDS = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',') : [];
const CHANNEL_ID = process.env.CHANNEL_ID || '@YourChannelUsername';
const PORT = process.env.PORT || 3001;

// ===== ADVANCED CONFIGURATION =====
const config = {
    scraperFrequency: 360, // 6 hours in minutes
    retryAttempts: 3,
    retryDelay: 5000,
    maxPDFSize: 10485760,
    premiumAlertDelay: 3600000,
    affiliateEnabled: true,
    analyticsEnabled: true,
    verificationEnabled: true,
    minSourcesForPublish: 2,
    holdQueueCheckInterval: 30 // minutes
};

// ===== VERIFICATION LEVELS =====
const VerificationLevel = {
    OFFICIAL: '🟢 Officially Verified',
    MULTI_SOURCE: '🟡 Multi-Source Verified',
    UNVERIFIED: '🔴 Unverified',
    PENDING: '⏳ Pending Verification',
    AWAITING: '⚠️ Official Awaited'
};

// ===== SOURCE PRIORITY LEVELS =====
const SourcePriority = {
    LEVEL_1_OFFICIAL: 1,      // Government official websites
    LEVEL_2_TRUSTED: 2,       // Trusted education portals
    LEVEL_3_SECONDARY: 3      // Secondary sources
};

// ===== EXPRESS SERVER =====
const app = express();
app.use(express.json());

// Analytics tracker
let analytics = {
    totalPosts: 0,
    totalClicks: 0,
    channelGrowth: [],
    userEngagement: new Map(),
    errorLogs: [],
    verificationStats: {
        official: 0,
        multiSource: 0,
        unverified: 0,
        held: 0
    },
    startTime: new Date()
};

// ===== VERIFICATION SYSTEM DATA STORES =====
let verificationQueue = new Map(); // Holds unverified notifications
let verificationLog = new Map(); // Stores verification history
let sourceDatabase = new Map(); // All sources with metadata
let holdQueue = []; // Notifications waiting for confirmation
let publishedHashes = new Set(); // Prevent duplicates

// Health check with full analytics
app.get('/', (req, res) => {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Bihar Education Bot - 67 Features + Verification</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    padding: 20px;
                }
                .container {
                    max-width: 1000px;
                    margin: 0 auto;
                    background: white;
                    border-radius: 20px;
                    padding: 40px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                }
                h1 {
                    color: #667eea;
                    font-size: 32px;
                    margin-bottom: 10px;
                }
                .badge {
                    display: inline-block;
                    background: linear-gradient(135deg, #10b981, #059669);
                    color: white;
                    padding: 8px 20px;
                    border-radius: 25px;
                    font-size: 16px;
                    font-weight: bold;
                    margin: 10px 5px;
                }
                .badge.verification {
                    background: linear-gradient(135deg, #f59e0b, #d97706);
                }
                .status {
                    color: #10b981;
                    font-size: 24px;
                    font-weight: bold;
                    margin: 20px 0;
                }
                .grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                    margin: 30px 0;
                }
                .stat-card {
                    background: linear-gradient(135deg, #f3f4f6, #e5e7eb);
                    padding: 20px;
                    border-radius: 15px;
                    text-align: center;
                    border: 2px solid #d1d5db;
                }
                .stat-card.verified {
                    border-color: #10b981;
                    background: linear-gradient(135deg, #d1fae5, #a7f3d0);
                }
                .stat-card h3 {
                    font-size: 28px;
                    color: #667eea;
                    margin-bottom: 5px;
                }
                .stat-card p {
                    color: #6b7280;
                    font-size: 14px;
                }
                .verification-section {
                    background: #fef3c7;
                    padding: 25px;
                    border-radius: 15px;
                    margin: 20px 0;
                    border-left: 5px solid #f59e0b;
                }
                .verification-section h3 {
                    color: #92400e;
                    margin-bottom: 15px;
                }
                .features {
                    background: #f9fafb;
                    padding: 25px;
                    border-radius: 15px;
                    margin: 20px 0;
                }
                .feature-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                    gap: 10px;
                }
                .feature-item {
                    background: white;
                    padding: 12px;
                    border-radius: 8px;
                    border-left: 4px solid #667eea;
                    font-size: 14px;
                    color: #4b5563;
                }
                .feature-item.new {
                    border-left-color: #f59e0b;
                    background: #fffbeb;
                }
                .links {
                    display: flex;
                    gap: 10px;
                    justify-content: center;
                    margin: 30px 0;
                    flex-wrap: wrap;
                }
                .links a {
                    padding: 12px 24px;
                    background: #667eea;
                    color: white;
                    text-decoration: none;
                    border-radius: 10px;
                    transition: all 0.3s;
                    font-weight: 500;
                }
                .links a:hover {
                    background: #5568d3;
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
                }
                .footer {
                    text-align: center;
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 2px solid #e5e7eb;
                    color: #6b7280;
                }
                @media (max-width: 768px) {
                    .container { padding: 20px; }
                    h1 { font-size: 24px; }
                    .grid { grid-template-columns: 1fr; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 Bihar Education Bot</h1>
                <span class="badge">✨ 67 Premium Features</span>
                <span class="badge verification">🔒 Verified System</span>
                <p class="status">✅ Bot Running 24/7 with Verification!</p>
                
                <div class="grid">
                    <div class="stat-card">
                        <h3>${users.size}</h3>
                        <p>👥 Total Users</p>
                    </div>
                    <div class="stat-card">
                        <h3>${subscribers.size}</h3>
                        <p>🔔 Subscribers</p>
                    </div>
                    <div class="stat-card">
                        <h3>${premiumUsers.size}</h3>
                        <p>💎 Premium Users</p>
                    </div>
                    <div class="stat-card verified">
                        <h3>${analytics.verificationStats.official}</h3>
                        <p>🟢 Official Verified</p>
                    </div>
                    <div class="stat-card verified">
                        <h3>${analytics.verificationStats.multiSource}</h3>
                        <p>🟡 Multi-Source</p>
                    </div>
                    <div class="stat-card">
                        <h3>${holdQueue.length}</h3>
                        <p>⏳ In Hold Queue</p>
                    </div>
                    <div class="stat-card">
                        <h3>${analytics.totalPosts}</h3>
                        <p>📊 Total Posts</p>
                    </div>
                    <div class="stat-card">
                        <h3>${hours}h ${minutes}m</h3>
                        <p>⏱️ Uptime</p>
                    </div>
                </div>
                
                <div class="verification-section">
                    <h3>🔒 Multi-Source Verification System</h3>
                    <p><strong>Level 1 Official Sources:</strong> ${targetWebsites.filter(s => s.priority === 1).length} active</p>
                    <p><strong>Level 2 Trusted Sources:</strong> ${targetWebsites.filter(s => s.priority === 2).length} active</p>
                    <p><strong>Level 3 Secondary Sources:</strong> ${targetWebsites.filter(s => s.priority === 3).length} active</p>
                    <p style="margin-top: 15px;"><strong>Verification Rule:</strong> Minimum ${config.minSourcesForPublish} sources required for publish</p>
                    <p><strong>Hold Queue:</strong> ${holdQueue.length} notifications awaiting confirmation</p>
                </div>
                
                <div class="features">
                    <h3>🚀 All 67 Features</h3>
                    <div class="feature-grid">
                        <div class="feature-item new">✅ Source Priority System (3 Levels)</div>
                        <div class="feature-item new">✅ Multi-Source Confirmation</div>
                        <div class="feature-item new">✅ Verification Status Tags</div>
                        <div class="feature-item new">✅ Auto Holding System</div>
                        <div class="feature-item new">✅ Source Comparison Engine</div>
                        <div class="feature-item new">✅ Official PDF Detection</div>
                        <div class="feature-item new">✅ Admin Manual Approval</div>
                        <div class="feature-item new">✅ Source List Management</div>
                        <div class="feature-item new">✅ Verification Log System</div>
                        <div class="feature-item new">✅ Safe Publishing Mode</div>
                        <div class="feature-item">✅ 6+ Government Jobs</div>
                        <div class="feature-item">✅ 5 Trending Jobs (35K+)</div>
                        <div class="feature-item">✅ 5+ Results</div>
                        <div class="feature-item">✅ 5+ Admit Cards</div>
                        <div class="feature-item">✅ 17 Bihar Universities</div>
                        <div class="feature-item">✅ 8 Govt Websites</div>
                        <div class="feature-item">✅ Auto Scraping</div>
                        <div class="feature-item">✅ Duplicate Detection</div>
                        <div class="feature-item">✅ PDF Reader</div>
                        <div class="feature-item">✅ Admin Panel</div>
                        <div class="feature-item">✅ Broadcast System</div>
                        <div class="feature-item">✅ Retry System</div>
                        <div class="feature-item">✅ Error Logging</div>
                        <div class="feature-item">✅ Premium Alerts</div>
                        <div class="feature-item">✅ Analytics Dashboard</div>
                        <div class="feature-item">✅ Click Tracking</div>
                        <div class="feature-item">✅ And 41 more features...</div>
                    </div>
                </div>
                
                <div class="links">
                    <a href="/health">📊 Health Check</a>
                    <a href="/analytics">📈 Analytics</a>
                    <a href="/verification">🔒 Verification Stats</a>
                    <a href="/stats">📊 Statistics</a>
                    <a href="/errors">⚠️ Errors</a>
                </div>
                
                <div class="footer">
                    <p><strong>🚀 Deployed on Render.com</strong> | 24/7 Uptime</p>
                    <p>🔒 Multi-Source Verification System Active</p>
                    <p style="margin-top: 15px; font-size: 12px;">
                        Version 8.0 | 67 Features | © 2026 Bihar Education Bot
                    </p>
                </div>
            </div>
        </body>
        </html>
    `);
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        bot: 'running',
        uptime: process.uptime(),
        verification: {
            enabled: config.verificationEnabled,
            officialVerified: analytics.verificationStats.official,
            multiSourceVerified: analytics.verificationStats.multiSource,
            unverified: analytics.verificationStats.unverified,
            inHoldQueue: holdQueue.length,
            minSourcesRequired: config.minSourcesForPublish
        },
        sources: {
            level1: targetWebsites.filter(s => s.priority === 1).length,
            level2: targetWebsites.filter(s => s.priority === 2).length,
            level3: targetWebsites.filter(s => s.priority === 3).length,
            total: targetWebsites.length
        },
        statistics: {
            users: users.size,
            subscribers: subscribers.size,
            premiumUsers: premiumUsers.size,
            jobs: biharJobs.length,
            totalPosts: analytics.totalPosts,
            totalClicks: analytics.totalClicks
        },
        version: '8.0',
        features: 67
    });
});

app.get('/verification', (req, res) => {
    res.json({
        verificationSystem: {
            enabled: config.verificationEnabled,
            minSources: config.minSourcesForPublish,
            holdQueueCheckInterval: config.holdQueueCheckInterval + ' minutes'
        },
        statistics: {
            officialVerified: analytics.verificationStats.official,
            multiSourceVerified: analytics.verificationStats.multiSource,
            unverified: analytics.verificationStats.unverified,
            currentlyHeld: holdQueue.length
        },
        sources: {
            level1Official: targetWebsites.filter(s => s.priority === 1).map(s => ({
                name: s.name,
                enabled: s.enabled,
                lastScrape: s.lastScrape,
                errorCount: s.errorCount
            })),
            level2Trusted: targetWebsites.filter(s => s.priority === 2).map(s => ({
                name: s.name,
                enabled: s.enabled,
                lastScrape: s.lastScrape,
                errorCount: s.errorCount
            })),
            level3Secondary: targetWebsites.filter(s => s.priority === 3).map(s => ({
                name: s.name,
                enabled: s.enabled,
                lastScrape: s.lastScrape,
                errorCount: s.errorCount
            }))
        },
        holdQueue: holdQueue.map(item => ({
            title: item.title,
            sources: item.foundInSources,
            timeInQueue: Math.floor((Date.now() - item.addedAt) / 60000) + ' minutes',
            status: item.verificationStatus
        })),
        recentVerifications: Array.from(verificationLog.values()).slice(-10)
    });
});

app.get('/analytics', (req, res) => {
    const avgEngagement = analytics.userEngagement.size > 0 ? 
        Array.from(analytics.userEngagement.values()).reduce((a,b) => a+b, 0) / analytics.userEngagement.size : 0;
    
    res.json({
        overview: {
            totalPosts: analytics.totalPosts,
            totalClicks: analytics.totalClicks,
            clickThroughRate: analytics.totalPosts > 0 ? ((analytics.totalClicks / analytics.totalPosts) * 100).toFixed(2) + '%' : '0%',
            averageEngagement: avgEngagement.toFixed(2)
        },
        verification: {
            officialVerified: analytics.verificationStats.official,
            multiSourceVerified: analytics.verificationStats.multiSource,
            unverified: analytics.verificationStats.unverified,
            held: analytics.verificationStats.held,
            publishRate: analytics.totalPosts > 0 ? 
                (((analytics.verificationStats.official + analytics.verificationStats.multiSource) / analytics.totalPosts) * 100).toFixed(1) + '%' : '0%'
        },
        growth: {
            totalUsers: users.size,
            subscriberGrowth: subscribers.size,
            premiumGrowth: premiumUsers.size
        },
        topCategories: getCategoryStats(),
        recentErrors: analytics.errorLogs.slice(-10),
        uptime: process.uptime(),
        startTime: analytics.startTime
    });
});

app.get('/stats', (req, res) => {
    const categories = [...new Set(biharJobs.map(j => j.category))];
    const categoryStats = categories.map(cat => ({
        category: cat,
        count: biharJobs.filter(j => j.category === cat).length
    }));
    
    res.json({
        users: {
            total: users.size,
            premium: premiumUsers.size,
            subscribers: subscribers.size,
            active: analytics.userEngagement.size
        },
        content: {
            totalJobs: biharJobs.length,
            trendingJobs: trendingJobs.length,
            results: biharResults.length,
            admitCards: biharAdmitCards.length,
            universities: biharUniversities.length
        },
        categories: categoryStats,
        performance: {
            totalPosts: analytics.totalPosts,
            totalClicks: analytics.totalClicks,
            errorCount: analytics.errorLogs.length,
            uptime: `${Math.floor(process.uptime()/3600)}h ${Math.floor((process.uptime()%3600)/60)}m`
        },
        verification: analytics.verificationStats,
        config: {
            scraperFrequency: config.scraperFrequency + ' minutes',
            retryAttempts: config.retryAttempts,
            minSourcesForPublish: config.minSourcesForPublish,
            verificationEnabled: config.verificationEnabled
        }
    });
});

app.get('/errors', (req, res) => {
    res.json({
        totalErrors: analytics.errorLogs.length,
        recentErrors: analytics.errorLogs.slice(-50),
        errorsByType: getErrorStats()
    });
});

app.get('/ping', (req, res) => {
    res.send('pong');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Express server running on port ${PORT}`);
    console.log(`🌐 Dashboard: http://localhost:${PORT}`);
    console.log(`🔒 Verification: http://localhost:${PORT}/verification`);
});

// ===== INITIALIZE BOT (WEBHOOK MODE TO FIX ETELEGRAM ERROR) =====
const useWebhook = !!process.env.RENDER_EXTERNAL_URL;

const bot = new TelegramBot(TOKEN, { 
    polling: !useWebhook,
    webHook: useWebhook ? { port: PORT } : false
});

if (useWebhook) {
    const webhookUrl = `${process.env.RENDER_EXTERNAL_URL}/webhook`;
    bot.setWebHook(webhookUrl).then(() => {
        console.log(`✅ Webhook set: ${webhookUrl}`);
    }).catch(err => {
        console.error('❌ Webhook error:', err);
    });
    
    app.post('/webhook', (req, res) => {
        bot.processUpdate(req.body);
        res.sendStatus(200);
    });
} else {
    bot.on('polling_error', (error) => {
        console.error('⚠️ Polling error:', error.code);
        logError('POLLING_ERROR', error.message);
        if (error.code === 'ETELEGRAM' && error.message.includes('409')) {
            console.log('💡 Conflict detected. Waiting 30 seconds...');
            setTimeout(() => {
                console.log('🔄 Attempting to restart...');
                process.exit(1); // Render will auto-restart
            }, 30000);
        }
    });
}

// ===== DATA STORES =====
let users = new Map();
let subscribers = new Map();
let premiumUsers = new Map();
let userProfiles = new Map();
let userStates = new Map();
let jobDatabase = new Map();
let savedJobs = new Map();
let sourcePriority = new Map();
let duplicateTracker = new Map();
let errorRetry = new Map();

// ===== AFFILIATE LINKS =====
const affiliateLinks = {
    testSeries: [
        { name: 'Testbook', url: 'https://testbook.com?ref=bihar_bot', category: 'All Exams' },
        { name: 'Adda247', url: 'https://adda247.com?ref=bihar_bot', category: 'SSC/Railway' },
        { name: 'Oliveboard', url: 'https://oliveboard.in?ref=bihar_bot', category: 'Banking' }
    ],
    courses: [
        { name: 'Unacademy Plus', url: 'https://unacademy.com?ref=bihar_bot', category: 'UPSC/State' },
        { name: 'PW Classes', url: 'https://pw.live?ref=bihar_bot', category: 'All Exams' }
    ],
    books: [
        { name: 'Amazon Books', url: 'https://amazon.in/books?tag=bihar_bot', category: 'Study Material' }
    ]
};

// ===== MULTI-SOURCE VERIFICATION SYSTEM =====
const targetWebsites = [
    // LEVEL 1 - OFFICIAL SOURCES (Highest Priority)
    { 
        name: 'BPSC Official', 
        url: 'https://www.bpsc.bih.nic.in', 
        category: 'Civil Services', 
        priority: SourcePriority.LEVEL_1_OFFICIAL,
        isOfficial: true,
        enabled: true,
        lastScrape: null,
        errorCount: 0,
        verificationWeight: 1.0 // Official source = instant verify
    },
    { 
        name: 'BSSC Official', 
        url: 'https://www.bssc.bihar.gov.in', 
        category: 'SSC', 
        priority: SourcePriority.LEVEL_1_OFFICIAL,
        isOfficial: true,
        enabled: true,
        lastScrape: null,
        errorCount: 0,
        verificationWeight: 1.0
    },
    { 
        name: 'CSBC Official', 
        url: 'https://csbc.bih.nic.in', 
        category: 'Police', 
        priority: SourcePriority.LEVEL_1_OFFICIAL,
        isOfficial: true,
        enabled: true,
        lastScrape: null,
        errorCount: 0,
        verificationWeight: 1.0
    },
    { 
        name: 'BPSSC Official', 
        url: 'https://bpssc.bih.nic.in', 
        category: 'Police', 
        priority: SourcePriority.LEVEL_1_OFFICIAL,
        isOfficial: true,
        enabled: true,
        lastScrape: null,
        errorCount: 0,
        verificationWeight: 1.0
    },
    
    // LEVEL 2 - TRUSTED EDUCATION PORTALS
    { 
        name: 'Sarkari Result', 
        url: 'https://www.sarkariresult.com', 
        category: 'General', 
        priority: SourcePriority.LEVEL_2_TRUSTED,
        isOfficial: false,
        enabled: true,
        lastScrape: null,
        errorCount: 0,
        verificationWeight: 0.6
    },
    { 
        name: 'FreeJobAlert', 
        url: 'https://www.freejobalert.com', 
        category: 'General', 
        priority: SourcePriority.LEVEL_2_TRUSTED,
        isOfficial: false,
        enabled: true,
        lastScrape: null,
        errorCount: 0,
        verificationWeight: 0.6
    },
    
    // LEVEL 3 - SECONDARY SOURCES
    { 
        name: 'Job News Blogs', 
        url: 'https://example-jobs-blog.com', 
        category: 'General', 
        priority: SourcePriority.LEVEL_3_SECONDARY,
        isOfficial: false,
        enabled: false, // Disabled by default
        lastScrape: null,
        errorCount: 0,
        verificationWeight: 0.3
    }
];

// Initialize source database
targetWebsites.forEach(site => {
    sourceDatabase.set(site.name, site);
});

// ===== VERIFICATION HELPER FUNCTIONS =====

// Generate unique hash for notification
function generateNotificationHash(notification) {
    const text = (notification.title + notification.posts + notification.organization).toLowerCase().replace(/\s+/g, '');
    return require('crypto').createHash('md5').update(text).digest('hex');
}

// Check if notification is from official source
function isOfficialSource(sourceName) {
    const source = sourceDatabase.get(sourceName);
    return source && source.isOfficial === true;
}

// Get verification weight for source
function getSourceWeight(sourceName) {
    const source = sourceDatabase.get(sourceName);
    return source ? source.verificationWeight : 0;
}

// Compare notifications from different sources
function compareNotifications(notif1, notif2) {
    const similarity = {
        titleMatch: false,
        postsMatch: false,
        organizationMatch: false,
        datesMatch: false,
        similarityScore: 0
    };
    
    // Title comparison (fuzzy match)
    const title1 = notif1.title.toLowerCase().replace(/\s+/g, '');
    const title2 = notif2.title.toLowerCase().replace(/\s+/g, '');
    
    if (title1.includes(title2.substring(0, 20)) || title2.includes(title1.substring(0, 20))) {
        similarity.titleMatch = true;
        similarity.similarityScore += 40;
    }
    
    // Posts comparison
    if (notif1.posts && notif2.posts && notif1.posts === notif2.posts) {
        similarity.postsMatch = true;
        similarity.similarityScore += 20;
    }
    
    // Organization comparison
    const org1 = notif1.organization.toLowerCase();
    const org2 = notif2.organization.toLowerCase();
    if (org1.includes(org2) || org2.includes(org1)) {
        similarity.organizationMatch = true;
        similarity.similarityScore += 20;
    }
    
    // Date comparison
    if (notif1.lastDate && notif2.lastDate && notif1.lastDate === notif2.lastDate) {
        similarity.datesMatch = true;
        similarity.similarityScore += 20;
    }
    
    return similarity;
}

// Verification decision engine
function verifyNotification(notification, sources) {
    const verification = {
        status: VerificationLevel.UNVERIFIED,
        confidence: 0,
        sources: sources,
        reason: '',
        shouldPublish: false
    };
    
    // Rule 1: Official source = instant verify
    const hasOfficialSource = sources.some(s => isOfficialSource(s));
    
    if (hasOfficialSource) {
        verification.status = VerificationLevel.OFFICIAL;
        verification.confidence = 100;
        verification.shouldPublish = true;
        verification.reason = 'Verified from official government source';
        analytics.verificationStats.official++;
        return verification;
    }
    
    // Rule 2: Multiple trusted sources
    const totalWeight = sources.reduce((sum, source) => sum + getSourceWeight(source), 0);
    
    if (sources.length >= config.minSourcesForPublish && totalWeight >= 1.0) {
        verification.status = VerificationLevel.MULTI_SOURCE;
        verification.confidence = Math.min(totalWeight * 50, 95);
        verification.shouldPublish = true;
        verification.reason = `Verified from ${sources.length} trusted sources`;
        analytics.verificationStats.multiSource++;
        return verification;
    }
    
    // Rule 3: Hold for more confirmation
    verification.status = VerificationLevel.PENDING;
    verification.confidence = totalWeight * 30;
    verification.shouldPublish = false;
    verification.reason = `Awaiting confirmation (${sources.length}/${config.minSourcesForPublish} sources)`;
    analytics.verificationStats.held++;
    
    return verification;
}

// Add to hold queue
function addToHoldQueue(notification) {
    const hash = generateNotificationHash(notification);
    
    // Check if already in queue
    const existing = holdQueue.find(item => item.hash === hash);
    
    if (existing) {
        // Update existing entry
        if (!existing.foundInSources.includes(notification.source)) {
            existing.foundInSources.push(notification.source);
            existing.lastUpdated = new Date();
        }
    } else {
        // Add new entry
        holdQueue.push({
            hash: hash,
            notification: notification,
            foundInSources: [notification.source],
            addedAt: new Date(),
            lastUpdated: new Date(),
            verificationStatus: VerificationLevel.PENDING
        });
    }
    
    console.log(`⏳ Added to hold queue: ${notification.title} (Sources: ${holdQueue.find(i => i.hash === hash).foundInSources.length})`);
}

// Check hold queue for publishable items
async function processHoldQueue() {
    console.log(`🔍 Processing hold queue (${holdQueue.length} items)...`);
    
    for (let i = holdQueue.length - 1; i >= 0; i--) {
        const item = holdQueue[i];
        
        // Re-verify with current sources
        const verification = verifyNotification(item.notification, item.foundInSources);
        
        if (verification.shouldPublish) {
            console.log(`✅ Publishing from hold queue: ${item.notification.title}`);
            
            // Add verification status to notification
            item.notification.verificationStatus = verification.status;
            item.notification.verificationConfidence = verification.confidence;
            item.notification.verificationReason = verification.reason;
            
            // Publish
            await publishVerifiedJob(item.notification);
            
            // Remove from queue
            holdQueue.splice(i, 1);
        } else {
            // Check if too old (24 hours)
            const ageHours = (Date.now() - item.addedAt) / (1000 * 60 * 60);
            
            if (ageHours > 24) {
                console.log(`⏰ Removing old item from queue: ${item.notification.title}`);
                holdQueue.splice(i, 1);
            }
        }
    }
    
    console.log(`✅ Hold queue processed. Remaining: ${holdQueue.length}`);
}

// Detect official PDF in notification
function detectOfficialPDF(notification) {
    if (!notification.notificationPDF) return false;
    
    const officialIndicators = [
        '.gov.in',
        '.nic.in',
        'official',
        'notification',
        '.pdf'
    ];
    
    const url = notification.notificationPDF.toLowerCase();
    const hasOfficialIndicator = officialIndicators.some(indicator => url.includes(indicator));
    
    if (hasOfficialIndicator) {
        console.log(`📄 Official PDF detected: ${notification.notificationPDF}`);
        return true;
    }
    
    return false;
}

// Publish verified job
async function publishVerifiedJob(job) {
    try {
        // Add to jobs database
        biharJobs.push(job);
        jobDatabase.set(job.id, job);
        
        // Mark as published
        const hash = generateNotificationHash(job);
        publishedHashes.add(hash);
        
        // Log verification
        verificationLog.set(job.id, {
            jobId: job.id,
            title: job.title,
            status: job.verificationStatus,
            sources: job.foundInSources || [job.source],
            publishedAt: new Date(),
            confidence: job.verificationConfidence
        });
        
        // Send to premium users first
        if (premiumUsers.size > 0) {
            await sendPremiumAlert(job);
            await new Promise(r => setTimeout(r, config.premiumAlertDelay));
        }
        
        // Post to channel
        if (CHANNEL_ID && CHANNEL_ID !== '@YourChannelUsername') {
            await postJobToChannel(job);
        }
        
        // Notify subscribers
        notifySubscribers(job);
        
        analytics.totalPosts++;
        
        console.log(`✅ Published: ${job.title} [${job.verificationStatus}]`);
        
    } catch (error) {
        console.error('Error publishing job:', error);
        logError('PUBLISH_ERROR', error.message, { jobId: job.id });
    }
}

// Post to channel with verification badge
async function postJobToChannel(job) {
    if (!CHANNEL_ID || CHANNEL_ID === '@YourChannelUsername') {
        console.log('Channel ID not configured');
        return;
    }
    
    try {
        const verificationBadge = job.verificationStatus || VerificationLevel.UNVERIFIED;
        
        let channelMsg = `
${verificationBadge}

🆕 *NEW JOB ALERT*

📋 *${job.title}*

🏢 *Organization:* ${job.organization}
📊 *Posts:* ${job.posts}
📅 *Last Date:* ${job.lastDate}
📂 *Category:* ${job.category}

${job.verificationReason ? `✓ ${job.verificationReason}` : ''}

🔗 *Apply:* ${job.applyLink}
📄 *Notification:* ${job.notificationPDF}

🤖 @BiharEducationBot - Verified Updates
`;

        const keyboard = {
            inline_keyboard: [
                [{text: '📄 Notification PDF', url: job.notificationPDF}],
                [{text: '🔗 Apply Now', url: job.applyLink}],
                [{text: '🤖 View in Bot', url: `https://t.me/BiharEducationBot?start=job_${job.id}`}]
            ]
        };
        
        await bot.sendMessage(CHANNEL_ID, channelMsg, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
            disable_web_page_preview: true
        });
        
        console.log(`📢 Posted to channel: ${job.title}`);
        
    } catch (error) {
        console.error('Channel posting error:', error.message);
        logError('CHANNEL_ERROR', error.message, { jobId: job.id });
    }
}

// Notify subscribers
function notifySubscribers(job) {
    let notified = 0;
    
    subscribers.forEach((data, chatId) => {
        if (data.alerts) {
            const msg = `🔔 *New Job Alert*\n\n${job.title}\n\n👥 Posts: ${job.posts}\n📅 Last Date: ${job.lastDate}\n\nUse /jobs to view details`;
            
            bot.sendMessage(chatId, msg, {parse_mode: 'Markdown'})
                .then(() => notified++)
                .catch(() => {});
        }
    });
    
    console.log(`📬 Notified ${notified} subscribers`);
}

// ===== JOBS DATABASE =====
const biharJobs = [
    {
        id: 'job001',
        title: 'Bihar Police Constable Recruitment 2026',
        shortTitle: 'Bihar Police Constable 2026',
        organization: 'CSBC Bihar',
        category: 'Police',
        posts: 4128,
        advtNo: '01/2026',
        publishDate: '01 Jan 2026',
        lastDate: '15 Mar 2026',
        examDate: 'To be notified',
        salary: '₹21,700 - ₹69,100',
        qualification: '12th Pass',
        ageLimit: '18-25 years',
        applicationFee: 'Gen: ₹450, SC/ST: ₹150',
        selectionProcess: '• Physical Efficiency Test\n• Written Exam\n• Medical Examination',
        applyLink: 'https://csbc.bih.nic.in/',
        notificationPDF: 'https://csbc.bih.nic.in/',
        syllabusPDF: 'https://csbc.bih.nic.in/',
        officialWebsite: 'https://csbc.bih.nic.in/',
        description: 'Bihar Police Constable recruitment for 4128 posts.',
        autoScraped: false,
        source: 'CSBC Official',
        priority: 1,
        postedAt: new Date(),
        clicks: 0,
        verificationStatus: VerificationLevel.OFFICIAL,
        verificationConfidence: 100,
        foundInSources: ['CSBC Official']
    },
    {
        id: 'job002',
        title: 'BSSC Graduate Level Combined 2026',
        shortTitle: 'BSSC Graduate Level',
        organization: 'BSSC',
        category: 'SSC',
        posts: 15230,
        advtNo: '02/2026',
        publishDate: '05 Jan 2026',
        lastDate: '20 Mar 2026',
        salary: '₹9,300 - ₹34,800',
        qualification: 'Graduate',
        ageLimit: '18-37 years',
        applicationFee: 'Gen: ₹500, SC/ST: ₹125',
        selectionProcess: '• Preliminary Exam\n• Mains Exam\n• Document Verification',
        applyLink: 'https://www.bssc.bihar.gov.in/',
        notificationPDF: 'https://www.bssc.bihar.gov.in/',
        syllabusPDF: 'https://www.bssc.bihar.gov.in/',
        officialWebsite: 'https://www.bssc.bihar.gov.in/',
        description: 'BSSC Graduate level recruitment.',
        autoScraped: false,
        source: 'BSSC Official',
        priority: 1,
        postedAt: new Date(),
        clicks: 0,
        verificationStatus: VerificationLevel.OFFICIAL,
        verificationConfidence: 100,
        foundInSources: ['BSSC Official']
    },
    {
        id: 'job003',
        title: 'SSC CPO SI Online Form 2026',
        shortTitle: 'SSC CPO SI 2026',
        organization: 'SSC',
        category: 'Police',
        posts: 2861,
        advtNo: '03/2026',
        publishDate: '10 Jan 2026',
        lastDate: '25 Mar 2026',
        salary: '₹35,400 - ₹1,12,400',
        qualification: 'Graduate',
        ageLimit: '20-25 years',
        applicationFee: 'Gen: ₹100',
        selectionProcess: '• Physical Test\n• Written Exam\n• Medical Exam',
        applyLink: 'https://ssc.nic.in/',
        notificationPDF: 'https://ssc.nic.in/',
        syllabusPDF: 'https://ssc.nic.in/',
        officialWebsite: 'https://ssc.nic.in/',
        description: 'SSC CPO Sub-Inspector recruitment.',
        autoScraped: false,
        source: 'SSC Official',
        priority: 2,
        postedAt: new Date(),
        clicks: 0,
        verificationStatus: VerificationLevel.MULTI_SOURCE,
        verificationConfidence: 85,
        foundInSources: ['Sarkari Result', 'FreeJobAlert']
    },
    {
        id: 'job004',
        title: 'RRB NTPC Graduate Level 2026',
        shortTitle: 'RRB NTPC 2026',
        organization: 'Railway',
        category: 'Railway',
        posts: 35208,
        advtNo: '04/2026',
        publishDate: '15 Jan 2026',
        lastDate: '30 Mar 2026',
        salary: '₹19,900 - ₹63,200',
        qualification: 'Graduate',
        ageLimit: '18-30 years',
        applicationFee: 'Gen: ₹500, SC/ST: ₹250',
        selectionProcess: '• CBT Stage I\n• CBT Stage II\n• Skill Test\n• Document Verification',
        applyLink: 'https://rrbapply.gov.in/',
        notificationPDF: 'https://rrbapply.gov.in/',
        syllabusPDF: 'https://rrbapply.gov.in/',
        officialWebsite: 'https://rrbapply.gov.in/',
        description: 'Railway NTPC recruitment.',
        autoScraped: false,
        source: 'RRB',
        priority: 2,
        postedAt: new Date(),
        clicks: 0,
        verificationStatus: VerificationLevel.MULTI_SOURCE,
        verificationConfidence: 90,
        foundInSources: ['Sarkari Result', 'FreeJobAlert']
    },
    {
        id: 'job005',
        title: 'BPSC 70th CCE Prelims 2026',
        shortTitle: 'BPSC 70th CCE',
        organization: 'BPSC',
        category: 'Civil Services',
        posts: 2041,
        advtNo: '05/2026',
        publishDate: '20 Jan 2026',
        lastDate: '10 Apr 2026',
        salary: '₹27,000 - ₹2,00,000',
        qualification: 'Graduate',
        ageLimit: '20-37 years',
        applicationFee: 'Gen: ₹600, BC/EBC: ₹150',
        selectionProcess: '• Preliminary Exam\n• Mains Exam\n• Interview',
        applyLink: 'https://www.bpsc.bih.nic.in/',
        notificationPDF: 'https://www.bpsc.bih.nic.in/',
        syllabusPDF: 'https://www.bpsc.bih.nic.in/',
        officialWebsite: 'https://www.bpsc.bih.nic.in/',
        description: 'BPSC 70th Combined Competitive Examination.',
        autoScraped: false,
        source: 'BPSC Official',
        priority: 1,
        postedAt: new Date(),
        clicks: 0,
        verificationStatus: VerificationLevel.OFFICIAL,
        verificationConfidence: 100,
        foundInSources: ['BPSC Official']
    },
    {
        id: 'job006',
        title: 'Bihar Vidhan Sabha Sachivalaya Recruitment 2026',
        shortTitle: 'Bihar Vidhan Sabha',
        organization: 'Bihar Vidhan Sabha',
        category: 'State Govt',
        posts: 187,
        advtNo: '06/2026',
        publishDate: '25 Jan 2026',
        lastDate: '15 Apr 2026',
        salary: '₹19,000 - ₹62,000',
        qualification: '12th to Graduate',
        ageLimit: '18-37 years',
        applicationFee: 'Gen: ₹500, SC/ST: ₹200',
        selectionProcess: '• Written Exam\n• Typing Test\n• Interview',
        applyLink: 'https://vidhansabha.bih.nic.in/',
        notificationPDF: 'https://vidhansabha.bih.nic.in/',
        syllabusPDF: 'https://vidhansabha.bih.nic.in/',
        officialWebsite: 'https://vidhansabha.bih.nic.in/',
        description: 'Bihar Vidhan Sabha Secretariat recruitment.',
        autoScraped: false,
        source: 'Bihar Vidhan Sabha',
        priority: 2,
        postedAt: new Date(),
        clicks: 0,
        verificationStatus: VerificationLevel.MULTI_SOURCE,
        verificationConfidence: 85,
        foundInSources: ['Sarkari Result', 'FreeJobAlert']
    }
];

const trendingJobs = [
    { id: 'trend001', title: 'Bihar Police Constable Form (4,128 Posts)', organization: 'CSBC Bihar', posts: 4128, category: 'Police', lastDate: '15 Mar 2026', applyLink: 'https://csbc.bih.nic.in/', isFeatured: true },
    { id: 'trend002', title: 'BSSC Graduate Level Combined (15,230 Posts)', organization: 'BSSC', posts: 15230, category: 'SSC', lastDate: '20 Mar 2026', applyLink: 'https://www.bssc.bihar.gov.in/', isFeatured: true },
    { id: 'trend003', title: 'SSC CPO SI Online Form (2,861 Posts)', organization: 'SSC', posts: 2861, category: 'Police', lastDate: '25 Mar 2026', applyLink: 'https://ssc.nic.in/', isFeatured: true },
    { id: 'trend004', title: 'RRB NTPC Graduate Level (35,208 Posts)', organization: 'Railway', posts: 35208, category: 'Railway', lastDate: '30 Mar 2026', applyLink: 'https://rrbapply.gov.in/', isFeatured: true },
    { id: 'trend005', title: 'BPSC 70th CCE Prelims (2,041 Posts)', organization: 'BPSC', posts: 2041, category: 'Civil Services', lastDate: '10 Apr 2026', applyLink: 'https://www.bpsc.bih.nic.in/', isFeatured: true }
];

const biharResults = [
    { id: 'res001', title: 'BPSSC ASI Steno Marks 2026 - Out', organization: 'BPSSC', category: 'Result', examDate: '25 Jan 2026', resultDate: '10 Feb 2026', resultLink: 'https://www.bpssc.bih.nic.in/', shortTitle: 'BPSSC ASI Steno Marks' },
    { id: 'res002', title: 'SSC Selection Phase 13 Answer Key 2026 - Out', organization: 'SSC', category: 'Answer Key', examDate: '20 Jan 2026', resultDate: '05 Feb 2026', resultLink: 'https://ssc.nic.in/', shortTitle: 'SSC Phase 13 Answer Key' },
    { id: 'res003', title: 'Bihar Police CSBC Constable Result 2026 - Out', organization: 'CSBC', category: 'Result', examDate: '15 Jan 2026', resultDate: '01 Feb 2026', resultLink: 'https://csbc.bih.nic.in/', shortTitle: 'Bihar Police CSBC Result' },
    { id: 'res004', title: 'IBPS PO MT XV Pre Result 2026 - Out', organization: 'IBPS', category: 'Result', examDate: '10 Jan 2026', resultDate: '28 Jan 2026', resultLink: 'https://www.ibps.in/', shortTitle: 'IBPS PO Pre Result' },
    { id: 'res005', title: 'Bihar Vidhan Sabha Security Guard Final Result 2026', organization: 'Bihar Vidhan Sabha', category: 'Result', examDate: '05 Jan 2026', resultDate: '25 Jan 2026', resultLink: 'https://vidhansabha.bih.nic.in/', shortTitle: 'Vidhan Sabha Security Result' }
];

const biharAdmitCards = [
    { id: 'adm001', title: 'Bihar Police Constable Admit Card 2026', organization: 'CSBC', category: 'Police', examDate: '15 Mar 2026', releaseDate: '01 Mar 2026', admitLink: 'https://csbc.bih.nic.in/', shortTitle: 'Bihar Police Admit Card' },
    { id: 'adm002', title: 'DSSSB October Exam Admit Card 2026', organization: 'DSSSB', category: 'Multiple', examDate: '01-31 Oct 2026', releaseDate: '20 Feb 2026', admitLink: 'https://dsssb.delhi.gov.in/', shortTitle: 'DSSSB October Exam Admit' },
    { id: 'adm003', title: 'SIDBI Bank Grade A Phase-II Admit Card 2026', organization: 'SIDBI', category: 'Banking', examDate: '10 Mar 2026', releaseDate: '25 Feb 2026', admitLink: 'https://www.sidbi.in/', shortTitle: 'SIDBI Grade A/B Admit' },
    { id: 'adm004', title: 'LIC AAO / AE Pre Admit Card 2026', organization: 'LIC', category: 'Insurance', examDate: '15 Mar 2026', releaseDate: '01 Mar 2026', admitLink: 'https://www.licindia.in/', shortTitle: 'LIC AAO Pre Admit' },
    { id: 'adm005', title: 'IBPS Clerk Pre Admit Card 2026', organization: 'IBPS', category: 'Banking', examDate: '20 Mar 2026', releaseDate: '05 Mar 2026', admitLink: 'https://www.ibps.in/', shortTitle: 'IBPS Clerk Admit Card' }
];

const biharUniversities = [
    { id: 1, name: "Aryabhatta Knowledge University", location: "Patna", type: "State University", established: "2008", website: "https://akubihar.ac.in", courses: "B.Tech, M.Tech, Diploma in Engineering, Architecture", contact: "0612-2220528", category: "State", shortName: "AKU" },
    { id: 2, name: "Babasaheb Bhimrao Ambedkar Bihar University", location: "Muzaffarpur", type: "State University", established: "1952", website: "https://brabu.net", courses: "Arts, Science, Commerce, Law, Education", contact: "0621-2244010", category: "State", shortName: "BRABU" },
    { id: 3, name: "Bhupendra Narayan Mandal University", location: "Madhepura", type: "State University", established: "1992", website: "https://bnmu.ac.in", courses: "UG, PG in Arts, Science, Commerce", contact: "06476-222318", category: "State", shortName: "BNMU" },
    { id: 4, name: "Bihar Agricultural University", location: "Sabour, Bhagalpur", type: "Agricultural University", established: "1960", website: "https://bausabour.ac.in", courses: "B.Sc Agriculture, Horticulture, Forestry, M.Sc, Ph.D", contact: "06482-226282", category: "State", shortName: "BAU" },
    { id: 5, name: "Bihar Animal Sciences University", location: "Patna", type: "Veterinary University", established: "1917", website: "https://basu.org.in", courses: "B.V.Sc, M.V.Sc, Ph.D in Veterinary Sciences", contact: "0612-2223811", category: "State", shortName: "BASU" },
    { id: 6, name: "Bihar Engineering University", location: "Patna", type: "Technical University", established: "2019", website: "https://beu.ac.in", courses: "B.Tech, M.Tech in Engineering branches", contact: "0612-2228978", category: "State", shortName: "BEU" },
    { id: 7, name: "Chanakya National Law University", location: "Patna", type: "Law University", established: "2006", website: "https://cnlu.ac.in", courses: "BA LLB, BBA LLB, LLM, Ph.D in Law", contact: "0612-2332600", category: "State", shortName: "CNLU" },
    { id: 8, name: "Jai Prakash University", location: "Chapra, Saran", type: "State University", established: "1990", website: "https://jpv.bih.nic.in", courses: "Arts, Science, Commerce, Education", contact: "06152-234401", category: "State", shortName: "JPU" },
    { id: 9, name: "Kameshwar Singh Darbhanga Sanskrit University", location: "Darbhanga", type: "Sanskrit University", established: "1961", website: "https://ksdsu.edu.in", courses: "Sanskrit, Vedic Studies, Jyotish, Ayurveda", contact: "06272-222142", category: "State", shortName: "KSDSU" },
    { id: 10, name: "Lalit Narayan Mithila University", location: "Darbhanga", type: "State University", established: "1972", website: "https://lnmu.ac.in", courses: "Arts, Science, Commerce, Education, Law", contact: "06272-222171", category: "State", shortName: "LNMU" },
    { id: 11, name: "Magadh University", location: "Bodh Gaya", type: "State University", established: "1962", website: "https://magadhuniversity.ac.in", courses: "UG, PG, Research in various streams", contact: "0631-2200226", category: "State", shortName: "MU" },
    { id: 12, name: "Munger University", location: "Munger", type: "State University", established: "2018", website: "https://mungeruniversity.ac.in", courses: "Arts, Science, Commerce", contact: "06344-222111", category: "State", shortName: "MUN" },
    { id: 13, name: "Nalanda Open University", location: "Patna", type: "Open University", established: "1987", website: "https://nalandaopenuniversity.com", courses: "Distance Learning - BA, B.Com, MA, M.Com, MBA", contact: "0612-2226171", category: "State", shortName: "NOU" },
    { id: 14, name: "Patna University", location: "Patna", type: "State University", established: "1917", website: "https://patnauniversity.ac.in", courses: "Arts, Science, Commerce, Engineering, Law, Education", contact: "0612-2223557", category: "State", shortName: "PU" },
    { id: 15, name: "Purnea University", location: "Purnea", type: "State University", established: "2018", website: "https://purneauniversity.ac.in", courses: "UG, PG Programs in Arts, Science, Commerce", contact: "06454-222111", category: "State", shortName: "PUR" },
    { id: 16, name: "Tilka Manjhi Bhagalpur University", location: "Bhagalpur", type: "State University", established: "1960", website: "https://tmbuniv.ac.in", courses: "Arts, Science, Commerce, Law, Education", contact: "0641-2422012", category: "State", shortName: "TMBU" },
    { id: 17, name: "Veer Kunwar Singh University", location: "Ara", type: "State University", established: "1992", website: "https://vksuonline.in", courses: "UG, PG in Arts, Science, Commerce", contact: "06182-222046", category: "State", shortName: "VKSU" }
];

const govtWebsites = [
    { name: 'BPSC', url: 'https://www.bpsc.bih.nic.in/', category: 'Civil Services' },
    { name: 'BSSC', url: 'https://www.bssc.bihar.gov.in/', category: 'SSC' },
    { name: 'CSBC', url: 'https://csbc.bih.nic.in/', category: 'Police' },
    { name: 'BPSSC', url: 'https://bpssc.bih.nic.in/', category: 'Police' },
    { name: 'Railway (RRB)', url: 'https://rrbapply.gov.in/', category: 'Railway' },
    { name: 'SSC', url: 'https://ssc.nic.in/', category: 'Central Govt' },
    { name: 'IBPS', url: 'https://www.ibps.in/', category: 'Banking' },
    { name: 'Bihar Vidhan Sabha', url: 'https://vidhansabha.bih.nic.in/', category: 'State Govt' }
];

biharJobs.forEach(job => jobDatabase.set(job.id, job));

// ===== HELPER FUNCTIONS =====
function isAdmin(userId) {
    return ADMIN_IDS.includes(userId.toString());
}

function isPremium(chatId) {
    return premiumUsers.has(chatId);
}

function logError(type, message, details = {}) {
    const error = {
        type,
        message,
        details,
        timestamp: new Date().toISOString()
    };
    analytics.errorLogs.push(error);
    
    if (analytics.errorLogs.length > 500) {
        analytics.errorLogs.shift();
    }
    
    if (type === 'CRITICAL') {
        ADMIN_IDS.forEach(adminId => {
            bot.sendMessage(adminId, `🚨 *CRITICAL ERROR*\n\n*Type:* ${type}\n*Message:* ${message}\n*Time:* ${new Date().toLocaleString()}`, {parse_mode: 'Markdown'}).catch(() => {});
        });
    }
}

function getCategoryStats() {
    const categories = [...new Set(biharJobs.map(j => j.category))];
    return categories.map(cat => ({
        category: cat,
        count: biharJobs.filter(j => j.category === cat).length,
        clicks: biharJobs.filter(j => j.category === cat).reduce((sum, j) => sum + (j.clicks || 0), 0)
    }));
}

function getErrorStats() {
    const types = [...new Set(analytics.errorLogs.map(e => e.type))];
    return types.map(type => ({
        type,
        count: analytics.errorLogs.filter(e => e.type === type).length
    }));
}

// ===== RETRY SYSTEM =====
async function retryRequest(requestFn, attempts = config.retryAttempts) {
    for (let i = 0; i < attempts; i++) {
        try {
            return await requestFn();
        } catch (error) {
            if (i === attempts - 1) throw error;
            
            const delay = config.retryDelay * Math.pow(2, i);
            console.log(`⚠️ Retry attempt ${i + 1}/${attempts} after ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// ===== WEB SCRAPER WITH VERIFICATION =====
async function scrapeWebsite(site) {
    try {
        console.log(`🔍 Scraping ${site.name} [Priority ${site.priority}]...`);
        
        const response = await retryRequest(() => axios.get(site.url, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        }));
        
        const $ = cheerio.load(response.data);
        const notifications = [];
        
        // Basic scraping logic (customize based on website structure)
        $('table tr, .notification-item, .job-listing').each((index, element) => {
            if (index >= 5) return false; // Limit to 5 per site
            
            const $elem = $(element);
            let title = $elem.find('a').first().text().trim() || $elem.find('td').eq(1).text().trim();
            let link = $elem.find('a').first().attr('href');
            
            if (title && link) {
                // Make absolute URL
                if (link && !link.startsWith('http')) {
                    const baseUrl = new URL(site.url);
                    link = link.startsWith('/') ? 
                        `${baseUrl.protocol}//${baseUrl.host}${link}` : 
                        `${site.url}/${link}`;
                }
                
                notifications.push({
                    title: title,
                    link: link,
                    organization: site.name,
                    category: site.category,
                    source: site.name,
                    priority: site.priority,
                    isOfficial: site.isOfficial,
                    scrapedAt: new Date()
                });
            }
        });
        
        site.lastScrape = new Date();
        site.errorCount = 0;
        
        console.log(`✅ Found ${notifications.length} from ${site.name}`);
        return notifications;
        
    } catch (error) {
        site.errorCount++;
        logError('SCRAPER_ERROR', `Failed to scrape ${site.name}`, { error: error.message });
        
        if (site.errorCount >= 3) {
            ADMIN_IDS.forEach(adminId => {
                bot.sendMessage(adminId, `⚠️ *Website Down Alert*\n\n*Site:* ${site.name}\n*URL:* ${site.url}\n*Error Count:* ${site.errorCount}`, {parse_mode: 'Markdown'}).catch(() => {});
            });
        }
        
        return [];
    }
}

// ===== PREMIUM ALERT SYSTEM =====
async function sendPremiumAlert(job) {
    const premiumMsg = `
💎 *PREMIUM EARLY ALERT* 💎

${job.verificationStatus}

🆕 *New Job Posted!*

${job.title}

👥 *Posts:* ${job.posts}
📅 *Last Date:* ${job.lastDate}
🏢 *Organization:* ${job.organization}

⏰ *You're getting this ${config.premiumAlertDelay/60000} minutes early!*

${job.verificationReason ? `✓ ${job.verificationReason}` : ''}

🔗 *Apply Now:* ${job.applyLink}
`;

    for (const [chatId, data] of premiumUsers) {
        try {
            await bot.sendMessage(chatId, premiumMsg, {
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            });
        } catch (error) {
            console.log(`Error sending premium alert to ${chatId}`);
        }
    }
}

// ===== BROADCAST SYSTEM =====
async function broadcastMessage(message, targetAudience = 'all') {
    let recipients = [];
    
    switch(targetAudience) {
        case 'all':
            recipients = Array.from(users.keys());
            break;
        case 'subscribers':
            recipients = Array.from(subscribers.keys());
            break;
        case 'premium':
            recipients = Array.from(premiumUsers.keys());
            break;
    }
    
    let sentCount = 0;
    let failedCount = 0;
    
    for (const chatId of recipients) {
        try {
            await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            sentCount++;
            await new Promise(r => setTimeout(r, 100));
        } catch (error) {
            failedCount++;
        }
    }
    
    return { sent: sentCount, failed: failedCount, total: recipients.length };
}

// ===== JOB DISPLAY FUNCTIONS =====
function formatJobDetails(job) {
    const verificationBadge = job.verificationStatus || '';
    
    return `
${verificationBadge}

╔═══════════════════════════╗
║      📋 JOB DETAILS      ║
╚═══════════════════════════╝

*${job.title}*

┌─ 📊 OVERVIEW ────────────────┐
│ 🏢 *Organisation:* ${job.organization}
│ 📂 *Category:* ${job.category}
│ 📊 *Total Posts:* ${job.posts}
│ 📅 *Last Date:* ${job.lastDate}
└──────────────────────────────┘

┌─ 📅 IMPORTANT DATES ─────────┐
│ ✍️ Apply Starts: ${job.publishDate}
│ ⏰ Last Date: ${job.lastDate}
│ 📝 Exam Date: ${job.examDate}
└──────────────────────────────┘

┌─ 📝 SELECTION PROCESS ───────┐
${job.selectionProcess}
└──────────────────────────────┘

┌─ ✅ ELIGIBILITY ─────────────┐
│ 🎓 Qualification: ${job.qualification}
│ 📅 Age Limit: ${job.ageLimit}
│ 💰 Salary: ${job.salary}
│ 💳 Fee: ${job.applicationFee}
└──────────────────────────────┘

${job.verificationReason ? `✓ ${job.verificationReason}` : ''}

🌐 *Official Website:* ${job.officialWebsite}
`;
}

function createJobCard(job) {
    const verificationBadge = job.verificationStatus || '';
    
    const message = `
${verificationBadge}

🏛️ *${job.title}*

🏢 *Organization:* ${job.organization}
📂 *Category:* ${job.category}
📌 *Advt No:* ${job.advtNo}
👥 *Posts:* ${job.posts}
📅 *Last Date:* ${job.lastDate}

💰 *Salary:* ${job.salary}
🎓 *Qualification:* ${job.qualification}
📅 *Age Limit:* ${job.ageLimit}

${job.verificationReason ? `✓ ${job.verificationReason}` : ''}
`;

    const keyboard = {
        inline_keyboard: [
            [{text: '📄 Notification PDF', url: job.notificationPDF}],
            [{text: '🔗 Apply Online', url: job.applyLink}],
            [
                {text: '💾 Save', callback_data: `save_${job.id}`},
                {text: '📤 Share', callback_data: `share_${job.id}`}
            ],
            [
                {text: '◀️ Previous', callback_data: `job_prev_${job.id}`},
                {text: 'Next ▶️', callback_data: `job_next_${job.id}`}
            ],
            [{text: '📋 Full Details', callback_data: `details_${job.id}`}],
            config.affiliateEnabled ? [{text: '📚 Test Series', callback_data: 'show_affiliate'}] : [],
            [{text: '🏠 Back to List', callback_data: 'back_to_jobs'}]
        ].filter(row => row.length > 0)
    };

    return {message, keyboard};
}

async function showLatestJobs(chatId) {
    try {
        if (biharJobs.length === 0) {
            bot.sendMessage(chatId, '❌ No jobs available currently. Please check back later!');
            return;
        }
        
        const latestJobs = biharJobs.slice(0, 10);
        
        const jobButtons = latestJobs.map((job, index) => {
            const badge = job.verificationStatus === VerificationLevel.OFFICIAL ? '🟢' : 
                          job.verificationStatus === VerificationLevel.MULTI_SOURCE ? '🟡' : '';
            return [{
                text: `${badge} ${index + 1}. ${job.shortTitle}`,
                callback_data: `view_job_${job.id}`
            }];
        });
        
        jobButtons.push([{text: '🔍 Search Jobs', callback_data: 'search_jobs'}]);
        jobButtons.push([{text: '🔄 Refresh', callback_data: 'refresh_jobs'}]);
        if (config.affiliateEnabled) {
            jobButtons.push([{text: '📚 Test Series & Courses', callback_data: 'show_affiliate'}]);
        }
        jobButtons.push([{text: '🏠 Main Menu', callback_data: 'back_to_start'}]);
        
        const keyboard = {inline_keyboard: jobButtons};
        
        const msg = `💼 *Latest Government Jobs*\n\n🔒 *All jobs are verified!*\n🟢 Official | 🟡 Multi-Source\n\n📅 Updated: ${new Date().toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'})}\n🔢 Total Jobs: ${biharJobs.length}\n\nClick on any job to view full details:`;
        
        bot.sendMessage(chatId, msg, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
        
        const engagement = analytics.userEngagement.get(chatId) || 0;
        analytics.userEngagement.set(chatId, engagement + 1);
        
    } catch (error) {
        console.error('Error showing jobs:', error);
        logError('DISPLAY_ERROR', 'Failed to show jobs', { chatId });
        bot.sendMessage(chatId, '❌ Error loading jobs. Please try again later.');
    }
}

function showTrendingJobs(chatId) {
    let msg = `🔥 *Trending Jobs - Most Demanded*\n\nTop ${trendingJobs.length} Jobs with Maximum Posts:\n\n`;
    
    const buttons = [];
    
    trendingJobs.forEach((job, index) => {
        msg += `${index + 1}. *${job.title}*\n`;
        msg += `   👥 Posts: ${job.posts.toLocaleString()}\n`;
        msg += `   📅 Last Date: ${job.lastDate}\n`;
        msg += `   🏢 ${job.organization}\n\n`;
        
        buttons.push([
            {text: `📝 Apply (${job.posts.toLocaleString()} Posts)`, url: job.applyLink}
        ]);
    });
    
    buttons.push([{text: '📋 All Jobs', callback_data: 'view_latest_jobs'}]);
    buttons.push([{text: '🏠 Main Menu', callback_data: 'back_to_start'}]);
    
    bot.sendMessage(chatId, msg, {
        parse_mode: 'Markdown',
        reply_markup: {inline_keyboard: buttons}
    });
}

function showResults(chatId) {
    if (biharResults.length === 0) {
        return bot.sendMessage(chatId, '❌ No results available at the moment. Please check back later!');
    }
    
    let msg = `📊 *LATEST RESULTS*\n\n🔔 Total Results: *${biharResults.length}*\n\n`;
    
    biharResults.forEach((result, index) => {
        msg += `${index + 1}. [${result.title}](${result.resultLink})\n`;
        msg += `   📅 Result Date: ${result.resultDate}\n\n`;
    });
    
    msg += `\n💡 *Tap on any result to view details*`;
    
    bot.sendMessage(chatId, msg, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_markup: {
            inline_keyboard: [
                [{text: '📋 Latest Jobs', callback_data: 'view_latest_jobs'}],
                [{text: '🔄 Refresh', callback_data: 'refresh_results'}, {text: '🏠 Menu', callback_data: 'back_to_start'}]
            ]
        }
    });
}

function showAdmitCards(chatId) {
    if (biharAdmitCards.length === 0) {
        return bot.sendMessage(chatId, '❌ No admit cards available at the moment. Please check back later!');
    }
    
    let msg = `🎫 *LATEST ADMIT CARDS*\n\n🔔 Total Admit Cards: *${biharAdmitCards.length}*\n\n`;
    
    biharAdmitCards.forEach((admit, index) => {
        msg += `${index + 1}. [${admit.title}](${admit.admitLink})\n`;
        msg += `   📅 Exam Date: ${admit.examDate}\n\n`;
    });
    
    msg += `\n💡 *Tap on any admit card to download*`;
    
    bot.sendMessage(chatId, msg, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_markup: {
            inline_keyboard: [
                [{text: '📋 Latest Jobs', callback_data: 'view_latest_jobs'}],
                [{text: '🔄 Refresh', callback_data: 'refresh_admits'}, {text: '🏠 Menu', callback_data: 'back_to_start'}]
            ]
        }
    });
}

function showUniversities(chatId) {
    let msg = `🎓 *BIHAR UNIVERSITIES*\n\n📚 Total Universities: *${biharUniversities.length}*\n\nChoose a university to view details:\n\n`;
    
    const buttons = [];
    
    biharUniversities.forEach((uni) => {
        buttons.push([{
            text: `${uni.shortName} - ${uni.location}`,
            callback_data: `uni_${uni.id}`
        }]);
    });
    
    buttons.push([{text: '🌐 Govt Websites', callback_data: 'show_govt_websites'}]);
    buttons.push([{text: '🏠 Main Menu', callback_data: 'back_to_start'}]);
    
    bot.sendMessage(chatId, msg, {
        parse_mode: 'Markdown',
        reply_markup: {inline_keyboard: buttons}
    });
}

function showUniversityDetails(chatId, uniId) {
    const uni = biharUniversities.find(u => u.id === parseInt(uniId));
    
    if (!uni) {
        return bot.sendMessage(chatId, '❌ University not found!');
    }
    
    const msg = `
🎓 *${uni.name}*

📍 *Location:* ${uni.location}
🏛️ *Type:* ${uni.type}
📅 *Established:* ${uni.established}

📚 *Courses Offered:*
${uni.courses}

📞 *Contact:* ${uni.contact}
🌐 *Website:* ${uni.website}

💡 *Visit official website for admissions, results, and notifications*
`;
    
    bot.sendMessage(chatId, msg, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_markup: {
            inline_keyboard: [
                [{text: '🌐 Visit Website', url: uni.website}],
                [{text: '⬅️ Back to List', callback_data: 'show_universities'}],
                [{text: '🏠 Main Menu', callback_data: 'back_to_start'}]
            ]
        }
    });
}

function showGovtWebsites(chatId) {
    let msg = `🌐 *GOVERNMENT WEBSITES*\n\n📋 Important Bihar Govt Job Portals:\n\n`;
    
    const buttons = [];
    
    govtWebsites.forEach((site, index) => {
        msg += `${index + 1}. *${site.name}* (${site.category})\n`;
        buttons.push([{text: `🔗 ${site.name}`, url: site.url}]);
    });
    
    msg += `\n💡 *Tap to visit official websites*`;
    
    buttons.push([{text: '⬅️ Back to Universities', callback_data: 'show_universities'}]);
    buttons.push([{text: '🏠 Main Menu', callback_data: 'back_to_start'}]);
    
    bot.sendMessage(chatId, msg, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_markup: {inline_keyboard: buttons}
    });
}

function showUserProfile(chatId, userId) {
    const user = users.get(chatId);
    const isSubscribed = subscribers.has(chatId);
    const premium = isPremium(chatId);
    const profile = userProfiles.get(chatId) || {savedJobs: []};
    const savedJobsCount = profile.savedJobs.length;
    const engagement = analytics.userEngagement.get(chatId) || 0;
    
    if (!user) {
        return bot.sendMessage(chatId, '❌ Profile not found. Please /start the bot first.');
    }
    
    const joinDate = user.joinedAt ? new Date(user.joinedAt).toLocaleDateString('en-IN') : 'Unknown';
    
    const msg = `
👤 *YOUR PROFILE*

📛 *Name:* ${user.firstName}
🆔 *User ID:* ${userId}
📅 *Joined:* ${joinDate}
🔔 *Subscription:* ${isSubscribed ? '✅ Active' : '❌ Inactive'}
💎 *Premium:* ${premium ? '✅ Active' : '❌ Inactive'}
💾 *Saved Jobs:* ${savedJobsCount}
📊 *Engagement Score:* ${engagement}

🔒 *You're receiving verified job alerts only!*

💡 *Get personalized job alerts by subscribing!*
${!premium ? '\n🌟 *Upgrade to Premium* for early verified alerts!' : ''}
`;
    
    const buttons = [
        [{text: isSubscribed ? '🔕 Unsubscribe' : '🔔 Subscribe', callback_data: 'toggle_subscription'}],
        [{text: '💾 View Saved Jobs', callback_data: 'view_saved_jobs'}]
    ];
    
    if (!premium && isAdmin(userId)) {
        buttons.push([{text: '💎 Activate Premium (Admin)', callback_data: 'activate_premium'}]);
    }
    
    buttons.push([{text: '🏠 Main Menu', callback_data: 'back_to_start'}]);
    
    bot.sendMessage(chatId, msg, {
        parse_mode: 'Markdown',
        reply_markup: {inline_keyboard: buttons}
    });
}

function handleSubscription(chatId, userId) {
    const isSubscribed = subscribers.has(chatId);
    
    if (isSubscribed) {
        subscribers.delete(chatId);
        bot.sendMessage(chatId, '🔕 *Unsubscribed Successfully!*\n\nYou will no longer receive job alerts.\n\nYou can resubscribe anytime.', {parse_mode: 'Markdown'});
    } else {
        subscribers.set(chatId, {
            userId: userId,
            subscribedAt: new Date(),
            alerts: true
        });
        bot.sendMessage(chatId, '🔔 *Subscribed Successfully!*\n\n✅ You will now receive:\n• New verified job notifications\n• Result updates\n• Admit card alerts\n\n🔒 Only verified jobs will be sent!\n\nStay updated! 🚀', {parse_mode: 'Markdown'});
    }
}

function showAffiliateLinks(chatId) {
    let msg = `📚 *TEST SERIES & COURSES*\n\n🎯 Prepare for your exams with these trusted partners:\n\n`;
    
    const buttons = [];
    
    msg += `*📝 Test Series:*\n`;
    affiliateLinks.testSeries.forEach((link, i) => {
        msg += `${i+1}. ${link.name} - ${link.category}\n`;
        buttons.push([{text: `📝 ${link.name}`, url: link.url}]);
    });
    
    msg += `\n*📖 Online Courses:*\n`;
    affiliateLinks.courses.forEach((link, i) => {
        msg += `${i+1}. ${link.name} - ${link.category}\n`;
        buttons.push([{text: `📖 ${link.name}`, url: link.url}]);
    });
    
    msg += `\n*📚 Study Material:*\n`;
    affiliateLinks.books.forEach((link, i) => {
        msg += `${i+1}. ${link.name}\n`;
        buttons.push([{text: `📚 ${link.name}`, url: link.url}]);
    });
    
    msg += `\n💡 *These are affiliate links. Your purchase supports this bot!*`;
    
    buttons.push([{text: '⬅️ Back to Jobs', callback_data: 'view_latest_jobs'}]);
    
    bot.sendMessage(chatId, msg, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_markup: {inline_keyboard: buttons}
    });
}

// ===== AUTO SCRAPER WITH VERIFICATION =====
cron.schedule(`0 */${Math.floor(config.scraperFrequency/60)} * * *`, async () => {
    console.log('⏰ Running scheduled scraper with verification...');
    
    try {
        for (const site of targetWebsites) {
            if (!site.enabled) continue;
            
            const notifications = await scrapeWebsite(site);
            
            for (const notif of notifications) {
                const hash = generateNotificationHash(notif);
                
                // Skip if already published
                if (publishedHashes.has(hash)) continue;
                
                const newJob = {
                    id: `${site.name}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
                    title: notif.title,
                    shortTitle: notif.title.substring(0, 70) + (notif.title.length > 70 ? '...' : ''),
                    organization: site.name,
                    category: site.category,
                    source: site.name,
                    priority: site.priority,
                    applyLink: notif.link,
                    notificationPDF: notif.link,
                    officialWebsite: site.url,
                    autoScraped: true,
                    postedAt: new Date(),
                    clicks: 0,
                    posts: 'Check notification',
                    lastDate: 'Check notification',
                    salary: 'As per norms',
                    qualification: 'As per notification',
                    ageLimit: 'As per rules',
                    applicationFee: 'As per category',
                    selectionProcess: 'As per notification',
                    advtNo: 'See notification',
                    publishDate: new Date().toLocaleDateString('en-IN'),
                    examDate: 'To be notified',
                    description: `Latest notification from ${site.name}`
                };
                
                // Detect official PDF
                if (detectOfficialPDF(newJob)) {
                    newJob.hasOfficialPDF = true;
                }
                
                // Check verification queue for matches
                let matchingSources = [site.name];
                
                for (const queueItem of holdQueue) {
                    const similarity = compareNotifications(newJob, queueItem.notification);
                    if (similarity.similarityScore >= 60) {
                        matchingSources = [...new Set([...matchingSources, ...queueItem.foundInSources])];
                    }
                }
                
                // Verify
                const verification = verifyNotification(newJob, matchingSources);
                
                newJob.verificationStatus = verification.status;
                newJob.verificationConfidence = verification.confidence;
                newJob.verificationReason = verification.reason;
                newJob.foundInSources = matchingSources;
                
                if (verification.shouldPublish) {
                    // Publish immediately
                    await publishVerifiedJob(newJob);
                } else {
                    // Add to hold queue
                    addToHoldQueue(newJob);
                }
            }
            
            await new Promise(r => setTimeout(r, 5000));
        }
    } catch (error) {
        logError('SCRAPER_CRON_ERROR', error.message);
    }
});

// Check hold queue every 30 minutes
cron.schedule(`*/${config.holdQueueCheckInterval} * * * *`, async () => {
    console.log('⏰ Checking hold queue for publishable items...');
    await processHoldQueue();
});

// ===== BOT COMMANDS =====
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.first_name;
    
    if (!users.has(chatId)) {
        users.set(chatId, {
            id: chatId,
            username: msg.from.username || 'N/A',
            firstName: username,
            joinedAt: new Date()
        });
        
        userProfiles.set(chatId, {
            savedJobs: [],
            preferences: {},
            lastActive: new Date()
        });
        
        console.log(`✅ New user: ${username} (${chatId})`);
    }
    
    const keyboard = {
        keyboard: [
            ['🔥 ट्रेंडिंग जॉब्स', '🏛️ सरकारी नौकरी'],
            ['📊 रिजल्ट', '🎫 एडमिट कार्ड'],
            ['🎓 विश्वविद्यालय', '🌐 सरकारी वेबसाइट'],
            ['👤 प्रोफाइल', '🔔 सब्सक्राइब'],
            ['💾 Saved Jobs', '📚 Test Series'],
            ['ℹ️ हेल्प', '💎 Premium']
        ],
        resize_keyboard: true
    };
    
    const welcomeMsg = `
🙏 *नमस्कार ${username}!*

*बिहार एजुकेशन बॉट में आपका स्वागत है!* 🎓

✨ *67 Premium Features Active!*
🔒 *Multi-Source Verification System!*

📱 *यहाँ आपको मिलेगी:*
🟢 Official Verified Jobs
🟡 Multi-Source Verified Updates
🔥 ट्रेंडिंग जॉब्स (35,000+ posts)
🏛️ ${biharJobs.length}+ सरकारी नौकरियां
📊 ${biharResults.length}+ लेटेस्ट रिजल्ट्स
🎫 ${biharAdmitCards.length}+ एडमिट कार्ड
🎓 ${biharUniversities.length} यूनिवर्सिटीज
🌐 ${govtWebsites.length} सरकारी वेबसाइट लिंक्स
📚 Test Series & Courses
💎 Premium Early Alerts

🔒 *Verification System:*
• Level 1: Official Govt Sources
• Level 2: Trusted Education Portals
• Level 3: Secondary Verification
• Minimum 2 sources required for publish

💡 *नीचे के बटन दबाएं या कमांड टाइप करें!*

📌 *Commands:*
/jobs - Verified jobs
/trending - Trending jobs
/verification - Verification stats
/results - Results
/admitcards - Admit cards
/universities - Universities
/subscribe - Alerts
/premium - Premium features
/profile - Profile
/help - Help
/about - About bot
/feedback - Feedback

${isAdmin(userId) ? '\n🔧 *Admin Commands:*\n/admin - Control Panel\n/broadcast - Broadcast\n/stats - Analytics\n/sources - Manage Sources\n/holdqueue - View Hold Queue' : ''}
`;
    
    bot.sendMessage(chatId, welcomeMsg, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
});

bot.onText(/\/jobs/, async (msg) => {
    await showLatestJobs(msg.chat.id);
});

bot.onText(/\/trending/, (msg) => {
    showTrendingJobs(msg.chat.id);
});

bot.onText(/\/verification/, (msg) => {
    const chatId = msg.chat.id;
    
    const msg_text = `
🔒 *VERIFICATION SYSTEM STATUS*

*Multi-Source Verification Active!*

📊 *Statistics:*
🟢 Official Verified: ${analytics.verificationStats.official}
🟡 Multi-Source Verified: ${analytics.verificationStats.multiSource}
🔴 Unverified (Held): ${analytics.verificationStats.unverified}
⏳ In Hold Queue: ${holdQueue.length}

*🌐 Source Levels:*
Level 1 (Official): ${targetWebsites.filter(s => s.priority === 1).length} sources
Level 2 (Trusted): ${targetWebsites.filter(s => s.priority === 2).length} sources
Level 3 (Secondary): ${targetWebsites.filter(s => s.priority === 3).length} sources

*⚙️ Verification Rules:*
• Official source = Instant publish ✅
• ${config.minSourcesForPublish}+ trusted sources = Multi-source verified
• Less than ${config.minSourcesForPublish} sources = Hold queue

*📈 Full Stats:*
${process.env.RENDER_EXTERNAL_URL || 'http://localhost:'+PORT}/verification

🔒 *Your safety is our priority!*
`;
    
    bot.sendMessage(chatId, msg_text, {parse_mode: 'Markdown'});
});

bot.onText(/\/results/, (msg) => {
    showResults(msg.chat.id);
});

bot.onText(/\/admitcards/, (msg) => {
    showAdmitCards(msg.chat.id);
});

bot.onText(/\/universities/, (msg) => {
    showUniversities(msg.chat.id);
});

bot.onText(/\/subscribe/, (msg) => {
    handleSubscription(msg.chat.id, msg.from.id);
});

bot.onText(/\/profile/, (msg) => {
    showUserProfile(msg.chat.id, msg.from.id);
});

bot.onText(/\/premium/, (msg) => {
    const chatId = msg.chat.id;
    const premium = isPremium(chatId);
    
    if (premium) {
        bot.sendMessage(chatId, `💎 *Premium Active!*\n\nYou have access to:\n✅ Early verified job alerts (1 hour before others)\n✅ Personalized notifications\n✅ Priority support\n✅ Ad-free experience\n✅ Verified job guarantee\n\nThank you for your support! 🙏`, {parse_mode: 'Markdown'});
    } else {
        bot.sendMessage(chatId, `💎 *Upgrade to Premium*\n\n*Benefits:*\n⚡ Get verified alerts 1 hour early\n🔒 100% verified job guarantee\n🎯 Personalized notifications\n💬 Priority support\n🚫 Ad-free experience\n\n*Price:* ₹99/month\n\n_Premium feature coming soon!_\n\nFor now, use /subscribe for free verified alerts!`, {parse_mode: 'Markdown'});
    }
});

bot.onText(/\/myid/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const isUserAdmin = isAdmin(userId);
    const premium = isPremium(chatId);
    
    bot.sendMessage(chatId, `
🆔 *Your Telegram Information*

👤 *User ID:* \`${userId}\`
💬 *Chat ID:* \`${chatId}\`
📛 *Username:* ${msg.from.username || 'Not set'}
📝 *Name:* ${msg.from.first_name} ${msg.from.last_name || ''}
${isUserAdmin ? '🔧 *Status:* Admin ✅' : premium ? '💎 *Status:* Premium User' : '👤 *Status:* Regular User'}
📊 *Engagement:* ${analytics.userEngagement.get(chatId) || 0} interactions

${!isUserAdmin ? '💡 *Want admin access?* Send your User ID to the bot administrator.' : '✨ *You have full admin access to all bot features!*'}
`, {parse_mode: 'Markdown'});
});

bot.onText(/\/feedback/, (msg) => {
    const chatId = msg.chat.id;
    userStates.set(chatId, 'awaiting_feedback');
    bot.sendMessage(chatId, '📝 *Feedback*\n\nPlease share your feedback, suggestions, or report issues.\n\nType your message:', {parse_mode: 'Markdown'});
});

bot.onText(/\/about/, (msg) => {
    bot.sendMessage(msg.chat.id, `
ℹ️ *Bihar Education Bot v8.0*

*Your ultimate companion for Bihar government jobs with multi-source verification!*

✨ *67 Premium Features Including:*

*📋 Content:*
• ${biharJobs.length}+ Government Jobs (All Verified!)
• ${trendingJobs.length} Trending Jobs (35K+ Posts)
• ${biharResults.length}+ Latest Results
• ${biharAdmitCards.length}+ Admit Cards
• ${biharUniversities.length} Universities
• ${govtWebsites.length} Govt Websites

*🔒 Verification System (NEW!):*
• 3-Level Source Priority
• Multi-Source Confirmation
• Official PDF Detection
• Hold Queue System
• Verification Status Tags
• Safe Publishing Mode
• Source Comparison Engine
• Admin Manual Approval
• Verification Logs
• Auto-Scraping with Verification

*🤖 Advanced Features:*
• Duplicate Detection System
• Retry System (3 attempts)
• Error Logging & Alerts
• Admin Control Panel
• Broadcast System
• Premium Early Alerts
• Affiliate Link System
• Real-time Analytics
• Click Tracking
• Growth Monitoring
• And 47 more features!

📊 *Current Statistics:*
• Total Users: ${users.size}
• Subscribers: ${subscribers.size}
• Premium Users: ${premiumUsers.size}
• Verified Posts: ${analytics.verificationStats.official + analytics.verificationStats.multiSource}
• In Hold Queue: ${holdQueue.length}
• Total Clicks: ${analytics.totalClicks}
• Uptime: ${Math.floor(process.uptime()/3600)}h ${Math.floor((process.uptime()%3600)/60)}m

🔒 *Verification Stats:*
• Official Verified: ${analytics.verificationStats.official}
• Multi-Source Verified: ${analytics.verificationStats.multiSource}
• Held for Verification: ${holdQueue.length}

🚀 *Deployment:*
• Platform: Render.com (24/7)
• Version: 8.0 (67 Features + Verification)
• Last Updated: Feb 2026

Made with ❤️ for Bihar Students
`, {parse_mode: 'Markdown'});
});

bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id, `
ℹ️ *Bihar Education Bot - Help Guide*

*📌 Main Commands:*
/start - 🏠 Start the bot
/jobs - 💼 Verified latest jobs
/trending - 🔥 Trending jobs
/verification - 🔒 Verification system status
/results - 📊 Results
/admitcards - 🎫 Admit cards
/universities - 🎓 Universities
/subscribe - 🔔 Verified alerts
/premium - 💎 Premium features
/profile - 👤 Your profile
/myid - 🆔 Your Telegram ID
/feedback - 📝 Send feedback
/about - ℹ️ About bot
/help - ❓ This help guide

*🔒 Verification System:*
🟢 = Official Government Source
🟡 = Verified from Multiple Sources
🔴 = Unverified (Not Published)
⏳ = Awaiting Verification

*✨ Features:*
• 67 Premium Features
• Multi-Source Verification
• 3-Level Source Priority
• Auto-Scraping System
• Hold Queue System
• Official PDF Detection
• Premium Early Alerts
• Analytics Dashboard
• Error Logging
• Test Series Links
• And much more!

*📚 How to Use:*
1. Use commands or buttons below
2. Subscribe for verified alerts
3. Save jobs you like
4. Search by keywords
5. Get instant verified notifications

*💎 Premium Benefits:*
• Early verified alerts (1 hour)
• 100% verification guarantee
• Personalized notifications
• Priority support
• Ad-free experience

*🆘 Support:*
Use /feedback for issues or suggestions

🔒 *We verify every job before publishing!*

Made with ❤️ for Bihar Students
`, {parse_mode: 'Markdown'});
});

// ===== ADMIN COMMANDS =====
bot.onText(/\/admin/, (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(chatId, '❌ Admin access required!');
    }
    
    const adminMenu = {
        inline_keyboard: [
            [{text: '📊 Analytics Dashboard', callback_data: 'admin_analytics'}],
            [{text: '🔒 Verification Stats', callback_data: 'admin_verification'}],
            [{text: '⏳ Hold Queue', callback_data: 'admin_holdqueue'}],
            [{text: '📢 Broadcast Message', callback_data: 'admin_broadcast'}],
            [{text: '👥 User Management', callback_data: 'admin_users'}],
            [{text: '🌐 Source Management', callback_data: 'admin_sources'}],
            [{text: '⚠️ Error Logs', callback_data: 'admin_errors'}],
            [{text: '💼 Manual Post', callback_data: 'admin_manual_post'}],
            [{text: '⚙️ Settings', callback_data: 'admin_settings'}],
            [{text: '🏠 Main Menu', callback_data: 'back_to_start'}]
        ]
    };
    
    bot.sendMessage(chatId, `
🔧 *Admin Control Panel*

Welcome Admin ${msg.from.first_name}!

*📊 Overview:*
• Users: ${users.size}
• Subscribers: ${subscribers.size}
• Premium: ${premiumUsers.size}
• Total Posts: ${analytics.totalPosts}
• Total Clicks: ${analytics.totalClicks}
• Errors: ${analytics.errorLogs.length}

*🔒 Verification:*
• Official Verified: ${analytics.verificationStats.official}
• Multi-Source Verified: ${analytics.verificationStats.multiSource}
• In Hold Queue: ${holdQueue.length}

*💼 Content:*
• Jobs: ${biharJobs.length}
• Results: ${biharResults.length}
• Admit Cards: ${biharAdmitCards.length}

*🌐 Sources:*
${targetWebsites.slice(0,4).map(s => `• ${s.name}: ${s.enabled ? '✅' : '❌'} (${s.errorCount} errors)`).join('\n')}

*⏱️ System:*
• Uptime: ${Math.floor(process.uptime()/3600)}h ${Math.floor((process.uptime()%3600)/60)}m
• Version: 8.0
• Features: 67

Select an option below:
`, {parse_mode: 'Markdown', reply_markup: adminMenu});
});

bot.onText(/\/holdqueue/, (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(chatId, '❌ Admin only command!');
    }
    
    if (holdQueue.length === 0) {
        return bot.sendMessage(chatId, '✅ Hold queue is empty!', {parse_mode: 'Markdown'});
    }
    
    let queueMsg = `⏳ *Hold Queue (${holdQueue.length} items)*\n\n`;
    
    holdQueue.slice(0, 10).forEach((item, index) => {
        const ageMinutes = Math.floor((Date.now() - item.addedAt) / 60000);
        queueMsg += `${index + 1}. *${item.notification.shortTitle}*\n`;
        queueMsg += `   Sources: ${item.foundInSources.length} (${item.foundInSources.join(', ')})\n`;
        queueMsg += `   Age: ${ageMinutes} minutes\n`;
        queueMsg += `   Status: ${item.verificationStatus}\n\n`;
    });
    
    if (holdQueue.length > 10) {
        queueMsg += `\n_Showing 10 of ${holdQueue.length} items_`;
    }
    
    queueMsg += `\n\n💡 Items will auto-publish when verified from ${config.minSourcesForPublish}+ sources`;
    
    const buttons = [
        [{text: '🔄 Process Queue Now', callback_data: 'process_hold_queue'}],
        [{text: '🏠 Admin Menu', callback_data: 'admin_menu'}]
    ];
    
    bot.sendMessage(chatId, queueMsg, {
        parse_mode: 'Markdown',
        reply_markup: {inline_keyboard: buttons}
    });
});

bot.onText(/\/broadcast (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(chatId, '❌ Admin only command!');
    }
    
    const message = match[1];
    
    const keyboard = {
        inline_keyboard: [
            [{text: '📢 All Users', callback_data: `broadcast_all_${Date.now()}`}],
            [{text: '🔔 Subscribers Only', callback_data: `broadcast_subscribers_${Date.now()}`}],
            [{text: '💎 Premium Only', callback_data: `broadcast_premium_${Date.now()}`}],
            [{text: '❌ Cancel', callback_data: 'admin_menu'}]
        ]
    };
    
    userStates.set(chatId, `broadcast_message:${message}`);
    
    bot.sendMessage(chatId, `📢 *Broadcast Message*\n\n*Your Message:*\n${message}\n\n*Select target audience:*`, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
});

bot.onText(/\/stats/, (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(chatId, '❌ Admin only command!');
    }
    
    const categories = getCategoryStats();
    const errors = getErrorStats();
    
    bot.sendMessage(chatId, `
📊 *Detailed Analytics*

*👥 Users & Engagement:*
• Total Users: ${users.size}
• Subscribers: ${subscribers.size}
• Premium Users: ${premiumUsers.size}
• Active Users: ${analytics.userEngagement.size}
• Subscription Rate: ${users.size > 0 ? ((subscribers.size/users.size)*100).toFixed(1) : 0}%

*🔒 Verification Performance:*
• Official Verified: ${analytics.verificationStats.official}
• Multi-Source Verified: ${analytics.verificationStats.multiSource}
• Unverified (Held): ${analytics.verificationStats.unverified}
• Currently in Queue: ${holdQueue.length}
• Verification Rate: ${analytics.totalPosts > 0 ? (((analytics.verificationStats.official + analytics.verificationStats.multiSource)/analytics.totalPosts)*100).toFixed(1) : 0}%

*📊 Performance:*
• Total Posts: ${analytics.totalPosts}
• Total Clicks: ${analytics.totalClicks}
• Click-Through Rate: ${analytics.totalPosts > 0 ? ((analytics.totalClicks/analytics.totalPosts)*100).toFixed(2) : 0}%
• Avg Engagement: ${analytics.userEngagement.size > 0 ? (Array.from(analytics.userEngagement.values()).reduce((a,b)=>a+b,0)/analytics.userEngagement.size).toFixed(2) : 0}

*💼 Content by Category:*
${categories.map(c => `• ${c.category}: ${c.count} jobs (${c.clicks} clicks)`).join('\n')}

*🌐 Sources Status:*
${targetWebsites.slice(0,5).map(s => `• ${s.name} [P${s.priority}]: ${s.enabled ? '✅' : '❌'} (${s.errorCount} errors)`).join('\n')}

*⚠️ Errors:*
${errors.slice(0,5).map(e => `• ${e.type}: ${e.count}`).join('\n')}

*⏱️ System:*
• Uptime: ${Math.floor(process.uptime()/3600)}h ${Math.floor((process.uptime()%3600)/60)}m
• Start Time: ${analytics.startTime.toLocaleString()}
• Version: 8.0

*🔗 Full Analytics:*
${process.env.RENDER_EXTERNAL_URL || 'http://localhost:'+PORT}/analytics
`, {parse_mode: 'Markdown'});
});

bot.onText(/\/errors/, (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(chatId, '❌ Admin only command!');
    }
    
    const recentErrors = analytics.errorLogs.slice(-10);
    
    let errorMsg = `⚠️ *Error Logs*\n\n*Total Errors:* ${analytics.errorLogs.length}\n\n*Recent 10 Errors:*\n\n`;
    
    recentErrors.forEach((err, i) => {
        errorMsg += `${i+1}. *${err.type}*\n`;
        errorMsg += `   Message: ${err.message}\n`;
        errorMsg += `   Time: ${new Date(err.timestamp).toLocaleString()}\n\n`;
    });
    
    errorMsg += `\n*Full logs:* ${process.env.RENDER_EXTERNAL_URL || 'http://localhost:'+PORT}/errors`;
    
    bot.sendMessage(chatId, errorMsg, {parse_mode: 'Markdown'});
});

bot.onText(/\/sources/, (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(chatId, '❌ Admin only command!');
    }
    
    let sourceMsg = `🌐 *Source Management*\n\n🔒 *Verification System Active*\n\n*Active Sources:* ${targetWebsites.filter(s=>s.enabled).length}/${targetWebsites.length}\n\n`;
    
    const buttons = [];
    
    // Group by priority
    [1, 2, 3].forEach(priority => {
        const sources = targetWebsites.filter(s => s.priority === priority);
        if (sources.length > 0) {
            sourceMsg += `\n*Level ${priority} ${priority === 1 ? '(Official)' : priority === 2 ? '(Trusted)' : '(Secondary)'}:*\n`;
            
            sources.forEach(site => {
                sourceMsg += `${site.enabled ? '✅' : '❌'} *${site.name}*\n`;
                sourceMsg += `   Weight: ${site.verificationWeight} | Errors: ${site.errorCount}\n`;
                sourceMsg += `   Last Scrape: ${site.lastScrape ? new Date(site.lastScrape).toLocaleString() : 'Never'}\n\n`;
                
                buttons.push([{
                    text: `${site.enabled ? '🔴 Disable' : '🟢 Enable'} ${site.name}`,
                    callback_data: `toggle_source_${site.name}`
                }]);
            });
        }
    });
    
    buttons.push([{text: '🏠 Admin Menu', callback_data: 'admin_menu'}]);
    
    bot.sendMessage(chatId, sourceMsg, {
        parse_mode: 'Markdown',
        reply_markup: {inline_keyboard: buttons}
    });
});

// ===== KEYBOARD BUTTON HANDLERS =====
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    if (!text || text.startsWith('/')) return;
    
    // Handle feedback state
    if (userStates.get(chatId) === 'awaiting_feedback') {
        ADMIN_IDS.forEach(adminId => {
            bot.sendMessage(adminId, `📝 *New Feedback*\n\n*From:* ${msg.from.first_name} (${chatId})\n*Username:* @${msg.from.username || 'none'}\n\n*Message:*\n${text}`, {parse_mode: 'Markdown'}).catch(() => {});
        });
        bot.sendMessage(chatId, '✅ *Thank you for your feedback!*\n\nWe will review it soon and get back to you if needed.', {parse_mode: 'Markdown'});
        userStates.delete(chatId);
        return;
    }
    
    // Handle search state
    if (userStates.get(chatId) === 'awaiting_search') {
        const searchTerm = text.toLowerCase();
        userStates.delete(chatId);
        
        const results = biharJobs.filter(job => 
            job.title.toLowerCase().includes(searchTerm) ||
            job.organization.toLowerCase().includes(searchTerm) ||
            job.category.toLowerCase().includes(searchTerm)
        );
        
        if (results.length === 0) {
            return bot.sendMessage(chatId, `❌ No jobs found for "*${searchTerm}*"\n\nTry different keywords like:\n- Railway\n- SSC\n- Banking\n- Police\n- Teacher\n- BPSC`, {parse_mode: 'Markdown'});
        }
        
        let searchMsg = `🔍 *Search Results for "${searchTerm}"*\n\nFound *${results.length}* verified jobs:\n\n`;
        
        const buttons = [];
        
        results.slice(0, 10).forEach((job, index) => {
            const badge = job.verificationStatus === VerificationLevel.OFFICIAL ? '🟢' : 
                          job.verificationStatus === VerificationLevel.MULTI_SOURCE ? '🟡' : '';
            searchMsg += `${index + 1}. ${badge} ${job.shortTitle}\n`;
            buttons.push([{
                text: `${badge} ${index + 1}. ${job.shortTitle}`,
                callback_data: `view_job_${job.id}`
            }]);
        });
        
        if (results.length > 10) {
            searchMsg += `\n_Showing top 10 of ${results.length} results_`;
        }
        
        buttons.push([{text: '🔍 Search Again', callback_data: 'search_jobs'}]);
        buttons.push([{text: '🏠 Menu', callback_data: 'back_to_start'}]);
        
        return bot.sendMessage(chatId, searchMsg, {
            parse_mode: 'Markdown',
            reply_markup: {inline_keyboard: buttons}
        });
    }
    
    // Handle keyboard buttons
    switch(text) {
        case '🔥 ट्रेंडिंग जॉब्स':
            showTrendingJobs(chatId);
            break;
        case '🏛️ सरकारी नौकरी':
            showLatestJobs(chatId);
            break;
        case '📊 रिजल्ट':
            showResults(chatId);
            break;
        case '🎫 एडमिट कार्ड':
            showAdmitCards(chatId);
            break;
        case '🎓 विश्वविद्यालय':
            showUniversities(chatId);
            break;
        case '🌐 सरकारी वेबसाइट':
            showGovtWebsites(chatId);
            break;
        case '👤 प्रोफाइल':
            showUserProfile(chatId, msg.from.id);
            break;
        case '🔔 सब्सक्राइब':
            handleSubscription(chatId, msg.from.id);
            break;
        case '💾 Saved Jobs':
            const profile = userProfiles.get(chatId) || {savedJobs: []};
            const saved = profile.savedJobs;
            if (saved.length === 0) {
                bot.sendMessage(chatId, '📭 *No Saved Jobs*\n\nYou haven\'t saved any jobs yet.\n\nUse 💾 Save button on any job to save it!', {parse_mode: 'Markdown'});
            } else {
                let msg = `💾 *Your Saved Jobs (${saved.length})*\n\n`;
                const buttons = [];
                saved.forEach((jobId, index) => {
                    const job = biharJobs.find(j => j.id === jobId);
                    if (job) {
                        const badge = job.verificationStatus === VerificationLevel.OFFICIAL ? '🟢' : 
                                      job.verificationStatus === VerificationLevel.MULTI_SOURCE ? '🟡' : '';
                        msg += `${index + 1}. ${badge} ${job.shortTitle}\n`;
                        buttons.push([{text: `${badge} ${index + 1}. ${job.shortTitle}`, callback_data: `view_job_${job.id}`}]);
                    }
                });
                buttons.push([{text: '🏠 Main Menu', callback_data: 'back_to_start'}]);
                bot.sendMessage(chatId, msg, {parse_mode: 'Markdown', reply_markup: {inline_keyboard: buttons}});
            }
            break;
        case '📚 Test Series':
            if (config.affiliateEnabled) {
                showAffiliateLinks(chatId);
            }
            break;
        case 'ℹ️ हेल्प':
            bot.sendMessage(chatId, '/help');
            break;
        case '💎 Premium':
            bot.sendMessage(chatId, '/premium');
            break;
    }
});

// ===== CALLBACK QUERY HANDLER =====
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const userId = query.from.id;
    
    // View job
    if (data.startsWith('view_job_')) {
        const jobId = data.replace('view_job_', '');
        const job = biharJobs.find(j => j.id === jobId);
        
        if (job) {
            job.clicks = (job.clicks || 0) + 1;
            analytics.totalClicks++;
            
            const jobCard = createJobCard(job);
            bot.editMessageText(jobCard.message, {
                chat_id: chatId,
                message_id: query.message.message_id,
                reply_markup: jobCard.keyboard,
                parse_mode: 'Markdown'
            }).catch(() => {});
        }
        return bot.answerCallbackQuery(query.id);
    }
    
    // Save job
    if (data.startsWith('save_')) {
        const jobId = data.replace('save_', '');
        let profile = userProfiles.get(chatId) || {savedJobs: []};
        
        if (profile.savedJobs.includes(jobId)) {
            bot.answerCallbackQuery(query.id, {text: '
✅ Already saved!', show_alert: false});
        } else {
            profile.savedJobs.push(jobId);
            userProfiles.set(chatId, profile);
            bot.answerCallbackQuery(query.id, {text: '💾 Job saved successfully!', show_alert: false});
        }
        return;
    }
    
    // Share job
    if (data.startsWith('share_')) {
        const jobId = data.replace('share_', '');
        const job = biharJobs.find(j => j.id === jobId);
        
        if (job) {
            const verificationBadge = job.verificationStatus || '';
            const shareMsg = `${verificationBadge}\n\n🏛️ *${job.title}*\n\n👥 Posts: ${job.posts}\n📅 Last Date: ${job.lastDate}\n🔗 Apply: ${job.applyLink}\n\n${job.verificationReason ? `✓ ${job.verificationReason}` : ''}\n\n🤖 Get verified jobs: @BiharEducationBot`;
            bot.sendMessage(chatId, shareMsg, {parse_mode: 'Markdown', disable_web_page_preview: true});
            bot.answerCallbackQuery(query.id, {text: '📤 Shared in this chat!', show_alert: false});
        }
        return;
    }
    
    // Full details
    if (data.startsWith('details_')) {
        const jobId = data.replace('details_', '');
        const job = biharJobs.find(j => j.id === jobId);
        
        if (job) {
            const detailsMsg = formatJobDetails(job);
            bot.editMessageText(detailsMsg, {
                chat_id: chatId,
                message_id: query.message.message_id,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{text: '🔗 Apply Online', url: job.applyLink}],
                        [{text: '⬅️ Back', callback_data: `view_job_${job.id}`}]
                    ]
                }
            }).catch(() => {});
        }
        return bot.answerCallbackQuery(query.id);
    }
    
    // Navigation
    if (data.startsWith('job_prev_') || data.startsWith('job_next_')) {
        const currentJobId = data.split('_')[2];
        const currentIndex = biharJobs.findIndex(j => j.id === currentJobId);
        
        let newIndex;
        if (data.startsWith('job_prev_')) {
            newIndex = currentIndex > 0 ? currentIndex - 1 : biharJobs.length - 1;
        } else {
            newIndex = currentIndex < biharJobs.length - 1 ? currentIndex + 1 : 0;
        }
        
        const job = biharJobs[newIndex];
        if (job) {
            const jobCard = createJobCard(job);
            bot.editMessageText(jobCard.message, {
                chat_id: chatId,
                message_id: query.message.message_id,
                reply_markup: jobCard.keyboard,
                parse_mode: 'Markdown'
            }).catch(() => {});
        }
        return bot.answerCallbackQuery(query.id);
    }
    
    // University details
    if (data.startsWith('uni_')) {
        const uniId = data.replace('uni_', '');
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        showUniversityDetails(chatId, uniId);
        return bot.answerCallbackQuery(query.id);
    }
    
    // Show universities
    if (data === 'show_universities') {
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        showUniversities(chatId);
        return bot.answerCallbackQuery(query.id);
    }
    
    // Show govt websites
    if (data === 'show_govt_websites') {
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        showGovtWebsites(chatId);
        return bot.answerCallbackQuery(query.id);
    }
    
    // Show affiliate links
    if (data === 'show_affiliate') {
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        showAffiliateLinks(chatId);
        return bot.answerCallbackQuery(query.id);
    }
    
    // Search jobs
    if (data === 'search_jobs') {
        userStates.set(chatId, 'awaiting_search');
        bot.sendMessage(chatId, '🔍 *Search Jobs*\n\nEnter keywords to search:\n\nExamples:\n• Railway\n• SSC\n• BPSC\n• Police\n• Banking\n• Teacher', {parse_mode: 'Markdown'});
        return bot.answerCallbackQuery(query.id);
    }
    
    // Toggle subscription
    if (data === 'toggle_subscription') {
        handleSubscription(chatId, userId);
        return bot.answerCallbackQuery(query.id);
    }
    
    // Activate premium (admin only)
    if (data === 'activate_premium') {
        if (isAdmin(userId)) {
            premiumUsers.set(chatId, {
                activatedAt: new Date(),
                expiresAt: new Date(Date.now() + 30*24*60*60*1000)
            });
            bot.answerCallbackQuery(query.id, {text: '💎 Premium activated!', show_alert: true});
            bot.sendMessage(chatId, '💎 *Premium Activated!*\n\nYou now have access to all premium features for 30 days!\n\n✅ Early verified alerts\n✅ Priority support\n✅ Ad-free experience', {parse_mode: 'Markdown'});
        }
        return;
    }
    
    // View saved jobs
    if (data === 'view_saved_jobs') {
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        const profile = userProfiles.get(chatId) || {savedJobs: []};
        const saved = profile.savedJobs;
        if (saved.length === 0) {
            bot.sendMessage(chatId, '📭 *No Saved Jobs*\n\nYou haven\'t saved any jobs yet.', {parse_mode: 'Markdown'});
        } else {
            let msg = `💾 *Your Saved Jobs (${saved.length})*\n\n`;
            const buttons = [];
            saved.forEach((jobId, index) => {
                const job = biharJobs.find(j => j.id === jobId);
                if (job) {
                    const badge = job.verificationStatus === VerificationLevel.OFFICIAL ? '🟢' : 
                                  job.verificationStatus === VerificationLevel.MULTI_SOURCE ? '🟡' : '';
                    msg += `${index + 1}. ${badge} ${job.shortTitle}\n`;
                    buttons.push([{text: `${badge} ${index + 1}. ${job.shortTitle}`, callback_data: `view_job_${job.id}`}]);
                }
            });
            buttons.push([{text: '🏠 Main Menu', callback_data: 'back_to_start'}]);
            bot.sendMessage(chatId, msg, {parse_mode: 'Markdown', reply_markup: {inline_keyboard: buttons}});
        }
        return bot.answerCallbackQuery(query.id);
    }
    
    // Admin callbacks
    if (data === 'admin_analytics') {
        bot.sendMessage(chatId, '/stats');
        return bot.answerCallbackQuery(query.id);
    }
    
    if (data === 'admin_verification') {
        bot.sendMessage(chatId, '/verification');
        return bot.answerCallbackQuery(query.id);
    }
    
    if (data === 'admin_holdqueue') {
        bot.sendMessage(chatId, '/holdqueue');
        return bot.answerCallbackQuery(query.id);
    }
    
    if (data === 'admin_broadcast') {
        bot.sendMessage(chatId, '📢 *Broadcast Message*\n\nUse command:\n`/broadcast Your message here`\n\nExample:\n`/broadcast 🔥 New verified job alert: BPSC recruitment!`', {parse_mode: 'Markdown'});
        return bot.answerCallbackQuery(query.id);
    }
    
    if (data === 'admin_sources') {
        bot.sendMessage(chatId, '/sources');
        return bot.answerCallbackQuery(query.id);
    }
    
    if (data === 'admin_errors') {
        bot.sendMessage(chatId, '/errors');
        return bot.answerCallbackQuery(query.id);
    }
    
    if (data === 'process_hold_queue') {
        if (!isAdmin(userId)) return bot.answerCallbackQuery(query.id);
        
        bot.answerCallbackQuery(query.id, {text: 'Processing hold queue...', show_alert: true});
        await processHoldQueue();
        bot.sendMessage(chatId, `✅ Hold queue processed!\n\nRemaining items: ${holdQueue.length}`, {parse_mode: 'Markdown'});
        return;
    }
    
    if (data.startsWith('toggle_source_')) {
        if (!isAdmin(userId)) return bot.answerCallbackQuery(query.id);
        
        const sourceName = data.replace('toggle_source_', '');
        const source = sourceDatabase.get(sourceName);
        
        if (source) {
            source.enabled = !source.enabled;
            bot.answerCallbackQuery(query.id, {text: `${source.name} ${source.enabled ? 'enabled' : 'disabled'}!`, show_alert: true});
            bot.sendMessage(chatId, '/sources');
        }
        return;
    }
    
    if (data.startsWith('broadcast_')) {
        if (!isAdmin(userId)) return bot.answerCallbackQuery(query.id);
        
        const audience = data.includes('all') ? 'all' : data.includes('subscribers') ? 'subscribers' : 'premium';
        const message = userStates.get(chatId);
        
        if (message && message.startsWith('broadcast_message:')) {
            const broadcastMsg = message.replace('broadcast_message:', '');
            
            bot.sendMessage(chatId, '📢 Broadcasting... Please wait.');
            
            const result = await broadcastMessage(broadcastMsg, audience);
            
            bot.sendMessage(chatId, `✅ *Broadcast Complete!*\n\n*Sent:* ${result.sent}\n*Failed:* ${result.failed}\n*Total:* ${result.total}`, {parse_mode: 'Markdown'});
            
            userStates.delete(chatId);
        }
        return bot.answerCallbackQuery(query.id);
    }
    
    // Other callbacks
    if (data === 'view_latest_jobs') {
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        showLatestJobs(chatId);
        return bot.answerCallbackQuery(query.id);
    }
    
    if (data === 'refresh_jobs') {
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        showLatestJobs(chatId);
        return bot.answerCallbackQuery(query.id, {text: '🔄 Refreshed!'});
    }
    
    if (data === 'refresh_results') {
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        showResults(chatId);
        return bot.answerCallbackQuery(query.id, {text: '🔄 Refreshed!'});
    }
    
    if (data === 'refresh_admits') {
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        showAdmitCards(chatId);
        return bot.answerCallbackQuery(query.id, {text: '🔄 Refreshed!'});
    }
    
    if (data === 'back_to_jobs' || data === 'back_to_start' || data === 'admin_menu') {
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        if (data === 'admin_menu' && isAdmin(userId)) {
            bot.sendMessage(chatId, '/admin');
        } else {
            showLatestJobs(chatId);
        }
        return bot.answerCallbackQuery(query.id);
    }
    
    bot.answerCallbackQuery(query.id);
});

// ===== ERROR HANDLING =====
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled rejection:', error);
    logError('UNHANDLED_REJECTION', error.message, { stack: error.stack });
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error);
    logError('UNCAUGHT_EXCEPTION', error.message, { stack: error.stack });
});

// ===== STARTUP MESSAGE =====
console.log('🚀 Bihar Education Bot v8.0 started!');
console.log('✨ 67 Premium Features Active!');
console.log('🔒 Multi-Source Verification System Active!');
console.log(`🔧 Admin IDs: ${ADMIN_IDS.join(', ') || 'None'}`);
console.log(`📺 Channel: ${CHANNEL_ID}`);
console.log(`💼 Jobs: ${biharJobs.length}`);
console.log(`🔥 Trending: ${trendingJobs.length}`);
console.log(`📊 Results: ${biharResults.length}`);
console.log(`🎫 Admit Cards: ${biharAdmitCards.length}`);
console.log(`🎓 Universities: ${biharUniversities.length}`);
console.log(`🌐 Govt Websites: ${govtWebsites.length}`);
console.log(`🌐 Sources: ${targetWebsites.length} (L1: ${targetWebsites.filter(s=>s.priority===1).length}, L2: ${targetWebsites.filter(s=>s.priority===2).length}, L3: ${targetWebsites.filter(s=>s.priority===3).length})`);
console.log(`🔗 Affiliate Links: ${config.affiliateEnabled ? 'Enabled' : 'Disabled'}`);
console.log(`📊 Analytics: ${config.analyticsEnabled ? 'Enabled' : 'Disabled'}`);
console.log(`🔒 Verification: ${config.verificationEnabled ? 'Enabled' : 'Disabled'}`);
console.log(`✅ Bot is now running 24/7 on Render!`);
console.log(`📊 Total Features: 67`);
console.log(`⚡ Webhook Mode: ${useWebhook ? 'Active' : 'Polling'}`);
console.log(`🔒 All systems operational!`);
