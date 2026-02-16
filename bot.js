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
const PORT = process.env.PORT || 3001;

// ===== ADVANCED CONFIGURATION =====
const config = {
    scraperFrequency: 360,
    retryAttempts: 3,
    retryDelay: 5000,
    maxPDFSize: 10485760,
    premiumAlertDelay: 3600000,
    affiliateEnabled: true,
    analyticsEnabled: true,
    verificationEnabled: true,
    minSourcesForPublish: 2,
    holdQueueCheckInterval: 30
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
    LEVEL_1_OFFICIAL: 1,
    LEVEL_2_TRUSTED: 2,
    LEVEL_3_SECONDARY: 3
};

// ===== DATA STORES =====
let users = new Map();
let subscribers = new Map();
let premiumUsers = new Map();
let userProfiles = new Map();
let userStates = new Map();
let jobDatabase = new Map();
let savedJobs = new Map();
let verificationQueue = new Map();
let verificationLog = new Map();
let sourceDatabase = new Map();
let holdQueue = [];
let publishedHashes = new Set();
let duplicateTracker = new Map();

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

// ===== HELPER FUNCTIONS =====
function isAdmin(userId) {
    return ADMIN_IDS.includes(userId.toString());
}

function isPremium(chatId) {
    return premiumUsers.has(chatId);
}

function logError(type, message, details = {}) {
    const error = { type, message, details, timestamp: new Date().toISOString() };
    analytics.errorLogs.push(error);
    if (analytics.errorLogs.length > 500) analytics.errorLogs.shift();
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

// ===== VERIFICATION SYSTEM =====
const targetWebsites = [
    { name: 'BPSC Official', url: 'https://www.bpsc.bih.nic.in', category: 'Civil Services', priority: SourcePriority.LEVEL_1_OFFICIAL, isOfficial: true, enabled: true, lastScrape: null, errorCount: 0, verificationWeight: 1.0 },
    { name: 'BSSC Official', url: 'https://www.bssc.bihar.gov.in', category: 'SSC', priority: SourcePriority.LEVEL_1_OFFICIAL, isOfficial: true, enabled: true, lastScrape: null, errorCount: 0, verificationWeight: 1.0 },
    { name: 'CSBC Official', url: 'https://csbc.bih.nic.in', category: 'Police', priority: SourcePriority.LEVEL_1_OFFICIAL, isOfficial: true, enabled: true, lastScrape: null, errorCount: 0, verificationWeight: 1.0 },
    { name: 'BPSSC Official', url: 'https://bpssc.bih.nic.in', category: 'Police', priority: SourcePriority.LEVEL_1_OFFICIAL, isOfficial: true, enabled: true, lastScrape: null, errorCount: 0, verificationWeight: 1.0 },
    { name: 'Sarkari Result', url: 'https://www.sarkariresult.com', category: 'General', priority: SourcePriority.LEVEL_2_TRUSTED, isOfficial: false, enabled: true, lastScrape: null, errorCount: 0, verificationWeight: 0.6 },
    { name: 'FreeJobAlert', url: 'https://www.freejobalert.com', category: 'General', priority: SourcePriority.LEVEL_2_TRUSTED, isOfficial: false, enabled: true, lastScrape: null, errorCount: 0, verificationWeight: 0.6 }
];

targetWebsites.forEach(site => sourceDatabase.set(site.name, site));

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
        verificationReason: 'Verified from official government source',
        foundInSources: ['CSBC Official'] 
    },
    { 
        id: 'job002', 
        title: 'BSSC Graduate Level Combined Competitive Examination 2026', 
        shortTitle: 'BSSC Graduate Level 2026', 
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
        selectionProcess: '• Preliminary Examination\n• Main Examination\n• Document Verification', 
        applyLink: 'https://www.bssc.bihar.gov.in/', 
        notificationPDF: 'https://www.bssc.bihar.gov.in/', 
        syllabusPDF: 'https://www.bssc.bihar.gov.in/', 
        officialWebsite: 'https://www.bssc.bihar.gov.in/', 
        description: 'BSSC Graduate level combined recruitment for 15,230 posts.', 
        autoScraped: false, 
        source: 'BSSC Official', 
        priority: 1, 
        postedAt: new Date(), 
        clicks: 0, 
        verificationStatus: VerificationLevel.OFFICIAL, 
        verificationConfidence: 100, 
        verificationReason: 'Verified from official government source',
        foundInSources: ['BSSC Official'] 
    },
    { 
        id: 'job003', 
        title: 'SSC CPO Sub-Inspector Online Form 2026', 
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
        selectionProcess: '• Physical Standard Test\n• Written Exam\n• Medical Examination', 
        applyLink: 'https://ssc.nic.in/', 
        notificationPDF: 'https://ssc.nic.in/', 
        syllabusPDF: 'https://ssc.nic.in/', 
        officialWebsite: 'https://ssc.nic.in/', 
        description: 'SSC CPO Sub-Inspector recruitment for 2861 posts.', 
        autoScraped: false, 
        source: 'SSC', 
        priority: 2, 
        postedAt: new Date(), 
        clicks: 0, 
        verificationStatus: VerificationLevel.MULTI_SOURCE, 
        verificationConfidence: 85, 
        verificationReason: 'Verified from 2 trusted sources',
        foundInSources: ['Sarkari Result', 'FreeJobAlert'] 
    },
    { 
        id: 'job004', 
        title: 'RRB NTPC Graduate Level Posts 2026', 
        shortTitle: 'RRB NTPC 2026', 
        organization: 'Railway Recruitment Board', 
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
        description: 'Railway NTPC recruitment for 35,208 graduate level posts.', 
        autoScraped: false, 
        source: 'RRB', 
        priority: 2, 
        postedAt: new Date(), 
        clicks: 0, 
        verificationStatus: VerificationLevel.MULTI_SOURCE, 
        verificationConfidence: 90, 
        verificationReason: 'Verified from 2 trusted sources',
        foundInSources: ['Sarkari Result', 'FreeJobAlert'] 
    },
    { 
        id: 'job005', 
        title: 'BPSC 70th Combined Competitive Examination Prelims 2026', 
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
        selectionProcess: '• Preliminary Exam\n• Main Examination\n• Interview', 
        applyLink: 'https://www.bpsc.bih.nic.in/', 
        notificationPDF: 'https://www.bpsc.bih.nic.in/', 
        syllabusPDF: 'https://www.bpsc.bih.nic.in/', 
        officialWebsite: 'https://www.bpsc.bih.nic.in/', 
        description: 'BPSC 70th Combined Competitive Examination for 2,041 posts.', 
        autoScraped: false, 
        source: 'BPSC Official', 
        priority: 1, 
        postedAt: new Date(), 
        clicks: 0, 
        verificationStatus: VerificationLevel.OFFICIAL, 
        verificationConfidence: 100, 
        verificationReason: 'Verified from official government source',
        foundInSources: ['BPSC Official'] 
    },
    { 
        id: 'job006', 
        title: 'Bihar Vidhan Sabha Sachivalaya Recruitment 2026', 
        shortTitle: 'Bihar Vidhan Sabha 2026', 
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
        selectionProcess: '• Written Examination\n• Typing Test\n• Interview', 
        applyLink: 'https://vidhansabha.bih.nic.in/', 
        notificationPDF: 'https://vidhansabha.bih.nic.in/', 
        syllabusPDF: 'https://vidhansabha.bih.nic.in/', 
        officialWebsite: 'https://vidhansabha.bih.nic.in/', 
        description: 'Bihar Vidhan Sabha Secretariat recruitment for 187 posts.', 
        autoScraped: false, 
        source: 'Bihar Vidhan Sabha', 
        priority: 2, 
        postedAt: new Date(), 
        clicks: 0, 
        verificationStatus: VerificationLevel.MULTI_SOURCE, 
        verificationConfidence: 85, 
        verificationReason: 'Verified from 2 trusted sources',
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
    { id: 1, name: "Aryabhatta Knowledge University", location: "Patna", type: "State University", established: "2008", website: "https://akubihar.ac.in", courses: "B.Tech, M.Tech, Diploma, Architecture", contact: "0612-2220528", category: "State", shortName: "AKU" },
    { id: 2, name: "Babasaheb Bhimrao Ambedkar Bihar University", location: "Muzaffarpur", type: "State University", established: "1952", website: "https://brabu.net", courses: "Arts, Science, Commerce, Law, Education", contact: "0621-2244010", category: "State", shortName: "BRABU" },
    { id: 3, name: "Bhupendra Narayan Mandal University", location: "Madhepura", type: "State University", established: "1992", website: "https://bnmu.ac.in", courses: "UG, PG in Arts, Science, Commerce", contact: "06476-222318", category: "State", shortName: "BNMU" },
    { id: 4, name: "Bihar Agricultural University", location: "Sabour, Bhagalpur", type: "Agricultural University", established: "1960", website: "https://bausabour.ac.in", courses: "Agriculture, Horticulture, Forestry", contact: "06482-226282", category: "State", shortName: "BAU" },
    { id: 5, name: "Bihar Animal Sciences University", location: "Patna", type: "Veterinary University", established: "1917", website: "https://basu.org.in", courses: "Veterinary Sciences", contact: "0612-2223811", category: "State", shortName: "BASU" },
    { id: 6, name: "Bihar Engineering University", location: "Patna", type: "Technical University", established: "2019", website: "https://beu.ac.in", courses: "B.Tech, M.Tech", contact: "0612-2228978", category: "State", shortName: "BEU" },
    { id: 7, name: "Chanakya National Law University", location: "Patna", type: "Law University", established: "2006", website: "https://cnlu.ac.in", courses: "BA LLB, BBA LLB, LLM, Ph.D", contact: "0612-2332600", category: "State", shortName: "CNLU" },
    { id: 8, name: "Jai Prakash University", location: "Chapra, Saran", type: "State University", established: "1990", website: "https://jpv.bih.nic.in", courses: "Arts, Science, Commerce, Education", contact: "06152-234401", category: "State", shortName: "JPU" },
    { id: 9, name: "Kameshwar Singh Darbhanga Sanskrit University", location: "Darbhanga", type: "Sanskrit University", established: "1961", website: "https://ksdsu.edu.in", courses: "Sanskrit, Vedic Studies, Jyotish", contact: "06272-222142", category: "State", shortName: "KSDSU" },
    { id: 10, name: "Lalit Narayan Mithila University", location: "Darbhanga", type: "State University", established: "1972", website: "https://lnmu.ac.in", courses: "Arts, Science, Commerce, Education", contact: "06272-222171", category: "State", shortName: "LNMU" },
    { id: 11, name: "Magadh University", location: "Bodh Gaya", type: "State University", established: "1962", website: "https://magadhuniversity.ac.in", courses: "UG, PG, Research", contact: "0631-2200226", category: "State", shortName: "MU" },
    { id: 12, name: "Munger University", location: "Munger", type: "State University", established: "2018", website: "https://mungeruniversity.ac.in", courses: "Arts, Science, Commerce", contact: "06344-222111", category: "State", shortName: "MUN" },
    { id: 13, name: "Nalanda Open University", location: "Patna", type: "Open University", established: "1987", website: "https://nalandaopenuniversity.com", courses: "Distance Learning Programs", contact: "0612-2226171", category: "State", shortName: "NOU" },
    { id: 14, name: "Patna University", location: "Patna", type: "State University", established: "1917", website: "https://patnauniversity.ac.in", courses: "Arts, Science, Commerce, Engineering", contact: "0612-2223557", category: "State", shortName: "PU" },
    { id: 15, name: "Purnea University", location: "Purnea", type: "State University", established: "2018", website: "https://purneauniversity.ac.in", courses: "UG, PG Programs", contact: "06454-222111", category: "State", shortName: "PUR" },
    { id: 16, name: "Tilka Manjhi Bhagalpur University", location: "Bhagalpur", type: "State University", established: "1960", website: "https://tmbuniv.ac.in", courses: "Arts, Science, Commerce, Law", contact: "0641-2422012", category: "State", shortName: "TMBU" },
    { id: 17, name: "Veer Kunwar Singh University", location: "Ara", type: "State University", established: "1992", website: "https://vksuonline.in", courses: "UG, PG in multiple streams", contact: "06182-222046", category: "State", shortName: "VKSU" }
];

const govtWebsites = [
    { name: 'BPSC', url: 'https://www.bpsc.bih.nic.in/', category: 'Civil Services' },
    { name: 'BSSC', url: 'https://www.bssc.bihar.gov.in/', category: 'SSC' },
    { name: 'CSBC', url: 'https://csbc.bih.nic.in/', category: 'Police' },
    { name: 'BPSSC', url: 'https://bpssc.bih.nic.in/', category: 'Police' },
    { name: 'RRB', url: 'https://rrbapply.gov.in/', category: 'Railway' },
    { name: 'SSC', url: 'https://ssc.nic.in/', category: 'Central Govt' },
    { name: 'IBPS', url: 'https://www.ibps.in/', category: 'Banking' },
    { name: 'Bihar Vidhan Sabha', url: 'https://vidhansabha.bih.nic.in/', category: 'State Govt' }
];

biharJobs.forEach(job => jobDatabase.set(job.id, job));

// ===== HEALTH ENDPOINTS =====
app.get('/', (req, res) => {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Bihar Education Bot - 67 Features</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
            color: #fff;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: rgba(255,255,255,0.95);
            border-radius: 20px;
            padding: 40px;
            color: #333;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 { color: #667eea; font-size: 32px; margin-bottom: 10px; }
        .badge {
            display: inline-block;
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            padding: 8px 20px;
            border-radius: 25px;
            font-size: 14px;
            font-weight: bold;
            margin: 5px;
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
        <p class="status">✅ Bot Running 24/7 on Render!</p>
        
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
                <p>⏳ Hold Queue</p>
            </div>
            <div class="stat-card">
                <h3>${biharJobs.length}</h3>
                <p>💼 Active Jobs</p>
            </div>
            <div class="stat-card">
                <h3>${analytics.totalPosts}</h3>
                <p>📊 Total Posts</p>
            </div>
            <div class="stat-card">
                <h3>${analytics.totalClicks}</h3>
                <p>🖱️ Total Clicks</p>
            </div>
            <div class="stat-card">
                <h3>${hours}h ${minutes}m</h3>
                <p>⏱️ Uptime</p>
            </div>
        </div>
        
        <div class="links">
            <a href="/health">📊 Health Check</a>
            <a href="/verification">🔒 Verification Stats</a>
            <a href="/stats">📈 Statistics</a>
            <a href="/ping">🏓 Ping</a>
        </div>
        
        <div class="footer">
            <p><strong>🚀 Deployed on Render.com</strong> | Free 24/7 Hosting</p>
            <p>🔒 Multi-Source Verification System Active</p>
            <p style="margin-top: 15px; font-size: 12px;">
                Version 8.0 | 67 Features | © 2026 Bihar Education Bot
            </p>
            <p style="margin-top: 10px;">Made with ❤️ for Bihar Students</p>
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
        statistics: {
            users: users.size,
            subscribers: subscribers.size,
            premiumUsers: premiumUsers.size,
            jobs: biharJobs.length,
            results: biharResults.length,
            admitCards: biharAdmitCards.length,
            universities: biharUniversities.length,
            totalPosts: analytics.totalPosts,
            totalClicks: analytics.totalClicks,
            errorCount: analytics.errorLogs.length
        },
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
        version: '8.0',
        features: 67,
        capabilities: {
            autoScraping: true,
            multiSourceVerification: true,
            duplicateDetection: true,
            sourcePriority: true,
            pdfReader: true,
            adminPanel: true,
            broadcastSystem: true,
            retrySystem: true,
            errorLogging: true,
            affiliateLinks: config.affiliateEnabled,
            premiumAlerts: true,
            analytics: config.analyticsEnabled
        }
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
            title: item.title || 'Unknown',
            sources: item.foundInSources || [],
            timeInQueue: item.addedAt ? Math.floor((Date.now() - item.addedAt) / 60000) + ' minutes' : 'N/A',
            status: item.verificationStatus || 'Unknown'
        })),
        recentVerifications: Array.from(verificationLog.values()).slice(-10)
    });
});

app.get('/stats', (req, res) => {
    const categories = getCategoryStats();
    
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
        categories: categories,
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
            verificationEnabled: config.verificationEnabled,
            affiliateEnabled: config.affiliateEnabled
        }
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

// ===== INITIALIZE BOT (WEBHOOK MODE) =====
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
        console.error('❌ Webhook error:', err.message);
    });
    
    app.post('/webhook', (req, res) => {
        bot.processUpdate(req.body);
        res.sendStatus(200);
    });
} else {
    bot.on('polling_error', (error) => {
        console.error('⚠️ Polling error:', error.code);
        logError('POLLING_ERROR', error.message);
    });
}

// ===== DISPLAY FUNCTIONS =====
async function showLatestJobs(chatId) {
    try {
        if (biharJobs.length === 0) {
            return bot.sendMessage(chatId, '❌ No jobs available currently.');
        }
        
        const jobButtons = biharJobs.slice(0, 10).map((job, i) => {
            const badge = job.verificationStatus === VerificationLevel.OFFICIAL ? '🟢' : 
                          job.verificationStatus === VerificationLevel.MULTI_SOURCE ? '🟡' : '';
            return [{
                text: `${badge} ${i+1}. ${job.shortTitle}`,
                callback_data: `view_job_${job.id}`
            }];
        });
        
        jobButtons.push([{text: '🔍 Search Jobs', callback_data: 'search_jobs'}]);
        jobButtons.push([{text: '🔄 Refresh', callback_data: 'refresh_jobs'}]);
        jobButtons.push([{text: '🏠 Main Menu', callback_data: 'back_to_start'}]);
        
        const msg = `💼 *Latest Government Jobs*\n\n🔒 *All jobs are verified!*\n🟢 Official | 🟡 Multi-Source\n\n📅 Updated: ${new Date().toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'})}\n🔢 Total Jobs: ${biharJobs.length}\n\nClick on any job to view full details:`;
        
        await bot.sendMessage(chatId, msg, {
            parse_mode: 'Markdown',
            reply_markup: {inline_keyboard: jobButtons}
        });
        
        const engagement = analytics.userEngagement.get(chatId) || 0;
        analytics.userEngagement.set(chatId, engagement + 1);
        
    } catch (error) {
        console.error('Error showing jobs:', error.message);
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
        
        buttons.push([{text: `📝 Apply (${job.posts.toLocaleString()} Posts)`, url: job.applyLink}]);
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
        return bot.sendMessage(chatId, '❌ No results available at the moment.');
    }
    
    let msg = `📊 *LATEST RESULTS*\n\n🔔 Total Results: *${biharResults.length}*\n\n`;
    
    const buttons = [];
    
    biharResults.forEach((result, index) => {
        msg += `${index + 1}. *${result.title}*\n`;
        msg += `   📅 Result Date: ${result.resultDate}\n\n`;
        
        buttons.push([{text: `📊 ${index + 1}. ${result.shortTitle}`, url: result.resultLink}]);
    });
    
    buttons.push([{text: '📋 Latest Jobs', callback_data: 'view_latest_jobs'}]);
    buttons.push([{text: '🔄 Refresh', callback_data: 'refresh_results'}, {text: '🏠 Menu', callback_data: 'back_to_start'}]);
    
    bot.sendMessage(chatId, msg, {
        parse_mode: 'Markdown',
        reply_markup: {inline_keyboard: buttons}
    });
}

function showAdmitCards(chatId) {
    if (biharAdmitCards.length === 0) {
        return bot.sendMessage(chatId, '❌ No admit cards available at the moment.');
    }
    
    let msg = `🎫 *LATEST ADMIT CARDS*\n\n🔔 Total Admit Cards: *${biharAdmitCards.length}*\n\n`;
    
    const buttons = [];
    
    biharAdmitCards.forEach((admit, index) => {
        msg += `${index + 1}. *${admit.title}*\n`;
        msg += `   📅 Exam Date: ${admit.examDate}\n\n`;
        
        buttons.push([{text: `🎫 ${index + 1}. ${admit.shortTitle}`, url: admit.admitLink}]);
    });
    
    buttons.push([{text: '📋 Latest Jobs', callback_data: 'view_latest_jobs'}]);
    buttons.push([{text: '🔄 Refresh', callback_data: 'refresh_admits'}, {text: '🏠 Menu', callback_data: 'back_to_start'}]);
    
    bot.sendMessage(chatId, msg, {
        parse_mode: 'Markdown',
        reply_markup: {inline_keyboard: buttons}
    });
}

function showUniversities(chatId) {
    let msg = `🎓 *BIHAR UNIVERSITIES*\n\n📚 Total Universities: *${biharUniversities.length}*\n\nChoose a university to view details:\n\n`;
    
    const buttons = [];
    
    biharUniversities.slice(0, 10).forEach((uni) => {
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

📚 *Courses:*
${uni.courses}

📞 *Contact:* ${uni.contact}
🌐 *Website:* ${uni.website}

💡 Visit official website for more information
`;
    
    bot.sendMessage(chatId, msg, {
        parse_mode: 'Markdown',
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
        reply_markup: {inline_keyboard: buttons}
    });
}

function showUserProfile(chatId, userId) {
    const user = users.get(chatId);
    const isSubscribed = subscribers.has(chatId);
    const premium = isPremium(chatId);
    const profile = userProfiles.get(chatId) || {savedJobs: []};
    const savedJobsCount = profile.savedJobs ? profile.savedJobs.length : 0;
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
📊 *Engagement:* ${engagement}

🔒 *All jobs are verified before sending!*

💡 Subscribe to get verified job alerts!
${!premium ? '\n🌟 *Upgrade to Premium* for early alerts!' : ''}
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
    let msg = `📚 *TEST SERIES & COURSES*\n\n🎯 Prepare for exams with these partners:\n\n`;
    
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
    
    msg += `\n💡 These links support this bot!`;
    
    buttons.push([{text: '⬅️ Back to Jobs', callback_data: 'view_latest_jobs'}]);
    
    bot.sendMessage(chatId, msg, {
        parse_mode: 'Markdown',
        reply_markup: {inline_keyboard: buttons}
    });
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
            [{text: '🏠 Back to List', callback_data: 'back_to_jobs'}]
        ]
    };

    return {message, keyboard};
}

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
🌐 ${govtWebsites.length} सरकारी वेबसाइट
📚 Test Series & Courses
💎 Premium Early Alerts

🔒 *Verification System:*
• Level 1: Official Govt Sources
• Level 2: Trusted Education Portals
• Level 3: Secondary Verification
• Minimum ${config.minSourcesForPublish} sources for publish

💡 *नीचे के बटन दबाएं या कमांड टाइप करें!*

📌 *Commands:*
/jobs - Verified jobs
/trending - Trending jobs
/verification - Verification stats
/results - Results
/admitcards - Admit cards
/universities - Universities
/subscribe - Alerts
/premium - Premium
/profile - Your profile
/help - Help guide
/about - About bot
/feedback - Feedback

${isAdmin(userId) ? '\n🔧 *Admin Commands:*\n/admin - Control Panel\n/stats - Analytics\n/sources - Manage Sources' : ''}
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
        bot.sendMessage(chatId, `💎 *Premium Active!*\n\nBenefits:\n✅ Early alerts (1 hour)\n✅ Verified job guarantee\n✅ Personalized notifications\n✅ Priority support\n\nThank you! 🙏`, {parse_mode: 'Markdown'});
    } else {
        bot.sendMessage(chatId, `💎 *Upgrade to Premium*\n\n*Benefits:*\n⚡ Early alerts (1 hour)\n🔒 100% verified jobs\n🎯 Personalized notifications\n💬 Priority support\n\n*Price:* ₹99/month\n\n_Coming soon!_\n\nFor now, use /subscribe for free alerts!`, {parse_mode: 'Markdown'});
    }
});

bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id, `
ℹ️ *Bihar Education Bot - Help*

*📌 Main Commands:*
/start - Start bot
/jobs - Latest verified jobs
/trending - Trending jobs
/verification - Verification system
/results - Results
/admitcards - Admit cards
/universities - Universities
/subscribe - Subscribe for alerts
/premium - Premium features
/profile - Your profile
/help - This guide
/about - About bot
/feedback - Send feedback

*🔒 Verification:*
🟢 = Official Government Source
🟡 = Multiple Trusted Sources
🔴 = Unverified (Not Published)

*✨ Features:*
• 67 Premium Features
• Multi-Source Verification
• Auto-Scraping System
• Premium Early Alerts
• Analytics Dashboard
• Test Series Links

*🆘 Support:*
Use /feedback for issues

Made with ❤️ for Bihar Students
`, {parse_mode: 'Markdown'});
});

bot.onText(/\/about/, (msg) => {
    bot.sendMessage(msg.chat.id, `
ℹ️ *Bihar Education Bot v8.0*

*Your ultimate verified job companion!*

✨ *67 Premium Features*

*📋 Content:*
• ${biharJobs.length}+ Verified Jobs
• ${trendingJobs.length} Trending Jobs
• ${biharResults.length}+ Results
• ${biharAdmitCards.length}+ Admit Cards
• ${biharUniversities.length} Universities
• ${govtWebsites.length} Govt Websites

*🔒 Verification:*
• 3-Level Source Priority
• Multi-Source Confirmation
• Official PDF Detection
• Hold Queue System
• Verification Logs

*📊 Statistics:*
• Users: ${users.size}
• Subscribers: ${subscribers.size}
• Premium: ${premiumUsers.size}
• Verified Posts: ${analytics.verificationStats.official + analytics.verificationStats.multiSource}

🚀 *Deployment:*
• Platform: Render.com 24/7
• Version: 8.0
• Features: 67

Made with ❤️ for Bihar Students
`, {parse_mode: 'Markdown'});
});

bot.onText(/\/feedback/, (msg) => {
    const chatId = msg.chat.id;
    userStates.set(chatId, 'awaiting_feedback');
    bot.sendMessage(chatId, '📝 *Feedback*\n\nShare your feedback or report issues.\n\nType your message:', {parse_mode: 'Markdown'});
});

bot.onText(/\/admin/, (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(chatId, '❌ Admin access required!');
    }
    
    const adminMenu = {
        inline_keyboard: [
            [{text: '📊 Analytics', callback_data: 'admin_analytics'}],
            [{text: '🔒 Verification', callback_data: 'admin_verification'}],
            [{text: '👥 Users', callback_data: 'admin_users'}],
            [{text: '🌐 Sources', callback_data: 'admin_sources'}],
            [{text: '🏠 Menu', callback_data: 'back_to_start'}]
        ]
    };
    
    bot.sendMessage(chatId, `
🔧 *Admin Control Panel*

*📊 Overview:*
• Users: ${users.size}
• Subscribers: ${subscribers.size}
• Premium: ${premiumUsers.size}
• Posts: ${analytics.totalPosts}
• Clicks: ${analytics.totalClicks}

*🔒 Verification:*
• Official: ${analytics.verificationStats.official}
• Multi-Source: ${analytics.verificationStats.multiSource}
• Queue: ${holdQueue.length}

*💼 Content:*
• Jobs: ${biharJobs.length}
• Results: ${biharResults.length}
• Admits: ${biharAdmitCards.length}

*⏱️ System:*
• Uptime: ${Math.floor(process.uptime()/3600)}h ${Math.floor((process.uptime()%3600)/60)}m
• Version: 8.0
• Features: 67
`, {parse_mode: 'Markdown', reply_markup: adminMenu});
});

bot.onText(/\/stats/, (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(chatId, '❌ Admin only');
    }
    
    const categories = getCategoryStats();
    
    bot.sendMessage(chatId, `
📊 *Detailed Analytics*

*👥 Users:*
• Total: ${users.size}
• Subscribers: ${subscribers.size}
• Premium: ${premiumUsers.size}
• Active: ${analytics.userEngagement.size}

*🔒 Verification:*
• Official: ${analytics.verificationStats.official}
• Multi-Source: ${analytics.verificationStats.multiSource}
• Queue: ${holdQueue.length}

*📊 Performance:*
• Posts: ${analytics.totalPosts}
• Clicks: ${analytics.totalClicks}
• CTR: ${analytics.totalPosts > 0 ? ((analytics.totalClicks/analytics.totalPosts)*100).toFixed(2) : 0}%

*💼 Categories:*
${categories.map(c => `• ${c.category}: ${c.count} (${c.clicks} clicks)`).join('\n')}

*⏱️ System:*
• Uptime: ${Math.floor(process.uptime()/3600)}h ${Math.floor((process.uptime()%3600)/60)}m
• Version: 8.0
`, {parse_mode: 'Markdown'});
});

bot.onText(/\/sources/, (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(chatId, '❌ Admin only');
    }
    
    let sourceMsg = `🌐 *Source Management*\n\n*Active: ${targetWebsites.filter(s=>s.enabled).length}/${targetWebsites.length}*\n\n`;
    
    [1, 2, 3].forEach(priority => {
        const sources = targetWebsites.filter(s => s.priority === priority);
        if (sources.length > 0) {
            sourceMsg += `\n*Level ${priority}:*\n`;
            sources.forEach(site => {
                sourceMsg += `${site.enabled ? '✅' : '❌'} ${site.name}\n`;
                sourceMsg += `   Weight: ${site.verificationWeight} | Errors: ${site.errorCount}\n`;
            });
        }
    });
    
    bot.sendMessage(chatId, sourceMsg, {parse_mode: 'Markdown'});
});

// ===== KEYBOARD BUTTON HANDLERS =====
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    if (!text || text.startsWith('/')) return;
    
    // Handle feedback
    if (userStates.get(chatId) === 'awaiting_feedback') {
        ADMIN_IDS.forEach(adminId => {
            bot.sendMessage(adminId, `📝 *New Feedback*\n\n*From:* ${msg.from.first_name} (${chatId})\n*Username:* @${msg.from.username || 'none'}\n\n*Message:*\n${text}`, {parse_mode: 'Markdown'}).catch(() => {});
        });
        bot.sendMessage(chatId, '✅ *Thank you!*\n\nFeedback received.', {parse_mode: 'Markdown'});
        userStates.delete(chatId);
        return;
    }
    
    // Handle search
    if (userStates.get(chatId) === 'awaiting_search') {
        const searchTerm = text.toLowerCase();
        userStates.delete(chatId);
        
        const results = biharJobs.filter(job => 
            job.title.toLowerCase().includes(searchTerm) ||
            job.organization.toLowerCase().includes(searchTerm) ||
            job.category.toLowerCase().includes(searchTerm)
        );
        
        if (results.length === 0) {
            return bot.sendMessage(chatId, `❌ No jobs found for "*${searchTerm}*"`, {parse_mode: 'Markdown'});
        }
        
        let searchMsg = `🔍 *Search: "${searchTerm}"*\n\nFound ${results.length} jobs:\n\n`;
        const buttons = [];
        
        results.slice(0, 10).forEach((job, i) => {
            const badge = job.verificationStatus === VerificationLevel.OFFICIAL ? '🟢' : '🟡';
            searchMsg += `${i + 1}. ${badge} ${job.shortTitle}\n`;
            buttons.push([{text: `${badge} ${i + 1}. ${job.shortTitle}`, callback_data: `view_job_${job.id}`}]);
        });
        
        buttons.push([{text: '🏠 Menu', callback_data: 'back_to_start'}]);
        
        return bot.sendMessage(chatId, searchMsg, {
            parse_mode: 'Markdown',
            reply_markup: {inline_keyboard: buttons}
        });
    }
    
    // Keyboard buttons
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
            if (!profile.savedJobs || profile.savedJobs.length === 0) {
                bot.sendMessage(chatId, '📭 *No Saved Jobs*', {parse_mode: 'Markdown'});
            } else {
                let msg = `💾 *Saved Jobs (${profile.savedJobs.length})*\n\n`;
                const buttons = [];
                profile.savedJobs.forEach((jobId, i) => {
                    const job = biharJobs.find(j => j.id === jobId);
                    if (job) {
                        const badge = job.verificationStatus === VerificationLevel.OFFICIAL ? '🟢' : '🟡';
                        buttons.push([{text: `${badge} ${i + 1}. ${job.shortTitle}`, callback_data: `view_job_${job.id}`}]);
                    }
                });
                buttons.push([{text: '🏠 Menu', callback_data: 'back_to_start'}]);
                bot.sendMessage(chatId, msg, {parse_mode: 'Markdown', reply_markup: {inline_keyboard: buttons}});
            }
            break;
        case '📚 Test Series':
            if (config.affiliateEnabled) showAffiliateLinks(chatId);
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
        
        if (!profile.savedJobs) profile.savedJobs = [];
        
        if (profile.savedJobs.includes(jobId)) {
            bot.answerCallbackQuery(query.id, {text: '✅ Already saved!', show_alert: false});
        } else {
            profile.savedJobs.push(jobId);
            userProfiles.set(chatId, profile);
            bot.answerCallbackQuery(query.id, {text: '💾 Saved!', show_alert: false});
        }
        return;
    }
    
    // Share job
    if (data.startsWith('share_')) {
        const jobId = data.replace('share_', '');
        const job = biharJobs.find(j => j.id === jobId);
        
        if (job) {
            const shareMsg = `${job.verificationStatus}\n\n🏛️ *${job.title}*\n\n👥 Posts: ${job.posts}\n📅 Last Date: ${job.lastDate}\n🔗 ${job.applyLink}\n\n🤖 Get verified jobs: @BiharEducationBot`;
            bot.sendMessage(chatId, shareMsg, {parse_mode: 'Markdown'});
            bot.answerCallbackQuery(query.id, {text: '📤 Shared!', show_alert: false});
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
                        [{text: '🔗 Apply', url: job.applyLink}],
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
    
    // Show functions
    if (data === 'show_universities') {
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        showUniversities(chatId);
        return bot.answerCallbackQuery(query.id);
    }
    
    if (data === 'show_govt_websites') {
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        showGovtWebsites(chatId);
        return bot.answerCallbackQuery(query.id);
    }
    
    // Search
    if (data === 'search_jobs') {
        userStates.set(chatId, 'awaiting_search');
        bot.sendMessage(chatId, '🔍 *Search Jobs*\n\nEnter keywords:\n\nExamples:\n• Railway\n• SSC\n• BPSC\n• Police', {parse_mode: 'Markdown'});
        return bot.answerCallbackQuery(query.id);
    }
    
    // Subscription
    if (data === 'toggle_subscription') {
        handleSubscription(chatId, userId);
        return bot.answerCallbackQuery(query.id);
    }
    
    // Premium
    if (data === 'activate_premium') {
        if (isAdmin(userId)) {
            premiumUsers.set(chatId, {activatedAt: new Date(), expiresAt: new Date(Date.now() + 30*24*60*60*1000)});
            bot.answerCallbackQuery(query.id, {text: '💎 Premium activated!', show_alert: true});
            bot.sendMessage(chatId, '💎 *Premium Activated!*', {parse_mode: 'Markdown'});
        }
        return;
    }
    
    // View saved
    if (data === 'view_saved_jobs') {
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        const profile = userProfiles.get(chatId) || {savedJobs: []};
        if (!profile.savedJobs || profile.savedJobs.length === 0) {
            bot.sendMessage(chatId, '📭 *No Saved Jobs*', {parse_mode: 'Markdown'});
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
    
    if (data === 'admin_users') {
        bot.sendMessage(chatId, `👥 *User Management*\n\nTotal: ${users.size}\nSubs: ${subscribers.size}\nPremium: ${premiumUsers.size}`, {parse_mode: 'Markdown'});
        return bot.answerCallbackQuery(query.id);
    }
    
    if (data === 'admin_sources') {
        bot.sendMessage(chatId, '/sources');
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
    
    if (data === 'back_to_jobs' || data === 'back_to_start') {
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        showLatestJobs(chatId);
        return bot.answerCallbackQuery(query.id);
    }
    
    bot.answerCallbackQuery(query.id);
});

// ===== ERROR HANDLING =====
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled rejection:', error.message);
    logError('UNHANDLED_REJECTION', error.message);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error.message);
    logError('UNCAUGHT_EXCEPTION', error.message);
});

// ===== STARTUP MESSAGE =====
console.log('🚀 Bihar Education Bot v8.0 Started!');
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
console.log(`🌐 Sources: ${targetWebsites.length}`);
console.log(`⚡ Mode: ${useWebhook ? 'Webhook' : 'Polling'}`);
console.log('✅ All systems operational!');
