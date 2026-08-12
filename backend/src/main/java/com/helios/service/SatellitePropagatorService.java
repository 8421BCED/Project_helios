package com.helios.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.helios.model.SatelliteData;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import uk.me.g4dpz.satellite.*;

import jakarta.annotation.PostConstruct;
import java.io.File;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class SatellitePropagatorService {

    private static final Logger log = LoggerFactory.getLogger(SatellitePropagatorService.class);
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${helios.storage-path}")
    private String storagePath;

    // Cache in memory: Group Name -> List of SatelliteData
    private final Map<String, List<SatelliteData>> cachedSatellites = new ConcurrentHashMap<>();
    
    // Last fetch timestamp
    private long lastFetchTime = 0;
    private static final long CACHE_DURATION_MS = 3600_000; // 1 hour

    // CelesTrak TLE endpoints
    private static final Map<String, String> GROUP_URLS = Map.of(
            "stations", "https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle",
            "weather", "https://celestrak.org/NORAD/elements/gp.php?GROUP=weather&FORMAT=tle",
            "starlink", "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle",
            "gps", "https://celestrak.org/NORAD/elements/gp.php?GROUP=gps&FORMAT=tle"
    );

    // Dummy ground station at coordinates (0, 0, 0) just to satisfy predict4java getPosition signature
    private final GroundStationPosition dummyStation = new GroundStationPosition(0.0, 0.0, 0.0);

    public SatellitePropagatorService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    @PostConstruct
    public void init() {
        // Try loading from local storage first
        loadFromLocalStorage();
        if (cachedSatellites.isEmpty()) {
            log.info("No local satellite data found. Seeding default satellites...");
            seedDefaultSatellites();
        }
    }

    /**
     * Gets real-time positions for all satellites in a specific group.
     */
    public List<SatelliteData> getPropagatedSatellites(String group) {
        // Auto-refresh cache if needed
        if (System.currentTimeMillis() - lastFetchTime > CACHE_DURATION_MS) {
            refreshSatelliteDataAsync();
        }

        List<SatelliteData> rawList = cachedSatellites.get(group.toLowerCase());
        if (rawList == null) {
            return Collections.emptyList();
        }

        List<SatelliteData> propagatedList = new ArrayList<>();
        Date now = new Date();

        for (SatelliteData sat : rawList) {
            try {
                TLE tle = new TLE(new String[]{sat.getName(), sat.getTleLine1(), sat.getTleLine2()});
                Satellite satellite = SatelliteFactory.createSatellite(tle);
                SatPos pos = satellite.getPosition(dummyStation, now);

                // Convert position coordinates from radians to degrees
                double lat = Math.toDegrees(pos.getLatitude());
                double lon = Math.toDegrees(pos.getLongitude());
                
                // Normalize longitude to [-180, 180] range
                lon = (lon + 180) % 360;
                if (lon < 0) {
                    lon += 360;
                }
                lon -= 180;
                
                double alt = pos.getAltitude(); // altitude in km

                // Standard Keplerian velocity estimation (km/s)
                // v = sqrt(GM / r) where GM = 398600.44 km^3/s^2, r = Re + altitude
                double r = 6378.137 + alt;
                double vel = Math.sqrt(398600.4418 / r);

                // Keplerian period estimation (minutes)
                double period = 2 * Math.PI * Math.sqrt(Math.pow(r, 3) / 398600.4418) / 60.0;

                sat.setLatitude(lat);
                sat.setLongitude(lon);
                sat.setAltitude(alt);
                sat.setVelocity(vel);
                sat.setPeriod(period);
                sat.setApogee(alt + 15.0); // Approximate apogee/perigee for presentation
                sat.setPerigee(alt - 15.0);

                // Calculate ground track points for 1 full orbit (45 steps)
                List<double[]> groundTrack = new ArrayList<>();
                for (int j = 0; j < 45; j++) {
                    long offsetMs = (long) (j * (period / 45.0) * 60_000);
                    Date futureDate = new Date(now.getTime() + offsetMs);
                    try {
                        SatPos futurePos = satellite.getPosition(dummyStation, futureDate);
                        double trackLon = Math.toDegrees(futurePos.getLongitude());
                        trackLon = (trackLon + 180) % 360;
                        if (trackLon < 0) {
                            trackLon += 360;
                        }
                        trackLon -= 180;

                        groundTrack.add(new double[]{
                            Math.toDegrees(futurePos.getLatitude()),
                            trackLon,
                            futurePos.getAltitude()
                        });
                    } catch (Exception e) {
                        // Ignore individual point failures
                    }
                }
                sat.setGroundTrack(groundTrack);

                propagatedList.add(sat);
            } catch (Exception e) {
                // If SGP4 propagation fails for a single satellite, log warning and skip
                log.warn("Failed to propagate satellite {} (NORAD: {}): {}", 
                        sat.getName(), sat.getNoradId(), e.getMessage());
            }
        }

        return propagatedList;
    }

    /**
     * Triggers backend fetching of all groups from CelesTrak.
     */
    public synchronized void refreshSatelliteData() {
        log.info("Refreshing satellite TLE data from CelesTrak...");
        boolean updatedAny = false;

        for (Map.Entry<String, String> entry : GROUP_URLS.entrySet()) {
            String group = entry.getKey();
            String url = entry.getValue();

            try {
                log.debug("Fetching TLE for group: {}", group);
                String tleContent = restTemplate.getForObject(url, String.class);
                if (tleContent != null && !tleContent.isBlank()) {
                    List<SatelliteData> parsed = parseTleContent(tleContent, group);
                    if (!parsed.isEmpty()) {
                        // Limit Starlink or large groups to 60 satellites to keep the frontend running extremely smooth
                        if (parsed.size() > 60) {
                            parsed = parsed.subList(0, 60);
                        }
                        cachedSatellites.put(group, parsed);
                        updatedAny = true;
                    }
                }
            } catch (Exception e) {
                log.error("Failed to fetch TLE for group {} from URL {}: {}", group, url, e.getMessage());
            }
        }

        if (updatedAny) {
            lastFetchTime = System.currentTimeMillis();
            saveToLocalStorage();
        }
    }

    private void refreshSatelliteDataAsync() {
        // Run refresh in a background thread to prevent blocking client requests
        new Thread(this::refreshSatelliteData).start();
    }

    /**
     * Parses standard 3-Line Element formats
     */
    private List<SatelliteData> parseTleContent(String tleContent, String groupName) {
        List<SatelliteData> list = new ArrayList<>();
        String[] lines = tleContent.split("\\r?\\n");
        
        for (int i = 0; i < lines.length - 2; ) {
            String name = lines[i].trim();
            String tle1 = lines[i+1].trim();
            String tle2 = lines[i+2].trim();

            if (tle1.startsWith("1 ") && tle2.startsWith("2 ")) {
                try {
                    int noradId = Integer.parseInt(tle1.substring(2, 7).trim());
                    list.add(new SatelliteData(name, noradId, tle1, tle2, groupName));
                    i += 3;
                } catch (Exception e) {
                    i++;
                }
            } else {
                i++;
            }
        }
        return list;
    }

    private void seedDefaultSatellites() {
        // Standard high-interest satellites as default seed values
        List<SatelliteData> stations = new ArrayList<>();
        stations.add(new SatelliteData("ISS (ZARYA)", 25544, 
                "1 25544U 98067A   26045.79523799  .00007779  00000+0  15107-3 0  9994", 
                "2 25544  51.6315 185.5279 0011056  98.8248 261.3993 15.48601910552787", "stations"));
        stations.add(new SatelliteData("CSS (TIANGONG)", 48274, 
                "1 48274U 21035A   26045.45281907  .00012015  00000-0  21644-3 0  9996", 
                "2 48274  41.4729 203.9512 0001391  88.3512 254.9123 15.59918236270512", "stations"));

        List<SatelliteData> weather = new ArrayList<>();
        weather.add(new SatelliteData("NOAA 19", 33591, 
                "1 33591U 09005A   26045.39209537  .00000124  00000-0  87452-4 0  9994", 
                "2 33591  98.7042  64.2183 0014022 179.2319 180.8920 14.22080313886539", "weather"));

        List<SatelliteData> gps = new ArrayList<>();
        gps.add(new SatelliteData("GPS BIIRM-4 (PRN 15)", 32260, 
                "1 32260U 07062A   26045.24945763  .00000062  00000-0  00000-0 0  9995", 
                "2 32260  55.5190  81.0423 0017120 205.1023 154.6738  2.00557434133451", "gps"));

        cachedSatellites.put("stations", stations);
        cachedSatellites.put("weather", weather);
        cachedSatellites.put("gps", gps);
        cachedSatellites.put("starlink", new ArrayList<>()); // empty initially until fetched

        saveToLocalStorage();
    }

    private void loadFromLocalStorage() {
        File file = new File(storagePath);
        if (!file.exists()) {
            return;
        }
        try {
            Map<String, List<SatelliteData>> data = objectMapper.readValue(file, 
                    new TypeReference<Map<String, List<SatelliteData>>>() {});
            cachedSatellites.clear();
            cachedSatellites.putAll(data);
            lastFetchTime = file.lastModified();
            log.info("Loaded satellite cache from: {}", storagePath);
        } catch (IOException e) {
            log.error("Failed to read satellite storage JSON: {}", e.getMessage());
        }
    }

    private void saveToLocalStorage() {
        File file = new File(storagePath);
        File parent = file.getParentFile();
        if (parent != null && !parent.exists()) {
            parent.mkdirs();
        }
        try {
            objectMapper.writeValue(file, cachedSatellites);
            log.info("Saved satellite cache to: {}", storagePath);
        } catch (IOException e) {
            log.error("Failed to write satellite storage JSON: {}", e.getMessage());
        }
    }
}
