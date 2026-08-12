package com.helios.controller;

import com.helios.model.SatelliteData;
import com.helios.service.SatellitePropagatorService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/satellites")
public class SatelliteController {

    private final SatellitePropagatorService propagatorService;

    public SatelliteController(SatellitePropagatorService propagatorService) {
        this.propagatorService = propagatorService;
    }

    /**
     * Retrieves the propagated geodetic states for a specific satellite group.
     */
    @GetMapping("/{group}")
    public ResponseEntity<List<SatelliteData>> getSatellitesByGroup(@PathVariable String group) {
        List<SatelliteData> data = propagatorService.getPropagatedSatellites(group);
        return ResponseEntity.ok(data);
    }

    /**
     * Manually triggers a background fetch and cache update of TLE datasets from CelesTrak.
     */
    @PostMapping("/refresh")
    public ResponseEntity<Map<String, String>> refreshTleData() {
        propagatorService.refreshSatelliteData();
        return ResponseEntity.ok(Map.of("status", "success", "message", "Satellite TLE cache refreshed."));
    }
}
