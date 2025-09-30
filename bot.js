const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cron = require('node-cron');
const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_IDS = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',') : [];
const CHANNEL_ID = process.env.CHANNEL_ID;
const bot = new TelegramBot(TOKEN, { polling: true });
const app = express();

// Storage
let users = new Map();
let subscribers = new Map();
let userProfiles = new Map();
let userStates = new Map();
let currentJobView = new Map();
let jobDatabase = new Map();
let lastScrapedJobs = new Map();

function isAdmin(userId) {
    return ADMIN_IDS.includes(userId.toString());
}

// ===== COMPLETE BIHAR JOBS DATA (6 DETAILED JOBS) =====
const biharJobs = [
    {
        id: 1, category: "Police",
        title: "Bihar Police Constable Recruitment 2025",
        shortTitle: "Bihar Police Constable 4128 Posts",
        organization: "Central Selection Board of Constable (CSBC)",
        organizationShort: "CSBC Bihar",
        advtNo: "Advt. No. 02/2025",
        publishDate: "20-07-2025",
        posts: 4128,
        salary: "₹21,700 - ₹69,100 (Level-3)",
        lastDate: "05-11-2025",
        examDate: "15-12-2025",
        qualification: "12वीं पास (Intermediate)",
        ageLimit: "18-25 years (Relaxation as per rules)",
        applicationFee: "₹400 (General/EWS), ₹100 (BC/EBC), Free (SC/ST/Female/PH)",
        selectionProcess: "Written Exam → Physical Efficiency Test (PET) → Document Verification → Medical Examination",
        applyLink: "https://csbc.bihar.gov.in/main/Apply.aspx",
        notificationPDF: "https://csbc.bihar.gov.in/Advt/02-2025-Constable.pdf",
        syllabusPDF: "https://csbc.bihar.gov.in/Downloads/Syllabus-Constable.pdf",
        officialWebsite: "https://csbc.bihar.gov.in",
        importantDates: {
            notificationDate: "20-07-2025",
            applicationStart: "20-07-2025",
            applicationEnd: "05-11-2025",
            correctionWindow: "10-11-2025 to 15-11-2025",
            examDate: "15-12-2025",
            admitCard: "01-12-2025",
            resultDate: "March 2026"
        },
        postDetails: [
            { post: "Constable (Male)", vacancy: 3500, qualification: "12th Pass", category: "General Duty" },
            { post: "Constable (Female)", vacancy: 628, qualification: "12th Pass", category: "General Duty" }
        ],
        eligibility: {
            nationality: "Indian Citizen",
            height: "Male: 165cm, Female: 155cm",
            chest: "Male: 79cm (unexpanded), 84cm (expanded)",
            educationalQualification: "Intermediate (10+2) from recognized board",
            physicalStandards: "As per Bihar Police norms"
        },
        examPattern: {
            paper: "Objective Type (Multiple Choice)",
            totalMarks: 100,
            duration: "2 hours",
            subjects: ["General Knowledge", "Current Affairs", "Reasoning", "Mathematics", "Hindi", "English"],
            negativeMarking: "0.2 marks for each wrong answer"
        },
        howToApply: "Candidates must apply ONLINE through official CSBC website. Keep documents ready: Photo, Signature, 12th Marksheet, Category Certificate (if applicable).",
        importantLinks: [
            { name: "📄 Official Notification", url: "https://csbc.bihar.gov.in/Advt/02-2025-Constable.pdf" },
            { name: "📝 Apply Online", url: "https://csbc.bihar.gov.in/main/Apply.aspx" },
            { name: "📋 Syllabus PDF", url: "https://csbc.bihar.gov.in/Downloads/Syllabus-Constable.pdf" },
            { name: "🏠 Official Website", url: "https://csbc.bihar.gov.in" }
        ],
        description: "Central Selection Board of Constable, Bihar invites online applications from eligible Indian citizens for recruitment to 4128 posts of Constable in Bihar Police. Candidates meeting the eligibility criteria can apply online before the last date."
    },
    
    {
        id: 2, category: "SSC",
        title: "BSSC Inter Level Combined Competitive Examination (CCE) 2025",
        shortTitle: "BSSC Inter Level 23,175 Posts",
        organization: "Bihar Staff Selection Commission",
        organizationShort: "BSSC",
        advtNo: "Advt. No. 01/2025",
        publishDate: "15-08-2025",
        posts: 23175,
        salary: "₹19,900 - ₹63,200 (Level-2 & Level-3)",
        lastDate: "25-11-2025",
        examDate: "20-01-2026 (Prelims)",
        qualification: "12वीं पास (Intermediate)",
        ageLimit: "18-37 years (As on 01-08-2025)",
        applicationFee: "₹450 (General/EWS), ₹112 (BC/EBC/Female General Category), Free (SC/ST/PH/Ex-Servicemen)",
        selectionProcess: "Preliminary Exam (CBT) → Mains Exam (CBT) → Document Verification",
        applyLink: "https://bssc.bihar.gov.in/online-application",
        notificationPDF: "https://bssc.bihar.gov.in/Advt/01-2025-InterLevel.pdf",
        syllabusPDF: "https://bssc.bihar.gov.in/Syllabus/InterLevel-Syllabus.pdf",
        officialWebsite: "https://bssc.bihar.gov.in",
        importantDates: {
            notificationDate: "15-08-2025",
            applicationStart: "15-08-2025",
            applicationEnd: "25-11-2025",
            correctionWindow: "30-11-2025 to 05-12-2025",
            prelimsExam: "20-01-2026",
            mainsExam: "20-03-2026",
            admitCardPrelims: "10-01-2026",
            admitCardMains: "10-03-2026",
            resultDate: "May 2026"
        },
        postDetails: [
            { post: "Panchayat Sachiv", vacancy: 8415, qualification: "12th Pass", category: "Panchayati Raj" },
            { post: "Revenue Worker", vacancy: 4280, qualification: "12th Pass", category: "Revenue Department" },
            { post: "Amin", vacancy: 3850, qualification: "12th Pass", category: "Land Survey" },
            { post: "Supply Inspector", vacancy: 2100, qualification: "12th Pass", category: "Food & Supply" },
            { post: "Forest Guard", vacancy: 1800, qualification: "12th Pass", category: "Forest Department" },
            { post: "Various Posts", vacancy: 2730, qualification: "12th Pass", category: "Other Departments" }
        ],
        eligibility: {
            nationality: "Resident of Bihar",
            educationalQualification: "Intermediate (10+2) from Bihar Board or equivalent",
            ageRelaxation: "5 years for BC/EBC, No upper age limit for SC/ST of Bihar"
        },
        examPattern: {
            prelims: {
                paper: "Objective (MCQ)",
                totalMarks: 150,
                duration: "2 hours 15 minutes",
                subjects: ["General Knowledge", "General Science", "Mathematics", "Mental Ability", "General Hindi"],
                negativeMarking: "0.2 marks deduction"
            },
            mains: {
                paper: "Objective + Descriptive",
                totalMarks: 300,
                duration: "3 hours",
                subjects: ["General Studies", "General Hindi", "General English", "Optional Subject"],
                negativeMarking: "0.25 marks deduction"
            }
        },
        howToApply: "Apply ONLINE only through official BSSC portal. No offline applications accepted. Pay fee through Net Banking/Debit Card/Credit Card.",
        importantLinks: [
            { name: "📄 Detailed Notification", url: "https://bssc.bihar.gov.in/Advt/01-2025-InterLevel.pdf" },
            { name: "📝 Apply Online", url: "https://bssc.bihar.gov.in/online-application" },
            { name: "📋 Exam Syllabus", url: "https://bssc.bihar.gov.in/Syllabus/InterLevel-Syllabus.pdf" },
            { name: "💳 Fee Payment", url: "https://bssc.bihar.gov.in/payment" },
            { name: "🏠 Official Website", url: "https://bssc.bihar.gov.in" }
        ],
        description: "Bihar Staff Selection Commission (BSSC) announces 23,175 vacancies for Intermediate Level posts across various departments including Panchayati Raj, Revenue, Forest, Food & Supply. Two-tier examination: Prelims (Screening) + Mains (Final Selection)."
    },
    
    {
        id: 3, category: "Civil Services",
        title: "BPSC 70th Combined Competitive Examination (CCE) 2025",
        shortTitle: "BPSC 70th CCE - 2000+ Posts",
        organization: "Bihar Public Service Commission",
        organizationShort: "BPSC",
        advtNo: "Advt. No. 01/2025 (70th CCE)",
        publishDate: "01-09-2025",
        posts: 2041,
        salary: "₹25,000 - ₹80,000 (Various Pay Levels)",
        lastDate: "15-12-2025",
        examDate: "15-02-2026 (Prelims)",
        qualification: "स्नातक (Bachelor's Degree)",
        ageLimit: "20-37 years (General), Relaxation as per rules",
        applicationFee: "₹600 (General Male), ₹150 (BC/EBC/General Female), Free (SC/ST/PH)",
        selectionProcess: "Preliminary Exam → Mains Exam (Written) → Interview (Personality Test)",
        applyLink: "https://bpsc.bih.nic.in/Advt/OnlineApp.aspx",
        notificationPDF: "https://bpsc.bih.nic.in/Advt/NCC-Advt-01-2025-70CCE.pdf",
        syllabusPDF: "https://bpsc.bih.nic.in/Syllabus/70-CCE-Syllabus-Detailed.pdf",
        officialWebsite: "https://bpsc.bih.nic.in",
        importantDates: {
            notificationDate: "01-09-2025",
            applicationStart: "01-09-2025",
            applicationEnd: "15-12-2025",
            correctionWindow: "20-12-2025 to 25-12-2025",
            prelimsExam: "15-02-2026",
            prelimsResult: "April 2026",
            mainsExam: "15-05-2026 to 18-05-2026",
            mainsResult: "August 2026",
            interview: "September-October 2026",
            admitCardPrelims: "05-02-2026",
            finalResult: "November 2026"
        },
        postDetails: [
            { post: "Deputy Collector", vacancy: 400, qualification: "Graduate", payLevel: "Level-11" },
            { post: "Deputy Superintendent of Police (DSP)", vacancy: 200, qualification: "Graduate", payLevel: "Level-11" },
            { post: "Block Panchayat Raj Officer", vacancy: 350, qualification: "Graduate", payLevel: "Level-10" },
            { post: "Revenue Officer", vacancy: 500, qualification: "Graduate", payLevel: "Level-10" },
            { post: "Excise Inspector", vacancy: 150, qualification: "Graduate", payLevel: "Level-9" },
            { post: "Various Administrative Posts", vacancy: 441, qualification: "Graduate", payLevel: "Level-9 to 11" }
        ],
        eligibility: {
            nationality: "Indian Citizen",
            educationalQualification: "Bachelor's Degree from recognized University",
            ageRelaxation: "5 years BC/EBC/Female, No upper age limit SC/ST domicile of Bihar"
        },
        examPattern: {
            prelims: {
                paper: "General Studies (MCQ)",
                totalMarks: 150,
                duration: "2 hours",
                subjects: ["Current Affairs", "History", "Geography", "Polity", "Economy", "General Science"],
                negativeMarking: "0.25 marks per wrong answer"
            },
            mains: {
                totalMarks: 1300,
                papers: ["Hindi (100)", "GS-I (300)", "GS-II (300)", "Optional-I (300)", "Optional-II (300)"]
            },
            interview: { marks: 120 }
        },
        howToApply: "Register online on BPSC website → Fill form → Upload documents → Pay fee → Submit",
        importantLinks: [
            { name: "📄 Detailed Advertisement", url: "https://bpsc.bih.nic.in/Advt/NCC-Advt-01-2025-70CCE.pdf" },
            { name: "📝 Apply Online", url: "https://bpsc.bih.nic.in/Advt/OnlineApp.aspx" },
            { name: "📋 Complete Syllabus", url: "https://bpsc.bih.nic.in/Syllabus/70-CCE-Syllabus-Detailed.pdf" }
        ],
        description: "BPSC 70th CCE for 2041 posts of Deputy Collector, DSP, Revenue Officer, and other Group-A & Group-B services. Three-stage selection process."
    },

    {
        id: 4, category: "Police",
        title: "BPSSC Sub-Inspector (Subordinate Services) Recruitment 2025",
        shortTitle: "Bihar Police SI - 1799 Posts",
        organization: "Bihar Police Subordinate Services Commission",
        organizationShort: "BPSSC",
        advtNo: "Advt. No. 01/2025",
        publishDate: "05-09-2025",
        posts: 1799,
        salary: "₹35,400 - ₹1,12,400 (Level-7)",
        lastDate: "26-10-2025",
        examDate: "December 2025",
        qualification: "स्नातक (Bachelor's Degree)",
        ageLimit: "20-37 years",
        applicationFee: "₹700 (Gen), ₹200 (BC/EBC/Female), Free (SC/ST/PH)",
        selectionProcess: "Preliminary → Mains → PET → Interview",
        applyLink: "https://bpssc.bih.nic.in",
        notificationPDF: "https://bpssc.bih.nic.in/Advt/SI-2025.pdf",
        syllabusPDF: "https://bpssc.bih.nic.in/Syllabus/SI-Syllabus.pdf",
        officialWebsite: "https://bpssc.bih.nic.in",
        importantDates: {
            applicationStart: "05-09-2025",
            applicationEnd: "26-10-2025",
            prelimsExam: "December 2025",
            mainsExam: "February 2026",
            admitCard: "TBA"
        },
        postDetails: [
            { post: "Sub-Inspector (Police)", vacancy: 1799, qualification: "Graduate" }
        ],
        description: "BPSSC invites applications for 1799 Sub-Inspector posts in Bihar Police."
    },

    {
        id: 5, category: "Railway",
        title: "Railway Recruitment Board NTPC Bihar Zone 2025",
        shortTitle: "RRB NTPC - 8850 Posts",
        organization: "Railway Recruitment Board",
        organizationShort: "RRB",
        advtNo: "RRB/NTPC/01/2025",
        publishDate: "10-08-2025",
        posts: 8850,
        salary: "₹19,900 - ₹35,400",
        lastDate: "27-11-2025",
        examDate: "January 2026",
        qualification: "स्नातक",
        ageLimit: "18-33 years",
        applicationFee: "₹500 (Gen/OBC), ₹250 (SC/ST/Female)",
        selectionProcess: "CBT Stage-I → Stage-II → Skill Test → Medical",
        applyLink: "https://rrbcdg.gov.in",
        notificationPDF: "https://rrbcdg.gov.in/NTPC-2025.pdf",
        syllabusPDF: "https://rrbcdg.gov.in/Syllabus.pdf",
        officialWebsite: "https://rrbcdg.gov.in",
        importantDates: {
            applicationStart: "10-08-2025",
            applicationEnd: "27-11-2025",
            CBT1: "January 2026",
            admitCard: "December 2025"
        },
        postDetails: [
            { post: "Junior Clerk", vacancy: 3500, qualification: "Graduate" },
            { post: "Commercial Apprentice", vacancy: 2000, qualification: "Graduate" },
            { post: "Station Master", vacancy: 1850, qualification: "Graduate" },
            { post: "Goods Guard", vacancy: 1500, qualification: "Graduate" }
        ],
        description: "RRB announces 8,850 NTPC vacancies for Bihar zone including Clerk, Station Master, Goods Guard."
    },

    {
        id: 6, category: "Medical",
        title: "AIIMS Patna Recruitment 2025 - Various Posts",
        shortTitle: "AIIMS Patna - 50 Posts",
        organization: "All India Institute of Medical Sciences, Patna",
        organizationShort: "AIIMS Patna",
        advtNo: "AIIMS/Patna/2025/01",
        publishDate: "05-09-2025",
        posts: 50,
        salary: "₹25,000 - ₹75,000",
        lastDate: "15-10-2025",
        examDate: "TBA",
        qualification: "MBBS/B.Sc Nursing/Graduate",
        ageLimit: "21-40 years",
        applicationFee: "₹1,000 (Gen/OBC), ₹800 (SC/ST/PH)",
        selectionProcess: "Written Test → Interview → Medical",
        applyLink: "https://aiimspatna.edu.in/recruitment",
        notificationPDF: "https://aiimspatna.edu.in/notification-2025.pdf",
        syllabusPDF: "https://aiimspatna.edu.in/syllabus.pdf",
        officialWebsite: "https://aiimspatna.edu.in",
        importantDates: {
            applicationStart: "05-09-2025",
            applicationEnd: "15-10-2025",
            examDate: "November 2025"
        },
        postDetails: [
            { post: "Junior Resident", vacancy: 20, qualification: "MBBS" },
            { post: "Senior Resident", vacancy: 15, qualification: "MD/MS" },
            { post: "Nursing Officer", vacancy: 10, qualification: "B.Sc Nursing" },
            { post: "Lab Technician", vacancy: 5, qualification: "B.Sc MLT" }
        ],
        description: "AIIMS Patna invites applications for 50 posts including Resident, Nursing, Lab Technician."
    }
];

// Bihar Universities Data
const biharUniversities = [
    { id: 1, name: "Patna University", location: "Patna", type: "State University", established: "1917", website: "https://patnauniversity.ac.in", courses: "B.A, B.Sc, B.Com, M.A, M.Sc, M.Com, Ph.D", contact: "0612-2670208" },
    { id: 2, name: "B.R. Ambedkar Bihar University", location: "Muzaffarpur", type: "State University", established: "1952", website: "https://brabu.net", courses: "UG, PG, Research", contact: "0621-2244010" },
    { id: 3, name: "Magadh University", location: "Bodh Gaya", type: "State University", established: "1962", website: "https://magadhuniversity.ac.in", courses: "Arts, Science, Commerce, Law", contact: "0631-2200491" },
    { id: 4, name: "Jai Prakash University", location: "Chapra", type: "State University", established: "1990", website: "https://jpv.bih.nic.in", courses: "B.A, B.Sc, B.Com, M.A, M.Sc", contact: "06152-234401" },
    { id: 5, name: "Tilka Manjhi Bhagalpur University", location: "Bhagalpur", type: "State University", established: "1960", website: "https://tmbuniv.ac.in", courses: "UG, PG All Streams", contact: "0641-2423245" },
    { id: 6, name: "Bihar Agricultural University", location: "Sabour", type: "Agricultural University", established: "1960", website: "https://bausabour.ac.in", courses: "B.Sc Agriculture, M.Sc, Ph.D", contact: "06482-226282" },
    { id: 7, name: "AIIMS Patna", location: "Patna", type: "National Importance", established: "2012", website: "https://aiimspatna.edu.in", courses: "MBBS, MD, MS, Nursing", contact: "0612-2451070" },
    { id: 8, name: "IIT Patna", location: "Patna", type: "National Importance", established: "2008", website: "https://iitp.ac.in", courses: "B.Tech, M.Tech, Ph.D", contact: "0612-2552000" },
    { id: 9, name: "NIT Patna", location: "Patna", type: "National Importance", established: "1886", website: "https://nitp.ac.in", courses: "B.Tech, M.Tech, MCA, MBA", contact: "0612-2371715" },
    { id: 10, name: "IIM Bodh Gaya", location: "Bodh Gaya", type: "National Importance", established: "2015", website: "https://iimbg.ac.in", courses: "MBA, Ph.D", contact: "0631-2200238" }
];

// Study Materials
const studyMaterials = {
    ssc: [
        { title: "SSC CGL Complete", subjects: "Reasoning, Quant, English, GK", link: "https://testbook.com/ssc", type: "Free + Paid" },
        { title: "SSC CHSL Prep", subjects: "Hindi, English, Maths", link: "https://www.sarkariprep.in", type: "Mock Tests" },
        { title: "SSC Previous Papers", subjects: "Last 10 Years", link: "https://ssc.nic.in", type: "Free PDF" }
    ],
    railway: [
        { title: "RRB NTPC Notes", subjects: "Math, Reasoning, GK", link: "https://testbook.com/railway", type: "Complete" },
        { title: "Railway Group D", subjects: "Math, GK, Science", link: "https://www.notopedia.com", type: "Videos" },
        { title: "RRB Previous Papers", subjects: "All Exams", link: "https://indianrailways.gov.in", type: "Free" }
    ],
    bpsc: [
        { title: "BPSC Prelims + Mains", subjects: "History, Geography, Polity", link: "https://bpsc.bih.nic.in", type: "Complete" },
        { title: "BPSC Previous Papers", subjects: "Last 10 Years", link: "https://sarkaripariksha.com/bpsc", type: "PDF" },
        { title: "Bihar Special GK", subjects: "Bihar History, Culture", link: "https://www.freejobalert.com", type: "Free" }
    ],
    banking: [
        { title: "SBI PO Material", subjects: "Reasoning, Quant, English", link: "https://testbook.com/banking", type: "Complete" },
        { title: "IBPS Clerk Prep", subjects: "All Sections", link: "https://www.sarkariprep.in", type: "Tests" },
        { title: "Banking Awareness", subjects: "Current Banking", link: "https://www.affairscloud.com", type: "Monthly" }
    ],
    general: [
        { title: "Current Affairs 2025", subjects: "Daily, Weekly, Monthly", link: "https://www.affairscloud.com", type: "Free" },
        { title: "General Knowledge", subjects: "India, World, Bihar GK", link: "https://data-flair.training/blogs/government-exams-study-material", type: "Complete" }
    ]
};

// Upcoming Exams
const upcomingExams = [
    { id: 1, name: "BPSC 70th CCE Prelims", date: "2026-02-15", daysBeforeAlert: [30, 7, 1] },
    { id: 2, name: "BSSC Inter Level", date: "2026-01-20", daysBeforeAlert: [15, 3, 1] },
    { id: 3, name: "Bihar Police SI", date: "2025-12-15", daysBeforeAlert: [10, 3, 1] },
    { id: 4, name: "RRB NTPC CBT-1", date: "2026-01-15", daysBeforeAlert: [20, 7, 1] }
];

// Latest Results
const latestResults = [
    { id: 1, title: "BPSC TRE 3.0 Result", date: "2025-09-25", link: "https://bpsc.bih.nic.in" },
    { id: 2, title: "Bihar Police SI Result", date: "2025-09-20", link: "https://bpssc.bih.nic.in" },
    { id: 3, title: "BSSC Graduate Level", date: "2025-09-15", link: "https://bssc.bihar.gov.in" }
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
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
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

function extractJobDetails(title, org, category, link) {
    const jobId = `${org}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    const postsMatch = title.match(/(\d+)\s*(post|vacancy|vacancies|पद)/i);
    const advtMatch = title.match(/(advt\.?\s*no\.?|advertisement|विज्ञापन)[:\-]?\s*(\d+\/\d+)/i);
    const dateMatch = title.match(/(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2,4})/);
    
    return {
        id: jobId,
        title: title,
        shortTitle: title.substring(0, 70) + (title.length > 70 ? '...' : ''),
        organization: org,
        organizationShort: org,
        category: category,
        posts: postsMatch ? parseInt(postsMatch[1]) : 'Check notification',
        advtNo: advtMatch ? advtMatch[2] : 'See notification',
        lastDate: dateMatch ? dateMatch[1] : 'Check notification',
        publishDate: new Date().toLocaleDateString('en-IN'),
        salary: 'As per department norms',
        qualification: 'As per notification',
        ageLimit: 'As per rules',
        applicationFee: 'As per category',
        selectionProcess: 'As per notification',
        applyLink: link,
        notificationPDF: link,
        syllabusPDF: link,
        officialWebsite: targetWebsites.find(s => s.name === org)?.url || link,
        autoScraped: true,
        scrapedAt: new Date(),
        importantDates: {
            applicationStart: new Date().toLocaleDateString('en-IN'),
            applicationEnd: 'Check notification',
            examDate: 'TBA',
            admitCard: 'TBA'
        },
        postDetails: [
            { post: 'Various Posts', vacancy: 'See notification', qualification: 'As per notification' }
        ],
        description: `Latest notification from ${org}. Check official notification for complete details.`
    };
}

async function checkForNewJobs() {
    console.log('🔄 Checking for new jobs across all websites...');
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
            
            const newJobs = newNotifications.map(notif => 
                extractJobDetails(notif.title, site.name, site.category, notif.link)
            );
            
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
        console.log('⚠️ CHANNEL_ID not configured. Skipping channel post.');
        return;
    }
    
    try {
        let channelMsg = `🏛️ **NEW JOB ALERT**\n\n`;
        channelMsg += `**${job.title}**\n\n`;
        channelMsg += `**🏢 संगठन:** ${job.organization}\n`;
        channelMsg += `**📋 विज्ञापन:** ${job.advtNo}\n`;
        channelMsg += `**👥 पद:** ${job.posts}\n`;
        channelMsg += `**📅 अंतिम तिथि:** ${job.lastDate}\n`;
        channelMsg += `**🏷️ Category:** ${job.category}\n\n`;
        channelMsg += `**📄 Complete Details:**\n${job.notificationPDF}\n\n`;
        channelMsg += `━━━━━━━━━━━━━━━━━━━━\n`;
        channelMsg += `🤖 @BiharEducationBot - Get Daily Updates!`;
        
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

// ===== SCHEDULED TASKS =====

// Auto-scraper (every 2 hours)
cron.schedule('0 */2 * * *', async () => {
    console.log('🔄 Running scheduled job scraper...');
    
    try {
        const newJobs = await checkForNewJobs();
        
        if (newJobs.length > 0) {
            console.log(`✅ Found ${newJobs.length} new jobs!`);
            
            for (const job of newJobs) {
                await postJobToChannel(job);
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
            
            const summaryMsg = `🔔 **${newJobs.length} New Jobs Posted!**\n\nCheck channel: ${CHANNEL_ID || 'Bot'}\n\nCategories:\n${[...new Set(newJobs.map(j => j.category))].map(cat => `• ${cat}: ${newJobs.filter(j => j.category === cat).length} jobs`).join('\n')}`;
            
            subscribers.forEach((data, chatId) => {
                if (data.alerts) {
                    bot.sendMessage(chatId, summaryMsg, { parse_mode: 'Markdown' });
                }
            });
            
        } else {
            console.log('ℹ️ No new jobs found.');
        }
        
    } catch (error) {
        console.error('❌ Scraper error:', error);
    }
}, {
    timezone: "Asia/Kolkata"
});

// Daily job alerts (9 AM IST)
cron.schedule('0 9 * * *', () => {
    const todayJobs = biharJobs.slice(0, 3);
    
    let alertMsg = '🔔 **Daily Job Alert - ' + new Date().toLocaleDateString('en-IN') + '**\n\n';
    alertMsg += '📢 Today\'s Top Government Jobs:\n\n';
    
    todayJobs.forEach((job, index) => {
        alertMsg += `${index + 1}. **${job.shortTitle}**\n`;
        alertMsg += `   📅 Last Date: ${job.lastDate}\n`;
        alertMsg += `   🔗 ${job.applyLink}\n\n`;
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

// Exam reminders (8 AM IST)
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

// ===== JOB CARD FUNCTIONS =====

function createJobCard(job, chatId) {
    let msg = `🏛️ **${job.title}**\n\n`;
    msg += `**📋 विज्ञापन संख्या:** ${job.advtNo}\n`;
    msg += `**🏢 संगठन:** ${job.organization}\n`;
    msg += `**📅 प्रकाशन तिथि:** ${job.publishDate}\n`;
    msg += `**🔴 अंतिम तिथि:** ${job.lastDate}\n\n`;
    
    msg += `**📊 पद विवरण:**\n`;
    job.postDetails.forEach(post => {
        msg += `• ${post.post}: **${post.vacancy}** पद\n`;
    });
    msg += `\n**कुल पद:** ${job.posts}\n\n`;
    
    msg += `**💰 वेतनमान:** ${job.salary}\n`;
    msg += `**🎓 योग्यता:** ${job.qualification}\n`;
    msg += `**📅 आयु सीमा:** ${job.ageLimit}\n`;
    msg += `**💳 आवेदन शुल्क:** ${job.applicationFee}\n\n`;
    
    msg += `**📝 चयन प्रक्रिया:**\n${job.selectionProcess}\n\n`;
    msg += `**📄 संक्षिप्त विवरण:**\n${job.description}\n\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `Job ID: ${job.id} | 🏷️ ${job.category}`;
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '📄 Notification PDF', url: job.notificationPDF },
                { text: '📝 Apply Online', url: job.applyLink }
            ],
            [
                { text: '📋 Syllabus', url: job.syllabusPDF || job.notificationPDF },
                { text: '🏠 Official Website', url: job.officialWebsite }
            ],
            [
                { text: '💾 Save Job', callback_data: `save_${job.id}` },
                { text: '📤 Share', callback_data: `share_${job.id}` }
            ],
            [
                { text: '⬅️ Previous', callback_data: `job_prev_${job.id}` },
                { text: '📋 Full Details', callback_data: `details_${job.id}` },
                { text: 'Next ➡️', callback_data: `job_next_${job.id}` }
            ],
            [
                { text: '🏠 Main Menu', callback_data: 'main_menu' }
            ]
        ]
    };
    
    return { message: msg, keyboard: keyboard };
}

function createFullDetailsPage(job) {
    let msg = `📋 **COMPLETE JOB DETAILS**\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    msg += `**${job.title}**\n\n`;
    
    msg += `**🏢 Organization Details:**\n`;
    msg += `• Name: ${job.organization}\n`;
    msg += `• Website: ${job.officialWebsite}\n`;
    msg += `• Advertisement: ${job.advtNo}\n\n`;
    
    msg += `**📊 Complete Post Details:**\n`;
    job.postDetails.forEach((post, index) => {
        msg += `\n${index + 1}. **${post.post}**\n`;
        msg += `   • Vacancies: ${post.vacancy}\n`;
        msg += `   • Qualification: ${post.qualification}\n`;
    });
    msg += `\n**Total Posts: ${job.posts}**\n\n`;
    
    msg += `**💰 Salary & Benefits:**\n`;
    msg += `• Pay Scale: ${job.salary}\n\n`;
    
    msg += `**🎓 Eligibility Criteria:**\n`;
    msg += `• Education: ${job.qualification}\n`;
    msg += `• Age Limit: ${job.ageLimit}\n\n`;
    
    msg += `**📅 Important Dates:**\n`;
    Object.entries(job.importantDates).forEach(([key, value]) => {
        if (value && value !== "TBA") {
            msg += `• ${key}: ${value}\n`;
        }
    });
    msg += `\n`;
    
    msg += `**💳 Application Fee:**\n${job.applicationFee}\n\n`;
    msg += `**📝 Selection Process:**\n${job.selectionProcess}\n\n`;
    
    if (job.howToApply) {
        msg += `**📌 How to Apply:**\n${job.howToApply}\n\n`;
    }
    
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `⚠️ **Note:** Check official notification for complete details.`;
    
    return msg;
}

// ===== MAIN KEYBOARD =====

const mainKeyboard = {
    inline_keyboard: [
        [
            { text: '🏛️ सरकारी नौकरी', callback_data: 'govt_jobs' },
            { text: '🎓 विश्वविद्यालय', callback_data: 'universities' }
        ],
        [
            { text: '📂 Categories', callback_data: 'categories' },
            { text: '📊 Results', callback_data: 'results' }
        ],
        [
            { text: '📚 Study Material', callback_data: 'study' },
            { text: '👤 Profile', callback_data: 'profile' }
        ]
    ]
};

// ===== BOT COMMANDS =====

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const welcomeMsg = `🏛️ **Bihar Education Bot v5.0 - Complete Edition**

नमस्कार ${msg.from.first_name}! 🙏

✨ **Complete Features:**
🔹 ${biharJobs.length}+ Latest Government Jobs
🔹 Auto Web Scraping (Every 2 hours)
🔹 ${biharUniversities.length} Bihar Universities
🔹 Free Study Materials (All categories)
🔹 Daily Job Alerts (9 AM)
🔹 Exam Reminders (8 AM)
🔹 Auto Channel Posting
🔹 Save & Share Jobs
🔹 Full Job Details with PDF Links

📢 Subscribe for alerts: /subscribe
📚 All commands: /help

नीचे से option चुनें:`;

    bot.sendMessage(chatId, welcomeMsg, {
        reply_markup: mainKeyboard,
        parse_mode: 'Markdown'
    });
    
    if (!users.has(chatId)) {
        users.set(chatId, {
            name: msg.from.first_name,
            username: msg.from.username,
            joinedAt: new Date()
        });
    }
});

bot.onText(/\/help/, (msg) => {
    const helpMsg = `📚 **Available Commands:**

**General:**
/start - Main menu
/jobs - All government jobs
/categories - Jobs by category
/latest - Latest 3 jobs
/universities - Bihar universities
/results - Latest results
/exams - Upcoming exams

**Alerts:**
/subscribe - Enable daily alerts
/unsubscribe - Disable alerts

**Profile:**
/register - Set preferences
/savedjobs - View saved jobs
/profile - Your profile

**Search:**
/search <keyword> - Search jobs

**Admin (authorized only):**
/admin - Admin panel
/scrape - Manual scrape
/database - Database stats
/broadcast - Broadcast message

**Support:**
Contact: @BiharEducationSupport`;

    bot.sendMessage(msg.chat.id, helpMsg, { parse_mode: 'Markdown' });
});

bot.onText(/\/jobs/, (msg) => {
    const chatId = msg.chat.id;
    const jobListMsg = '🏛️ **All Government Jobs:**\n\n';
    
    const jobButtons = biharJobs.map((job, index) => {
        return [{
            text: `${index + 1}. ${job.shortTitle} (${job.posts} posts)`,
            callback_data: `view_job_${job.id}`
        }];
    });
    
    jobButtons.push([{ text: '🏠 Main Menu', callback_data: 'main_menu' }]);
    
    bot.sendMessage(chatId, jobListMsg + 'Select a job to view details:', {
        reply_markup: { inline_keyboard: jobButtons },
        parse_mode: 'Markdown'
    });
});

bot.onText(/\/categories/, (msg) => {
    const categories = [...new Set(biharJobs.map(j => j.category))];
    const catButtons = categories.map(cat => {
        const count = biharJobs.filter(j => j.category === cat).length;
        return [{ text: `${cat} (${count} jobs)`, callback_data: `category_${cat}` }];
    });
    catButtons.push([{ text: '🏠 Main Menu', callback_data: 'main_menu' }]);
    
    bot.sendMessage(msg.chat.id, '📂 **Job Categories:**\n\nSelect category:', {
        reply_markup: { inline_keyboard: catButtons }
    });
});

bot.onText(/\/latest/, (msg) => {
    const latestJobs = biharJobs.slice(0, 3);
    const jobCard = createJobCard(latestJobs[0], msg.chat.id);
    currentJobView.set(msg.chat.id, 0);
    
    bot.sendMessage(msg.chat.id, jobCard.message, {
        reply_markup: jobCard.keyboard,
        parse_mode: 'Markdown'
    });
});

bot.onText(/\/universities/, (msg) => {
    let univMsg = '🎓 **Bihar Universities & Institutes:**\n\n';
    
    biharUniversities.forEach((univ, index) => {
        univMsg += `**${index + 1}. ${univ.name}**\n`;
        univMsg += `📍 ${univ.location} | ${univ.type}\n`;
        univMsg += `📅 Established: ${univ.established}\n`;
        univMsg += `📚 Courses: ${univ.courses}\n`;
        univMsg += `📞 ${univ.contact}\n`;
        univMsg += `🔗 ${univ.website}\n\n`;
    });
    
    bot.sendMessage(msg.chat.id, univMsg, { parse_mode: 'Markdown' });
});

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

bot.onText(/\/subscribe/, (msg) => {
    const chatId = msg.chat.id;
    subscribers.set(chatId, { alerts: true, preferences: [] });
    
    bot.sendMessage(chatId, `✅ **Subscribed Successfully!**\n\nYou will receive:\n🔔 Daily job alerts (9 AM)\n⏰ Exam reminders (8 AM)\n📊 Result notifications\n📢 Channel updates\n\n/unsubscribe - Stop alerts`, {
        parse_mode: 'Markdown'
    });
});

bot.onText(/\/unsubscribe/, (msg) => {
    const chatId = msg.chat.id;
    subscribers.delete(chatId);
    bot.sendMessage(msg.chat.id, '❌ Unsubscribed from all alerts.\n\nSubscribe again: /subscribe');
});

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
                { text: '👮 Police', callback_data: 'pref_police' },
                { text: '🏥 Medical', callback_data: 'pref_medical' }
            ],
            [
                { text: '✅ Done', callback_data: 'pref_done' }
            ]
        ]
    };
    
    bot.sendMessage(chatId, '📝 **User Registration**\n\nSelect your job preferences (Multiple select allowed):', {
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

bot.onText(/\/profile/, (msg) => {
    const chatId = msg.chat.id;
    const profile = userProfiles.get(chatId);
    
    if (!profile) {
        return bot.sendMessage(chatId, '❌ Profile not found.\n\nRegister first: /register');
    }
    
    const profileMsg = `👤 **Your Profile**\n\n📛 Name: ${profile.name}\n🎯 Preferences: ${profile.preferences.length > 0 ? profile.preferences.join(', ') : 'Not set'}\n💾 Saved Jobs: ${profile.savedJobs.length}\n🔔 Subscribed: ${subscribers.has(chatId) ? 'Yes ✅' : 'No ❌'}\n\n/savedjobs - View saved jobs\n/register - Update preferences`;
    
    bot.sendMessage(chatId, profileMsg, { parse_mode: 'Markdown' });
});

bot.onText(/\/savedjobs/, (msg) => {
    const chatId = msg.chat.id;
    const profile = userProfiles.get(chatId);
    
    if (!profile || profile.savedJobs.length === 0) {
        return bot.sendMessage(chatId, '📭 No saved jobs yet.\n\nSave jobs using the 💾 Save button when viewing job details.');
    }
    
    let savedMsg = '💾 **Your Saved Jobs:**\n\n';
    profile.savedJobs.forEach(jobId => {
        const job = biharJobs.find(j => j.id === jobId);
        if (job) {
            savedMsg += `• **${job.shortTitle}**\n`;
            savedMsg += `  📅 Last Date: ${job.lastDate}\n`;
            savedMsg += `  🔗 ${job.applyLink}\n\n`;
        }
    });
    
    bot.sendMessage(chatId, savedMsg, { parse_mode: 'Markdown' });
});

bot.onText(/\/search (.+)/, (msg, match) => {
    const query = match[1].toLowerCase();
    const results = biharJobs.filter(job =>
        job.title.toLowerCase().includes(query) ||
        job.category.toLowerCase().includes(query) ||
        job.organization.toLowerCase().includes(query)
    );
    
    if (results.length === 0) {
        return bot.sendMessage(msg.chat.id, `❌ No jobs found for: "${query}"\n\nTry different keywords like: police, ssc, bpsc, railway, etc.`);
    }
    
    let searchMsg = `🔍 **Search Results for "${query}"** (${results.length}):\n\n`;
    results.slice(0, 10).forEach((job, i) => {
        searchMsg += `${i + 1}. ${job.shortTitle}\n   📂 ${job.category}\n\n`;
    });
    
    if (results.length > 10) {
        searchMsg += `\n... and ${results.length - 10} more results`;
    }
    
    bot.sendMessage(msg.chat.id, searchMsg, { parse_mode: 'Markdown' });
});

// ===== ADMIN COMMANDS =====

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
                { text: '⚙️ Configure', callback_data: 'admin_config' },
                { text: '🏠 Main Menu', callback_data: 'main_menu' }
            ]
        ]
    };
    
    bot.sendMessage(msg.chat.id, '👨‍💼 **Admin Panel**\n\nChoose an option:', {
        reply_markup: adminKeyboard,
        parse_mode: 'Markdown'
    });
});

bot.onText(/\/scrape/, async (msg) => {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Admin only command');
    }
    
    bot.sendMessage(msg.chat.id, '🔄 Starting manual scrape...');
    
    try {
        const newJobs = await checkForNewJobs();
        
        if (newJobs.length > 0) {
            let resultMsg = `✅ **Scrape Complete!**\n\nFound ${newJobs.length} new jobs:\n\n`;
            
            newJobs.forEach((job, index) => {
                resultMsg += `${index + 1}. ${job.shortTitle}\n   📂 ${job.category}\n\n`;
            });
            
            resultMsg += `\nPosting to channel...`;
            bot.sendMessage(msg.chat.id, resultMsg, { parse_mode: 'Markdown' });
            
            for (const job of newJobs) {
                await postJobToChannel(job);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            bot.sendMessage(msg.chat.id, `✅ All ${newJobs.length} jobs posted to channel!`);
            
        } else {
            bot.sendMessage(msg.chat.id, 'ℹ️ No new jobs found. All notifications already scraped.');
        }
        
    } catch (error) {
        bot.sendMessage(msg.chat.id, `❌ Error: ${error.message}`);
    }
});

bot.onText(/\/database/, (msg) => {
    if (!isAdmin(msg.from.id)) return;
    
    const categories = [...new Set([...jobDatabase.values()].map(j => j.category))];
    const autoScraped = [...jobDatabase.values()].filter(j => j.autoScraped).length;
    
    const dbStats = `📊 **Job Database Statistics**\n\nTotal Jobs: ${jobDatabase.size}\nIn Memory: ${biharJobs.length}\nAuto-scraped: ${autoScraped}\nManual: ${jobDatabase.size - autoScraped}\n\nCategories:\n${categories.map(cat => `• ${cat}: ${[...jobDatabase.values()].filter(j => j.category === cat).length}`).join('\n')}`;
    
    bot.sendMessage(msg.chat.id, dbStats, { parse_mode: 'Markdown' });
});

// Continue to final part...
// ===== CALLBACK QUERY HANDLER =====

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const userId = query.from.id;

    // View specific job
    if (data.startsWith('view_job_')) {
        const jobId = data.replace('view_job_', '');
        const job = biharJobs.find(j => j.id == jobId);
        
        if (job) {
            const jobCard = createJobCard(job, chatId);
            currentJobView.set(chatId, biharJobs.findIndex(j => j.id == jobId));
            
            try {
                bot.editMessageText(jobCard.message, {
                    chat_id: chatId,
                    message_id: query.message.message_id,
                    reply_markup: jobCard.keyboard,
                    parse_mode: 'Markdown'
                });
            } catch (error) {
                bot.sendMessage(chatId, jobCard.message, {
                    reply_markup: jobCard.keyboard,
                    parse_mode: 'Markdown'
                });
            }
        }
    }

    // Job navigation (Next/Previous)
    if (data.startsWith('job_next_') || data.startsWith('job_prev_')) {
        const currentIndex = currentJobView.get(chatId) || 0;
        let newIndex = data.startsWith('job_next_') ? currentIndex + 1 : currentIndex - 1;
        
        if (newIndex < 0) newIndex = biharJobs.length - 1;
        if (newIndex >= biharJobs.length) newIndex = 0;
        
        const job = biharJobs[newIndex];
        const jobCard = createJobCard(job, chatId);
        currentJobView.set(chatId, newIndex);
        
        try {
            bot.editMessageText(jobCard.message, {
                chat_id: chatId,
                message_id: query.message.message_id,
                reply_markup: jobCard.keyboard,
                parse_mode: 'Markdown'
            });
        } catch (error) {
            console.log('Edit message error:', error.message);
        }
    }

    // Full details
    if (data.startsWith('details_')) {
        const jobId = data.replace('details_', '');
        const job = biharJobs.find(j => j.id == jobId);
        
        if (job) {
            const fullDetails = createFullDetailsPage(job);
            bot.sendMessage(chatId, fullDetails, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '⬅️ Back to Job Card', callback_data: `view_job_${jobId}` },
                        { text: '🏠 Main Menu', callback_data: 'main_menu' }
                    ]]
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
            const shareMsg = `🏛️ **${job.shortTitle}**\n\n📅 Last Date: ${job.lastDate}\n👥 Posts: ${job.posts}\n📝 Apply: ${job.applyLink}\n\n🤖 Get more jobs: @BiharEducationBot`;
            bot.sendMessage(chatId, shareMsg, { parse_mode: 'Markdown' });
            bot.answerCallbackQuery(query.id, { text: '📤 Share message sent!' });
        }
    }

    // Category filter
    if (data.startsWith('category_')) {
        const category = data.replace('category_', '');
        const filteredJobs = biharJobs.filter(j => j.category === category);
        
        const jobButtons = filteredJobs.map(job => {
            return [{ text: `${job.shortTitle}`, callback_data: `view_job_${job.id}` }];
        });
        jobButtons.push([{ text: '⬅️ All Categories', callback_data: 'categories' }]);
        jobButtons.push([{ text: '🏠 Main Menu', callback_data: 'main_menu' }]);
        
        bot.editMessageText(`📂 **${category} Jobs** (${filteredJobs.length})\n\nSelect job:`, {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: { inline_keyboard: jobButtons }
        });
    }

    // Main menu sections
    if (data === 'govt_jobs') {
        const jobButtons = biharJobs.slice(0, 6).map(job => {
            return [{ text: `${job.shortTitle}`, callback_data: `view_job_${job.id}` }];
        });
        jobButtons.push([{ text: '📋 View All Jobs', callback_data: 'all_jobs' }]);
        jobButtons.push([{ text: '🏠 Main Menu', callback_data: 'main_menu' }]);
        
        bot.editMessageText('🏛️ **Latest Government Jobs:**\n\nTop 6 jobs:', {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: { inline_keyboard: jobButtons }
        });
    }

    if (data === 'all_jobs') {
        const jobButtons = biharJobs.map((job, i) => {
            return [{ text: `${i + 1}. ${job.shortTitle}`, callback_data: `view_job_${job.id}` }];
        });
        jobButtons.push([{ text: '🏠 Main Menu', callback_data: 'main_menu' }]);
        
        bot.editMessageText('🏛️ **All Jobs:**', {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: { inline_keyboard: jobButtons }
        });
    }

    if (data === 'universities') {
        bot.sendMessage(chatId, 'Use /universities command for complete university list with all details.');
    }

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

    if (data === 'results') {
        bot.sendMessage(chatId, 'Use /results for latest exam results.');
    }

    if (data === 'study') {
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
        
        bot.editMessageText('📚 **Study Material Categories:**\n\nSelect category:', {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: studyKeyboard
        });
    }

    // Study material categories
    if (data.startsWith('study_')) {
        const category = data.replace('study_', '');
        const materials = studyMaterials[category];
        
        if (materials) {
            let msg = `📚 **${category.toUpperCase()} Study Materials:**\n\n`;
            materials.forEach((m, i) => {
                msg += `${i + 1}. **${m.title}**\n`;
                msg += `📚 ${m.subjects}\n`;
                msg += `🔗 ${m.link}\n`;
                msg += `📄 ${m.type}\n\n`;
            });
            bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
        }
    }

    if (data === 'profile') {
        bot.sendMessage(chatId, 'Use /profile to view your complete profile.\n\n/register - Update preferences\n/savedjobs - View saved jobs');
    }

    if (data === 'saved') {
        const profile = userProfiles.get(chatId);
        if (!profile || profile.savedJobs.length === 0) {
            bot.sendMessage(chatId, '📭 No saved jobs.\n\nUse /jobs to browse and save jobs.');
        } else {
            bot.sendMessage(chatId, `Use /savedjobs to view your ${profile.savedJobs.length} saved jobs.`);
        }
    }

    if (data === 'main_menu') {
        bot.editMessageText('🏠 **Main Menu:**\n\nChoose an option:', {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: mainKeyboard
        });
    }

    // Preferences
    if (data.startsWith('pref_') && data !== 'pref_done') {
        const pref = data.replace('pref_', '');
        const profile = userProfiles.get(chatId) || { name: query.from.first_name, preferences: [], savedJobs: [] };
        
        if (!profile.preferences.includes(pref)) {
            profile.preferences.push(pref);
            userProfiles.set(chatId, profile);
            bot.answerCallbackQuery(query.id, { text: `✅ ${pref.toUpperCase()} added!` });
        } else {
            bot.answerCallbackQuery(query.id, { text: 'Already added!' });
        }
    }

    if (data === 'pref_done') {
        const profile = userProfiles.get(chatId);
        bot.sendMessage(chatId, `✅ **Profile Saved!**\n\nYour preferences: ${profile.preferences.join(', ')}\n\nYou'll receive relevant job alerts.\n\n/profile - View profile`);
    }

    // Admin callbacks
    if (data === 'admin_stats' && isAdmin(userId)) {
        const categories = [...new Set(biharJobs.map(j => j.category))];
        const statsMsg = `📊 **Bot Statistics**\n\n👥 Total Users: ${users.size}\n🔔 Subscribers: ${subscribers.size}\n👤 Registered Profiles: ${userProfiles.size}\n🏛️ Jobs Listed: ${biharJobs.length}\n📊 Job Database: ${jobDatabase.size}\n🎓 Universities: ${biharUniversities.length}\n📂 Categories: ${categories.length}\n⏰ Server Uptime: ${Math.floor(process.uptime() / 60)} minutes\n📅 Date: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;
        
        bot.sendMessage(chatId, statsMsg, { parse_mode: 'Markdown' });
    }

    if (data === 'admin_broadcast' && isAdmin(userId)) {
        bot.sendMessage(chatId, '📢 **Broadcast Message**\n\nSend your message now to broadcast to all users.\n\n/cancel to cancel');
        userStates.set(chatId, 'awaiting_broadcast');
    }

    if (data === 'admin_users' && isAdmin(userId)) {
        let userList = '👥 **Recent Users (Last 10):**\n\n';
        const recentUsers = Array.from(users.entries()).slice(-10);
        recentUsers.forEach(([id, user]) => {
            userList += `• ${user.name} (@${user.username || 'N/A'})\n  ID: ${id}\n`;
        });
        
        bot.sendMessage(chatId, userList, { parse_mode: 'Markdown' });
    }

    if (data === 'admin_subs' && isAdmin(userId)) {
        bot.sendMessage(chatId, `🔔 **Subscribers:**\n\nTotal: ${subscribers.size}\nActive alerts: ${Array.from(subscribers.values()).filter(s => s.alerts).length}`);
    }

    if (data === 'admin_config' && isAdmin(userId)) {
        const configButtons = targetWebsites.map(site => {
            return [{
                text: `${site.enabled ? '✅' : '❌'} ${site.name}`,
                callback_data: `toggle_${site.name}`
            }];
        });
        configButtons.push([{ text: '🏠 Admin Panel', callback_data: 'admin_panel' }]);
        
        bot.sendMessage(chatId, '⚙️ **Scraper Configuration**\n\nToggle websites:', {
            reply_markup: { inline_keyboard: configButtons }
        });
    }

    // Toggle website scraping
    if (data.startsWith('toggle_') && isAdmin(userId)) {
        const siteName = data.replace('toggle_', '');
        const site = targetWebsites.find(s => s.name === siteName);
        
        if (site) {
            site.enabled = !site.enabled;
            bot.answerCallbackQuery(query.id, {
                text: `${site.name} is now ${site.enabled ? 'ENABLED ✅' : 'DISABLED ❌'}`
            });
        }
    }

    if (data === 'admin_panel' && isAdmin(userId)) {
        const adminKeyboard = {
            inline_keyboard: [
                [
                    { text: '📊 Statistics', callback_data: 'admin_stats' },
                    { text: '📢 Broadcast', callback_data: 'admin_broadcast' }
                ],
                [
                    { text: '👥 Users', callback_data: 'admin_users' },
                    { text: '🔔 Subscribers', callback_data: 'admin_subs' }
                ],
                [
                    { text: '⚙️ Configure', callback_data: 'admin_config' },
                    { text: '🏠 Main', callback_data: 'main_menu' }
                ]
            ]
        };
        
        bot.editMessageText('👨‍💼 **Admin Panel**', {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: adminKeyboard
        });
    }

    bot.answerCallbackQuery(query.id);
});

// ===== BROADCAST HANDLER =====

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
            bot.sendMessage(chatId, `✅ **Broadcast Complete!**\n\nSent: ${sentCount}\nFailed: ${failCount}\nTotal users: ${users.size}`);
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
        version: '5.0 - Complete Edition with Auto Scraping',
        features: [
            'Detailed Job Cards',
            'Auto Web Scraping',
            'Channel Auto-Posting',
            'Daily Job Alerts',
            'Exam Reminders',
            'Study Materials',
            'User Profiles',
            'Admin Panel',
            'Save & Share Jobs',
            'University Information',
            'Result Alerts'
        ],
        stats: {
            users: users.size,
            subscribers: subscribers.size,
            profiles: userProfiles.size,
            jobs: biharJobs.length,
            database: jobDatabase.size,
            universities: biharUniversities.length,
            uptime: Math.floor(process.uptime() / 60) + ' minutes'
        },
        endpoints: {
            health: '/health',
            stats: '/stats',
            jobs: '/jobs'
        }
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

app.get('/stats', (req, res) => {
    res.json({
        users: users.size,
        subscribers: subscribers.size,
        profiles: userProfiles.size,
        jobs: biharJobs.length,
        jobDatabase: jobDatabase.size,
        universities: biharUniversities.length,
        categories: [...new Set(biharJobs.map(j => j.category))],
        uptime: process.uptime()
    });
});

app.get('/jobs', (req, res) => {
    res.json({
        total: biharJobs.length,
        categories: [...new Set(biharJobs.map(j => j.category))],
        jobs: biharJobs.map(j => ({
            id: j.id,
            title: j.shortTitle,
            organization: j.organizationShort,
            category: j.category,
            posts: j.posts,
            lastDate: j.lastDate,
            applyLink: j.applyLink
        }))
    });
});

app.get('/universities', (req, res) => {
    res.json({
        total: biharUniversities.length,
        universities: biharUniversities
    });
});

// Error handling
bot.on('error', (error) => {
    console.error('❌ Bot Error:', error);
});

bot.on('polling_error', (error) => {
    console.error('❌ Polling Error:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled Rejection:', error);
});

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🌐 Server running on port ${PORT}`);
});

// Bot startup messages
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🏛️ Bihar Education Bot v5.0 - Complete Edition');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ Bot: @BiharEducationBot');
console.log('📊 Features: All Advanced Features Enabled');
console.log(`📂 ${biharJobs.length} jobs loaded`);
console.log(`🎓 ${biharUniversities.length} universities loaded`);
console.log(`📢 Channel: ${CHANNEL_ID || 'Not configured'}`);
console.log(`👨‍💼 Admins: ${ADMIN_IDS.length}`);
console.log('🔄 Auto-scraping: Every 2 hours');
console.log('🔔 Daily alerts: 9 AM IST');
console.log('⏰ Exam reminders: 8 AM IST');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🚀 Bot is ready and running!');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// Run initial scrape after 1 minute (if admin configured)
if (ADMIN_IDS.length > 0) {
    setTimeout(async () => {
        console.log('🚀 Running initial scrape...');
        try {
            const initialJobs = await checkForNewJobs();
            console.log(`✅ Initial scrape complete: ${initialJobs.length} new jobs found`);
        } catch (error) {
            console.error('❌ Initial scrape failed:', error.message);
        }
    }, 60000); // 1 minute delay
}
