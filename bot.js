const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
require('dotenv').config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(TOKEN, { polling: true });
const app = express();

// In-memory storage
let users = new Map();

// Bihar Government Jobs Data (EXPANDED)
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

// Start command
bot.onText(/\/start/, (msg) => {
    const welcomeMsg = `🏛️ **बिहार सरकारी नौकरी एवं शिक्षा बॉट**

नमस्कार! आपका स्वागत है! 🙏

🔹 Latest Government Jobs
🔹 Bihar University Information
🔹 Exam Updates & Results
🔹 Free Study Materials
🔹 Daily Alerts & Notifications

नीचे से option चुनें:`;

    bot.sendMessage(msg.chat.id, welcomeMsg, {
        reply_markup: mainKeyboard,
        parse_mode: 'Markdown'
    });
});

// Help command
bot.onText(/\/help/, (msg) => {
    const helpMsg = `📚 **Available Commands:**

/start - मुख्य मेनू
/jobs - सरकारी नौकरी देखें
/universities - विश्वविद्यालय जानकारी
/study - स्टडी मैटेरियल
/about - बॉट के बारे में

**Need help?**
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

    jobsMsg += `📢 **Daily updates के लिए जुड़े रहें!**`;

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

// Callback query handler
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

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
            bot.sendMessage(chatId, '📝 **Exam Updates**\n\nUpcoming exams:\n• BPSC 70th CCE\n• BSSC Inter Level\n• Railway NTPC\n• SSC CGL 2025\n\nDetails जल्द आएंगे!');
            break;

        case 'results':
            bot.sendMessage(chatId, '📊 **Results Section**\n\nRecent results:\n• BPSC TRE 3.0\n• Bihar SI Result\n• BSSC Results\n\nCheck official websites!');
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
            let genMsg = '📰 **Current Affairs & General Knowledge:**\n\n';
            studyMaterials.general.forEach((material, index) => {
                genMsg += `${index + 1}. **${material.title}**\n`;
                genMsg += `📚 ${material.subjects}\n`;
                genMsg += `🔗 ${material.link}\n`;
                genMsg += `📄 ${material.type}\n\n`;
            });
            bot.sendMessage(chatId, genMsg, { parse_mode: 'Markdown' });
            break;

        case 'profile':
            bot.sendMessage(chatId, '👤 **Your Profile**\n\nFeature coming soon!\n\nYou will be able to:\n• Save favorite jobs\n• Set exam reminders\n• Track applications');
            break;

        case 'main_menu':
            bot.sendMessage(chatId, '🏠 **Main Menu**\n\nनीचे से option चुनें:', {
                reply_markup: mainKeyboard
            });
            break;
    }

    bot.answerCallbackQuery(query.id);
});

// Express server
app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        status: 'Bot is running',
        bot: '@BiharEducationBot',
        features: ['Jobs', 'Universities', 'Study Materials', 'Exam Updates'],
        version: '2.0'
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
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

console.log('🏛️ Bihar Education Bot v2.0 Started!');
console.log('📱 Bot: @BiharEducationBot');
console.log('✅ Ready to help Bihar students!');
console.log('📚 Now with 8 Jobs, 10 Universities, and Study Materials!');
