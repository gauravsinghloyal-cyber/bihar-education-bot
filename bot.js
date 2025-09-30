const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
require('dotenv').config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(TOKEN, { polling: true });
const app = express();

// In-memory storage
let users = new Map();

// Bihar Government Jobs Data
const biharJobs = [
    {
        id: 1,
        title: "BPSC 70th Combined Competitive Examination",
        organization: "Bihar Public Service Commission (BPSC)",
        posts: 2000,
        salary: "₹25,000-80,000",
        lastDate: "2025-02-15",
        link: "https://bpsc.bih.nic.in"
    },
    {
        id: 2,
        title: "Bihar Police Sub Inspector Recruitment",
        organization: "Bihar Police",
        posts: 2213,
        salary: "₹35,000-1,12,000",
        lastDate: "2025-02-20",
        link: "https://bihar.police.nic.in"
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

// Start command
bot.onText(/\/start/, (msg) => {
    const welcomeMsg = `🏛️ **बिहार सरकारी नौकरी एवं शिक्षा बॉट**

आपका स्वागत है! 

🔹 Latest Government Jobs
🔹 University Information
🔹 Exam Updates
🔹 Study Materials
🔹 Daily Alerts

नीचे से option चुनें:`;

    bot.sendMessage(msg.chat.id, welcomeMsg, {
        reply_markup: mainKeyboard,
        parse_mode: 'Markdown'
    });
});

// Help command
bot.onText(/\/help/, (msg) => {
    const helpMsg = `📚 **Commands:**

/jobs - सरकारी नौकरी देखें
/university - विश्वविद्यालय
/results - परिणाम
/profile - प्रोफाइल`;

    bot.sendMessage(msg.chat.id, helpMsg, { parse_mode: 'Markdown' });
});

// Jobs command
bot.onText(/\/jobs/, (msg) => {
    let jobsMsg = '🏛️ **Latest Government Jobs:**\n\n';
    
    biharJobs.forEach((job, index) => {
        jobsMsg += `${index + 1}. **${job.title}**\n`;
        jobsMsg += `🏢 ${job.organization}\n`;
        jobsMsg += `👥 Posts: ${job.posts}\n`;
        jobsMsg += `💰 Salary: ${job.salary}\n`;
        jobsMsg += `📅 Last Date: ${job.lastDate}\n`;
        jobsMsg += `🔗 ${job.link}\n\n`;
    });

    bot.sendMessage(msg.chat.id, jobsMsg, { parse_mode: 'Markdown' });
});

// Callback query handler
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    switch(data) {
        case 'govt_jobs':
            bot.sendMessage(chatId, '🏛️ **सरकारी नौकरी** section में आपका स्वागत है!\n\nType /jobs to see latest jobs.');
            break;
        case 'universities':
            bot.sendMessage(chatId, '🎓 **विश्वविद्यालय** information coming soon!');
            break;
        case 'exams':
            bot.sendMessage(chatId, '📝 **Exam Updates** coming soon!');
            break;
        case 'results':
            bot.sendMessage(chatId, '📊 **Results** section coming soon!');
            break;
        case 'study':
            bot.sendMessage(chatId, '📚 **Study Materials** coming soon!');
            break;
        case 'profile':
            bot.sendMessage(chatId, '👤 **Your Profile**\n\nFeature coming soon!');
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
        features: ['Jobs', 'Universities', 'Results', 'Study Material']
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
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Server running on port ${PORT}`);
});

console.log('🏛️ Bihar Education Bot Started!');
console.log('📱 Bot: @BiharEducationBot');
console.log('✅ Ready to help Bihar students!');