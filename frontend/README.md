# EV Fleet Dashboard - Frontend

## Overview
This is a real-time monitoring dashboard for an electric vehicle fleet. It displays live telemetry data, active alerts, and historical trends directly from the backend via WebSockets.

## Features
- **Live Vehicle Monitoring**: Real-time status, speed, SOC, and metrics for every vehicle in the fleet.
- **Immediate Alerting**: Visual notifications for critical issues like overheating or low battery, bypassing telemetry throttling.
- **Interactive Charts**: Rolling 5-minute window charts for speed and battery voltage for any selected vehicle.
- **Connection Status**: Real-time indication of WebSocket connectivity.

## Tech Stack
- **Framework**: React 18 (Vite)
- **Charts**: Recharts
- **WebSockets**: Socket.io-client
- **HTTP Client**: Axios

## WebSocket Data Flow
1. **Connect**: On mount, the dashboard connects to `http://localhost:3000`.
2. **Subscribe**: Automatically emits a `subscribe` event for `all` vehicles.
3. **Listen**:
   - `telemetry_update`: Updates individual vehicle cards and rolling chart data.
   - `new_alert`: Appends new anomalies to the top of the Alert Panel.
   - `vehicle_status`: Updates the connectivity indicator (online/offline) for vehicle cards.

## How to Run
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open the dashboard at `http://localhost:5173`.

## Simulator
The telemetry simulator (`simulator/simulator.js`) generates realistic data for testing:
- **EV001**: Operates within normal ranges.
- **EV002**: Simulates a battery drain scenario, triggering "Low Battery" alerts.
- **EV003**: Simulates high-speed and high-load usage, triggering "Overheating" alerts.

To run the simulator:
```bash
cd simulator
# Ensure axios is installed or use node from root if available
node simulator.js
```
