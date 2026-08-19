// Mock data for the AUSTWise application
// All data is realistic but fictional

export const currentUser = {
  id: '',
  name: '',
  email: '',
  department: '',
  batch: '',
  semester: 1,
  section: '',
  avatar: null,
  initials: '',
  cgpa: 0,
  creditsCompleted: 0,
  totalCredits: 160,
};

export const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

export const routineData = {
  Sunday: [],
  Monday: [],
  Tuesday: [],
  Wednesday: [],
  Thursday: [],
};

export const attendanceData = [];

export const deadlines = [];

export const notices = [];

export const semesterResults = [];

export const questionBank = [];

export const topicFrequency = {};

export const materialFolders = [];

export const playlists = [];

export const skillRoadmaps = [];

export const cheatsheets = [];

export const campusFloors = [
  { floor: 'Ground', mapImage: '/campus/ground-floor.png', rooms: [
    { id: 'G-01', name: 'M.H Khan Auditorium', type: 'hall', hotspot: { left: 18, top: 20, width: 12, height: 15 } },
    { id: 'G-02', name: 'Redex Photocopy', type: 'admin', hotspot: { left: 30, top: 20, width: 15, height: 15 } },
    { id: 'G-03', name: "Girl's Common Room", type: 'facility', hotspot: { left: 45, top: 15, width: 33, height: 10 } },
    { id: 'G-04', name: 'Badamtola', type: 'hall', hotspot: { left: 40, top: 35, width: 33, height: 30 } },
    { id: 'G-05', name: 'RedX', type: 'facility', hotspot: { left: 20, top: 40, width: 17, height: 40 } },
    { id: 'G-06', name: 'Canteen', type: 'facility', hotspot: { left: 73, top: 30, width: 16, height: 40 } },
    { id: 'G-07', name: 'TT Ground', type: 'facility', hotspot: { left: 42, top: 68, width: 45, height: 27 } },
    { id: 'G-LIFT', name: 'Lift', type: 'lift', hotspots: [
      { left: 8, top: 30, width: 6, height: 20 },
      { left: 8, top: 60, width: 6, height: 20 },
    ] },
    { id: 'G-M', name: 'Washroom', type: 'washroom', hotspot: { left: 86, top: 15, width: 8, height: 12 } },
  ]},
  { floor: '1st', mapImage: '/campus/first-floor.png', rooms: [
    { id: '1-PR', name: 'Prayer Room', type: 'facility', hotspot: { left: 18.7, top: 17.2, width: 2.9, height: 10.2 } },
    { id: '1-MC', name: 'Medical Center', type: 'facility', hotspot: { left: 21.1, top: 17.5, width: 12.5, height: 11.8 } },
    { id: '1-LIFT', name: 'Lift', type: 'lift', hotspots: [
      { left: 29.5, top: 14.8, width: 5.2, height: 6.8 },
      { left: 36.0, top: 14.8, width: 5.2, height: 6.8 },
      { left: 70.7, top: 11.8, width: 2.7, height: 7.8 },
      { left: 74.0, top: 11.6, width: 2.8, height: 7.8 },
      { left: 76.4, top: 66.0, width: 4.0, height: 18.5 },
    ] },
    { id: '2A03', name: 'Room 2A03', type: 'classroom', hotspot: { left: 41.2, top: 15.2, width: 5.3, height: 6.3 } },
    { id: '2A04', name: 'Room 2A04', type: 'classroom', hotspot: { left: 46.6, top: 14.8, width: 5.2, height: 6.5 } },
    { id: '2A05', name: 'Room 2A05', type: 'classroom', hotspot: { left: 51.8, top: 14.6, width: 5.3, height: 6.4 } },
    { id: '2A06', name: 'Room 2A06', type: 'classroom', hotspot: { left: 57.1, top: 14.2, width: 5.1, height: 6.5 } },
    { id: '2A07', name: 'Room 2A07', type: 'classroom', hotspot: { left: 62.2, top: 13.8, width: 5.2, height: 6.6 } },
    { id: '1-WR', name: 'Washroom', type: 'washroom', hotspot: { left: 77.5, top: 11.0, width: 3.6, height: 7.3 } },
    { id: '1-PZ', name: 'Plaza', type: 'facility', hotspot: { left: 20.0, top: 31.4, width: 15.2, height: 17.2 } },
    { id: '1-BD', name: 'Badamtola', type: 'hall', hotspot: { left: 34.0, top: 25.6, width: 33.5, height: 38.4 } },
    { id: '1-LIB', name: 'Library', type: 'library', hotspot: { left: 66.8, top: 25.6, width: 14.2, height: 39.0 } },
    { id: '1-PRC', name: 'Proctor Room', type: 'admin', hotspot: { left: 6.6, top: 48.8, width: 13.8, height: 15.0 } },
    { id: '1-ID', name: 'Information Desk', type: 'admin', hotspot: { left: 20.7, top: 63.5, width: 12.1, height: 7.8 } },
    { id: '1-APS', name: 'Architecture Project Showcase', type: 'facility', hotspot: { left: 34.2, top: 56.7, width: 7.5, height: 10.8 } },
    { id: '1-SR', name: 'Study Room', type: 'library', hotspot: { left: 66.4, top: 78.2, width: 9.6, height: 5.9 } },
  ]},
  { floor: '2nd', rooms: [
    { id: '2A-01', name: 'Room 2A-01', type: 'classroom', x: 18, y: 28 },
    { id: '2A-02', name: 'Room 2A-02', type: 'classroom', x: 38, y: 28 },
    { id: '2A-03', name: 'Room 2A-03', type: 'classroom', x: 58, y: 28 },
    { id: '2B-01', name: 'Room 2B-01', type: 'classroom', x: 78, y: 28 },
    { id: '2B-02', name: 'Drawing Lab', type: 'lab', x: 32, y: 66 },
    { id: '2B-03', name: 'Faculty Room', type: 'admin', x: 62, y: 66 },
    { id: '2-LIFT', name: 'Lift', type: 'lift', x: 8, y: 32 },
    { id: '2-M', name: 'Washroom', type: 'washroom', x: 90, y: 22 },
  ]},
  { floor: '3rd', rooms: [
    { id: '3A-01', name: 'Room 3A-01', type: 'classroom', x: 18, y: 28 },
    { id: '3A-02', name: 'Room 3A-02', type: 'classroom', x: 38, y: 28 },
    { id: '3A-03', name: 'Room 3A-03', type: 'classroom', x: 58, y: 28 },
    { id: '3B-01', name: 'Room 3B-01', type: 'classroom', x: 78, y: 28 },
    { id: '3B-02', name: 'Computer Lab', type: 'lab', x: 32, y: 66 },
    { id: '3B-03', name: 'Department Office', type: 'admin', x: 62, y: 66 },
    { id: '3-LIFT', name: 'Lift', type: 'lift', x: 8, y: 32 },
    { id: '3-M', name: 'Washroom', type: 'washroom', x: 90, y: 22 },
  ]},
  { floor: '4th', rooms: [
    { id: '4A-01', name: 'CSE Lab 1', type: 'lab', x: 20, y: 30 },
    { id: '4A-02', name: 'CSE Lab 2', type: 'lab', x: 50, y: 30 },
    { id: '4A-03', name: 'Room 4A-03', type: 'classroom', x: 80, y: 30 },
    { id: '4B-01', name: 'CSE Office', type: 'admin', x: 30, y: 65 },
    { id: '4B-02', name: 'Seminar Room', type: 'hall', x: 60, y: 65 },
    { id: '4-LIFT', name: 'Lift', type: 'lift', x: 8, y: 30 },
    { id: '4-M', name: 'Washroom', type: 'washroom', x: 90, y: 20 },
  ]},
  { floor: '5th', rooms: [
    { id: '5A-01', name: 'Room 5A-01', type: 'classroom', x: 20, y: 30 },
    { id: '5B-01', name: 'Room 5B-01', type: 'classroom', x: 50, y: 30 },
    { id: '5B-02', name: 'Room 5B-02', type: 'classroom', x: 80, y: 30 },
    { id: '5C-01', name: 'Software Lab', type: 'lab', x: 35, y: 65 },
    { id: '5C-02', name: 'Network Lab', type: 'lab', x: 65, y: 65 },
    { id: '5-LIFT', name: 'Lift', type: 'lift', x: 8, y: 30 },
    { id: '5-M', name: 'Washroom', type: 'washroom', x: 90, y: 20 },
  ]},
  { floor: '6th', rooms: [
    { id: '6A-01', name: 'Room 6A-01', type: 'classroom', x: 15, y: 25 },
    { id: '6A-02', name: 'Room 6A-02', type: 'classroom', x: 35, y: 25 },
    { id: '6A-03', name: 'Room 6A-03', type: 'classroom', x: 55, y: 25 },
    { id: '6A-04', name: 'Room 6A-04', type: 'classroom', x: 75, y: 25 },
    { id: '6B-01', name: 'Faculty Room', type: 'admin', x: 40, y: 65 },
    { id: '6-LIFT', name: 'Lift', type: 'lift', x: 8, y: 30 },
    { id: '6-M', name: 'Washroom', type: 'washroom', x: 90, y: 20 },
  ]},
  { floor: '7th', rooms: [
    { id: '7A-01', name: 'Room 7A-01', type: 'classroom', x: 15, y: 25 },
    { id: '7A-02', name: 'Room 7A-02', type: 'classroom', x: 35, y: 25 },
    { id: '7A-03', name: 'Room 7A-03', type: 'classroom', x: 55, y: 25 },
    { id: '7A-04', name: 'Room 7A-04', type: 'classroom', x: 75, y: 25 },
    { id: '7B-01', name: 'Project Lab', type: 'lab', x: 30, y: 65 },
    { id: '7B-02', name: 'Seminar Room', type: 'hall', x: 60, y: 65 },
    { id: '7-LIFT', name: 'Lift', type: 'lift', x: 8, y: 30 },
    { id: '7-M', name: 'Washroom', type: 'washroom', x: 90, y: 20 },
  ]},
  { floor: '8th', rooms: [
    { id: '8A-01', name: 'Room 8A-01', type: 'classroom', x: 15, y: 25 },
    { id: '8A-02', name: 'Room 8A-02', type: 'classroom', x: 35, y: 25 },
    { id: '8A-03', name: 'Room 8A-03', type: 'classroom', x: 55, y: 25 },
    { id: '8A-04', name: 'Room 8A-04', type: 'classroom', x: 75, y: 25 },
    { id: '8B-01', name: 'Research Lab', type: 'lab', x: 30, y: 65 },
    { id: '8B-02', name: 'Faculty Room', type: 'admin', x: 60, y: 65 },
    { id: '8-LIFT', name: 'Lift', type: 'lift', x: 8, y: 30 },
    { id: '8-M', name: 'Washroom', type: 'washroom', x: 90, y: 20 },
  ]},
];

// ─────────────────────────────────────────────────────────────
// Free Room / Lab availability across all 9 floors + FM Lab basement.
// Availability is computed live from `sharedRoutines` — a schedule of
// room bookings shared by Class Representatives. A room is 'busy' if
// a routine entry covers roomId + day + time.
// ─────────────────────────────────────────────────────────────

// Each floor has the same block structure as the 7th floor:
//   A Block: 5 rooms  (XA03 – XA07)   · Classrooms
//   B Block: 8 rooms  (XB01 – XB08)   · Labs
//   C Block: 5 rooms  (XC03 – XC07)   · Classrooms
// (Ground floor + FM Lab basement keep their own rooms.)
function makeBlockRooms(prefix) {
  const a = [];
  for (let n = 3; n <= 7; n += 1) a.push({ id: `${prefix}A0${n}`, name: `Room ${prefix}A0${n}`, type: 'classroom' });
  const b = [];
  for (let n = 1; n <= 8; n += 1) b.push({ id: `${prefix}B0${n}`, name: `Lab ${prefix}B0${n}`, type: 'lab' });
  const c = [];
  for (let n = 3; n <= 7; n += 1) c.push({ id: `${prefix}C0${n}`, name: `Room ${prefix}C0${n}`, type: 'classroom' });
  return [...a, ...b, ...c];
}

export const roomCatalog = {
  building: 'Campus Floors',
  floors: [
    { id: 'ground', label: 'Ground Floor', rooms: [
      { id: 'CANTEEN', name: 'Canteen', type: 'canteen' },
      { id: 'MHA', name: 'M.H Khan Auditorium', type: 'auditorium' },
    ]},
    { id: '1st', label: '1st Floor', rooms: makeBlockRooms('1') },
    { id: '2nd', label: '2nd Floor', rooms: makeBlockRooms('2') },
    { id: '3rd', label: '3rd Floor', rooms: makeBlockRooms('3') },
    { id: '4th', label: '4th Floor', rooms: makeBlockRooms('4') },
    { id: '5th', label: '5th Floor', rooms: makeBlockRooms('5') },
    { id: '6th', label: '6th Floor', rooms: makeBlockRooms('6') },
    { id: '7th', label: '7th Floor', rooms: makeBlockRooms('7') },
    { id: 'fm', label: 'FM Lab (Basement)', rooms: [
      { id: 'FM-01', name: 'FM Lab', type: 'lab' },
    ]},
  ],
};

// Schedule of room bookings shared by Class Representatives.
// Each entry: { roomId, day, time, dept, semester, section, course, courseName, teacher }
// Empty until a CR shares their routine via the "Share Routine" button.
export const sharedRoutines = [];

// ── Live availability helpers ───────────────────────────────
const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const currentDayOfWeek = () => WEEK_DAYS[new Date().getDay()];

export const currentTimeString = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

function timeInRange(range, current) {
  if (!range || !current) return true;
  // Accept both "08:00 – 09:40" (en-dash) and "08:00 - 09:40" (hyphen)
  const m = String(range).match(/(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/);
  if (!m) return true;
  const [sh, sm] = m[1].split(':').map(Number);
  const [eh, em] = m[2].split(':').map(Number);
  const [ch, cm] = current.split(':').map(Number);
  const curMin = ch * 60 + cm;
  return curMin >= sh * 60 + sm && curMin <= eh * 60 + em;
}

// ─────────────────────────────────────────────────────────────
// Ground-floor special venues.
//   • Canteen — open/closed follows the canteen menu hours
//     (07:00 – 19:00, mirrors CanteenMenu crowd slots).
//   • M.H Khan Auditorium — busy when an admin schedules a seminar
//     (event persisted in localStorage 'aust-auditorium-event').
// ─────────────────────────────────────────────────────────────

const CANTEEN_OPEN_WINDOW = '08:00 - 18:00';
const CANTEEN_DEFAULT_HOURS = '8:00 AM - 6:00 PM';

export function getCanteenStatus(time, day) {
  let hours = CANTEEN_DEFAULT_HOURS;
  let statusMode = 'auto';
  let manualStatus = 'open';
  if (typeof window !== 'undefined') {
    try {
      const stored = JSON.parse(localStorage.getItem('aust-canteen-data'));
      if (stored) {
        if (stored.hours) hours = stored.hours;
        if (stored.statusMode) statusMode = stored.statusMode;
        if (stored.status) manualStatus = stored.status;
      }
    } catch { /* ignore */ }
  }
  // Closed all day on Friday and Saturday; otherwise open 8am – 6pm.
  const weekendOff = day === 'Friday' || day === 'Saturday';
  let open;
  if (weekendOff) {
    open = false;
  } else if (statusMode === 'manual') {
    open = manualStatus === 'open';
  } else {
    open = timeInRange(CANTEEN_OPEN_WINDOW, time);
  }
  return { open, hours };
}

export const defaultAuditoriumEvent = {
  title: '',
  date: '',
  time: '',
  speaker: '',
  description: '',
  status: 'none', // 'none' | 'upcoming' | 'ongoing'
};

export function getAuditoriumEvent() {
  if (typeof window === 'undefined') return { ...defaultAuditoriumEvent };
  try {
    const stored = JSON.parse(localStorage.getItem('aust-auditorium-event'));
    return stored ? { ...defaultAuditoriumEvent, ...stored } : { ...defaultAuditoriumEvent };
  } catch {
    return { ...defaultAuditoriumEvent };
  }
}

export function setAuditoriumEvent(evt) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('aust-auditorium-event', JSON.stringify(evt));
  window.dispatchEvent(new Event('auditorium-updated'));
}

// Routines shared by CRs via the CR/SR directory (persisted in localStorage)
export function getSharedRoutines() {
  if (typeof window === 'undefined') return sharedRoutines;
  try {
    const stored = JSON.parse(localStorage.getItem('aust-shared-routines') || '[]');
    return [...sharedRoutines, ...stored];
  } catch {
    return sharedRoutines;
  }
}

export function getRoomStatus(roomId, day, time) {
  // Canteen — open/closed follows the canteen menu hours
  if (roomId === 'CANTEEN') {
    const { open, hours } = getCanteenStatus(time, day);
    return {
      status: open ? 'free' : 'busy',
      details: { venue: 'canteen', open, hours },
    };
  }

  // M.H Khan Auditorium — busy when an admin event is scheduled/happening
  if (roomId === 'MHA') {
    const evt = getAuditoriumEvent();
    const active = evt && evt.status !== 'none' && evt.title.trim();
    if (!active) return { status: 'free', details: { venue: 'auditorium' } };
    return { status: 'busy', details: { venue: 'auditorium', event: evt } };
  }

  const entry = getSharedRoutines().find(
    (r) => r.roomId === roomId && r.day === day && timeInRange(r.time, time)
  );
  if (!entry) return { status: 'free' };
  return {
    status: 'busy',
    details: {
      dept: entry.dept,
      semester: entry.semester,
      section: entry.section,
      course: entry.course,
      courseName: entry.courseName,
      teacher: entry.teacher,
      time: entry.time,
    },
  };
}

// Apply the special ground-floor venue statuses to a set of floors
// (server-fetched or locally built). Canteen uses the *real* current time so
// its open/closed state always matches the Canteen Menu page; the auditorium
// reflects the event the admin scheduled in the Admin Panel.
function overlayVenueStatus(floors) {
  return floors.map((floor) => ({
    ...floor,
    rooms: floor.rooms.map((room) => {
      if (room.id === 'CANTEEN') {
        const { status, details } = getRoomStatus('CANTEEN', currentDayOfWeek(), currentTimeString());
        return { ...room, status, details };
      }
      if (room.id === 'MHA') {
        const { status, details } = getRoomStatus('MHA', '', '');
        return { ...room, status, details };
      }
      return room;
    }),
  }));
}

export function computeRoomAvailability(day, time, baseFloors) {
  // Overlay local-only bookings on top of an existing (e.g. server-fetched)
  // set of floors. `baseFloors` rooms keep their status unless a local booking
  // marks them busy.
  const source = baseFloors && baseFloors.length
    ? baseFloors
    : roomCatalog.floors.map((floor) => ({
        ...floor,
        rooms: floor.rooms.map((room) => {
          const { status, details } = getRoomStatus(room.id, day, time);
          return { ...room, status, details: details || null };
        }),
      }));
  const withVenues = overlayVenueStatus(source);
  return withVenues;
}

// Demo floors: simulate Sunday mid-morning for demo purposes
// (most rooms are booked on Sunday, so you see realistic busy/free states).
// The canteen room additionally reflects the *real* current time so its
// open/closed state always matches the canteen menu page.
export function computeDemoAvailability() {
  return computeRoomAvailability('Sunday', '10:30');
}

// Default: simulate Sunday mid-morning for demo purposes
export const freeRoomData = {
  building: roomCatalog.building,
  floors: computeDemoAvailability(),
};

// Mutable list for user-submitted routines (from CR share button)
export const userRoutines = [];

export const addRoutineEntry = (entry) => {
  sharedRoutines.push(entry);
  userRoutines.push(entry);
};

export const examSeats = [];

export const facultyData = [];

export const libraryData = {
  totalSeats: 350,
  occupied: 0,
  peakHours: [
    { hour: '8AM', occupancy: 18 }, { hour: '9AM', occupancy: 32 }, { hour: '10AM', occupancy: 55 },
    { hour: '11AM', occupancy: 68 }, { hour: '12PM', occupancy: 74 }, { hour: '1PM', occupancy: 46 },
    { hour: '2PM', occupancy: 62 }, { hour: '3PM', occupancy: 81 }, { hour: '4PM', occupancy: 88 },
    { hour: '5PM', occupancy: 72 }, { hour: '6PM', occupancy: 51 },
  ]
};

export const canteenData = {
  status: 'open',
  crowdLevel: 55,
  hours: '8:00 AM - 7:00 PM',
  menu: [],
  statusMode: 'auto',
  crowdMode: 'auto',
};

export const prerequisiteTree = {
  categories: [
    {
      id: 'math',
      name: 'Mathematics Sequence',
      color: '#818cf8',
      courses: [
        { id: 'MATH1115', name: 'Mathematics-I', semester: 1, color: '#818cf8' },
        { id: 'MATH1219', name: 'Mathematics-II', semester: 2, color: '#818cf8', prereqs: ['MATH1115'] },
        { id: 'MATH2101', name: 'Mathematics-III', semester: 3, color: '#818cf8', prereqs: ['MATH1219'] },
        { id: 'MATH2203', name: 'Mathematics-IV', semester: 4, color: '#818cf8', prereqs: ['MATH1115'] },
        { id: 'CSE3101', name: 'Math Analysis for CS', semester: 5, color: '#a7f3d0', prereqs: ['MATH2101'] },
        { id: 'CSE3207_AI', name: 'Artificial Intelligence', semester: 6, color: '#fde68a', prereqs: ['CSE3101', 'CSE1203'] },
        { id: 'CSE4137', name: 'Soft Computing', semester: 8, color: '#fde68a', prereqs: ['CSE3101'] },
        { id: 'CSE4175_NLP', name: 'Natural Language Processing', semester: 8, color: '#fde68a', prereqs: ['CSE3101', 'CSE1203'] },
        { id: 'CSE4223', name: 'Computational Complexity', semester: 8, color: '#fde68a', prereqs: ['CSE3101'] },
        { id: 'CSE4265_BIO', name: 'Bioinformatics', semester: 8, color: '#fde68a', prereqs: ['CSE3101', 'CSE3207_AI'] },
        { id: 'CSE4211', name: 'Simulation of Products', semester: 8, color: '#fde68a', prereqs: ['MATH2101'] },
        { id: 'CSE4113_PR', name: 'Pattern Recognition', semester: 8, color: '#fde68a', prereqs: ['MATH2203'] },
        { id: 'CSE4203', name: 'Computer Graphics', semester: 8, color: '#fde68a', prereqs: ['MATH2203'] },
        { id: 'CSE4209', name: 'Computer Vision', semester: 8, color: '#fde68a', prereqs: ['MATH2203'] },
        { id: 'CSE4219', name: 'Computational Geometry', semester: 8, color: '#fde68a', prereqs: ['MATH2203'] },
      ]
    },
    {
      id: 'prog',
      name: 'Programming & Software',
      color: '#93c5fd',
      courses: [
        { id: 'CSE1101', name: 'Structured Programming', semester: 1, color: '#a7f3d0' },
        { id: 'CSE1205', name: 'Object Oriented Programming', semester: 2, color: '#a7f3d0', prereqs: ['CSE1101'] },
        { id: 'CSE2103', name: 'Data Structures', semester: 3, color: '#a7f3d0', prereqs: ['CSE1101'] },
        { id: 'CSE2207', name: 'Algorithms', semester: 4, color: '#a7f3d0', prereqs: ['CSE2103'] },
        { id: 'CSE3103_DB', name: 'Database', semester: 5, color: '#a7f3d0', prereqs: ['CSE2103'] },
        { id: 'CSE3207_P', name: 'Artificial Intelligence', semester: 6, color: '#fde68a', prereqs: ['CSE2207'] },
        { id: 'CSE3223', name: 'Info System Design', semester: 6, color: '#fde68a', prereqs: ['CSE3103_DB'] },
        { id: 'CSE4131', name: 'Multimedia Computing', semester: 8, color: '#fde68a', prereqs: ['CSE3103_DB'] },
        { id: 'CSE4139', name: 'Advanced Database', semester: 8, color: '#fde68a', prereqs: ['CSE3103_DB'] },
        { id: 'CSE4141', name: 'Data Warehousing', semester: 8, color: '#fde68a', prereqs: ['CSE3103_DB'] },
        { id: 'CSE4261', name: 'Data Analytics', semester: 8, color: '#fde68a', prereqs: ['CSE3103_DB'] },
        { id: 'CSE4283_ADV', name: 'Advanced Algorithms', semester: 8, color: '#fde68a', prereqs: ['CSE2207', 'CSE2103'] },
        { id: 'CSE4285_HPC', name: 'High Performance Comp', semester: 8, color: '#fde68a', prereqs: ['CSE2103'] },
      ]
    },
    {
      id: 'theory',
      name: 'Theory & Intelligence',
      color: '#a78bfa',
      courses: [
        { id: 'CSE1203', name: 'Discrete Mathematics', semester: 2, color: '#a7f3d0' },
        { id: 'CSE3101_T', name: 'Math Analysis for CS', semester: 5, color: '#a7f3d0', prereqs: ['CSE1203'] },
        { id: 'CSE3103_T', name: 'Database', semester: 5, color: '#a7f3d0', prereqs: ['CSE1203'] },
        { id: 'CSE3207_T', name: 'Artificial Intelligence', semester: 6, color: '#a7f3d0', prereqs: ['CSE1203'] },
        { id: 'CSE4113_ML', name: 'Machine Learning', semester: 7, color: '#fde68a', prereqs: ['CSE3207_T'] },
        { id: 'CSE4129', name: 'Formal Lang & Compilers', semester: 7, color: '#fde68a', prereqs: ['CSE1203'] },
        { id: 'CSE4143', name: 'Expert Systems', semester: 8, color: '#fde68a', prereqs: ['CSE3207_T'] },
        { id: 'CSE4147', name: 'Neural Networks', semester: 8, color: '#fde68a', prereqs: ['CSE3207_T'] },
        { id: 'CSE4175_T', name: 'Natural Language Proc', semester: 8, color: '#fde68a', prereqs: ['CSE1203'] },
        { id: 'CSE4221', name: 'Graph Theory', semester: 8, color: '#fde68a', prereqs: ['CSE1203'] },
        { id: 'CSE4265_AI', name: 'Bioinformatics', semester: 8, color: '#fde68a', prereqs: ['CSE3207_T'] },
        { id: 'CSE4267', name: 'Cloud Computing', semester: 8, color: '#fde68a', prereqs: ['CSE3207_T'] },
      ]
    },
    {
      id: 'hardware',
      name: 'Hardware & Architecture',
      color: '#f59e0b',
      courses: [
        { id: 'EEE1241', name: 'Basic Electrical Eng', semester: 2, color: '#a7f3d0' },
        { id: 'EEE2141', name: 'Electronic Dev & Circuits', semester: 3, color: '#a7f3d0', prereqs: ['EEE1241'] },
        { id: 'CSE2105', name: 'Digital Logic Design', semester: 3, color: '#a7f3d0' },
        { id: 'CSE2213', name: 'Computer Architecture', semester: 4, color: '#a7f3d0' },
        { id: 'CSE3109', name: 'Digital System Design', semester: 5, color: '#a7f3d0', prereqs: ['CSE2105', 'CSE2213'] },
        { id: 'CSE3117', name: 'Microprocessors', semester: 5, color: '#a7f3d0', prereqs: ['CSE2105', 'CSE3109'] },
        { id: 'CSE4215', name: 'Adv Computer Arch', semester: 8, color: '#fde68a', prereqs: ['CSE2213'] },
        { id: 'CSE4245', name: 'Parallel Processing', semester: 8, color: '#fde68a', prereqs: ['CSE2213'] },
        { id: 'CSE4285_A', name: 'High Performance Comp', semester: 8, color: '#fde68a', prereqs: ['CSE2213'] },
      ]
    },
    {
      id: 'comm',
      name: 'Communications & Networks',
      color: '#10b981',
      courses: [
        { id: 'CSE2211', name: 'Data Communication', semester: 4, color: '#a7f3d0' },
        { id: 'CSE3201', name: 'Computer Networks', semester: 6, color: '#a7f3d0', prereqs: ['CSE2211'] },
        { id: 'CSE4173', name: 'Cyber Security', semester: 8, color: '#fde68a', prereqs: ['CSE3201', 'CSE2211'] },
        { id: 'CSE4181', name: 'Web Computing', semester: 8, color: '#fde68a', prereqs: ['CSE3201'] },
        { id: 'CSE4235', name: 'Wireless Networks', semester: 8, color: '#fde68a', prereqs: ['CSE3201', 'CSE2211'] },
        { id: 'CSE4255', name: 'Telecommunication', semester: 8, color: '#fde68a', prereqs: ['CSE3201', 'CSE2211'] },
        { id: 'CSE4263', name: 'Internet of Things', semester: 8, color: '#fde68a', prereqs: ['CSE2211'] },
      ]
    }
  ]
};

export const anonymousStories = [];


export const alumniData = [];

export const clubsData = [
  {
    id: 1,
    name: 'AUST Programming and Informatics Club',
    acronym: 'AUSTPIC',
    description: 'The hub for competitive programming, algorithm enthusiasts, and informatics lovers. Regular coding contests, ICPC training camps, and peer-to-peer problem-solving sessions that have produced national-level finalists.',
    category: 'Academic & Technical',
    focus: ['Competitive Programming', 'Algorithms', 'Problem Solving'],
    color: '#2196F3',
    icon: 'code',
    members: 342,
    joined: false,
    nextEvent: 'ICPC Practice Session — Sat 10AM',
    founded: 2015,
    advisor: 'Dr. Md. Ruhul Amin',
    meetingDay: 'Saturday',
    achievements: ['ICPC Bangladesh Regional Finalist 2024', 'Best Competitive Programming Club Award 2023'],
    socialLinks: { facebook: 'https://facebook.com/austpic', discord: 'https://discord.gg/austpic' },
  },
  {
    id: 2,
    name: 'AUST Sports Club',
    acronym: 'AUSTSC',
    description: 'Promoting physical fitness and sportsmanship across campus. Organizes inter-department tournaments in cricket, football, basketball, badminton, and chess. Annual sports week draws over 500 participants.',
    category: 'Sports & Recreation',
    focus: ['Cricket', 'Football', 'Badminton', 'Chess'],
    color: '#FF5722',
    icon: 'trophy',
    members: 521,
    joined: false,
    nextEvent: 'Inter-Dept Football Tournament — Fri 2PM',
    founded: 2010,
    advisor: 'Mr. Shamsul Alam',
    meetingDay: 'Friday',
    achievements: ['Inter-University Cricket Runners-Up 2024', 'Annual Sports Week Champions'],
    socialLinks: { facebook: 'https://facebook.com/austsc' },
  },
  {
    id: 3,
    name: 'AUST Robotics Club',
    acronym: 'AUSTRC',
    description: 'Building the next generation of robotics engineers. From line-followers to drones, members design, build, and compete with autonomous and remote-controlled robots. Well-equipped lab with 3D printers and Arduino kits.',
    category: 'Academic & Technical',
    focus: ['Robotics', 'Embedded Systems', 'IoT', 'Automation'],
    color: '#4CAF50',
    icon: 'bot',
    members: 198,
    joined: false,
    nextEvent: 'Arduino Workshop — Sun 3PM',
    founded: 2017,
    advisor: 'Dr. S.M. Abdur Razzak',
    meetingDay: 'Sunday',
    achievements: ['1st Place — Techfest RoboRace 2024', 'Best Innovation Award — IEEE RoboWeek'],
    socialLinks: { facebook: 'https://facebook.com/austrc' },
  },
  {
    id: 4,
    name: 'AUST Cultural Club',
    acronym: 'AUSTCC',
    description: "Celebrating Bangladesh's rich cultural heritage through music, dance, drama, and recitation. Annual cultural night, Pahela Baishakh celebrations, and inter-university cultural competitions.",
    category: 'Cultural & Arts',
    focus: ['Music', 'Dance', 'Drama', 'Recitation'],
    color: '#E91E63',
    icon: 'music',
    members: 287,
    joined: false,
    nextEvent: 'Pahela Baishakh Cultural Program — Apr 14',
    founded: 2012,
    advisor: 'Prof. Farida Yesmin',
    meetingDay: 'Wednesday',
    achievements: ['Best Cultural Club — AUST Carnival 2024', 'Inter-University Dance Competition Winners'],
    socialLinks: { facebook: 'https://facebook.com/austcc' },
  },
  {
    id: 5,
    name: 'AUST Innovation and Design Club',
    acronym: 'AUSTIDC',
    description: 'Where creativity meets engineering. Focused on product design, UI/UX, prototyping, and design thinking. Members collaborate on real-world projects, participate in hackathons, and pitch innovative solutions.',
    category: 'Academic & Technical',
    focus: ['Product Design', 'UI/UX', 'Design Thinking', 'Prototyping'],
    color: '#9C27B0',
    icon: 'palette',
    members: 156,
    joined: false,
    nextEvent: 'Design Sprint Hackathon — Thu 9AM',
    founded: 2019,
    advisor: 'Ar. Khaleda Akter',
    meetingDay: 'Thursday',
    achievements: ['2nd Place — National UI/UX Challenge 2024', 'Best Prototype Award — Startup Summit'],
    socialLinks: { facebook: 'https://facebook.com/austidc' },
  },
  {
    id: 6,
    name: 'AUST Photography Club',
    acronym: 'AUSTPC',
    description: 'Capturing moments that tell stories. Regular photo walks, workshops on composition and editing, annual photography exhibition, and inter-university photo contests. Open to DSLR and smartphone photographers alike.',
    category: 'Cultural & Arts',
    focus: ['Photography', 'Videography', 'Photo Editing', 'Storytelling'],
    color: '#FFC107',
    icon: 'camera',
    members: 234,
    joined: false,
    nextEvent: 'Photo Walk: Old Dhaka — Sat 7AM',
    founded: 2014,
    advisor: 'Mr. Hasanuzzaman',
    meetingDay: 'Saturday',
    achievements: ['Best Photo Essay Award — LensFest 2024', 'Published in Daily Star Photography Supplement'],
    socialLinks: { facebook: 'https://facebook.com/austpc' },
  },
  {
    id: 7,
    name: 'AUST Ahsanullah (R.) Peace Club',
    acronym: 'AUSTARPC',
    description: 'Inspired by the legacy of Ahsanullah (R.), this club promotes peace, harmony, and humanitarian values. Organizes peace rallies, interfaith dialogues, blood drives, and awareness campaigns on social issues.',
    category: 'Social & Humanitarian',
    focus: ['Peace Advocacy', 'Humanitarian Work', 'Social Awareness', 'Dialogue'],
    color: '#00BCD4',
    icon: 'dove',
    members: 178,
    joined: false,
    nextEvent: 'Peace Rally & Tree Plantation — Fri 8AM',
    founded: 2016,
    advisor: 'Dr. Md. Golam Mostafa',
    meetingDay: 'Monday',
    achievements: ['UN Peace Day Observance 2024', '500+ Trees Planted in Campus Drive'],
    socialLinks: { facebook: 'https://facebook.com/austarpc' },
  },
  {
    id: 8,
    name: 'AUST E-Sports Club',
    acronym: 'AUSTESC',
    description: "Bangladesh's rising e-sports scene starts here. Squad-based tournaments in Valorant, FIFA, CS2, PUBG Mobile, and Mobile Legends. Weekly practice sessions, inter-university leagues, and LAN events.",
    category: 'Sports & Recreation',
    focus: ['Valorant', 'FIFA', 'CS2', 'Mobile Legends'],
    color: '#FF9800',
    icon: 'gamepad',
    members: 415,
    joined: false,
    nextEvent: 'Valorant Inter-Dept Tournament — Sat 6PM',
    founded: 2018,
    advisor: 'Mr. Tanvir Ahmed',
    meetingDay: 'Friday',
    achievements: ['Runner-Up — BD E-Sports League 2024', 'Best E-Sports Club — Campus Fest 2024'],
    socialLinks: { facebook: 'https://facebook.com/austesc', discord: 'https://discord.gg/austesc' },
  },
  {
    id: 9,
    name: 'AUST Research and Publication Club',
    acronym: 'AUSTRPC',
    description: 'Fostering a research culture among AUST students. Mentorship on paper writing, journal selection, and conference presentation. Publishes the annual AUST Research Chronicle and organizes research symposiums.',
    category: 'Academic & Technical',
    focus: ['Research', 'Paper Writing', 'Journal Publication', 'Conference Prep'],
    color: '#607D8B',
    icon: 'book',
    members: 143,
    joined: false,
    nextEvent: 'Research Paper Writing Workshop — Sun 11AM',
    founded: 2020,
    advisor: 'Dr. A.K.M. Fazlul Haque',
    meetingDay: 'Sunday',
    achievements: ['10+ Papers Published by Members in 2024', 'Organized National Research Symposium'],
    socialLinks: { facebook: 'https://facebook.com/austrpc' },
  },
  {
    id: 10,
    name: 'AUST Environmental and Social Welfare Club',
    acronym: 'AUSTESWC',
    description: 'Dedicated to environmental sustainability and community service. Tree plantation drives, clean-up campaigns, recycling initiatives, and winter clothing distribution for underprivileged communities.',
    category: 'Social & Humanitarian',
    focus: ['Environment', 'Sustainability', 'Community Service', 'Awareness'],
    color: '#8BC34A',
    icon: 'leaf',
    members: 267,
    joined: false,
    nextEvent: 'Campus Clean-Up Drive — Thu 8AM',
    founded: 2013,
    advisor: 'Dr. Nazia Hossain',
    meetingDay: 'Thursday',
    achievements: ['Best Environmental Club — Green Campus Award 2024', '1000+ Saplings Planted'],
    socialLinks: { facebook: 'https://facebook.com/austeswc' },
  },
  {
    id: 11,
    name: 'AUST Career Development Club',
    acronym: 'AUSTCDC',
    description: 'Bridging the gap between academia and industry. CV workshops, mock interviews, corporate networking events, and internship placement support. Regular sessions with HR professionals and successful alumni.',
    category: 'Professional Development',
    focus: ['Career Planning', 'CV Building', 'Mock Interviews', 'Networking'],
    color: '#3F51B5',
    icon: 'briefcase',
    members: 389,
    joined: false,
    nextEvent: 'CV & Interview Workshop — Wed 2PM',
    founded: 2011,
    advisor: 'Mr. Md. Shahidul Islam',
    meetingDay: 'Wednesday',
    achievements: ['200+ Internships Secured in 2024', 'Annual Career Fair with 30+ Companies'],
    socialLinks: { facebook: 'https://facebook.com/austcdc', linkedin: 'https://linkedin.com/company/austcdc' },
  },
  {
    id: 12,
    name: 'AUST Blood Donation Club',
    acronym: 'AUSTBDC',
    description: 'Saving lives one donation at a time. Organizes regular blood donation camps in collaboration with hospitals and the Red Crescent Society. Maintains a voluntary donor database for emergency requests.',
    category: 'Social & Humanitarian',
    focus: ['Blood Donation', 'Health Awareness', 'Emergency Response'],
    color: '#F44336',
    icon: 'heart',
    members: 312,
    joined: false,
    nextEvent: 'Blood Donation Camp — Tue 9AM',
    founded: 2009,
    advisor: 'Dr. Rokeya Begum',
    meetingDay: 'Tuesday',
    achievements: ['500+ Units of Blood Collected in 2024', 'Lifesaver Award from Red Crescent Society'],
    socialLinks: { facebook: 'https://facebook.com/austbdc' },
  },
  {
    id: 13,
    name: 'AUST Debating Club',
    acronym: 'AUSTDC',
    description: 'Sharpening minds through the art of debate. Regular parliamentary debates, extempore speaking sessions, and inter-university debate competitions. Known for producing nationally recognized debaters.',
    category: 'Cultural & Arts',
    focus: ['Parliamentary Debate', 'Extempore', 'Public Speaking', 'Argumentation'],
    color: '#673AB7',
    icon: 'message',
    members: 201,
    joined: false,
    nextEvent: 'Inter-Dept Debate Competition — Mon 1PM',
    founded: 2008,
    advisor: 'Mr. Md. Mahbubur Rahman',
    meetingDay: 'Monday',
    achievements: ['National Debate Championship Finalists 2024', 'Best Speaker Award — BD Debate Fest'],
    socialLinks: { facebook: 'https://facebook.com/austdc' },
  },
  {
    id: 14,
    name: 'AUST Cybersecurity and AI Club',
    acronym: 'AUSTCAIC',
    description: 'Exploring the cutting edge of cybersecurity and artificial intelligence. Workshops on ethical hacking, penetration testing, machine learning, and deep learning. CTF competitions and AI project showcases.',
    category: 'Academic & Technical',
    focus: ['Cybersecurity', 'Ethical Hacking', 'Machine Learning', 'AI'],
    color: '#009688',
    icon: 'shield',
    members: 267,
    joined: false,
    nextEvent: 'CTF Capture The Flag Contest — Fri 10AM',
    founded: 2021,
    advisor: 'Dr. Md. Shafiul Alam',
    meetingDay: 'Friday',
    achievements: ['3rd Place — National CTF 2024', 'AI Project Showcase Best in Show Award'],
    socialLinks: { facebook: 'https://facebook.com/austcaic', discord: 'https://discord.gg/austcaic' },
  },
];


export const leaderboardData = [];

export const feedbackItems = [];
