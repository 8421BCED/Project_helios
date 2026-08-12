package com.helios.controller;

import com.helios.service.NasaService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/nasa")
public class NasaController {

    private final NasaService nasaService;

    public NasaController(NasaService nasaService) {
        this.nasaService = nasaService;
    }

    /**
     * Gets NASA Astronomy Picture of the Day data.
     */
    @GetMapping("/apod")
    public ResponseEntity<Map<String, Object>> getAstronomyPictureOfTheDay() {
        Map<String, Object> data = nasaService.getApod();
        return ResponseEntity.ok(data);
    }
}
