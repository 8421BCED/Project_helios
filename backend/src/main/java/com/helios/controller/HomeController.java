package com.helios.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
public class HomeController {

    @GetMapping("/")
    public ResponseEntity<?> index() {
        return ResponseEntity.ok(Map.of(
            "status", "ONLINE",
            "message", "Project Helios Backend Telemetry System is fully operational.",
            "timestamp", Instant.now().toString(),
            "info", "This is the REST API gateway. Please access the application via the frontend dashboard."
        ));
    }
}
