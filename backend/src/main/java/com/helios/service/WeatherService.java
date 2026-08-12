package com.helios.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@Service
public class WeatherService {

    private static final Logger log = LoggerFactory.getLogger(WeatherService.class);
    private final RestTemplate restTemplate;

    @Value("${helios.keys.openweather}")
    private String openWeatherKey;

    public WeatherService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    /**
     * Fetches current weather for a specific latitude and longitude.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getWeather(double lat, double lon) {
        String url = String.format(
                "https://api.openweathermap.org/data/2.5/weather?lat=%.4f&lon=%.4f&appid=%s&units=metric",
                lat, lon, openWeatherKey
        );

        try {
            log.debug("Fetching weather for lat: {}, lon: {}", lat, lon);
            return restTemplate.getForObject(url, Map.class);
        } catch (Exception e) {
            log.warn("Failed to fetch weather from OpenWeather: {}. Generating mock telemetry...", e.getMessage());
            return generateFallbackWeather(lat, lon);
        }
    }

    /**
     * Generates standard mock weather properties based on the latitude (equatorial vs polar zones).
     */
    private Map<String, Object> generateFallbackWeather(double lat, double lon) {
        Map<String, Object> mockResponse = new HashMap<>();
        Map<String, Object> coord = new HashMap<>();
        coord.put("lat", lat);
        coord.put("lon", lon);
        mockResponse.put("coord", coord);

        Map<String, Object> main = new HashMap<>();
        // Simple mathematical estimation of temperature based on latitude
        double tempBase = 30.0 - Math.abs(lat) * 0.5; // Warmer near equator, colder near poles
        main.put("temp", Math.round(tempBase * 10.0) / 10.0);
        main.put("feels_like", Math.round((tempBase - 1.0) * 10.0) / 10.0);
        main.put("pressure", 1013);
        main.put("humidity", 65);
        mockResponse.put("main", main);

        Map<String, Object> wind = new HashMap<>();
        wind.put("speed", 3.5);
        wind.put("deg", 180);
        mockResponse.put("wind", wind);

        Map<String, Object> clouds = new HashMap<>();
        clouds.put("all", 40);
        mockResponse.put("clouds", clouds);

        Map<String, Object> weatherItem = new HashMap<>();
        weatherItem.put("id", 802);
        weatherItem.put("main", "Clouds");
        weatherItem.put("description", "scattered clouds (simulated)");
        weatherItem.put("icon", "03d");
        mockResponse.put("weather", new Object[]{weatherItem});

        mockResponse.put("name", String.format("Geo-Zone (%.2f, %.2f)", lat, lon));
        return mockResponse;
    }
}
