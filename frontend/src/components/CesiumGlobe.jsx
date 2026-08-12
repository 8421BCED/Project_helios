import React, { useEffect, useRef, useState } from 'react';

// Helper function to interpolate satellite positions smoothly in the Earth-Fixed frame
function getInterpolatedPosition(sat, time, result) {
  const Cesium = window.Cesium;
  if (!sat) {
    return Cesium.Cartesian3.ZERO;
  }
  if (!sat.groundTrack || sat.groundTrack.length === 0) {
    return Cesium.Cartesian3.fromDegrees(
      sat.longitude || 0, 
      sat.latitude || 0, 
      (sat.altitude || 0) * 1000, 
      Cesium.Ellipsoid.WGS84, 
      result
    );
  }

  const baseTime = sat.baseTimeJulian || Cesium.JulianDate.fromDate(new Date());
  const elapsedSeconds = Cesium.JulianDate.secondsDifference(time, baseTime);

  // Clip elapsed seconds to be at least 0 (in case of minor network latency / clock skew)
  const safeElapsed = Math.max(0, elapsedSeconds);

  const periodMin = sat.period || 90.0;
  const totalDurationSeconds = periodMin * 60;
  const stepSeconds = totalDurationSeconds / sat.groundTrack.length;

  const fractionalStep = safeElapsed / stepSeconds;
  const index = Math.floor(fractionalStep);
  
  if (index < 0) {
    const pt = sat.groundTrack[0];
    return Cesium.Cartesian3.fromDegrees(pt[1], pt[0], pt[2] * 1000, Cesium.Ellipsoid.WGS84, result);
  }
  if (index >= sat.groundTrack.length - 1) {
    const pt = sat.groundTrack[sat.groundTrack.length - 1];
    return Cesium.Cartesian3.fromDegrees(pt[1], pt[0], pt[2] * 1000, Cesium.Ellipsoid.WGS84, result);
  }

  const pt1 = sat.groundTrack[index];
  const pt2 = sat.groundTrack[index + 1];

  const alpha = fractionalStep - index;

  // Handle longitude wrap-around at the International Date Line
  let lon1 = pt1[1];
  let lon2 = pt2[1];
  if (lon2 - lon1 > 180) {
    lon1 += 360;
  } else if (lon1 - lon2 > 180) {
    lon2 += 360;
  }

  const lon = lon1 + alpha * (lon2 - lon1);
  const lat = pt1[0] + alpha * (pt2[0] - pt1[0]);
  const alt = pt1[2] + alpha * (pt2[2] - pt1[2]);

  // Normalize longitude to [-180, 180] range
  let finalLon = (lon + 180) % 360;
  if (finalLon < 0) {
    finalLon += 360;
  }
  finalLon -= 180;

  return Cesium.Cartesian3.fromDegrees(finalLon, lat, alt * 1000, Cesium.Ellipsoid.WGS84, result);
}

export default function CesiumGlobe({
  satellites,
  selectedSatellite,
  onSelectSatellite,
  isSpinning,
  showOrbits
}) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const entitiesMapRef = useRef(new Map()); // Maps noradId -> Entity
  const orbitPathEntityRef = useRef(null); // Selected orbit path entity
  const prevSelectedIdRef = useRef(null); // Keep track of previous selection to revert styles
  const satellitesRef = useRef([]); // Ref to avoid stale closures in selection Hook
  const selectedSatelliteRef = useRef(null); // Ref to avoid stale closures and linter dependency warnings
  const activeCloudsRef = useRef([]); // Reference to hold moving volumetric cloud items
  const [isViewerReady, setIsViewerReady] = useState(false);

  // Keep refs updated
  useEffect(() => {
    satellitesRef.current = satellites;
    selectedSatelliteRef.current = selectedSatellite;
  }, [satellites, selectedSatellite]);

  // 1. Initialize Cesium Viewer asynchronously
  useEffect(() => {
    if (!containerRef.current) return;

    const Cesium = window.Cesium;
    if (!Cesium) {
      console.error("CesiumJS CDN not loaded yet.");
      return;
    }

    let viewer = null;
    const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN || "";
    if (ionToken) {
      Cesium.Ion.defaultAccessToken = ionToken;
    }

    // Load HD ArcGIS imagery asynchronously first
    Cesium.ArcGisMapServerImageryProvider.fromUrl(
      'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'
    ).then(provider => {
      initializeViewer(provider);
    }).catch(err => {
      console.error("Failed to load ArcGIS imagery. Falling back to OpenStreetMap...", err);
      Cesium.OpenStreetMapImageryProvider.fromUrl('https://tile.openstreetmap.org/').then(osmProvider => {
        initializeViewer(osmProvider);
      }).catch(osmErr => {
        console.error("OSM fallback also failed. Initializing default viewer...", osmErr);
        initializeViewer(null);
      });
    });

    function initializeViewer(imageryProvider) {
      if (!containerRef.current) return;

      const viewerOptions = {
        animation: false,
        timeline: false,
        baseLayerPicker: false,
        geocoder: false,
        navigationHelpButton: false,
        infoBox: false,
        selectionIndicator: false,
        sceneModePicker: true,
        homeButton: false,
        fullscreenButton: false,
        vrButton: false
      };

      // Set base layer at construction time to prevent getDerivedResource error on zoom
      if (imageryProvider) {
        viewerOptions.baseLayer = new Cesium.ImageryLayer(imageryProvider);
      } else {
        viewerOptions.baseLayer = false; // Disable default Ion to prevent 401s
      }

      viewer = new Cesium.Viewer(containerRef.current, viewerOptions);

      // Add 3D Terrain and 3D Osm Buildings if Ion Token is provided
      if (ionToken) {
        Cesium.createWorldTerrainAsync().then(terrainProvider => {
          viewer.terrainProvider = terrainProvider;
        }).catch(e => console.error("Terrain load failed:", e));

        Cesium.createOsmBuildingsAsync().then(osmBuildings => {
          viewer.scene.primitives.add(osmBuildings);
        }).catch(e => console.error("OSM Buildings load failed:", e));
      }

      // Dark sci-fi styling overrides for Cesium UI
      viewer.scene.globe.enableLighting = true;
      viewer.scene.globe.showWaterEffect = true;
      viewer.scene.globe.depthTestAgainstTerrain = false;

      // Realistic Atmosphere and Ambient space shading (beautiful dark-blue night glow)
      viewer.scene.globe.showGroundAtmosphere = true;
      viewer.scene.skyAtmosphere.show = true;
      viewer.scene.globe.ambienceColor = new Cesium.Color(0.02, 0.05, 0.12, 1.0);

      // Real-time Day/Night Shading clock synchronization
      viewer.clock.currentTime = Cesium.JulianDate.fromDate(new Date());
      viewer.clock.multiplier = 1.0;
      viewer.clock.shouldAnimate = true;

      // Render Sun/Moon and use SunLight direction for realistic earth shadows
      viewer.scene.sun.show = true;
      viewer.scene.sun.glowFactor = 2.0;
      viewer.scene.moon.show = true;
      viewer.scene.light = new Cesium.SunLight();

      // Clean credit container info display
      if (viewer.creditContainer) {
        viewer.creditContainer.style.display = 'none';
      }

      // Initialize moving clouds using a BillboardCollection of realistic, fluffy cloud textures
      const billboardCollection = viewer.scene.primitives.add(new Cesium.BillboardCollection());
      const tempClouds = [];
      const cloudImageUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Cloud_PNG_Image.png/640px-Cloud_PNG_Image.png';

      // Spawn 60 procedural moving clouds around the globe
      for (let i = 0; i < 60; i++) {
        const lat = (Math.random() * 140) - 70; // Avoid extreme poles
        const lon = (Math.random() * 360) - 180;
        const height = 4000 + Math.random() * 5000; // 4km to 9km altitude

        const size = 150000 + Math.random() * 200000; // Physical size in meters
        const aspect = 0.5 + Math.random() * 0.5;

        const cloud = billboardCollection.add({
          position: Cesium.Cartesian3.fromDegrees(lon, lat, height),
          image: cloudImageUrl,
          width: size,
          height: size * aspect,
          sizeInMeters: true, // Scale physically on the globe
          rotation: Math.random() * Math.PI * 2, // Random rotation makes them look distinct
          color: new Cesium.Color(1.0, 1.0, 1.0, 0.45) // Soft semi-transparency
        });

        // Set wind velocity drift values (radians per frame)
        const speedLon = (0.000002 + Math.random() * 0.000004);
        const speedLat = (Math.random() * 0.0000016 - 0.0000008);

        tempClouds.push({ cloud, speedLon, speedLat });
      }
      activeCloudsRef.current = tempClouds;

      // Real-Time Stars rendering

      // Named Stars in ECI frame
      const starsData = [
        { name: "Sirius (Alpha Canis Majoris)", ra: 6.75, dec: -16.72, color: '#8ad3ff' },
        { name: "Polaris (North Star)", ra: 2.53, dec: 89.26, color: '#ffffff' },
        { name: "Vega (Alpha Lyrae)", ra: 18.62, dec: 38.78, color: '#a3d8ff' },
        { name: "Betelgeuse (Alpha Orionis)", ra: 5.92, dec: 7.41, color: '#ffb07c' },
        { name: "Rigel (Beta Orionis)", ra: 5.25, dec: -8.20, color: '#8af0ff' },
        { name: "Altair (Alpha Aquilae)", ra: 19.85, dec: 8.87, color: '#ffffff' },
        { name: "Procyon (Alpha Canis Minoris)", ra: 7.66, dec: 5.22, color: '#fffae0' }
      ];

      const starDistance = 800000000;

      starsData.forEach(star => {
        const raRad = star.ra * (Math.PI / 12);
        const decRad = star.dec * (Math.PI / 180);
        const x = Math.cos(decRad) * Math.cos(raRad);
        const y = Math.cos(decRad) * Math.sin(raRad);
        const z = Math.sin(decRad);
        const eciPos = new Cesium.Cartesian3(x * starDistance, y * starDistance, z * starDistance);

        const positionProperty = new Cesium.CallbackProperty((time, result) => {
          const matrix = Cesium.Transforms.computeIcrfToFixedMatrix(time);
          if (Cesium.defined(matrix)) {
            return Cesium.Matrix3.multiplyByVector(matrix, eciPos, result);
          }
          return eciPos;
        }, false);

        viewer.entities.add({
          name: star.name,
          position: positionProperty,
          point: {
            pixelSize: 6,
            color: Cesium.Color.fromCssColorString(star.color),
            outlineColor: Cesium.Color.WHITE.withAlpha(0.5),
            outlineWidth: 1
          },
          label: {
            text: star.name.toUpperCase(),
            font: '10px Share Tech Mono',
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            fillColor: Cesium.Color.WHITE.withAlpha(0.7),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 1.5,
            pixelOffset: new Cesium.Cartesian2(0, -12),
            horizontalOrigin: Cesium.HorizontalOrigin.CENTER
          }
        });
      });

      viewerRef.current = viewer;
      setIsViewerReady(true);
    }

    // 2. Set up click handler for choosing satellites on the globe
    let handler;
    const setupClickEvent = () => {
      if (!viewer) return;
      handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((click) => {
        const pickedObject = viewer.scene.pick(click.position);
        if (Cesium.defined(pickedObject) && pickedObject.id) {
          const entityId = pickedObject.id.id; // Entity ID is NORAD ID
          window._onGlobeClick?.(entityId);
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    };

    // Wait for viewer initialization to bind handlers
    const checkInterval = setInterval(() => {
      if (viewer) {
        setupClickEvent();
        clearInterval(checkInterval);
      }
    }, 100);

    return () => {
      clearInterval(checkInterval);
      if (handler && !handler.isDestroyed()) handler.destroy();
      if (viewer && !viewer.isDestroyed()) {
        viewer.destroy();
      }
    };
  }, []);

  // Make click handler accessible globally
  useEffect(() => {
    window._onGlobeClick = (entityId) => {
      const found = satellitesRef.current.find(s => s.noradId.toString() === entityId);
      if (found) {
        onSelectSatellite(found);
      }
    };
  }, [onSelectSatellite]);

  // 3. Handle Auto-Rotation (Earth Spin) and Cloud Drift using preUpdate event
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !isViewerReady) return;

    const Cesium = window.Cesium;
    
    const animateScene = () => {
      // 1. Rotate the globe
      if (isSpinning) {
        viewer.camera.rotate(Cesium.Cartesian3.UNIT_Z, 0.0003);
      }

      // 2. Animate volumetric clouds moving in real-time
      const activeClouds = activeCloudsRef.current;
      if (activeClouds && activeClouds.length > 0) {
        for (let i = 0; i < activeClouds.length; i++) {
          const item = activeClouds[i];
          const cloud = item.cloud;

          // Convert current ECEF position to Cartographic radians
          const cartographic = Cesium.Cartographic.fromCartesian(cloud.position);

          // Update position coordinate by drift speed
          let newLon = cartographic.longitude + item.speedLon;
          let newLat = cartographic.latitude + item.speedLat;

          // Wrap longitude around bounds [-PI, PI]
          if (newLon > Math.PI) newLon -= 2 * Math.PI;
          if (newLon < -Math.PI) newLon += 2 * Math.PI;

          // Re-assign position in-place
          cloud.position = Cesium.Cartesian3.fromRadians(newLon, newLat, cartographic.height);
        }
      }
    };

    viewer.scene.preUpdate.addEventListener(animateScene);
    return () => {
      if (viewer && !viewer.isDestroyed()) {
        viewer.scene.preUpdate.removeEventListener(animateScene);
      }
    };
  }, [isSpinning, isViewerReady]);

  // 4. Update Positions (runs on coordinate update loop - extremely lightweight!)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !isViewerReady) return;

    const Cesium = window.Cesium;
    const currentNoradIds = new Set(satellites.map(s => s.noradId.toString()));
    const renderedMap = entitiesMapRef.current;

    // Remove entities no longer present in incoming data
    renderedMap.forEach((entity, id) => {
      if (!currentNoradIds.has(id)) {
        viewer.entities.remove(entity);
        renderedMap.delete(id);
      }
    });

    const baseTimeJulian = Cesium.JulianDate.fromDate(new Date());

    // Add or update active satellites
    satellites.forEach(sat => {
      const idStr = sat.noradId.toString();
      const isSelected = selectedSatellite && selectedSatellite.noradId === sat.noradId;
      const isIss = sat.name.toUpperCase().includes('ISS') || sat.name.toUpperCase().includes('ZARYA');

      const modelUri = isSelected && isIss
        ? 'https://cdn.jsdelivr.net/gh/srcejon/sdrangel-3d-models@main/iss.glb'
        : undefined;

      const satWithTime = { ...sat, baseTimeJulian };
      let entity = renderedMap.get(idStr);

      if (!entity) {
        // Create new satellite entity using a CallbackProperty for perfect 60fps real-time interpolation
        const positionProperty = new Cesium.CallbackProperty((time, result) => {
          const currentEntity = renderedMap.get(idStr);
          const activeSat = currentEntity ? currentEntity._latestSat : satWithTime;
          return getInterpolatedPosition(activeSat, time, result);
        }, false);

        entity = viewer.entities.add({
          id: idStr,
          position: positionProperty,
          orientation: new Cesium.VelocityOrientationProperty(positionProperty),
          point: {
            pixelSize: isSelected ? 12 : 8,
            color: isSelected ? Cesium.Color.fromCssColorString('#ff9d00') : Cesium.Color.fromCssColorString('#39ff14'),
            outlineColor: isSelected ? Cesium.Color.fromCssColorString('#fff') : Cesium.Color.fromCssColorString('#00f0ff'),
            outlineWidth: 2,
            show: !modelUri // Hide the dot if selected and 3D model is showing
          },
          model: modelUri ? {
            uri: modelUri,
            minimumPixelSize: 64,
            maximumScale: 10000
          } : undefined,
          label: {
            text: sat.name,
            font: '11px Share Tech Mono',
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            pixelOffset: new Cesium.Cartesian2(0, -20),
            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
            show: isSelected || satellites.length < 5
          }
        });
        entity._latestSat = satWithTime;
        entity._modelUri = modelUri;
        renderedMap.set(idStr, entity);
      } else {
        // Update the cached data reference for the interpolation callback instantly
        entity._latestSat = satWithTime;

        // Update selected visual states dynamically
        if (isSelected) {
          if (modelUri) {
            if (entity._modelUri !== modelUri) {
              entity.model = new Cesium.ModelGraphics({
                uri: modelUri,
                minimumPixelSize: 64,
                maximumScale: 10000
              });
              entity._modelUri = modelUri;
            }
            entity.point.show.setValue(false);
          } else {
            entity.model = undefined;
            entity._modelUri = undefined;
            entity.point.show.setValue(true);
            entity.point.pixelSize.setValue(12);
            entity.point.color.setValue(Cesium.Color.fromCssColorString('#ff9d00'));
            entity.point.outlineColor.setValue(Cesium.Color.fromCssColorString('#fff'));
          }
        } else {
          entity.model = undefined;
          entity._modelUri = undefined;
          entity.point.show.setValue(true);
          entity.point.pixelSize.setValue(8);
          entity.point.color.setValue(Cesium.Color.fromCssColorString('#39ff14'));
          entity.point.outlineColor.setValue(Cesium.Color.fromCssColorString('#00f0ff'));
        }
      }
    });
  }, [satellites, selectedSatellite, isViewerReady]);

  // 5. Update Selection Styles and Camera flyTo (runs only when selection changes)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !isViewerReady) return;

    const Cesium = window.Cesium;
    const renderedMap = entitiesMapRef.current;

    // Revert previous selected styling
    if (prevSelectedIdRef.current) {
      const prevEntity = renderedMap.get(prevSelectedIdRef.current);
      if (prevEntity) {
        prevEntity.point.pixelSize.setValue(8);
        prevEntity.point.color.setValue(Cesium.Color.fromCssColorString('#39ff14'));
        prevEntity.point.outlineColor.setValue(Cesium.Color.fromCssColorString('#00f0ff'));
        prevEntity.point.show.setValue(true);
        prevEntity.model = undefined;
        prevEntity.label.show.setValue(satellitesRef.current.length < 5);
      }
    }

    // Apply new selected styling
    const currentSelected = selectedSatelliteRef.current;
    if (currentSelected) {
      const idStr = currentSelected.noradId.toString();
      const entity = renderedMap.get(idStr);
      if (entity) {
        const isIss = currentSelected.name.toUpperCase().includes('ISS') || currentSelected.name.toUpperCase().includes('ZARYA');
        const expectedModelUri = isIss
          ? 'https://cdn.jsdelivr.net/gh/srcejon/sdrangel-3d-models@main/iss.glb'
          : undefined;

        if (expectedModelUri) {
          entity.point.show.setValue(false);
          if (entity._modelUri !== expectedModelUri) {
            entity.model = new Cesium.ModelGraphics({
              uri: expectedModelUri,
              minimumPixelSize: 64,
              maximumScale: 10000
            });
            entity._modelUri = expectedModelUri;
          }
        } else {
          entity.model = undefined;
          entity._modelUri = undefined;
          entity.point.show.setValue(true);
          entity.point.pixelSize.setValue(12);
          entity.point.color.setValue(Cesium.Color.fromCssColorString('#ff9d00'));
          entity.point.outlineColor.setValue(Cesium.Color.fromCssColorString('#fff'));
        }
        entity.label.show.setValue(true);
        
        // Fly to the satellite once when selected, but do NOT lock the camera tracking.
        // This allows the satellite to fly freely across the screen and the Earth to rotate.
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(
            currentSelected.longitude,
            currentSelected.latitude,
            (currentSelected.altitude + 6000) * 1000
          ),
          duration: 2.0
        });
      }
      prevSelectedIdRef.current = idStr;
    }
  }, [selectedSatellite?.noradId, isViewerReady]);

  // 6. Draw Selected Orbit Polyline Ground Track (updates in-real-time without flickering)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !isViewerReady) return;

    const Cesium = window.Cesium;

    // If orbits are disabled or selection is cleared, remove the orbit polyline
    if (!showOrbits || !selectedSatellite || !selectedSatellite.groundTrack) {
      if (orbitPathEntityRef.current) {
        viewer.entities.remove(orbitPathEntityRef.current);
        orbitPathEntityRef.current = null;
      }
      return;
    }

    const positions = selectedSatellite.groundTrack.map(pt => 
      Cesium.Cartesian3.fromDegrees(pt[1], pt[0], pt[2] * 1000)
    );

    if (positions.length > 0) {
      if (!orbitPathEntityRef.current) {
        // Create the polyline entity if it doesn't exist
        orbitPathEntityRef.current = viewer.entities.add({
          polyline: {
            positions: positions,
            width: 2.5,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.25,
              color: Cesium.Color.fromCssColorString('#bd00ff')
            }),
            loop: true
          }
        });
      } else {
        // Update positions in-place without removing/re-adding the entity!
        if (orbitPathEntityRef.current.polyline.positions.setValue) {
          orbitPathEntityRef.current.polyline.positions.setValue(positions);
        } else {
          orbitPathEntityRef.current.polyline.positions = positions;
        }
      }
    }
    return () => {
      if (viewer && !viewer.isDestroyed() && orbitPathEntityRef.current) {
        viewer.entities.remove(orbitPathEntityRef.current);
        orbitPathEntityRef.current = null;
      }
    };
  }, [selectedSatellite, showOrbits, isViewerReady]);

  return (
    <div className="globe-container" ref={containerRef} />
  );
}
