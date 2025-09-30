const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cron = require('node-cron');
require('dotenv').config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_IDS = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',') : [];
const bot = new TelegramBot(TOKEN, { polling: true });
const app = express();

// Storage
let users = new Map();
let subscribers = new Map();
let userProfiles = new Map();
let userStates = new Map();

// Check if user is admin
function isAdmin(userId) {
    return ADMIN_IDS.includes(userId.toString());
}

// Bihar Government Jobs Data
const biharJobs = [
    {
        id: 1,
        title: "BSSC Inter Level Recruitment 2025",
        organization: "Bihar Staff Selection Commission",
        posts: 23175,
        salary: "₹19,900-63,200",
        lastDate: "2025-11-25",
        link: "https://bssc.bihar.gov.in",
        qualification: "12वीं पास"
    },
    {
        id: 2,
        title: "Bihar Police Constable Recruitment",
        organization: "Central Selection Board of Constable",
        posts: 4128,
        salary: "₹21,700-69,100",
        lastDate: "2025-11-05",
        link: "https://csbc.bihar.gov.in",
        qualification: "12वीं पास"
    },
    {
        id: 3,
        title: "BPSC Sub Inspector Recruitment",
        organization: "Bihar Police Subordinate Services",
        posts: 1799,
        salary: "₹35,400-1,12,400",
        lastDate: "2025-10-26",
        link: "https://bpssc.bih.nic.in",
        qualification: "स्नातक"
    },
    {
        id: 4,
        title: "RRB NTPC Bihar Recruitment",
        organization: "Railway Recruitment Board",
        posts: 8850,
        salary: "₹19,900-35,400",
        lastDate: "2025-11-27",
        link: "https://rrbcdg.gov.in",
        qualification: "स्नातक"
    },
    {
        id: 5,
        title: "BSSC Stenographer Recruitment",
        organization: "Bihar Staff Selection Commission",
        posts: 432,
        salary: "₹25,500-81,100",
        lastDate: "2025-11-03",
        link: "https://bssc.bihar.gov.in",
        qualification: "12वीं + Stenography"
    },
    {
        id: 6,
        title: "AIIMS Patna Recruitment 2025",
        organization: "All India Institute of Medical Sciences",
        posts: 50,
        salary: "₹25,000-75,000",
        lastDate: "2025-10-15",
        link: "https://aiimspatna.edu.in",
        qualification: "स्नातक/पोस्ट ग्रेजुएट"
    },
    {
        id: 7,
        title: "BPSC 70th Combined Competitive Exam",
        organization: "Bihar Public Service Commission",
        posts: 2000,
        salary: "₹25,000-80,000",
        lastDate: "2025-12-15",
        link: "https://bpsc.bih.nic.in",
        qualification: "स्नातक (Any Stream)"
    },
    {
        id: 8,
        title: "Bihar Police SI 2025",
        organization: "Bihar Police",
        posts: 2213,
        salary: "₹35,000-1,12,000",
        lastDate: "2025-11-20",
        link: "https://bihar.police.nic.in",
        qualification: "स्नातक"
    }
];

// Bihar Universities Data
const biharUniversities = [
    {
        id: 1,
        name: "Patna University",
        location: "Patna",
        type: "State University",
        established: "1917",
        website: "https://patnauniversity.ac.in",
        courses: "B.A, B.Sc, B.Com, M.A, M.Sc, M.Com, Ph.D",
        contact: "0612-2670208"
    },
    {
        id: 2,
        name: "B.R. Ambedkar Bihar University",
        location: "Muzaffarpur",
        type: "State University",
        established: "1952",
        website: "https://brabu.net",
        courses: "UG, PG, Research Programs",
        contact: "0621-2244010"
    },
    {
        id: 3,
        name: "Magadh University",
        location: "Bodh Gaya",
        type: "State University",
        established: "1962",
        website: "https://magadhuniversity.ac.in",
        courses: "Arts, Science, Commerce, Law",
        contact: "0631-2200491"
    },
    {
        id: 4,
        name: "Jai Prakash University",
        location: "Chapra (Saran)",
        type: "State University",
        established: "1990",
        website: "https://jpv.bih.nic.in",
        courses: "B.A, B.Sc, B.Com, M.A, M.Sc",
        contact: "06152-234401"
    },
    {
        id: 5,
        name: "Tilka Manjhi Bhagalpur University",
        location: "Bhagalpur",
        type: "State University",
        established: "1960",
        website: "https://tmbuniv.ac.in",
        courses: "UG, PG All Streams",
        contact: "0641-2423245"
    },
    {
        id: 6,
        name: "Bihar Agricultural University",
        location: "Sabour, Bhagalpur",
        type: "Agricultural University",
        established: "1960",
        website: "https://bausabour.ac.in",
        courses: "B.Sc Agriculture, M.Sc, Ph.D",
        contact: "06482-226282"
    },
    {
        id: 7,
        name: "AIIMS Patna",
        location: "Patna",
        type: "National Importance",
        established: "2012",
        website: "https://aiimspatna.edu.in",
        courses: "MBBS, MD, MS, Nursing",
        contact: "0612-2451070"
    },
    {
        id: 8,
        name: "IIT Patna",
        location: "Patna",
        type: "National Importance",
        established: "2008",
        website: "https://iitp.ac.in",
        courses: "B.Tech, M.Tech, Ph.D",
        contact: "0612-2552000"
    },
    {
        id: 9,
        name: "NIT Patna",
        location: "Patna",
        type: "National Importance",
        established: "1886",
        website: "https://nitp.ac.in",
        courses: "B.Tech, M.Tech, MCA, MBA",
        contact: "0612-2371715"
    },
    {
        id: 10,
        name: "IIM Bodh Gaya",
        location: "Bodh Gaya",
        type: "National Importance",
        established: "2015",
        website: "https://iimbg.ac.in",
        courses: "MBA, Ph.D",
        contact: "0631-2200238"
    }
];

// Study Materials Data
const studyMaterials = {
    ssc: [
        {
            title: "SSC CGL Complete Material",
            subjects: "Reasoning, Quant, English, GK",
            link: "https://testbook.com/ssc",
            type: "Free + Paid"
        },
        {
            title: "SSC CHSL Preparation Package",
            subjects: "Hindi, English, Maths, GK",
            link: "https://www.sarkariprep.in",
            type: "Mock Tests + Notes"
        },
        {
            title: "SSC Previous Year Papers",
            subjects: "Last 10 Years Solved",
            link: "https://ssc.nic.in",
            type: "Free PDF Downloads"
        }
    ],
    railway: [
        {
            title: "RRB NTPC Study Notes",
            subjects: "Math, Reasoning, GK, Current Affairs",
            link: "https://testbook.com/railway",
            type: "Complete Package"
        },
        {
            title: "Railway Group D Material",
            subjects: "Math, GK, Reasoning, Science",
            link: "https://www.notopedia.com",
            type: "Videos + Practice"
        },
        {
            title: "RRB Previous Papers",
            subjects: "All Railway Exams",
            link: "https://indianrailways.gov.in",
            type: "Free Downloads"
        }
    ],
    bpsc: [
        {
            title: "BPSC Prelims + Mains Notes",
            subjects: "History, Geography, Polity, Economics",
            link: "https://bpsc.bih.nic.in",
            type: "Complete Study Material"
        },
        {
            title: "BPSC Previous Year Papers",
            subjects: "Last 10 Years with Solutions",
            link: "https://sarkaripariksha.com/bpsc",
            type: "PDF Downloads"
        },
        {
            title: "Bihar Special GK",
            subjects: "Bihar History, Geography, Culture",
            link: "https://www.freejobalert.com",
            type: "Free Notes"
        }
    ],
    banking: [
        {
            title: "SBI PO Study Material",
            subjects: "Reasoning, Quant, English, Banking Awareness",
            link: "https://testbook.com/banking",
            type: "Complete Prep"
        },
        {
            title: "IBPS Clerk Preparation",
            subjects: "All Sections + Mock Tests",
            link: "https://www.sarkariprep.in",
            type: "Online Tests"
        },
        {
            title: "Banking Awareness Capsule",
            subjects: "Current Banking Topics",
            link: "https://www.affairscloud.com",
            type: "Monthly Updates"
        }
    ],
    general: [
        {
            title: "Current Affairs 2025",
            subjects: "Daily, Weekly, Monthly CA",
            link: "https://www.affairscloud.com",
            type: "Free Daily Updates"
        },
        {
            title: "General Knowledge Complete",
            subjects: "India GK, World GK, Bihar GK",
            link: "https://data-flair.training/blogs/government-exams-study-material",
            type: "Complete Notes"
        },
        {
            title: "Static GK + Current Affairs",
            subjects: "Combined Package",
            link: "https://www.notopedia.com",
            type: "PDF + Video"
        }
    ]
};

// Upcoming Exams Data
const upcomingExams = [
    {
        id: 1,
        name: "BPSC 70th CCE Prelims",
        date: "2025-12-15",
        daysBeforeAlert: [30, 7, 1]
    },
    {
        id: 2,
        name: "BSSC Inter Level Exam",
        date: "2025-11-25",
        daysBeforeAlert: [15, 3, 1]
    },
    {
        id: 3,
        name: "Bihar Police SI Exam",
        date: "2025-11-20",
        daysBeforeAlert: [10, 3, 1]
    }
];

// Latest Results
const latestResults = [
    {
        id: 1,
        title: "BPSC TRE 3.0 Result",
        date: "2025-09-25",
        link: "https://bpsc.bih.nic.in"
    },
    {
        id: 2,
        title: "Bihar Police SI Result",
        date: "2025-09-20",
        link: "https://bihar.police.nic.in"
    },
    {
        id: 3,
        title: "BSSC Graduate Level Result",
        date: "2025-09-15",
        link: "https://bssc.bihar.gov.in"
    }
];

// Main keyboard
const mainKeyboard = {
    inline_keyboard: [
        [
            { text: '🏛️ सरकारी नौकरी', callback_data: 'govt_jobs' },
            { text: '🎓 विश्वविद्यालय', callback_data: 'universities' }
        ],
        [
            { text: '📝 परीक्षा अपडेट', callback_data: 'exams' },
            { text: '📊 रिजल्ट', callback_data: 'results' }
        ],
        [
            { text: '📚 स्टडी मैटेरियल', callback_data: 'study' },
            { text: '👤 प्रोफाइल', callback_data: 'profile' }
        ]
    ]
};

// ===== SCHEDULED TASKS =====

// Daily Job Alerts (9 AM IST)
cron.schedule('0 9 * * *', () => {
    const todayJobs = biharJobs.slice(0, 3);
    
    let alertMsg = '🔔 **Daily Job Alert - ' + new Date().toLocaleDateString('en-IN') + '**\n\n';
    alertMsg += '📢 आज के Top Government Jobs:\n\n';
    
    todayJobs.forEach((job, index) => {
        alertMsg += `${index + 1}. **${job.title}**\n`;
        alertMsg += `📅 Last Date: ${job.lastDate}\n`;
        alertMsg += `🔗 ${job.link}\n\n`;
    });
    
    alertMsg += '📱 More jobs: /jobs\n';
    alertMsg += '🔕 Stop alerts: /unsubscribe';
    
    subscribers.forEach((data, chatId) => {
        if (data.alerts) {
            bot.sendMessage(chatId, alertMsg, { parse_mode: 'Markdown' })
                .catch(err => console.log(`Failed to send to ${chatId}`));
        }
    });
    
    console.log(`📢 Daily alerts sent to ${subscribers.size} users`);
}, {
    timezone: "Asia/Kolkata"
});

// Exam Reminders (8 AM IST)
cron.schedule('0 8 * * *', () => {
    const today = new Date();
    
    upcomingExams.forEach(exam => {
        const examDate = new Date(exam.date);
        const daysLeft = Math.floor((examDate - today) / (1000 * 60 * 60 * 24));
        
        if (exam.daysBeforeAlert.includes(daysLeft)) {
            const reminderMsg = `⏰ **Exam Reminder!**\n\n📝 ${exam.name}\n📅 Date: ${exam.date}\n⏳ ${daysLeft} days left!\n\n📚 Start preparation: /study`;
            
            subscribers.forEach((data, chatId) => {
                if (data.alerts) {
                    bot.sendMessage(chatId, reminderMsg, { parse_mode: 'Markdown' });
                }
            });
        }
    });
}, {
    timezone: "Asia/Kolkata"
});

// ===== BOT COMMANDS =====

// Start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const welcomeMsg = `🏛️ **बिहार सरकारी नौकरी एवं शिक्षा बॉट v3.0**

नमस्कार ${msg.from.first_name}! 🙏

✨ **Features:**
🔹 8+ Latest Government Jobs
🔹 10 Bihar Universities Info
🔹 Free Study Materials
🔹 Daily Job Alerts
🔹 Exam Reminders
🔹 Result Notifications

📢 Subscribe for alerts: /subscribe
👤 Register: /register

नीचे से option चुनें:`;

    bot.sendMessage(chatId, welcomeMsg, {
        reply_markup: mainKeyboard,
        parse_mode: 'Markdown'
    });
    
    // Track user
    if (!users.has(chatId)) {
        users.set(chatId, {
            name: msg.from.first_name,
            username: msg.from.username,
            joinedAt: new Date()
        });
    }
});

// Help command
bot.onText(/\/help/, (msg) => {
    const helpMsg = `📚 **Available Commands:**

**General:**
/start - मुख्य मेनू
/jobs - सरकारी नौकरी देखें
/universities - विश्वविद्यालय
/study - स्टडी मैटेरियल
/results - ताज़ा रिजल्ट
/exams - आगामी परीक्षाएं

**Alerts:**
/subscribe - Daily alerts चालू करें
/unsubscribe - Alerts बंद करें

**Profile:**
/register - अपनी preferences सेट करें
/savedjobs - Saved jobs देखें
/profile - अपना प्रोफाइल देखें

**Admin (for authorized users):**
/admin - Admin panel
/broadcast - Broadcast message

**Support:**
Contact: @BiharEducationSupport`;

    bot.sendMessage(msg.chat.id, helpMsg, { parse_mode: 'Markdown' });
});

// Jobs command
bot.onText(/\/jobs/, (msg) => {
    let jobsMsg = '🏛️ **Latest Bihar Government Jobs 2025:**\n\n';
    
    biharJobs.forEach((job, index) => {
        jobsMsg += `**${index + 1}. ${job.title}**\n`;
        jobsMsg += `🏢 ${job.organization}\n`;
        jobsMsg += `👥 Posts: ${job.posts}\n`;
        jobsMsg += `💰 Salary: ${job.salary}\n`;
        jobsMsg += `📅 Last Date: ${job.lastDate}\n`;
        jobsMsg += `🎓 Qualification: ${job.qualification}\n`;
        jobsMsg += `🔗 Apply: ${job.link}\n\n`;
    });

    jobsMsg += `📢 **Daily updates:** /subscribe`;

    bot.sendMessage(msg.chat.id, jobsMsg, { parse_mode: 'Markdown' });
});

// Universities command
bot.onText(/\/universities/, (msg) => {
    let univMsg = '🎓 **Bihar Universities & Institutes:**\n\n';
    
    biharUniversities.forEach((univ, index) => {
        univMsg += `**${index + 1}. ${univ.name}**\n`;
        univMsg += `📍 ${univ.location} | ${univ.type}\n`;
        univMsg += `📅 स्थापना: ${univ.established}\n`;
        univMsg += `📚 Courses: ${univ.courses}\n`;
        univMsg += `📞 ${univ.contact}\n`;
        univMsg += `🔗 ${univ.website}\n\n`;
    });

    bot.sendMessage(msg.chat.id, univMsg, { parse_mode: 'Markdown' });
});

// Results command
bot.onText(/\/results/, (msg) => {
    let resultMsg = '📊 **Latest Results:**\n\n';
    
    latestResults.forEach((result, index) => {
        resultMsg += `${index + 1}. **${result.title}**\n`;
        resultMsg += `📅 ${result.date}\n`;
        resultMsg += `🔗 ${result.link}\n\n`;
    });
    
    resultMsg += '🔔 Get instant result alerts: /subscribe';

    bot.sendMessage(msg.chat.id, resultMsg, { parse_mode: 'Markdown' });
});

// Exams command
bot.onText(/\/exams/, (msg) => {
    let examMsg = '📝 **Upcoming Exams:**\n\n';
    
    upcomingExams.forEach((exam, index) => {
        const examDate = new Date(exam.date);
        const today = new Date();
        const daysLeft = Math.floor((examDate - today) / (1000 * 60 * 60 * 24));
        
        examMsg += `${index + 1}. **${exam.name}**\n`;
        examMsg += `📅 Date: ${exam.date}\n`;
        examMsg += `⏳ Days left: ${daysLeft}\n\n`;
    });
    
    examMsg += '⏰ Set reminders: /subscribe';

    bot.sendMessage(msg.chat.id, examMsg, { parse_mode: 'Markdown' });
});

// Subscribe command
bot.onText(/\/subscribe/, (msg) => {
    const chatId = msg.chat.id;
    subscribers.set(chatId, { alerts: true, preferences: [] });
    
    bot.sendMessage(chatId, `✅ **Subscribed Successfully!**\n\nआपको मिलेंगे:
🔔 Daily job alerts (9 AM)
⏰ Exam reminders
📊 Result notifications

/unsubscribe - Stop alerts`, {
        parse_mode: 'Markdown'
    });
});

// Unsubscribe
bot.onText(/\/unsubscribe/, (msg) => {
    const chatId = msg.chat.id;
    subscribers.delete(chatId);
    bot.sendMessage(chatId, '❌ Unsubscribed from all alerts.\n\nSubscribe again: /subscribe');
});

// Register command
bot.onText(/\/register/, (msg) => {
    const chatId = msg.chat.id;
    
    const prefKeyboard = {
        inline_keyboard: [
            [
                { text: '🏛️ BPSC', callback_data: 'pref_bpsc' },
                { text: '📘 SSC', callback_data: 'pref_ssc' }
            ],
            [
                { text: '🚂 Railway', callback_data: 'pref_railway' },
                { text: '🏦 Banking', callback_data: 'pref_banking' }
            ],
            [
                { text: '👨‍🏫 Teaching', callback_data: 'pref_teaching' },
                { text: '🏥 Medical', callback_data: 'pref_medical' }
            ],
            [
                { text: '✅ Done', callback_data: 'pref_done' }
            ]
        ]
    };
    
    bot.sendMessage(chatId, '📝 **User Registration**\n\nअपनी job preferences चुनें:\n(Multiple select कर सकते हैं)', {
        reply_markup: prefKeyboard,
        parse_mode: 'Markdown'
    });
    
    if (!userProfiles.has(chatId)) {
        userProfiles.set(chatId, {
            name: msg.from.first_name,
            preferences: [],
            savedJobs: [],
            examAlerts: []
        });
    }
});

// Profile command
bot.onText(/\/profile/, (msg) => {
    const chatId = msg.chat.id;
    const profile = userProfiles.get(chatId);
    
    if (!profile) {
        return bot.sendMessage(chatId, '❌ Profile not found.\n\nRegister first: /register');
    }
    
    const profileMsg = `👤 **Your Profile**

📛 Name: ${profile.name}
🎯 Preferences: ${profile.preferences.length > 0 ? profile.preferences.join(', ') : 'Not set'}
💾 Saved Jobs: ${profile.savedJobs.length}
🔔 Subscribed: ${subscribers.has(chatId) ? 'Yes ✅' : 'No ❌'}

/savedjobs - View saved jobs
/register - Update preferences`;
    
    bot.sendMessage(chatId, profileMsg, { parse_mode: 'Markdown' });
});

// Saved jobs command
bot.onText(/\/savedjobs/, (msg) => {
    const chatId = msg.chat.id;
    const profile = userProfiles.get(chatId);
    
    if (!profile || profile.savedJobs.length === 0) {
        return bot.sendMessage(chatId, '📭 No saved jobs yet.\n\nSave jobs from /jobs list.');
    }
    
    let savedMsg = '💾 **Your Saved Jobs:**\n\n';
    profile.savedJobs.forEach(jobId => {
        const job = biharJobs.find(j => j.id === jobId);
        if (job) {
            savedMsg += `• **${job.title}**\n`;
            savedMsg += `  📅 Last Date: ${job.lastDate}\n`;
            savedMsg += `  🔗 ${job.link}\n\n`;
        }
    });
    
    bot.sendMessage(chatId, savedMsg, { parse_mode: 'Markdown' });
});

// Admin command
bot.onText(/\/admin/, (msg) => {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Unauthorized. Admin access only.');
    }
    
    const adminKeyboard = {
        inline_keyboard: [
            [
                { text: '📊 Statistics', callback_data: 'admin_stats' },
                { text: '📢 Broadcast', callback_data: 'admin_broadcast' }
            ],
            [
                { text: '👥 Users List', callback_data: 'admin_users' },
                { text: '🔔 Subscribers', callback_data: 'admin_subs' }
            ],
            [
                { text: '🏠 Back to Main', callback_data: 'main_menu' }
            ]
        ]
    };
    
    bot.sendMessage(msg.chat.id, '👨‍💼 **Admin Panel**\n\nChoose an option:', {
        reply_markup: adminKeyboard,
        parse_mode: 'Markdown'
    });
});

// ===== CALLBACK QUERY HANDLER =====

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const userId = query.from.id;

    switch(data) {
        case 'govt_jobs':
            bot.sendMessage(chatId, '🏛️ **सरकारी नौकरी Updates!**\n\nLatest jobs देखने के लिए /jobs command use करें।', {
                parse_mode: 'Markdown'
            });
            break;

        case 'universities':
            bot.sendMessage(chatId, '🎓 **Bihar Universities**\n\nComplete list देखने के लिए /universities command use करें।', {
                parse_mode: 'Markdown'
            });
            break;

        case 'exams':
            bot.sendMessage(chatId, '📝 **Exam Updates**\n\nUpcoming exams देखें: /exams\n⏰ Reminders: /subscribe');
            break;

        case 'results':
            bot.sendMessage(chatId, '📊 **Results Section**\n\nLatest results देखें: /results\n🔔 Instant alerts: /subscribe');
            break;

        case 'study':
            const studyKeyboard = {
                inline_keyboard: [
                    [
                        { text: '📘 SSC Materials', callback_data: 'study_ssc' },
                        { text: '🚂 Railway', callback_data: 'study_railway' }
                    ],
                    [
                        { text: '🏛️ BPSC', callback_data: 'study_bpsc' },
                        { text: '🏦 Banking', callback_data: 'study_banking' }
                    ],
                    [
                        { text: '📰 Current Affairs', callback_data: 'study_general' },
                        { text: '🏠 Main Menu', callback_data: 'main_menu' }
                    ]
                ]
            };
            bot.sendMessage(chatId, '📚 **Study Material Categories:**\n\nअपनी परीक्षा चुनें:', {
                reply_markup: studyKeyboard,
                parse_mode: 'Markdown'
            });
            break;

        case 'study_ssc':
            let sscMsg = '📘 **SSC Study Materials:**\n\n';
            studyMaterials.ssc.forEach((material, index) => {
                sscMsg += `${index + 1}. **${material.title}**\n`;
                sscMsg += `📚 ${material.subjects}\n`;
                sscMsg += `🔗 ${material.link}\n`;
                sscMsg += `📄 ${material.type}\n\n`;
            });
            bot.sendMessage(chatId, sscMsg, { parse_mode: 'Markdown' });
            break;

        case 'study_railway':
            let railMsg = '🚂 **Railway Study Materials:**\n\n';
            studyMaterials.railway.forEach((material, index) => {
                railMsg += `${index + 1}. **${material.title}**\n`;
                railMsg += `📚 ${material.subjects}\n`;
                railMsg += `🔗 ${material.link}\n`;
                railMsg += `📄 ${material.type}\n\n`;
            });
            bot.sendMessage(chatId, railMsg, { parse_mode: 'Markdown' });
            break;

        case 'study_bpsc':
            let bpscMsg = '🏛️ **BPSC Study Materials:**\n\n';
            studyMaterials.bpsc.forEach((material, index) => {
                bpscMsg += `${index + 1}. **${material.title}**\n`;
                bpscMsg += `📚 ${material.subjects}\n`;
                bpscMsg += `🔗 ${material.link}\n`;
                bpscMsg += `📄 ${material.type}\n\n`;
            });
            bot.sendMessage(chatId, bpscMsg, { parse_mode: 'Markdown' });
            break;

        case 'study_banking':
            let bankMsg = '🏦 **Banking Study Materials:**\n\n';
            studyMaterials.banking.forEach((material, index) => {
                bankMsg += `${index + 1}. **${material.title}**\n`;
                bankMsg += `📚 ${material.subjects}\n`;
                bankMsg += `🔗 ${material.link}\n`;
                bankMsg += `📄 ${material.type}\n\n`;
            });
            bot.sendMessage(chatId, bankMsg, { parse_mode: 'Markdown' });
            break;

        case 'study_general':
            let genMsg = '📰 **Current Affairs & GK:**\n\n';
            studyMaterials.general.forEach((material, index) => {
                genMsg += `${index + 1}. **${material.title}**\n`;
                genMsg += `📚 ${material.subjects}\n`;
                genMsg += `🔗 ${material.link}\n`;
                genMsg += `📄 ${material.type}\n\n`;
            });
            bot.sendMessage(chatId, genMsg, { parse_mode: 'Markdown' });
            break;

        case 'profile':
            bot.sendMessage(chatId, '👤 **Your Profile**\n\nView profile: /profile\nRegister: /register\nSaved jobs: /savedjobs');
            break;

        case 'main_menu':
            bot.sendMessage(chatId, '🏠 **Main Menu**\n\nनीचे से option चुनें:', {
                reply_markup: mainKeyboard
            });
            break;

        // Preference callbacks
        case 'pref_bpsc':
        case 'pref_ssc':
        case 'pref_railway':
        case 'pref_banking':
        case 'pref_teaching':
        case 'pref_medical':
            const preference = data.replace('pref_', '');
            const profile = userProfiles.get(chatId) || { preferences: [] };
            
            if (!profile.preferences.includes(preference)) {
                profile.preferences.push(preference);
                userProfiles.set(chatId, profile);
                bot.answerCallbackQuery(query.id, { text: `✅ ${preference.toUpperCase()} added!` });
            } else {
                bot.answerCallbackQuery(query.id, { text: 'Already added!' });
            }
            break;

        case 'pref_done':
            const userProfile = userProfiles.get(chatId);
            bot.sendMessage(chatId, `✅ **Profile Saved!**\n\nYour preferences: ${userProfile.preferences.join(', ')}\n\nYou'll receive relevant job alerts.\n\n/profile - View profile`);
            break;

        // Admin callbacks
        case 'admin_stats':
            if (!isAdmin(userId)) {
                return bot.answerCallbackQuery(query.id, { text: 'Unauthorized!' });
            }
            
            const statsMsg = `📊 **Bot Statistics**

👥 Total Users: ${users.size}
🔔 Subscribers: ${subscribers.size}
👤 Registered: ${userProfiles.size}
🏛️ Jobs Listed: ${biharJobs.length}
🎓 Universities: ${biharUniversities.length}
📝 Upcoming Exams: ${upcomingExams.length}
⏰ Server Uptime: ${Math.floor(process.uptime() / 60)} minutes
📅 Date: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;
            
            bot.sendMessage(chatId, statsMsg, { parse_mode: 'Markdown' });
            break;

        case 'admin_broadcast':
            if (!isAdmin(userId)) {
                return bot.answerCallbackQuery(query.id, { text: 'Unauthorized!' });
            }
            
            bot.sendMessage(chatId, '📢 **Broadcast Message**\n\nSend your message now.\n\nCancel: /cancel');
            userStates.set(chatId, 'awaiting_broadcast');
            break;

        case 'admin_users':
            if (!isAdmin(userId)) {
                return bot.answerCallbackQuery(query.id, { text: 'Unauthorized!' });
            }
            
            let userList = '👥 **Recent Users (Last 10):**\n\n';
            const recentUsers = Array.from(users.entries()).slice(-10);
            recentUsers.forEach(([id, user]) => {
                userList += `• ${user.name} (@${user.username || 'N/A'})\n`;
            });
            
            bot.sendMessage(chatId, userList, { parse_mode: 'Markdown' });
            break;

        case 'admin_subs':
            if (!isAdmin(userId)) {
                return bot.answerCallbackQuery(query.id, { text: 'Unauthorized!' });
            }
            
            bot.sendMessage(chatId, `🔔 **Subscribers:**\n\nTotal: ${subscribers.size}\nActive alerts: ${Array.from(subscribers.values()).filter(s => s.alerts).length}`);
            break;
    }

    bot.answerCallbackQuery(query.id);
});

// Handle broadcast messages
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const state = userStates.get(chatId);
    
    if (state === 'awaiting_broadcast' && isAdmin(msg.from.id)) {
        const broadcastMsg = msg.text;
        let sentCount = 0;
        let failCount = 0;
        
        bot.sendMessage(chatId, '📤 Broadcasting to all users...');
        
        users.forEach((data, userId) => {
            bot.sendMessage(userId, `📢 **Announcement from Admin**\n\n${broadcastMsg}`, { parse_mode: 'Markdown' })
                .then(() => sentCount++)
                .catch(err => {
                    console.log(`Failed to send to ${userId}: ${err.message}`);
                    failCount++;
                });
        });
        
        setTimeout(() => {
            bot.sendMessage(chatId, `✅ **Broadcast Complete!**\n\nSent: ${sentCount}\nFailed: ${failCount}`);
            userStates.delete(chatId);
        }, 3000);
    }
});

// ===== EXPRESS SERVER =====

app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        status: 'Bot is running',
        bot: 'Bihar Education Bot',
        version: '3.0 Advanced',
        features: [
            'Jobs',
            'Universities',
            'Study Materials',
            'Daily Alerts',
            'Exam Reminders',
            'Result Notifications',
            'User Profiles',
            'Admin Panel'
        ],
        stats: {
            users: users.size,
            subscribers: subscribers.size,
            jobs: biharJobs.length,
            universities: biharUniversities.length
        }
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date(),
        uptime: process.uptime()
    });
});

app.get('/stats', (req, res) => {
    res.json({
        users: users.size,
        subscribers: subscribers.size,
        profiles: userProfiles.size,
        jobs: biharJobs.length,
        universities: biharUniversities.length,
        exams: upcomingExams.length,
        uptime: process.uptime()
    });
});

// Error handling
bot.on('error', (error) => {
    console.error('Bot Error:', error);
});

bot.on('polling_error', (error) => {
    console.error('Polling Error:', error);
});

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🌐 Server running on port ${PORT}`);
});

console.log('🏛️ Bihar Education Bot v3.0 Advanced Started!');
console.log('📱 Bot: @BiharEducationBot');
console.log('✅ Features: Jobs, Universities, Study, Alerts, Admin');
console.log('👥 Ready to help Bihar students!');
console.log('🚀 Advanced features enabled!');
