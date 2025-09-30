const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cron = require('node-cron');
const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_IDS = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',') : [];
const CHANNEL_ID = process.env.CHANNEL_ID || '@YourChannelUsername';
const bot = new TelegramBot(TOKEN, { polling: true });
const app = express();

let users = new Map();
let subscribers = new Map();
let userProfiles = new Map();
let userStates = new Map();
let currentJobView = new Map();
let jobDatabase = new Map();
let lastScrapedJobs = new Map();
let lastUniversityUpdates = new Map();

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
        description: "CSBC Bihar invites applications for 4128 Constable posts."
    },
    // ... include other job entries similarly ...
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
        description: "BSSC announces 23,175 vacancies for Inter Level posts."
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
        description: "BPSC 70th CCE for 2041 posts."
    }
];

// Bihar Universities Data (Complete list Part 2 में)
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
    // ... rest universities ...
];

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
                importantDates: {
                    applicationStart: new Date().toLocaleDateString('en-IN'),
                    applicationEnd: 'Check notification',
                    examDate: 'TBA',
                    admitCard: 'TBA'
                },
                postDetails: [{ post: 'Various Posts', vacancy: 'See notification', qualification: 'As per notification' }],
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
    if (!CHANNEL_ID) {
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
                if (data.alerts) bot.sendMessage(chatId, summaryMsg, { parse_mode: 'Markdown' });
            });
        } else {
            console.log('ℹ️ No new jobs found.');
        }
    } catch (error) {
        console.error('❌ Scraper error
// ===== CALLBACK QUERY HANDLER =====
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const userId = query.from.id;

    // Job view, navigation, save, share handlers
    if (data.startsWith('view_job_')) {
        const jobId = data.replace('view_job_', '');
        const job = biharJobs.find(j => j.id == jobId);
        if (job) {
            const jobCard = createJobCard(job, chatId);
            currentJobView.set(chatId, biharJobs.findIndex(j => j.id == jobId));
            bot.editMessageText(jobCard.message, {
                chat_id: chatId,
                message_id: query.message.message_id,
                reply_markup: jobCard.keyboard,
                parse_mode: 'Markdown'
            });
        }
    }

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
    }

    // Job detail page
    if (data.startsWith('details_')) {
        const jobId = data.replace('details_', '');
        const job = biharJobs.find(j => j.id == jobId);
        if (job) {
            const fullDetails = createFullDetailsPage(job);
            bot.sendMessage(chatId, fullDetails, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '⬅️ Back to Job Card', callback_data: `view_job_${jobId}` }],
                        [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
                    ]
                }
            });
        }
    }

    // Save job
    if (data.startsWith('save_')) {
        const jobId = data.replace('save_', '');
        const profile = userProfiles.get(chatId) || { name: query.from.first_name, savedJobs: [] };
        if (!profile.savedJobs.includes(jobId)) {
            profile.savedJobs.push(jobId);
            userProfiles.set(chatId, profile);
            bot.answerCallbackQuery(query.id, { text: '✅ Job saved successfully!' });
        } else {
            bot.answerCallbackQuery(query.id, { text: 'Already saved!' });
        }
    }

    // Share job
    if (data.startsWith('share_')) {
        const jobId = data.replace('share_', '');
        const job = biharJobs.find(j => j.id == jobId);
        if (job) {
            const shareMsg = `🏛️ **${job.shortTitle}**\n\n📅 Last Date: ${job.lastDate}\n📝 ${job.applyLink}\n\n🤖 @BiharEducationBot`;
            bot.sendMessage(chatId, shareMsg, { parse_mode: 'Markdown' });
            bot.answerCallbackQuery(query.id, { text: '📤 Share message sent!' });
        }
    }

    // Job categories
    if (data === 'categories') {
        const categories = [...new Set(biharJobs.map(j => j.category))];
        const catButtons = categories.map(cat =>
            [{ text: `${cat} (${biharJobs.filter(j => j.category === cat).length})`, callback_data: `category_${cat}` }]
        );
        catButtons.push([{ text: '🏠 Main Menu', callback_data: 'main_menu' }]);
        bot.editMessageText('📂 **Job Categories:**', {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: { inline_keyboard: catButtons }
        });
    }

    // Main menu
    if (data === 'main_menu') {
        bot.editMessageText('🏠 **Main Menu:**', {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: mainKeyboard
        });
    }

    // University category handlers
    if (data.startsWith('univ_')) {
        const category = data.replace('univ_', '');
        if (category === 'state') {
            const univs = biharUniversities.filter(u => u.category === 'State');
            let msg = `🏛️ **State Universities (${univs.length})**\n\n`;
            univs.forEach((u, i) => {
                msg += `${i + 1}. **${u.name}**\n   📍 ${u.location} | 📅 ${u.established}\n   🔗 ${u.website}\n\n`;
            });
            bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
        } else if (category === 'central') {
            const univs = biharUniversities.filter(u => u.category === 'Central');
            let msg = `🌟 **Central Universities (${univs.length})**\n\n`;
            univs.forEach((u, i) => {
                msg += `${i + 1}. **${u.name}**\n   📍 ${u.location}\n   🔗 ${u.website}\n\n`;
            });
            bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
        } else if (category === 'national') {
            const univs = biharUniversities.filter(u => u.category === 'National');
            let msg = `🎯 **National Institutes (${univs.length})**\n\n`;
            univs.forEach((u, i) => {
                msg += `${i + 1}. **${u.name}**\n   📍 ${u.location}\n   🔗 ${u.website}\n\n`;
            });
            bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
        } else if (category
