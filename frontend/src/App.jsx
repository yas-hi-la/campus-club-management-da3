import { useState, useEffect, useMemo, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import './App.css';
import {
  GraduationCap, Users, Calendar, Landmark, Search, Trash2,
  Sparkles, Laptop, MessageCircle, Palette, Leaf, Flag, MapPin, Network,
  Plus, X, CheckCircle2, AlertCircle, AlertTriangle, UserPlus, Ticket,
  Coins, Menu, ChevronRight, Building2, Trophy
} from 'lucide-react';

const API_BASE = 'http://localhost:5050/api';

const CATEGORY_STYLES = {
  Technical: { bg: '#eef2ff', accent: '#4f46e5', icon: <Laptop size={18} color="#ffffff" /> },
  'Non-Technical': { bg: '#fff7ed', accent: '#ea580c', icon: <MessageCircle size={18} color="#ffffff" /> },
  Cultural: { bg: '#fdf2f8', accent: '#db2777', icon: <Palette size={18} color="#ffffff" /> },
  Academic: { bg: '#eff6ff', accent: '#2563eb', icon: <GraduationCap size={18} color="#ffffff" /> },
  Sports: { bg: '#f0fdf4', accent: '#16a34a', icon: <Trophy size={18} color="#ffffff" /> },
  Hackathon: { bg: '#f5f3ff', accent: '#7c3aed', icon: <Laptop size={18} color="#ffffff" /> },
  Workshop: { bg: '#e0f2fe', accent: '#0284c7', icon: <Sparkles size={18} color="#ffffff" /> },
  Seminar: { bg: '#fef3c7', accent: '#d97706', icon: <Landmark size={18} color="#ffffff" /> },
  Default: { bg: '#f8fafc', accent: '#0f4c3a', icon: <Leaf size={18} color="#ffffff" /> },
};

function getCategoryStyle(category) {
  return CATEGORY_STYLES[category] || CATEGORY_STYLES.Default;
}

// ===== CONFIRMATION MODAL =====
function ConfirmModal({ isOpen, title = 'Confirm Action', message, confirmText = 'Delete', onConfirm, onCancel }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onCancel} role="dialog" aria-modal="true">
      <div className="modal-card confirm-card" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-icon-wrap">
          <AlertTriangle size={26} />
        </div>
        <h3 className="confirm-title">{title}</h3>
        <p className="confirm-message">{message}</p>
        <div className="modal-actions" style={{ justifyContent: 'center' }}>
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}

// ===== TOAST NOTIFICATIONS =====
function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.type === 'success' && <CheckCircle2 size={18} color="var(--success)" style={{ flexShrink: 0 }} />}
          {t.type === 'error' && <AlertCircle size={18} color="var(--danger)" style={{ flexShrink: 0 }} />}
          {t.type === 'info' && <AlertCircle size={18} color="var(--accent)" style={{ flexShrink: 0 }} />}
          <div className="toast-content">
            <div className="toast-title">{t.title}</div>
            <div className="toast-msg">{t.message}</div>
          </div>
          <button className="btn-icon-only" onClick={() => onDismiss(t.id)} title="Dismiss">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

// Helper: case-insensitive text highlighter for search matches
function highlightMatch(text, query) {
  if (!text) return '';
  if (!query || !query.trim()) return text;
  const trimmed = query.trim();
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = String(text).split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === trimmed.toLowerCase() ? (
      <mark key={i} className="combobox-highlight">{part}</mark>
    ) : (
      part
    )
  );
}

// ===== REUSABLE SEARCHABLE STUDENT COMBOBOX =====
function StudentCombobox({
  students = [],
  selectedStudent = null,
  onSelectStudent,
  onClearSelection,
  loading = false,
  error = null,
  onRetry,
  onSwitchToNewTab,
  validationError = null,
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Filter students dynamically across name, id, email, and department
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students.slice(0, 8); // Show first 8 students initially when opened
    return students.filter((s) => {
      const fullName = `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase();
      const idStr = String(s.student_id || '');
      const emailStr = (s.email || '').toLowerCase();
      const deptStr = (s.department || '').toLowerCase();
      return (
        fullName.includes(q) ||
        idStr.includes(q) ||
        emailStr.includes(q) ||
        deptStr.includes(q)
      );
    });
  }, [students, query]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.children[highlightedIndex];
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  function handleSelect(student) {
    onSelectStudent(student);
    setIsOpen(false);
    setQuery('');
    setHighlightedIndex(-1);
  }

  function handleKeyDown(e) {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex(0);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (filtered.length === 0 ? -1 : (prev + 1) % filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (filtered.length === 0 ? -1 : (prev - 1 + filtered.length) % filtered.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
        handleSelect(filtered[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setHighlightedIndex(-1);
    } else if (e.key === 'Tab') {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  }

  // If a student is already selected, display the prominent selected student card (Requirement 3)
  if (selectedStudent) {
    return (
      <div className="form-group">
        <label className="form-label">
          Selected Student <span className="required">*</span>
        </label>
        <div className="selected-student-card">
          <div className="selected-student-left">
            <div className="selected-student-avatar">
              {selectedStudent.first_name?.[0]}{selectedStudent.last_name?.[0]}
            </div>
            <div className="selected-student-details">
              <div className="selected-student-name-row">
                <span className="selected-student-name">
                  {selectedStudent.first_name} {selectedStudent.last_name}
                </span>
                <span className="selected-student-id-badge">ID: {selectedStudent.student_id}</span>
              </div>
              <div className="selected-student-email">{selectedStudent.email}</div>
              <div className="selected-student-dept">
                {selectedStudent.department || 'General'} · {selectedStudent.academic_year || 'Student'}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="selected-student-change-btn"
            onClick={() => {
              onClearSelection();
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
            title="Change this student selection"
          >
            <X size={14} /> Change
          </button>
        </div>
        <div className="selected-student-status-hint">
          <CheckCircle2 size={13} />
          <span>Student verified from campus directory & ready for registration</span>
        </div>
      </div>
    );
  }

  return (
    <div className="form-group" ref={wrapperRef}>
      <label className="form-label" htmlFor="student-combobox-input">
        Search & Select Student <span className="required">*</span>
      </label>

      <div className="combobox-wrapper">
        <div className="combobox-input-box">
          <span className="combobox-search-icon">
            <Search size={17} />
          </span>

          <input
            id="student-combobox-input"
            ref={inputRef}
            type="text"
            className="combobox-input"
            placeholder="Search by student name, ID, or email..."
            value={query}
            autoComplete="off"
            role="combobox"
            aria-expanded={isOpen}
            aria-autocomplete="list"
            aria-controls="student-combobox-dropdown"
            aria-activedescendant={
              highlightedIndex >= 0 && filtered[highlightedIndex]
                ? `student-option-${filtered[highlightedIndex].student_id}`
                : undefined
            }
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
              setHighlightedIndex(0);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
          />

          {query && (
            <button
              type="button"
              className="combobox-clear-btn"
              onClick={() => {
                setQuery('');
                setHighlightedIndex(-1);
                inputRef.current?.focus();
              }}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="combobox-dropdown" id="student-combobox-dropdown" role="listbox">
            {loading ? (
              <div className="combobox-state-box">
                <p className="loading-text" style={{ padding: '0.5rem 0' }}>Loading students from database...</p>
              </div>
            ) : error ? (
              <div className="combobox-state-box">
                <AlertCircle size={22} className="combobox-state-icon" style={{ color: 'var(--danger)' }} />
                <div className="combobox-state-title">Failed to load directory</div>
                <div className="combobox-state-desc">{error}</div>
                {onRetry && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
                    Retry
                  </button>
                )}
              </div>
            ) : filtered.length === 0 ? (
              <div className="combobox-state-box">
                <Search size={22} className="combobox-state-icon" />
                <div className="combobox-state-title">No students found</div>
                <div className="combobox-state-desc">
                  No match found for "{query}". Try checking the spelling, ID, or email.
                </div>
                {onSwitchToNewTab && (
                  <button
                    type="button"
                    className="combobox-switch-tab-btn"
                    onClick={() => {
                      setIsOpen(false);
                      onSwitchToNewTab();
                    }}
                  >
                    + Register as New Student instead
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="combobox-dropdown-header">
                  <span>
                    {query.trim()
                      ? `${filtered.length} matching student${filtered.length === 1 ? '' : 's'}`
                      : 'Campus Student Directory (Type to filter)'}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Use ↑↓ arrows & Enter</span>
                </div>

                <ul className="combobox-list" ref={listRef}>
                  {filtered.map((s, idx) => {
                    const isHighlighted = idx === highlightedIndex;
                    const isChosen = selectedStudent && selectedStudent.student_id === s.student_id;

                    return (
                      <li
                        key={s.student_id}
                        id={`student-option-${s.student_id}`}
                        role="option"
                        aria-selected={isChosen}
                        className={`combobox-option ${isHighlighted ? 'highlighted' : ''} ${isChosen ? 'selected' : ''}`}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        onClick={() => handleSelect(s)}
                      >
                        <div className="combobox-option-main">
                          <div className="combobox-avatar">
                            {s.first_name?.[0]}{s.last_name?.[0]}
                          </div>
                          <div className="combobox-info">
                            <div className="combobox-row-top">
                              <span className="combobox-student-name">
                                {highlightMatch(`${s.first_name || ''} ${s.last_name || ''}`, query)}
                              </span>
                              <span className="combobox-id-pill">
                                ID: {highlightMatch(String(s.student_id), query)}
                              </span>
                            </div>
                            <div className="combobox-student-email">
                              {highlightMatch(s.email, query)}
                            </div>
                            <div className="combobox-student-dept">
                              {highlightMatch(s.department || 'General', query)} · {s.academic_year || 'Student'}
                            </div>
                          </div>
                        </div>

                        {isChosen && (
                          <div className="combobox-check" title="Currently selected">
                            <CheckCircle2 size={17} />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        )}
      </div>

      {validationError && (
        <div className="form-error-alert" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
          <AlertCircle size={15} style={{ flexShrink: 0 }} />
          <span>{validationError}</span>
        </div>
      )}
    </div>
  );
}

// ===== MAIN APP COMPONENT =====
export default function App() {
  const [tab, setTab] = useState('clubs');
  const [counts, setCounts] = useState({ clubs: 0, students: 0, events: 0 });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  function showToast(type, title, message) {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }

  function dismissToast(id) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  function refreshCounts() {
    fetch(`${API_BASE}/clubs`)
      .then((r) => r.json())
      .then((d) => setCounts((c) => ({ ...c, clubs: Array.isArray(d) ? d.length : 0 })))
      .catch(() => {});
    fetch(`${API_BASE}/students`)
      .then((r) => r.json())
      .then((d) => setCounts((c) => ({ ...c, students: Array.isArray(d) ? d.length : 0 })))
      .catch(() => {});
    fetch(`${API_BASE}/events`)
      .then((r) => r.json())
      .then((d) => setCounts((c) => ({ ...c, events: Array.isArray(d) ? d.length : 0 })))
      .catch(() => {});
  }

  useEffect(() => {
    refreshCounts();
  }, [tab]);

  return (
    <div className="app-shell">
      {/* Mobile Backdrop */}
      {mobileNavOpen && <div className="sidebar-backdrop" onClick={() => setMobileNavOpen(false)} />}

      {/* Sidebar */}
      <aside className={`sidebar ${mobileNavOpen ? 'mobile-open' : ''}`}>
        <div className="brand">
          <div className="brand-logo">
            <GraduationCap size={22} />
          </div>
          <div className="brand-info">
            <span className="brand-name">Campus Connect</span>
            <span className="brand-sub">Club & Event Hub</span>
          </div>
        </div>

        <div className="sidebar-section-label">Management Views</div>
        <nav className="sidebar-nav">
          <button
            className={`sidebar-link ${tab === 'clubs' ? 'active' : ''}`}
            onClick={() => { setTab('clubs'); setMobileNavOpen(false); }}
          >
            <span className="sidebar-link-label"><Landmark size={17} /> Clubs</span>
            <span className="sidebar-count">{String(counts.clubs).padStart(2, '0')}</span>
          </button>

          <button
            className={`sidebar-link ${tab === 'students' ? 'active' : ''}`}
            onClick={() => { setTab('students'); setMobileNavOpen(false); }}
          >
            <span className="sidebar-link-label"><Users size={17} /> Students</span>
            <span className="sidebar-count">{String(counts.students).padStart(2, '0')}</span>
          </button>

          <button
            className={`sidebar-link ${tab === 'events' ? 'active' : ''}`}
            onClick={() => { setTab('events'); setMobileNavOpen(false); }}
          >
            <span className="sidebar-link-label"><Calendar size={17} /> Events</span>
            <span className="sidebar-count">{String(counts.events).padStart(2, '0')}</span>
          </button>

          <button
            className={`sidebar-link ${tab === 'graph' ? 'active' : ''}`}
            onClick={() => { setTab('graph'); setMobileNavOpen(false); }}
          >
            <span className="sidebar-link-label"><Network size={17} /> Graph Network</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="neo4j-status-card">
            <div className="neo4j-status-header">
              <span className="status-dot"></span>
              <span>Neo4j Aura Live</span>
            </div>
            <p>Direct Cypher queries modeling campus entities as connected knowledge graph.</p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu-btn"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              aria-label="Toggle menu"
            >
              <Menu size={20} />
            </button>
            <div className="breadcrumb">
              <span>Campus Management</span>
              <ChevronRight size={14} />
              <strong>{tab === 'graph' ? 'Graph Network' : tab[0].toUpperCase() + tab.slice(1)}</strong>
            </div>
          </div>

          <div className="topbar-right">
            <div className="user-pill">
              <div className="user-avatar">AD</div>
              <span className="user-role-label">Campus Admin</span>
            </div>
          </div>
        </header>

        {tab === 'clubs' && <ClubsView refreshCounts={refreshCounts} showToast={showToast} />}
        {tab === 'students' && <StudentsView refreshCounts={refreshCounts} showToast={showToast} />}
        {tab === 'events' && <EventsView refreshCounts={refreshCounts} showToast={showToast} />}
        {tab === 'graph' && <GraphView />}
      </main>

      {/* Toast Notification Layer */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

// ==========================================
// ===== 1. CLUBS VIEW WITH ADD MEMBER =====
// ==========================================
function ClubsView({ refreshCounts, showToast }) {
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddClubModal, setShowAddClubModal] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [sortBy, setSortBy] = useState('name');

  // Modal states for Add Member & Roster
  const [memberTargetClub, setMemberTargetClub] = useState(null);
  const [rosterTargetClub, setRosterTargetClub] = useState(null);

  function loadClubs() {
    setLoading(true);
    fetch(`${API_BASE}/clubs`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load clubs');
        return res.json();
      })
      .then((data) => {
        setClubs(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        showToast('error', 'Network Error', 'Could not fetch clubs from database');
        setLoading(false);
      });
  }

  useEffect(() => {
    loadClubs();
  }, []);

  function handleClubAdded() {
    setShowAddClubModal(false);
    loadClubs();
    refreshCounts();
    showToast('success', 'Club Created', 'New club successfully added to the campus directory.');
  }

  function handleMemberAdded(clubName) {
    setMemberTargetClub(null);
    loadClubs();
    refreshCounts();
    showToast('success', 'Member Added', `Successfully added new member to ${clubName}!`);
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    const clubId = pendingDelete.club_id;
    const clubName = pendingDelete.club_name;

    fetch(`${API_BASE}/clubs/${clubId}`, { method: 'DELETE' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to delete club');
        return res.json();
      })
      .then(() => {
        setPendingDelete(null);
        loadClubs();
        refreshCounts();
        showToast('info', 'Club Deleted', `"${clubName}" and related relationships were removed.`);
      })
      .catch((err) => {
        showToast('error', 'Delete Failed', err.message);
      });
  }

  const categories = ['All', ...new Set(clubs.map((c) => c.category).filter(Boolean))];

  const totalMemberships = useMemo(() => {
    return clubs.reduce((sum, c) => sum + (c.member_count || 0), 0);
  }, [clubs]);

  const filtered = useMemo(() => {
    return clubs
      .filter((c) => {
        const matchesCat = activeCategory === 'All' || c.category === activeCategory;
        const matchesSearch = (c.club_name || '').toLowerCase().includes(search.toLowerCase());
        return matchesCat && matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return (a.club_name || '').localeCompare(b.club_name || '');
        if (sortBy === 'members') return (b.member_count || 0) - (a.member_count || 0);
        if (sortBy === 'events') return (b.event_count || 0) - (a.event_count || 0);
        return 0;
      });
  }, [clubs, activeCategory, search, sortBy]);

  return (
    <div>
      {/* Banner */}
      <div className="hero-banner">
        <div className="hero-tag">
          <Sparkles size={14} /> Campus Community Directory
        </div>
        <h1 className="hero-title">Campus Clubs & Organizations</h1>
        <p className="hero-subtitle">
          Empowering student leadership, technical innovation, and vibrant campus life through connected organizations.
        </p>
      </div>

      {/* Stats Summary Bar */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
            <Landmark size={22} />
          </div>
          <div>
            <div className="stat-value">{clubs.length}</div>
            <div className="stat-label">Active Campus Clubs</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
            <Users size={22} />
          </div>
          <div>
            <div className="stat-value">{totalMemberships}</div>
            <div className="stat-label">Total Club Memberships</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#fef3c7', color: '#d97706' }}>
            <Sparkles size={22} />
          </div>
          <div>
            <div className="stat-value">{categories.length - 1}</div>
            <div className="stat-label">Distinct Categories</div>
          </div>
        </div>
      </div>

      {/* Section Header */}
      <div className="section-header">
        <div>
          <h2 className="section-title">
            All Clubs <span className="count-pill">{filtered.length} visible</span>
          </h2>
          <p className="section-hint">Manage memberships, view member rosters, and organize club activities.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddClubModal(true)}>
          <Plus size={16} /> Add New Club
        </button>
      </div>

      {/* Filter Row */}
      <div className="filter-row">
        <div className="search-box">
          <Search size={16} color="var(--text-light)" />
          <input
            placeholder="Search clubs by name or keywords..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="btn-icon-only" onClick={() => setSearch('')} title="Clear search">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="category-pills">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`category-pill ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat === 'All' ? 'All Clubs' : cat}
            </button>
          ))}
        </div>

        <select
          className="sort-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          aria-label="Sort clubs"
        >
          <option value="name">Sort by Name (A-Z)</option>
          <option value="members">Sort by Most Members</option>
          <option value="events">Sort by Most Events</option>
        </select>
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="empty-state">
          <p className="loading-text">Loading campus clubs from Neo4j Aura...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Search size={28} /></div>
          <h3 className="empty-state-title">No clubs match your criteria</h3>
          <p className="empty-state-text">Try adjusting your search terms or category filters, or register a new club.</p>
        </div>
      ) : (
        <div className="card-grid">
          {filtered.map((club) => {
            const style = getCategoryStyle(club.category);
            return (
              <div className="club-card" key={club.club_id}>
                <div className="card-banner" style={{ backgroundColor: style.bg }}>
                  <div className="card-banner-meta">
                    <span className="card-badge-pill" style={{ color: style.accent }}>{club.category}</span>
                    <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                      EST. {club.founded_date ? club.founded_date.slice(0, 4) : 'N/A'}
                    </span>
                  </div>
                  <div className="card-banner-icon" style={{ backgroundColor: style.accent }}>
                    {style.icon}
                  </div>
                </div>

                <div className="card-body">
                  <div className="card-title-row">
                    <h3 className="card-title">{club.club_name}</h3>
                    <button
                      className="btn-icon-only"
                      onClick={() => setPendingDelete(club)}
                      title={`Delete ${club.club_name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <div className="card-meta-list">
                    <div className="meta-item">
                      <Flag size={14} color="var(--text-light)" />
                      <span>Founded {club.founded_date || 'Unknown'}</span>
                    </div>
                  </div>

                  <div className="card-stats-row">
                    <span className="card-stat-badge">
                      <Users size={14} color="var(--primary)" />
                      <strong>{club.member_count ?? 0}</strong> Members
                    </span>
                    <span className="card-stat-badge">
                      <Calendar size={14} color="#d97706" />
                      <strong>{club.event_count ?? 0}</strong> Events Hosted
                    </span>
                  </div>

                  <div className="card-actions">
                    <button
                      className="btn btn-primary"
                      onClick={() => setMemberTargetClub(club)}
                    >
                      <UserPlus size={15} /> Add Member
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setRosterTargetClub(club)}
                      title="View active club member roster"
                    >
                      <Users size={14} /> Roster
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Club Modal */}
      {showAddClubModal && (
        <AddClubModal onClose={() => setShowAddClubModal(false)} onAdded={handleClubAdded} />
      )}

      {/* Add Club Member Modal (FEATURE 4) */}
      {memberTargetClub && (
        <AddClubMemberModal
          club={memberTargetClub}
          onClose={() => setMemberTargetClub(null)}
          onSuccess={() => handleMemberAdded(memberTargetClub.club_name)}
        />
      )}

      {/* Club Roster Modal */}
      {rosterTargetClub && (
        <ClubRosterModal
          club={rosterTargetClub}
          onClose={() => setRosterTargetClub(null)}
          onOpenAddMember={() => {
            const currentClub = rosterTargetClub;
            setRosterTargetClub(null);
            setMemberTargetClub(currentClub);
          }}
          onMemberCountChanged={() => {
            loadClubs();
            refreshCounts();
          }}
          showToast={showToast}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(pendingDelete)}
        title="Delete Club"
        message={
          pendingDelete
            ? `Are you sure you want to delete "${pendingDelete.club_name}"? This removes its budget, hosted events, and all student memberships in Neo4j.`
            : ''
        }
        confirmText="Yes, Delete Club"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

// ===== ADD CLUB MODAL =====
function AddClubModal({ onClose, onAdded }) {
  const [form, setForm] = useState({ club_name: '', category: 'Technical', founded_date: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    fetch(`${API_BASE}/clubs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to create club. Please check input values.');
        return res.json();
      })
      .then(() => onAdded())
      .catch((err) => {
        setError(err.message);
        setSubmitting(false);
      });
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Register New Club</h3>
            <p className="modal-subtitle">Add a recognized student organization to the campus network</p>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {error && <div className="form-error-alert"><AlertCircle size={16} /> {error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Club Name <span className="required">*</span></label>
            <input
              className="form-input"
              placeholder="e.g. Artificial Intelligence Club"
              value={form.club_name}
              onChange={(e) => setForm({ ...form, club_name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Category <span className="required">*</span></label>
            <select
              className="form-select"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              required
            >
              <option value="Technical">Technical</option>
              <option value="Non-Technical">Non-Technical</option>
              <option value="Cultural">Cultural</option>
              <option value="Academic">Academic</option>
              <option value="Sports">Sports</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Founded Date <span className="required">*</span></label>
            <input
              type="date"
              className="form-input"
              value={form.founded_date}
              onChange={(e) => setForm({ ...form, founded_date: e.target.value })}
              required
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creating Club...' : 'Save & Register Club'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ===== ADD CLUB MEMBER MODAL (FEATURE 4) =====
function AddClubMemberModal({ club, onClose, onSuccess }) {
  const [tabMode, setTabMode] = useState('existing'); // 'existing' | 'new'
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [roleTitle, setRoleTitle] = useState('Member');
  const [joinDate, setJoinDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Form for new student if needed
  const [newStudent, setNewStudent] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    department: 'CSE',
    academic_year: '1st Year',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function loadDirectory() {
    setLoadingStudents(true);
    setLoadError(null);
    fetch(`${API_BASE}/students`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load students');
        return r.json();
      })
      .then((data) => {
        setStudents(Array.isArray(data) ? data : []);
        setLoadingStudents(false);
      })
      .catch((err) => {
        setLoadError(err.message || 'Network error');
        setLoadingStudents(false);
      });
  }

  useEffect(() => {
    loadDirectory();
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setValidationError(null);

    let payload = {
      role_title: roleTitle,
      join_date: joinDate,
    };

    if (tabMode === 'existing') {
      if (!selectedStudent) {
        setValidationError('Please select an existing student from the directory.');
        setSubmitting(false);
        return;
      }
      payload.student_id = selectedStudent.student_id;
    } else {
      if (!newStudent.first_name.trim() || !newStudent.email.trim()) {
        setError('First Name and Email are required for new student enrollment.');
        setSubmitting(false);
        return;
      }
      payload = {
        ...payload,
        ...newStudent,
      };
    }

    fetch(`${API_BASE}/clubs/${club.club_id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to add club member');
        }
        return data;
      })
      .then(() => {
        onSuccess();
      })
      .catch((err) => {
        setError(err.message);
        setSubmitting(false);
      });
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Add Club Member</h3>
            <p className="modal-subtitle">Enroll student into club roster and assign leadership role</p>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Selected Club Context Summary */}
        <div className="modal-context-box">
          <div className="context-row">
            <Landmark size={15} color="var(--primary)" />
            <span>Target Club: <strong>{club.club_name}</strong></span>
          </div>
          <div className="context-row">
            <Flag size={15} color="var(--text-muted)" />
            <span>Category: {club.category} · Current Members: {club.member_count ?? 0}</span>
          </div>
        </div>

        {error && (
          <div className="form-error-alert">
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Tabs for Selecting Existing vs New Student */}
        <div className="modal-tabs">
          <button
            type="button"
            className={`modal-tab ${tabMode === 'existing' ? 'active' : ''}`}
            onClick={() => {
              setTabMode('existing');
              setValidationError(null);
            }}
          >
            Select Existing Student
          </button>
          <button
            type="button"
            className={`modal-tab ${tabMode === 'new' ? 'active' : ''}`}
            onClick={() => {
              setTabMode('new');
              setValidationError(null);
            }}
          >
            Register New Student
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {tabMode === 'existing' ? (
            <StudentCombobox
              students={students}
              selectedStudent={selectedStudent}
              onSelectStudent={(s) => {
                setSelectedStudent(s);
                setValidationError(null);
                setError(null);
              }}
              onClearSelection={() => {
                setSelectedStudent(null);
              }}
              loading={loadingStudents}
              error={loadError}
              onRetry={loadDirectory}
              onSwitchToNewTab={() => {
                setTabMode('new');
                setValidationError(null);
              }}
              validationError={validationError}
            />
          ) : (
            <div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">First Name <span className="required">*</span></label>
                  <input
                    className="form-input"
                    placeholder="e.g. Sneha"
                    value={newStudent.first_name}
                    onChange={(e) => setNewStudent({ ...newStudent, first_name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input
                    className="form-input"
                    placeholder="e.g. Rao"
                    value={newStudent.last_name}
                    onChange={(e) => setNewStudent({ ...newStudent, last_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">College Email <span className="required">*</span></label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="student@stu.edu"
                  value={newStudent.email}
                  onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <input
                    className="form-input"
                    placeholder="e.g. CSE, EEE"
                    value={newStudent.department}
                    onChange={(e) => setNewStudent({ ...newStudent, department: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Academic Year</label>
                  <select
                    className="form-select"
                    value={newStudent.academic_year}
                    onChange={(e) => setNewStudent({ ...newStudent, academic_year: e.target.value })}
                  >
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Role and Join Date Controls */}
          <div className="form-row" style={{ marginTop: '0.85rem' }}>
            <div className="form-group">
              <label className="form-label">Club Role <span className="required">*</span></label>
              <select
                className="form-select"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                required
              >
                <option value="Member">Member</option>
                <option value="Core Team">Core Team</option>
                <option value="President">President</option>
                <option value="Vice President">Vice President</option>
                <option value="Secretary">Secretary</option>
                <option value="Treasurer">Treasurer</option>
                <option value="Event Coordinator">Event Coordinator</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Join Date <span className="required">*</span></label>
              <input
                type="date"
                className="form-input"
                value={joinDate}
                onChange={(e) => setJoinDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              <UserPlus size={15} />
              {submitting ? 'Adding Member...' : 'Confirm & Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ===== CLUB ROSTER MODAL =====
function ClubRosterModal({ club, onClose, onOpenAddMember, onMemberCountChanged, showToast }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pendingRemove, setPendingRemove] = useState(null);

  function loadMembers() {
    setLoading(true);
    fetch(`${API_BASE}/clubs/${club.club_id}/members`)
      .then((r) => r.json())
      .then((data) => {
        setMembers(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }

  useEffect(() => {
    loadMembers();
  }, [club.club_id]);

  function confirmRemoveMember() {
    if (!pendingRemove) return;
    const studentId = pendingRemove.student_id;
    const studentName = `${pendingRemove.first_name} ${pendingRemove.last_name}`;

    fetch(`${API_BASE}/clubs/${club.club_id}/members/${studentId}`, { method: 'DELETE' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to remove member');
        return res.json();
      })
      .then(() => {
        setPendingRemove(null);
        loadMembers();
        onMemberCountChanged();
        showToast('info', 'Member Removed', `Removed ${studentName} from ${club.club_name}`);
      })
      .catch((err) => {
        showToast('error', 'Error', err.message);
      });
  }

  const filteredMembers = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter(
      (m) =>
        `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
        (m.role_title && m.role_title.toLowerCase().includes(q)) ||
        (m.department && m.department.toLowerCase().includes(q))
    );
  }, [members, search]);

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">{club.club_name} — Member Roster</h3>
            <p className="modal-subtitle">{members.length} registered active members</p>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
          <div className="search-box" style={{ flex: 1 }}>
            <Search size={15} color="var(--text-light)" />
            <input
              placeholder="Search members by name or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-primary btn-sm" onClick={onOpenAddMember}>
            <UserPlus size={14} /> Add Member
          </button>
        </div>

        {loading ? (
          <p className="loading-text">Loading club roster...</p>
        ) : filteredMembers.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem 1rem' }}>
            <Users size={24} color="var(--text-light)" style={{ margin: '0 auto 0.5rem' }} />
            <p className="empty-state-text">No members found in this roster.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '350px' }}>
            <table className="roster-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th>Dept</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((m) => (
                  <tr key={m.student_id}>
                    <td>
                      <strong>{m.first_name} {m.last_name}</strong>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{m.email}</div>
                    </td>
                    <td>
                      <span className="chip-tag">{m.role_title}</span>
                    </td>
                    <td>{m.join_date || 'N/A'}</td>
                    <td>{m.department || 'N/A'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn-icon-only"
                        onClick={() => setPendingRemove(m)}
                        title={`Remove ${m.first_name} from club`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>

        {/* Remove Member Confirmation */}
        <ConfirmModal
          isOpen={Boolean(pendingRemove)}
          title="Remove Club Member"
          message={
            pendingRemove
              ? `Remove ${pendingRemove.first_name} ${pendingRemove.last_name} (${pendingRemove.role_title}) from "${club.club_name}"?`
              : ''
          }
          confirmText="Yes, Remove Member"
          onConfirm={confirmRemoveMember}
          onCancel={() => setPendingRemove(null)}
        />
      </div>
    </div>
  );
}

// ==========================================
// ===== 2. EVENTS VIEW WITH REGISTRATION ===
// ==========================================
function EventsView({ refreshCounts, showToast }) {
  const [events, setEvents] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [search, setSearch] = useState('');
  const [activeType, setActiveType] = useState('All');
  const [sortBy, setSortBy] = useState('date');

  // Modal states for Register for Event & View Attendees
  const [registerTargetEvent, setRegisterTargetEvent] = useState(null);
  const [attendeesTargetEvent, setAttendeesTargetEvent] = useState(null);

  function loadEvents() {
    setLoading(true);
    fetch(`${API_BASE}/events`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load events');
        return res.json();
      })
      .then((data) => {
        setEvents(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        showToast('error', 'Network Error', 'Could not fetch events from database');
        setLoading(false);
      });
  }

  useEffect(() => {
    loadEvents();
    fetch(`${API_BASE}/clubs`).then((r) => r.json()).then(setClubs).catch(() => {});
    fetch(`${API_BASE}/venues`).then((r) => r.json()).then(setVenues).catch(() => {});
  }, []);

  function handleEventAdded() {
    setShowAddEventModal(false);
    loadEvents();
    refreshCounts();
    showToast('success', 'Event Published', 'New campus event added to the calendar.');
  }

  function handleRegistrationSuccess(eventTitle) {
    setRegisterTargetEvent(null);
    loadEvents();
    refreshCounts();
    showToast('success', 'Registration Confirmed', `Successfully registered for "${eventTitle}"!`);
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    const eventId = pendingDelete.event_id;
    const title = pendingDelete.title;

    fetch(`${API_BASE}/events/${eventId}`, { method: 'DELETE' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to delete event');
        return res.json();
      })
      .then(() => {
        setPendingDelete(null);
        loadEvents();
        refreshCounts();
        showToast('info', 'Event Removed', `"${title}" has been deleted.`);
      })
      .catch((err) => {
        showToast('error', 'Error', err.message);
      });
  }

  const types = ['All', ...new Set(events.map((e) => e.event_type).filter(Boolean))];

  const totalRegistrations = useMemo(() => {
    return events.reduce((sum, e) => sum + (e.registered_count || 0), 0);
  }, [events]);

  const filtered = useMemo(() => {
    return events
      .filter((e) => {
        const matchesType = activeType === 'All' || e.event_type === activeType;
        const matchesSearch =
          (e.title || '').toLowerCase().includes(search.toLowerCase()) ||
          (e.club_name || '').toLowerCase().includes(search.toLowerCase()) ||
          (e.venue_name || '').toLowerCase().includes(search.toLowerCase());
        return matchesType && matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === 'date') return (b.event_date || '').localeCompare(a.event_date || '');
        if (sortBy === 'title') return (a.title || '').localeCompare(b.title || '');
        if (sortBy === 'registrations') return (b.registered_count || 0) - (a.registered_count || 0);
        return 0;
      });
  }, [events, activeType, search, sortBy]);

  return (
    <div>
      {/* Banner */}
      <div className="hero-banner" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)' }}>
        <div className="hero-tag" style={{ color: '#93c5fd' }}>
          <Calendar size={14} /> Campus Event Calendar
        </div>
        <h1 className="hero-title">Campus Events & Activities</h1>
        <p className="hero-subtitle">
          Discover hackathons, guest lectures, cultural fests, and workshops hosted by verified campus clubs.
        </p>
      </div>

      {/* Stats Summary Bar */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8' }}>
            <Calendar size={22} />
          </div>
          <div>
            <div className="stat-value">{events.length}</div>
            <div className="stat-label">Total Scheduled Events</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}>
            <Ticket size={22} />
          </div>
          <div>
            <div className="stat-value">{totalRegistrations}</div>
            <div className="stat-label">Student Registrations</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#fef3c7', color: '#d97706' }}>
            <Building2 size={22} />
          </div>
          <div>
            <div className="stat-value">{venues.length}</div>
            <div className="stat-label">Campus Venues Active</div>
          </div>
        </div>
      </div>

      {/* Section Header */}
      <div className="section-header">
        <div>
          <h2 className="section-title">
            All Events <span className="count-pill">{filtered.length} scheduled</span>
          </h2>
          <p className="section-hint">Register for events, check seat capacity, and view attendee lists.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddEventModal(true)}>
          <Plus size={16} /> Add New Event
        </button>
      </div>

      {/* Filter Row */}
      <div className="filter-row">
        <div className="search-box">
          <Search size={16} color="var(--text-light)" />
          <input
            placeholder="Search by title, hosting club, or building..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="btn-icon-only" onClick={() => setSearch('')} title="Clear search">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="category-pills">
          {types.map((type) => (
            <button
              key={type}
              className={`category-pill ${activeType === type ? 'active' : ''}`}
              onClick={() => setActiveType(type)}
            >
              {type === 'All' ? 'All Types' : type}
            </button>
          ))}
        </div>

        <select
          className="sort-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          aria-label="Sort events"
        >
          <option value="date">Sort by Date (Newest first)</option>
          <option value="title">Sort by Title (A-Z)</option>
          <option value="registrations">Sort by Most Registered</option>
        </select>
      </div>

      {/* Events Grid */}
      {loading ? (
        <div className="empty-state">
          <p className="loading-text">Loading events from Neo4j Aura...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Calendar size={28} /></div>
          <h3 className="empty-state-title">No events found</h3>
          <p className="empty-state-text">No scheduled events match your current query or filter.</p>
        </div>
      ) : (
        <div className="card-grid">
          {filtered.map((event) => {
            const style = getCategoryStyle(event.event_type);
            const registered = event.registered_count || 0;
            const capacity = event.max_capacity;
            const isFull = capacity && registered >= capacity;
            const percentFilled = capacity ? Math.min(100, Math.round((registered / capacity) * 100)) : null;

            return (
              <div className="event-card" key={event.event_id}>
                <div className="card-banner" style={{ backgroundColor: style.bg }}>
                  <div className="card-banner-meta">
                    <span className="card-badge-pill" style={{ color: style.accent }}>{event.event_type}</span>
                    <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                      {event.event_date || 'Date TBA'}
                    </span>
                  </div>
                  <div className="card-banner-icon" style={{ backgroundColor: style.accent }}>
                    {style.icon}
                  </div>
                </div>

                <div className="card-body">
                  <div className="card-title-row">
                    <h3 className="card-title">{event.title}</h3>
                    <button
                      className="btn-icon-only"
                      onClick={() => setPendingDelete(event)}
                      title={`Delete ${event.title}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <div className="card-meta-list">
                    <div className="meta-item">
                      <Landmark size={14} color="var(--primary)" />
                      <span>Hosted by: <strong>{event.club_name || 'Campus Club'}</strong></span>
                    </div>
                    <div className="meta-item">
                      <MapPin size={14} color="#dc2626" />
                      <span>{event.venue_name || 'Venue TBA'} ({event.room_number || 'Room TBA'})</span>
                    </div>
                    {event.event_budget ? (
                      <div className="meta-item">
                        <Coins size={14} color="#d97706" />
                        <span>Budget: ₹{event.event_budget.toLocaleString()}</span>
                      </div>
                    ) : null}
                  </div>

                  {/* Venue Capacity Progress Bar (Requirement 3.7) */}
                  <div className="capacity-container">
                    <div className="capacity-labels">
                      <span>Seats Registered: {registered} {capacity ? `/ ${capacity}` : ''}</span>
                      <span className={`capacity-status ${isFull ? 'full' : percentFilled >= 75 ? 'filling' : 'available'}`}>
                        {isFull ? 'Sold Out' : percentFilled >= 75 ? `${percentFilled}% Full` : 'Available'}
                      </span>
                    </div>
                    {capacity ? (
                      <div className="capacity-bar-track">
                        <div
                          className={`capacity-bar-fill ${isFull ? 'full' : percentFilled >= 75 ? 'filling' : 'available'}`}
                          style={{ width: `${percentFilled}%` }}
                        />
                      </div>
                    ) : null}
                  </div>

                  {/* Actions: Register for Event & View Attendees */}
                  <div className="card-actions">
                    <button
                      className="btn btn-primary"
                      onClick={() => setRegisterTargetEvent(event)}
                      disabled={isFull}
                      title={isFull ? 'Venue is at maximum capacity' : 'Register a student for this event'}
                    >
                      <Ticket size={15} />
                      {isFull ? 'Capacity Reached' : 'Register for Event'}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setAttendeesTargetEvent(event)}
                      title="View registered attendees list"
                    >
                      <Users size={14} /> Attendees
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Event Modal */}
      {showAddEventModal && (
        <AddEventModal
          clubs={clubs}
          venues={venues}
          onClose={() => setShowAddEventModal(false)}
          onAdded={handleEventAdded}
        />
      )}

      {/* Register for Event Modal (FEATURE 3) */}
      {registerTargetEvent && (
        <RegisterEventModal
          event={registerTargetEvent}
          onClose={() => setRegisterTargetEvent(null)}
          onSuccess={() => handleRegistrationSuccess(registerTargetEvent.title)}
        />
      )}

      {/* Event Attendees Roster Modal */}
      {attendeesTargetEvent && (
        <EventAttendeesModal
          event={attendeesTargetEvent}
          onClose={() => setAttendeesTargetEvent(null)}
          onOpenRegister={() => {
            const currentEvent = attendeesTargetEvent;
            setAttendeesTargetEvent(null);
            setRegisterTargetEvent(currentEvent);
          }}
          onAttendeeCountChanged={() => {
            loadEvents();
            refreshCounts();
          }}
          showToast={showToast}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(pendingDelete)}
        title="Delete Event"
        message={
          pendingDelete
            ? `Are you sure you want to delete "${pendingDelete.title}"? This also removes its venue scheduling and student registrations in Neo4j.`
            : ''
        }
        confirmText="Yes, Delete Event"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

// ===== REGISTER FOR EVENT MODAL (FEATURE 3) =====
function RegisterEventModal({ event, onClose, onSuccess }) {
  const [tabMode, setTabMode] = useState('existing'); // 'existing' | 'new'
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [attendanceStatus, setAttendanceStatus] = useState('Registered');

  // Form for new student
  const [newStudent, setNewStudent] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    department: 'CSE',
    academic_year: '1st Year',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function loadDirectory() {
    setLoadingStudents(true);
    setLoadError(null);
    fetch(`${API_BASE}/students`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load students');
        return r.json();
      })
      .then((data) => {
        setStudents(Array.isArray(data) ? data : []);
        setLoadingStudents(false);
      })
      .catch((err) => {
        setLoadError(err.message || 'Network error');
        setLoadingStudents(false);
      });
  }

  useEffect(() => {
    loadDirectory();
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setValidationError(null);

    let payload = {
      event_id: event.event_id,
      attendance_status: attendanceStatus,
    };

    if (tabMode === 'existing') {
      if (!selectedStudent) {
        setValidationError('Please select a student from the directory to proceed with registration.');
        setSubmitting(false);
        return;
      }
      payload.student_id = selectedStudent.student_id;
    } else {
      if (!newStudent.first_name.trim() || !newStudent.email.trim()) {
        setError('First Name and Email are required.');
        setSubmitting(false);
        return;
      }
      payload = {
        ...payload,
        ...newStudent,
      };
    }

    fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to complete registration');
        }
        return data;
      })
      .then(() => {
        onSuccess();
      })
      .catch((err) => {
        setError(err.message);
        setSubmitting(false);
      });
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Register for Event</h3>
            <p className="modal-subtitle">Enroll student attendee for campus club event</p>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Selected Event Context Summary */}
        <div className="modal-context-box">
          <div className="context-row">
            <Ticket size={15} color="var(--primary)" />
            <span>Event: <strong>{event.title}</strong></span>
          </div>
          <div className="context-row">
            <Calendar size={15} color="var(--text-muted)" />
            <span>Date: {event.event_date} · Host: {event.club_name}</span>
          </div>
          <div className="context-row">
            <MapPin size={15} color="var(--text-muted)" />
            <span>Venue: {event.venue_name} ({event.room_number})</span>
          </div>
          {event.max_capacity ? (
            <div className="context-row">
              <Users size={15} color="var(--text-muted)" />
              <span>
                Capacity: {event.registered_count || 0} / {event.max_capacity} seats taken
              </span>
            </div>
          ) : null}
        </div>

        {error && (
          <div className="form-error-alert">
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Tabs for Selecting Existing vs New Student */}
        <div className="modal-tabs">
          <button
            type="button"
            className={`modal-tab ${tabMode === 'existing' ? 'active' : ''}`}
            onClick={() => {
              setTabMode('existing');
              setValidationError(null);
            }}
          >
            Select Existing Student
          </button>
          <button
            type="button"
            className={`modal-tab ${tabMode === 'new' ? 'active' : ''}`}
            onClick={() => {
              setTabMode('new');
              setValidationError(null);
            }}
          >
            Register New Student
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {tabMode === 'existing' ? (
            <StudentCombobox
              students={students}
              selectedStudent={selectedStudent}
              onSelectStudent={(s) => {
                setSelectedStudent(s);
                setValidationError(null);
                setError(null);
              }}
              onClearSelection={() => {
                setSelectedStudent(null);
              }}
              loading={loadingStudents}
              error={loadError}
              onRetry={loadDirectory}
              onSwitchToNewTab={() => {
                setTabMode('new');
                setValidationError(null);
              }}
              validationError={validationError}
            />
          ) : (
            <div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">First Name <span className="required">*</span></label>
                  <input
                    className="form-input"
                    placeholder="e.g. Arjun"
                    value={newStudent.first_name}
                    onChange={(e) => setNewStudent({ ...newStudent, first_name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input
                    className="form-input"
                    placeholder="e.g. Menon"
                    value={newStudent.last_name}
                    onChange={(e) => setNewStudent({ ...newStudent, last_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">College Email <span className="required">*</span></label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="student@stu.edu"
                  value={newStudent.email}
                  onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <input
                    className="form-input"
                    placeholder="e.g. CSE, EEE"
                    value={newStudent.department}
                    onChange={(e) => setNewStudent({ ...newStudent, department: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Academic Year</label>
                  <select
                    className="form-select"
                    value={newStudent.academic_year}
                    onChange={(e) => setNewStudent({ ...newStudent, academic_year: e.target.value })}
                  >
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="form-group" style={{ marginTop: '0.75rem' }}>
            <label className="form-label">Attendance Status</label>
            <select
              className="form-select"
              value={attendanceStatus}
              onChange={(e) => setAttendanceStatus(e.target.value)}
            >
              <option value="Registered">Registered (Confirmed Seat)</option>
              <option value="Waitlist">Waitlist</option>
            </select>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              <Ticket size={15} />
              {submitting ? 'Registering...' : 'Confirm Registration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ===== EVENT ATTENDEES ROSTER MODAL =====
function EventAttendeesModal({ event, onClose, onOpenRegister, onAttendeeCountChanged, showToast }) {
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pendingRemove, setPendingRemove] = useState(null);

  function loadAttendees() {
    setLoading(true);
    fetch(`${API_BASE}/events/${event.event_id}/attendees`)
      .then((r) => r.json())
      .then((data) => {
        setAttendees(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }

  useEffect(() => {
    loadAttendees();
  }, [event.event_id]);

  function confirmCancelRegistration() {
    if (!pendingRemove) return;
    const studentId = pendingRemove.student_id;
    const studentName = `${pendingRemove.first_name} ${pendingRemove.last_name}`;

    fetch(`${API_BASE}/events/${event.event_id}/attendees/${studentId}`, { method: 'DELETE' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to cancel registration');
        return res.json();
      })
      .then(() => {
        setPendingRemove(null);
        loadAttendees();
        onAttendeeCountChanged();
        showToast('info', 'Registration Cancelled', `Removed registration for ${studentName}`);
      })
      .catch((err) => {
        showToast('error', 'Error', err.message);
      });
  }

  const filteredAttendees = useMemo(() => {
    if (!search.trim()) return attendees;
    const q = search.toLowerCase();
    return attendees.filter(
      (a) =>
        `${a.first_name} ${a.last_name}`.toLowerCase().includes(q) ||
        (a.email && a.email.toLowerCase().includes(q)) ||
        (a.department && a.department.toLowerCase().includes(q))
    );
  }, [attendees, search]);

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Registered Attendees — {event.title}</h3>
            <p className="modal-subtitle">
              {attendees.length} registered students {event.max_capacity ? `(Capacity: ${event.max_capacity})` : ''}
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
          <div className="search-box" style={{ flex: 1 }}>
            <Search size={15} color="var(--text-light)" />
            <input
              placeholder="Search attendees by name, email, or dept..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-primary btn-sm" onClick={onOpenRegister}>
            <Ticket size={14} /> Register Attendee
          </button>
        </div>

        {loading ? (
          <p className="loading-text">Loading event attendees...</p>
        ) : filteredAttendees.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem 1rem' }}>
            <Ticket size={24} color="var(--text-light)" style={{ margin: '0 auto 0.5rem' }} />
            <p className="empty-state-text">No attendees registered yet for this event.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '350px' }}>
            <table className="roster-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Status</th>
                  <th>Dept</th>
                  <th>Academic Year</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttendees.map((a) => (
                  <tr key={a.student_id}>
                    <td>
                      <strong>{a.first_name} {a.last_name}</strong>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{a.email}</div>
                    </td>
                    <td>
                      <span className="chip-tag event">{a.attendance_status}</span>
                    </td>
                    <td>{a.department || 'N/A'}</td>
                    <td>{a.academic_year || 'N/A'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn-icon-only"
                        onClick={() => setPendingRemove(a)}
                        title={`Cancel registration for ${a.first_name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>

        {/* Cancel Registration Confirmation */}
        <ConfirmModal
          isOpen={Boolean(pendingRemove)}
          title="Cancel Event Registration"
          message={
            pendingRemove
              ? `Cancel event registration for ${pendingRemove.first_name} ${pendingRemove.last_name} from "${event.title}"?`
              : ''
          }
          confirmText="Yes, Cancel Registration"
          onConfirm={confirmCancelRegistration}
          onCancel={() => setPendingRemove(null)}
        />
      </div>
    </div>
  );
}

// ===== ADD EVENT MODAL =====
function AddEventModal({ clubs, venues, onClose, onAdded }) {
  const [form, setForm] = useState({
    title: '',
    event_type: 'Workshop',
    event_date: '',
    start_time: '10:00',
    end_time: '13:00',
    event_budget: '',
    club_id: clubs[0]?.club_id || '',
    venue_id: venues[0]?.venue_id || '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      ...form,
      start_time: `${form.event_date}T${form.start_time}:00`,
      end_time: `${form.event_date}T${form.end_time}:00`,
    };

    fetch(`${API_BASE}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to create event. Please verify club and venue selections.');
        return res.json();
      })
      .then(() => onAdded())
      .catch((err) => {
        setError(err.message);
        setSubmitting(false);
      });
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Publish Campus Event</h3>
            <p className="modal-subtitle">Schedule an official club event with booked campus venue</p>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {error && <div className="form-error-alert"><AlertCircle size={16} /> {error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Event Title <span className="required">*</span></label>
            <input
              className="form-input"
              name="title"
              placeholder="e.g. HackNight 2026, AI Summit"
              value={form.title}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Event Type <span className="required">*</span></label>
              <select className="form-select" name="event_type" value={form.event_type} onChange={handleChange} required>
                <option value="Workshop">Workshop</option>
                <option value="Hackathon">Hackathon</option>
                <option value="Seminar">Seminar</option>
                <option value="Cultural">Cultural</option>
                <option value="Competition">Competition</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Event Date <span className="required">*</span></label>
              <input type="date" className="form-input" name="event_date" value={form.event_date} onChange={handleChange} required />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Start Time <span className="required">*</span></label>
              <input type="time" className="form-input" name="start_time" value={form.start_time} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">End Time <span className="required">*</span></label>
              <input type="time" className="form-input" name="end_time" value={form.end_time} onChange={handleChange} required />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Allocated Budget (₹) <span className="required">*</span></label>
            <input
              type="number"
              className="form-input"
              name="event_budget"
              placeholder="e.g. 15000"
              value={form.event_budget}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Hosting Club <span className="required">*</span></label>
              <select className="form-select" name="club_id" value={form.club_id} onChange={handleChange} required>
                <option value="">Select hosting club</option>
                {clubs.map((c) => (
                  <option key={c.club_id} value={c.club_id}>{c.club_name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Reserved Venue <span className="required">*</span></label>
              <select className="form-select" name="venue_id" value={form.venue_id} onChange={handleChange} required>
                <option value="">Select venue</option>
                {venues.map((v) => (
                  <option key={v.venue_id} value={v.venue_id}>
                    {v.building_name} ({v.room_number}) · Cap: {v.max_capacity}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Publishing Event...' : 'Schedule & Publish Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// ===== 3. STUDENTS VIEW (FIXED HOOKS) =====
// ==========================================
function StudentsView({ refreshCounts, showToast }) {
  const [students, setStudents] = useState([]);
  const [events, setEvents] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [search, setSearch] = useState('');
  const [registering, setRegistering] = useState(false);
  const [joiningClub, setJoiningClub] = useState(false);

  function loadStudents() {
    setLoading(true);
    fetch(`${API_BASE}/students`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load students');
        return res.json();
      })
      .then((data) => {
        setStudents(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        showToast('error', 'Error', 'Failed to fetch students from Neo4j');
        setLoading(false);
      });
  }

  useEffect(() => {
    loadStudents();
    fetch(`${API_BASE}/events`).then((r) => r.json()).then(setEvents).catch(() => {});
    fetch(`${API_BASE}/clubs`).then((r) => r.json()).then(setClubs).catch(() => {});
  }, []);

  function handleSelectStudent(studentId) {
    setSelectedId(studentId);
    setDetailLoading(true);
    fetch(`${API_BASE}/students/${studentId}`)
      .then((res) => res.json())
      .then((data) => {
        setDetail(data);
        setDetailLoading(false);
      })
      .catch(() => setDetailLoading(false));
  }

  function handleQuickRegisterEvent(eventId) {
    if (!selectedId || !eventId) return;
    setRegistering(true);

    fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: selectedId, event_id: parseInt(eventId) }),
    })
      .then(async (res) => {
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Failed to register');
        return d;
      })
      .then(() => {
        setRegistering(false);
        handleSelectStudent(selectedId);
        refreshCounts();
        showToast('success', 'Registered', 'Student successfully enrolled for the event.');
      })
      .catch((err) => {
        setRegistering(false);
        showToast('error', 'Registration Alert', err.message);
      });
  }

  function handleQuickJoinClub(clubId) {
    if (!selectedId || !clubId) return;
    setJoiningClub(true);

    fetch(`${API_BASE}/clubs/${clubId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: selectedId, role_title: 'Member' }),
    })
      .then(async (res) => {
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Failed to enroll into club');
        return d;
      })
      .then(() => {
        setJoiningClub(false);
        handleSelectStudent(selectedId);
        refreshCounts();
        showToast('success', 'Club Membership', 'Student successfully enrolled into club.');
      })
      .catch((err) => {
        setJoiningClub(false);
        showToast('error', 'Membership Alert', err.message);
      });
  }

  function handleStudentAdded() {
    setShowAddStudentModal(false);
    loadStudents();
    refreshCounts();
    showToast('success', 'Student Enrolled', 'Student profile created in Neo4j.');
  }

  function confirmDeleteStudent() {
    if (!pendingDelete) return;
    const studentId = pendingDelete.student_id;
    const name = `${pendingDelete.first_name} ${pendingDelete.last_name}`;

    fetch(`${API_BASE}/students/${studentId}`, { method: 'DELETE' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to delete student');
        return res.json();
      })
      .then(() => {
        setPendingDelete(null);
        loadStudents();
        refreshCounts();
        if (selectedId === studentId) {
          setSelectedId(null);
          setDetail(null);
        }
        showToast('info', 'Student Removed', `Profile and relationships for ${name} deleted.`);
      })
      .catch((err) => {
        showToast('error', 'Error', err.message);
      });
  }

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const q = search.toLowerCase();
      return (
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.department && s.department.toLowerCase().includes(q)) ||
        String(s.student_id).includes(q)
      );
    });
  }, [students, search]);

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">
            Student Directory <span className="count-pill">{students.length} enrolled</span>
          </h2>
          <p className="section-hint">
            Inspect individual student profiles, club memberships, and registered events with graph traversal.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddStudentModal(true)}>
          <Plus size={16} /> Enroll Student
        </button>
      </div>

      <div className="filter-row">
        <div className="search-box">
          <Search size={16} color="var(--text-light)" />
          <input
            placeholder="Search students by name, department, or student ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="btn-icon-only" onClick={() => setSearch('')} title="Clear search">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="students-container">
        {/* Left Column: Student List */}
        <div>
          {loading ? (
            <p className="loading-text">Loading student records...</p>
          ) : filteredStudents.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-text">No students found matching your search.</p>
            </div>
          ) : (
            <div className="student-list">
              {filteredStudents.map((s) => (
                <div
                  key={s.student_id}
                  className={`student-card ${selectedId === s.student_id ? 'selected' : ''}`}
                >
                  <button
                    className="student-card-main"
                    onClick={() => handleSelectStudent(s.student_id)}
                  >
                    <div className="avatar">
                      {s.first_name?.[0]}{s.last_name?.[0]}
                    </div>
                    <div>
                      <div className="student-card-name">{s.first_name} {s.last_name}</div>
                      <div className="student-card-meta">
                        ID: {s.student_id} · {s.department || 'General'} · {s.academic_year || 'Student'}
                      </div>
                    </div>
                  </button>
                  <button
                    className="btn-icon-only"
                    onClick={() => setPendingDelete(s)}
                    title={`Delete ${s.first_name} ${s.last_name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Selected Student Detail Panel */}
        <div>
          {selectedId ? (
            <div className="student-detail-panel">
              {detailLoading ? (
                <p className="loading-text">Loading student graph details...</p>
              ) : (
                detail && (
                  <div>
                    <div className="detail-header">
                      <div className="detail-avatar-large">
                        {detail.first_name?.[0]}{detail.last_name?.[0]}
                      </div>
                      <div>
                        <h3 className="detail-name">{detail.first_name} {detail.last_name}</h3>
                        <div className="detail-meta">
                          {detail.email} · {detail.phone || 'No phone'}
                        </div>
                        <div className="detail-meta" style={{ marginTop: '0.2rem' }}>
                          <strong>{detail.department}</strong> · {detail.academic_year} · ID: {detail.student_id}
                        </div>
                      </div>
                    </div>

                    {/* Club Memberships Section */}
                    <div className="detail-section">
                      <div className="detail-section-title">
                        <span>Club Memberships ({detail.clubs?.length || 0})</span>
                      </div>
                      <div className="chip-list">
                        {detail.club_details && detail.club_details.length > 0 ? (
                          detail.club_details.map((c, i) => (
                            <div className="chip-item" key={i}>
                              <span><Landmark size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} /><strong>{c.club_name}</strong></span>
                              <span className="chip-tag">{c.role_title}</span>
                            </div>
                          ))
                        ) : detail.clubs && detail.clubs.length > 0 ? (
                          detail.clubs.map((clubName, i) => (
                            <div className="chip-item" key={i}>
                              <span><strong>{clubName}</strong></span>
                              <span className="chip-tag">Member</span>
                            </div>
                          ))
                        ) : (
                          <div className="empty-chip-state">Not a member of any club yet.</div>
                        )}
                      </div>
                    </div>

                    {/* Registered Events Section */}
                    <div className="detail-section">
                      <div className="detail-section-title">
                        <span>Event Registrations ({detail.events?.length || 0})</span>
                      </div>
                      <div className="chip-list">
                        {detail.event_details && detail.event_details.length > 0 ? (
                          detail.event_details.map((ev, i) => (
                            <div className="chip-item" key={i}>
                              <span><Ticket size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} /><strong>{ev.title}</strong></span>
                              <span className="chip-tag event">{ev.attendance_status}</span>
                            </div>
                          ))
                        ) : detail.events && detail.events.length > 0 ? (
                          detail.events.map((eventTitle, i) => (
                            <div className="chip-item" key={i}>
                              <span><strong>{eventTitle}</strong></span>
                              <span className="chip-tag event">Registered</span>
                            </div>
                          ))
                        ) : (
                          <div className="empty-chip-state">No event registrations found.</div>
                        )}
                      </div>
                    </div>

                    {/* Quick Register Action */}
                    <div className="quick-action-box">
                      <label className="quick-action-label">Register for an upcoming event:</label>
                      <select
                        className="form-select"
                        onChange={(e) => {
                          if (e.target.value) {
                            handleQuickRegisterEvent(e.target.value);
                            e.target.value = '';
                          }
                        }}
                        disabled={registering}
                      >
                        <option value="">{registering ? 'Registering...' : 'Select event from catalog'}</option>
                        {events
                          .filter((ev) => !detail.events?.includes(ev.title))
                          .map((ev) => (
                            <option key={ev.event_id} value={ev.event_id}>
                              {ev.title} ({ev.event_date})
                            </option>
                          ))}
                      </select>
                    </div>

                    {/* Quick Join Club Action */}
                    <div className="quick-action-box" style={{ marginTop: '0.85rem' }}>
                      <label className="quick-action-label">Enroll into a campus club:</label>
                      <select
                        className="form-select"
                        onChange={(e) => {
                          if (e.target.value) {
                            handleQuickJoinClub(e.target.value);
                            e.target.value = '';
                          }
                        }}
                        disabled={joiningClub}
                      >
                        <option value="">{joiningClub ? 'Enrolling...' : 'Select club to join'}</option>
                        {clubs
                          .filter((c) => !detail.clubs?.includes(c.club_name))
                          .map((c) => (
                            <option key={c.club_id} value={c.club_id}>
                              {c.club_name} ({c.category})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="student-detail-panel" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
              <Users size={36} color="var(--text-light)" style={{ margin: '0 auto 0.75rem' }} />
              <h4 style={{ margin: '0 0 0.35rem', color: 'var(--text-main)' }}>Select a Student</h4>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', margin: 0 }}>
                Click any student in the directory to inspect their live club memberships and event registration history.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Enroll Student Modal */}
      {showAddStudentModal && (
        <AddStudentModal
          onClose={() => setShowAddStudentModal(false)}
          onAdded={handleStudentAdded}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(pendingDelete)}
        title="Delete Student"
        message={
          pendingDelete
            ? `Delete ${pendingDelete.first_name} ${pendingDelete.last_name}? This will remove all their club memberships and event registrations in Neo4j.`
            : ''
        }
        confirmText="Yes, Delete Student"
        onConfirm={confirmDeleteStudent}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

// ===== ADD STUDENT MODAL =====
function AddStudentModal({ onClose, onAdded }) {
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    department: 'CSE',
    academic_year: '1st Year',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    fetch(`${API_BASE}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to enroll student');
        return res.json();
      })
      .then(() => onAdded())
      .catch((err) => {
        setError(err.message);
        setSubmitting(false);
      });
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Enroll New Student</h3>
            <p className="modal-subtitle">Add a student profile to the campus management network</p>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {error && <div className="form-error-alert"><AlertCircle size={16} /> {error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">First Name <span className="required">*</span></label>
              <input className="form-input" name="first_name" placeholder="First Name" value={form.first_name} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name <span className="required">*</span></label>
              <input className="form-input" name="last_name" placeholder="Last Name" value={form.last_name} onChange={handleChange} required />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email Address <span className="required">*</span></label>
            <input type="email" className="form-input" name="email" placeholder="student@stu.edu" value={form.email} onChange={handleChange} required />
          </div>

          <div className="form-group">
            <label className="form-label">Contact Phone</label>
            <input className="form-input" name="phone" placeholder="9876543210" value={form.phone} onChange={handleChange} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Department <span className="required">*</span></label>
              <input className="form-input" name="department" placeholder="e.g. CSE, IT, ME" value={form.department} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Academic Year <span className="required">*</span></label>
              <select className="form-select" name="academic_year" value={form.academic_year} onChange={handleChange} required>
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
              </select>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Enrolling...' : 'Save & Enroll Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// ===== 4. GRAPH VIEW (NEO4J VISUALIZER) ===
// ==========================================
function GraphView() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/graph`)
      .then((res) => res.json())
      .then((data) => {
        setGraphData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const colorMap = {
    Club: '#4f46e5',
    Student: '#16a34a',
    Event: '#f59e0b',
    Venue: '#0284c7',
    FacultyAdvisor: '#9333ea',
    ClubBudget: '#e11d48',
    SponsorCompany: '#ca8a04',
    EquipmentAsset: '#57534e',
    EventDetails: '#475569',
  };

  if (loading) return <p className="loading-text">Loading Neo4j graph nodes and relationships...</p>;

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">Knowledge Graph Visualization</h2>
          <p className="section-hint">
            Live interactive graph rendering {graphData.nodes.length} nodes and {graphData.links.length} connected edges from Neo4j Aura.
          </p>
        </div>
      </div>

      <div className="graph-container">
        <ForceGraph2D
          graphData={graphData}
          nodeLabel={(node) => `${node.label}: ${node.name}`}
          nodeRelSize={7}
          linkLabel={(link) => link.type}
          linkDirectionalArrowLength={4.5}
          linkDirectionalArrowRelPos={1}
          linkColor={() => '#cbd5e1'}
          width={860}
          height={540}
          nodeCanvasObject={(node, ctx, globalScale) => {
            const color = colorMap[node.label] || '#94a3b8';
            const radius = 6.5;

            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
            ctx.fillStyle = color;
            ctx.fill();

            const label = node.name;
            const fontSize = 11 / globalScale;
            ctx.font = `${fontSize}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = '#0f172a';
            ctx.fillText(label, node.x, node.y + radius + 3);
          }}
          nodePointerAreaPaint={(node, color, ctx) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(node.x, node.y, 6.5, 0, 2 * Math.PI, false);
            ctx.fill();
          }}
        />
      </div>

      <div className="graph-legend">
        {Object.entries(colorMap).map(([label, color]) => (
          <div className="legend-item" key={label}>
            <span className="legend-dot" style={{ backgroundColor: color }}></span>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
