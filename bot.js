const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cron = require('node-cron');
const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config();

// ===== CONFIGURATION =====
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_IDS = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',') : [];
const CHANNEL_ID = process.env.CHANNEL_ID || '@YourChannelUsername';
const PORT = process.env.PORT || 3000;

const bot = new TelegramBot(TOKEN, { polling: true });
const app = express();

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

// ===== HELPER FUNCTIONS =====
function isAdmin(userId) {
    return ADMIN_IDS.includes(userId.toString());
}

// ===== Bihar Jobs Data =====
const biharJobs = [
    {
        id: 1,
        category: "Police",
        title: "Bihar Police Constable Recruitment 2025",
        shortTitle: "Bihar Police Constable 4128 Posts",
        organization: "CSBC",
        advtNo: "Advt No. 02/2025",
        publishDate: "20-07-2025",
        posts: 4128,
        salary: "₹21,700 - ₹69,100",
        lastDate: "05-11-2025",
        examDate: "15-12-2025",
        qualification: "12वीं पास",
        ageLimit: "18-25 years",
        applicationFee: "₹400 (Gen), ₹100 (BC/EBC), Free (SC/ST/Female)",
        selectionProcess: "Written → PET → Document Verification → Medical",
        applyLink: "https://csbc.bihar.gov.in/main/Apply.aspx",
        notificationPDF: "https://csbc.bihar.gov.in/Advt/02-2025-Constable.pdf",
        syllabusPDF: "https://csbc.bihar.gov.in/Downloads/Syllabus-Constable.pdf",
        officialWebsite: "https://csbc.bihar.gov.in",
        postDetails: [
            { post: "Constable (Male)", vacancy: 3500, qualification: "12th Pass" },
            { post: "Constable (Female)", vacancy: 628, qualification: "12th Pass" }
        ],
        description: "CSBC Bihar invites applications for 4128 Constable posts.",
        scrapedAt: new Date()
    },
    {
        id: 2,
        category: "SSC",
        title: "BSSC Inter Level Combined Competitive Examination 2025",
        shortTitle: "BSSC Inter Level 23,175 Posts",
        organization: "BSSC",
        advtNo: "Advt No. 01/2025",
        publishDate: "15-08-2025",
        posts: 23175,
        salary: "₹19,900 - ₹63,200",
        lastDate: "25-11-2025",
        examDate: "20-01-2026",
        qualification: "12वीं पास",
        ageLimit: "18-37 years",
        applicationFee: "₹450 (Gen), ₹112 (BC/EBC/Female), Free (SC/ST)",
        selectionProcess: "Prelims → Mains → Document Verification",
        applyLink: "https://bssc.bihar.gov.in/online-application",
        notificationPDF: "https://bssc.bihar.gov.in/Advt/01-2025-InterLevel.pdf",
        syllabusPDF: "https://bssc.bihar.gov.in/Syllabus/InterLevel-Syllabus.pdf",
        officialWebsite: "https://bssc.bihar.gov.in",
        postDetails: [
            { post: "Panchayat Sachiv", vacancy: 8415, qualification: "12th Pass" },
            { post: "Revenue Worker", vacancy: 4280, qualification: "12th Pass" }
        ],
        description: "BSSC announces 23,175 vacancies for Inter Level posts.",
        scrapedAt: new Date()
    },
    {
        id: 3,
        category: "Civil Services",
        title: "BPSC 70th Combined Competitive Examination 2025",
        shortTitle: "BPSC 70th CCE - 2000+ Posts",
        organization: "BPSC",
        advtNo: "Advt No. 01/2025",
        publishDate: "01-09-2025",
        posts: 2041,
        salary: "₹25,000 - ₹80,000",
        lastDate: "15-12-2025",
        examDate: "15-02-2026",
        qualification: "स्नातक",
        ageLimit: "20-37 years",
        applicationFee: "₹600 (Gen), ₹150 (BC/EBC/Female), Free (SC/ST)",
        selectionProcess: "Prelims → Mains → Interview",
        applyLink: "https://bpsc.bih.nic.in/Advt/OnlineApp.aspx",
        notificationPDF: "https://bpsc.bih.nic.in/Advt/NCC-Advt-01-2025-70CCE.pdf",
        syllabusPDF: "https://bpsc.bih.nic.in/Syllabus/70-CCE-Syllabus-Detailed.pdf",
        officialWebsite: "https://bpsc.bih.nic.in",
        postDetails: [
            { post: "Deputy Collector", vacancy: 400, qualification: "Graduate" },
            { post: "DSP", vacancy: 200, qualification: "Graduate" },
            { post: "Revenue Officer", vacancy: 500, qualification: "Graduate" }
        ],
        description: "BPSC 70th CCE for 2041 posts.",
        scrapedAt: new Date()
    }
];

// ===== Bihar Universities Data =====
const biharUniversities = [
    { id: 1, name: "Aryabhatta Knowledge University", location: "Patna", type: "State University", established: "2008", website: "https://akubihar.ac.in", courses: "Technical Education, Engineering, Architecture", contact: "0612-2220528", category: "State" },
    { id: 2, name: "Babasaheb Bhimrao Ambedkar Bihar University", location: "Muzaffarpur", type: "State University", established: "1952", website: "https://brabu.net", courses: "Arts, Science, Commerce, Law", contact: "0621-2244010", category: "State" },
    { id: 3, name: "Bhupendra Narayan Mandal University", location: "Madhepura", type: "State University", established: "1992", website: "https://bnmu.ac.in", courses: "UG, PG in Arts, Science, Commerce", contact: "06476-222318", category: "State" },
    { id: 4, name: "Bihar Agricultural University", location: "Sabour, Bhagalpur", type: "State Agricultural University", established: "1960", website: "https://bausabour.ac.in", courses: "B.Sc Agriculture, Horticulture, Forestry, M.Sc, Ph.D", contact: "06482-226282", category: "State" },
    { id: 5, name: "Bihar Animal Sciences University", location: "Patna", type: "State Veterinary University", established: "2017", website: "https://basu.org.in", courses: "B.V.Sc, M.V.Sc, Ph.D in Veterinary Sciences", contact: "0612-2223811", category: "State" },
    { id: 6, name: "Bihar Engineering University", location: "Patna", type: "State Technical University", established: "2019", website: "https://beu.ac.in", courses: "B.Tech, M.Tech in various Engineering branches", contact: "0612-2228978", category: "State" },
    { id: 7, name: "Chanakya National Law University", location: "Patna", type: "State Law University", established: "2006", website: "https://cnlu.ac.in", courses: "BA LLB, BBA LLB, LLM, Ph.D in Law", contact: "0612-2332600", category: "State" },
    { id: 8, name: "Jai Prakash University", location: "Chapra, Saran", type: "State University", established: "1990", website: "https://jpv.bih.nic.in", courses: "Arts, Science, Commerce, Education", contact: "06152-234401", category: "State" },
    { id: 9, name: "Kameshwar Singh Darbhanga Sanskrit University", location: "Darbhanga", type: "State Sanskrit University", established: "1961", website: "https://ksdsu.edu.in", courses: "Sanskrit, Vedic Studies", contact: "06272-222142", category: "State" },
    { id: 10, name: "Lalit Narayan Mithila University", location: "Darbhanga", type: "State University", established: "1972", website: "https://lnmu.ac.in", courses: "Arts, Science, Commerce", contact: "06272-222171", category: "State" },
    { id: 11, name: "Magadh University", location: "Bodh Gaya", type: "State University", established: "1962", website: "https://magadhuniversity.ac.in", courses: "UG, PG, Research in various streams", contact: "0631-2200226", category: "State" },
    { id: 12, name: "Munger University", location: "Munger", type: "State University", established: "2018", website: "https://mungeruniversity.ac.in", courses: "Arts, Science, Commerce", contact: "06344-222111", category: "State" },
    { id: 13, name: "Nalanda Open University", location: "Patna", type: "State Open University", established: "1987", website: "https://nalandaopenuniversity.com", courses: "Distance Learning Programs", contact: "0612-2226171", category: "State" },
    { id: 14, name: "Patna University", location: "Patna", type: "State University", established: "1917", website: "https://patnauniversity.ac.in", courses: "Arts, Science, Commerce, Engineering", contact: "0612-2223557", category: "State" },
    { id: 15, name: "Purnea University", location: "Purnea", type: "State University", established: "2018", website: "https://purneauniversity.ac.in", courses: "UG, PG Programs", contact: "06454-222111", category: "State" },
    { id: 16, name: "Tilka Manjhi Bhagalpur University", location: "Bhagalpur", type: "State University", established: "1960", website: "https://tmbuniv.ac.in", courses: "Arts, Science, Commerce, Law", contact: "0641-2422012", category: "State" },
    { id: 17, name: "Veer Kunwar Singh University", location: "Ara", type: "State University", established: "1992", website: "https://vksuonline.in", courses: "UG, PG in Arts, Science, Commerce", contact: "06182-222046", category: "State" }
];

// Initialize job database
biharJobs.forEach(job => jobDatabase.set(job.id, job));

// ===== WEB SCRAPING MODULE =====

const targetWebsites = [
    {
        name: "BPSC",
        url: "https://bpsc.bih.nic.in",
        category: "Civil Services",
        selector: "table a, .notification a, .latest-updates a, marquee a",
        enabled: true
    },
    {
        name: "BSSC",
        url: "https://bssc.bihar.gov.in",
        category: "SSC",
        selector: ".announcements a, table a, .latest-notifications a",
        enabled: true
    },
    {
        name: "CSBC",
        url: "https://csbc.bihar.gov.in",
        category: "Police",
        selector: ".latest-news a, table a, .notifications a",
        enabled: true
    },
    {
        name: "BPSSC",
        url: "https://bpssc.bih.nic.in",
        category: "Police",
        selector: "table a, .notifications a",
        enabled: true
    }
];

async function scrapeWebsite(site) {
    try {
        console.log(`🔍 Scraping ${site.name}...`);
        
        const response = await axios.get(site.url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(response.data);
        const notifications = [];
        
        $(site.selector).each((index, element) => {
            if (index >= 10) return false;
            
            const title = $(element).text().trim();
            const link = $(element).attr('href');
            
            if (title && link && title.length > 20) {
                const fullLink = link.startsWith('http') ? link : `${site.url}${link}`;
                notifications.push({
                    title: title,
                    link: fullLink,
                    organization: site.name,
                    category: site.category,
                    scrapedAt: new Date()
                });
            }
        });
        
        console.log(`✅ Found ${notifications.length} notifications from ${site.name}`);
        return notifications;
        
    } catch (error) {
        console.error(`❌ Error scraping ${site.name}:`, error.message);
        return [];
    }
}

async function checkForNewJobs() {
    console.log('🔄 Checking for new jobs...');
    const allNewJobs = [];
    
    for (const site of targetWebsites) {
        if (!site.enabled) continue;
        
        const notifications = await scrapeWebsite(site);
        const previousJobs = lastScrapedJobs.get(site.name) || [];
        
        const newNotifications = notifications.filter(notif => 
            !previousJobs.some(prev => prev.title === notif.title)
        );
        
        if (newNotifications.length > 0) {
            console.log(`✅ ${newNotifications.length} new jobs from ${site.name}`);
            
            const newJobs = newNotifications.map(notif => ({
                id: `${site.name}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
                title: notif.title,
                shortTitle: notif.title.substring(0, 70) + (notif.title.length > 70 ? '...' : ''),
                organization: site.name,
                category: site.category,
                posts: 'Check notification',
                advtNo: 'See notification',
                lastDate: 'Check notification',
                publishDate: new Date().toLocaleDateString('en-IN'),
                salary: 'As per norms',
                qualification: 'As per notification',
                ageLimit: 'As per rules',
                applicationFee: 'As per category',
                selectionProcess: 'As per notification',
                applyLink: notif.link,
                notificationPDF: notif.link,
                syllabusPDF: notif.link,
                officialWebsite: site.url,
                autoScraped: true,
                scrapedAt: new Date(),
                description: `Latest notification from ${site.name}. Check official notification for details.`
            }));
            
            newJobs.forEach(job => {
                jobDatabase.set(job.id, job);
                biharJobs.push(job);
            });
            
            allNewJobs.push(...newJobs);
        }
        
        lastScrapedJobs.set(site.name, notifications);
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    return allNewJobs;
}

async function postJobToChannel(job) {
    if (!CHANNEL_ID || CHANNEL_ID === '@YourChannelUsername') {
        console.log('⚠️ CHANNEL_ID not configured');
        return;
    }
    
    try {
        let channelMsg = `🏛️ **NEW JOB ALERT**\n\n`;
        channelMsg += `**${job.title}**\n\n`;
        channelMsg += `**🏢 Organization:** ${job.organization}\n`;
        channelMsg += `**📋 Advt No:** ${job.advtNo}\n`;
        channelMsg += `**👥 Posts:** ${job.posts}\n`;
        channelMsg += `**📅 Last Date:** ${job.lastDate}\n`;
        channelMsg += `**🏷️ Category:** ${job.category}\n\n`;
        channelMsg += `**📄 Details:** ${job.notificationPDF}\n\n`;
        channelMsg += `━━━━━━━━━━━━━━━━━━━━\n`;
        channelMsg += `🤖 @BiharEducationBot - Daily Updates!`;
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📄 Notification PDF', url: job.notificationPDF },
                    { text: '📝 Apply Now', url: job.applyLink }
                ],
                [
                    { text: '🔗 Official Website', url: job.officialWebsite }
                ],
                [
                    { text: '🤖 View in Bot', url: `https://t.me/BiharEducationBot?start=job_${job.id}` }
                ]
            ]
        };
        
        await bot.sendMessage(CHANNEL_ID, channelMsg, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
            disable_web_page_preview: true
        });
        
        console.log(`✅ Posted to channel: ${job.shortTitle}`);
        
    } catch (error) {
        console.error(`❌ Channel posting error:`, error.message);
    }
}

// Scheduled jobs scraper every 2 hours
cron.schedule('0 */2 * * *', async () => {
    console.log('🔄 Running scheduled job scraper...');
    
    try {
        const newJobs = await checkForNewJobs();
        
        if (newJobs.length > 0) {
            console.log(`✅ Found ${newJobs.length} new jobs!`);
            for (const job of newJobs) {
                await postJobToChannel(job);
                await new Promise(r => setTimeout(r, 3000));
            }
            
            // Notify subscribers
            const summaryMsg = `🔔 **${newJobs.length} New Jobs Posted!**\n\nCategories:\n${[...new Set(newJobs.map(j => j.category))].map(cat => `• ${cat}: ${newJobs.filter(j => j.category === cat).length} jobs`).join('\n')}`;
            
            subscribers.forEach((data, chatId) => {
                if (data.alerts) {
                    bot.sendMessage(chatId, summaryMsg, { parse_mode: 'Markdown' });
                }
            });
        } else {
            console.log('ℹ️ No new jobs found.');
        }
    } catch (error) {
        console.error('❌ Scraper error:', error.message);
    }
});

// ===== HELPER FUNCTIONS =====

// Show latest 10 jobs
async function showLatestJobs(chatId) {
    try {
        const latestJobs = biharJobs
            .sort((a, b) => new Date(b.scrapedAt || b.publishDate) - new Date(a.scrapedAt || a.publishDate))
            .slice(0, 10);
        
        if (latestJobs.length === 0) {
            bot.sendMessage(chatId, '❌ No jobs available currently. Please check back later!');
            return;
        }
        
        const jobButtons = latestJobs.map((job, index) => {
            return [{
                text: `${index + 1}. ${job.shortTitle}`,
                callback_data: `view_job_${job.id}`
            }];
        });
        
        jobButtons.push([{text: '🔄 Refresh', callback_data: 'refresh_jobs'}]);
        
        const keyboard = {inline_keyboard: jobButtons};
        
        const msg = `💼 *Latest 10 Government Jobs*\n\n📅 Updated: ${new Date().toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'})}\n\nClick on any job to view full details:`;
        
        bot.sendMessage(chatId, msg, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
        
    } catch (error) {
        console.error('Error showing jobs:', error);
        bot.sendMessage(chatId, '❌ Error loading jobs. Please try again later.');
    }
}

// Create job card
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
            [{text: '📚 Syllabus', url: job.syllabusPDF || job.notificationPDF}],
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
            [{text: '🏠 Back to List', callback_data: 'back_to_jobs'}]
        ]
    };

    return {message, keyboard};
}

// Create full details page
function createFullDetailsPage(job) {
    return `
🏛️ *${job.title}*

📋 *Complete Job Details:*

🏢 *Organization:* ${job.organization}
📂 *Category:* ${job.category}
📌 *Advertisement No:* ${job.advtNo}
👥 *Total Posts:* ${job.posts}
📅 *Publish Date:* ${job.publishDate}
⏰ *Last Date:* ${job.lastDate}

💰 *Salary:* ${job.salary}
🎓 *Qualification:* ${job.qualification}
📅 *Age Limit:* ${job.ageLimit}
💳 *Application Fee:* ${job.applicationFee}

📝 *Selection Process:*
${job.selectionProcess}

📄 *Notification:* ${job.notificationPDF}
📚 *Syllabus:* ${job.syllabusPDF || job.notificationPDF}
🔗 *Apply:* ${job.applyLink}
🌐 *Website:* ${job.officialWebsite}

📋 *Description:*
${job.description || 'Check notification for complete details.'}
`;
}

// ===== COMMAND HANDLERS =====

// START COMMAND
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from.first_name || 'User';
    
    // Register user if not exists
    if (!users.has(chatId)) {
        users.set(chatId, {
            id: chatId,
            username: msg.from.username || 'N/A',
            firstName: firstName,
            joinedAt: new Date()
        });
        console.log(`✅ New user registered: ${firstName} (${chatId})`);
    }
    
    const welcomeMsg = `🏛️ *बिहार सरकारी नौकरी एवं शिक्षा बॉट v6.0*

नमस्कार ${firstName}! 🙏

✨ *Features:*
🔹 25+ Latest Government Jobs
🔹 40+ Bihar Universities Info  
🔹 Free Study Materials
🔹 Real-time Job Alerts (Every 2 Hours)
🔹 Exam Reminders
🔹 Result Notifications
🔹 Auto Scraping from Official Sites

📩 *Subscribe for alerts:* /subscribe
👤 *Register:* /register

नीचे से option चुनें:`;

    const keyboard = {
        keyboard: [
            [{text: '🏛️ सरकारी नौकरी'}, {text: '🎓 विश्वविद्यालय'}],
            [{text: '📝 परीक्षा अपडेट'}, {text: '📊 रिजल्ट'}],
            [{text: '📚 स्टडी मेटेरियल'}, {text: '👤 प्रोफाइल'}],
            [{text: '🔔 Subscribe'}, {text: 'ℹ️ मदद'}]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
    };

    bot.sendMessage(chatId, welcomeMsg, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
});

// HELP COMMAND
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const helpMsg = `
ℹ️ *Bihar Education Bot - Help*

*Available Commands:*
/start - 🏠 Start the bot
/jobs - 💼 View latest jobs
/universities - 🎓 University list
/subscribe - 🔔 Subscribe to alerts
/profile - 👤 View your profile
/help - ℹ️ Get help
/about - ℹ️ About the bot
/feedback - 💬 Send feedback

*Features:*
• Real-time job notifications
• Auto-scraping from official sites
• Save your favorite jobs
• Get personalized alerts

*Support:*
For queries, use /feedback command.
`;

    bot.sendMessage(chatId, helpMsg, {parse_mode: 'Markdown'});
});

// JOBS COMMAND
bot.onText(/\/jobs/, async (msg) => {
    const chatId = msg.chat.id;
    await showLatestJobs(chatId);
});

// UNIVERSITIES COMMAND
bot.onText(/\/universities/, (msg) => {
    const chatId = msg.chat.id;
    const univKeyboard = {
        inline_keyboard: [
            [{text: '🏛️ State Universities', callback_data: 'univ_state'}],
            [{text: '🌟 Central Universities', callback_data: 'univ_central'}],
            [{text: '🎯 National Institutes', callback_data: 'univ_national'}],
            [{text: '🏢 Private Universities', callback_data: 'univ_private'}],
            [{text: '📋 All Universities', callback_data: 'univ_all'}]
        ]
    };
    
    bot.sendMessage(chatId, '🎓 *Select University Category:*', {
        parse_mode: 'Markdown',
        reply_markup: univKeyboard
    });
});

// SUBSCRIBE COMMAND
bot.onText(/\/subscribe/, (msg) => {
    const chatId = msg.chat.id;
    
    if (!subscribers.has(chatId)) {
        subscribers.set(chatId, {
            alerts: true,
            categories: ['all'],
            subscribedAt: new Date()
        });
        
        bot.sendMessage(chatId, '✅ *Subscribed Successfully!*\n\nYou will receive job alerts every 2 hours.\n\nUse /unsubscribe to stop alerts.', {
            parse_mode: 'Markdown'
        });
    } else {
        bot.sendMessage(chatId, 'ℹ️ You are already subscribed!');
    }
});

// UNSUBSCRIBE COMMAND
bot.onText(/\/unsubscribe/, (msg) => {
    const chatId = msg.chat.id;
    
    if (subscribers.has(chatId)) {
        subscribers.delete(chatId);
        bot.sendMessage(chatId, '✅ *Unsubscribed Successfully!*\n\nYou will no longer receive job alerts.\n\nUse /subscribe to re-enable.', {
            parse_mode: 'Markdown'
        });
    } else {
        bot.sendMessage(chatId, 'ℹ️ You are not subscribed!');
    }
});

// PROFILE COMMAND
bot.onText(/\/profile/, (msg) => {
    const chatId = msg.chat.id;
    const profile = userProfiles.get(chatId) || {savedJobs: []};
    const subscription = subscribers.has(chatId) ? '✅ Active' : '❌ Inactive';
    const user = users.get(chatId);
    
    const profileMsg = `
👤 *Your Profile*

🆔 User ID: ${chatId}
👤 Name: ${msg.from.first_name}
📅 Joined: ${user?.joinedAt?.toLocaleDateString('en-IN') || 'N/A'}

💾 Saved Jobs: ${profile.savedJobs.length}
🔔 Subscription: ${subscription}

Use /subscribe to enable job alerts!
`;
    
    bot.sendMessage(chatId, profileMsg, {parse_mode: 'Markdown'});
});

// ABOUT COMMAND
bot.onText(/\/about/, (msg) => {
    const chatId = msg.chat.id;
    const aboutMsg = `
🏛️ *Bihar Education Bot v6.0*

Your trusted companion for Bihar government jobs and education updates!

*📋 Features:*
• 25+ Government job boards monitored
• 40+ Universities covered
• Auto-scraping every 2 hours
• Real-time notifications
• Study materials & syllabus
• Personalized alerts

*📊 Statistics:*
• Total Jobs: ${biharJobs.length}+
• Active Users: ${users.size}
• Subscribers: ${subscribers.size}

*🌐 Covered Organizations:*
BPSC, BSSC, CSBC, BPSSC, and more!

Developed with ❤️ for Bihar Students
`;
    
    bot.sendMessage(chatId, aboutMsg, {parse_mode: 'Markdown'});
});

// FEEDBACK COMMAND
bot.onText(/\/feedback/, (msg) => {
    const chatId = msg.chat.id;
    
    userStates.set(chatId, 'awaiting_feedback');
    
    bot.sendMessage(chatId, '💬 *Feedback*\n\nPlease share your feedback, suggestions, or report issues.\n\nType your message:', {
        parse_mode: 'Markdown'
    });
});

// ===== CALLBACK QUERY HANDLER =====
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const userId = query.from.id;

    // View job
    if (data.startsWith('view_job_')) {
        const jobId = data.replace('view_job_', '');
        const job = biharJobs.find(j => j.id == jobId) || jobDatabase.get(jobId);
        
        if (job) {
            const jobCard = createJobCard(job, chatId);
            currentJobView.set(chatId, biharJobs.findIndex(j => j.id == jobId));
            
            bot.editMessageText(jobCard.message, {
                chat_id: chatId,
                message_id: query.message.message_id,
                reply_markup: jobCard.keyboard,
                parse_mode: 'Markdown'
            }).catch(() => {
                bot.sendMessage(chatId, jobCard.message, {
                    parse_mode: 'Markdown',
                    reply_markup: jobCard.keyboard
                });
            });
        }
        bot.answerCallbackQuery(query.id);
    }

    // Job navigation
    if (data.startsWith('job_next_') || data.startsWith('job_prev_')) {
        const currentIndex = currentJobView.get(chatId) || 0;
        let newIndex = data.startsWith('job_next_') ? currentIndex + 1 : currentIndex - 1;
        
        if (newIndex < 0) newIndex = biharJobs.length - 1;
        if (newIndex >= biharJobs.length) newIndex = 0;
        
        const job = biharJobs[newIndex];
        const jobCard = createJobCard(job, chatId);
        currentJobView.set(chatId, newIndex);
        
        bot.editMessageText(jobCard.message, {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: jobCard.keyboard,
            parse_mode: 'Markdown'
        });
        
        bot.answerCallbackQuery(query.id);
    }

    // Job details
    if (data.startsWith('details_')) {
        const jobId = data.replace('details_', '');
        const job = biharJobs.find(j => j.id == jobId) || jobDatabase.get(jobId);
        
        if (job) {
            const fullDetails = createFullDetailsPage(job);
            bot.sendMessage(chatId, fullDetails, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{text: '📄 Notification', url: job.notificationPDF}],
                        [{text: '🔗 Apply Now', url: job.applyLink}],
                        [{text: '⬅️ Back', callback_data: `view_job_${jobId}`}]
                    ]
                }
            });
        }
        bot.answerCallbackQuery(query.id);
    }

    // Save job
    if (data.startsWith('save_')) {
        const jobId = data.replace('save_', '');
        let profile = userProfiles.get(chatId) || {savedJobs: []};
        
        if (!profile.savedJobs.includes(jobId)) {
            profile.savedJobs.push(jobId);
            userProfiles.set(chatId, profile);
            bot.answerCallbackQuery(query.id, {text: '✅ Job saved successfully!'});
        } else {
            bot.answerCallbackQuery(query.id, {text: 'ℹ️ Already saved!'});
        }
    }

    // Share job
    if (data.startsWith('share_')) {
        const jobId = data.replace('share_', '');
        const job = biharJobs.find(j => j.id == jobId) || jobDatabase.get(jobId);
        
        if (job) {
            const shareMsg = `🏛️ *${job.shortTitle}*\n\n📅 Last Date: ${job.lastDate}\n📝 ${job.applyLink}\n\n🤖 @BiharEducationBot`;
            bot.sendMessage(chatId, shareMsg, {parse_mode: 'Markdown'});
            bot.answerCallbackQuery(query.id, {text: '📤 Share message sent!'});
        }
    }

    // Back to jobs list
    if (data === 'back_to_jobs') {
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        showLatestJobs(chatId);
        bot.answerCallbackQuery(query.id);
    }

    // Refresh jobs
    if (data === 'refresh_jobs') {
        bot.answerCallbackQuery(query.id, {text: '🔄 Refreshing...'});
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        showLatestJobs(chatId);
    }

    // University categories
    if (data.startsWith('univ_')) {
        const category = data.replace('univ_', '');
        
        if (category === 'all') {
            let msg = `🎓 *All Universities in Bihar (${biharUniversities.length})*\n\n`;
            biharUniversities.forEach((u, i) => {
                msg += `${i + 1}. **${u.name}**\n   📍 ${u.location} | 📅 Est. ${u.established}\n   🔗 ${u.website}\n\n`;
            });
            bot.sendMessage(chatId, msg, {parse_mode: 'Markdown'});
        } else if (category === 'state') {
            const univs = biharUniversities.filter(u => u.category === 'State');
            let msg = `🏛️ *State Universities (${univs.length})*\n\n`;
            univs.forEach((u, i) => {
                msg += `${i + 1}. **${u.name}**\n   📍 ${u.location} | 📅 ${u.established}\n   🔗 ${u.website}\n\n`;
            });
            bot.sendMessage(chatId, msg, {parse_mode: 'Markdown'});
        }
        
        bot.answerCallbackQuery(query.id);
    }
});

// ===== KEYBOARD BUTTON HANDLERS =====
bot.on('message', (msg) => {
    const text = msg.text;
    const chatId = msg.chat.id;
    
    // Handle feedback state
    if (userStates.get(chatId) === 'awaiting_feedback') {
        ADMIN_IDS.forEach(adminId => {
            bot.sendMessage(adminId, `📩 *New Feedback from User ${chatId}:*\n\n${text}`, {
                parse_mode: 'Markdown'
            });
        });
        
        bot.sendMessage(chatId, '✅ Thank you for your feedback! We will review it soon.');
        userStates.delete(chatId);
        return;
    }
    
    // Skip if command
    if (!text || text.startsWith('/')) return;
    
    // Handle keyboard buttons
    if (text === '🏛️ सरकारी नौकरी') {
        showLatestJobs(chatId);
    }
    
    if (text === '🎓 विश्वविद्यालय') {
        const univKeyboard = {
            inline_keyboard: [
                [{text: '🏛️ State Universities', callback_data: 'univ_state'}],
                [{text: '📋 All Universities', callback_data: 'univ_all'}]
            ]
        };
        bot.sendMessage(chatId, '🎓 *Select University Category:*', {
            parse_mode: 'Markdown',
            reply_markup: univKeyboard
        });
    }
    
    if (text === '📝 परीक्षा अपडेट') {
        bot.sendMessage(chatId, '📝 *Upcoming Exams & Admit Cards*\n\nFeature coming soon!', {parse_mode: 'Markdown'});
    }
    
    if (text === '📊 रिजल्ट') {
        bot.sendMessage(chatId, '📊 *Latest Results*\n\nFeature coming soon!', {parse_mode: 'Markdown'});
    }
    
    if (text === '📚 स्टडी मेटेरियल') {
        bot.sendMessage(chatId, '📚 *Study Materials*\n\nFeature coming soon!', {parse_mode: 'Markdown'});
    }
    
    if (text === '👤 प्रोफाइल') {
        const profile = userProfiles.get(chatId) || {savedJobs: []};
        const subscription = subscribers.has(chatId) ? '✅ Active' : '❌ Inactive';
        
        const profileMsg = `👤 *Your Profile*\n\n🆔 User ID: ${chatId}\n💾 Saved Jobs: ${profile.savedJobs.length}\n🔔 Subscription: ${subscription}`;
        bot.sendMessage(chatId, profileMsg, {parse_mode: 'Markdown'});
    }
    
    if (text === '🔔 Subscribe') {
        bot.sendMessage(chatId, 'Use /subscribe command to enable alerts!');
    }
    
    if (text === 'ℹ️ मदद') {
        bot.sendMessage(chatId, 'Use /help command for assistance!');
    }
});

// ===== EXPRESS SERVER =====
app.get('/', (req, res) => {
    res.send(`
        <h1>🏛️ Bihar Education Bot v6.0</h1>
        <p>Bot is running successfully!</p>
        <p>Status: <strong>Active</strong></p>
        <p>Users: ${users.size} | Subscribers: ${subscribers.size}</p>
        <p>Jobs: ${biharJobs.length}</p>
    `);
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        users: users.size,
        subscribers: subscribers.size,
        jobs: biharJobs.length
    });
});

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`✅ Bot started successfully!`);
    console.log(`📊 Initial jobs loaded: ${biharJobs.length}`);
});

// Error handling
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled rejection:', error);
});

bot.on('polling_error', (error) => {
    console.error('❌ Polling error:', error);
});

console.log('🚀 Bihar Education Bot v6.0 initialized!');
