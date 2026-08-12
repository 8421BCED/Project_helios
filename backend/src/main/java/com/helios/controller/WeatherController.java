package com.helios.controller;

import com.helios.service.WeatherService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/weather")
public class WeatherController {

    private final WeatherService weatherService;

    public WeatherController(WeatherService weatherService) {
        this.weatherService = weatherService;
    }

    /**
     * Gets meteorological reports for the specified coordinates.
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> getWeatherAtCoordinates(
            @RequestParam double lat,
            @RequestParam double lon) {
        Map<String, Object> data = weatherService.getWeather(lat, lon);
        return ResponseEntity.ok(data);
    }
}
