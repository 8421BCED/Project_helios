package com.helios.controller;

import com.helios.service.AstronomyService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/astronomy")
public class AstronomyController {

    private final AstronomyService astronomyService;

    public AstronomyController(AstronomyService astronomyService) {
        this.astronomyService = astronomyService;
    }

    /**
     * Gets Sun and Moon rise/set timelines from USNO.
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> getAstronomyDetails(
            @RequestParam(required = false) String date,
            @RequestParam String coords,
            @RequestParam(required = false) String tz) {
        Map<String, Object> data = astronomyService.getCelestialData(date, coords, tz);
        return ResponseEntity.ok(data);
    }
}
