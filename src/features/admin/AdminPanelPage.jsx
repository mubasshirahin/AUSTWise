import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, ShieldCheck, ShieldX, Coffee, Activity, Users, Trash2, Plus, AlertCircle, Eye, EyeOff, Edit3, Search, X, Save, Check, CheckCircle2, XCircle, ClipboardList, CalendarDays, Mic, CalendarClock, Ban, Banknote, FileText, Percent, PanelsTopLeft } from 'lucide-react';
import { getAuditoriumEvent, setAuditoriumEvent, defaultAuditoriumEvent } from '../../data/mockData';
import { loadSharedSync, loadSharedAsync, saveShared } from '../../utils/storageService';
import { getRoleLabel, getRoleBadgeClass, getAllAccounts, reviewRoleApplication, resetAllLocalData, getCurrentUserId } from '../../utils/authStorage';
import { sendMessage } from '../../utils/messageStorage';
import RoutineTemplatesPanel from './RoutineTemplatesPanel';
import BharaKotoPanel from './BharaKotoPanel';
import RoleAccessControlCard from './RoleAccessControlCard';
import AdminAttendancePanel from './AdminAttendancePanel';
import TelegramConnectionsPanel from './TelegramConnectionsPanel';
import AcademicManagementPanel from './AcademicManagementPanel';
import PageAvailabilityPanel from './PageAvailabilityPanel';
import FeatureAccessPanel from './FeatureAccessPanel';
import QuestionBankPanel from './QuestionBankPanel';
import SidebarPageAccessPanel, { SidebarPageAccessHeader } from './SidebarPageAccessPanel';
import { useAuth } from '../../context/AuthContext';
import { PROVIDER_MAP } from '../../utils/socialOAuth.jsx';
import './AdminPanelPage.css';

const applicationRoleNames = {
  cr: 'Class Representative (CR)',
  sr: 'Student Representative (SR)',
  vp: 'Vice President (VP)',
  gs: 'General Secretary (GS)',
    faculty: 'Faculty',
};
const applicationRoleName = (role) => applicationRoleNames[role] || String(role || 'role').toUpperCase();
const isDemoAccount = (account) =>
  /^DEV-/i.test(String(account?.id || '')) ||
  /^ALU-DEMO-/i.test(String(account?.id || '')) ||
  /^QA(?:\s|$)/i.test(String(account?.name || '').trim()) ||
  /^qa-[\w-]*@/i.test(String(account?.email || '').trim());
const normalizeAdminAccounts = (list) => {
  const seen = new Set();
  return (Array.isArray(list) ? list : []).filter((account) => {
    if (!account || isDemoAccount(account)) return false;
    const key = String(account.id || account.email || '').trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
const studentChildRoles = ['cr', 'sr', 'readd', 'gs', 'vp', 'bus_coordinator', 'clubs_representative'];
const exclusiveStudentRoles = ['readd', 'cr', 'sr', 'vp', 'gs'];
const facultyDepartments = ['CSE', 'EEE', 'CE', 'ME', 'IPE', 'TE', 'ARCH', 'BBA'];
const facultyDepartmentRole = (department) => `faculty_${String(department || '').trim().toLowerCase()}`;
const accountRoleSet = (account) => new Set([account?.role, ...(Array.isArray(account?.roles) ? account.roles : [])].filter(Boolean));
const accountHasRole = (account, role) => {
  const roles = accountRoleSet(account);
  if (role === 'student') return account?.role === 'student' || studentChildRoles.includes(account?.role);
  if (role === 'alumni') return ['alumni', 'alumni_with_carry'].includes(account?.role);
  if (role === 'alumni_only') return account?.role === 'alumni';
  if (role === 'regular') return accountHasRole(account, 'student') && !exclusiveStudentRoles.some(child => roles.has(child));
  if (role.startsWith('faculty_')) return roles.has(role) || (account?.role === 'faculty' && facultyDepartmentRole(account?.department) === role);
  if (['faculty', 'guest', 'admin', 'moderator', 'help_desk', 'banned'].includes(role)) return account?.role === role;
  return roles.has(role);
};
const parseProfileObject = (value, fallback) => {
  if (value && typeof value === 'object') return value;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return fallback; }
  }
  return fallback;
};
const hasProfileValue = (value) => typeof value === 'boolean' || (value !== null && value !== undefined && String(value).trim() !== '');
const getAccountAvatar = (account) => {
  const linkedAccounts = parseProfileObject(account?.linkedAccounts, []);
  const linkedAvatar = Array.isArray(linkedAccounts) ? linkedAccounts.find(item => item?.avatar)?.avatar : '';
  return account?.avatar || account?.picture || account?.photoURL || account?.photoUrl || account?.profilePicture || account?.image || linkedAvatar || '';
};
const getDirectoryProfile = (account) => {
  const linkedAccounts = parseProfileObject(account.linkedAccounts, []);
  const linkedSocial = parseProfileObject(account.linkedSocial, {});
  const studentId = String(account.email || '').match(/^\D*(\d+)@aust\.edu$/i)?.[1] || account.studentId || '';
  const batch = account.batchName || account.batch || (account.batchNo ? `Batch ${account.batchNo}` : '');
  const details = [
    ['Full Name', account.name], ['AUSTWise ID', account.awid], ['Student ID', studentId],
    ['Primary Email', account.email], ['Personal Email', account.personalEmail], ['Profile Photo', getAccountAvatar(account) ? 'Added' : ''],
    ['Blood Group', account.bloodGroup], ['Department', account.department], ['Batch', batch],
    ['Original Batch', account.originalBatch], ['Current Academic Batch', account.currentAcademicBatch],
    ['Year / Semester', account.yearSemester || account.currentSemester], ['Current Semester', account.currentSemester || account.semester],
    ['Maximum Semester', account.maxSemester], ['Section', account.section], ['Lab Group', account.labSection],
    ['Academic Status', account.academicStatus], ['Account Status', account.accountStatus || account.status],
    ['Designation', account.designation], ['Company', account.company], ['Graduation Year', account.graduationYear],
    ['CGPA', Number(account.cgpa) > 0 ? account.cgpa : ''], ['Credits Completed', account.creditsCompleted], ['Total Credits', account.totalCredits],
    ['WhatsApp / Phone', account.whatsapp], ['Facebook', account.facebook], ['LinkedIn', account.linkedin],
    ['Discord', account.discord], ['Open for Talk', typeof account.openForTalk === 'boolean' ? (account.openForTalk ? 'Yes' : 'No') : ''],
    ['Primary Role', getRoleLabel(account.role || '')],
    ['Additional Roles', (Array.isArray(account.roles) ? account.roles : []).filter(role => role !== account.role).map(getRoleLabel).join(', ')],
    ['Account Created', account.createdAt ? new Date(account.createdAt).toLocaleDateString() : ''],
  ];
  const providers = Object.entries(PROVIDER_MAP).map(([key, config]) => {
    const linked = Array.isArray(linkedAccounts) ? linkedAccounts.find(item => item?.provider === key) : null;
    return [`${config.name} Account`, linked ? (linked.displayName || linked.username || linked.email || linked.id || 'Connected') : ''];
  });
  const connectedItems = [
    ['Google / Gmail', linkedSocial.gmail || ''],
    ...providers,
    ...((Array.isArray(linkedAccounts) ? linkedAccounts : [])
      .filter(item => item?.provider && !PROVIDER_MAP[item.provider])
      .map(item => [`${item.providerName || item.provider} Account`, item.displayName || item.username || item.email || 'Connected'])),
  ];
  const sections = [
    { title: 'Identity', fields: details.slice(0, 7) },
    { title: 'Academic & University', fields: details.slice(7, 18) },
    { title: 'Personal & Contact', fields: details.slice(18, 29) },
    { title: 'Account & Access', fields: details.slice(29) },
    { title: 'Linked Accounts', fields: connectedItems },
  ];
  const allProfileFields = [...details, ...connectedItems];
  const completed = allProfileFields.filter(([, value]) => hasProfileValue(value)).length;
  return { sections, completed, total: allProfileFields.length, percent: allProfileFields.length ? Math.round((completed / allProfileFields.length) * 100) : 0 };
};

export default function AdminPanelPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: currentUser } = useAuth();
  
  // Determine active tab from URL path
  const getTabFromPath = () => {
    const path = location.pathname;
    if (path.startsWith('/admin-panel/')) return path.slice('/admin-panel/'.length) || 'overview';
    if (path === '/admin/canteen') return 'canteen';
    if (path === '/admin/library') return 'library';
    if (path === '/admin/users') return 'accounts';
    if (path === '/admin/academic') return 'academic';
    if (path === '/admin/availability') return 'availability';
    if (path === '/admin/applications') return 'applications';
    if (path === '/admin/cr-sr-directory') return 'representatives';
    if (path === '/admin/templates') return 'templates';
    if (path === '/admin/auditorium') return 'auditorium';
    if (path === '/admin/cheatsheets') return 'cheatsheets';
    if (path === '/admin/campus-map') return 'campus-map';
    if (path === '/admin/bhara-koto') return 'bhara-koto';
    if (path === '/admin/attendance') return 'attendance';
    if (path === '/admin/features') return 'features';
    if (path === '/admin/question-bank') return 'question-bank';
    return 'overview';
  };
  
  // Active tab is purely derived from the URL — no state needed.
  const activeTab = getTabFromPath();

  // Navigate to a tab and update URL
  const navigateToTab = (tab) => {
    const paths = {
      'overview': '/admin-panel/overview',
      'canteen': '/admin-panel/canteen',
      'library': '/admin-panel/library',
      'accounts': '/admin-panel/accounts',
      'academic': '/admin-panel/academic',
      'availability': '/admin-panel/availability',
      'applications': '/admin-panel/applications',
      'representatives': '/admin-panel/representatives',
      'templates': '/admin-panel/templates',
      'auditorium': '/admin-panel/auditorium',
      'cheatsheets': '/admin-panel/cheatsheets',
      'campus-map': '/admin-panel/campus-map',
      'bhara-koto': '/admin-panel/bhara-koto',
      'attendance': '/admin-panel/attendance',
      'telegram-connections': '/admin-panel/telegram-connections',
      'features': '/admin-panel/features',
      'question-bank': '/admin-panel/question-bank',
      'access-requests': '/admin-panel/access-requests'
    };
    navigate(paths[tab] || '/admin-panel/overview');
  };

  // Canteen State — lazy-initialized from localStorage, synced from server
  const defaultCanteen = { status: 'closed', crowdLevel: 0, hours: '8:00 AM - 7:00 PM', menu: [] };
  const [canteenInfo, setCanteenInfo] = useState(() => loadSharedSync('aust-canteen-data', defaultCanteen));
  useEffect(() => { loadSharedAsync('aust-canteen-data', defaultCanteen).then(setCanteenInfo); }, []);

  // Canteen food item form
  const [foodForm, setFoodForm] = useState({
    name: '',
    category: 'Meals',
    price: '',
    popular: false,
    available: true
  });

  // Library State — lazy-initialized from localStorage, synced from server
  const defaultLibrary = { totalSeats: 120, occupied: 0, peakHours: [] };
  const [libraryInfo, setLibraryInfo] = useState(() => loadSharedSync('aust-library-data', defaultLibrary));
  useEffect(() => { loadSharedAsync('aust-library-data', defaultLibrary).then(setLibraryInfo); }, []);

  // User Accounts State — lazy-initialized from localStorage
  const [accounts, setAccounts] = useState(() => normalizeAdminAccounts(getAllAccounts()));
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [accountStatusFilter, setAccountStatusFilter] = useState('all');
  const [accountSort, setAccountSort] = useState('name-asc');
  const [accountGrouping, setAccountGrouping] = useState('none');
  const [selectedUser, setSelectedUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  // CR/SR Applications State — lazy-initialized from the local mirror
  const [applications, setApplications] = useState(() => {
    const stored = localStorage.getItem('aust-role-applications-v1');
    if (!stored) return [];
    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch { /* corrupt localStorage — treat as empty */ }
    return [];
  });
  const [applicationFilter, setApplicationFilter] = useState('pending');
  const [selectedApplication, setSelectedApplication] = useState(null);

  // Accounts — the server is the authoritative source. Fetch the real user
  // list (users.json) so the admin sees every account, not just the ones
  // cached in this browser's localStorage. Fall back to the local accounts
  // list only when offline.
  useEffect(() => {
    fetch('/api/admin/users', { credentials: 'same-origin' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && Array.isArray(data.users)) {
          const localAccounts = getAllAccounts();
          const hydratedUsers = data.users.map(serverUser => {
            const cached = localAccounts.find(account => account.id === serverUser.id || String(account.email || '').toLowerCase() === String(serverUser.email || '').toLowerCase());
            const serverLinked = parseProfileObject(serverUser.linkedAccounts, []);
            const cachedLinked = parseProfileObject(cached?.linkedAccounts, []);
            return {
              ...cached,
              ...serverUser,
              avatar: getAccountAvatar(serverUser) || getAccountAvatar(cached) || null,
              linkedAccounts: Array.isArray(serverLinked) && serverLinked.length ? serverLinked : cachedLinked,
              linkedSocial: { ...parseProfileObject(cached?.linkedSocial, {}), ...parseProfileObject(serverUser.linkedSocial, {}) },
            };
          });
          setAccounts(normalizeAdminAccounts(hydratedUsers));
        }
      })
      .catch(() => { /* offline — keep the localStorage accounts list */ });
  }, []);

  // Load CR/SR applications from the server (authoritative) and mirror them
  // locally, so applications submitted from another device reach the admin
  // and the applicant's Settings stays in sync.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/role-applications', { credentials: 'same-origin' });
        const data = await res.json().catch(() => ({}));
if (!res.ok || !Array.isArray(data.applications)) return;
      // Do NOT filter by the local account list — the admin browser may not
      // have the applicant's account (they applied from another device). The
      // server has already excluded applications from deleted users.
      localStorage.setItem('aust-role-applications-v1', JSON.stringify(data.applications));
      if (!cancelled) setApplications(data.applications);
      } catch { /* offline — keep localStorage applications */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Directory search, filters, and sorting are derived from the server list.
  const filteredAccounts = useMemo(() => {
    let result = [...accounts];
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(acc => 
        acc.name?.toLowerCase().includes(query) ||
        acc.email?.toLowerCase().includes(query) ||
        acc.awid?.toLowerCase().includes(query) ||
        String(acc.email || '').match(/^\D*(\d+)@aust\.edu$/i)?.[1]?.toLowerCase().includes(query) ||
        acc.department?.toLowerCase().includes(query) ||
        acc.batch?.toLowerCase().includes(query) ||
        acc.batchNo?.toLowerCase().includes(query) ||
        acc.bloodGroup?.toLowerCase().includes(query) ||
        accountRoleSet(acc).has(query)
      );
    }
    
    if (roleFilter !== 'all') {
      result = result.filter(acc => accountHasRole(acc, roleFilter));
    }

    if (departmentFilter !== 'all') {
      result = result.filter(acc => String(acc.department || '').toUpperCase() === departmentFilter);
    }

    if (accountStatusFilter !== 'all') {
      result = result.filter(acc => String(acc.accountStatus || acc.status || 'ACTIVE').toUpperCase() === accountStatusFilter);
    }

    const compareText = (a, b) => String(a || '').localeCompare(String(b || ''), undefined, { numeric: true, sensitivity: 'base' });
    result.sort((a, b) => {
      if (accountSort === 'name-desc') return compareText(b.name, a.name);
      if (accountSort === 'email-asc') return compareText(a.email, b.email);
      if (accountSort === 'department-asc') return compareText(a.department, b.department) || compareText(a.name, b.name);
      if (accountSort === 'batch-asc') return compareText(a.batchNo || a.batch, b.batchNo || b.batch) || compareText(a.name, b.name);
      if (accountSort === 'newest') return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      return compareText(a.name, b.name);
    });
    
    return result;
  }, [searchQuery, roleFilter, departmentFilter, accountStatusFilter, accountSort, accounts]);

  const groupedAccounts = useMemo(() => {
    if (accountGrouping === 'none') return [{ key: '', users: filteredAccounts }];
    const groups = new Map();
    filteredAccounts.forEach(account => {
      const key = accountGrouping === 'department'
        ? (account.department || 'Department not set')
        : accountGrouping === 'batch'
          ? (account.batch || account.batchNo || 'Batch not set')
          : accountGrouping === 'status'
            ? (account.accountStatus || account.status || 'ACTIVE').replaceAll('_', ' ')
            : getRoleLabel(account.role || 'guest');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(account);
    });
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })).map(([key, users]) => ({ key, users }));
  }, [filteredAccounts, accountGrouping]);

  // Update Canteen
  const handleUpdateCanteen = (field, value) => {
    const updated = { ...canteenInfo, [field]: value };
    setCanteenInfo(updated);
    saveShared('aust-canteen-data', updated);
  };

  // Add a food item to the canteen menu
  const handleAddFood = (e) => {
    e.preventDefault();
    const name = foodForm.name.trim();
    const price = Number(foodForm.price);
    if (!name || !(price >= 0)) return;

    const newItem = {
      id: Date.now(),
      name,
      category: foodForm.category,
      price,
      popular: foodForm.popular,
      available: foodForm.available
    };

    const updated = { ...canteenInfo, menu: [...(canteenInfo.menu || []), newItem] };
    setCanteenInfo(updated);
    saveShared('aust-canteen-data', updated);
    setFoodForm({ name: '', category: 'Meals', price: '', popular: false, available: true });
  };

  // Delete a food item
  const handleDeleteFood = (id) => {
    const updated = { ...canteenInfo, menu: (canteenInfo.menu || []).filter(item => item.id !== id) };
    setCanteenInfo(updated);
    saveShared('aust-canteen-data', updated);
  };

  // Toggle a food item's stock availability
  const handleToggleFoodStock = (id) => {
    const updated = {
      ...canteenInfo,
      menu: (canteenInfo.menu || []).map(item =>
        item.id === id ? { ...item, available: !item.available } : item
      )
    };
    setCanteenInfo(updated);
    saveShared('aust-canteen-data', updated);
  };

  // Update Library Occupied
  const handleUpdateLibraryOccupied = (value) => {
    const occupiedVal = Math.min(Math.max(0, Number(value)), libraryInfo.totalSeats);
    const updated = { ...libraryInfo, occupied: occupiedVal };
    setLibraryInfo(updated);
    saveShared('aust-library-data', updated);
  };

  // Delete Account (server-side — localStorage is just a mirror)
  const handleDeleteAccount = async (id) => {
    const target = accounts.find(acc => acc.id === id);
    if (target && target.role === 'admin') {
      alert('Cannot delete an admin account.');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this account?')) return;
    try {
      const res = await fetch('/api/admin/users/delete', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        alert(data.error || 'Failed to delete user.');
        return;
      }
      const updated = accounts.filter(acc => acc.id !== id);
      setAccounts(updated);
    } catch {
      alert('Failed to delete user. Are you online?');
    }
  };

  // View User Profile (from the server-backed accounts list)
  const handleViewUser = (userId) => {
    const account = accounts.find(acc => acc.id === userId);
    if (account) {
      setSelectedUser(account);
    }
  };

  // Start Editing User (from the server-backed accounts list)
  const handleStartEditUser = (userId) => {
    const account = accounts.find(acc => acc.id === userId);
    if (account) {
      setEditingUser(userId);
      setEditFormData({
        name: account.name || '',
        email: account.email || '',
        role: studentChildRoles.includes(account.role) ? 'student' : account.role || 'student',
        studentRoles: [...accountRoleSet(account)].filter(role => studentChildRoles.includes(role)),
        facultyDepartment: facultyDepartments.find(department => accountRoleSet(account).has(facultyDepartmentRole(department))) || account.department || '',
        department: account.department || '',
        batch: account.batch || '',
        batchNo: account.batchNo || '',
        batchName: account.batchName || '',
        designation: account.designation || '',
        company: account.company || '',
        graduationYear: account.graduationYear || '',
        section: account.section || '',
        labSection: account.labSection || '',
        yearSemester: account.yearSemester || '',
        semester: account.semester || 1,
        cgpa: account.cgpa || 0,
        bloodGroup: account.bloodGroup || '',
        avatar: account.avatar || '',
        personalEmail: account.personalEmail || '',
        facebook: account.facebook || '',
        whatsapp: account.whatsapp || '',
        linkedin: account.linkedin || '',
        discord: account.discord || '',
        openForTalk: Boolean(account.openForTalk),
        creditsCompleted: account.creditsCompleted || 0,
        totalCredits: account.totalCredits || 160,
        originalBatch: account.originalBatch || '',
        currentAcademicBatch: account.currentAcademicBatch || '',
        currentSemester: account.currentSemester || '',
        maxSemester: account.maxSemester || '',
        academicStatus: account.academicStatus || 'ACTIVE',
        accountStatus: account.accountStatus || account.status || 'ACTIVE',
      });
    }
  };

  // Save Edited User (server-side — localStorage is just a mirror)
  const handleSaveEditUser = async (userId) => {
    const target = accounts.find(acc => acc.id === userId);
    if (target && target.role === 'admin' && editFormData.role !== 'admin') {
      alert('Cannot change the role of an admin account.');
      return;
    }

    let role = editFormData.role;
    let roles = [role];
    let department = editFormData.department;
    if (role === 'student') {
      const selected = new Set(editFormData.studentRoles || []);
      const exclusive = exclusiveStudentRoles.filter(studentRole => selected.has(studentRole));
      if (exclusive.length > 1) {
        alert('A student can have only one primary student role: Regular, Re-add, CR, SR, VP or GS.');
        return;
      }
      role = exclusive[0] || 'student';
      roles = [...new Set(['student', ...selected])];
    } else if (role === 'alumni_with_carry') {
      roles = ['alumni', 'alumni_with_carry'];
    } else if (role === 'faculty') {
      department = String(editFormData.facultyDepartment || editFormData.department || '').trim().toUpperCase();
      if (!facultyDepartments.includes(department)) {
        alert('Choose one faculty department: CSE, EEE, CE, ME, IPE, TE, ARCH or BBA.');
        return;
      }
      roles = ['faculty', facultyDepartmentRole(department)];
    }

    try {
      const res = await fetch('/api/admin/users/update', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...editFormData, department, role, roles }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        alert(data.error || 'Failed to update user.');
        return;
      }
      const newAccounts = accounts.map(acc =>
        acc.id === userId ? { ...acc, ...data.user } : acc
      );
      setAccounts(newAccounts);
      setEditingUser(null);
      setEditFormData({});
    } catch {
      alert('Failed to update user. Are you online?');
    }
  };

  // Cancel Editing
  const handleCancelEdit = () => {
    setEditingUser(null);
    setEditFormData({});
  };

  const getRoleCount = (role) => accounts.filter(account => accountHasRole(account, role)).length;
  const getRegularStudentCount = () => getRoleCount('regular');

  const [resetConfirm, setResetConfirm] = useState('');
  const [resetNotification, setResetNotification] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const hideResetNotification = () => setResetNotification(null);

  const handleFactoryReset = async () => {
    if (resetConfirm !== 'DELETE_ALL_DATA') {
      setResetNotification({ type: 'error', text: 'Type DELETE_ALL_DATA to confirm.' });
      return;
    }

    setShowResetConfirm(true);
  };

  const confirmFactoryReset = async () => {
    setShowResetConfirm(false);

    try {
      const res = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'RESET_ALL_DATA' }),
      });

      if (!res.ok) {
        const text = await res.text();
        setResetNotification({ type: 'error', text: 'Server reset failed with status ' + res.status + ': ' + (text || 'Empty response') });
        return;
      }

      const text = await res.text();
      if (!text) {
        setResetNotification({ type: 'warning', text: 'Server reset succeeded but returned empty response.' });
      } else {
        try {
          const data = JSON.parse(text);
          if (!data.success) {
            setResetNotification({ type: 'error', text: 'Server reset failed: ' + (data.error || 'Unknown error') });
            return;
          }
        } catch {
          setResetNotification({ type: 'error', text: 'Server reset returned invalid JSON: ' + text });
          return;
        }
      }
    } catch (e) {
      setResetNotification({ type: 'error', text: 'Server reset failed: ' + e.message });
      return;
    }

    const result = resetAllLocalData();
    if (!result.success) {
      setResetNotification({ type: 'error', text: 'Local reset failed: ' + (result.error || 'Unknown error') });
      return;
    }

    setResetNotification({ type: 'success', text: 'Factory reset complete. All data has been removed. The admin account has been restored. The page will now reload.' });
    setTimeout(() => window.location.reload(), 3000);
  };

  const selectedUserProfile = selectedUser ? getDirectoryProfile(selectedUser) : null;

  return (
    <div className="admin-panel-container stagger-children animate-fadeIn">
      {/* Header */}
      <header className="admin-control-header">
        <div className="admin-control-brand"><span className="admin-control-mark"><Shield size={19} /></span><div><p className="admin-control-eyebrow">AUSTWISE · CONTROL CENTER</p><h1>Admin workspace</h1></div></div>
        <div className="admin-control-header-actions"><span className="admin-session-pill"><span /> Admin session</span>{activeTab === 'overview' ? <span className="admin-home-hint">Choose a control to get started</span> : <button type="button" className="admin-quiet-action" onClick={() => navigateToTab('overview')}><PanelsTopLeft size={16} /> Control menu</button>}</div>
      </header>

      {activeTab === 'overview' && <nav className="admin-control-nav" aria-label="Admin control categories">
        <section className="admin-nav-card">
          <header className="admin-nav-card-heading"><span>01</span><div><strong>Accounts &amp; approvals</strong><small>People, roles and access requests</small></div></header>
          <div className="admin-nav-items">
            <button className={activeTab === 'accounts' ? 'is-active' : ''} onClick={() => navigateToTab('accounts')}><span>People</span><small>Search accounts and update roles</small></button>
            <button onClick={() => navigate('/admin/access-requests')}><span>Invitations</span><small>Review faculty and alumni requests</small></button>
          </div>
        </section>
        <section className="admin-nav-card">
          <header className="admin-nav-card-heading"><span>02</span><div><strong>Academic</strong><small>Semester movement and student roles</small></div></header>
          <div className="admin-nav-items">
            <button className={activeTab === 'academic' ? 'is-active' : ''} onClick={() => navigateToTab('academic')}><span>Semester transition</span><small>Advance students and manage approvals</small></button>
            <button className={activeTab === 'applications' ? 'is-active' : ''} onClick={() => navigateToTab('applications')}><span>Role applications</span><small>Review CR and SR applications</small></button>
            <button className={activeTab === 'representatives' ? 'is-active' : ''} onClick={() => navigateToTab('representatives')}><span>CR / SR directory</span><small>Manage assigned representatives</small></button>
          </div>
        </section>
        <section className="admin-nav-card">
          <header className="admin-nav-card-heading"><span>03</span><div><strong>Campus operations</strong><small>Daily services and campus facilities</small></div></header>
          <div className="admin-nav-items">
            <button className={activeTab === 'canteen' ? 'is-active' : ''} onClick={() => navigateToTab('canteen')}><span>Canteen</span><small>Portal, menu, hours and crowd level</small></button>
            <button className={activeTab === 'library' ? 'is-active' : ''} onClick={() => navigateToTab('library')}><span>Library</span><small>Seat capacity and occupancy</small></button>
            <button className={activeTab === 'attendance' ? 'is-active' : ''} onClick={() => navigateToTab('attendance')}><span>Attendance</span><small>Review Telegram attendance records</small></button>
            <button className={activeTab === 'telegram-connections' ? 'is-active' : ''} onClick={() => navigateToTab('telegram-connections')}><span>Telegram connections</span><small>Search linked accounts and Chat IDs</small></button>
            <button className={activeTab === 'bhara-koto' ? 'is-active' : ''} onClick={() => navigateToTab('bhara-koto')}><span>Campus services</span><small>Manage Bhara Koto listings</small></button>
            <button className={activeTab === 'auditorium' ? 'is-active' : ''} onClick={() => navigateToTab('auditorium')}><span>Auditorium</span><small>Manage campus event details</small></button>
            <button className={activeTab === 'campus-map' ? 'is-active' : ''} onClick={() => navigateToTab('campus-map')}><span>Campus map</span><small>Update campus map information</small></button>
          </div>
        </section>
        <section className="admin-nav-card">
          <header className="admin-nav-card-heading"><span>04</span><div><strong>Platform &amp; content</strong><small>Access, availability and shared resources</small></div></header>
          <div className="admin-nav-items">
            <button className={activeTab === 'features' ? 'is-active' : ''} onClick={() => navigateToTab('features')}><span>Access rules</span><small>Set feature access by user role</small></button>
            <button className={activeTab === 'availability' ? 'is-active' : ''} onClick={() => navigateToTab('availability')}><span>Page availability</span><small>Enable or pause app pages</small></button>
            <button className={activeTab === 'templates' ? 'is-active' : ''} onClick={() => navigateToTab('templates')}><span>Routine templates</span><small>Manage shared class schedules</small></button>
            <button className={activeTab === 'cheatsheets' ? 'is-active' : ''} onClick={() => navigateToTab('cheatsheets')}><span>Cheatsheets</span><small>Manage shared study resources</small></button>
            <button className={activeTab === 'question-bank' ? 'is-active' : ''} onClick={() => navigateToTab('question-bank')}><span>Question bank</span><small>Manage shared past papers</small></button>
            <button onClick={() => navigate('/admin/role-preview')}><span>Role preview</span><small>Preview the app as each user role</small></button>
          </div>
        </section>
      </nav>}

      {/* In-app notification banner */}
      {resetNotification && (
        <div className="animate-fadeIn" style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: resetNotification.type === 'success' ? 'var(--accent-emerald-glow)' :
            resetNotification.type === 'error' ? 'var(--accent-rose-glow)' :
            'var(--accent-amber-glow)',
          border: `1px solid ${resetNotification.type === 'success' ? 'var(--accent-emerald)' :
            resetNotification.type === 'error' ? 'var(--accent-rose)' :
            'var(--accent-amber)'}`,
          color: resetNotification.type === 'success' ? 'var(--accent-emerald)' :
            resetNotification.type === 'error' ? 'var(--accent-rose)' :
            'var(--accent-amber)',
          fontSize: 'var(--fs-sm)',
          fontWeight: 'bold'
        }}>
          {resetNotification.type === 'success' ? <CheckCircle2 size={18} /> :
            resetNotification.type === 'error' ? <XCircle size={18} /> :
            <AlertCircle size={18} />}
          <span style={{ flex: 1 }}>{resetNotification.text}</span>
          <button onClick={hideResetNotification} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'inherit' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Confirmation Modal */}
      {showResetConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }} onClick={() => setShowResetConfirm(false)}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--accent-rose)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            maxWidth: '420px',
            width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'bold', marginBottom: '12px', color: 'var(--accent-rose)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Trash2 size={20} /> Confirm Factory Reset
            </h3>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.6' }}>
              This will permanently delete <strong>ALL</strong> users, messages, marketplace listings, notices, canteen data, library data, and all other stored data. Only the default admin account will be restored. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowResetConfirm(false)}>Cancel</button>
              <button className="btn btn-rose" onClick={confirmFactoryReset} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Trash2 size={16} /> Yes, Delete Everything
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overview Cards */}
      {activeTab === 'academic' && <AcademicManagementPanel />}
      {activeTab === 'availability' && <PageAvailabilityPanel />}
      {activeTab === 'features' && <FeatureAccessPanel />}
      {/* Role Access Control — visible on every admin subpage, anchored under quick stats */}
      {activeTab === 'features' && <RoleAccessControlCard pageKey={location.pathname} />}


      {/* Tab Panels */}
      <div className="tab-panels animate-fadeIn">
        {/* OVERVIEW PANEL */}
        {/* CANTEEN PANEL */}
        {activeTab === 'canteen' && (
          <div className="grid-2" style={{ gridTemplateColumns: '0.9fr 1.1fr', alignItems: 'start' }}>
            {/* Portal configuration */}
            <div className="glass-card-static">
              <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', marginBottom: '16px' }}>Canteen Portal Configuration</h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label className="input-label" style={{ display: 'block', marginBottom: '6px' }}>Canteen Operation Status</label>
                  <div className="flex gap-2">
                    <button
                      className={`btn ${canteenInfo.status === 'open' ? 'btn-primary' : 'btn-secondary'} flex-1`}
                      onClick={() => handleUpdateCanteen('status', 'open')}
                    >
                      Open Portal
                    </button>
                    <button
                      className={`btn ${canteenInfo.status === 'closed' ? 'btn-rose' : 'btn-secondary'} flex-1`}
                      onClick={() => handleUpdateCanteen('status', 'closed')}
                    >
                      Close Portal
                    </button>
                  </div>
                </div>

                {/* Status Mode: Auto / Manual */}
                <div>
                  <label className="input-label" style={{ display: 'block', marginBottom: '6px' }}>
                    Status Mode
                    <span style={{ fontWeight: 'normal', fontSize: '10px', color: 'var(--text-tertiary)', marginLeft: '6px' }}>
                      — Auto uses time-slot; Manual uses your toggle above
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      className={`btn ${canteenInfo.statusMode === 'auto' ? 'btn-primary' : 'btn-secondary'} flex-1`}
                      onClick={() => handleUpdateCanteen('statusMode', 'auto')}
                    >
                      Auto
                    </button>
                    <button
                      className={`btn ${canteenInfo.statusMode === 'manual' ? 'btn-rose' : 'btn-secondary'} flex-1`}
                      onClick={() => handleUpdateCanteen('statusMode', 'manual')}
                    >
                      Manual
                    </button>
                  </div>
                </div>

                <div>
                  <label className="input-label" style={{ display: 'block', marginBottom: '6px' }}>Canteen Working Hours</label>
                  <input
                    type="text"
                    value={canteenInfo.hours}
                    onChange={(e) => handleUpdateCanteen('hours', e.target.value)}
                    className="input"
                    placeholder="8:00 AM - 7:00 PM"
                  />
                </div>

                {/* Crowd Mode: Auto / Manual */}
                <div>
                  <label className="input-label" style={{ display: 'block', marginBottom: '6px' }}>
                    Crowd Level Mode
                    <span style={{ fontWeight: 'normal', fontSize: '10px', color: 'var(--text-tertiary)', marginLeft: '6px' }}>
                      — Auto uses time-slot; Manual lets you set % below
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      className={`btn ${canteenInfo.crowdMode === 'auto' ? 'btn-primary' : 'btn-secondary'} flex-1`}
                      onClick={() => handleUpdateCanteen('crowdMode', 'auto')}
                    >
                      Auto
                    </button>
                    <button
                      className={`btn ${canteenInfo.crowdMode === 'manual' ? 'btn-rose' : 'btn-secondary'} flex-1`}
                      onClick={() => handleUpdateCanteen('crowdMode', 'manual')}
                    >
                      Manual
                    </button>
                  </div>
                </div>

                {(canteenInfo.status === 'open' || canteenInfo.crowdMode === 'manual') && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="input-label">Live Crowd Index ({canteenInfo.crowdLevel}%)</label>
                      <span className="badge badge-blue">
                        {canteenInfo.crowdLevel >= 75 ? 'Busy / Peak' : canteenInfo.crowdLevel >= 40 ? 'Moderate' : 'Quiet / Empty'}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={canteenInfo.crowdLevel}
                      onChange={(e) => handleUpdateCanteen('crowdLevel', Number(e.target.value))}
                      style={{ width: '100%', cursor: 'pointer' }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Food menu management */}
            <div className="glass-card-static">
              <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', marginBottom: '16px' }}>Food Menu &amp; Prices</h3>

              {/* Add food form */}
              <form onSubmit={handleAddFood} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                <div className="grid-2" style={{ gap: '10px' }}>
                  <div>
                    <label className="input-label">Food Name</label>
                    <input
                      type="text"
                      value={foodForm.name}
                      onChange={(e) => setFoodForm({ ...foodForm, name: e.target.value })}
                      className="input"
                      placeholder="e.g., Chicken Khichuri"
                      required
                    />
                  </div>
                  <div>
                    <label className="input-label">Price (৳)</label>
                    <input
                      type="number"
                      min="0"
                      value={foodForm.price}
                      onChange={(e) => setFoodForm({ ...foodForm, price: e.target.value })}
                      className="input"
                      placeholder="e.g., 60"
                      required
                    />
                  </div>
                </div>

                <div className="grid-2" style={{ gap: '10px' }}>
                  <div>
                    <label className="input-label">Category</label>
                    <select
                      value={foodForm.category}
                      onChange={(e) => setFoodForm({ ...foodForm, category: e.target.value })}
                      className="input"
                      style={{ padding: '8px 12px' }}
                    >
                      <option value="Meals">Meals</option>
                      <option value="Snacks">Snacks</option>
                      <option value="Beverages">Beverages</option>
                      <option value="Fast Food">Fast Food</option>
                      <option value="Dessert">Dessert</option>
                    </select>
                  </div>
                  <div className="flex items-end" style={{ gap: '16px', paddingBottom: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: 'var(--fs-xs)' }}>
                      <input
                        type="checkbox"
                        checked={foodForm.popular}
                        onChange={(e) => setFoodForm({ ...foodForm, popular: e.target.checked })}
                      />
                      Bestseller
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: 'var(--fs-xs)' }}>
                      <input
                        type="checkbox"
                        checked={foodForm.available}
                        onChange={(e) => setFoodForm({ ...foodForm, available: e.target.checked })}
                      />
                      In stock
                    </label>
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', display: 'flex', gap: '6px', justifyContent: 'center' }}>
                  <Plus size={16} /> Add Food Item
                </button>
              </form>

              {/* Menu list */}
              <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: '16px' }}>
                <label className="input-label" style={{ display: 'block', marginBottom: '10px' }}>
                  Current Menu ({(canteenInfo.menu || []).length} items)
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
                  {(canteenInfo.menu || []).length === 0 ? (
                    <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)', textAlign: 'center', padding: '24px 0' }}>
                      No food items yet. Add your first item above.
                    </div>
                  ) : (
                    (canteenInfo.menu || []).map(item => (
                      <div
                        key={item.id}
                        className="flex justify-between items-center p-3"
                        style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)' }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="badge badge-blue" style={{ fontSize: '7px', padding: '1px 4px' }}>{item.category}</span>
                            {item.popular && <span className="badge badge-amber" style={{ fontSize: '7px', padding: '1px 4px' }}>BESTSELLER</span>}
                          </div>
                          <h4 style={{ fontSize: '13px', fontWeight: 'bold', margin: '3px 0 0 0' }}>{item.name}</h4>
                          <span style={{ fontSize: '12px', color: 'var(--accent-cyan)', fontWeight: 'bold' }}>৳ {item.price}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleToggleFoodStock(item.id)}
                            style={{ fontSize: '9px', padding: '4px 8px', color: item.available ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}
                          >
                            {item.available ? 'In Stock' : 'Stock Out'}
                          </button>
                          <button
                            className="btn btn-secondary btn-icon"
                            onClick={() => handleDeleteFood(item.id)}
                            style={{ color: 'var(--accent-rose)', border: 'none', background: 'transparent', padding: '4px', width: '28px', height: '28px' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LIBRARY PANEL */}
        {activeTab === 'library' && (
          <div className="glass-card-static" style={{ maxWidth: '650px', margin: '0 auto' }}>
            <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', marginBottom: '24px' }}>Library Capacity Settings</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="grid-2" style={{ gap: '16px' }}>
                <div>
                  <label className="input-label">Total Seat Capacity</label>
                  <input 
                    type="number" 
                    value={libraryInfo.totalSeats}
                    onChange={(e) => {
                      const limit = Math.max(0, Number(e.target.value));
                      const updated = { ...libraryInfo, totalSeats: limit, occupied: Math.min(libraryInfo.occupied, limit) };
                      setLibraryInfo(updated);
                      saveShared('aust-library-data', updated);
                    }}
                    className="input"
                  />
                </div>

                <div>
                  <label className="input-label">Occupied Seats</label>
                  <input 
                    type="number" 
                    min="0"
                    max={libraryInfo.totalSeats}
                    value={libraryInfo.occupied}
                    onChange={(e) => handleUpdateLibraryOccupied(e.target.value)}
                    className="input"
                  />
                </div>
              </div>

            </div>
          </div>
        )}

        {/* BHARA KOTO PANEL — Admin only */}
        {activeTab === 'bhara-koto' && (
          <BharaKotoPanel />
        )}

        {/* User Profile Modal */}
        {selectedUser && createPortal(
          <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
            <div className="modal-content glass-card-static admin-directory-profile-modal" onClick={(e) => e.stopPropagation()}>
              <button 
                className="btn btn-icon" 
                onClick={() => setSelectedUser(null)}
                style={{ position: 'absolute', top: '12px', right: '12px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-tertiary)' }}
              >
                <X size={20} />
              </button>
              
              <div className="admin-profile-hero">
                <div className="avatar" style={{ position: 'relative', overflow: 'hidden', width: 64, height: 64, fontSize: '20px', flexShrink: 0 }}>
                  {getAccountAvatar(selectedUser) && <img src={getAccountAvatar(selectedUser)} alt={`${selectedUser.name || 'User'} profile`} referrerPolicy="no-referrer" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.currentTarget.style.display = 'none'; if (e.currentTarget.nextElementSibling) e.currentTarget.nextElementSibling.style.display = 'grid'; }} />}
                  <span style={{ display: getAccountAvatar(selectedUser) ? 'none' : 'grid', width: '100%', height: '100%', placeItems: 'center' }}>{selectedUser.name?.charAt(0)?.toUpperCase() || 'U'}</span>
                </div>
                <div className="admin-profile-hero-copy">
                  <h2>{selectedUser.name || 'Unnamed user'}</h2>
                  <p>{selectedUser.awid || selectedUser.email || 'AUSTWise account'}</p>
                  <div className="admin-profile-role-list">
                    {[...new Set([selectedUser.role, ...(Array.isArray(selectedUser.roles) ? selectedUser.roles : [])].filter(Boolean))].map(role => <span key={role} className={`badge ${getRoleBadgeClass(role)}`}>{getRoleLabel(role)}</span>)}
                  </div>
                </div>
              </div>

              <section className="admin-profile-completion" aria-label={`Profile ${selectedUserProfile.percent}% complete`}>
                <div><span>Profile completion</span><strong>{selectedUserProfile.percent}%</strong></div>
                <div className="admin-profile-progress-track"><span style={{ width: `${selectedUserProfile.percent}%` }} /></div>
                <small>{selectedUserProfile.completed} of {selectedUserProfile.total} profile items added</small>
              </section>

              <div className="admin-profile-sections">
                {selectedUserProfile.sections.map(section => (
                  <section className="admin-profile-section" key={section.title}>
                    <h3>{section.title}</h3>
                    <div className="admin-profile-fields">
                      {section.fields.map(([label, value]) => (
                        <div className={`admin-profile-field${hasProfileValue(value) ? '' : ' is-empty'}`} key={label}>
                          <span>{label}</span>
                          <strong title={hasProfileValue(value) && typeof value === 'string' ? value : undefined}>{hasProfileValue(value) ? String(value) : 'Not added'}</strong>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>

              <div className="flex gap-2 mt-6">
                <button className="btn btn-primary flex-1" onClick={() => { setSelectedUser(null); handleStartEditUser(selectedUser.id); }}>
                  <Edit3 size={16} /> Edit User
                </button>
                <button className="btn btn-secondary flex-1" onClick={() => setSelectedUser(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        , document.body)}

        {/* Edit User Modal */}
        {editingUser && createPortal(
          <div className="modal-overlay" onClick={handleCancelEdit}>
            <div className="modal-content glass-card-static" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', position: 'relative', maxHeight: '80vh', overflowY: 'auto' }}>
              <button 
                className="btn btn-icon" 
                onClick={handleCancelEdit}
                style={{ position: 'absolute', top: '12px', right: '12px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-tertiary)', zIndex: 1 }}
              >
                <X size={20} />
              </button>

              <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'bold', marginBottom: '20px' }}>Edit User Profile</h2>

              <form onSubmit={(e) => { e.preventDefault(); handleSaveEditUser(editingUser); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="grid-2" style={{ gap: '12px' }}>
                  <div>
                    <label className="input-label">Full Name *</label>
                    <input 
                      type="text" 
                      value={editFormData.name}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="input-label">Email *</label>
                    <input 
                      type="email" 
                      value={editFormData.email}
                      onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                </div>

                <div className="grid-2" style={{ gap: '12px' }}>
                  <div>
                    <label className="input-label">Role *</label>
                    <select 
                      value={editFormData.role}
                      onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                      className="input"
                      disabled={editingUser && accounts.find(a => a.id === editingUser)?.role === 'admin'}
                    >
                      {!(editingUser && accounts.find(a => a.id === editingUser)?.role === 'admin') && <option value="admin">Admin</option>}
                      <option value="moderator">Moderator</option>
                      <option value="help_desk">Help Desk</option>
                      <option value="guest">Guest</option>
                      <option value="banned">Banned</option>
                      <option value="student">Student</option>
                      <option value="alumni">Alumni</option>
                      <option value="alumni_with_carry">Alumni with Carry</option>
                      <option value="faculty">Faculty</option>
                    </select>
                    {editFormData.role === 'student' && (
                      <div className="admin-student-role-editor">
                        <span>Primary student role <small>Choose one: Regular, Re-add, CR, SR, VP or GS. Add-ons can be combined separately.</small></span>
                        <div className="admin-student-primary-roles">
                          {[
                            ['regular', 'Regular'], ['readd', 'Re-add'], ['cr', 'CR'], ['sr', 'SR'], ['vp', 'VP'], ['gs', 'GS'],
                          ].map(([studentRole, label]) => {
                            const selectedPrimary = (editFormData.studentRoles || []).find(role => exclusiveStudentRoles.includes(role)) || 'regular';
                            return (
                            <label key={studentRole}>
                              <input type="radio" name="admin-student-primary-role" checked={selectedPrimary === studentRole} onChange={() => setEditFormData(current => {
                                const selected = new Set(current.studentRoles || []);
                                exclusiveStudentRoles.forEach(exclusiveRole => selected.delete(exclusiveRole));
                                if (studentRole !== 'regular') selected.add(studentRole);
                                return { ...current, studentRoles: [...selected] };
                              })} />
                              {label}
                            </label>
                          );})}
                        </div>
                        <span>Optional student roles <small>Bus Coordinator and Clubs Representative may be combined with any primary student role.</small></span>
                        <div className="admin-student-addon-roles">
                          {[
                            ['bus_coordinator', 'Bus Coordinator'], ['clubs_representative', 'Clubs Representative'],
                          ].map(([studentRole, label]) => (
                            <label key={studentRole}>
                              <input type="checkbox" checked={(editFormData.studentRoles || []).includes(studentRole)} onChange={(event) => setEditFormData(current => {
                                const selected = new Set(current.studentRoles || []);
                                if (event.target.checked) selected.add(studentRole);
                                else selected.delete(studentRole);
                                return { ...current, studentRoles: [...selected] };
                              })} />
                              {label}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    {editFormData.role === 'faculty' && (
                      <div className="admin-student-role-editor">
                        <span>Faculty department <small>Choose exactly one department-specific faculty role.</small></span>
                        <div className="admin-student-primary-roles">
                          {facultyDepartments.map(department => (
                            <label key={department}>
                              <input type="radio" name="admin-faculty-department" value={department} checked={String(editFormData.facultyDepartment || editFormData.department).toUpperCase() === department} onChange={() => setEditFormData(current => ({ ...current, facultyDepartment: department, department }))} />
                              Faculty of {department}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="input-label">Department *</label>
                    <input 
                      type="text" 
                      value={editFormData.department}
                      onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                </div>

                {(editFormData.role === 'student' || editFormData.role === 'cr' || editFormData.role === 'sr' || editFormData.role === 'vp' || editFormData.role === 'gs' || editFormData.role === 'alumni' || editFormData.role === 'alumni_with_carry') && (
                  <div className="grid-2" style={{ gap: '12px' }}>
                    <div>
                      <label className="input-label">Batch Number</label>
                      <input 
                        type="text" 
                        value={editFormData.batchNo}
                        onChange={(e) => setEditFormData({ ...editFormData, batchNo: e.target.value })}
                        className="input"
                        placeholder="e.g., 45"
                      />
                    </div>
                    <div>
                      <label className="input-label">Batch Name</label>
                      <input 
                        type="text" 
                        value={editFormData.batch}
                        onChange={(e) => setEditFormData({ ...editFormData, batch: e.target.value, batchName: e.target.value })}
                        className="input"
                        placeholder="e.g., Batch 45"
                      />
                    </div>
                  </div>
                )}

                {editFormData.role === 'faculty' && (
                  <div>
                    <label className="input-label">Designation</label>
                    <input 
                      type="text" 
                      value={editFormData.designation}
                      onChange={(e) => setEditFormData({ ...editFormData, designation: e.target.value })}
                      className="input"
                      placeholder="e.g., Professor, Lecturer"
                    />
                  </div>
                )}

                <div className="grid-2" style={{ gap: '12px' }}>
                  <div>
                    <label className="input-label">Company</label>
                    <input 
                      type="text" 
                      value={editFormData.company}
                      onChange={(e) => setEditFormData({ ...editFormData, company: e.target.value })}
                      className="input"
                      placeholder="Current/Past employer"
                    />
                  </div>
                  <div>
                    <label className="input-label">Graduation Year</label>
                    <input 
                      type="text" 
                      value={editFormData.graduationYear}
                      onChange={(e) => setEditFormData({ ...editFormData, graduationYear: e.target.value })}
                      className="input"
                      placeholder="e.g., 2024"
                    />
                  </div>
                </div>

                {(editFormData.role === 'student' || editFormData.role === 'cr' || editFormData.role === 'sr' || editFormData.role === 'vp' || editFormData.role === 'gs') && (
                  <div className="grid-2" style={{ gap: '12px' }}>
                    <div>
                      <label className="input-label">Section</label>
                      <input 
                        type="text" 
                        value={editFormData.section}
                        onChange={(e) => setEditFormData({ ...editFormData, section: e.target.value })}
                        className="input"
                        placeholder="e.g., A, B, C"
                      />
                    </div>
                    <div>
                      <label className="input-label">Current Semester</label>
                      <input 
                        type="number" 
                        min="1"
                        max="8"
                        value={editFormData.semester}
                        onChange={(e) => setEditFormData({ ...editFormData, semester: Number(e.target.value) })}
                        className="input"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="input-label">CGPA</label>
                  <input 
                    type="number" 
                    min="0"
                    max="4"
                    step="0.01"
                    value={editFormData.cgpa}
                    onChange={(e) => setEditFormData({ ...editFormData, cgpa: Number(e.target.value) })}
                    className="input"
                    placeholder="0.00 - 4.00"
                  />
                </div>

                <div className="admin-edit-profile-section">
                  <strong>Personal & Contact</strong>
                  <div className="grid-2" style={{ gap: '12px' }}>
                    <label className="admin-edit-field"><span>Blood Group</span><select className="input" value={editFormData.bloodGroup} onChange={e => setEditFormData({ ...editFormData, bloodGroup: e.target.value })}><option value="">Not specified</option>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(group => <option key={group}>{group}</option>)}</select></label>
                    <label className="admin-edit-field"><span>Personal Email</span><input className="input" type="email" value={editFormData.personalEmail} onChange={e => setEditFormData({ ...editFormData, personalEmail: e.target.value })} /></label>
                    <label className="admin-edit-field"><span>WhatsApp / Phone</span><input className="input" value={editFormData.whatsapp} onChange={e => setEditFormData({ ...editFormData, whatsapp: e.target.value })} /></label>
                    <label className="admin-edit-field"><span>Profile Photo URL</span><input className="input" value={editFormData.avatar} onChange={e => setEditFormData({ ...editFormData, avatar: e.target.value })} /></label>
                    <label className="admin-edit-field"><span>Facebook</span><input className="input" value={editFormData.facebook} onChange={e => setEditFormData({ ...editFormData, facebook: e.target.value })} /></label>
                    <label className="admin-edit-field"><span>LinkedIn</span><input className="input" value={editFormData.linkedin} onChange={e => setEditFormData({ ...editFormData, linkedin: e.target.value })} /></label>
                    <label className="admin-edit-field"><span>Discord</span><input className="input" value={editFormData.discord} onChange={e => setEditFormData({ ...editFormData, discord: e.target.value })} /></label>
                  </div>
                </div>

                <div className="admin-edit-profile-section">
                  <strong>Academic Record</strong>
                  <div className="grid-2" style={{ gap: '12px' }}>
                    <label className="admin-edit-field"><span>Year / Semester</span><input className="input" value={editFormData.yearSemester} onChange={e => setEditFormData({ ...editFormData, yearSemester: e.target.value })} placeholder="e.g. Year 3 - Semester 1" /></label>
                    <label className="admin-edit-field"><span>Lab Section</span><input className="input" value={editFormData.labSection} onChange={e => setEditFormData({ ...editFormData, labSection: e.target.value })} /></label>
                    <label className="admin-edit-field"><span>Original Batch</span><input className="input" value={editFormData.originalBatch} onChange={e => setEditFormData({ ...editFormData, originalBatch: e.target.value })} /></label>
                    <label className="admin-edit-field"><span>Current Academic Batch</span><input className="input" value={editFormData.currentAcademicBatch} onChange={e => setEditFormData({ ...editFormData, currentAcademicBatch: e.target.value })} /></label>
                    <label className="admin-edit-field"><span>Current Semester</span><input className="input" value={editFormData.currentSemester} onChange={e => setEditFormData({ ...editFormData, currentSemester: e.target.value })} placeholder="e.g. 3.1" /></label>
                    <label className="admin-edit-field"><span>Maximum Semester</span><input className="input" value={editFormData.maxSemester} onChange={e => setEditFormData({ ...editFormData, maxSemester: e.target.value })} placeholder="e.g. 4.2" /></label>
                    <label className="admin-edit-field"><span>Academic Status</span><input className="input" value={editFormData.academicStatus} onChange={e => setEditFormData({ ...editFormData, academicStatus: e.target.value })} /></label>
                    <label className="admin-edit-field"><span>Account Status</span><select className="input" value={editFormData.accountStatus} onChange={e => setEditFormData({ ...editFormData, accountStatus: e.target.value })}>{['ACTIVE', 'PENDING_APPROVAL', 'ON_HOLD', 'DROPPED', 'GRADUATED'].map(status => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></label>
                    <label className="admin-edit-field"><span>Credits Completed</span><input className="input" type="number" min="0" value={editFormData.creditsCompleted} onChange={e => setEditFormData({ ...editFormData, creditsCompleted: Number(e.target.value) })} /></label>
                    <label className="admin-edit-field"><span>Total Credits</span><input className="input" type="number" min="0" value={editFormData.totalCredits} onChange={e => setEditFormData({ ...editFormData, totalCredits: Number(e.target.value) })} /></label>
                  </div>
                  <label className="admin-edit-checkbox"><input type="checkbox" checked={editFormData.openForTalk} onChange={e => setEditFormData({ ...editFormData, openForTalk: e.target.checked })} /> Open for talk</label>
                </div>

                <div className="flex gap-2 mt-4">
                  <button type="submit" className="btn btn-primary flex-1" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <Save size={16} /> Save Changes
                  </button>
                  <button type="button" className="btn btn-secondary flex-1" onClick={handleCancelEdit}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        , document.body)}

        {/* ACCOUNTS PANEL */}
        {activeTab === 'accounts' && (
          <div>
            {/* Account roles are shown as primary groups with their secondary memberships. */}
            <div className="admin-role-hierarchy mb-4">
              {[
                ['admin', 'Admin'], ['moderator', 'Moderator'], ['help_desk', 'Help Desk'],
                ['guest', 'Guest'], ['banned', 'Banned'],
              ].map(([role, label]) => (
                <button key={role} className={`admin-role-family admin-role-single ${roleFilter === role ? 'is-filtered' : ''}`} onClick={() => setRoleFilter(roleFilter === role ? 'all' : role)}>
                  <span><strong>{label}</strong><small>Primary role</small></span><b>{getRoleCount(role)}</b>
                </button>
              ))}

              <section className={`admin-role-family admin-role-family-student ${roleFilter === 'student' ? 'is-filtered' : ''}`}>
                <button className="admin-role-family-head" onClick={() => setRoleFilter(roleFilter === 'student' ? 'all' : 'student')}>
                  <span><strong>Student</strong><small>Primary group</small></span><b>{getRoleCount('student')}</b>
                </button>
                <div className="admin-role-children">
                  {[
                    ['regular', 'Regular'], ['readd', 'Re-add'], ['cr', 'CR'], ['sr', 'SR'],
                    ['vp', 'VP'], ['gs', 'GS'], ['bus_coordinator', 'Bus Coordinator'],
                    ['clubs_representative', 'Clubs Representative'],
                  ].map(([role, label]) => (
                    <button key={role} className={roleFilter === role ? 'is-filtered' : ''} onClick={() => setRoleFilter(roleFilter === role ? 'all' : role)}>
                      <span>{label}</span><b>{role === 'regular' ? getRegularStudentCount() : getRoleCount(role)}</b>
                    </button>
                  ))}
                </div>
                <p>Choose one primary role: Regular, Re-add, CR, SR, VP or GS. Bus and Clubs are optional add-ons.</p>
              </section>

              <section className={`admin-role-family ${roleFilter === 'alumni' ? 'is-filtered' : ''}`}>
                <button className="admin-role-family-head" onClick={() => setRoleFilter(roleFilter === 'alumni' ? 'all' : 'alumni')}>
                  <span><strong>Alumni</strong><small>Primary group</small></span><b>{getRoleCount('alumni')}</b>
                </button>
                <div className="admin-role-children">
                  {[['alumni_only', 'Alumni'], ['alumni_with_carry', 'Alumni with Carry']].map(([role, label]) => (
                    <button key={role} className={roleFilter === role ? 'is-filtered' : ''} onClick={() => setRoleFilter(roleFilter === role ? 'all' : role)}><span>{label}</span><b>{getRoleCount(role)}</b></button>
                  ))}
                </div>
              </section>

              <section className={`admin-role-family admin-role-faculty ${roleFilter === 'faculty' ? 'is-filtered' : ''}`}>
                <button className="admin-role-family-head" onClick={() => setRoleFilter(roleFilter === 'faculty' ? 'all' : 'faculty')}>
                  <span><strong>Faculty</strong><small>Primary group</small></span><b>{getRoleCount('faculty')}</b>
                </button>
                <div className="admin-role-children">
                  {facultyDepartments.map(department => {
                    const role = facultyDepartmentRole(department);
                    return (
                      <button key={role} className={roleFilter === role ? 'is-filtered' : ''} onClick={() => setRoleFilter(roleFilter === role ? 'all' : role)}>
                        <span>Faculty of {department}</span><b>{getRoleCount(role)}</b>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
            {/* Filters */}
            <div className="glass-card-static mb-4">
              <div className="flex gap-3 items-center flex-wrap">
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div className="flex items-center gap-2" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', padding: '0 12px' }}>
                    <Search size={16} style={{ color: 'var(--text-tertiary)' }} />
                    <input 
                      type="text" 
                      placeholder="Search by name, email, AUSTWise ID, Student ID, department..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ flex: 1, border: 'none', background: 'transparent', padding: '8px 0', outline: 'none', fontSize: 'var(--fs-sm)' }}
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                        <X size={14} style={{ color: 'var(--text-tertiary)' }} />
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ minWidth: '150px' }}>
                  <select 
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="input"
                    style={{ padding: '8px 12px', width: '100%' }}
                  >
                    <option value="all">All Roles</option>
                    <optgroup label="Student">
                      <option value="student">All students</option><option value="regular">Regular</option>
                      <option value="readd">Re-add</option><option value="cr">CR</option><option value="sr">SR</option>
                      <option value="vp">VP</option><option value="gs">GS</option><option value="bus_coordinator">Bus Coordinator</option>
                      <option value="clubs_representative">Clubs Representative</option>
                    </optgroup>
                    <optgroup label="Alumni"><option value="alumni">All alumni</option><option value="alumni_only">Alumni</option><option value="alumni_with_carry">Alumni with Carry</option></optgroup>
                    <optgroup label="Faculty">
                      <option value="faculty">All Faculty</option>
                      {facultyDepartments.map(department => <option key={department} value={facultyDepartmentRole(department)}>Faculty of {department}</option>)}
                    </optgroup>
                    <option value="guest">Guest</option><option value="admin">Admin</option>
                    <option value="moderator">Moderator</option><option value="help_desk">Help Desk</option><option value="banned">Banned</option>
                  </select>
                </div>
                <div style={{ minWidth: '135px' }}>
                  <select aria-label="Filter by department" value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)} className="input admin-directory-select">
                    <option value="all">All Departments</option>
                    {facultyDepartments.map(department => <option key={department} value={department}>{department}</option>)}
                  </select>
                </div>
                <div style={{ minWidth: '135px' }}>
                  <select aria-label="Filter by account status" value={accountStatusFilter} onChange={e => setAccountStatusFilter(e.target.value)} className="input admin-directory-select">
                    <option value="all">All Statuses</option>
                    {['ACTIVE', 'PENDING_APPROVAL', 'ON_HOLD', 'DROPPED', 'GRADUATED'].map(status => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
                  </select>
                </div>
                <div style={{ minWidth: '135px' }}>
                  <select aria-label="Sort users" value={accountSort} onChange={e => setAccountSort(e.target.value)} className="input admin-directory-select">
                    <option value="name-asc">Name: A to Z</option><option value="name-desc">Name: Z to A</option>
                    <option value="email-asc">Email</option><option value="department-asc">Department</option>
                    <option value="batch-asc">Batch</option><option value="newest">Newest accounts</option>
                  </select>
                </div>
                <div style={{ minWidth: '135px' }}>
                  <select aria-label="Group users by category" value={accountGrouping} onChange={e => setAccountGrouping(e.target.value)} className="input admin-directory-select">
                    <option value="none">No Grouping</option><option value="role">Group by Role</option>
                    <option value="department">Group by Department</option><option value="batch">Group by Batch</option>
                    <option value="status">Group by Status</option>
                  </select>
                </div>
                <div className="badge badge-blue" style={{ padding: '8px 12px', fontSize: '12px' }}>
                  {filteredAccounts.length} of {accounts.length} users
                </div>
              </div>
            </div>

            {/* Users Table */}
            <div className="glass-card-static admin-directory-card">
              <div className="admin-directory-heading">
                <div><h3>User Directory</h3><p>Browse and manage university accounts</p></div>
                <span>{filteredAccounts.length} shown</span>
              </div>

              <div className="admin-directory-scroll">
                <table className="admin-user-table">
                  <thead>
                    <tr>
                      <th>AUSTWise ID</th>
                      <th>Student ID</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Department</th>
                      <th>Batch</th>
                      <th className="admin-user-actions-head">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAccounts.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="admin-user-empty">
                          No users found matching your criteria.
                        </td>
                      </tr>
                    ) : (
                      groupedAccounts.flatMap(({ key, users }) => [
                        ...(key ? [<tr key={`group-${key}`} className="admin-user-group-row"><th colSpan="8">{key}<span>{users.length} users</span></th></tr>] : []),
                        ...users.map(acc => (
                        <tr key={acc.id} className="admin-user-row">
                          <td className="admin-user-id">{acc.awid || '—'}</td>
                          <td className="admin-user-id">{String(acc.email || '').match(/^\D*(\d+)@aust\.edu$/i)?.[1] || acc.studentId || '—'}</td>
                          <td className="admin-user-name-cell">
                            <div className="admin-user-name">
                              <div className="avatar" style={{ position: 'relative', overflow: 'hidden', width: 28, height: 28, fontSize: '10px', flexShrink: 0 }}>
                                {getAccountAvatar(acc) && <img
                                  src={getAccountAvatar(acc)}
                                  alt={`${acc.name || 'User'} profile`}
                                  referrerPolicy="no-referrer"
                                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                                  onError={event => { event.currentTarget.style.display = 'none'; if (event.currentTarget.nextElementSibling) event.currentTarget.nextElementSibling.style.display = 'grid'; }}
                                />}
                                <span style={{ display: getAccountAvatar(acc) ? 'none' : 'grid', width: '100%', height: '100%', placeItems: 'center' }}>
                                  {acc.name?.charAt(0)?.toUpperCase() || 'U'}
                                </span>
                              </div>
                              <span><strong>{acc.name}</strong><small>{acc.accountStatus || acc.status || 'ACTIVE'}</small></span>
                            </div>
                          </td>
                          <td className="admin-user-email">{acc.email}</td>
                          <td className="admin-user-roles">
                            <div className="admin-user-role-list">
                            {accountHasRole(acc, 'student') ? <>
                              <span className={`badge ${getRoleBadgeClass('student')}`}>Student</span>
                              {studentChildRoles.filter(role => accountRoleSet(acc).has(role)).map(role => (
                                <span key={role} className={`badge ${getRoleBadgeClass(role)}`}>{getRoleLabel(role)}</span>
                              ))}
                            </> : acc.role === 'faculty' ? <>
                              <span className={`badge ${getRoleBadgeClass('faculty')}`}>Faculty</span>
                              <span className={`badge ${getRoleBadgeClass(facultyDepartmentRole(acc.department))}`}>{getRoleLabel(facultyDepartmentRole(acc.department))}</span>
                            </> : <span className={`badge ${getRoleBadgeClass(acc.role)}`}>{getRoleLabel(acc.role)}</span>}
                            </div>
                          </td>
                          <td className="admin-user-meta-cell">
                            {acc.department || '-'}
                          </td>
                          <td className="admin-user-meta-cell">
                            {acc.batch || acc.batchNo || '-'}
                          </td>
                          <td className="admin-user-actions-cell">
                            <div>
                              <button 
                                className="btn btn-secondary btn-icon"
                                disabled={accountHasRole(acc, 'admin')}
                                onClick={() => handleViewUser(acc.id)}
                                title="View Profile"
                                style={{ 
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  color: accountHasRole(acc, 'admin') ? 'var(--text-tertiary)' : 'var(--accent-blue)',
                                  opacity: accountHasRole(acc, 'admin') ? 0.4 : 1,
                                  cursor: accountHasRole(acc, 'admin') ? 'not-allowed' : 'pointer',
                                  padding: '4px',
                                  width: '28px',
                                  height: '28px'
                                }}
                              >
                                <Eye size={14} />
                              </button>
                              <button 
                                className="btn btn-secondary btn-icon"
                                disabled={accountHasRole(acc, 'admin')}
                                onClick={() => handleStartEditUser(acc.id)}
                                title="Edit User"
                                style={{ 
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  color: accountHasRole(acc, 'admin') ? 'var(--text-tertiary)' : 'var(--accent-amber)',
                                  opacity: accountHasRole(acc, 'admin') ? 0.4 : 1,
                                  cursor: accountHasRole(acc, 'admin') ? 'not-allowed' : 'pointer',
                                  padding: '4px',
                                  width: '28px',
                                  height: '28px'
                                }}
                              >
                                <Edit3 size={14} />
                              </button>
                              <button 
                                className="btn btn-secondary btn-icon"
                                disabled={accountHasRole(acc, 'admin')}
                                onClick={() => handleDeleteAccount(acc.id)}
                                title="Delete User"
                                style={{ 
                                  color: accountHasRole(acc, 'admin') ? 'var(--text-tertiary)' : 'var(--accent-rose)',
                                  opacity: accountHasRole(acc, 'admin') ? 0.4 : 1,
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: accountHasRole(acc, 'admin') ? 'not-allowed' : 'pointer',
                                  padding: '4px',
                                  width: '28px',
                                  height: '28px'
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                      ])
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TEMPLATES PANEL (Routine) */}
        {activeTab === 'templates' && (
          <RoutineTemplatesPanel />
        )}

        {/* APPLICATIONS PANEL */}
        {activeTab === 'applications' && (
          <div>
            <div className="glass-card-static mb-4">
              <div className="flex gap-3 items-center flex-wrap">
                <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', margin: 0 }}>Role Applications</h3>
                <div style={{ flex: 1 }} />
                <div className="flex gap-2">
                  <button 
                    className={`btn btn-sm ${applicationFilter === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setApplicationFilter('pending')}
                  >
                    Pending
                  </button>
                  <button 
                    className={`btn btn-sm ${applicationFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setApplicationFilter('all')}
                  >
                    All
                  </button>
                </div>
              </div>
            </div>

            <div className="glass-card-static">
              {applications.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  <ClipboardList size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                  <p>No applications received yet.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {applications
                    .filter(app => applicationFilter === 'all' ? true : app.status === applicationFilter)
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .map(app => (
                      <div 
                        key={app.id} 
                        className="p-4" 
                        style={{ 
                          background: 'var(--bg-input)', 
                          border: `1px solid ${app.status === 'pending' ? 'var(--border-primary)' : app.status === 'approved' ? 'var(--accent-emerald)' : 'var(--accent-rose)'}`,
                          borderRadius: 'var(--radius-lg)',
                          cursor: 'pointer'
                        }}
                        onClick={() => setSelectedApplication(app)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <div className="avatar" style={{ width: 40, height: 40, fontSize: '14px' }}>
                              {app.userName?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                            <div>
                              <h4 style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold', margin: 0 }}>{app.userName}</h4>
                              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>{app.userEmail}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`badge ${['cr', 'vp'].includes(app.appliedRole) ? 'badge-amber' : 'badge-emerald'}`} style={{ fontSize: '9px', padding: '1px 4px' }}>
                                  {applicationRoleName(app.appliedRole)}
                                </span>
                                <span className="badge badge-blue" style={{ fontSize: '9px', padding: '1px 4px' }}>
                                  {app.userDepartment}
                                </span>
                                <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                                  {app.userBatch || `Batch ${app.userBatch}`}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`badge ${app.status === 'pending' ? 'badge-blue' : app.status === 'approved' ? 'badge-emerald' : 'badge-rose'}`} style={{ fontSize: '9px', padding: '2px 8px' }}>
                              {app.status.toUpperCase()}
                            </span>
                            <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                              {new Date(app.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        {app.statement && (
                          <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: '8px', fontStyle: 'italic', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            "{app.statement}"
                          </p>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* REPRESENTATIVES DIRECTORY PANEL */}
        {activeTab === 'representatives' && (
          <div>
            <div className="glass-card-static mb-6">
              <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', marginBottom: '4px' }}>CR/SR Directory</h3>
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>All Class Representatives and Student Representatives grouped by department and batch</p>
            </div>

            {/* CR Section */}
            <div className="glass-card-static mb-6">
              <h4 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge badge-amber" style={{ fontSize: '12px', padding: '4px 10px' }}>CR</span> Class Representatives
              </h4>
              {(() => {
                const crAccounts = accounts.filter(acc => accountHasRole(acc, 'cr'));
                if (crAccounts.length === 0) {
                  return <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', padding: '20px', textAlign: 'center' }}>No Class Representatives found.</p>;
                }
                // Group by department, then by batch
                const groupedByDept = {};
                crAccounts.forEach(acc => {
                  const dept = acc.department || 'Department not set';
                  const batch = acc.batch || acc.batchNo || 'N/A';
                  if (!groupedByDept[dept]) groupedByDept[dept] = {};
                  if (!groupedByDept[dept][batch]) groupedByDept[dept][batch] = [];
                  groupedByDept[dept][batch].push(acc);
                });
                return Object.entries(groupedByDept).map(([dept, batches]) => (
                  <div key={dept} style={{ marginBottom: '20px' }}>
                    <div className="flex items-center gap-2 mb-3" style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: '8px' }}>
                      <span className="badge badge-blue" style={{ fontSize: '11px', padding: '3px 8px' }}>{dept}</span>
                    </div>
                    {Object.entries(batches).map(([batch, reps]) => (
                      <div key={batch} style={{ marginBottom: '12px', paddingLeft: '12px', borderLeft: '2px solid var(--border-secondary)' }}>
                        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: '6px', display: 'block' }}>Batch {batch}</span>
                        <div className="grid-2" style={{ gap: '8px' }}>
                          {reps.map(rep => (
                            <div key={rep.id} className="p-3 flex items-center gap-3" style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
                              <div className="avatar" style={{ width: 36, height: 36, fontSize: '12px', flexShrink: 0 }}>
                                {rep.name?.charAt(0)?.toUpperCase() || 'R'}
                              </div>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <p style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rep.name}</p>
                                <p style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                  {rep.section && `Section ${rep.section}`}
                                  {rep.labSection && `${rep.section ? ', ' : ''}Lab ${rep.labSection}`}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ));
              })()}
            </div>

            {/* SR Section */}
            <div className="glass-card-static">
              <h4 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge badge-emerald" style={{ fontSize: '12px', padding: '4px 10px' }}>SR</span> Student Representatives
              </h4>
              {(() => {
                const srAccounts = accounts.filter(acc => accountHasRole(acc, 'sr'));
                if (srAccounts.length === 0) {
                  return <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', padding: '20px', textAlign: 'center' }}>No Student Representatives found.</p>;
                }
                // Group by department, then by batch
                const groupedByDept = {};
                srAccounts.forEach(acc => {
                  const dept = acc.department || 'Department not set';
                  const batch = acc.batch || acc.batchNo || 'N/A';
                  if (!groupedByDept[dept]) groupedByDept[dept] = {};
                  if (!groupedByDept[dept][batch]) groupedByDept[dept][batch] = [];
                  groupedByDept[dept][batch].push(acc);
                });
                return Object.entries(groupedByDept).map(([dept, batches]) => (
                  <div key={dept} style={{ marginBottom: '20px' }}>
                    <div className="flex items-center gap-2 mb-3" style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: '8px' }}>
                      <span className="badge badge-blue" style={{ fontSize: '11px', padding: '3px 8px' }}>{dept}</span>
                    </div>
                    {Object.entries(batches).map(([batch, reps]) => (
                      <div key={batch} style={{ marginBottom: '12px', paddingLeft: '12px', borderLeft: '2px solid var(--border-secondary)' }}>
                        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: '6px', display: 'block' }}>Batch {batch}</span>
                        <div className="grid-2" style={{ gap: '8px' }}>
                          {reps.map(rep => (
                            <div key={rep.id} className="p-3 flex items-center gap-3" style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
                              <div className="avatar" style={{ width: 36, height: 36, fontSize: '12px', flexShrink: 0 }}>
                                {rep.name?.charAt(0)?.toUpperCase() || 'R'}
                              </div>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <p style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rep.name}</p>
                                <p style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                  {rep.section && `Section ${rep.section}`}
                                  {rep.labSection && `${rep.section ? ', ' : ''}Lab ${rep.labSection}`}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {/* Application Review Modal */}
        {selectedApplication && createPortal(
          <div className="modal-overlay" onClick={() => setSelectedApplication(null)}>
            <div className="modal-content glass-card-static app-review-modal" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="app-review-header">
                <div>
                  <h2>Review Application</h2>
                  <p>Review and respond to the applicant's request</p>
                </div>
                <button
                  className="btn btn-icon"
                  onClick={() => setSelectedApplication(null)}
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Applicant Info */}
              <div className="app-review-applicant">
                <div className="avatar" style={{ width: 52, height: 52, fontSize: '18px', flexShrink: 0 }}>
                  {selectedApplication.userName?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div className="app-review-applicant-meta">
                  <h3>{selectedApplication.userName}</h3>
                  <p>{selectedApplication.userEmail}</p>
                </div>
                <span className={`badge ${['cr', 'vp'].includes(selectedApplication.appliedRole) ? 'badge-amber' : 'badge-emerald'}`}>
                  {applicationRoleName(selectedApplication.appliedRole)} Application
                </span>
              </div>

              {/* Details */}
              <div className="grid-2 app-review-details">
                <div className="app-review-cell">
                  <span>Department</span>
                  <strong>{selectedApplication.userDepartment || '—'}</strong>
                </div>
                <div className="app-review-cell">
                  <span>Semester</span>
                  <strong>{selectedApplication.userSemester || '—'}</strong>
                </div>
                <div className="app-review-cell">
                  <span>Batch</span>
                  <strong>{selectedApplication.userBatch || '—'}</strong>
                </div>
                <div className="app-review-cell">
                  <span>Section</span>
                  <strong>{selectedApplication.userSection || '—'}</strong>
                </div>
                <div className="app-review-cell">
                  <span>Lab Group</span>
                  <strong>{selectedApplication.userLabSection || '—'}</strong>
                </div>
              </div>

              {/* Target role */}
              {(selectedApplication.targetLabSection || selectedApplication.targetSection || ['vp', 'gs'].includes(selectedApplication.appliedRole)) && (
                <div className={`app-review-target ${selectedApplication.appliedRole === 'sr' ? 'is-sr' : ''}`}>
                  <div>
                    <span>Applying for</span>
                    <strong>
                      {applicationRoleName(selectedApplication.appliedRole)}
                    </strong>
                  </div>
                  <span className="app-review-target-slot">
                    {selectedApplication.appliedRole === 'cr'
                      ? `Lab ${selectedApplication.targetLabSection}`
                      : selectedApplication.appliedRole === 'sr'
                        ? `Section ${selectedApplication.targetSection}`
                        : `Department of ${selectedApplication.userDepartment}`}
                  </span>
                </div>
              )}

              {/* Statement */}
              <div className="app-review-statement">
                <span>Statement</span>
                <p>{selectedApplication.statement || 'No statement provided.'}</p>
              </div>

              {/* Applied on */}
              <div className="app-review-date">
                <CalendarDays size={14} />
                Applied on {new Date(selectedApplication.createdAt).toLocaleString()}
              </div>

              {/* Actions */}
              {selectedApplication.status === 'pending' && (
                <div className="app-review-actions">
                  {(!['vp', 'gs', 'faculty'].includes(selectedApplication.appliedRole) || currentUser?.role === 'admin') && (
                  <button
                    className="btn btn-primary"
                    onClick={async () => {
                      if (window.confirm(`Approve ${selectedApplication.userName}'s application for ${applicationRoleName(selectedApplication.appliedRole)}?`)) {
                        const reviewerId = getCurrentUserId() || 'ADM-MSOP6VG6BVL4';
                        try {
                          const reviewed = await reviewRoleApplication(selectedApplication.id, 'approved', reviewerId);
                          const updatedApplications = applications.map(app =>
                            app.id === selectedApplication.id
                              ? (reviewed || { ...app, status: 'approved', reviewedAt: new Date().toISOString(), reviewedBy: reviewerId })
                              : app
                          );
                          // Sync the assigned role to the server so the user's
                          // powers persist across reloads (server is source of
                          // truth for roles via /api/auth/me).
                          const roleRes = await fetch('/api/admin/users/role', {
                            method: 'POST',
                            credentials: 'same-origin',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId: selectedApplication.userId, role: selectedApplication.appliedRole }),
                          });
                          if (roleRes.ok) {
                            const roleData = await roleRes.json().catch(() => ({}));
                            if (roleData.user) {
                              // Keep the Users tab in sync with the new role.
                              setAccounts(prev => prev.map(acc =>
                                acc.id === roleData.user.id ? { ...acc, ...roleData.user } : acc
                              ));
                            }
                          }
                          // Confirmation mail → lands in the applicant's ConnectBox inbox.
                          sendMessage(reviewerId, selectedApplication.userId,
                            `🎉 Congratulations ${selectedApplication.userName}! Your application for ${applicationRoleName(selectedApplication.appliedRole)} has been APPROVED by the admin.`
                          );
                          setApplications(updatedApplications);
                          localStorage.setItem('aust-role-applications-v1', JSON.stringify(updatedApplications));
                          setSelectedApplication(null);
                        } catch (err) {
                          window.alert(err.message || 'Failed to approve application.');
                        }
                      }
                    }}
                  >
                    <CheckCircle2 size={16} /> Approve & Assign Role
                  </button>
                  )}
                  <button
                    className="btn btn-secondary"
                    onClick={async () => {
                      if (window.confirm(`Reject ${selectedApplication.userName}'s application?`)) {
                        const reviewerId = getCurrentUserId() || 'ADM-MSOP6VG6BVL4';
                        try {
                          const reviewed = await reviewRoleApplication(selectedApplication.id, 'rejected', reviewerId);
                          // Notification mail → lands in the applicant's ConnectBox inbox.
                          sendMessage(reviewerId, selectedApplication.userId,
                            `Your application for ${applicationRoleName(selectedApplication.appliedRole)} was REJECTED by the admin.`
                          );
                          const updatedApplications = applications.map(app =>
                            app.id === selectedApplication.id
                              ? (reviewed || { ...app, status: 'rejected', reviewedAt: new Date().toISOString(), reviewedBy: reviewerId })
                              : app
                          );
                          setApplications(updatedApplications);
                          localStorage.setItem('aust-role-applications-v1', JSON.stringify(updatedApplications));
                          setSelectedApplication(null);
                        } catch (err) {
                          window.alert(err.message || 'Failed to reject application.');
                        }
                      }
                    }}
                  >
                    <XCircle size={16} /> Reject
                  </button>
                </div>
              )}

              {selectedApplication.status !== 'pending' && (
                <div className={`app-review-status ${selectedApplication.status === 'approved' ? 'is-approved' : 'is-rejected'}`}>
                  <p>This application has been {selectedApplication.status}.</p>
                  {selectedApplication.reviewedAt && (
                    <span>Reviewed on {new Date(selectedApplication.reviewedAt).toLocaleDateString()}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        , document.body)}

        {/* AUDITORIUM ADMIN PANEL */}
        {activeTab === 'auditorium' && <AdminAuditoriumPanel />}

        {/* CHEATSHEETS ADMIN PANEL */}
        {activeTab === 'cheatsheets' && <AdminCheatsheetsPanel />}

        {/* QUESTION BANK ADMIN PANEL */}
        {activeTab === 'question-bank' && <div className="admin-question-bank-page">
          <SidebarPageAccessHeader pageKey="/vault" />
          <SidebarPageAccessPanel pageKey="/vault" featureKey="feature:vault:question-bank" part="both" />
          <QuestionBankPanel />
        </div>}

        {/* CAMPUS MAP ADMIN PANEL */}
        {activeTab === 'campus-map' && <AdminCampusMapPanel />}

        {/* TELEGRAM CONNECTIONS DIRECTORY */}
        {activeTab === 'telegram-connections' && <TelegramConnectionsPanel />}
      </div>
    </div>
  );
}

// ─── M.H Khan Auditorium Admin Panel ─────────────────────────────────────
// Lets admins schedule a seminar/event for the auditorium. The event is
// persisted to localStorage ('aust-auditorium-event') and reflected on the
// Free Rooms page (Ground Floor) via the 'auditorium-updated' event.
function AdminAuditoriumPanel() {
  const [evt, setEvt] = useState(() => getAuditoriumEvent());
  const [savedMsg, setSavedMsg] = useState('');

  const update = (patch) => setEvt((e) => ({ ...e, ...patch }));

  const handleSave = (e) => {
    e.preventDefault();
    if (evt.status !== 'none' && !evt.title.trim()) {
      setSavedMsg({ type: 'error', text: 'Event title is required when a seminar is scheduled.' });
      return;
    }
    setAuditoriumEvent(evt);
    setSavedMsg({ type: 'success', text: 'Saved! The Free Rooms page now reflects this event.' });
  };

  const handleClear = () => {
    const cleared = { ...defaultAuditoriumEvent };
    setEvt(cleared);
    setAuditoriumEvent(cleared);
    setSavedMsg({ type: 'success', text: 'Cleared. Auditorium is now available (Free).' });
  };

  const statusOptions = [
    { id: 'none', label: 'No Event', desc: 'Auditorium shows as Free / available' },
    { id: 'upcoming', label: 'Upcoming', desc: 'Event scheduled — shows as Busy' },
    { id: 'ongoing', label: 'In Progress', desc: 'Happening now — shows as Busy' },
  ];

  return (
    <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'start' }}>
      {/* Event form */}
      <div className="glass-card-static">
        <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Mic size={16} style={{ color: 'var(--accent-purple)' }} /> M.H Khan Auditorium
        </h3>
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Schedule a seminar or event. It appears live on the Free Rooms page (Ground Floor).
        </p>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label className="input-label">Event Title *</label>
            <input
              type="text"
              value={evt.title}
              onChange={(e) => update({ title: e.target.value })}
              className="input"
              placeholder="e.g., Tech Talk: AI in 2026"
              disabled={evt.status === 'none'}
            />
          </div>

          <div className="grid-2" style={{ gap: '10px' }}>
            <div>
              <label className="input-label">Date</label>
              <input
                type="date"
                value={evt.date}
                onChange={(e) => update({ date: e.target.value })}
                className="input"
                disabled={evt.status === 'none'}
              />
            </div>
            <div>
              <label className="input-label">Time</label>
              <input
                type="text"
                value={evt.time}
                onChange={(e) => update({ time: e.target.value })}
                className="input"
                placeholder="e.g., 10:00 AM – 12:00 PM"
                disabled={evt.status === 'none'}
              />
            </div>
          </div>

          <div>
            <label className="input-label">Speaker / Organizer</label>
            <input
              type="text"
              value={evt.speaker}
              onChange={(e) => update({ speaker: e.target.value })}
              className="input"
              placeholder="e.g., Dr. Rahman, CSE Dept"
              disabled={evt.status === 'none'}
            />
          </div>

          <div>
            <label className="input-label">Description</label>
            <textarea
              value={evt.description}
              onChange={(e) => update({ description: e.target.value })}
              className="input"
              style={{ minHeight: '80px', resize: 'vertical' }}
              placeholder="Short summary of the seminar…"
              disabled={evt.status === 'none'}
            />
          </div>

          <div>
            <label className="input-label" style={{ display: 'block', marginBottom: '6px' }}>Status</label>
            <div className="flex gap-2">
              {statusOptions.map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  className={`btn btn-sm flex-1 ${evt.status === opt.id ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => update({ status: opt.id })}
                  title={opt.desc}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', margin: '6px 0 0' }}>
              {statusOptions.find((o) => o.id === evt.status)?.desc}
            </p>
          </div>

          {savedMsg && (
            <p style={{ fontSize: 'var(--fs-xs)', fontWeight: 'bold', color: savedMsg.type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
              {savedMsg.text}
            </p>
          )}

          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary flex-1" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Save size={14} /> Save Event
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleClear} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-rose)' }}>
              <Ban size={14} /> Clear
            </button>
          </div>
        </form>
      </div>

      {/* Live preview */}
      <div className="glass-card-static">
        <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CalendarClock size={16} style={{ color: 'var(--accent-cyan)' }} /> Current Auditorium Status
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-input)',
              border: `1px solid ${evt.status === 'none' ? 'var(--accent-emerald)' : 'var(--accent-purple)'}`,
              borderLeft: `3px solid ${evt.status === 'none' ? 'var(--accent-emerald)' : 'var(--accent-purple)'}`,
            }}
          >
            <div className="flex justify-between items-center" style={{ marginBottom: '6px' }}>
              <strong style={{ fontSize: '13px' }}>M.H Khan Auditorium</strong>
              <span
                className="badge"
                style={{
                  fontSize: '9px',
                  background: evt.status === 'none' ? 'var(--accent-emerald-glow)' : 'var(--accent-purple)',
                  color: evt.status === 'none' ? 'var(--accent-emerald)' : '#fff',
                }}
              >
                {evt.status === 'none' ? 'FREE' : evt.status === 'ongoing' ? 'IN PROGRESS' : 'UPCOMING'}
              </span>
            </div>
            {evt.status === 'none' ? (
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-emerald)', margin: 0 }}>
                Available · No event scheduled
              </p>
            ) : (
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                <p style={{ margin: '0 0 2px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{evt.title || 'Untitled event'}</p>
                {evt.speaker && <p style={{ margin: 0 }}>Speaker: {evt.speaker}</p>}
                <p style={{ margin: 0 }}>
                  {[evt.date && new Date(evt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), evt.time].filter(Boolean).join(' · ') || 'Date / time TBD'}
                </p>
                {evt.description && <p style={{ margin: '4px 0 0' }}>{evt.description}</p>}
              </div>
            )}
          </div>

          <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', lineHeight: '1.5' }}>
            Students on the Free Rooms page will see this card on the Ground Floor.
            Set status to <strong>No Event</strong> when the auditorium is free for self-study.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Admin Cheatsheets Panel ─────────────────────────────────────────────
function AdminCheatsheetsPanel() {
  const [sheets, setSheets] = useState([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [course, setCourse] = useState('');
  const [formulas, setFormulas] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const loadData = () => {
    fetch('/api/cheatsheets')
      .then(r => r.json())
      .then(d => { if (d.success) setSheets(d.cheatsheets || []); })
      .catch(() => setStatusMsg('Failed to load cheatsheets'));
  };

  useEffect(() => { loadData(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    const formulaList = formulas.split('\n').map(f => f.trim()).filter(Boolean);
    if (!title.trim()) return;
    try {
      const res = await fetch('/api/cheatsheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), category: category.trim() || 'General', course: course.trim(), formulas: formulaList }),
      });
      const d = await res.json();
      if (d.success) {
        setTitle(''); setCategory(''); setCourse(''); setFormulas('');
        setStatusMsg('Added!');
        loadData();
      } else {
        setStatusMsg('Error: ' + (d.error || 'Unknown'));
      }
    } catch { setStatusMsg('Request failed'); }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch('/api/cheatsheets/' + encodeURIComponent(id), { method: 'DELETE' });
      const d = await res.json();
      if (d.success) { setStatusMsg('Deleted'); loadData(); }
      else setStatusMsg('Error: ' + (d.error || 'Unknown'));
    } catch { setStatusMsg('Delete failed'); }
  };

  return (
    <div className="glass-card-static">
      <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', marginBottom: '16px' }}>Manage Cheatsheets</h3>
      {statusMsg && <p style={{ fontSize: '12px', color: 'var(--accent-cyan)', marginBottom: '8px' }}>{statusMsg}</p>}
      <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
        <div className="flex gap-2 flex-wrap">
          <input className="input" placeholder="Title *" value={title} onChange={e => setTitle(e.target.value)} style={{ flex: 2, minWidth: '160px' }} required />
          <input className="input" placeholder="Category" value={category} onChange={e => setCategory(e.target.value)} style={{ flex: 1, minWidth: '120px' }} />
          <input className="input" placeholder="Course code" value={course} onChange={e => setCourse(e.target.value)} style={{ flex: 1, minWidth: '120px' }} />
        </div>
        <textarea className="input" placeholder="Formulas (one per line)" value={formulas} onChange={e => setFormulas(e.target.value)} rows={4} style={{ resize: 'vertical' }} />
        <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}><Plus size={14} /> Add</button>
      </form>
      <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: '12px' }}>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>{sheets.length} cheatsheets</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
          {sheets.map(s => (
            <div key={s.id} className="flex justify-between items-center p-3" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <strong style={{ fontSize: '13px' }}>{s.title}</strong>
                <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginLeft: '8px' }}>{s.category} {s.course && '· ' + s.course}</span>
              </div>
              <button className="btn btn-secondary btn-icon" onClick={() => handleDelete(s.id)} style={{ color: 'var(--accent-rose)', border: 'none', background: 'transparent', padding: '4px' }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Admin Campus Map Panel ──────────────────────────────────────────────
function AdminCampusMapPanel() {
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState({ floor: '', roomId: '', name: '', type: 'classroom', hotspotData: '', x: '', y: '' });
  const [statusMsg, setStatusMsg] = useState('');

  const loadData = () => {
    fetch('/api/campus-locations')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          const flat = [];
          (d.floors || []).forEach(f => (f.rooms || []).forEach(r => flat.push({ ...r, floor: f.floor, mapImage: f.mapImage })));
          setLocations(flat);
        }
      })
      .catch(() => setStatusMsg('Failed to load'));
  };

  useEffect(() => { loadData(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.floor.trim() || !form.roomId.trim() || !form.name.trim()) return;
    let hd = {};
    try { hd = JSON.parse(form.hotspotData); } catch {}
    const body = { floor: form.floor, roomId: form.roomId, name: form.name, type: form.type, hotspotData: hd, x: form.x ? Number(form.x) : null, y: form.y ? Number(form.y) : null };
    try {
      const res = await fetch('/api/campus-locations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json();
      if (d.success) { setForm({ floor: '', roomId: '', name: '', type: 'classroom', hotspotData: '', x: '', y: '' }); setStatusMsg('Added!'); loadData(); }
      else setStatusMsg('Error: ' + (d.error || 'Unknown'));
    } catch { setStatusMsg('Request failed'); }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch('/api/campus-locations/' + encodeURIComponent(id), { method: 'DELETE' });
      if (res.ok) { setStatusMsg('Deleted'); loadData(); }
      else setStatusMsg('Delete failed');
    } catch { setStatusMsg('Delete failed'); }
  };

  return (
    <div className="glass-card-static">
      <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', marginBottom: '16px' }}>Manage Campus Map Locations</h3>
      {statusMsg && <p style={{ fontSize: '12px', color: 'var(--accent-cyan)', marginBottom: '8px' }}>{statusMsg}</p>}
      <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
        <div className="flex gap-2 flex-wrap">
          <input className="input" placeholder="Floor *" value={form.floor} onChange={e => setForm({ ...form, floor: e.target.value })} style={{ flex: 1, minWidth: '80px' }} required />
          <input className="input" placeholder="Room ID *" value={form.roomId} onChange={e => setForm({ ...form, roomId: e.target.value })} style={{ flex: 1, minWidth: '100px' }} required />
          <input className="input" placeholder="Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={{ flex: 2, minWidth: '140px' }} required />
          <select className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={{ flex: 1, minWidth: '100px' }}>
            <option value="classroom">Classroom</option>
            <option value="lab">Lab</option>
            <option value="admin">Admin</option>
            <option value="facility">Facility</option>
            <option value="hall">Hall</option>
            <option value="library">Library</option>
            <option value="lift">Lift</option>
            <option value="washroom">Washroom</option>
          </select>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input className="input" placeholder='Hotspot JSON e.g. {"left":10,"top":20,"width":15,"height":10}' value={form.hotspotData} onChange={e => setForm({ ...form, hotspotData: e.target.value })} style={{ flex: 3, minWidth: '200px', fontSize: '11px' }} />
          <input className="input" type="number" placeholder="X %" value={form.x} onChange={e => setForm({ ...form, x: e.target.value })} style={{ flex: 0.5, minWidth: '60px' }} />
          <input className="input" type="number" placeholder="Y %" value={form.y} onChange={e => setForm({ ...form, y: e.target.value })} style={{ flex: 0.5, minWidth: '60px' }} />
        </div>
        <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}><Plus size={14} /> Add Location</button>
      </form>
      <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: '12px' }}>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>{locations.length} locations</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
          {locations.map(l => (
            <div key={l.id || l.roomId} className="flex justify-between items-center p-3" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <strong style={{ fontSize: '13px' }}>{l.name}</strong>
                <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginLeft: '8px' }}>{l.roomId} · Floor {l.floor} · {l.type}</span>
              </div>
              <button className="btn btn-secondary btn-icon" onClick={() => handleDelete(l.id)} style={{ color: 'var(--accent-rose)', border: 'none', background: 'transparent', padding: '4px' }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
