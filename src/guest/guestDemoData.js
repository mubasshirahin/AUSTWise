// Demo data shown to guests ("Take a Visit"). Every name and value here is made
// up — none of it comes from a real AUSTWise account. Features without an entry
// fall back to their built-in mock data (src/data/mockData.js) or their empty
// state.

const now = Date.now();
const mins = (m) => now - m * 60 * 1000;

function member(id, name, extra = {}) {
  return {
    id: `demo-${id}`,
    awid: '',
    studentId: '',
    name,
    initials: name.split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase(),
    avatar: null,
    role: 'student',
    roles: ['student'],
    department: 'CSE',
    batch: '',
    batchNo: '',
    batchName: '',
    semester: 5,
    yearSemester: '3.1',
    section: 'A',
    labSection: 'A1',
    designation: '',
    company: '',
    graduationYear: '',
    openForTalk: false,
    phone: '',
    privacy: { showPhone: false },
    status: 'offline',
    lastSeenAt: mins(90),
    attendancePct: null,
    orbit: null,
    ...extra,
  };
}

export const DEMO_MEMBERS = [
  member('1', 'Demo Student', { status: 'online', lastSeenAt: now }),
  member('2', 'Sample Learner', { status: 'online', lastSeenAt: now, department: 'EEE', section: 'B', labSection: 'B2' }),
  member('3', 'Example CR', { role: 'cr', roles: ['student', 'cr'], status: 'idle', lastSeenAt: mins(12) }),
  member('4', 'Preview User', { department: 'ME', yearSemester: '2.2', semester: 4 }),
  member('5', 'Test Alumnus', {
    role: 'alumni', roles: ['alumni'], semester: null, yearSemester: '',
    designation: 'Software Engineer', company: 'Demo Corp', graduationYear: '2022', openForTalk: true,
  }),
  member('6', 'Demo Faculty', { role: 'faculty', roles: ['faculty'], semester: null, yearSemester: '', designation: 'Lecturer' }),
];

// Shared-store values keyed exactly like the real store keys.
export const DEMO_SHARED = {
  'aust-buzz-posts': [
    {
      id: 'demo-post-1', channel: 'general', author: 'demo_owl', authorId: 'demo-1',
      title: 'Welcome to the AUSTWise demo',
      body: 'This is sample content. Sign up with your AUST account to see real posts from your campus.',
      score: 12, timestamp: mins(30), comments: [
        { id: 'demo-c-1', text: 'Looks neat!', authorId: 'demo-2', author: 'sample_fox', score: 3, timestamp: mins(20) },
      ],
    },
    {
      id: 'demo-post-2', channel: 'academic', author: 'example_cat', authorId: 'demo-3',
      title: 'Any tips for the data structures lab?',
      body: 'Demo post. Real questions and answers are visible after you sign up.',
      score: 5, timestamp: mins(240), comments: [],
    },
  ],
};
