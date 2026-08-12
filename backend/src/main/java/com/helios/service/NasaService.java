package com.helios.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@Service
public class NasaService {

    private static final Logger log = LoggerFactory.getLogger(NasaService.class);
    private final RestTemplate restTemplate;

    @Value("${helios.keys.nasa}")
    private String nasaApiKey;

    public NasaService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    /**
     * Fetches Astronomy Picture of the Day (APOD).
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getApod() {
        String url = String.format("https://api.nasa.gov/planetary/apod?api_key=%s", nasaApiKey);

        try {
            log.debug("Fetching NASA APOD...");
            return restTemplate.getForObject(url, Map.class);
        } catch (Exception e) {
            log.warn("Failed to fetch NASA APOD: {}. Providing stellar fallback content...", e.getMessage());
            return generateFallbackApod();
        }
    }

    private Map<String, Object> generateFallbackApod() {
        Map<String, Object> fallback = new HashMap<>();
        fallback.put("title", "The Pillars of Creation");
        fallback.put("date", "2026-08-12");
        fallback.put("explanation", "The Pillars of Creation are active star-forming regions in the Eagle Nebula. Columns of interstellar gas and dust are illuminated by hot stars nearby. These giant pillars stretch light-years across. Captured originally by the Hubble Space Telescope, and later in stunning infrared by the JWST (simulated presentation).");
        fallback.put("url", "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=1200&auto=format&fit=crop");
        fallback.put("hdurl", "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=2000&auto=format&fit=crop");
        fallback.put("media_type", "image");
        fallback.put("copyright", "NASA/ESA/Unsplash");
        return fallback;
    }
}
