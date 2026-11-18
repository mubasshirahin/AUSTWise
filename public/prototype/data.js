/* Sample data for the prototype — fictional, nothing comes from the real DB. */
window.DATA = {
  me: { id: 'me', name: 'Mubasshir Ahin', role: 'Student', dept: 'CSE', batch: '2022', sem: 'Year 3 - Semester 2', sid: '20220104001', cgpa: 3.62, credits: 98 },
  members: [
    { id: 'm1', name: 'Nadia Rahman', dept: 'CSE', batch: '2022', role: 'CR', st: '', bio: 'Section B CR, web dev, chai addict.', streak: 41 },
    { id: 'm2', name: 'Farhan Kabir', dept: 'EEE', batch: '2021', role: 'Student', st: 'away', bio: 'Circuits by day, Valorant by night.', streak: 12 },
    { id: 'm3', name: 'Tasnim Akter', dept: 'CSE', batch: '2023', role: 'Student', st: '', bio: 'ICPC dreamer.', streak: 67 },
    { id: 'm4', name: 'Riyad Hasan', dept: 'ME', batch: '2020', role: 'Alumni', st: 'off', bio: 'Now at Walton R&D.', streak: 3 },
    { id: 'm5', name: 'Samira Islam', dept: 'ARCH', batch: '2022', role: 'Moderator', st: '', bio: 'Sketches and studio nights.', streak: 28 },
    { id: 'm6', name: 'Imran Hossain', dept: 'CSE', batch: '2022', role: 'Student', st: 'off', bio: 'Backend, Go, Postgres.', streak: 9 },
    { id: 'm7', name: 'Ayesha Siddiqua', dept: 'BBA', batch: '2021', role: 'SR', st: '', bio: 'Finance club lead.', streak: 33 },
    { id: 'm8', name: 'Mahi Chowdhury', dept: 'TE', batch: '2023', role: 'Student', st: 'away', bio: 'Textiles & photography.', streak: 15 },
  ],
  notices: [
    { id: 'n1', title: 'Mid-term routine published for Spring 2026', by: 'm1', tag: 'Exam', time: '2h ago', body: 'Mid-terms start 7 Dec. Check your section routine in the Routine tab.' },
    { id: 'n2', title: 'CSE 3201 lab moved to Room 7B04', by: 'm1', tag: 'Class', time: '5h ago', body: 'Thursday lab shifts to 7B04 for this week only.' },
    { id: 'n3', title: 'Club fair registration closes Friday', by: 'm7', tag: 'Event', time: 'Yesterday', body: 'Clubs Hub has the form. 30 clubs participating.' },
    { id: 'n4', title: 'Library open till 10pm during exams', by: 'm5', tag: 'Campus', time: '2d ago', body: 'Extended hours from 1 Dec to 20 Dec.' },
  ],
  deadlines: [
    { t: 'CSE 3207 Assignment 3', c: 'Software Engineering', d: 'Tomorrow', u: true },
    { t: 'EEE 3209 Lab Report', c: 'Digital Electronics', d: 'In 3 days', u: false },
    { t: 'Quiz 2 — CSE 3201', c: 'Operating Systems', d: 'Sun, 23 Nov', u: false },
    { t: 'Project proposal', c: 'Database Systems', d: 'Thu, 27 Nov', u: false },
  ],
  routine: {
    days: ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'],
    slots: ['8:00', '9:30', '11:00', '12:30', '2:00', '3:30'],
    cells: {
      'Sat-0': ['CSE 3201', '7A02'], 'Sat-1': ['CSE 3207', '7A02'], 'Sat-3': ['MATH 3201', '6B01'],
      'Sun-0': ['CSE 3203', '7A04'], 'Sun-2': ['CSE 3202 Lab', 'L-3', 2],
      'Mon-1': ['CSE 3201', '7A02'], 'Mon-2': ['HUM 3201', '5C03'], 'Mon-4': ['CSE 3208 Lab', 'L-1', 2],
      'Tue-0': ['CSE 3207', '7A02'], 'Tue-1': ['CSE 3203', '7A04'],
      'Wed-2': ['MATH 3201', '6B01'], 'Wed-3': ['HUM 3201', '5C03'],
      'Thu-0': ['CSE 3204 Lab', 'L-2', 2], 'Thu-3': ['CSE 3203', '7A04'],
    },
  },
  courses: [
    { code: 'CSE 3201', name: 'Operating Systems', cr: 3, att: 92, grade: 'A' },
    { code: 'CSE 3203', name: 'Computer Networks', cr: 3, att: 85, grade: 'A-' },
    { code: 'CSE 3207', name: 'Software Engineering', cr: 3, att: 78, grade: 'B+' },
    { code: 'MATH 3201', name: 'Numerical Methods', cr: 3, att: 88, grade: 'A' },
    { code: 'HUM 3201', name: 'Engineering Economics', cr: 2, att: 71, grade: 'B' },
    { code: 'CSE 3202', name: 'OS Lab', cr: 1.5, att: 100, grade: 'A+' },
  ],
  semesters: [
    { s: '1.1', g: 3.41 }, { s: '1.2', g: 3.55 }, { s: '2.1', g: 3.48 }, { s: '2.2', g: 3.71 }, { s: '3.1', g: 3.79 }, { s: '3.2', g: 3.62 },
  ],
  convs: [
    { id: 'c1', with: 'm1', last: 'Routine er PDF ta pathiye dicchi', time: '2m', unread: 2, msgs: [['them', 'Assalamu alaikum! Mid er routine dekhecho?'], ['me', 'Na ekhono, kothay dise?'], ['them', 'Notice board e. Routine er PDF ta pathiye dicchi']] },
    { id: 'c2', with: 'm3', last: 'Codeforces round tonight?', time: '1h', unread: 1, msgs: [['them', 'Codeforces round tonight?'], ['me', 'Yes! Div 2 at 8:35']] },
    { id: 'c3', with: 'm6', last: 'DB project er ER diagram done', time: '3h', unread: 0, msgs: [['me', 'ER diagram ki hoise?'], ['them', 'DB project er ER diagram done']] },
    { id: 'c4', with: 'm2', last: 'Lab report ta share korba?', time: 'Yesterday', unread: 0, msgs: [['them', 'Lab report ta share korba?']] },
    { id: 'c5', with: 'm7', last: 'Thanks for joining the club 🎉', time: 'Mon', unread: 0, msgs: [['them', 'Thanks for joining the club 🎉']] },
  ],
  expenses: [
    { c: 'Food', ic: 'utensils', t: 'Canteen lunch', a: 120 }, { c: 'Transport', ic: 'bus', t: 'Rickshaw to campus', a: 60 },
    { c: 'Study', ic: 'book-open', t: 'Photocopy — OS notes', a: 85 }, { c: 'Food', ic: 'coffee', t: 'Tong er cha', a: 30 },
    { c: 'Fun', ic: 'gamepad-2', t: 'Steam sale', a: 450 }, { c: 'Bills', ic: 'phone', t: 'Mobile recharge', a: 199 },
  ],
  posts: [
    { id: 'p1', sub: 'academic', by: 'm3', title: 'Best resources for OS (CSE 3201)?', body: 'Galvin is heavy. Any lecture series that actually explains scheduling well?', up: 84, cm: 23, time: '3h' },
    { id: 'p2', sub: 'campus', by: 'm5', title: 'The new 7th floor study lounge is 🔥', body: 'Sockets at every table, finally.', up: 212, cm: 41, time: '6h' },
    { id: 'p3', sub: 'memes', by: 'm2', title: 'When the quiz is "open book" but the book is 900 pages', body: '', up: 530, cm: 67, time: '1d' },
    { id: 'p4', sub: 'general', by: 'm8', title: 'Lost: black umbrella near canteen', body: 'Has a small AUST sticker. Please DM.', up: 12, cm: 4, time: '1d' },
  ],
  files: [
    { n: 'OS — Lecture Slides (1-12)', t: 'folder', c: 24, by: 'm1' }, { n: 'Networks — Previous Finals', t: 'folder', c: 11, by: 'm3' },
    { n: 'Numerical Methods Formula Sheet.pdf', t: 'pdf', c: 0, by: 'm6' }, { n: 'SE — UML cheatsheet.pdf', t: 'pdf', c: 0, by: 'm1' },
    { n: 'HUM 3201 Notes', t: 'folder', c: 7, by: 'm7' }, { n: 'OS Lab — Shell scripts.zip', t: 'zip', c: 0, by: 'm6' },
  ],
  listings: [
    { t: 'Casio fx-991EX', p: 1450, c: 'Exchange Kit', by: 'm2', cond: 'Like new' }, { t: 'Drafter + T-square set', p: 600, c: 'Exchange Kit', by: 'm4', cond: 'Used' },
    { t: 'Room for rent near Tejgaon', p: 6500, c: 'To-Let', by: 'm7', cond: '/month' }, { t: 'Found: Student ID card', p: 0, c: 'Lost & Found', by: 'm8', cond: 'Canteen' },
    { t: 'Galvin OS 10th ed.', p: 400, c: 'Exchange Kit', by: 'm3', cond: 'Good' }, { t: 'Lab coat (M)', p: 250, c: 'Exchange Kit', by: 'm5', cond: 'Used once' },
  ],
  clubs: [
    { n: 'AUST Programming Club', m: 420, ic: 'code' }, { n: 'AUST Robotics Club', m: 260, ic: 'bot' }, { n: 'Debating Club', m: 180, ic: 'mic' },
    { n: 'Photography Club', m: 210, ic: 'image' }, { n: 'Finance & Business Club', m: 150, ic: 'coins' }, { n: 'Cultural Club', m: 300, ic: 'music' },
  ],
  passwords: [
    { s: 'Google', u: 'mubasshir@gmail.com', ic: 'globe', str: 'Strong' }, { s: 'AUST Portal', u: '20220104001', ic: 'school', str: 'Medium' },
    { s: 'GitHub', u: 'mubasshir-ahin', ic: 'code', str: 'Strong' }, { s: 'Codeforces', u: 'mubasshir', ic: 'trophy', str: 'Weak' },
  ],
};
