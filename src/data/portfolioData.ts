import defaultSpriteImg from '../assets/images/pixel_arshad_sprite.webp';
import defaultBgImg from '../assets/images/cyberpunk_pixel_city_backdrop_1790255056354.webp';
import contactDiscordIcon from '../assets/images/Contact_discord.webp';
import contactEmailIcon from '../assets/images/Contact_email.webp';
import contactGithubIcon from '../assets/images/Contact_github.webp';
import contactLinkedinIcon from '../assets/images/Contact_linkedin.webp';
import contactSteamIcon from '../assets/images/Contact_steam.webp';

export interface PortfolioConfig {
  name: string;
  ign: string;
  role: string;
  company: string;
  location: string;
  status: string;
  level: number;
  exp: string;
  email: string;
  linkedin: string;
  github: string;
  discord: string;
  steam: string;
  defaultSprite: string;
  defaultBackground: string;
}

export const PORTFOLIO_CONFIG: PortfolioConfig = {
  name: "ARSHAD MOHEMED",
  ign: "LIMP3TZ",
  role: "SENIOR SPECIALIST TRAINER — AD OPS",
  company: "MARKETSTAR",
  location: "BENGALURU, INDIA",
  status: "OPEN TO NEW QUESTS",
  level: 13,
  exp: "13+ YRS",
  email: "limpetz2000@gmail.com",
  linkedin: "https://www.linkedin.com/in/limpetz",
  github: "https://github.com/limpetz",
  discord: "https://discord.com/users/454348790237757461",
  steam: "https://steamcommunity.com/id/limp3tz/",
  defaultSprite: defaultSpriteImg,
  defaultBackground: defaultBgImg,
};

export interface ContactLink {
  id: 'email' | 'linkedin' | 'github' | 'discord' | 'steam';
  label: string;
  /** Full instruction for screen readers, e.g. "Email Arshad". */
  ariaLabel: string;
  href: string;
  icon: string;
  /** Neon accent used for the border, label and hover fill. */
  color: string;
  /** Opens in a new tab (everything except mailto:). */
  external: boolean;
}

/**
 * The five arcade contact channels, in display order. Icons are the shipped
 * 128px WebP cuts (see the asset workflow in the README); full-size PNGs live
 * in the git-ignored `images/.originals/` folder.
 */
export const CONTACT_LINKS: ContactLink[] = [
  {
    id: "email",
    label: "EMAIL",
    ariaLabel: `Email ${PORTFOLIO_CONFIG.name}`,
    href: `mailto:${PORTFOLIO_CONFIG.email}`,
    icon: contactEmailIcon,
    color: "#3dffa2",
    external: false,
  },
  {
    id: "linkedin",
    label: "LINKEDIN",
    ariaLabel: `${PORTFOLIO_CONFIG.name} on LinkedIn`,
    href: PORTFOLIO_CONFIG.linkedin,
    icon: contactLinkedinIcon,
    color: "#00e5ff",
    external: true,
  },
  {
    id: "github",
    label: "GITHUB",
    ariaLabel: `${PORTFOLIO_CONFIG.name} on GitHub`,
    href: PORTFOLIO_CONFIG.github,
    icon: contactGithubIcon,
    color: "#ffd23f",
    external: true,
  },
  {
    id: "discord",
    label: "DISCORD",
    ariaLabel: `${PORTFOLIO_CONFIG.name} on Discord`,
    href: PORTFOLIO_CONFIG.discord,
    icon: contactDiscordIcon,
    color: "#8f6cff",
    external: true,
  },
  {
    id: "steam",
    label: "STEAM",
    ariaLabel: `${PORTFOLIO_CONFIG.name} on Steam`,
    href: PORTFOLIO_CONFIG.steam,
    icon: contactSteamIcon,
    color: "#ff9e3d",
    external: true,
  },
];

export interface SkillItem {
  name: string;
  category: "adops" | "train" | "ai" | "dev" | "qa" | "relics";
  rare: boolean;
}

export const SKILL_CATEGORIES: Record<
  string,
  { label: string; tab: string; color: string; desc: string }
> = {
  adops: {
    label: "AD OPS ARSENAL",
    tab: "AD OPS",
    color: "#ffd23f",
    desc: "Google Ads, Reddit Ads, Shopping, Merchant Center & Campaign Architecture",
  },
  train: {
    label: "TRAINING GUILD",
    tab: "TRAINING",
    color: "#00e5ff",
    desc: "Instructional Design, Curricula Authoring, SDR Enablement & Coaching",
  },
  ai: {
    label: "AI & LLM SORCERY",
    tab: "AI/LLM",
    color: "#3dffa2",
    desc: "Local LLM Deployment (CLI), Custom Chat Scripts & NotebookLM Knowledge Vaults",
  },
  dev: {
    label: "DEV TOOLKIT",
    tab: "DEV",
    color: "#8f6cff",
    desc: "Full-Stack Web, TypeScript, C++, Linux & Automation Scripting",
  },
  qa: {
    label: "QA SYSTEMS",
    tab: "QA",
    color: "#ff2d78",
    desc: "Root Cause Analysis, Audit Scorecards, Edge-Case Debugging & Frameworks",
  },
  relics: {
    label: "HARDWARE RELICS · NVIDIA ERA",
    tab: "RELICS",
    color: "#ff9e3d",
    desc: "GeForce, Quadro, Tegra, x86 Architecture, Device Drivers & Kernel Debugging",
  },
};

export const CORE_SKILL_TREE: Array<{ name: string; level: number; color: string }> = [
  { name: "AD OPERATIONS", level: 95, color: "#00e5ff" },
  { name: "TRAINING & ENABLEMENT", level: 93, color: "#ff2d78" },
  { name: "GOOGLE ADS & SHOPPING", level: 92, color: "#ffd23f" },
  { name: "REDDIT AD OPERATIONS", level: 90, color: "#8f6cff" },
  { name: "QA FRAMEWORKS & RCA", level: 88, color: "#3dffa2" },
  { name: "GOOGLE TAG MANAGER & GA", level: 87, color: "#00e5ff" },
  { name: "APPLIED AI & LLM ENGINEERING", level: 86, color: "#ff2d78" },
  { name: "GENERATIVE AI FOR L&D", level: 84, color: "#8f6cff" },
  { name: "C++ · LINUX · X86", level: 82, color: "#3dffa2" },
  { name: "HTML · CSS · JAVASCRIPT", level: 78, color: "#ffd23f" },
];

export const INVENTORY_SKILLS: SkillItem[] = [
  { name: "Ad Operations", category: "adops", rare: true },
  { name: "Reddit Ads", category: "adops", rare: false },
  { name: "Google Ads", category: "adops", rare: false },
  { name: "Google Shopping", category: "adops", rare: false },
  { name: "Google Merchant Center", category: "adops", rare: false },
  { name: "Google Analytics", category: "adops", rare: false },
  { name: "Google Tag Manager", category: "adops", rare: false },
  { name: "LinkedIn Advertising", category: "adops", rare: false },
  { name: "Account Strategy", category: "adops", rare: false },
  { name: "Advertising Operations", category: "adops", rare: false },
  { name: "Reddit Campaign Setup", category: "adops", rare: false },
  { name: "Training & Development (L&D)", category: "train", rare: true },
  { name: "Training Program Design", category: "train", rare: false },
  { name: "Training and Development (HR)", category: "train", rare: false },
  { name: "SOP Authoring", category: "train", rare: false },
  { name: "Training Delivery", category: "train", rare: false },
  { name: "New Hire Training", category: "train", rare: false },
  { name: "Corporate Training", category: "train", rare: false },
  { name: "Employee Learning & Dev", category: "train", rare: false },
  { name: "Project Management", category: "train", rare: false },
  { name: "Applied AI & LLM Engineering", category: "ai", rare: true },
  { name: "Generative AI", category: "ai", rare: true },
  { name: "Artificial Intelligence for Business", category: "ai", rare: false },
  { name: "Vibe Coding", category: "ai", rare: true },
  { name: "API Documentation", category: "ai", rare: false },
  { name: "TypeScript", category: "dev", rare: false },
  { name: "Node.js", category: "dev", rare: false },
  { name: "C++", category: "dev", rare: false },
  { name: "Java", category: "dev", rare: false },
  { name: "Linux", category: "dev", rare: false },
  { name: "Shell Scripting", category: "dev", rare: false },
  { name: "Programming", category: "dev", rare: false },
  { name: "Software Architecture", category: "dev", rare: false },
  { name: "Quality Assurance Processes", category: "qa", rare: true },
  { name: "Debugging", category: "qa", rare: false },
  { name: "Root Cause Analysis (RCA)", category: "qa", rare: false },
  { name: "Audit Scorecard Design", category: "qa", rare: false },
  { name: "Computer Hardware", category: "relics", rare: false },
  { name: "Computer Architecture", category: "relics", rare: false },
  { name: "Device Drivers", category: "relics", rare: false },
  { name: "Processors", category: "relics", rare: false },
  { name: "Storage Subsystems", category: "relics", rare: false },
  { name: "X86 Assembly & Debugging", category: "relics", rare: false },
  { name: "Firmware", category: "relics", rare: false },
];

export interface QuestItem {
  period: string;
  type: "main" | "ai" | "side" | "tut";
  tag: string;
  title: string;
  org: string;
  desc: string;
  rewards: string[];
}

export const QUESTS_DATA: QuestItem[] = [
  {
    period: "APR 2024 — PRESENT",
    type: "main",
    tag: "MAIN QUEST",
    title: "SENIOR SPECIALIST — TRAINER · AD OPS",
    org: "MARKETSTAR · BENGALURU",
    desc: "Leading Ad Operations SDR training and enablement — QA frameworks, training curricula, audit scorecards, and Root Cause Analysis workflows across Google, Reddit & Facebook Ads. Integrating Gemini, Gong.io, Apollo.io, and Microsoft Copilot into training workflows to automate insights, build coaching frameworks, and keep programs current.",
    rewards: [
      "GOOGLE · REDDIT · FACEBOOK ADS",
      "GEMINI · GONG.IO · APOLLO.IO · COPILOT",
      "AUTOMATED INSIGHTS & COACHING FRAMEWORKS",
    ],
  },
  {
    period: "ONGOING",
    type: "ai",
    tag: "AI QUEST",
    title: "APPLIED AI & LLM ENGINEERING",
    org: "SELF-DIRECTED · DESKTOP LAB",
    desc: "Deploying and running local LLMs on desktop environments via terminal and CLI, writing custom chat scripts for large language models, and architecting knowledge-retention systems on Google NotebookLM that serve as internal databases powering colleagues. The full applied-AI stack: model setup, script integration, workflow automation.",
    rewards: [
      "LOCAL LLM DEPLOYMENT VIA TERMINAL/CLI",
      "CUSTOM CHAT SCRIPTS FOR LLMS",
      "NOTEBOOKLM KNOWLEDGE VAULTS",
    ],
  },
  {
    period: "APR 2022 — APR 2024",
    type: "side",
    tag: "SIDE QUEST",
    title: "SPECIALIST — TRAINER · REDDIT AD OPS",
    org: "MARKETSTAR · BENGALURU",
    desc: "Trained and enabled the Ad Operations SDR squad on Reddit Advertising — curricula, SOPs, audit scorecards, and coaching loops that turned new hires into campaign-ready operators.",
    rewards: [
      "REDDIT ADS TRAINING PROGRAMS",
      "SOP AUTHORING & AUDIT SCORECARDS",
      "NEW-HIRE TRAINING DELIVERY",
    ],
  },
  {
    period: "APR 2021 — MAR 2022",
    type: "side",
    tag: "SIDE QUEST",
    title: "SENIOR ADS CONSULTANT · REDDIT AD OPS",
    org: "MARKETSTAR · BENGALURU",
    desc: "Consulted on Reddit Advertising Operations — account strategy, campaign troubleshooting, and client education in a high-velocity B2B environment.",
    rewards: [
      "ACCOUNT STRATEGY",
      "CAMPAIGN TROUBLESHOOTING",
      "B2B CLIENT EDUCATION & SUPPORT",
    ],
  },
  {
    period: "JUN 2018 — MAR 2021",
    type: "side",
    tag: "SIDE QUEST",
    title: "SR. IMPLEMENTATION SPECIALIST · GOOGLE SHOPPING",
    org: "MARKETSTAR · BENGALURU",
    desc: "Deployed, implemented, enabled, and supported Google tags and Shopping onboarding across Ads, Analytics, Tag Manager, and Merchant Center. Conversion, remarketing, dynamic remarketing, ecommerce, cross-domain, and Google Shopping setups — with tag implementation across WordPress, Shopify, Magento, PrestaShop, Joomla, Shopware, and Wix, plus client support and web maintenance in HTML, CSS & JavaScript.",
    rewards: [
      "ADS · ANALYTICS · GTM · MERCHANT CENTER",
      "7 CMS PLATFORMS: WORDPRESS → WIX",
      "CONVERSION · REMARKETING · DYNAMIC REMARKETING",
    ],
  },
  {
    period: "SEP 2010 — 2015",
    type: "tut",
    tag: "FIRST DUNGEON",
    title: "SOFTWARE QA ENGINEER · SW-GPU",
    org: "NVIDIA · BENGALURU DEV CENTRE",
    desc: "Where it all began. Handled technical problems for GeForce, Quadro, Tegra, Tesla, and SHIELD — isolated issues reported on the NVIDIA forum and tickets from workstations and gaming rigs, reproduced them in the NVIDIA lab, and extracted log files from reported systems to resolve software bugs at the earliest.",
    rewards: [
      "GEFORCE · QUADRO · TEGRA · TESLA · SHIELD",
      "GPU DRIVER BUGS: ISOLATED & REPRODUCED",
      "UNLOCKED PERK: ENGINEERING DISCIPLINE",
    ],
  },
];

export interface ProjectCartridge {
  id: string;
  title: string;
  genre: string;
  color: string;
  desc: string;
  fullOverview: string;
  tech: string[];
  link: string;
  highlights: string[];
}

export const PROJECT_CARTRIDGES: ProjectCartridge[] = [
  {
    id: "heal-cli",
    title: "HEAL CLI",
    genre: "AI CRASH DOCTOR",
    color: "#3dffa2",
    desc: "Autonomous terminal crash doctor & auto-patcher — reads crash logs, diagnoses root causes, and applies code fixes directly in your CLI.",
    fullOverview:
      "An autonomous AI-powered developer CLI utility that eliminates manual error copy-pasting. Heal intercepts terminal crash logs, locates offending files across TypeScript, Python, Rust, and Go, identifies the root cause, and applies interactive unified-diff hotfixes directly in your shell.",
    tech: ["TYPESCRIPT", "NODE.JS", "AST & LLM PATCHING", "TERMINAL CLI", "ERROR DIAGNOSTICS"],
    link: "https://github.com/limpetz/heal-cli",
    highlights: [
      "Zero-friction error detection from piped output, last command, or directory",
      "Multi-language code diagnostics (TypeScript, Python, Rust, Go)",
      "Interactive one-key [y/n] atomic patch application directly in shell",
    ],
  },
  {
    id: "github-activity",
    title: "GITHUB ACTIVITY",
    genre: "LIVE RADAR",
    color: "#00e5ff",
    desc: "Real-time contribution radar & developer telemetry powered by live GitHub REST API — live events, repository analytics, and commit activity.",
    fullOverview:
      "A real-time telemetry console polling the GitHub REST API for live user metrics, public repository telemetry, commit frequencies, issue triage events, and language distributions across the @limpetz ecosystem. Features an 8-bit contribution radar and interactive event feed.",
    tech: ["GITHUB REST API", "REAL-TIME FETCH", "PIXEL HEATMAP", "EVENT RADAR", "OCTOKIT/REST"],
    link: "https://github.com/limpetz",
    highlights: [
      "Real-time GitHub REST API integration polling user events and repos",
      "Interactive 8-bit retro contribution radar and intensity matrix",
      "Live terminal stream displaying code commits, branch creations, and stars",
    ],
  },
  {
    id: "coc-project",
    title: "COC STATS TRACKER",
    genre: "GAMING API",
    color: "#ffd23f",
    desc: "Clash of Clans stats tracker & clan intelligence web app utilizing official Supercell REST APIs for live war monitoring and player comparisons.",
    fullOverview:
      "A feature-rich gaming dashboard that taps into Supercell's official API to surface comprehensive player statistics, town hall levels, hero progress meters, live clan war status (stars & destruction percentages), war log histories, and head-to-head dual player comparisons.",
    tech: ["SUPERCELL API", "REACT / TYPESCRIPT", "REST INTEGRATION", "DATA VIZ", "WAR LOGS"],
    link: "https://github.com/limpetz/COCProject",
    highlights: [
      "Live clan war tracking with real-time star and destruction metrics",
      "Comprehensive player stats with visual hero level progression bars",
      "Side-by-side player comparison matrix across trophies and war stars",
    ],
  },
  {
    id: "llm-deck",
    title: "LOCAL LLM DECK",
    genre: "AI INFRA",
    color: "#00e5ff",
    desc: "Local LLMs deployed and executed on desktop environments via terminal & CLI — custom chat scripts and model setup for private, offline AI workflows.",
    fullOverview:
      "A privacy-first desktop orchestration lab for deploying quantized open-weights models (Llama, Mistral, Qwen, DeepSeek) through command-line interfaces. Includes automated shell harnesses for batch context ingestion, prompt templating, and terminal-native conversational interfaces without telemetry or external API leakage.",
    tech: ["LOCAL LLMS", "TERMINAL/CLI", "CUSTOM SCRIPTS", "OLLAMA / LLAMACPP"],
    link: "https://github.com/limpetz",
    highlights: [
      "Zero-latency terminal-driven chat interfaces",
      "Local document ingestion and RAG summarization scripts",
      "Reproducible environment setups across Linux and Windows",
    ],
  },
  {
    id: "notebooklm-vault",
    title: "NOTEBOOKLM VAULT",
    genre: "KNOWLEDGE BASE",
    color: "#3dffa2",
    desc: "Knowledge-retention systems built on Google NotebookLM — internal living databases that power colleagues with searchable, cited team intelligence.",
    fullOverview:
      "Designed and deployed enterprise knowledge vaults converting messy SOPs, ad platform policy updates, and training transcripts into grounded, verifiable intelligence repositories. Enabled colleagues to query complex ad policies across Google, Reddit, and Meta with instant source citations.",
    tech: ["NOTEBOOKLM", "KNOWLEDGE RETENTION", "WORKFLOW AUTOMATION", "SOP ARCHITECTURE"],
    link: "https://github.com/limpetz",
    highlights: [
      "Reduced SDR policy verification time by over 60%",
      "Synthesized thousands of pages of training materials into living notebooks",
      "Multi-source audio overview generation for rapid onboarding",
    ],
  },
  {
    id: "qa-scorecard",
    title: "QA SCORECARD ENGINE",
    genre: "QA FRAMEWORK",
    color: "#ff2d78",
    desc: "Audit scorecards and Root Cause Analysis workflows for AdOps teams — measurable, repeatable, scalable quality systems across Google, Reddit & Facebook Ads.",
    fullOverview:
      "Engineered rigorous quality assurance scorecards rooted in software QA principles forged during the NVIDIA GPU-driver era. Standardized root-cause analysis (RCA) taxonomies, error isolation protocols, and campaign delivery audits to eradicate recurrent misconfigurations across enterprise ad campaigns.",
    tech: ["QA DESIGN", "AUDIT SCORECARDS", "ROOT CAUSE ANALYSIS", "AD CAMPAIGN AUDITS"],
    link: "https://github.com/limpetz",
    highlights: [
      "Standardized 50+ inspection checkpoints across ad networks",
      "Systematic RCA workflow reducing repeat ticketing by 35%",
      "Data-driven coaching loops directly tied to SDR performance metrics",
    ],
  },
  {
    id: "sdr-bootcamp",
    title: "SDR BOOT CAMP",
    genre: "ENABLEMENT",
    color: "#8f6cff",
    desc: "Comprehensive training curricula and onboarding programs for Ad Operations SDRs — turning raw recruits into autonomous, high-performing campaign operators.",
    fullOverview:
      "Designed and delivered end-to-end enablement programs for high-velocity SDR squads. Blended interactive simulations, live platform drills, and modern tooling (Gong.io, Apollo.io, Gemini) to train operators capable of executing intricate audience targeting, bidding strategies, and conversion tracking.",
    tech: ["CURRICULUM DESIGN", "TRAINING DELIVERY", "L&D FRAMEWORKS", "SIMULATION LABS"],
    link: "https://github.com/limpetz",
    highlights: [
      "Accelerated time-to-first-autonomous-campaign for new hires",
      "Built interactive simulation exercises mimicking production platforms",
      "Blended tech-enabled coaching with measurable milestone gates",
    ],
  },
  {
    id: "wand-enhancer",
    title: "WAND ENHANCER",
    genre: "UX EXTENSION",
    color: "#ff9e3d",
    desc: "Advanced UX and interoperability desktop extension for the Wand (WeMod) app to enhance trainer workflows and client responsiveness.",
    fullOverview:
      "An advanced client-side extension enhancing user experience and workflow interoperability for gaming utilities. Focuses on streamlined inspection tooling, UI responsiveness, and desktop automation hooks.",
    tech: ["TYPESCRIPT", "INSPECTION TOOLS", "UX EXTENSION", "PROCESS HOOKS"],
    link: "https://github.com/limpetz/Wand-Enhancer",
    highlights: [
      "Enhanced user experience overlay and responsive interaction hooks",
      "Streamlined workflow automation and trainer state inspection",
      "Clean modular architecture with robust error handling",
    ],
  },
];

export const MYSTERY_BLOCKS_DATA = [
  {
    key: "name",
    label: "NAME",
    shortLabel: "NAME",
    color: "#00e5ff",
    title: "IDENTIFIER",
    getLine: () => `I'M ARSHAD · AKA ${PORTFOLIO_CONFIG.ign}`,
  },
  {
    key: "role",
    label: "ROLE",
    shortLabel: "ROLE",
    color: "#3dffa2",
    title: "CLASS",
    getLine: () => `CLASS: ${PORTFOLIO_CONFIG.role}`,
  },
  {
    key: "location",
    label: "LOCATION",
    shortLabel: "LOC",
    color: "#ffd23f",
    title: "BASE",
    getLine: () => `BASED IN ${PORTFOLIO_CONFIG.location}`,
  },
  {
    key: "status",
    label: "STATUS",
    shortLabel: "STAT",
    color: "#ff2d78",
    title: "STATUS",
    getLine: () => `${PORTFOLIO_CONFIG.status} · ${PORTFOLIO_CONFIG.company}`,
  },
];

export const IDLE_QUIPS = [
  "CALL ME LIMP3TZ",
  "TRY HEAL CLI: RUN 'heal'",
  "EX-NVIDIA, STILL DEBUGGING",
  "I RUN LOCAL LLMS VIA CLI",
  "ASK ME ABOUT REDDIT ADS",
  "GTM? I GOT YOU COVERED",
  "CLASH OF CLANS STATS TRACKER IN MY REPOS",
  "44 SKILLS COLLECTED IN MY BAG",
  "TRY THE KONAMI CODE: ↑ ↑ ↓ ↓ ← → ← → B A",
  "ONE MISSION: SIMPLIFY COMPLEXITY",
  "LEVEL 13 OPERATOR READY",
];
