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

// ===== EXPRESS SERVER (MUST BE BEFORE BOT) =====
const app = express();
app.use(express.json());

// Health check endpoints for Render
app.get('/', (req, res) => {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Bihar Education Bot</title>
            <meta charset="utf-8">
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0;
                    padding: 20px;
                }
                .container {
                    background: white;
                    padding: 40px;
                    border-radius: 20px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                    max-width: 600px;
                    width: 100%;
                }
                h1 {
                    color: #667eea;
                    margin: 0 0 10px 0;
                    font-size: 32px;
                }
                .status {
                    color: #10b981;
                    font-size: 24px;
                    font-weight: bold;
                    margin: 20px 0;
                }
                .info {
                    background: #f3f4f6;
                    padding: 20px;
                    border-radius: 10px;
                    margin: 20px 0;
                }
                .info-item {
                    margin: 10px 0;
                    font-size: 16px;
                    color: #374151;
                }
                .links {
                    margin-top: 20px;
                }
                .links a {
                    display: inline-block;
                    padding: 10px 20px;
                    background: #667eea;
                    color: white;
                    text-decoration: none;
                    border-radius: 8px;
                    margin: 5px;
                    transition: background 0.3s;
                }
                .links a:hover {
                    background: #5568d3;
                }
                .footer {
                    margin-top: 30px;
                    text-align: center;
                    color: #6b7280;
                    font-size: 14px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 Bihar Education Bot</h1>
                <p class="status">✅ Bot is Running!</p>
                
                <div class="info">
                    <div class="info-item">⏱️ <strong>Uptime:</strong> ${hours}h ${minutes}m</div>
                    <div class="info-item">👥 <strong>Active Users:</strong> ${users.size}</div>
                    <div class="info-item">🔔 <strong>Subscribers:</strong> ${subscribers.size}</div>
                    <div class="info-item">💼 <strong>Total Jobs:</strong> ${biharJobs.length}</div>
                    <div class="info-item">🎓 <strong>Universities:</strong> ${biharUniversities.length}</div>
                    <div class="info-item">📊 <strong>Version:</strong> 6.5</div>
                </div>
                
                <div class="links">
                    <a href="/health">📊 Health Check</a>
                    <a href="/ping">🏓 Ping</a>
                </div>
                
                <div class="footer">
                    <p>🚀 Deployed on Render.com</p>
                    <p>Made with ❤️ for Bihar Students</p>
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
        uptimeFormatted: `${Math.floor(process.uptime()/3600)}h ${Math.floor((process.uptime()%3600)/60)}m`,
        timestamp: new Date().toISOString(),
        users: users.size,
        subscribers: subscribers.size,
        jobs: biharJobs.length,
        universities: biharUniversities.length,
        version: '6.5',
        features: {
            autoScraping: true,
            realTimeNotifications: true,
            subscriptionSystem: true
        }
    });
});

app.get('/ping', (req, res) => {
    res.send('pong');
});

// Start Express server FIRST (before bot)
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Express server running on port ${PORT}`);
    console.log(`🌐 Health endpoint: http://localhost:${PORT}/health`);
});

// ===== INITIALIZE BOT (AFTER SERVER) =====
const bot = new TelegramBot(TOKEN, { 
    polling: {
        interval: 300,
        autoStart: true,
        params: {
            timeout: 10
        }
    }
});

// Polling error handler
bot.on('polling_error', (error) => {
    console.error('⚠️ Polling error:', error.code, error.message);
    // Don't crash on 409 errors
    if (error.code === 'ETELEGRAM' && error.message.includes('409')) {
        console.log('💡 Another bot instance detected. Waiting...');
    }
});

// ===== DATA STORES =====
let users = new Map();
let subscribers = new Map();
let userProfiles = new Map();
let userStates = new Map();
let currentJobView = new Map();
let jobDatabase = new Map();
let lastScrapedJobs = new Map();
let lastUniversityUpdates = new Map();
let resultDatabase = new Map();
let admitCardDatabase = new Map();

// ===== BIHAR JOBS DATA =====
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
        ageLimit: '18-25 years (Relaxation as per rules)',
        applicationFee: 'Gen: ₹450, SC/ST: ₹150',
        selectionProcess: '• Physical Efficiency Test\n• Written Exam\n• Medical Examination',
        applyLink: 'https://csbc.bih.nic.in/',
        notificationPDF: 'https://csbc.bih.nic.in/Advt/ConstableRecruitment-2026.pdf',
        syllabusPDF: 'https://csbc.bih.nic.in/Syllabus/Constable-Syllabus.pdf',
        officialWebsite: 'https://csbc.bih.nic.in/',
        description: 'Bihar Police Constable recruitment for 4128 posts. Apply online.',
        autoScraped: false
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
        notificationPDF: 'https://www.bssc.bihar.gov.in/Advt/GraduateLevel-2026.pdf',
        syllabusPDF: 'https://www.bssc.bihar.gov.in/Syllabus/Graduate-Syllabus.pdf',
        officialWebsite: 'https://www.bssc.bihar.gov.in/',
        description: 'BSSC Graduate level recruitment for 15,230 posts across Bihar.',
        autoScraped: false
    }
];

// ===== TRENDING JOBS =====
const trendingJobs = [
    {
        id: 'trend001',
        title: 'Bihar Police Constable Form (4128 Posts)',
        organization: 'CSBC Bihar',
        posts: 4128,
        category: 'Police',
        lastDate: '15 Mar 2026',
        applyLink: 'https://csbc.bih.nic.in/',
        isFeatured: true
    },
    {
        id: 'trend002',
        title: 'BSSC Graduate Level Combined (15,230 Posts)',
        organization: 'BSSC',
        posts: 15230,
        category: 'SSC',
        lastDate: '20 Mar 2026',
        applyLink: 'https://www.bssc.bihar.gov.in/',
        isFeatured: true
    }
];

// ===== RESULTS DATABASE =====
const biharResults = [
    {
        id: 'res001',
        title: 'BPSSC ASI Steno Marks 2026 - Out',
        organization: 'BPSSC',
        category: 'Result',
        examDate: '25 Jan 2026',
        resultDate: '10 Feb 2026',
        resultLink: 'https://www.bpssc.bih.nic.in/',
        shortTitle: 'BPSSC ASI Steno Marks'
    }
];

// ===== ADMIT CARDS DATABASE =====
const biharAdmitCards = [
    {
        id: 'adm001',
        title: 'Bihar Police Constable Admit Card 2026',
        organization: 'CSBC',
        category: 'Police',
        examDate: '15 Mar 2026',
        releaseDate: '01 Mar 2026',
        admitLink: 'https://csbc.bih.nic.in/',
        shortTitle: 'Bihar Police Admit Card'
    }
];

// ===== UNIVERSITIES DATA =====
const biharUniversities = [
    { id: 1, name: "Aryabhatta Knowledge University", location: "Patna", type: "State University", established: "2008", website: "https://akubihar.ac.in", courses: "Technical Education, Engineering", contact: "0612-2220528", category: "State" },
    { id: 2, name: "Babasaheb Bhimrao Ambedkar Bihar University", location: "Muzaffarpur", type: "State University", established: "1952", website: "https://brabu.net", courses: "Arts, Science, Commerce", contact: "0621-2244010", category: "State" },
    { id: 3, name: "Patna University", location: "Patna", type: "State University", established: "1917", website: "https://patnauniversity.ac.in", courses: "Arts, Science, Engineering", contact: "0612-2223557", category: "State" }
];

// Initialize job database
biharJobs.forEach(job => jobDatabase.set(job.id, job));

// ===== HELPER FUNCTIONS =====
function isAdmin(userId) {
    return ADMIN_IDS.includes(userId.toString());
}

function formatJobDetails(job) {
    return `
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

┌─ ✅ ELIGIBILITY ─────────────┐
│ 🎓 Qualification: ${job.qualification}
│ 📅 Age Limit: ${job.ageLimit}
│ 💰 Salary: ${job.salary}
└──────────────────────────────┘

🌐 *Official Website:* ${job.officialWebsite}

⚠️ *Note:* कृपया official website visit करें।
`;
}

function createJobCard(job, chatId) {
    const message = `
🏛️ *${job.title}*

🏢 *Organization:* ${job.organization}
📂 *Category:* ${job.category}
📌 *Advt No:* ${job.advtNo}
👥 *Posts:* ${job.posts}
📅 *Last Date:* ${job.lastDate}

💰 *Salary:* ${job.salary}
🎓 *Qualification:* ${job.qualification}
📅 *Age Limit:* ${job.ageLimit}
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
            [{text: '🏠 Back to List', callback_data: 'back_to_jobs'}]
        ]
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
            return [{
                text: `${index + 1}. ${job.shortTitle}`,
                callback_data: `view_job_${job.id}`
            }];
        });
        
        jobButtons.push([{text: '🔄 Refresh', callback_data: 'refresh_jobs'}]);
        jobButtons.push([{text: '🏠 Main Menu', callback_data: 'back_to_start'}]);
        
        const keyboard = {inline_keyboard: jobButtons};
        
        const msg = `💼 *Latest Government Jobs*\n\n📅 Updated: ${new Date().toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'})}\n\nClick on any job to view full details:`;
        
        bot.sendMessage(chatId, msg, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
        
    } catch (error) {
        console.error('Error showing jobs:', error);
        bot.sendMessage(chatId, '❌ Error loading jobs. Please try again later.');
    }
}

function showTrendingJobs(chatId) {
    let msg = `🔥 *Trending Jobs - Featured*\n\nTop ${trendingJobs.length} Most Demanded Jobs:\n\n`;
    
    const buttons = [];
    
    trendingJobs.forEach((job, index) => {
        msg += `${index + 1}. *${job.title}*\n`;
        msg += `   👥 Posts: ${job.posts.toLocaleString()}\n`;
        msg += `   📅 Last Date: ${job.lastDate}\n`;
        msg += `   🏢 ${job.organization}\n\n`;
        
        buttons.push([
            {text: `Apply for ${job.posts.toLocaleString()} Posts`, url: job.applyLink}
        ]);
    });
    
    buttons.push([{text: '🏠 Main Menu', callback_data: 'back_to_start'}]);
    
    bot.sendMessage(chatId, msg, {
        parse_mode: 'Markdown',
        reply_markup: {inline_keyboard: buttons}
    });
}

function showResults(chatId, page = 0) {
    if (biharResults.length === 0) {
        return bot.sendMessage(chatId, '❌ No results available at the moment. Please check back later!');
    }
    
    let msg = `📊 *LATEST RESULTS*\n\n🔔 Total Results: *${biharResults.length}*\n\n`;
    
    biharResults.forEach((result, index) => {
        msg += `${index + 1}. [${result.title}](${result.resultLink})\n\n`;
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

function showAdmitCards(chatId, page = 0) {
    if (biharAdmitCards.length === 0) {
        return bot.sendMessage(chatId, '❌ No admit cards available at the moment. Please check back later!');
    }
    
    let msg = `🎫 *LATEST ADMIT CARDS*\n\n🔔 Total Admit Cards: *${biharAdmitCards.length}*\n\n`;
    
    biharAdmitCards.forEach((admit, index) => {
        msg += `${index + 1}. [${admit.title}](${admit.admitLink})\n\n`;
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
        console.log(`✅ New user: ${username} (${chatId})`);
    }
    
    const keyboard = {
        keyboard: [
            ['🔥 ट्रेंडिंग जॉब्स', '🏛️ सरकारी नौकरी'],
            ['📊 रिजल्ट', '🎫 एडमिट कार्ड'],
            ['🎓 विश्वविद्यालय', '👤 प्रोफाइल'],
            ['🔔 सब्सक्राइब', 'ℹ️ हेल्प']
        ],
        resize_keyboard: true
    };
    
    const welcomeMsg = `
🙏 *नमस्कार ${username}!*

*बिहार एजुकेशन बॉट में आपका स्वागत है!* 🎓

📱 *यहाँ आपको मिलेगी:*
🔥 ट्रेंडिंग जॉब्स
🏛️ सरकारी नौकरियां
📊 लेटेस्ट रिजल्ट्स
🎫 एडमिट कार्ड
🎓 यूनिवर्सिटीज

💡 *नीचे के बटन दबाएं या कमांड टाइप करें!*

📌 *Commands:*
/jobs - नौकरियां देखें
/results - रिजल्ट देखें
/admitcards - एडमिट कार्ड
/trending - ट्रेंडिंग जॉब्स
/help - मदद
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

bot.onText(/\/results/, (msg) => {
    showResults(msg.chat.id, 0);
});

bot.onText(/\/admitcards/, (msg) => {
    showAdmitCards(msg.chat.id, 0);
});

bot.onText(/\/help/, (msg) => {
    const helpMsg = `
ℹ️ *Bihar Education Bot - Help*

*Available Commands:*
/start - 🏠 Start the bot
/jobs - 💼 View latest jobs
/trending - 🔥 Trending jobs
/results - 📊 Latest results
/admitcards - 🎫 Admit cards
/subscribe - 🔔 Subscribe to alerts
/help - ℹ️ Get help

*Features:*
• Real-time job notifications
• Government job updates
• Results & admit cards
• Personalized alerts

*Support:*
For queries, contact admin.
`;

    bot.sendMessage(msg.chat.id, helpMsg, {parse_mode: 'Markdown'});
});

// ===== KEYBOARD BUTTON HANDLERS =====
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    if (!text || text.startsWith('/')) return;
    
    switch(text) {
        case '🔥 ट्रेंडिंग जॉब्स':
            showTrendingJobs(chatId);
            break;
        case '🏛️ सरकारी नौकरी':
            showLatestJobs(chatId);
            break;
        case '📊 रिजल्ट':
            showResults(chatId, 0);
            break;
        case '🎫 एडमिट कार्ड':
            showAdmitCards(chatId, 0);
            break;
        case '🎓 विश्वविद्यालय':
            bot.sendMessage(chatId, '🎓 Universities feature coming soon!');
            break;
        case 'ℹ️ हेल्प':
            bot.sendMessage(chatId, '/help');
            break;
    }
});

// ===== CALLBACK QUERY HANDLER =====
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    
    // View job
    if (data.startsWith('view_job_')) {
        const jobId = data.replace('view_job_', '');
        const job = biharJobs.find(j => j.id == jobId);
        
        if (job) {
            const jobCard = createJobCard(job, chatId);
            bot.editMessageText(jobCard.message, {
                chat_id: chatId,
                message_id: query.message.message_id,
                reply_markup: jobCard.keyboard,
                parse_mode: 'Markdown'
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
            const jobCard = createJobCard(job, chatId);
            bot.editMessageText(jobCard.message, {
                chat_id: chatId,
                message_id: query.message.message_id,
                reply_markup: jobCard.keyboard,
                parse_mode: 'Markdown'
            }).catch(() => {});
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
    
    if (data === 'back_to_jobs' || data === 'back_to_start') {
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        showLatestJobs(chatId);
        return bot.answerCallbackQuery(query.id);
    }
    
    bot.answerCallbackQuery(query.id);
});

// ===== ERROR HANDLING =====
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled rejection:', error);
});

// ===== STARTUP MESSAGE =====
console.log('🚀 Bihar Education Bot v6.5 started!');
console.log(`🔧 Admin IDs: ${ADMIN_IDS.join(', ') || 'None'}`);
console.log(`📺 Channel: ${CHANNEL_ID}`);
console.log(`💼 Total Jobs: ${biharJobs.length}`);
console.log(`🎓 Universities: ${biharUniversities.length}`);
console.log('✅ Bot is now running 24/7 on Render!');
