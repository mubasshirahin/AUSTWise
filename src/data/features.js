import {
  Activity, AlarmClock, Archive, Award, BadgeCheck, Banknote, BarChart3, BookOpen, Bus,
  Calculator, CalendarDays, CalendarRange, ClipboardCheck, Coffee, Coins, DoorOpen, Eye, FileText,
  Fingerprint, Flag, Flame, Folder, FolderOpen, Gamepad2, GitBranch, Globe, Grid3x3,
  Handshake, Home, Hourglass, KeyRound, LayoutDashboard, LayoutGrid, Leaf, Library, Map, MapPin,
  Megaphone, MessageCircle, MessageSquare, Orbit, Palette, Puzzle, Radio, ScrollText, Search,
  Settings, ShieldCheck, ShoppingBag, Skull, SlidersHorizontal, Star, Store, Sun, Timer, TrendingUp,
  Trophy, Tv, UserCheck, UserCog, Users, Utensils, Wallet, Zap,
} from 'lucide-react';

// ─── Accent helpers (theme-driven, same vars the rest of the landing page uses) ───
const C = {
  blue: 'var(--accent-blue)',
  blueGlow: 'var(--accent-blue-glow)',
  amber: 'var(--accent-amber)',
  amberGlow: 'var(--accent-amber-glow)',
  emerald: 'var(--accent-emerald)',
  emeraldGlow: 'var(--accent-emerald-glow)',
  purple: 'var(--accent-purple)',
  purpleGlow: 'var(--accent-purple-glow)',
  cyan: 'var(--accent-cyan)',
  cyanGlow: 'var(--accent-cyan-glow)',
  orange: 'var(--accent-orange)',
  orangeGlow: 'var(--accent-orange-glow)',
  rose: 'var(--accent-rose)',
  roseGlow: 'var(--accent-rose-glow)',
};

// ─── MODULES ───
// The authoritative model of the product: 13 modules holding 55 features total.
// The grid section renders one card per module; the expandable "See What You Get"
// panel lists module.features (with a Coming Soon badge where comingSoon is set).
export const modules = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    tagline: 'Your academic command center',
    description: 'Everything you need to start your day — CGPA, classes, deadlines, attendance and your full routine in one glance.',
    color: C.blue,
    glow: C.blueGlow,
    features: [
      { title: 'At a Glance' },
      { title: 'Daily Flow' },
      { title: 'Notice Board' },
      { title: 'Deadlines' },
      { title: 'Routine Grid' },
      { title: '14-Week View' },
      { title: 'Zero Hour' },
      { title: 'Attendance Tracker' },
    ],
  },
  {
    icon: Sun,
    title: 'Daily Life',
    tagline: 'The little things, handled',
    description: 'Campus-life utilities — cover pages, mess bills, expense tracking and everyday tools — so the small stuff stops eating your time.',
    color: C.amber,
    glow: C.amberGlow,
    features: [
      { title: 'Cover Page Generator' },
      { title: 'Bhara Koto', comingSoon: true },
      { title: 'Taka Gelo Koi', comingSoon: true },
      { title: 'Mass Meal Manager', comingSoon: true },
      { title: 'Digital Footprint Cleaner', comingSoon: true },
      { title: 'Password Manager', comingSoon: true },
    ],
  },
  {
    icon: BarChart3,
    title: 'Grade Lab',
    tagline: 'Visualise your academic performance',
    description: 'CGPA trends, department heatmaps and per-course analysis that show exactly where you stand — and where to aim next.',
    color: C.emerald,
    glow: C.emeraldGlow,
    features: [
      { title: 'CGPA Calculator' },
      { title: 'Semester Wise Tracker' },
      { title: 'Dept. Heatmap' },
      { title: 'Best & Worst' },
      { title: 'Prerequisites' },
    ],
  },
  {
    icon: Map,
    title: 'InsideAUST',
    tagline: 'Navigate AUST like a pro',
    description: 'Floor maps, faculty status, library pulse, canteen and bus tracking — the campus, decoded in real time.',
    color: C.cyan,
    glow: C.cyanGlow,
    features: [
      { title: 'Floor Map', comingSoon: true },
      { title: 'Faculty Status' },
      { title: 'Library Pulse', comingSoon: true },
      { title: 'Canteen Menu' },
      { title: 'Bus Tracker', comingSoon: true },
      { title: 'Free Rooms' },
    ],
  },
  {
    icon: Archive,
    title: 'Resource Vault',
    tagline: 'All your study materials, one click away',
    description: 'Past papers, notes, playlists and question banks organised by department, semester and course.',
    color: C.purple,
    glow: C.purpleGlow,
    features: [
      { title: 'Batch Vault' },
      { title: 'Atlas Vault', comingSoon: true },
      { title: 'Carbon Vault', comingSoon: true },
    ],
  },
  {
    icon: BookOpen,
    title: 'Notebook',
    tagline: 'Your notes, always in reach',
    description: 'A private notebook for quick notes, cheatsheets and references that live right on your device.',
    color: C.blue,
    glow: C.blueGlow,
    features: [
      { title: 'Local Vault' },
    ],
  },
  {
    icon: Users,
    title: 'Community',
    tagline: 'Connect with the entire AUST community',
    description: 'Directories, mentors and clubs — find classmates, alumni and seniors in one social hub.',
    color: C.amber,
    glow: C.amberGlow,
    features: [
      { title: 'Faculty Directory', comingSoon: true },
      { title: 'Alumni Directory' },
      { title: 'Student Directory' },
      { title: 'Mentor Request' },
      { title: 'Clubs Hub', comingSoon: true },
    ],
  },
  {
    icon: MessageSquare,
    title: 'ConnectBox',
    tagline: 'Real-time chat for courses & groups',
    description: 'Course chats, lab groups and faculty DMs — all your conversations in one organised space.',
    color: C.orange,
    glow: C.orangeGlow,
    features: [
      { title: 'Messages' },
    ],
  },
  {
    icon: Zap,
    title: 'Productivity',
    tagline: 'Focus tools that keep you moving',
    description: 'Study zones, cheat sheets and workspaces built to cut distractions and speed up revision.',
    color: C.emerald,
    glow: C.emeraldGlow,
    features: [
      { title: 'Study Zone' },
      { title: 'Cheat Sheets' },
      { title: 'Code Pulse', comingSoon: true },
      { title: 'Workspace' },
    ],
  },
  {
    icon: ShoppingBag,
    title: 'Marketplace',
    tagline: 'Buy, sell, rent, and find housing',
    description: 'Textbooks, rentals, lost items and mentor requests — the campus economy in one place.',
    color: C.orange,
    glow: C.orangeGlow,
    features: [
      { title: 'AW Market' },
      { title: 'To-Let Mama' },
      { title: 'Lost & Found' },
    ],
  },
  {
    icon: Gamepad2,
    title: 'DownTime',
    tagline: 'Take a break, the AUSTWise way',
    description: 'Media tracking, trivia, gaming and campus gossip — fun features to switch off between classes.',
    color: C.rose,
    glow: C.roseGlow,
    features: [
      { title: 'Media Tracker', comingSoon: true },
      { title: 'Rumour or Real', comingSoon: true },
      { title: 'Trivia', comingSoon: true },
      { title: 'Gaming Zone', comingSoon: true },
    ],
  },
  {
    icon: Eye,
    title: 'Shadow',
    tagline: 'Honest feedback, zero judgment',
    description: 'Anonymous course reviews, shadow chat and community buzz — real opinions from real students.',
    color: C.purple,
    glow: C.purpleGlow,
    features: [
      { title: 'Course Reviews' },
      { title: 'Shadow Chat' },
      { title: 'Buzz' },
      { title: 'Roast CV', comingSoon: true },
    ],
  },
  {
    icon: Settings,
    title: 'Settings',
    tagline: 'Make AUSTWise truly yours',
    description: 'Identity, orbits, interface and configuration — tune the app to match how you work.',
    color: C.cyan,
    glow: C.cyanGlow,
    features: [
      { title: 'Identity' },
      { title: 'My Orbits' },
      { title: 'UI' },
      { title: 'Configure' },
      { title: 'Credits' },
    ],
  },
];

// ─── STACKING HIGHLIGHTS (5) ───
// "Campus Companion" sticky deck — one-line hooks, no bullet lists.
// Feature-level items, each inheriting its parent module's color/glow.
export const stackingHighlights = [
  {
    icon: Folder,
    title: 'Local Vault',
    tagline: 'Notes, right on your device',
    description: 'A private notebook that lives locally — no cloud, no worries.',
    color: C.blue,
    glow: C.blueGlow,
    benefits: [],
  },
  {
    icon: MessageSquare,
    title: 'Messages',
    tagline: 'Course chats, all in one place',
    description: 'Every conversation with your batch, lab group and faculty in a single inbox.',
    color: C.orange,
    glow: C.orangeGlow,
    benefits: [],
  },
  {
    icon: LayoutGrid,
    title: 'Workspace',
    tagline: 'Your tools, arranged around you',
    description: 'A personalised hub that keeps the modules you use most one click away.',
    color: C.emerald,
    glow: C.emeraldGlow,
    benefits: [],
  },
  {
    icon: Orbit,
    title: 'My Orbits',
    tagline: 'Your world, orbiting you',
    description: 'A visual constellation of your courses, credits and achievements.',
    color: C.cyan,
    glow: C.cyanGlow,
    benefits: [],
  },
  {
    icon: Home,
    title: 'To-Let Mama',
    tagline: 'Find your next place near campus',
    description: 'Bachelor rentals and shared apartments, listed by fellow students.',
    color: C.orange,
    glow: C.orangeGlow,
    benefits: [],
  },
];

// ─── CURSOR SPOTLIGHT (9) ───
// "Right Behind Your Cursor" trail — one flagship feature per module,
// the most "wow" ones. Rendered by ImageTrailShowcase (icon, title, tagline, color).
export const cursorSpotlight = [
  { icon: ClipboardCheck, title: 'Attendance Tracker', tagline: 'Your attendance, always on track', color: C.blue, glow: C.blueGlow },
  { icon: Calculator, title: 'CGPA Calculator', tagline: 'Know your exact CGPA', color: C.emerald, glow: C.emeraldGlow },
  { icon: FolderOpen, title: 'Batch Vault', tagline: "Your batch's entire question bank", color: C.purple, glow: C.purpleGlow },
  { icon: DoorOpen, title: 'Free Rooms', tagline: 'Find an empty room, instantly', color: C.cyan, glow: C.cyanGlow },
  { icon: Handshake, title: 'Mentor Request', tagline: 'Get guidance from seniors', color: C.amber, glow: C.amberGlow },
  { icon: Store, title: 'AW Market', tagline: 'Buy, sell and rent campus-side', color: C.orange, glow: C.orangeGlow },
  { icon: Star, title: 'Course Reviews', tagline: 'Honest reviews from real students', color: C.purple, glow: C.purpleGlow },
  { icon: FileText, title: 'Cover Page Generator', tagline: 'Beautiful cover pages in seconds', color: C.amber, glow: C.amberGlow },
  { icon: Timer, title: 'Study Zone', tagline: 'Deep focus, zero distractions', color: C.emerald, glow: C.emeraldGlow },
];

// ─── TICKER FEATURES (41) ───
// "Rolling By" horizontal band — everything not already used in the two
// highlight slices above, grouped by module color for visual rhythm.
// Rendered by HorizontalFeatures (icon, color, glow, tagline, title, description, benefits).
export const tickerFeatures = [
  // Dashboard · blue
  { icon: Eye, title: 'At a Glance', tagline: 'Your day at a glance', description: 'CGPA, classes and deadlines on one calm screen.', color: C.blue, glow: C.blueGlow, benefits: ['Live CGPA & credits', "Today's classes up front", 'Pending deadlines visible'] },
  { icon: CalendarDays, title: 'Daily Flow', tagline: 'Follow your day, hour by hour', description: 'A clean timeline of everything from lectures to canteen breaks.', color: C.blue, glow: C.blueGlow, benefits: ['Hour-by-hour timeline', 'Rooms & faculty names', 'Break planning built in'] },
  { icon: Megaphone, title: 'Notice Board', tagline: 'Official notices, zero scrolling', description: 'Exam schedules and announcements, all in one feed.', color: C.blue, glow: C.blueGlow, benefits: ['Exam & holiday notices', 'Pinned urgent updates', 'CR/SR announcements'] },
  { icon: AlarmClock, title: 'Deadlines', tagline: 'Never miss a submission again', description: 'Assignments, quizzes and exams tracked with smart alerts.', color: C.blue, glow: C.blueGlow, benefits: ['Assignment due alerts', 'Quiz & exam reminders', 'Priority sorting'] },
  { icon: Grid3x3, title: 'Routine Grid', tagline: 'Your whole week, one grid', description: 'The full weekly routine with rooms and faculty on every class.', color: C.blue, glow: C.blueGlow, benefits: ['Full weekly grid', 'Room numbers included', 'Faculty on every class'] },
  { icon: CalendarRange, title: '14-Week View', tagline: 'See the whole semester ahead', description: 'Fourteen weeks of classes, labs and breaks at a glance.', color: C.blue, glow: C.blueGlow, benefits: ['Semester-long overview', 'Lab slots included', 'Holiday gaps visible'] },
  { icon: Hourglass, title: 'Zero Hour', tagline: 'Find your free slot', description: 'Instantly spot the hours when you are actually free.', color: C.blue, glow: C.blueGlow, benefits: ['Free-slot detection', 'Group-friendly timing', 'One-tap planning'] },
  // Daily Life · amber
  { icon: Wallet, title: 'Bhara Koto', tagline: 'Mess bills, sorted', description: 'Track shared mess and meal expenses without spreadsheet drama.', color: C.amber, glow: C.amberGlow, benefits: ['Shared bill splitting', 'Per-person balances', 'Monthly summaries'] },
  { icon: Banknote, title: 'Taka Gelo Koi', tagline: 'Where did the money go?', description: 'A simple spend tracker that shows where your taka goes.', color: C.amber, glow: C.amberGlow, benefits: ['Spending categories', 'Monthly insights', 'Easy manual entry'] },
  { icon: Utensils, title: 'Mass Meal Manager', tagline: 'Mess management, minus the mess', description: 'Plan meals, collect dues and keep the mess running smoothly.', color: C.amber, glow: C.amberGlow, benefits: ['Meal planning', 'Due collection tracker', 'Member lists'] },
  { icon: ShieldCheck, title: 'Digital Footprint Cleaner', tagline: 'Tidy up your online trail', description: 'Find and clear the digital crumbs you leave across the web.', color: C.amber, glow: C.amberGlow, benefits: ['Account sweep checklist', 'Privacy quick wins', 'Guided cleanups'] },
  { icon: KeyRound, title: 'Password Manager', tagline: 'One master key for everything', description: 'Store and autofill campus passwords, safely and locally.', color: C.amber, glow: C.amberGlow, benefits: ['Encrypted vault', 'Quick autofill', 'Local-only storage'] },
  // Grade Lab · emerald
  { icon: TrendingUp, title: 'Semester Wise Tracker', tagline: "Track every semester's arc", description: 'See how each semester shapes your overall story.', color: C.emerald, glow: C.emeraldGlow, benefits: ['Per-semester CGPA', 'Credit-weighted view', 'Progress trends'] },
  { icon: Flame, title: 'Dept. Heatmap', tagline: 'Know the grading landscape', description: 'Grade distributions across batches, at a glance.', color: C.emerald, glow: C.emeraldGlow, benefits: ['Batch-wise distribution', 'Course difficulty feel', 'Easy comparisons'] },
  { icon: Trophy, title: 'Best & Worst', tagline: 'Know your strengths', description: 'See which courses you ace and which need more work.', color: C.emerald, glow: C.emeraldGlow, benefits: ['Top performers list', 'Weak-spot alerts', 'Focused revision plan'] },
  { icon: GitBranch, title: 'Prerequisites', tagline: 'Plan your roadmap safely', description: 'Course prerequisite trees that stop you planning into a corner.', color: C.emerald, glow: C.emeraldGlow, benefits: ['Prereq dependency map', 'Safe semester planning', 'Blocked-course alerts'] },
  // InsideAUST · cyan
  { icon: MapPin, title: 'Floor Map', tagline: 'Never hunt for a room again', description: 'Interactive floor plans for every building and corridor.', color: C.cyan, glow: C.cyanGlow, benefits: ['Room-level floor plans', 'Quick location search', 'Building-wise maps'] },
  { icon: UserCheck, title: 'Faculty Status', tagline: 'Is your teacher in?', description: 'See which faculty are in their offices right now.', color: C.cyan, glow: C.cyanGlow, benefits: ['Live office status', 'Office hours display', 'No wasted trips'] },
  { icon: Library, title: 'Library Pulse', tagline: 'Seats, in real time', description: 'Live occupancy across every study zone in the library.', color: C.cyan, glow: C.cyanGlow, benefits: ['Live seat counts', 'Zone-wise occupancy', 'Best-time alerts'] },
  { icon: Coffee, title: 'Canteen Menu', tagline: 'Skip the lunch rush', description: "Today's menu and crowd levels before you head down.", color: C.cyan, glow: C.cyanGlow, benefits: ['Daily menu preview', 'Crowd index', 'Peak-hour alerts'] },
  { icon: Bus, title: 'Bus Tracker', tagline: 'Know when the bus arrives', description: 'Live transport ETAs so you never wait in the heat.', color: C.cyan, glow: C.cyanGlow, benefits: ['Live bus ETAs', 'Route details', 'Stop reminders'] },
  // Resource Vault · purple
  { icon: Globe, title: 'Atlas Vault', tagline: 'Every course, every resource', description: 'A growing atlas of notes, slides and links per course.', color: C.purple, glow: C.purpleGlow, benefits: ['Course-wise organisation', 'Slides & notes', 'Community additions'] },
  { icon: Leaf, title: 'Carbon Vault', tagline: 'Notes that give back', description: 'Eco-friendly digital notes replacing endless photocopies.', color: C.purple, glow: C.purpleGlow, benefits: ['Digital-first notes', 'Printable on demand', 'Less paper waste'] },
  // Community · amber
  { icon: UserCog, title: 'Faculty Directory', tagline: 'Find any faculty member', description: 'Departments, offices and contact info in one directory.', color: C.amber, glow: C.amberGlow, benefits: ['Search by department', 'Office & contact info', 'Verified listings'] },
  { icon: Award, title: 'Alumni Directory', tagline: 'Network with graduates', description: 'Find alumni by batch, company and department.', color: C.amber, glow: C.amberGlow, benefits: ['Batch & company search', 'Career networking', 'Direct contact'] },
  { icon: Users, title: 'Student Directory', tagline: 'Find classmates instantly', description: 'Look up any student by name, batch or section.', color: C.amber, glow: C.amberGlow, benefits: ['Search by name/batch', 'Blood group lookup', 'Section filters'] },
  { icon: Flag, title: 'Clubs Hub', tagline: 'Find your people', description: 'Discover and join active AUST clubs in one place.', color: C.amber, glow: C.amberGlow, benefits: ['Club listings', 'Join requests', 'Event announcements'] },
  // Productivity · emerald
  { icon: ScrollText, title: 'Cheat Sheets', tagline: 'Revision, compressed', description: 'Formula summaries and cheat sheets for quick revision.', color: C.emerald, glow: C.emeraldGlow, benefits: ['Formula summaries', 'Course-wise sheets', 'Exam-ready format'] },
  { icon: Activity, title: 'Code Pulse', tagline: 'Watch your code grow', description: 'Track your coding activity and streaks across projects.', color: C.emerald, glow: C.emeraldGlow, benefits: ['Activity streaks', 'Project timelines', 'Consistency insights'] },
  // Marketplace · orange
  { icon: Search, title: 'Lost & Found', tagline: 'Lose it, find it', description: 'Report lost items and help others recover theirs.', color: C.orange, glow: C.orangeGlow, benefits: ['Lost item reports', 'Found item listings', 'Direct contact'] },
  // DownTime · rose
  { icon: Tv, title: 'Media Tracker', tagline: 'Your watchlist, organised', description: 'Track anime, shows and movies you are binging.', color: C.rose, glow: C.roseGlow, benefits: ['Watch progress', 'Ratings & reviews', 'Continue-watching list'] },
  { icon: BadgeCheck, title: 'Rumour or Real', tagline: 'Fact-check the campus gossip', description: "Verify what's true and what's just chatter.", color: C.rose, glow: C.roseGlow, benefits: ['Vote on rumours', 'Community verdicts', 'Anonymous posting'] },
  { icon: Puzzle, title: 'Trivia', tagline: 'Play, learn, flex', description: 'Quick trivia rounds with friends between classes.', color: C.rose, glow: C.roseGlow, benefits: ['Daily trivia', 'Leaderboards', 'Friend challenges'] },
  { icon: Gamepad2, title: 'Gaming Zone', tagline: 'Game nights, campus-wide', description: 'Join custom rooms and tournaments with fellow gamers.', color: C.rose, glow: C.roseGlow, benefits: ['Custom game rooms', 'Tournament nights', 'Squad finder'] },
  // Shadow · purple
  { icon: MessageCircle, title: 'Shadow Chat', tagline: 'Talk without a name', description: 'Anonymous chats where real opinions can finally surface.', color: C.purple, glow: C.purpleGlow, benefits: ['Fully anonymous', 'Topic channels', 'Safe-space rules'] },
  { icon: Radio, title: 'Buzz', tagline: 'The campus grapevine', description: 'A pulse of what students are actually talking about.', color: C.purple, glow: C.purpleGlow, benefits: ['Trending topics', 'Anonymous posts', 'Community reactions'] },
  { icon: Skull, title: 'Roast CV', tagline: 'Harsh truth for your CV', description: 'Anonymous, brutally honest feedback on your resume.', color: C.purple, glow: C.purpleGlow, benefits: ['Anonymous reviews', 'Structured feedback', 'Actionable notes'] },
  // Settings · cyan
  { icon: Fingerprint, title: 'Identity', tagline: 'You, verified', description: 'Manage your profile, roles and academic identity.', color: C.cyan, glow: C.cyanGlow, benefits: ['Profile management', 'Role & batch settings', 'Verified details'] },
  { icon: Palette, title: 'UI', tagline: 'Make it yours', description: 'Tune the interface to match how you work.', color: C.cyan, glow: C.cyanGlow, benefits: ['Theme tweaks', 'Layout options', 'Accessibility settings'] },
  { icon: SlidersHorizontal, title: 'Configure', tagline: 'Fine-tune everything', description: 'Notifications, privacy and app behaviour in one panel.', color: C.cyan, glow: C.cyanGlow, benefits: ['Notification control', 'Privacy toggles', 'App preferences'] },
  { icon: Coins, title: 'Credits', tagline: 'Made by AUST, for AUST', description: 'See the people and stack behind AUSTWise.', color: C.cyan, glow: C.cyanGlow, benefits: ['Contributor list', 'Open-source stack', 'Special thanks'] },
];
