import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, BellRing, Coffee, Activity, Users, Trash2, Plus, Check, AlertCircle, Eye, Edit3, Search, X, Save, User, FileText, CheckCircle2, XCircle, Clock3, ClipboardList, CalendarDays, Mic, CalendarClock, Ban } from 'lucide-react';
import { notices, canteenData, libraryData, getAuditoriumEvent, setAuditoriumEvent, defaultAuditoriumEvent } from '../../data/mockData';
import { getRoleLabel, getRoleBadgeClass, updateAccountProfile, getAccountById, getAllAccounts, getAllRoleApplications, reviewRoleApplication, getAccountById as getUserById, resetAllLocalData, getCurrentUserId } from '../../utils/authStorage';
import { loadTemplates, saveTemplates, addTemplate, updateTemplate, deleteTemplate } from '../../utils/routineTemplates';
import { sendMessage } from '../../utils/messageStorage';
import RoutineTemplatesPanel from './RoutineTemplatesPanel';
import TranscriptTemplatesPanel from './TranscriptTemplatesPanel';
import './AdminPanelPage.css';

export default function AdminPanelPage() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Determine active tab from URL path
  const getTabFromPath = () => {
    const path = location.pathname;
    if (path === '/admin/notice-board') return 'notices';
    if (path === '/admin/canteen') return 'canteen';
    if (path === '/admin/library') return 'library';
    if (path === '/admin/users') return 'accounts';
    if (path === '/admin/applications') return 'applications';
    if (path === '/admin/cr-sr-directory') return 'representatives';
    if (path === '/admin/templates') return 'templates';
    if (path === '/admin/transcript-templates') return 'transcript-templates';
    if (path === '/admin/auditorium') return 'auditorium';
    if (path === '/admin/cheatsheets') return 'cheatsheets';
    if (path === '/admin/campus-map') return 'campus-map';
    return 'overview';
  };
  
  const [activeTab, setActiveTab] = useState(getTabFromPath);
  
  // Sync active tab with URL when navigating via sidebar
  useEffect(() => {
    setActiveTab(getTabFromPath());
  }, [location.pathname]);

  // Navigate to a tab and update URL
  const navigateToTab = (tab) => {
    const paths = {
      'overview': '/admin',
      'notices': '/admin/notice-board',
      'canteen': '/admin/canteen',
      'library': '/admin/library',
      'accounts': '/admin/users',
      'applications': '/admin/applications',
      'representatives': '/admin/cr-sr-directory',
      'templates': '/admin/templates',
      'transcript-templates': '/admin/transcript-templates',
      'auditorium': '/admin/auditorium',
      'cheatsheets': '/admin/cheatsheets',
      'campus-map': '/admin/campus-map'
    };
    navigate(paths[tab] || '/admin');
  };

  // Notices State
  const [noticesList, setNoticesList] = useState([]);
  const [noticeForm, setNoticeForm] = useState({
    title: '',
    category: 'Admin',
    pinned: false,
    content: ''
  });

  // Canteen State
  const [canteenInfo, setCanteenInfo] = useState({
    status: 'closed',
    crowdLevel: 0,
    hours: '8:00 AM - 7:00 PM',
    menu: []
  });

  // Canteen food item form
  const [foodForm, setFoodForm] = useState({
    name: '',
    category: 'Meals',
    price: '',
    popular: false,
    available: true
  });

  // Library State
  const [libraryInfo, setLibraryInfo] = useState({
    totalSeats: 120,
    occupied: 0,
    peakHours: []
  });

  // User Accounts State
  const [accounts, setAccounts] = useState([]);
  const [filteredAccounts, setFilteredAccounts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  // CR/SR Applications State
  const [applications, setApplications] = useState([]);
  const [applicationFilter, setApplicationFilter] = useState('pending');
  const [selectedApplication, setSelectedApplication] = useState(null);

  // Routine Templates State
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    semester: '1-1',
    department: 'CSE',
    year: new Date().getFullYear().toString(),
    routine: {},
    weekDays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']
  });

  // Load Data from LocalStorage
  useEffect(() => {
    // 1. Notices
    const storedNotices = localStorage.getItem('aust-notices');
    if (storedNotices) {
      setNoticesList(JSON.parse(storedNotices));
    } else {
      setNoticesList(notices);
    }

    // 2. Canteen
    const storedCanteen = localStorage.getItem('aust-canteen-data');
    if (storedCanteen) {
      setCanteenInfo(JSON.parse(storedCanteen));
    } else {
      setCanteenInfo(canteenData);
    }

    // 3. Library
    const storedLibrary = localStorage.getItem('aust-library-data');
    if (storedLibrary) {
      setLibraryInfo(JSON.parse(storedLibrary));
    } else {
      setLibraryInfo(libraryData);
    }

    // 4. Accounts — go through getAllAccounts() so the auth-storage purge
    // filter runs first (it drops leftover dummy/QA/demo accounts and old
    // admin identities, but keeps all real accounts), instead of reading
    // the raw localStorage list which could show stale users.
    const accountsList = getAllAccounts();
    setAccounts(accountsList);
    setFilteredAccounts(accountsList);

    // 5. CR/SR Applications — load the local mirror as a first paint.
    // No filtering against the local account list here: the server is the
    // authoritative source, and applicants may not be in this browser's
    // localStorage accounts (they logged in on another device).
    const storedApplications = localStorage.getItem('aust-role-applications-v1');
    if (storedApplications) {
      let allApps = [];
      try {
        const parsed = JSON.parse(storedApplications);
        if (Array.isArray(parsed)) allApps = parsed;
      } catch { /* corrupt localStorage — treat as empty */ }
      setApplications(allApps);
    }

    // 6. Routine Templates
    const loadedTemplates = loadTemplates();
    setTemplates(loadedTemplates);
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

  // Filter accounts when search or role filter changes
  useEffect(() => {
    let result = [...accounts];
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(acc => 
        acc.name?.toLowerCase().includes(query) ||
        acc.email?.toLowerCase().includes(query) ||
        acc.id?.toLowerCase().includes(query) ||
        acc.department?.toLowerCase().includes(query)
      );
    }
    
    if (roleFilter !== 'all') {
      result = result.filter(acc => acc.role === roleFilter);
    }
    
    setFilteredAccounts(result);
  }, [searchQuery, roleFilter, accounts]);

  // Save Notices
  const saveNotices = (newList) => {
    setNoticesList(newList);
    localStorage.setItem('aust-notices', JSON.stringify(newList));
  };

  // Add Notice
  const handleAddNotice = (e) => {
    e.preventDefault();
    if (!noticeForm.title.trim() || !noticeForm.content.trim()) return;

    const newNotice = {
      id: Date.now(),
      title: noticeForm.title.trim(),
      category: noticeForm.category,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      pinned: noticeForm.pinned,
      content: noticeForm.content.trim()
    };

    const updated = noticeForm.pinned 
      ? [newNotice, ...noticesList] 
      : [...noticesList, newNotice];

    saveNotices(updated);
    setNoticeForm({ title: '', category: 'Admin', pinned: false, content: '' });
  };

  // Delete Notice
  const handleDeleteNotice = (id) => {
    const updated = noticesList.filter(n => n.id !== id);
    saveNotices(updated);
  };

  // Update Canteen
  const handleUpdateCanteen = (field, value) => {
    const updated = { ...canteenInfo, [field]: value };
    setCanteenInfo(updated);
    localStorage.setItem('aust-canteen-data', JSON.stringify(updated));
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
    localStorage.setItem('aust-canteen-data', JSON.stringify(updated));
    setFoodForm({ name: '', category: 'Meals', price: '', popular: false, available: true });
  };

  // Delete a food item
  const handleDeleteFood = (id) => {
    const updated = { ...canteenInfo, menu: (canteenInfo.menu || []).filter(item => item.id !== id) };
    setCanteenInfo(updated);
    localStorage.setItem('aust-canteen-data', JSON.stringify(updated));
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
    localStorage.setItem('aust-canteen-data', JSON.stringify(updated));
  };

  // Update Library Occupied
  const handleUpdateLibraryOccupied = (value) => {
    const occupiedVal = Math.min(Math.max(0, Number(value)), libraryInfo.totalSeats);
    const updated = { ...libraryInfo, occupied: occupiedVal };
    setLibraryInfo(updated);
    localStorage.setItem('aust-library-data', JSON.stringify(updated));
  };

  // Delete Account
  const handleDeleteAccount = (id) => {
    const target = accounts.find(acc => acc.id === id);
    if (target && target.role === 'admin') {
      alert('Cannot delete an admin account.');
      return;
    }
    if (window.confirm('Are you sure you want to delete this account?')) {
      const updated = accounts.filter(acc => acc.id !== id);
      setAccounts(updated);
      setFilteredAccounts(updated);
      localStorage.setItem('aust-auth-accounts-v1', JSON.stringify(updated));
    }
  };

  // View User Profile
  const handleViewUser = (userId) => {
    const account = getAccountById(userId);
    if (account) {
      setSelectedUser(account);
    }
  };

  // Start Editing User
  const handleStartEditUser = (userId) => {
    const account = getAccountById(userId);
    if (account) {
      setEditingUser(userId);
      setEditFormData({
        name: account.name || '',
        email: account.email || '',
        role: account.role || 'student',
        department: account.department || '',
        batch: account.batch || '',
        batchNo: account.batchNo || '',
        designation: account.designation || '',
        company: account.company || '',
        graduationYear: account.graduationYear || '',
        section: account.section || '',
        semester: account.semester || 1,
        cgpa: account.cgpa || 0,
      });
    }
  };

  // Save Edited User
  const handleSaveEditUser = (userId) => {
    const target = accounts.find(acc => acc.id === userId);
    if (target && target.role === 'admin' && editFormData.role !== 'admin') {
      alert('Cannot change the role of an admin account.');
      return;
    }

    const updated = updateAccountProfile(userId, editFormData);
    if (updated) {
      const newAccounts = accounts.map(acc => 
        acc.id === userId ? { ...acc, ...editFormData } : acc
      );
      setAccounts(newAccounts);
      setFilteredAccounts(newAccounts);
      localStorage.setItem('aust-auth-accounts-v1', JSON.stringify(newAccounts));
      setEditingUser(null);
      setEditFormData({});
    }
  };

  // Cancel Editing
  const handleCancelEdit = () => {
    setEditingUser(null);
    setEditFormData({});
  };

  // Get role stats
  const getRoleStats = () => {
    const stats = { student: 0, faculty: 0, alumni: 0, admin: 0, cr: 0, sr: 0, vp: 0, gs: 0 };
    accounts.forEach(acc => {
      if (stats[acc.role] !== undefined) {
        stats[acc.role]++;
      }
    });
    return stats;
  };

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


  // Helper stats
  const stats = {
    totalUsers: accounts.length,
    activeNotices: noticesList.length,
    canteenIsOpen: canteenInfo.status === 'open',
    libraryOccupancy: libraryInfo.totalSeats > 0 ? Math.round((libraryInfo.occupied / libraryInfo.totalSeats) * 100) : 0
  };

  return (
    <div className="admin-panel-container stagger-children animate-fadeIn">
      {/* Header */}
      <div className="admin-header flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="icon" style={{ backgroundColor: 'var(--accent-rose-glow)', color: 'var(--accent-rose)', padding: '8px', borderRadius: '12px' }}>
            <Shield size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-bold)', margin: 0 }}>Admin Panel</h1>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>Manage announcements, live metrics, and campus assets</p>
          </div>
        </div>
      </div>

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
      <div className="grid-4 mb-6">
        <div className="glass-card stat-card" onClick={() => navigateToTab('accounts')} style={{ cursor: 'pointer' }}>
          <div className="flex justify-between items-center">
            <span className="stat-label">System Accounts</span>
            <Users size={18} style={{ color: 'var(--accent-blue)' }} />
          </div>
          <span className="stat-value">{stats.totalUsers}</span>
          <span className="stat-change positive">Registered users</span>
        </div>

        <div className="glass-card stat-card" onClick={() => navigateToTab('notices')} style={{ cursor: 'pointer' }}>
          <div className="flex justify-between items-center">
            <span className="stat-label">Active Notices</span>
            <BellRing size={18} style={{ color: 'var(--accent-amber)' }} />
          </div>
          <span className="stat-value">{stats.activeNotices}</span>
          <span className="stat-change" style={{ color: 'var(--text-tertiary)' }}>Announcements live</span>
        </div>

        <div className="glass-card stat-card" onClick={() => navigateToTab('canteen')} style={{ cursor: 'pointer' }}>
          <div className="flex justify-between items-center">
            <span className="stat-label">Canteen Status</span>
            <Coffee size={18} style={{ color: 'var(--accent-emerald)' }} />
          </div>
          <span className="stat-value" style={{ color: stats.canteenIsOpen ? 'var(--accent-emerald)' : 'var(--accent-rose)', fontSize: '20px', marginTop: '10px' }}>
            {stats.canteenIsOpen ? 'OPEN' : 'CLOSED'}
          </span>
          <span className="stat-change" style={{ color: 'var(--text-tertiary)' }}>
            {canteenInfo.crowdLevel}% crowd index
          </span>
        </div>

        <div className="glass-card stat-card" onClick={() => navigateToTab('library')} style={{ cursor: 'pointer' }}>
          <div className="flex justify-between items-center">
            <span className="stat-label">Library Occupancy</span>
            <Activity size={18} style={{ color: 'var(--accent-purple)' }} />
          </div>
          <span className="stat-value">{stats.libraryOccupancy}%</span>
          <span className="stat-change" style={{ color: 'var(--text-tertiary)' }}>
            {libraryInfo.occupied} / {libraryInfo.totalSeats} seats
          </span>
        </div>
      </div>


      {/* Tab Panels */}
      <div className="tab-panels animate-fadeIn">
        {/* OVERVIEW PANEL */}
        {activeTab === 'overview' && (
          <div className="grid-2">
            {/* Quick Campus Controls */}
            <div className="glass-card-static">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--fs-md)', fontWeight: 'bold', marginBottom: '16px' }}>
                <Coffee size={16} style={{ color: 'var(--accent-amber)' }} /> Quick Canteen Control
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="input-label" style={{ display: 'block', marginBottom: '6px' }}>Canteen Portal Status</label>
                  <div className="flex gap-2">
                    <button 
                      className={`btn btn-sm flex-1 ${canteenInfo.status === 'open' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => handleUpdateCanteen('status', 'open')}
                    >
                      Set Open
                    </button>
                    <button 
                      className={`btn btn-sm flex-1 ${canteenInfo.status === 'closed' ? 'btn-rose' : 'btn-secondary'}`}
                      onClick={() => handleUpdateCanteen('status', 'closed')}
                    >
                      Set Closed
                    </button>
                  </div>
                </div>

                {canteenInfo.status === 'open' && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="input-label">Live Crowd Level ({canteenInfo.crowdLevel}%)</label>
                      <span className="badge badge-blue" style={{ fontSize: '9px' }}>
                        {canteenInfo.crowdLevel >= 75 ? 'Busy' : canteenInfo.crowdLevel >= 40 ? 'Moderate' : 'Quiet'}
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

            {/* Quick Library Controls */}
            <div className="glass-card-static">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--fs-md)', fontWeight: 'bold', marginBottom: '16px' }}>
                <Activity size={16} style={{ color: 'var(--accent-purple)' }} /> Quick Library Control
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="input-label" style={{ display: 'block', marginBottom: '4px' }}>Total Seats Occupied</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="number" 
                      min="0" 
                      max={libraryInfo.totalSeats}
                      value={libraryInfo.occupied} 
                      onChange={(e) => handleUpdateLibraryOccupied(e.target.value)}
                      className="input"
                    />
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}> / {libraryInfo.totalSeats} seats</span>
                  </div>
                </div>

              </div>
            </div>

            {/* Factory Reset */}
            <div className="glass-card-static" style={{ border: '1px solid var(--accent-rose)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--fs-md)', fontWeight: 'bold', marginBottom: '16px', color: 'var(--accent-rose)' }}>
                <Trash2 size={16} /> Factory Reset
              </h3>
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                Permanently delete ALL data including users, messages, marketplace listings, notices, canteen data, and library records. Only the default admin account will be restored.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input
                  type="text"
                  placeholder='Type DELETE_ALL_DATA to confirm'
                  value={resetConfirm}
                  onChange={(e) => setResetConfirm(e.target.value)}
                  className="input"
                  style={{ fontSize: 'var(--fs-xs)' }}
                />
                <button
                  className="btn btn-rose"
                  onClick={handleFactoryReset}
                  disabled={resetConfirm !== 'DELETE_ALL_DATA'}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <Trash2 size={16} /> Reset Everything
                </button>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'notices' && (
          <div className="grid-2" style={{ gridTemplateColumns: '1.1fr 0.9fr' }}>
            {/* Publisher Form */}
            <div className="glass-card-static">
              <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', marginBottom: '16px' }}>Publish Announcement</h3>
              <form onSubmit={handleAddNotice} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label className="input-label">Announcement Title</label>
                  <input 
                    type="text" 
                    placeholder="Enter short notice title..."
                    value={noticeForm.title}
                    onChange={(e) => setNoticeForm({ ...noticeForm, title: e.target.value })}
                    className="input"
                    required
                  />
                </div>

                <div className="grid-2" style={{ gap: '10px' }}>
                  <div>
                    <label className="input-label">Category</label>
                    <select 
                      value={noticeForm.category}
                      onChange={(e) => setNoticeForm({ ...noticeForm, category: e.target.value })}
                      className="input"
                      style={{ padding: '8px 12px' }}
                    >
                      <option value="Admin">Admin</option>
                      <option value="Exam">Exam</option>
                      <option value="Library">Library</option>
                      <option value="Event">Event</option>
                      <option value="IT">IT</option>
                    </select>
                  </div>

                  <div className="flex items-center" style={{ paddingTop: '20px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: 'var(--fs-xs)' }}>
                      <input 
                        type="checkbox" 
                        checked={noticeForm.pinned}
                        onChange={(e) => setNoticeForm({ ...noticeForm, pinned: e.target.checked })}
                      />
                      Pin notice at the top
                    </label>
                  </div>
                </div>

                <div>
                  <label className="input-label">Notice Details</label>
                  <textarea 
                    placeholder="Provide full description of the announcement..."
                    value={noticeForm.content}
                    onChange={(e) => setNoticeForm({ ...noticeForm, content: e.target.value })}
                    className="input"
                    style={{ minHeight: '100px', resize: 'vertical' }}
                    required
                  />
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', display: 'flex', gap: '6px', justifyContent: 'center' }}>
                  <Plus size={16} /> Publish Notice
                </button>
              </form>
            </div>

            {/* List & Delete notices */}
            <div className="glass-card-static" style={{ display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', marginBottom: '16px' }}>Manage Announcements</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flex: 1, maxHeight: '350px' }}>
                {noticesList.length === 0 ? (
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)', textAlign: 'center', padding: '32px 0' }}>
                    No notices currently active.
                  </div>
                ) : noticesList.map(notice => (
                  <div 
                    key={notice.id} 
                    className="p-3 flex justify-between items-start gap-4" 
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)' }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {notice.pinned && <span className="badge badge-amber" style={{ fontSize: '7px', padding: '1px 3px' }}>PINNED</span>}
                        <span className="badge badge-blue" style={{ fontSize: '7px', padding: '1px 3px' }}>{notice.category}</span>
                        <span style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>{notice.date}</span>
                      </div>
                      <h4 style={{ fontSize: '13px', fontWeight: 'bold', margin: '4px 0 2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{notice.title}</h4>
                      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: '1.3' }}>{notice.content}</p>
                    </div>
                    <button 
                      className="btn btn-secondary btn-icon"
                      onClick={() => handleDeleteNotice(notice.id)}
                      style={{ color: 'var(--accent-rose)', border: 'none', background: 'transparent', padding: '4px', width: '28px', height: '28px' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

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
                      localStorage.setItem('aust-library-data', JSON.stringify(updated));
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

        {/* User Profile Modal */}
        {selectedUser && createPortal(
          <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
            <div className="modal-content glass-card-static" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', position: 'relative' }}>
              <button 
                className="btn btn-icon" 
                onClick={() => setSelectedUser(null)}
                style={{ position: 'absolute', top: '12px', right: '12px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-tertiary)' }}
              >
                <X size={20} />
              </button>
              
              <div className="flex flex-col items-center mb-6">
                <div className="avatar" style={{ width: 80, height: 80, fontSize: '24px', marginBottom: '16px' }}>
                  {selectedUser.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'bold', margin: 0 }}>{selectedUser.name}</h2>
                <span className={`badge ${getRoleBadgeClass(selectedUser.role)}`} style={{ marginTop: '8px', padding: '4px 12px' }}>
                  {getRoleLabel(selectedUser.role)}
                </span>
              </div>

              <div className="user-profile-details" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="profile-field">
                  <label className="input-label">User ID</label>
                  <p style={{ margin: 0, fontWeight: 'bold' }}>{selectedUser.id}</p>
                </div>
                <div className="profile-field">
                  <label className="input-label">Email</label>
                  <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{selectedUser.email}</p>
                </div>
                <div className="profile-field">
                  <label className="input-label">Department</label>
                  <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{selectedUser.department || 'Not specified'}</p>
                </div>
                {(selectedUser.batch || selectedUser.batchNo) && (
                  <div className="profile-field">
                    <label className="input-label">Batch</label>
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{selectedUser.batch || `Batch ${selectedUser.batchNo}`}</p>
                  </div>
                )}
                {selectedUser.designation && (
                  <div className="profile-field">
                    <label className="input-label">Designation</label>
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{selectedUser.designation}</p>
                  </div>
                )}
                {selectedUser.company && (
                  <div className="profile-field">
                    <label className="input-label">Company</label>
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{selectedUser.company}</p>
                  </div>
                )}
                {selectedUser.graduationYear && (
                  <div className="profile-field">
                    <label className="input-label">Graduation Year</label>
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{selectedUser.graduationYear}</p>
                  </div>
                )}
                {selectedUser.section && (
                  <div className="profile-field">
                    <label className="input-label">Section</label>
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{selectedUser.section}</p>
                  </div>
                )}
                {selectedUser.semester && (
                  <div className="profile-field">
                    <label className="input-label">Semester</label>
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{selectedUser.semester}</p>
                  </div>
                )}
                {selectedUser.cgpa !== undefined && selectedUser.cgpa > 0 && (
                  <div className="profile-field">
                    <label className="input-label">CGPA</label>
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{selectedUser.cgpa}</p>
                  </div>
                )}
                {selectedUser.createdAt && (
                  <div className="profile-field">
                    <label className="input-label">Account Created</label>
                    <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)' }}>{new Date(selectedUser.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                )}
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
                      <option value="student">Student</option>
                      <option value="cr">Class Representative (CR)</option>
                      <option value="sr">Student Representative (SR)</option>
                      <option value="vp">Vice President (VP)</option>
                      <option value="gs">General Secretary (GS)</option>
                      <option value="faculty">Faculty</option>
                      <option value="alumni">Alumni</option>
                      {!(editingUser && accounts.find(a => a.id === editingUser)?.role === 'admin') && <option value="admin">Admin</option>}
                    </select>
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

                {(editFormData.role === 'student' || editFormData.role === 'cr' || editFormData.role === 'sr' || editFormData.role === 'vp' || editFormData.role === 'gs' || editFormData.role === 'alumni') && (
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
                        onChange={(e) => setEditFormData({ ...editFormData, batch: e.target.value })}
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
            {/* Stats Cards */}
            <div className="grid-6 mb-4" style={{ gap: '12px' }}>
              {Object.entries(getRoleStats()).map(([role, count]) => (
                <div key={role} className="glass-card stat-card" style={{ cursor: roleFilter === role ? 'default' : 'pointer', border: roleFilter === role ? '2px solid var(--accent-blue)' : 'none' }} onClick={() => setRoleFilter(roleFilter === role ? 'all' : role)}>
                  <div className="flex justify-between items-center">
                    <span className="stat-label" style={{ fontSize: '10px' }}>{getRoleLabel(role).split(' ')[0]}</span>
                  </div>
                  <span className="stat-value" style={{ fontSize: '24px' }}>{count}</span>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div className="glass-card-static mb-4">
              <div className="flex gap-3 items-center flex-wrap">
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div className="flex items-center gap-2" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', padding: '0 12px' }}>
                    <Search size={16} style={{ color: 'var(--text-tertiary)' }} />
                    <input 
                      type="text" 
                      placeholder="Search by name, email, ID, department..."
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
                    <option value="student">Student</option>
                    <option value="cr">Class Representative (CR)</option>
                    <option value="sr">Student Representative (SR)</option>
                    <option value="vp">Vice President (VP)</option>
                    <option value="gs">General Secretary (GS)</option>
                    <option value="faculty">Faculty</option>
                    <option value="alumni">Alumni</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="badge badge-blue" style={{ padding: '8px 12px', fontSize: '12px' }}>
                  {filteredAccounts.length} of {accounts.length} users
                </div>
              </div>
            </div>

            {/* Users Table */}
            <div className="glass-card-static">
              <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', marginBottom: '16px' }}>User Directory</h3>
              
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-primary)', textAlign: 'left' }}>
                      <th style={{ padding: '10px', color: 'var(--text-tertiary)' }}>User ID</th>
                      <th style={{ padding: '10px', color: 'var(--text-tertiary)' }}>Name</th>
                      <th style={{ padding: '10px', color: 'var(--text-tertiary)' }}>Email</th>
                      <th style={{ padding: '10px', color: 'var(--text-tertiary)' }}>Role</th>
                      <th style={{ padding: '10px', color: 'var(--text-tertiary)' }}>Department</th>
                      <th style={{ padding: '10px', color: 'var(--text-tertiary)' }}>Batch</th>
                      <th style={{ padding: '10px', color: 'var(--text-tertiary)', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAccounts.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                          No users found matching your criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredAccounts.map(acc => (
                        <tr key={acc.id} style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                          <td style={{ padding: '12px 10px', fontWeight: 'bold', fontSize: 'var(--fs-xs)' }}>{acc.id}</td>
                          <td style={{ padding: '12px 10px' }}>
                            <div className="flex items-center gap-2">
                              <div className="avatar" style={{ width: 28, height: 28, fontSize: '10px', flexShrink: 0 }}>
                                {acc.name?.charAt(0)?.toUpperCase() || 'U'}
                              </div>
                              <span>{acc.name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px 10px', color: 'var(--text-secondary)', fontSize: 'var(--fs-xs)' }}>{acc.email}</td>
                          <td style={{ padding: '12px 10px' }}>
                            <span className={`badge ${getRoleBadgeClass(acc.role)}`} style={{ fontSize: '7px', padding: '2px 6px' }}>
                              {getRoleLabel(acc.role)}
                            </span>
                          </td>
                          <td style={{ padding: '12px 10px', color: 'var(--text-secondary)', fontSize: 'var(--fs-xs)' }}>
                            {acc.department || '-'}
                          </td>
                          <td style={{ padding: '12px 10px', color: 'var(--text-secondary)', fontSize: 'var(--fs-xs)' }}>
                            {acc.batch || acc.batchNo || '-'}
                          </td>
                          <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                            <div className="flex justify-center gap-1">
                              <button 
                                className="btn btn-secondary btn-icon"
                                onClick={() => handleViewUser(acc.id)}
                                title="View Profile"
                                style={{ 
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  color: 'var(--accent-blue)',
                                  padding: '4px',
                                  width: '28px',
                                  height: '28px'
                                }}
                              >
                                <Eye size={14} />
                              </button>
                              <button 
                                className="btn btn-secondary btn-icon"
                                onClick={() => handleStartEditUser(acc.id)}
                                title="Edit User"
                                style={{ 
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  color: 'var(--accent-amber)',
                                  padding: '4px',
                                  width: '28px',
                                  height: '28px'
                                }}
                              >
                                <Edit3 size={14} />
                              </button>
                              <button 
                                className="btn btn-secondary btn-icon"
                                disabled={acc.role === 'admin'}
                                onClick={() => handleDeleteAccount(acc.id)}
                                title="Delete User"
                                style={{ 
                                  color: acc.role === 'admin' ? 'var(--text-tertiary)' : 'var(--accent-rose)', 
                                  opacity: acc.role === 'admin' ? 0.4 : 1,
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: acc.role === 'admin' ? 'not-allowed' : 'pointer',
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

        {/* TRANSCRIPT TEMPLATES PANEL */}
        {activeTab === 'transcript-templates' && (
          <TranscriptTemplatesPanel />
        )}

        {/* APPLICATIONS PANEL */}
        {activeTab === 'applications' && (
          <div>
            <div className="glass-card-static mb-4">
              <div className="flex gap-3 items-center flex-wrap">
                <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', margin: 0 }}>CR/SR Applications</h3>
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
                                <span className={`badge ${app.appliedRole === 'cr' ? 'badge-amber' : 'badge-emerald'}`} style={{ fontSize: '9px', padding: '1px 4px' }}>
                                  {app.appliedRole === 'cr' ? 'CR' : 'SR'}
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
                const crAccounts = accounts.filter(acc => acc.role === 'cr');
                if (crAccounts.length === 0) {
                  return <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', padding: '20px', textAlign: 'center' }}>No Class Representatives found.</p>;
                }
                // Group by department, then by batch
                const groupedByDept = {};
                crAccounts.forEach(acc => {
                  const dept = acc.department || 'Undeclared';
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
                const srAccounts = accounts.filter(acc => acc.role === 'sr');
                if (srAccounts.length === 0) {
                  return <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', padding: '20px', textAlign: 'center' }}>No Student Representatives found.</p>;
                }
                // Group by department, then by batch
                const groupedByDept = {};
                srAccounts.forEach(acc => {
                  const dept = acc.department || 'Undeclared';
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
                <span className={`badge ${selectedApplication.appliedRole === 'cr' ? 'badge-amber' : 'badge-emerald'}`}>
                  {selectedApplication.appliedRole === 'cr' ? 'CR' : 'SR'} Application
                </span>
              </div>

              {/* Details */}
              <div className="grid-2 app-review-details">
                <div className="app-review-cell">
                  <span>Department</span>
                  <strong>{selectedApplication.userDepartment || '—'}</strong>
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
              {(selectedApplication.targetLabSection || selectedApplication.targetSection) && (
                <div className={`app-review-target ${selectedApplication.appliedRole === 'sr' ? 'is-sr' : ''}`}>
                  <div>
                    <span>Applying for</span>
                    <strong>
                      {selectedApplication.appliedRole === 'cr' ? 'Class Representative (CR)' : 'Student Representative (SR)'}
                    </strong>
                  </div>
                  <span className="app-review-target-slot">
                    {selectedApplication.appliedRole === 'cr'
                      ? `Lab ${selectedApplication.targetLabSection}`
                      : `Section ${selectedApplication.targetSection}`}
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
                  <button
                    className="btn btn-primary"
                    onClick={async () => {
                      if (window.confirm(`Approve ${selectedApplication.userName}'s application for ${selectedApplication.appliedRole === 'cr' ? 'CR' : 'SR'}?`)) {
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
                          fetch('/api/admin/users/role', {
                            method: 'POST',
                            credentials: 'same-origin',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId: selectedApplication.userId, role: selectedApplication.appliedRole }),
                          }).catch(() => { /* server may not know this local account */ });
                          // Confirmation mail → lands in the applicant's ConnectBox inbox.
                          sendMessage(reviewerId, selectedApplication.userId,
                            `🎉 Congratulations ${selectedApplication.userName}! Your application for ${selectedApplication.appliedRole === 'cr' ? 'Class Representative (CR)' : 'Student Representative (SR)'} has been APPROVED by the admin. You can now use all ${selectedApplication.appliedRole === 'cr' ? 'CR' : 'SR'} powers (notices, schedules, exam tracker).`
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
                  <button
                    className="btn btn-secondary"
                    onClick={async () => {
                      if (window.confirm(`Reject ${selectedApplication.userName}'s application?`)) {
                        const reviewerId = getCurrentUserId() || 'ADM-MSOP6VG6BVL4';
                        try {
                          const reviewed = await reviewRoleApplication(selectedApplication.id, 'rejected', reviewerId);
                          // Notification mail → lands in the applicant's ConnectBox inbox.
                          sendMessage(reviewerId, selectedApplication.userId,
                            `Your application for ${selectedApplication.appliedRole === 'cr' ? 'Class Representative (CR)' : 'Student Representative (SR)'} was REJECTED by the admin. You can re-apply when a slot opens up.`
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

        {/* CAMPUS MAP ADMIN PANEL */}
        {activeTab === 'campus-map' && <AdminCampusMapPanel />}
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
