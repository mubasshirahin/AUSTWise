export const PUBLIC_ROUTES = ['/', '/login', '/features', '/pricing', '/about-us', '/docs', '/blog',
  '/changelog', '/feedback', '/terms', '/privacy', '/cookie-policy'];

export const APP_ROUTES = ['/dashboard/quickstats', '/dashboard/routine', '/routine-templates', '/gradelab',
  '/resource-vault', '/notebook', '/cheat-sheets', '/insideaust', '/community', '/marketplace', '/connectbox',
  '/workspace', '/study-time', '/code-pulse', '/takagelokoi', '/question-bank', '/cover-page-generator',
  '/downtime', '/downtime?tab=gaming', '/roast-cv', '/certificate', '/wakemeup', '/austeddit', '/shadow',
  '/daily-life', '/productivity', '/see-plans', '/settings'];

export const ADMIN_ROUTES = ['/admin-panel/overview', '/admin-panel/access-requests', '/admin-panel/flow-canvas'];

export const ROLES = ['owner', 'admin', 'moderator', 'cr', 'regular'];
export const ADMIN_ROLES = ['owner', 'admin'];

export const THEMES = ['arcade', 'art-deco', 'bitcoindefi', 'blueprint', 'cricket', 'cyberpunk', 'dark', 'fire',
  'forest', 'industrial', 'light', 'lofi', 'meshtopo', 'midnight', 'minimalist-monochrome', 'newsprint', 'nexus',
  'obsidian', 'pastel', 'poster', 'prism', 'sakura', 'sketchbook', 'space', 'swiss', 'terminal', 'toon'];

export const authFile = (role) => `e2e/.auth/${role}.json`;
export const hasRole = (role) => !!process.env[`QA_${role.toUpperCase()}_EMAIL`];
export const slug = (route) => route.replace(/\W+/g, '_');
