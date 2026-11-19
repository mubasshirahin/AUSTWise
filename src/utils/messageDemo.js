// Dev-only demo conversations for ConnectBox. Built in memory per viewer and
// merged into reads only — never saved to localStorage or sent to the server.

export const DEMO_ENABLED = import.meta.env.DEV;

export const DEMO_PEERS = {
  'demo-rafi': { id: 'demo-rafi', name: 'Rafi Hasan', initials: 'RH', role: 'student', department: 'CSE' },
  'demo-nusrat': { id: 'demo-nusrat', name: 'Nusrat Jahan', initials: 'NJ', role: 'student', department: 'EEE' },
  'demo-karim': { id: 'demo-karim', name: 'Dr. Abdul Karim', initials: 'AK', role: 'faculty', department: 'CSE' },
  'demo-tanvir': { id: 'demo-tanvir', name: 'Tanvir Ahmed', initials: 'TA', role: 'student', department: 'ME' },
};

export function isDemoPeer(id) {
  return typeof id === 'string' && id.startsWith('demo-');
}

// [peerId, fromPeer, text, minutesAgo]
const SCRIPT = [
  ['demo-rafi', true, 'Bro, DBMS lab report kobe submit?', 190],
  ['demo-rafi', false, 'Sunday te, 11:59 PM porjonto', 185],
  ['demo-rafi', true, 'ER diagram ta ki hand drawn dite hobe?', 182],
  ['demo-rafi', false, 'Na, draw.io te korleo hobe', 180],
  ['demo-rafi', true, 'Thanks! 🙏', 12],
  ['demo-nusrat', true, 'Circuit lab er notes ta share korte parba?', 1500],
  ['demo-nusrat', false, 'Haan, drive link pathacchi', 1490],
  ['demo-nusrat', true, 'Pelam, thank you ❤️', 1485],
  ['demo-karim', true, 'Your project proposal looks good. Please add a timeline section.', 3000],
  ['demo-karim', false, 'Thank you sir, I will update it by tomorrow.', 2980],
  ['demo-tanvir', true, 'Ajke cafeteria te khela dekhbi?', 45],
  ['demo-tanvir', false, 'Class sesh hole ashtesi', 40],
  ['demo-tanvir', true, 'Ok, 4 tay', 38],
];

export function buildDemoMessages(userId) {
  if (!DEMO_ENABLED || !userId) return [];
  const now = Date.now();
  return SCRIPT.map(([peerId, fromPeer, text, minsAgo], i) => {
    const fromId = fromPeer ? peerId : userId;
    const toId = fromPeer ? userId : peerId;
    return {
      id: `DEMO-${i}`,
      conversationId: [userId, peerId].sort().join('|'),
      fromId,
      toId,
      text,
      timestamp: new Date(now - minsAgo * 60000).toISOString(),
      read: true,
      demo: true,
    };
  });
}
