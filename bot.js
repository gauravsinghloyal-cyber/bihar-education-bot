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

// ===== RESULTS DATABASE =====
const biharResults = [
    {
        id: 'res001',
        title: 'BPSSC ASI Steno Marks 2025 - Out',
        organization: 'BPSSC',
        category: 'Result',
        examDate: '25 Sept 2025',
        resultDate: '30 Sept 2025',
        resultLink: 'https://www.bpssc.bih.nic.in/',
        shortTitle: 'BPSSC ASI Steno Marks'
    },
    {
        id: 'res002',
        title: 'SSC Selection Phase 13 Answer Key 2025 - Out',
        organization: 'SSC',
        category: 'Answer Key',
        examDate: '20 Sept 2025',
        resultDate: '28 Sept 2025',
        resultLink: 'https://ssc.nic.in/',
        shortTitle: 'SSC Phase 13 Answer Key'
    },
    {
        id: 'res003',
        title: 'Bihar Police CSBC Constable Result 2025 - Out',
        organization: 'CSBC',
        category: 'Result',
        examDate: '15 Sept 2025',
        resultDate: '29 Sept 2025',
        resultLink: 'https://csbc.bih.nic.in/',
        shortTitle: 'Bihar Police CSBC Result'
    },
    {
        id: 'res004',
        title: 'IBPS PO MT XV 15 Pre Result 2025 - Out',
        organization: 'IBPS',
        category: 'Result',
        examDate: '18 Sept 2025',
        resultDate: '27 Sept 2025',
        resultLink: 'https://www.ibps.in/',
        shortTitle: 'IBPS PO Pre Result'
    },
    {
        id: 'res005',
        title: 'Bihar Vidhan Sabha Security Guard 02/2023 Final Result 2025 - Out',
        organization: 'Bihar Vidhan Sabha',
        category: 'Result',
        examDate: '12 Sept 2025',
        resultDate: '25 Sept 2025',
        resultLink: 'https://vidhansabha.bih.nic.in/',
        shortTitle: 'Vidhan Sabha Security Result'
    },
    {
        id: 'res006',
        title: 'UCO Bank SO Final Result 2025 - Out',
        organization: 'UCO Bank',
        category: 'Result',
        examDate: '08 Sept 2025',
        resultDate: '24 Sept 2025',
        resultLink: 'https://www.ucobank.com/',
        shortTitle: 'UCO Bank SO Result'
    },
    {
        id: 'res007',
        title: 'BPSSC Bihar Police Enforcement SI Pre Result 2025 - Out',
        organization: 'BPSSC',
        category: 'Result',
        examDate: '01 Sept 2025',
        resultDate: '22 Sept 2025',
        resultLink: 'https://www.bpssc.bih.nic.in/',
        shortTitle: 'Bihar Police SI Result'
    },
    {
        id: 'res008',
        title: 'PFRDA Assistant Manager Phase-I Result 2025 - Out',
        organization: 'PFRDA',
        category: 'Result',
        examDate: '28 Aug 2025',
        resultDate: '20 Sept 2025',
        resultLink: 'https://www.pfrda.org.in/',
        shortTitle: 'PFRDA Manager Result'
    }
];

// ===== ADMIT CARDS DATABASE =====
        const biharAdmitCards = [
    {
        id: 'adm001',
        title: 'Chandigarh SSA JBT Primary Teacher Admit Card 2025 - Out',
        organization: 'Chandigarh SSA',
        category: 'Teaching',
        examDate: '05 Oct 2025',
        releaseDate: '30 Sept 2025',
        admitLink: 'https://sseachd.gov.in/',
        shortTitle: 'Chandigarh JBT Admit Card'
    },
    {
        id: 'adm002',
        title: 'DSSSB 01-31 October Exam Admit Card 2025 - Out',
        organization: 'DSSSB',
        category: 'Multiple',
        examDate: '01-31 Oct 2025',
        releaseDate: '29 Sept 2025',
        admitLink: 'https://dsssb.delhi.gov.in/',
        shortTitle: 'DSSSB October Exam Admit'
    },
    {
        id: 'adm003',
        title: 'SIDBI Bank Grade A, B Phase-II Admit Card 2025 - Out',
        organization: 'SIDBI',
        category: 'Banking',
        examDate: '10 Oct 2025',
        releaseDate: '28 Sept 2025',
        admitLink: 'https://www.sidbi.in/',
        shortTitle: 'SIDBI Grade A/B Admit'
    },
    {
        id: 'adm004',
        title: 'IB Security Assistant/ Executive Admit Card 2025 - Out',
        organization: 'IB',
        category: 'Security',
        examDate: '12 Oct 2025',
        releaseDate: '27 Sept 2025',
        admitLink: 'https://mha.gov.in/',
        shortTitle: 'IB Security Admit Card'
    },
    {
        id: 'adm005',
        title: 'LIC AAO / AE Pre Admit Card 2025 - Out',
        organization: 'LIC',
        category: 'Insurance',
        examDate: '15 Oct 2025',
        releaseDate: '26 Sept 2025',
        admitLink: 'https://www.licindia.in/',
        shortTitle: 'LIC AAO Pre Admit'
    },
    {
        id: 'adm006',
        title: 'RPSC Assistant Engineer Pre Admit Card 2025 - Out',
        organization: 'RPSC',
        category: 'Engineering',
        examDate: '18 Oct 2025',
        releaseDate: '25 Sept 2025',
        admitLink: 'https://rpsc.rajasthan.gov.in/',
        shortTitle: 'RPSC AE Admit Card'
    },
    {
        id: 'adm007',
        title: 'IBPS Clerk CSA XV Pre Admit Card 2025 - Out',
        organization: 'IBPS',
        category: 'Banking',
        examDate: '20 Oct 2025',
        releaseDate: '23 Sept 2025',
        admitLink: 'https://www.ibps.in/',
        shortTitle: 'IBPS Clerk Admit Card'
    },
    {
        id: 'adm008',
        title: 'Railway RRB Group D Application Status 2025',
        organization: 'RRB',
        category: 'Railway',
        examDate: '25 Oct 2025',
        releaseDate: '22 Sept 2025',
        admitLink: 'https://rrbapply.gov.in/',
        shortTitle: 'RRB Group D Status'
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
        lastDate: '15 Oct 2025',
        applyLink: 'https://csbc.bih.nic.in/',
        isFeatured: true
    },
    {
        id: 'trend002',
        title: 'BSSC Graduate Level Combined (15,230 Posts)',
        organization: 'BSSC',
        posts: 15230,
        category: 'SSC',
        lastDate: '20 Oct 2025',
        applyLink: 'https://www.bssc.bihar.gov.in/',
        isFeatured: true
    },
    {
        id: 'trend003',
        title: 'SSC CPO SI Online Form (2861 Posts)',
        organization: 'SSC',
        posts: 2861,
        category: 'Police',
        lastDate: '18 Oct 2025',
        applyLink: 'https://ssc.nic.in/',
        isFeatured: true
    },
    {
        id: 'trend004',
        title: 'RRB NTPC Graduate Level (35,208 Posts)',
        organization: 'Railway',
        posts: 35208,
        category: 'Railway',
        lastDate: '25 Oct 2025',
        applyLink: 'https://rrbapply.gov.in/',
        isFeatured: true
    },
    {
        id: 'trend005',
        title: 'BPSC 70th CCE Prelims (2041 Posts)',
        organization: 'BPSC',
        posts: 2041,
        category: 'Civil Services',
        lastDate: '12 Oct 2025',
        applyLink: 'https://www.bpsc.bih.nic.in/',
        isFeatured: true
    }
];

// ===== HELPER FUNCTIONS =====
function getJobById(jobId) {
    return [...trendingJobs, ...biharJobs].find(job => job.id === jobId);
}

// ===== HELPER FUNCTIONS =====
function isAdmin(userId) {
    return ADMIN_IDS.includes(userId.toString());
}

// ===== Bihar Jobs Data (UPDATED WITH REAL WORKING LINKS) =====
const biharJobs = [];
   // Load jobs from database on startup
function loadJobsFromDatabase() {
    try {
        if (fs.existsSync('./data/jobs.json')) {
            const jobsData = fs.readFileSync('./data/jobs.json', 'utf8');
            biharJobs = JSON.parse(jobsData);
            console.log(`✅ Loaded ${biharJobs.length} jobs from database`);
        } else {
            console.log('⚠️ No jobs database found. Will fetch from FreeJobAlert.');
        }
    } catch (error) {
        console.error('❌ Error loading jobs:', error);
    }
}

// Initialize on startup
loadJobsFromDatabase();

// ===== Bihar Universities Data =====
const biharUniversities = [
    { id: 1, name: "Aryabhatta Knowledge University", location: "Patna", type: "State University", established: "2008", website: "https://akubihar.ac.in", courses: "Technical Education, Engineering, Architecture", contact: "0612-2220528", category: "State" },
    { id: 2, name: "Babasaheb Bhimrao Ambedkar Bihar University", location: "Muzaffarpur", type: "State University", established: "1952", website: "https://brabu.net", courses: "Arts, Science, Commerce, Law", contact: "0621-2244010", category: "State" },
    { id: 3, name: "Bhupendra Narayan Mandal University", location: "Madhepura", type: "State University", established: "1992", website: "https://bnmu.ac.in", courses: "UG, PG in Arts, Science, Commerce", contact: "06476-222318", category: "State" },
    { id: 4, name: "Bihar Agricultural University", location: "Sabour, Bhagalpur", type: "State Agricultural University", established: "1960", website: "https://bausabour.ac.in", courses: "B.Sc Agriculture, Horticulture, Forestry, M.Sc, Ph.D", contact: "06482-226282", category: "State" },
    { id: 5, name: "Bihar Animal Sciences University", location: "Patna", type: "State Veterinary University", established: "1917", website: "https://basu.org.in", courses: "B.V.Sc, M.V.Sc, Ph.D in Veterinary Sciences", contact: "0612-2223811", category: "State" },
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

// ===== WEB SCRAPING MODULE (IMPROVED) =====

const targetWebsites = [
    {
        name: "BPSC",
        url: "https://www.bpsc.bih.nic.in",
        category: "Civil Services",
        selector: "table.table-bordered tr, marquee a, .notification-list a",
        enabled: true
    },
    {
        name: "BSSC",
        url: "https://www.bssc.bihar.gov.in",
        category: "SSC",
        selector: "table tbody tr, .latest-updates a, #news-scroll a",
        enabled: true
    },
    {
        name: "CSBC",
        url: "https://csbc.bih.nic.in",
        category: "Police",
        selector: "table.table-bordered tr, .whats-new a, .notification a",
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
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Connection': 'keep-alive'
            }
        });

        const $ = cheerio.load(response.data);
        const notifications = [];
        
        // Try different selectors based on site
        let elements = $(site.selector);
        
        elements.each((index, element) => {
            if (index >= 15) return false;
            
            let title = '';
            let link = '';
            
            // Extract from table row
            const $row = $(element);
            if ($row.is('tr')) {
                title = $row.find('td').eq(2).text().trim() || $row.find('td').eq(1).text().trim();
                link = $row.find('a').attr('href');
            } else {
                title = $(element).text().trim();
                link = $(element).attr('href');
            }
            
            // Clean up title
            title = title.replace(/\s+/g, ' ')
                        .replace(/new/gi, '')
                        .replace(/\*/g, '')
                        .replace(/\s+$/g, '')
                        .trim();
            
            if (title && link && title.length > 20) {
                // Make absolute URL
                let fullLink = link;
                if (!link.startsWith('http')) {
                    if (link.startsWith('/')) {
                        const baseUrl = new URL(site.url);
                        fullLink = `${baseUrl.protocol}//${baseUrl.host}${link}`;
                    } else if (link.startsWith('..')) {
                        fullLink = `${site.url}/${link}`;
                    } else {
                        fullLink = `${site.url}/${link}`;
                    }
                }
                
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
                description: `Latest notification from ${site.name}. Visit official website for complete details.`
            }));
            
            newJobs.forEach(job => {
                jobDatabase.set(job.id, job);
                biharJobs.push(job);
            });
            
            allNewJobs.push(...newJobs);
        }
        
        lastScrapedJobs.set(site.name, notifications);
        await new Promise(resolve => setTimeout(resolve, 3000));
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
                    bot.sendMessage(chatId, summaryMsg, { parse_mode: 'Markdown' }).catch(e => console.log(`Error notifying ${chatId}`));
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

// ===== WEB SCRAPING FUNCTIONS =====

async function scrapeFreeJobAlert() {
    try {
        console.log('🔍 Scraping FreeJobAlert.com...');
        const response = await axios.get('https://www.freejobalert.com/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });
        
        const $ = cheerio.load(response.data);
        const scrapedJobs = [];
        const scrapedAdmits = [];
        const scrapedResults = [];
        
        // Scrape Job Notifications
        $('a').each((i, elem) => {
            const text = $(elem).text().trim();
            const link = $(elem).attr('href');
            
            if (text.includes('Online Form') && link && scrapedJobs.length < 15) {
                const postMatch = text.match(/(\d+)\s/);
                const posts = postMatch ? parseInt(postMatch[1]) : 100;
                
                scrapedJobs.push({
                    id: `job_${Date.now()}_${i}`,
                    title: text.replace(/Online Form.*/, '').trim(),
                    shortTitle: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
                    organization: extractOrganization(text),
                    posts: posts,
                    category: 'Government',
                    qualification: 'As per notification',
                    lastDate: 'Check notification',
                    applyLink: link.startsWith('http') ? link : `https://www.freejobalert.com${link}`,
                    postedDate: new Date().toISOString().split('T')[0]
                });
            }
            
            // Scrape Admit Cards
            if (text.includes('Admit Card') && link && scrapedAdmits.length < 10) {
                scrapedAdmits.push({
                    id: `admit_${Date.now()}_${i}`,
                    title: text,
                    shortTitle: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
                    organization: extractOrganization(text),
                    category: 'Government',
                    examDate: 'Check notification',
                    releaseDate: new Date().toISOString().split('T')[0],
                    admitLink: link.startsWith('http') ? link : `https://www.freejobalert.com${link}`
                });
            }
            
            // Scrape Results
            if (text.includes('Result') && link && scrapedResults.length < 10) {
                scrapedResults.push({
                    id: `result_${Date.now()}_${i}`,
                    title: text,
                    shortTitle: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
                    organization: extractOrganization(text),
                    category: 'Government',
                    examDate: 'As per notification',
                    resultDate: new Date().toISOString().split('T')[0],
                    resultLink: link.startsWith('http') ? link : `https://www.freejobalert.com${link}`
                });
            }
        });
        
        console.log(`✅ Scraped: ${scrapedJobs.length} jobs, ${scrapedAdmits.length} admits, ${scrapedResults.length} results`);
        
        return {
            jobs: scrapedJobs,
            admits: scrapedAdmits,
            results: scrapedResults
        };
        
    } catch (error) {
        console.error('❌ Scraping error:', error.message);
        return { jobs: [], admits: [], results: [] };
    }
}

function extractOrganization(text) {
    const orgs = ['RRB', 'SSC', 'UPSC', 'BPSC', 'DSSSB', 'Railway', 'Police', 'Army', 'Navy', 'Air Force', 'Bank', 'IBPS', 'SBI', 'EMRS', 'BEL', 'DDA', 'MPESB', 'WBBPE', 'CSBC'];
    for (const org of orgs) {
        if (text.toUpperCase().includes(org)) return org;
    }
    return 'Government of India';
}

// Auto-update jobs from FreeJobAlert
async function autoUpdateJobs() {
    console.log('🔄 Auto-updating jobs from FreeJobAlert.com...');
    const scraped = await scrapeFreeJobAlert();
    
    let updatedCount = 0;
    
    if (scraped.jobs.length > 0) {
        // Add new jobs to existing database
        scraped.jobs.forEach(job => {
            const exists = biharJobs.find(j => j.title === job.title);
            if (!exists) {
                biharJobs.push(job);
                updatedCount++;
            }
        });
        
        // Keep only latest 25 jobs
        if (biharJobs.length > 25) {
            biharJobs.splice(0, biharJobs.length - 25);
        }
        
        console.log(`✅ Added ${updatedCount} new jobs. Total jobs: ${biharJobs.length}`);
        
        // Notify subscribers about new jobs
        if (updatedCount > 0) {
            const notificationMsg = `🔥 *${updatedCount} New Job(s) Added!*\n\n📌 Check latest updates:\n/jobs - View all jobs\n\n💡 Stay updated with Bihar Education Bot!`;
            notifySubscribers(notificationMsg);
        }
    }
    
    if (scraped.admits.length > 0) {
        scraped.admits.forEach(admit => {
            const exists = biharAdmitCards.find(a => a.title === admit.title);
            if (!exists && biharAdmitCards.length < 15) {
                biharAdmitCards.push(admit);
            }
        });
        console.log(`✅ Admit cards updated. Total: ${biharAdmitCards.length}`);
    }
    
    if (scraped.results.length > 0) {
        scraped.results.forEach(result => {
            const exists = biharResults.find(r => r.title === result.title);
            if (!exists && biharResults.length < 15) {
                biharResults.push(result);
            }
        });
        console.log(`✅ Results updated. Total: ${biharResults.length}`);
    }
}

function notifySubscribers(message) {
    let notified = 0;
    subscribers.forEach((value, chatId) => {
        bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
            .then(() => notified++)
            .catch(() => {});
    });
    console.log(`📢 Notified ${notified} subscribers`);
}

// Schedule auto-update every 6 hours (at 00:00, 06:00, 12:00, 18:00)
cron.schedule('0 */6 * * *', () => {
    console.log('⏰ Scheduled job update triggered...');
    autoUpdateJobs();
});

// Initial scrape on bot start (after 10 seconds)
setTimeout(() => {
    console.log('🚀 Initial data fetch from FreeJobAlert.com...');
    autoUpdateJobs();
}, 10000);

console.log('✅ Auto-scraper initialized! Updates every 6 hours.');


// ===== COMMAND HANDLERS =====

// START COMMAND (UPDATED WITH NEW FEATURES)
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
        console.log(`✅ New user registered: ${username} (${chatId})`);
    }
    
    const keyboard = {
        keyboard: [
            ['🔥 ट्रेंडिंग जॉब्स', '🏛️ सरकारी नौकरी'],
            ['📊 रिजल्ट', '🎫 एडमिट कार्ड'],
            ['🎓 विश्वविद्यालय', '👤 प्रोफाइल'],
            ['🔔 सब्सक्राइब', 'ℹ️ हेल्प']
        ],
        resize_keyboard: true,
        one_time_keyboard: false
    };
    
    const welcomeMsg = `
🙏 *नमस्कार ${username}!*

*बिहार एजुकेशन बॉट में आपका स्वागत है!* 🎓

📱 *यहाँ आपको मिलेगी:*
🔥 ट्रेंडिंग जॉब्स (35,000+ पोस्ट)
🏛️ 10+ सरकारी नौकरियां
📊 8+ लेटेस्ट रिजल्ट्स
🎫 8+ एडमिट कार्ड
🎓 17 यूनिवर्सिटीज

💡 *नीचे के बटन दबाएं या कमांड टाइप करें!*

📌 *Commands:*
/jobs - नौकरियां देखें
/results - रिजल्ट देखें
/admitcards - एडमिट कार्ड
/trending - ट्रेंडिंग जॉब्स
/universities - यूनिवर्सिटीज
`;
    
    bot.sendMessage(chatId, welcomeMsg, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
});

// HANDLE KEYBOARD BUTTONS
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
            showUniversities(chatId);
            break;
        case '👤 प्रोफाइल':
            showUserProfile(chatId, msg.from.id);
            break;
        case '🔔 सब्सक्राइब':
            handleSubscription(chatId, msg.from.id);
            break;
        case 'ℹ️ हेल्प':
            bot.sendMessage(chatId, '/help');
            break;
    }    
    // ===== HANDLE SEARCH QUERIES =====
    if (userStates.get(chatId) === 'awaiting_search') {
        const searchTerm = text.toLowerCase();
        userStates.delete(chatId);
        
        const results = biharJobs.filter(job => 
            job.title.toLowerCase().includes(searchTerm) ||
            job.organization.toLowerCase().includes(searchTerm) ||
            job.category.toLowerCase().includes(searchTerm)
        );
        
        if (results.length === 0) {
            return bot.sendMessage(chatId, `❌ No jobs found for "*${searchTerm}*"\n\nTry different keywords like:\n- Railway\n- SSC\n- Banking\n- Police\n- Teacher`, {parse_mode: 'Markdown'});
        }
        
        let searchMsg = `🔍 *Search Results for "${searchTerm}"*\n\n`;
        searchMsg += `Found *${results.length}* jobs:\n\n`;
        
        results.slice(0, 10).forEach((job, index) => {
            searchMsg += `${index + 1}. *${job.shortTitle}*\n`;
            searchMsg += `👥 ${job.posts} Posts | 🏢 ${job.organization}\n`;
            searchMsg += `📅 Last Date: ${job.lastDate}\n`;
            searchMsg += `🔗 [Apply Here](${job.applyLink})\n\n`;
        });
        
        if (results.length > 10) {
            searchMsg += `\n_Showing top 10 of ${results.length} results_`;
        }
        
        return bot.sendMessage(chatId, searchMsg, {
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
            reply_markup: {
                inline_keyboard: [
                    [{text: '🔍 Search Again', callback_data: 'search_jobs'}],
                    [{text: '📋 All Jobs', callback_data: 'view_latest_jobs'}],
                    [{text: '🏠 Menu', callback_data: 'back_to_start'}]
                ]
            }
        });
    }

});


// HELP COMMAND
// ...existing code...
    

// ===== KEYBOARD BUTTON HANDLERS =====
bot.on('message', function (msg) {
    const text = msg.text;
    /**
     * Unique identifier for the chat where the message was sent.
     * @type {number}
     */
    const chatId = msg.chat.id;

    // Handle feedback state
    if (userStates.get(chatId) === 'awaiting_feedback') {
        ADMIN_IDS.forEach(adminId => {
            // ...existing code...
        });
    }
    // ...existing code...
// ...existing code...bot.onText(/\/help/, (msg) => {
    // Remove redeclaration, use existing chatId from function argument
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

    bot.sendMessage(helpChatId, helpMsg, {parse_mode: 'Markdown'});
});

// ===== ADMIN PANEL COMMANDS =====

// ADMIN MENU
bot.onText(/\/admin/, (msg) => {
    const chatId = msg.chat.id;
    
    if (!isAdmin(msg.from.id)) {
        bot.sendMessage(chatId, '❌ Admin access required!');
        return;
    }
    
    const adminMenu = {
        inline_keyboard: [
            [{text: '📊 View All Jobs', callback_data: 'admin_viewjobs'}],
            [{text: '🔄 Manual Scrape', callback_data: 'admin_scrape'}],
            [{text: '📈 Statistics', callback_data: 'admin_stats'}],
            [{text: '🔗 Test Links', callback_data: 'admin_testlinks'}]
        ]
    };
    
    bot.sendMessage(chatId, `🔐 *Admin Panel*\n\nWelcome ${msg.from.first_name}!\n\n📊 Jobs: ${biharJobs.length}\n👥 Users: ${users.size}\n🔔 Subscribers: ${subscribers.size}\n\nSelect option:`, {
        parse_mode: 'Markdown',
        reply_markup: adminMenu
    });
});

// VIEW ALL JOBS
bot.onText(/\/viewjobs/, (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(msg.from.id)) {
        bot.sendMessage(chatId, '❌ Admin only!');
        return;
    }
    if (biharJobs.length === 0) {
        bot.sendMessage(chatId, '❌ No jobs!');
        return;
    }
    showJobsPage(chatId, 0, 5);
});

function showJobsPage(chatId, page, perPage) {
    const start = page * perPage;
    const end = start + perPage;
    const jobsToShow = biharJobs.slice(start, end);
    const totalPages = Math.ceil(biharJobs.length / perPage);
    
    let msg = `📋 *Jobs (Page ${page + 1}/${totalPages})*\n\nTotal: ${biharJobs.length}\n\n`;
    const buttons = [];
    
    jobsToShow.forEach((job, index) => {
        const globalIndex = start + index;
        msg += `${globalIndex + 1}. ${job.shortTitle}\n   ${job.organization} | ${job.category}\n\n`;
        buttons.push([
            {text: `✏️ Edit #${globalIndex + 1}`, callback_data: `admin_edit_${job.id}`},
            {text: `🗑️ Del #${globalIndex + 1}`, callback_data: `admin_delete_${job.id}`}
        ]);
    });
    
    const navButtons = [];
    if (page > 0) navButtons.push({text: '◀️', callback_data: `admin_page_${page - 1}`});
    navButtons.push({text: `${page + 1}/${totalPages}`, callback_data: 'noop'});
    if (page < totalPages - 1) navButtons.push({text: '▶️', callback_data: `admin_page_${page + 1}`});
    
    if (navButtons.length > 0) buttons.push(navButtons);
    buttons.push([{text: '🏠 Menu', callback_data: 'admin_menu'}]);
    
    bot.sendMessage(chatId, msg, {parse_mode: 'Markdown', reply_markup: {inline_keyboard: buttons}});
}

function showJobEditMenu(chatId, job) {
    bot.sendMessage(chatId, `✏️ *Edit Job*\n\n📋 ${job.title}\n🏢 ${job.organization}\n👥 ${job.posts}\n📅 ${job.lastDate}\n\nEdit feature coming soon!`, {
        parse_mode: 'Markdown',
        reply_markup: {inline_keyboard: [[{text: '⬅️ Back', callback_data: 'admin_viewjobs'}]]}
    });
}

// STATS COMMAND
bot.onText(/\/stats/, (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(msg.from.id)) {
        bot.sendMessage(chatId, '❌ Admin only!');
        return;
    }
    
    const categories = [...new Set(biharJobs.map(j => j.category))];
    const catStats = categories.map(cat => `• ${cat}: ${biharJobs.filter(j => j.category === cat).length}`).join('\n');
    
    bot.sendMessage(chatId, `📊 *Statistics*\n\n👥 Users: ${users.size}\n🔔 Subscribers: ${subscribers.size}\n💼 Jobs: ${biharJobs.length}\n🎓 Unis: ${biharUniversities.length}\n\n*By Category:*\n${catStats}\n\n⚙️ Uptime: ${Math.floor(process.uptime()/60)}m`, {parse_mode: 'Markdown'});
});

// SCRAPE COMMAND  
bot.onText(/\/scrape/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(msg.from.id)) {
        bot.sendMessage(chatId, '❌ Admin only!');
        return;
    }
    
    const loadMsg = await bot.sendMessage(chatId, '🔄 Scraping... Please wait...');
    
    try {
        const newJobs = await checkForNewJobs();
        
        if (newJobs.length > 0) {
            bot.editMessageText(`✅ Found ${newJobs.length} new jobs!\n\nTotal: ${biharJobs.length}`, {
                chat_id: chatId,
                message_id: loadMsg.message_id
            });
            setTimeout(() => showLatestJobs(chatId), 2000);
        } else {
            bot.editMessageText('✅ No new jobs. Database up to date!', {
                chat_id: chatId,
                message_id: loadMsg.message_id
            });
        }
    } catch (error) {
        bot.editMessageText(`❌ Error: ${error.message}`, {
            chat_id: chatId,
            message_id: loadMsg.message_id
        });
    }
});

// TEST LINKS
bot.onText(/\/testlinks/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(msg.from.id)) {
        bot.sendMessage(chatId, '❌ Admin only!');
        return;
    }
    
    bot.sendMessage(chatId, '🔍 Testing websites...');
    
    const sites = [
        {name: 'BPSC', url: 'https://www.bpsc.bih.nic.in/'},
        {name: 'BSSC', url: 'https://www.bssc.bihar.gov.in/'},
        {name: 'CSBC', url: 'https://csbc.bih.nic.in/'}
    ];
    
    for (const site of sites) {
        try {
            const response = await axios.get(site.url, {timeout: 10000});
            bot.sendMessage(chatId, `✅ ${site.name}\nStatus: ${response.status}`);
        } catch (error) {
            bot.sendMessage(chatId, `❌ ${site.name}\nError: ${error.message}`);
        }
        await new Promise(r => setTimeout(r, 1500));
    }
});

// GET MY ID COMMAND
bot.onText(/\/myid/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const isUserAdmin = isAdmin(userId);
    
    let statusEmoji = isUserAdmin ? '🔐' : '👤';
    let statusText = isUserAdmin ? 'Admin ✅' : 'Regular User';
    
    bot.sendMessage(chatId, `
🆔 *Your Telegram Information*

👤 *User ID:* \`${userId}\`
💬 *Chat ID:* \`${chatId}\`
📱 *Username:* @${msg.from.username || 'Not set'}
✏️ *Name:* ${msg.from.first_name} ${msg.from.last_name || ''}

${statusEmoji} *Status:* ${statusText}

${!isUserAdmin ? '💡 *Want admin access?*\nSend your User ID to the bot administrator.' : '✅ You have full admin access to all bot features!'}
`, {parse_mode: 'Markdown'});
});


// ===== RESULTS COMMAND =====
function showResults(chatId, page = 0) {
    if (biharResults.length === 0) {
        return bot.sendMessage(chatId, '❌ No results available at the moment. Please check back later!');
    }
    
    let msg = `📊 *LATEST RESULTS*\n\n`;
    msg += `🔔 Total Results Available: *${biharResults.length}*\n\n`;
    
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
                [{text: '🎫 Admit Cards', callback_data: 'view_admit_cards'}],
                [{text: '🔥 Trending Jobs', callback_data: 'view_trending'}],
                [{text: '🔄 Refresh', callback_data: 'refresh_results'}, {text: '🏠 Menu', callback_data: 'back_to_start'}]
            ]
        }
    });
}



// ===== ADMIT CARDS COMMAND =====
function showAdmitCards(chatId, page = 0) {
    if (biharAdmitCards.length === 0) {
        return bot.sendMessage(chatId, '❌ No admit cards available at the moment. Please check back later!');
    }
    
    let msg = `🎫 *LATEST ADMIT CARDS*\n\n`;
    msg += `🔔 Total Admit Cards: *${biharAdmitCards.length}*\n\n`;
    
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
                [{text: '📊 Latest Results', callback_data: 'view_results'}],
                [{text: '🔥 Trending Jobs', callback_data: 'view_trending'}],
                [{text: '🔄 Refresh', callback_data: 'refresh_admits'}, {text: '🏠 Menu', callback_data: 'back_to_start'}]
            ]
        }
    });
}


// ===== TRENDING JOBS COMMAND =====
bot.onText(/\/trending/, async (msg) => {
    const chatId = msg.chat.id;
    showTrendingJobs(chatId);
});

function showTrendingJobs(chatId) {
    let msg = `🔥 *Trending Jobs - Featured*\n\n`;
    msg += `Top ${trendingJobs.length} Most Demanded Jobs:\n\n`;
    
    const buttons = [];
    
    trendingJobs.forEach((job, index) => {
        msg += `${index + 1}. *${job.title}*\n`;
        msg += `   👥 Posts: ${job.posts.toLocaleString()}\n`;
        msg += `   📅 Last Date: ${job.lastDate}\n`;
        msg += `   🏢 ${job.organization}\n\n`;
        
        buttons.push([
            {text: `🔥 Apply for ${job.posts.toLocaleString()} Posts`, callback_data: `view_trending_${job.id}`}
        ]);
    });
    
    buttons.push([{text: '🏠 Main Menu', callback_data: 'back_to_start'}]);
    
    bot.sendMessage(chatId, msg, {
        parse_mode: 'Markdown',
        reply_markup: {inline_keyboard: buttons}
    });
}



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

// TEST LINKS COMMAND (Admin Only)
bot.onText(/\/testlinks/, async (msg) => {
    const chatId = msg.chat.id;
    
    if (!isAdmin(msg.from.id)) {
        bot.sendMessage(chatId, '❌ Admin only command!');
        return;
    }
    
    bot.sendMessage(chatId, '🔍 Testing website accessibility...');
    
    const testSites = [
        { name: 'BPSC', url: 'https://www.bpsc.bih.nic.in/' },
        { name: 'BSSC', url: 'https://www.bssc.bihar.gov.in/' },
        { name: 'CSBC', url: 'https://csbc.bih.nic.in/' },
        { name: 'BPSSC', url: 'https://bpssc.bih.nic.in/' }
    ];
    
    for (const site of testSites) {
        try {
            const response = await axios.get(site.url, { timeout: 10000 });
            const status = response.status === 200 ? '✅' : '❌';
            bot.sendMessage(chatId, `${status} ${site.name}\nStatus: ${response.status}\nURL: ${site.url}`);
        } catch (error) {
            bot.sendMessage(chatId, `❌ ${site.name}\nError: ${error.message}`);
        }
        await new Promise(r => setTimeout(r, 2000));
    }
});

// MANUAL SCRAPE COMMAND (Admin Only)
bot.onText(/\/scrape/, async (msg) => {
    const chatId = msg.chat.id;
    
    if (!isAdmin(msg.from.id)) {
        bot.sendMessage(chatId, '❌ Admin only command!');
        return;
    }
    
    bot.sendMessage(chatId, '🔄 Starting manual scraping...');
    
    try {
        const newJobs = await checkForNewJobs();
        
        if (newJobs.length > 0) {
            bot.sendMessage(chatId, `✅ Found ${newJobs.length} new jobs!\n\nCategories:\n${[...new Set(newJobs.map(j => j.category))].join('\n')}`, {parse_mode: 'Markdown'});
        } else {
            bot.sendMessage(chatId, 'ℹ️ No new jobs found.');
        }
    } catch (error) {
        bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
});

// ===== CALLBACK QUERY HANDLER =====
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const userId = query.from.id;    // Admin callbacks
    if (data === 'admin_menu') {
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        bot.sendMessage(chatId, '/admin');
        return bot.answerCallbackQuery(query.id);
    }
    
    if (data === 'admin_viewjobs') {
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        showJobsPage(chatId, 0, 5);
        return bot.answerCallbackQuery(query.id);
    }
    
    if (data.startsWith('admin_page_')) {
        const page = parseInt(data.replace('admin_page_', ''));
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        showJobsPage(chatId, page, 5);
        return bot.answerCallbackQuery(query.id);
    }
    
    if (data.startsWith('admin_edit_')) {
        const jobId = data.replace('admin_edit_', '');
        const job = biharJobs.find(j => j.id == jobId);
        if (job) {
            bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
            showJobEditMenu(chatId, job);
        }
        return bot.answerCallbackQuery(query.id);
    }
    
    if (data.startsWith('admin_delete_')) {
        const jobId = data.replace('admin_delete_', '');
        const index = biharJobs.findIndex(j => j.id == jobId);
        if (index !== -1) {
            const deleted = biharJobs[index];
            biharJobs.splice(index, 1);
            jobDatabase.delete(jobId);
            bot.answerCallbackQuery(query.id, {text: '✅ Deleted!', show_alert: true});
            bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
            bot.sendMessage(chatId, `✅ Deleted: ${deleted.shortTitle}`);
            setTimeout(() => showJobsPage(chatId, 0, 5), 1500);
        }
        return;
    }
    
    if (data === 'admin_scrape') {
        bot.answerCallbackQuery(query.id, {text: '🔄 Starting...'});
        bot.sendMessage(chatId, '/scrape');
        return;
    }
    
    if (data === 'admin_stats') {
        bot.answerCallbackQuery(query.id);
        bot.sendMessage(chatId, '/stats');
        return;
    }
    
    if (data === 'admin_testlinks') {
        bot.answerCallbackQuery(query.id);
        bot.sendMessage(chatId, '/testlinks');
        return;
    }


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
        }
        return bot.answerCallbackQuery(query.id);

    // ===== QUICK NAVIGATION CALLBACKS =====
    if (data === 'view_latest_jobs') {
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        showLatestJobs(chatId);
        return bot.answerCallbackQuery(query.id);
    }
    
    if (data === 'view_results') {
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        showResults(chatId, 0);
        return bot.answerCallbackQuery(query.id);
    }
    
    if (data === 'view_admit_cards') {
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        showAdmitCards(chatId, 0);
        return bot.answerCallbackQuery(query.id);
    }
    
    if (data === 'view_trending') {
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        showTrendingJobs(chatId);
        return bot.answerCallbackQuery(query.id);
    }
    
    // ===== REFRESH CALLBACKS =====
    if (data === 'refresh_jobs') {
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        showLatestJobs(chatId);
        return bot.answerCallbackQuery(query.id, {text: '🔄 Jobs refreshed!'});
    }
    
    if (data === 'refresh_results') {
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        showResults(chatId, 0);
        return bot.answerCallbackQuery(query.id, {text: '🔄 Results refreshed!'});
    }
    
    if (data === 'refresh_admits') {
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        showAdmitCards(chatId, 0);
        return bot.answerCallbackQuery(query.id, {text: '🔄 Admit cards refreshed!'});
    }
    
    // ===== SEARCH FEATURE =====
    if (data === 'search_jobs') {
        userStates.set(chatId, 'awaiting_search');
        bot.sendMessage(chatId, '🔍 *Search Jobs*\n\nType job name, organization, or category:\n\n*Examples:*\n- Railway\n- SSC\n- Banking\n- Police\n- Teacher\n- UPSC', {parse_mode: 'Markdown'});
        return bot.answerCallbackQuery(query.id);
    }

    if (data === 'back_to_start') {
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
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
        return;
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
            
    // ===== NEW FEATURE CALLBACKS =====
    
    // Results pagination
    if (data.startsWith('results_page_')) {
        const page = parseInt(data.replace('results_page_', ''));
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        showResults(chatId, page);
        return bot.answerCallbackQuery(query.id);
    }
    
    // View result details
    if (data.startsWith('view_result_')) {
        const resultId = data.replace('view_result_', '');
        const result = biharResults.find(r => r.id === resultId);
        if (result) {
            const detailMsg = `
📊 *${result.title}*

🏢 *Organization:* ${result.organization}
📂 *Category:* ${result.category}
📅 *Exam Date:* ${result.examDate}
🎯 *Result Date:* ${result.resultDate}

🔗 *View Result:* ${result.resultLink}

💡 Click the link to view your result!
`;
            bot.sendMessage(chatId, detailMsg, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{text: '🔗 Open Result Link', url: result.resultLink}],
                        [{text: '⬅️ Back to Results', callback_data: 'back_to_results'}]
                    ]
                }
            });
        }
        return bot.answerCallbackQuery(query.id);
    }
    
    // Admit cards pagination
    if (data.startsWith('admits_page_')) {
        const page = parseInt(data.replace('admits_page_', ''));
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        showAdmitCards(chatId, page);
        return bot.answerCallbackQuery(query.id);
    }
    
    // View admit card details
    if (data.startsWith('view_admit_')) {
        const admitId = data.replace('view_admit_', '');
        const admit = biharAdmitCards.find(a => a.id === admitId);
        if (admit) {
            const detailMsg = `
🎫 *${admit.title}*

🏢 *Organization:* ${admit.organization}
📂 *Category:* ${admit.category}
📅 *Exam Date:* ${admit.examDate}
🔖 *Released:* ${admit.releaseDate}

🔗 *Download Admit Card:* ${admit.admitLink}

💡 Click the link to download your admit card!
`;
            bot.sendMessage(chatId, detailMsg, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{text: '🎫 Download Admit Card', url: admit.admitLink}],
                        [{text: '⬅️ Back to Admit Cards', callback_data: 'back_to_admits'}]
                    ]
                }
            });
        }
        return bot.answerCallbackQuery(query.id);
    }
    
    // View trending job
    if (data.startsWith('view_trending_')) {
        const trendId = data.replace('view_trending_', '');
        const job = trendingJobs.find(j => j.id === trendId);
        if (job) {
            const detailMsg = `
🔥 *${job.title}*

🏢 *Organization:* ${job.organization}
👥 *Total Posts:* ${job.posts.toLocaleString()}
📂 *Category:* ${job.category}
📅 *Last Date:* ${job.lastDate}

🔗 *Apply Link:* ${job.applyLink}

💡 This is one of the most demanded jobs! Apply now!
`;
            bot.sendMessage(chatId, detailMsg, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{text: '🔥 Apply Now', url: job.applyLink}],
                        [{text: '⬅️ Back to Trending', callback_data: 'back_to_trending'}]
                    ]
                }
            });
        }
        return bot.answerCallbackQuery(query.id);
    }
    
    // Back buttons
    if (data === 'back_to_results') {
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        showResults(chatId, 0);
        return bot.answerCallbackQuery(query.id);
    }
    
    if (data === 'back_to_admits') {
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        showAdmitCards(chatId, 0);
        return bot.answerCallbackQuery(query.id);
    }
    
    if (data === 'back_to_trending') {
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        showTrendingJobs(chatId);
        return bot.answerCallbackQuery(query.id);
    }
    
    if (data === 'back_to_start') {
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        bot.sendMessage(chatId, '/start');
        return bot.answerCallbackQuery(query.id);
    }

    bot.answerCallbackQuery(query.id);
}

// ===== KEYBOARD BUTTON HANDLERS =====
bot.on('message', function (msg) {
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
                [{ text: '🏛️ State Universities', callback_data: 'univ_state' }],
                [{ text: '📋 All Universities', callback_data: 'univ_all' }]
            ]
        };
        bot.sendMessage(chatId, '🎓 *Select University Category:*', {
            parse_mode: 'Markdown',
            reply_markup: univKeyboard
        });
    }

    if (text === '📝 परीक्षा अपडेट') {
        bot.sendMessage(chatId, '📝 *Upcoming Exams & Admit Cards*\n\nFeature coming soon!', { parse_mode: 'Markdown' });
    }

    if (text === '📊 रिजल्ट') {
        bot.sendMessage(chatId, '📊 *Latest Results*\n\nFeature coming soon!', { parse_mode: 'Markdown' });
    }

    if (text === '📚 स्टडी मेटेरियल') {
        bot.sendMessage(chatId, '📚 *Study Materials*\n\nFeature coming soon!', { parse_mode: 'Markdown' });
    }

    if (text === '👤 प्रोफाइल') {
        const profile = userProfiles.get(chatId) || { savedJobs: [] };
        const subscription = subscribers.has(chatId) ? '✅ Active' : '❌ Inactive';

        const profileMsg = `👤 *Your Profile*\n\n🆔 User ID: ${chatId}\n💾 Saved Jobs: ${profile.savedJobs.length}\n🔔 Subscription: ${subscription}`;
        bot.sendMessage(chatId, profileMsg, { parse_mode: 'Markdown' });
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
        <hr>
        <h3>Features:</h3>
        <ul>
            <li>✅ 10+ Real Government Jobs</li>
            <li>✅ Auto-scraping every 2 hours</li>
            <li>✅ Real working links</li>
            <li>✅ 17 Bihar Universities</li>
            <li>✅ Subscription system</li>
        </ul>
    `);
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        users: users.size,
        subscribers: subscribers.size,
        jobs: biharJobs.length,
        version: '6.0',
        lastScrape: Array.from(lastScrapedJobs.keys()).map(site => ({
            site,
            count: lastScrapedJobs.get(site).length
        }))
    });
});

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`✅ Bot started successfully!`);
    console.log(`📊 Initial jobs loaded: ${biharJobs.length}`);
    console.log(`🎓 Universities loaded: ${biharUniversities.length}`);
});

// Error handling
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled rejection:', error);
});

bot.on('polling_error', (error) => {
    console.error('❌ Polling error:', error);
});

console.log('🚀 Bihar Education Bot v6.0 initialized!');
console.log(`🔧 Admin IDs: ${ADMIN_IDS.join(', ') || 'None configured'}`);
console.log(`📺 Channel: ${CHANNEL_ID}`);

function showJobEditMenu(chatId, job) {
    bot.sendMessage(chatId, `📝 *Edit Job*\n\n📄 ${job.title}\n🏢 ${job.organization}`, {
        parse_mode: 'Markdown',
        reply_markup: {inline_keyboard: [[{text: '◀️ Back', callback_data: 'admin_viewjobs'}]]}
    });
}
});