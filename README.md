# Project Helios - Space Simulation & Meteorological Intelligence

Project Helios is a real-time 3D spatial simulation and weather intelligence dashboard. It propagates active satellites using SGP4 orbit models on a Spring Boot backend and maps them onto a custom 3D CesiumJS globe in React.

## System Architecture

*   **Backend (Spring Boot)**: Runs on port `8080`. It handles loading TLE sets from CelesTrak, caching them in a local JSON storage file (`data/satellites.json`), and propagating satellite coordinates (latitude, longitude, altitude, velocity) in real time using the SGP4 `predict4java` library. It also proxies NASA APIs (APOD) and OpenWeather APIs.
*   **Frontend (React + Vite)**: Runs on port `5173`. Renders the 3D globe using CesiumJS, maps the active constellation paths, and presents telemetry dashboards.

---

## Prerequisites

1.  **Java SDK 17**
2.  **Maven**
3.  **Node.js & npm**

---

## How to Run

Follow these simple steps in VS Code terminal to run the application:

### Step 1: Start the Spring Boot Backend

Open a terminal window and run:

```bash
cd backend
mvn spring-boot:run
```

The backend API will start running at `http://localhost:8080`.

### Step 2: Start the React Frontend

Open a second terminal window and run:

```bash
cd frontend
npm run dev
```

The frontend application will be hosted at `http://localhost:5173`. Open your browser and navigate to this link to see the 3D spinning globe and active satellite telemetry.

---

## Features & Controls

*   **Roster Selector**: Switch categories on the left panel between Space Stations (ISS, Tiangong), Weather satellites (NOAA), Starlink, or GPS.
*   **Active Orbit Paths**: Toggle drawing the 3D orbital ground track polyline on the globe.
*   **Auto-Rotation**: Toggle real-time Earth spin axis.
*   **Telemetry Grid**: Read current sub-satellite location coordinates, height, and speed.
*   **Live Weather Sync**: Displays live meteorological reports (temperature, wind speeds, clouds) for the ground coordinate currently underneath the selected satellite.
*   **Sun/Moon Timetable**: Computes rise/set/transit schedules at the current sub-satellite location.
*   **NASA APOD Display**: Features the NASA Astronomy Picture of the Day.
