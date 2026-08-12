package com.helios.model;

import jakarta.persistence.*;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String username;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false, unique = true)
    private String email;

    private Long lastActive;

    private Long totalTimeSpentSeconds = 0L;

    // Clicks tracking for user interest analytics
    private Long stationsClicks = 0L;
    private Long weatherClicks = 0L;
    private Long starlinkClicks = 0L;
    private Long gpsClicks = 0L;

    public User() {}

    public User(String username, String password, String email) {
        this.username = username;
        this.password = password;
        this.email = email;
        this.lastActive = System.currentTimeMillis();
        this.totalTimeSpentSeconds = 0L;
        this.stationsClicks = 0L;
        this.weatherClicks = 0L;
        this.starlinkClicks = 0L;
        this.gpsClicks = 0L;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public Long getLastActive() {
        return lastActive;
    }

    public void setLastActive(Long lastActive) {
        this.lastActive = lastActive;
    }

    public Long getTotalTimeSpentSeconds() {
        return totalTimeSpentSeconds;
    }

    public void setTotalTimeSpentSeconds(Long totalTimeSpentSeconds) {
        this.totalTimeSpentSeconds = totalTimeSpentSeconds;
    }

    public Long getStationsClicks() {
        return stationsClicks != null ? stationsClicks : 0L;
    }

    public void setStationsClicks(Long stationsClicks) {
        this.stationsClicks = stationsClicks;
    }

    public Long getWeatherClicks() {
        return weatherClicks != null ? weatherClicks : 0L;
    }

    public void setWeatherClicks(Long weatherClicks) {
        this.weatherClicks = weatherClicks;
    }

    public Long getStarlinkClicks() {
        return starlinkClicks != null ? starlinkClicks : 0L;
    }

    public void setStarlinkClicks(Long starlinkClicks) {
        this.starlinkClicks = starlinkClicks;
    }

    public Long getGpsClicks() {
        return gpsClicks != null ? gpsClicks : 0L;
    }

    public void setGpsClicks(Long gpsClicks) {
        this.gpsClicks = gpsClicks;
    }

    @Transient
    public String getPrimaryInterest() {
        long st = getStationsClicks();
        long we = getWeatherClicks();
        long sl = getStarlinkClicks();
        long gp = getGpsClicks();

        long max = Math.max(Math.max(st, we), Math.max(sl, gp));
        if (max == 0) return "Unspecified";
        if (max == we) return "Weather Monitoring";
        if (max == st) return "Space Stations";
        if (max == sl) return "Starlink Constellations";
        return "GPS Positioning";
    }
}
