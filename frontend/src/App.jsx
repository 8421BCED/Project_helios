import React, { useState, useEffect, useRef } from 'react';
import { 
  Globe, 
  Satellite as SatIcon, 
  Cpu, 
  Sun, 
  Moon, 
  CloudRain, 
  RefreshCw, 
  Search, 
  Navigation,
  Activity,
  Compass,
  Clock
} from 'lucide-react';
import CesiumGlobe from './components/CesiumGlobe';
import './App.css';

export default function App() {
  // --- A. AUTHENTICATION & ROUTING STATES ---
  const [loggedInUser, setLoggedInUser] = useState(() => {
    const saved = localStorage.getItem('helios_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [isValidating, setIsValidating] = useState(() => {
    return !!localStorage.getItem('helios_user');
  });

  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authError, setAuthError] = useState('');

  // Admin States
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => {
    return sessionStorage.getItem('helios_admin_auth') === 'true';
  });
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminError, setAdminError] = useState('');
  
  // Admin User Modal CRUD States
  const [isCrudModalOpen, setIsCrudModalOpen] = useState(false);
  const [crudMode, setCrudMode] = useState('create'); // 'create' | 'edit'
  const [crudUserId, setCrudUserId] = useState(null);
  const [crudUsername, setCrudUsername] = useState('');
  const [crudEmail, setCrudEmail] = useState('');
  const [crudPassword, setCrudPassword] = useState('');
  const [crudError, setCrudError] = useState('');

  // --- B. CORE DASHBOARD STATES ---
  const [selectedGroup, setSelectedGroup] = useState('stations');
  const [satellites, setSatellites] = useState([]);
  const [selectedSatellite, setSelectedSatellite] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isSpinning, setIsSpinning] = useState(true);
  const [showOrbits, setShowOrbits] = useState(true);
  const [isCameraLocked, setIsCameraLocked] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [weather, setWeather] = useState(null);
  const [astronomy, setAstronomy] = useState(null);
  const [apod, setApod] = useState(null);
  const [utcTime, setUtcTime] = useState(new Date().toUTCString());

  const selectedNoradIdRef = useRef(null);
  const lastFetchedCoordsRef = useRef({ lat: null, lon: null });
  const liveCoordsRef = useRef({ lat: null, lon: null });

  // --- C. ROUTING ROUTER EMULATION ---
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    
    const originalPushState = window.history.pushState;
    window.history.pushState = function(...args) {
      originalPushState.apply(this, args);
      handleLocationChange();
    };
    
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.history.pushState = originalPushState;
    };
  }, []);

  const navigateTo = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  // --- C2. INITIAL SESSION VALIDATION (Checks user existence on mount/refresh) ---
  useEffect(() => {
    const saved = localStorage.getItem('helios_user');
    if (!saved) {
      setIsValidating(false);
      return;
    }
    try {
      const parsed = JSON.parse(saved);
      // Validate cached session on startup with a delta of 0 seconds
      fetch('http://localhost:8080/api/auth/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: parsed.username, deltaSeconds: 0 })
      })
      .then(res => {
        if (res.status === 404) {
          handleLogout();
          alert("Your account has been deleted by the administrator.");
          throw new Error("User account deleted");
        }
        if (!res.ok) throw new Error("Validation ping failed");
        return res.json();
      })
      .then(updatedUser => {
        const merged = { ...parsed, ...updatedUser };
        setLoggedInUser(merged);
        localStorage.setItem('helios_user', JSON.stringify(merged));
      })
      .catch(err => {
        console.error("Initial session verification check:", err);
      })
      .finally(() => {
        setIsValidating(false);
      });
    } catch (e) {
      console.error("Session parse error during validation initialization:", e);
      localStorage.removeItem('helios_user');
      setLoggedInUser(null);
      setIsValidating(false);
    }
  }, []);

  const handleCategorySelect = (group) => {
    setSelectedGroup(group);
    handleSelectSatellite(null);
    if (loggedInUser) {
      fetch('http://localhost:8080/api/auth/interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loggedInUser.username, category: group })
      }).catch(err => console.error("Error recording user interest:", err));
    }
  };

  const loggedInUserRef = useRef(loggedInUser);
  useEffect(() => {
    loggedInUserRef.current = loggedInUser;
  }, [loggedInUser]);

  const hasUser = !!loggedInUser;

  // --- D. HEARTBEAT INTERVAL (Updates online status and time spent) ---
  useEffect(() => {
    if (!hasUser) return;

    // Send initial ping
    const sendPing = () => {
      const currentUser = loggedInUserRef.current;
      if (!currentUser) return;

      fetch('http://localhost:8080/api/auth/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser.username, deltaSeconds: 10 })
      })
      .then(res => {
        if (res.status === 404) {
          handleLogout();
          alert("Your account has been deleted by the administrator.");
          throw new Error("User account has been deleted");
        }
        if (!res.ok) throw new Error("Ping failed");
        return res.json();
      })
      .then(updatedUser => {
        // Keep localized state in sync with duration and click tracking
        const merged = { ...loggedInUserRef.current, ...updatedUser };
        setLoggedInUser(merged);
        localStorage.setItem('helios_user', JSON.stringify(merged));
      })
      .catch(err => console.error("Heartbeat sync error:", err));
    };

    sendPing();
    const interval = setInterval(sendPing, 10000); // Heartbeat ping every 10 seconds
    return () => clearInterval(interval);
  }, [hasUser]);

  // Live UTC Clock
  useEffect(() => {
    const timer = setInterval(() => {
      setUtcTime(new Date().toUTCString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch NASA APOD on mount
  useEffect(() => {
    fetch('http://localhost:8080/api/nasa/apod')
      .then(res => res.json())
      .then(data => setApod(data))
      .catch(err => console.error("Error fetching APOD:", err));
  }, []);

  // Fetch Satellite Telemetry Loop
  useEffect(() => {
    if (!loggedInUser || currentPath === '/admin') return;

    const fetchSatellites = () => {
      fetch(`http://localhost:8080/api/satellites/${selectedGroup}`)
        .then(res => res.json())
        .then(data => {
          setSatellites(data);
          
          if (selectedNoradIdRef.current) {
            const fresh = data.find(s => s.noradId === selectedNoradIdRef.current);
            if (fresh) {
              setSelectedSatellite(fresh);
              liveCoordsRef.current = { lat: fresh.latitude, lon: fresh.longitude };
            }
          }
        })
        .catch(err => console.error("Error fetching satellite data:", err));
    };

    fetchSatellites();
    const interval = setInterval(fetchSatellites, 2500);
    return () => clearInterval(interval);
  }, [selectedGroup, loggedInUser, currentPath]);

  // Fetch Weather & Astronomy when position moves significantly
  const fetchLocationMetadata = (lat, lon, force = false) => {
    if (lat === null || lon === null) return;

    if (!force && lastFetchedCoordsRef.current.lat !== null) {
      const dLat = Math.abs(lat - lastFetchedCoordsRef.current.lat);
      const dLon = Math.abs(lon - lastFetchedCoordsRef.current.lon);
      if (dLat < 2.0 && dLon < 2.0) {
        return; 
      }
    }

    lastFetchedCoordsRef.current = { lat, lon };

    fetch(`http://localhost:8080/api/weather?lat=${lat}&lon=${lon}`)
      .then(res => res.json())
      .then(data => setWeather(data))
      .catch(err => console.error("Error fetching weather:", err));

    fetch(`http://localhost:8080/api/astronomy?coords=${lat},${lon}`)
      .then(res => res.json())
      .then(data => setAstronomy(data))
      .catch(err => console.error("Error fetching astronomy:", err));
  };

  const handleSelectSatellite = (sat) => {
    if (sat) {
      selectedNoradIdRef.current = sat.noradId;
      setSelectedSatellite(sat);
      liveCoordsRef.current = { lat: sat.latitude, lon: sat.longitude };
      fetchLocationMetadata(sat.latitude, sat.longitude, true);
    } else {
      selectedNoradIdRef.current = null;
      setSelectedSatellite(null);
      setWeather(null);
      setAstronomy(null);
      liveCoordsRef.current = { lat: null, lon: null };
      lastFetchedCoordsRef.current = { lat: null, lon: null };
    }
  };

  useEffect(() => {
    if (!selectedNoradIdRef.current) return;

    const interval = setInterval(() => {
      const coords = liveCoordsRef.current;
      if (coords && coords.lat !== null) {
        fetchLocationMetadata(coords.lat, coords.lon);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [selectedSatellite?.noradId]);

  const handleRefreshCache = () => {
    setIsRefreshing(true);
    fetch('http://localhost:8080/api/satellites/refresh', { method: 'POST' })
      .then(res => res.json())
      .then(() => fetch(`http://localhost:8080/api/satellites/${selectedGroup}`))
      .then(res => res.json())
      .then(data => {
        setSatellites(data);
        setIsRefreshing(false);
      })
      .catch(err => {
        console.error("Error syncing cache:", err);
        setIsRefreshing(false);
      });
  };

  // --- E. AUTH CONTROLLER LOGIC ---
  const handleAuthSubmit = (e) => {
    e.preventDefault();
    setAuthError('');

    if (authMode === 'login') {
      fetch('http://localhost:8080/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: authUsername, password: authPassword })
      })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Login failed");
        return data;
      })
      .then(user => {
        localStorage.setItem('helios_user', JSON.stringify(user));
        setLoggedInUser(user);
        setAuthUsername('');
        setAuthPassword('');
      })
      .catch(err => setAuthError(err.message));
    } else {
      fetch('http://localhost:8080/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: authUsername, email: authEmail, password: authPassword })
      })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Registration failed");
        return data;
      })
      .then(user => {
        // Log in immediately after successful signup
        localStorage.setItem('helios_user', JSON.stringify(user));
        setLoggedInUser(user);
        setAuthUsername('');
        setAuthEmail('');
        setAuthPassword('');
      })
      .catch(err => setAuthError(err.message));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('helios_user');
    setLoggedInUser(null);
    handleSelectSatellite(null);
  };

  // --- F. ADMIN CONTROLLER LOGIC (CRUD) ---
  const handleAdminVerify = (e) => {
    e.preventDefault();
    setAdminError('');
    if (adminPasswordInput === 'sweet') {
      setIsAdminAuthenticated(true);
      sessionStorage.setItem('helios_admin_auth', 'true');
      setAdminPasswordInput('');
      fetchAdminUsers();
    } else {
      setAdminError('Invalid admin console credentials.');
    }
  };

  const fetchAdminUsers = () => {
    fetch('http://localhost:8080/api/admin/users', {
      headers: { 'X-Admin-Password': 'sweet' }
    })
    .then(res => {
      if (!res.ok) throw new Error("Failed to load user list");
      return res.json();
    })
    .then(data => setAdminUsers(data))
    .catch(err => setAdminError(err.message));
  };

  useEffect(() => {
    if (currentPath === '/admin' && isAdminAuthenticated) {
      fetchAdminUsers();
      // Periodically refresh list to see online status changes
      const interval = setInterval(fetchAdminUsers, 5000);
      return () => clearInterval(interval);
    }
  }, [currentPath, isAdminAuthenticated]);

  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    sessionStorage.removeItem('helios_admin_auth');
    navigateTo('/');
  };

  // CRUD Actions
  const handleOpenCreateModal = () => {
    setCrudMode('create');
    setCrudUsername('');
    setCrudEmail('');
    setCrudPassword('');
    setCrudError('');
    setIsCrudModalOpen(true);
  };

  const handleOpenEditModal = (user) => {
    setCrudMode('edit');
    setCrudUserId(user.id);
    setCrudUsername(user.username);
    setCrudEmail(user.email);
    setCrudPassword(user.password);
    setCrudError('');
    setIsCrudModalOpen(true);
  };

  const handleCrudSubmit = (e) => {
    e.preventDefault();
    setCrudError('');

    const url = crudMode === 'create' 
      ? 'http://localhost:8080/api/admin/users'
      : `http://localhost:8080/api/admin/users/${crudUserId}`;
    
    const method = crudMode === 'create' ? 'POST' : 'PUT';

    fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Password': 'sweet'
      },
      body: JSON.stringify({
        username: crudUsername,
        email: crudEmail,
        password: crudPassword
      })
    })
    .then(async res => {
      let data = {};
      try {
        data = await res.json();
      } catch (err) {
        console.warn("Could not parse response as JSON:", err);
      }
      if (!res.ok) throw new Error(data.error || "CRUD Action failed");
      return data;
    })
    .then((savedUser) => {
      // Clear inputs
      setCrudUsername('');
      setCrudEmail('');
      setCrudPassword('');
      setCrudError('');
      setIsCrudModalOpen(false);

      // If the admin edited their own active user details, sync localized state
      if (crudMode === 'edit' && loggedInUser && loggedInUser.id === savedUser.id) {
        const merged = { ...loggedInUser, ...savedUser };
        setLoggedInUser(merged);
        localStorage.setItem('helios_user', JSON.stringify(merged));
      }

      fetchAdminUsers();
    })
    .catch(err => setCrudError(err.message));
  };

  const handleDeleteUser = (id) => {
    if (!window.confirm("Are you sure you want to remove this user from the system database?")) return;

    fetch(`http://localhost:8080/api/admin/users/${id}`, {
      method: 'DELETE',
      headers: { 'X-Admin-Password': 'sweet' }
    })
    .then(async res => {
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Delete failed");
      }
    })
    .then(() => fetchAdminUsers())
    .catch(err => setAdminError(err.message));
  };

  // Helper to format total duration
  const formatTimeSpent = (seconds) => {
    if (!seconds) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    let result = '';
    if (hrs > 0) result += `${hrs}h `;
    if (mins > 0) result += `${mins}m `;
    result += `${secs}s`;
    return result;
  };

  // Helper to check if a user is online (lastActive within 25 seconds)
  const isUserOnline = (lastActive) => {
    if (!lastActive) return false;
    return (Date.now() - lastActive) < 25000;
  };

  // Filter list by search query
  const filteredSatellites = satellites.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.noradId.toString().includes(searchQuery)
  );

  // --- G. RENDER CONTROLS ---

  if (isValidating) {
    return (
      <div className="auth-page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--neon-blue)', fontSize: '18px', fontWeight: 600 }}>
          Validating Security Session...
        </div>
      </div>
    );
  }

  // 1. ADMIN VIEW SCREEN
  if (currentPath === '/admin') {
    if (!isAdminAuthenticated) {
      return (
        <div className="auth-page-container">
          <div className="auth-card">
            <h1 className="auth-title">ADMIN GATEWAY</h1>
            <p className="auth-subtitle">Verify password credentials to access control dashboard.</p>
            {adminError && <div className="auth-error">{adminError}</div>}
            <form onSubmit={handleAdminVerify}>
              <div className="auth-form-group">
                <label>Admin Password</label>
                <input 
                  type="password" 
                  className="auth-input"
                  required
                  placeholder="Enter Password..."
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                />
              </div>
              <button type="submit" className="auth-btn" style={{ width: '100%' }}>Verify Admin</button>
            </form>
            <div className="auth-toggle-text">
              <span className="auth-toggle-link" onClick={() => navigateTo('/')}>← Return to Portal</span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="admin-container">
        <header className="admin-header">
          <div className="admin-title-sec">
            <h1>HELIOS ADMIN CONSOLE</h1>
            <p>Database Management Portal (Active SQL CRUD Interface)</p>
          </div>
          <div className="admin-actions">
            <button className="btn-cyber" onClick={handleOpenCreateModal}>+ Register New User</button>
            <button className="btn-cyber" onClick={() => navigateTo('/')}>Back to Globe</button>
            <button className="btn-profile-logout" onClick={handleAdminLogout}>Exit Console</button>
          </div>
        </header>

        {adminError && <div className="auth-error" style={{ marginBottom: '20px' }}>{adminError}</div>}

        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Username</th>
                <th>Email Address</th>
                <th>System Status</th>
                <th>Primary Interest</th>
                <th>Total Session Duration</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {adminUsers.map(user => (
                <tr key={user.id}>
                  <td>#{user.id}</td>
                  <td style={{ fontWeight: 600 }}>{user.username}</td>
                  <td>{user.email}</td>
                  <td>
                    {isUserOnline(user.lastActive) ? (
                      <span className="status-badge online">● Online</span>
                    ) : (
                      <span className="status-badge offline">Offline</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ color: 'var(--neon-blue)', fontWeight: 600 }}>
                        {user.primaryInterest || 'Unspecified'}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                        Clicks: Station ({user.stationsClicks || 0}) | Weather ({user.weatherClicks || 0}) | Starlink ({user.starlinkClicks || 0}) | GPS ({user.gpsClicks || 0})
                      </span>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{formatTimeSpent(user.totalTimeSpentSeconds)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn-crud edit" onClick={() => handleOpenEditModal(user)}>Edit</button>
                      <button className="btn-crud delete" onClick={() => handleDeleteUser(user.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {adminUsers.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                    No registered accounts found in the database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Modal CRUD Popup Dialog */}
        {isCrudModalOpen && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-header">
                {crudMode === 'create' ? 'Register Database User' : 'Update User Credentials'}
              </div>
              {crudError && <div className="auth-error">{crudError}</div>}
              <form onSubmit={handleCrudSubmit}>
                <div className="auth-form-group">
                  <label>Username</label>
                  <input 
                    type="text" 
                    className="auth-input" 
                    required 
                    value={crudUsername}
                    onChange={(e) => setCrudUsername(e.target.value)}
                  />
                </div>
                <div className="auth-form-group">
                  <label>Email Address</label>
                  <input 
                    type="email" 
                    className="auth-input" 
                    required 
                    value={crudEmail}
                    onChange={(e) => setCrudEmail(e.target.value)}
                  />
                </div>
                <div className="auth-form-group">
                  <label>Password</label>
                  <input 
                    type="password" 
                    className="auth-input" 
                    required={crudMode === 'create'}
                    placeholder={crudMode === 'edit' ? 'Enter new password if updating...' : ''}
                    value={crudPassword}
                    onChange={(e) => setCrudPassword(e.target.value)}
                  />
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn-cyber" onClick={() => setIsCrudModalOpen(false)}>Cancel</button>
                  <button type="submit" className="auth-btn">Save Changes</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. USER AUTHENTICATION SCREEN (LOGIN / SIGNUP)
  if (!loggedInUser) {
    return (
      <div className="auth-page-container">
        <div className="auth-card">
          <h1 className="auth-title">HELIOS SATELLITE PORTAL</h1>
          <p className="auth-subtitle">
            {authMode === 'login' 
              ? 'Welcome back. Sign in to your account.' 
              : 'Register credentials to join orbital telemetry access.'}
          </p>

          {authError && <div className="auth-error">{authError}</div>}

          <form onSubmit={handleAuthSubmit}>
            <div className="auth-form-group">
              <label>Username</label>
              <input 
                type="text" 
                className="auth-input"
                required
                value={authUsername}
                onChange={(e) => setAuthUsername(e.target.value)}
                placeholder="Enter Username"
              />
            </div>

            {authMode === 'signup' && (
              <div className="auth-form-group">
                <label>Email Address</label>
                <input 
                  type="email" 
                  className="auth-input"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="name@domain.com"
                />
              </div>
            )}

            <div className="auth-form-group">
              <label>Password</label>
              <input 
                type="password" 
                className="auth-input"
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="Enter Password"
              />
            </div>

            <button type="submit" className="auth-btn" style={{ width: '100%' }}>
              {authMode === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          </form>

          <div className="auth-toggle-text">
            {authMode === 'login' ? (
              <>
                Don't have an account? 
                <span className="auth-toggle-link" onClick={() => setAuthMode('signup')}>Sign Up</span>
              </>
            ) : (
              <>
                Already have an account? 
                <span className="auth-toggle-link" onClick={() => setAuthMode('login')}>Sign In</span>
              </>
            )}
          </div>

        </div>
      </div>
    );
  }

  // 3. MAIN SATELLITE GLOBE DASHBOARD
  return (
    <div className="app-container">
      {/* 3D Earth Canvas */}
      <CesiumGlobe 
        satellites={satellites}
        selectedSatellite={isCameraLocked ? selectedSatellite : null}
        onSelectSatellite={handleSelectSatellite}
        isSpinning={isSpinning}
        showOrbits={showOrbits}
      />

      {/* Top Banner Overlay */}
      <header className="header-overlay glass-panel">
        <div className="logo-section">
          <Globe className="logo-icon animate-spin" size={22} style={{ animationDuration: '20s' }} />
          <h1>Project Helios</h1>
          <span>V1.0</span>
          
          {/* User Session Profile display */}
          <div className="header-profile-section">
            <span className="text-secondary" style={{ fontSize: '12px' }}>User:</span>
            <span className="profile-username" style={{ fontSize: '13px', color: 'var(--neon-blue)' }}>{loggedInUser.username}</span>
            <button className="btn-profile-logout" onClick={handleLogout}>Logout</button>
          </div>
        </div>
        
        <div className="header-stats">
          <div className="stat-item">
            <Activity className="text-secondary" size={14} />
            <span className="text-secondary">Satellites Tracked:</span>
            <span className="glow-text-green text-green" style={{ color: 'var(--neon-green)' }}>
              {satellites.length}
            </span>
          </div>
          <div className="stat-item">
            <Clock className="text-secondary" size={14} />
            <span style={{ color: 'var(--neon-blue)' }}>{utcTime}</span>
          </div>
          <div className="stat-item">
            <div className="status-dot"></div>
            <span style={{ color: '#fff' }}>SYSTEM OK</span>
          </div>
        </div>
      </header>

      {/* Left Sidebar Overlay */}
      <aside className="left-sidebar glass-panel">
        <div>
          <div className="widget-title">
            <Cpu size={14} />
            <span>Search &amp; Filters</span>
          </div>
          <div className="control-group" style={{ marginBottom: '15px' }}>
            <div className="input-container" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search style={{ position: 'absolute', left: '10px', color: 'var(--text-secondary)' }} size={14} />
              <input 
                type="text" 
                placeholder="Search Satellites..." 
                className="input-cyber" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '32px', width: '100%' }}
              />
            </div>
          </div>

          <div className="control-group">
            <span className="control-label">Satellite Category</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button 
                onClick={() => handleCategorySelect('stations')}
                className={`btn-cyber ${selectedGroup === 'stations' ? 'active' : ''}`}
              >
                Space Stations
              </button>
              <button 
                onClick={() => handleCategorySelect('weather')}
                className={`btn-cyber ${selectedGroup === 'weather' ? 'active' : ''}`}
              >
                Weather
              </button>
              <button 
                onClick={() => handleCategorySelect('starlink')}
                className={`btn-cyber ${selectedGroup === 'starlink' ? 'active' : ''}`}
              >
                Starlink
              </button>
              <button 
                onClick={() => handleCategorySelect('gps')}
                className={`btn-cyber ${selectedGroup === 'gps' ? 'active' : ''}`}
              >
                GPS
              </button>
            </div>
          </div>
        </div>

        <div>
          <div className="widget-title">
            <Compass size={14} />
            <span>Simulation Parameters</span>
          </div>
          <div className="control-group" style={{ gap: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px' }}>
              <input 
                type="checkbox" 
                checked={isSpinning} 
                onChange={(e) => setIsSpinning(e.target.checked)}
                style={{ accentColor: 'var(--neon-blue)' }}
              />
              <span>Earth Real-Time Spin</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px' }}>
              <input 
                type="checkbox" 
                checked={showOrbits} 
                onChange={(e) => setShowOrbits(e.target.checked)}
                style={{ accentColor: 'var(--neon-blue)' }}
              />
              <span>Draw Orbital ground tracks</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px' }}>
              <input 
                type="checkbox" 
                disabled={!selectedSatellite}
                checked={isCameraLocked} 
                onChange={(e) => setIsCameraLocked(e.target.checked)}
                style={{ accentColor: 'var(--neon-blue)' }}
              />
              <span style={{ opacity: selectedSatellite ? 1 : 0.5 }}>Lock camera tracking</span>
            </label>
            
            <button 
              onClick={handleRefreshCache} 
              disabled={isRefreshing}
              className="btn-cyber" 
              style={{ marginTop: '5px' }}
            >
              <RefreshCw className={isRefreshing ? 'animate-spin' : ''} size={14} />
              <span>{isRefreshing ? 'Syncing...' : 'Sync TLE Database'}</span>
            </button>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '150px' }}>
          <div className="widget-title">
            <SatIcon size={14} />
            <span>Satellite Roster ({filteredSatellites.length})</span>
          </div>
          <div className="satellite-list" style={{ flex: 1 }}>
            {filteredSatellites.map(sat => (
              <div 
                key={sat.noradId} 
                onClick={() => handleSelectSatellite(sat)}
                className={`satellite-item ${selectedSatellite?.noradId === sat.noradId ? 'selected' : ''}`}
              >
                <span className="sat-name">{sat.name}</span>
                <span className="sat-id">#{sat.noradId}</span>
              </div>
            ))}
            {filteredSatellites.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px', padding: '20px' }}>
                No Satellites Found
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Right Sidebar Overlay */}
      <aside className="right-sidebar glass-panel">
        {selectedSatellite ? (
          <>
            <div>
              <div className="widget-title">
                <Navigation size={14} />
                <span>Spatial Telemetry</span>
              </div>
              <div className="telemetry-grid">
                <div className="telemetry-card">
                  <div className="telemetry-label">Latitude</div>
                  <div className="telemetry-value">{selectedSatellite.latitude.toFixed(4)}°</div>
                </div>
                <div className="telemetry-card">
                  <div className="telemetry-label">Longitude</div>
                  <div className="telemetry-value">{selectedSatellite.longitude.toFixed(4)}°</div>
                </div>
                <div className="telemetry-card">
                  <div className="telemetry-label">Altitude</div>
                  <div className="telemetry-value">{selectedSatellite.altitude.toFixed(2)} km</div>
                </div>
                <div className="telemetry-card">
                  <div className="telemetry-label">Velocity</div>
                  <div className="telemetry-value">{selectedSatellite.velocity.toFixed(3)} km/s</div>
                </div>
                <div className="telemetry-card">
                  <div className="telemetry-label">Orbital Period</div>
                  <div className="telemetry-value">{selectedSatellite.period.toFixed(1)} min</div>
                </div>
                <div className="telemetry-card">
                  <div className="telemetry-label">Norad ID</div>
                  <div className="telemetry-value" style={{ color: 'var(--neon-blue)' }}>#{selectedSatellite.noradId}</div>
                </div>
              </div>
            </div>

            <div>
              <div className="widget-title">
                <CloudRain size={14} />
                <span>Sub-Satellite Weather</span>
              </div>
              {weather && weather.main ? (
                <div className="weather-details">
                  <div className="weather-row">
                    <span className="text-secondary">Position Name:</span>
                    <span className="weather-val" style={{ color: '#fff' }}>{weather.name || 'Over Water'}</span>
                  </div>
                  <div className="weather-row">
                    <span className="text-secondary">Temperature:</span>
                    <span className="weather-val">{weather.main.temp} °C</span>
                  </div>
                  <div className="weather-row">
                    <span className="text-secondary">Humidity:</span>
                    <span className="weather-val">{weather.main.humidity}%</span>
                  </div>
                  <div className="weather-row">
                    <span className="text-secondary">Wind Velocity:</span>
                    <span className="weather-val">{weather.wind?.speed} m/s</span>
                  </div>
                  <div className="weather-row">
                    <span className="text-secondary">Cloud Cover:</span>
                    <span className="weather-val">{weather.clouds?.all}%</span>
                  </div>
                  <div className="weather-row">
                    <span className="text-secondary">Condition:</span>
                    <span className="weather-val" style={{ textTransform: 'capitalize' }}>
                      {weather.weather?.[0]?.description}
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                  Loading meteorological data...
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Compass size={40} className="text-secondary animate-bounce" style={{ marginBottom: '12px' }} />
            <p style={{ fontWeight: 600, fontSize: '14px', color: '#fff' }}>NO ACTIVE SATELLITE SELECTED</p>
            <p style={{ fontSize: '11px', padding: '0 20px', marginTop: '6px' }}>
              Select a satellite from the roster on the left or click on the 3D globe to lock tracking telemetry.
            </p>
          </div>
        )}
      </aside>

      {/* Bottom Panel Overlay */}
      <footer className="bottom-overlay glass-panel">
        {/* NASA APOD Section */}
        <div style={{ overflow: 'hidden' }}>
          <div className="widget-title" style={{ marginBottom: '8px' }}>
            <Sun size={14} />
            <span>NASA Space Intel (APOD Picture)</span>
          </div>
          {apod ? (
            <div className="apod-content">
              {apod.url && (
                <img 
                  src={apod.url} 
                  alt={apod.title} 
                  className="apod-img"
                  onClick={() => window.open(apod.hdurl || apod.url, '_blank')}
                  style={{ cursor: 'zoom-in' }}
                />
              )}
              <div className="apod-info">
                <div className="apod-title">{apod.title}</div>
                <div className="apod-desc">{apod.explanation}</div>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
              Loading NASA deep space feed...
            </div>
          )}
        </div>

        {/* USNO Rise/Set Timetable */}
        <div>
          <div className="widget-title" style={{ marginBottom: '8px' }}>
            <Moon size={14} />
            <span>Sub-Satellite Astronomical Timetable</span>
          </div>
          <div className="astronomy-widget">
            {astronomy && astronomy.properties && Array.isArray(astronomy.properties.data) ? (
              <div className="astro-times">
                {astronomy.properties.data.slice(0, 4).map((item, idx) => {
                  let label = item.phen;
                  if (item.phen === 'R') label = 'Rise';
                  if (item.phen === 'S') label = 'Set';
                  if (item.phen === 'U') label = 'Transit';
                  
                  return (
                    <div className="astro-time-box" key={idx}>
                      <span className="astro-time-lbl">{item.body} {label}</span>
                      <span className="astro-time-val">{item.time}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px', textAlign: 'center', padding: '15px' }}>
                {selectedSatellite ? 'Computing rise/set cycles...' : 'Awaiting tracking lock...'}
              </div>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
