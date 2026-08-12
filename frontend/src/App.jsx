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
  // 1. Telemetry and Selection States
  const [selectedGroup, setSelectedGroup] = useState('stations');
  const [satellites, setSatellites] = useState([]);
  const [selectedSatellite, setSelectedSatellite] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // 2. Control Flags
  const [isSpinning, setIsSpinning] = useState(true);
  const [showOrbits, setShowOrbits] = useState(true);
  const [isCameraLocked, setIsCameraLocked] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // 3. Coordinate-Dependent External States
  const [weather, setWeather] = useState(null);
  const [astronomy, setAstronomy] = useState(null);
  const [apod, setApod] = useState(null);
  
  // 4. Live Clock State
  const [utcTime, setUtcTime] = useState(new Date().toUTCString());

  // Keep a ref to the selected satellite NORAD ID to survive state updates during the setInterval loop
  const selectedNoradIdRef = useRef(null);
  const lastFetchedCoordsRef = useRef({ lat: null, lon: null });
  const liveCoordsRef = useRef({ lat: null, lon: null });

  // Update Live clock
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

  // Periodic Telemetry Loop - updates satellite coordinates every 2.5 seconds
  useEffect(() => {
    const fetchSatellites = () => {
      fetch(`http://localhost:8080/api/satellites/${selectedGroup}`)
        .then(res => res.json())
        .then(data => {
          setSatellites(data);
          
          // Re-align the selected satellite reference with the fresh coordinates from backend
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
  }, [selectedGroup]);

  // Weather & Astronomy fetcher with coordinate-movement threshold caching
  const fetchLocationMetadata = (lat, lon, force = false) => {
    if (lat === null || lon === null) return;

    // Only query weather/astronomy if moved more than 2.0 degrees (approx 220km) to avoid rate limits / IP ban
    if (!force && lastFetchedCoordsRef.current.lat !== null) {
      const dLat = Math.abs(lat - lastFetchedCoordsRef.current.lat);
      const dLon = Math.abs(lon - lastFetchedCoordsRef.current.lon);
      if (dLat < 2.0 && dLon < 2.0) {
        return; // Skip API request to save IP rate limits
      }
    }

    lastFetchedCoordsRef.current = { lat, lon };

    // 1. Weather
    fetch(`http://localhost:8080/api/weather?lat=${lat}&lon=${lon}`)
      .then(res => res.json())
      .then(data => setWeather(data))
      .catch(err => console.error("Error fetching weather:", err));

    // 2. Astronomy
    fetch(`http://localhost:8080/api/astronomy?coords=${lat},${lon}`)
      .then(res => res.json())
      .then(data => setAstronomy(data))
      .catch(err => console.error("Error fetching astronomy:", err));
  };

  // Handle selection updates
  const handleSelectSatellite = (sat) => {
    if (sat) {
      selectedNoradIdRef.current = sat.noradId;
      setSelectedSatellite(sat);
      liveCoordsRef.current = { lat: sat.latitude, lon: sat.longitude };
      // Instantly load weather and astronomy for new coordinates (force fetch)
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

  // Fetch updates for weather/astronomy on a slower background interval when satellite moves
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

  // Sync TLE local cache manually
  const handleRefreshCache = () => {
    setIsRefreshing(true);
    fetch('http://localhost:8080/api/satellites/refresh', { method: 'POST' })
      .then(res => res.json())
      .then(() => {
        // Fetch current group again immediately
        return fetch(`http://localhost:8080/api/satellites/${selectedGroup}`);
      })
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

  // Filter list by search query
  const filteredSatellites = satellites.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.noradId.toString().includes(searchQuery)
  );

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
                onClick={() => { setSelectedGroup('stations'); handleSelectSatellite(null); }}
                className={`btn-cyber ${selectedGroup === 'stations' ? 'active' : ''}`}
              >
                Space Stations
              </button>
              <button 
                onClick={() => { setSelectedGroup('weather'); handleSelectSatellite(null); }}
                className={`btn-cyber ${selectedGroup === 'weather' ? 'active' : ''}`}
              >
                Weather
              </button>
              <button 
                onClick={() => { setSelectedGroup('starlink'); handleSelectSatellite(null); }}
                className={`btn-cyber ${selectedGroup === 'starlink' ? 'active' : ''}`}
              >
                Starlink
              </button>
              <button 
                onClick={() => { setSelectedGroup('gps'); handleSelectSatellite(null); }}
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
