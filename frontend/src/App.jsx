import { useState, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import './App.css';
import {
  GraduationCap, Users, Calendar, Landmark, Search, Trash2,
  Sparkles, Laptop, MessageCircle, Palette, Leaf, Flag, MapPin, Network
} from 'lucide-react';

const API_BASE = 'http://localhost:5050/api';

const CATEGORY_STYLES = {
  Technical: { bg: '#eef2ff', accent: '#6366f1', icon: <Laptop size={16} color="#fff" /> },
  'Non-Technical': { bg: '#fff7ed', accent: '#f59e0b', icon: <MessageCircle size={16} color="#fff" /> },
  Cultural: { bg: '#f0fdf4', accent: '#22c55e', icon: <Palette size={16} color="#fff" /> },
  Default: { bg: '#f5f3ff', accent: '#8b5cf6', icon: <Leaf size={16} color="#fff" /> },
};

function getCategoryStyle(category) {
  return CATEGORY_STYLES[category] || CATEGORY_STYLES.Default;
}

function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon">⚠</div>
        <p className="modal-message">{message}</p>
        <div className="modal-actions">
          <button className="modal-cancel" onClick={onCancel}>Cancel</button>
          <button className="modal-confirm" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [tab, setTab] = useState('clubs');
  const [counts, setCounts] = useState({ clubs: 0, students: 0, events: 0 });

  useEffect(() => {
    fetch(`${API_BASE}/clubs`).then((r) => r.json()).then((d) => setCounts((c) => ({ ...c, clubs: d.length })));
    fetch(`${API_BASE}/students`).then((r) => r.json()).then((d) => setCounts((c) => ({ ...c, students: d.length })));
    fetch(`${API_BASE}/events`).then((r) => r.json()).then((d) => setCounts((c) => ({ ...c, events: d.length })));
  }, [tab]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo"><GraduationCap size={20} color="#fff" /></div>
          <div>
            <div className="brand-name">Campus Connect</div>
          </div>
        </div>

        <div className="sidebar-section-label">Your Campus</div>
        <nav className="sidebar-nav">
          <button className={`sidebar-link ${tab === 'clubs' ? 'active' : ''}`} onClick={() => setTab('clubs')}>
            <span className="sidebar-link-label"><Landmark size={16} /> Clubs</span>
            <span className="sidebar-count">{String(counts.clubs).padStart(2, '0')}</span>
          </button>
          <button className={`sidebar-link ${tab === 'students' ? 'active' : ''}`} onClick={() => setTab('students')}>
            <span className="sidebar-link-label"><Users size={16} /> Students</span>
            <span className="sidebar-count">{String(counts.students).padStart(2, '0')}</span>
          </button>
          <button className={`sidebar-link ${tab === 'events' ? 'active' : ''}`} onClick={() => setTab('events')}>
            <span className="sidebar-link-label"><Calendar size={16} /> Events</span>
            <span className="sidebar-count">{String(counts.events).padStart(2, '0')}</span>
          </button>
          <button className={`sidebar-link ${tab === 'graph' ? 'active' : ''}`} onClick={() => setTab('graph')}>
            <span className="sidebar-link-label"><Network size={16} /> Graph View</span>
          </button>
        </nav>

        <div className="sidebar-promo">
          <div className="sidebar-promo-icon"><Sparkles size={18} color="#d97706" /></div>
          <strong>Powered by Neo4j</strong>
          <p>A graph database modeling every club, student, and event as a connected network.</p>
        </div>
      </aside>

      <main className="main-content">
        <div className="topbar">
          <div className="breadcrumb">Campus Life / <strong>{tab[0].toUpperCase() + tab.slice(1)}</strong></div>
          <div className="topbar-badge">DA-3 · Graph DB</div>
        </div>

        {tab === 'clubs' && <ClubsView count={counts.clubs} />}
        {tab === 'students' && <StudentsView count={counts.students} />}
        {tab === 'events' && <EventsView count={counts.events} />}
        {tab === 'graph' && <GraphView />}
      </main>
    </div>
  );
}

// ===== GRAPH VIEW =====

function GraphView() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/graph`)
      .then((res) => res.json())
      .then((data) => {
        setGraphData(data);
        setLoading(false);
      });
  }, []);

  const colorMap = {
    Club: '#6366f1',
    Student: '#22c55e',
    Event: '#f59e0b',
    Venue: '#06b6d4',
    FacultyAdvisor: '#a855f7',
    ClubBudget: '#f43f5e',
    SponsorCompany: '#eab308',
    EquipmentAsset: '#78716c',
    EventDetails: '#64748b',
  };

  if (loading) return <p className="loading-text">Loading graph...</p>;

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">Graph View</h2>
          <p className="section-hint">
            Live visualization of {graphData.nodes.length} nodes and {graphData.links.length} relationships from Neo4j
          </p>
        </div>
      </div>

      <div className="graph-container">
        <ForceGraph2D
          graphData={graphData}
          nodeLabel={(node) => `${node.label}: ${node.name}`}
          nodeRelSize={6}
          linkLabel={(link) => link.type}
          linkDirectionalArrowLength={4}
          linkDirectionalArrowRelPos={1}
          linkColor={() => '#d4d4d8'}
          width={820}
          height={520}
          nodeCanvasObject={(node, ctx, globalScale) => {
            const color = colorMap[node.label] || '#999';
            const radius = 6;

            // Draw the circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
            ctx.fillStyle = color;
            ctx.fill();

            // Draw the label text below the circle
            const label = node.name;
            const fontSize = 11 / globalScale;
            ctx.font = `${fontSize}px Sans-Serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = '#18181b';
            ctx.fillText(label, node.x, node.y + radius + 2);
          }}
          nodePointerAreaPaint={(node, color, ctx) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(node.x, node.y, 6, 0, 2 * Math.PI, false);
            ctx.fill();
          }}
        />
      </div>

      <div className="graph-legend">
        {Object.entries(colorMap).map(([label, color]) => (
          <div className="legend-item" key={label}>
            <span className="legend-dot" style={{ backgroundColor: color }}></span>
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== CLUBS =====

function ClubsView() {
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  function loadClubs() {
    fetch(`${API_BASE}/clubs`)
      .then((res) => res.json())
      .then((data) => {
        setClubs(data);
        setLoading(false);
      });
  }

  useEffect(() => {
    loadClubs();
  }, []);

  function handleAdded() {
    setShowForm(false);
    setLoading(true);
    loadClubs();
  }

  function confirmDelete() {
    fetch(`${API_BASE}/clubs/${pendingDelete.club_id}`, { method: 'DELETE' }).then(() => {
      setPendingDelete(null);
      loadClubs();
    });
  }

  if (loading) return <p className="loading-text">Loading clubs...</p>;

  const categories = ['All', ...new Set(clubs.map((c) => c.category))];
  const filtered = clubs.filter(
    (c) =>
      (activeCategory === 'All' || c.category === activeCategory) &&
      c.club_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="hero-banner">
        <div className="hero-tag">● A LITTLE MORE CONNECTED, EVERY DAY</div>
        <h1 className="hero-title">Your Campus, Your Community ✨</h1>
        <p className="hero-subtitle">Discover campus clubs, find your people, and make room for memorable events.</p>
      </div>

      <div className="section-header">
        <div>
          <h2 className="section-title">Find your circle. <span className="count-pill">{clubs.length} campus clubs</span></h2>
          <p className="section-hint">Different passions. One campus. A place for everyone.</p>
        </div>
        <button className="add-button" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Club'}
        </button>
      </div>

      {showForm && <AddClubForm onAdded={handleAdded} />}

      <div className="filter-row">
        <div className="search-box">
          <Search size={16} color="#a1a1aa" />
          <input placeholder="Search clubs or interests..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="category-pills">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`category-pill ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat === 'All' ? 'All clubs' : cat}
            </button>
          ))}
        </div>
      </div>

      <div className="club-grid">
        {filtered.map((club) => {
          const style = getCategoryStyle(club.category);
          return (
            <div className="club-card" key={club.club_id}>
              <div className="club-banner" style={{ backgroundColor: style.bg }}>
                <div className="club-banner-label">EST. {club.founded_date?.slice(0, 4)}</div>
                <div className="club-banner-icon" style={{ backgroundColor: style.accent }}>{style.icon}</div>
              </div>
              <div className="club-body">
                <div className="club-body-top">
                  <span className="category-tag" style={{ backgroundColor: style.bg, color: style.accent }}>
                    {club.category}
                  </span>
                  <button className="delete-button" onClick={() => setPendingDelete(club)}><Trash2 size={15} /></button>
                </div>
                <h3 className="club-name">{club.club_name}</h3>
                <div className="club-footer">
                  <span className="footer-line"><Flag size={12} /> Founded {club.founded_date}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {pendingDelete && (
        <ConfirmModal
          message={`Delete "${pendingDelete.club_name}"? This also removes its budget, memberships, and hosted-event relationships.`}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}

function AddClubForm({ onAdded }) {
  const [form, setForm] = useState({ club_name: '', category: '', founded_date: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

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
        if (!res.ok) throw new Error('Failed to add club');
        return res.json();
      })
      .then(() => onAdded())
      .catch((err) => {
        setError(err.message);
        setSubmitting(false);
      });
  }

  return (
    <form className="add-form" onSubmit={handleSubmit}>
      <input name="club_name" placeholder="Club name" value={form.club_name} onChange={handleChange} required />
      <input name="category" placeholder="Category (e.g. Technical)" value={form.category} onChange={handleChange} required />
      <input name="founded_date" type="date" value={form.founded_date} onChange={handleChange} required />
      <button type="submit" disabled={submitting}>{submitting ? 'Adding...' : 'Add Club'}</button>
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}

// ===== STUDENTS =====

function StudentsView() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [search, setSearch] = useState('');

  function loadStudents() {
    fetch(`${API_BASE}/students`)
      .then((res) => res.json())
      .then((data) => {
        setStudents(data);
        setLoading(false);
      });
  }

  useEffect(() => {
    loadStudents();
  }, []);

  function handleAdded() {
    setShowForm(false);
    setLoading(true);
    loadStudents();
  }

  function handleSelect(studentId) {
    setSelectedId(studentId);
    setDetailLoading(true);
    fetch(`${API_BASE}/students/${studentId}`)
      .then((res) => res.json())
      .then((data) => {
        setDetail(data);
        setDetailLoading(false);
      });
  }

  function confirmDelete() {
    const studentId = pendingDelete.student_id;
    fetch(`${API_BASE}/students/${studentId}`, { method: 'DELETE' }).then(() => {
      setPendingDelete(null);
      loadStudents();
      if (selectedId === studentId) {
        setSelectedId(null);
        setDetail(null);
      }
    });
  }

  if (loading) return <p className="loading-text">Loading students...</p>;

  const filtered = students.filter((s) =>
    `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">Meet the students <span className="count-pill">{students.length} enrolled</span></h2>
          <p className="section-hint">Click a student to see their clubs and events (graph traversal demo)</p>
        </div>
        <button className="add-button" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Student'}
        </button>
      </div>

      {showForm && <AddStudentForm onAdded={handleAdded} />}

      <div className="filter-row">
        <div className="search-box">
          <Search size={16} color="#a1a1aa" />
          <input placeholder="Search students..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="student-list">
        {filtered.map((student) => (
          <div key={student.student_id} className={`student-card ${selectedId === student.student_id ? 'selected' : ''}`}>
            <button className="student-card-main" onClick={() => handleSelect(student.student_id)}>
              <div className="avatar">{student.first_name[0]}{student.last_name[0]}</div>
              <div>
                <div className="student-card-name">{student.first_name} {student.last_name}</div>
                <div className="student-card-meta">{student.department} · {student.academic_year}</div>
              </div>
            </button>
            <button className="delete-button" onClick={() => setPendingDelete(student)}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>

      {selectedId && (
        <div className="detail-panel">
          {detailLoading ? (
            <p className="loading-text">Loading details...</p>
          ) : (
            detail && (
              <div>
                <div className="detail-name">{detail.first_name} {detail.last_name}</div>
                <div className="detail-email">{detail.email}</div>

                <div className="detail-row">
                  <strong>Clubs:</strong>
                  <div className="badge-list">
                    {detail.clubs.length > 0 ? (
                      detail.clubs.map((c, i) => <span className="badge" key={i}>{c}</span>)
                    ) : (
                      <span className="card-meta">None</span>
                    )}
                  </div>
                </div>

                <div className="detail-row" style={{ marginTop: '0.8rem' }}>
                  <strong>Events registered:</strong>
                  <div className="badge-list">
                    {detail.events.length > 0 ? (
                      detail.events.map((e, i) => <span className="badge" key={i}>{e}</span>)
                    ) : (
                      <span className="card-meta">None</span>
                    )}
                  </div>
                </div>
              </div>
            )
          )}
          <div className="detail-row" style={{ marginTop: '1rem' }}>
            <strong>Register for a new event:</strong>
            <select
              className="register-select"
              onChange={(e) => {
                if (e.target.value) handleRegister(e.target.value);
                e.target.value = '';
              }}
              disabled={registering}
            >
              <option value="">{registering ? 'Registering...' : 'Select an event'}</option>
              {events
                .filter((ev) => !detail.events.includes(ev.title))
                .map((ev) => (
                  <option key={ev.event_id} value={ev.event_id}>{ev.title}</option>
                ))}
            </select>
          </div>
        </div>
      )}

      {pendingDelete && (
        <ConfirmModal
          message={`Delete ${pendingDelete.first_name} ${pendingDelete.last_name}? This also removes their club memberships and event registrations.`}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );

  const [events, setEvents] = useState([]);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/events`).then((res) => res.json()).then(setEvents);
  }, []);

  function handleRegister(eventId) {
    setRegistering(true);
    fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: selectedId, event_id: eventId }),
    })
      .then(() => {
        setRegistering(false);
        handleSelect(selectedId); // refresh the detail panel
      });
  }
}

function AddStudentForm({ onAdded }) {
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', department: '', academic_year: ''
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
        if (!res.ok) throw new Error('Failed to add student');
        return res.json();
      })
      .then(() => onAdded())
      .catch((err) => {
        setError(err.message);
        setSubmitting(false);
      });
  }

  return (
    <form className="add-form" onSubmit={handleSubmit}>
      <input name="first_name" placeholder="First name" value={form.first_name} onChange={handleChange} required />
      <input name="last_name" placeholder="Last name" value={form.last_name} onChange={handleChange} required />
      <input name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} required />
      <input name="phone" placeholder="Phone" value={form.phone} onChange={handleChange} />
      <input name="department" placeholder="Department (e.g. CSE)" value={form.department} onChange={handleChange} required />
      <input name="academic_year" placeholder="Year (e.g. 2nd Year)" value={form.academic_year} onChange={handleChange} required />
      <button type="submit" disabled={submitting}>{submitting ? 'Adding...' : 'Add Student'}</button>
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}

// ===== EVENTS =====

function EventsView() {
  const [events, setEvents] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [search, setSearch] = useState('');

  function loadEvents() {
    fetch(`${API_BASE}/events`)
      .then((res) => res.json())
      .then((data) => {
        setEvents(data);
        setLoading(false);
      });
  }

  useEffect(() => {
    loadEvents();
    fetch(`${API_BASE}/clubs`).then((res) => res.json()).then(setClubs);
    fetch(`${API_BASE}/venues`).then((res) => res.json()).then(setVenues);
  }, []);

  function handleAdded() {
    setShowForm(false);
    setLoading(true);
    loadEvents();
  }

  function confirmDelete() {
    fetch(`${API_BASE}/events/${pendingDelete.event_id}`, { method: 'DELETE' }).then(() => {
      setPendingDelete(null);
      loadEvents();
    });
  }

  if (loading) return <p className="loading-text">Loading events...</p>;

  const filtered = events.filter((e) => e.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">What's happening <span className="count-pill">{events.length} events</span></h2>
          <p className="section-hint">Upcoming and past club events across campus.</p>
        </div>
        <button className="add-button" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Event'}
        </button>
      </div>

      {showForm && <AddEventForm clubs={clubs} venues={venues} onAdded={handleAdded} />}

      <div className="filter-row">
        <div className="search-box">
          <Search size={16} color="#a1a1aa" />
          <input placeholder="Search events..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="club-grid">
        {filtered.map((event) => {
          const style = getCategoryStyle(event.event_type);
          return (
            <div className="club-card" key={event.event_id}>
              <div className="club-banner" style={{ backgroundColor: style.bg }}>
                <div className="club-banner-label">{event.event_date}</div>
                <div className="club-banner-icon" style={{ backgroundColor: style.accent }}>
                  <Calendar size={16} color="#fff" />
                </div>
              </div>
              <div className="club-body">
                <div className="club-body-top">
                  <span className="category-tag" style={{ backgroundColor: style.bg, color: style.accent }}>
                    {event.event_type}
                  </span>
                  <button className="delete-button" onClick={() => setPendingDelete(event)}><Trash2 size={15} /></button>
                </div>
                <h3 className="club-name">{event.title}</h3>
                <div className="club-footer">
                  <span className="footer-line"><Landmark size={12} /> {event.club_name}</span>
                  <span className="footer-line"><MapPin size={12} /> {event.venue_name} ({event.room_number})</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {pendingDelete && (
        <ConfirmModal
          message={`Delete "${pendingDelete.title}"? This also removes its venue and hosting-club relationships.`}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}

function AddEventForm({ clubs, venues, onAdded }) {
  const [form, setForm] = useState({
    title: '', event_type: '', event_date: '', start_time: '', end_time: '',
    event_budget: '', club_id: '', venue_id: ''
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
        if (!res.ok) throw new Error('Failed to add event — check club/venue selection');
        return res.json();
      })
      .then(() => onAdded())
      .catch((err) => {
        setError(err.message);
        setSubmitting(false);
      });
  }

  return (
    <form className="add-form" onSubmit={handleSubmit}>
      <input name="title" placeholder="Event title" value={form.title} onChange={handleChange} required />
      <input name="event_type" placeholder="Type (e.g. Workshop)" value={form.event_type} onChange={handleChange} required />
      <input name="event_date" type="date" value={form.event_date} onChange={handleChange} required />
      <div className="form-row">
        <input name="start_time" type="time" value={form.start_time} onChange={handleChange} required />
        <input name="end_time" type="time" value={form.end_time} onChange={handleChange} required />
      </div>
      <input name="event_budget" type="number" placeholder="Budget" value={form.event_budget} onChange={handleChange} required />

      <select name="club_id" value={form.club_id} onChange={handleChange} required>
        <option value="">Select hosting club</option>
        {clubs.map((c) => (
          <option key={c.club_id} value={c.club_id}>{c.club_name}</option>
        ))}
      </select>

      <select name="venue_id" value={form.venue_id} onChange={handleChange} required>
        <option value="">Select venue</option>
        {venues.map((v) => (
          <option key={v.venue_id} value={v.venue_id}>{v.building_name} - {v.room_number}</option>
        ))}
      </select>

      <button type="submit" disabled={submitting}>{submitting ? 'Adding...' : 'Add Event'}</button>
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}

export default App;