-- ================================================================================
-- HELIOS DATABASE SCHEMA (MySQL)
-- Connected via jdbc:mysql://localhost:3306/helios
-- ================================================================================

CREATE DATABASE IF NOT EXISTS helios;
USE helios;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    last_active BIGINT,
    total_time_spent_seconds BIGINT DEFAULT 0,
    stations_clicks BIGINT DEFAULT 0,
    weather_clicks BIGINT DEFAULT 0,
    starlink_clicks BIGINT DEFAULT 0,
    gps_clicks BIGINT DEFAULT 0
);
