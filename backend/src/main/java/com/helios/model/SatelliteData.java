package com.helios.model;

public class SatelliteData {
    private String name;
    private int noradId;
    private String tleLine1;
    private String tleLine2;
    private double latitude;
    private double longitude;
    private double altitude; // km
    private double velocity; // km/s
    private double apogee; // km
    private double perigee; // km
    private double period; // minutes
    private String groupName;
    private java.util.List<double[]> groundTrack; // Array of [lat, lon, alt] coordinates representing one full orbit

    // Constructors
    public SatelliteData() {}

    public SatelliteData(String name, int noradId, String tleLine1, String tleLine2, String groupName) {
        this.name = name;
        this.noradId = noradId;
        this.tleLine1 = tleLine1;
        this.tleLine2 = tleLine2;
        this.groupName = groupName;
    }

    // Getters and Setters
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public int getNoradId() { return noradId; }
    public void setNoradId(int noradId) { this.noradId = noradId; }

    public String getTleLine1() { return tleLine1; }
    public void setTleLine1(String tleLine1) { this.tleLine1 = tleLine1; }

    public String getTleLine2() { return tleLine2; }
    public void setTleLine2(String tleLine2) { this.tleLine2 = tleLine2; }

    public double getLatitude() { return latitude; }
    public void setLatitude(double latitude) { this.latitude = latitude; }

    public double getLongitude() { return longitude; }
    public void setLongitude(double longitude) { this.longitude = longitude; }

    public double getAltitude() { return altitude; }
    public void setAltitude(double altitude) { this.altitude = altitude; }

    public double getVelocity() { return velocity; }
    public void setVelocity(double velocity) { this.velocity = velocity; }

    public double getApogee() { return apogee; }
    public void setApogee(double apogee) { this.apogee = apogee; }

    public double getPerigee() { return perigee; }
    public void setPerigee(double perigee) { this.perigee = perigee; }

    public double getPeriod() { return period; }
    public void setPeriod(double period) { this.period = period; }

    public String getGroupName() { return groupName; }
    public void setGroupName(String groupName) { this.groupName = groupName; }

    public java.util.List<double[]> getGroundTrack() { return groundTrack; }
    public void setGroundTrack(java.util.List<double[]> groundTrack) { this.groundTrack = groundTrack; }
}
