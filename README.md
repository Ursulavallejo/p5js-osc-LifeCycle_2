## LifeCycle : Interactive MIDO ( p5.js + TouchOSC + OSC Bridge)

**By Ursula Vallejo Janne**
Creative coder · Visual artist · Interaction design experiments

## Concept

**LifeCycle** is an audiovisual experiment that connects **TouchOSC (iPad/iPhone)** with **p5.js (web visuals)** using OSC transmitted through a custom Node.js bridge.

The system simulates:

- Molecular nests
- Atom clusters
- Energy cores
- Curl-noise smoke spheres
- Color-shifting phases
- A small particle “bloom puff”

All components react in real time to TouchOSC controls, turning the interface into a kind of **instrument for sculpting cosmic molecules**.

---

### Video:

---

### System Architecture

```

TouchOSC App (iPad/iPhone)
↓ OSC
Node.js Bridge (bridge.js)
↓ Socket.IO
Browser → p5.js Visual Engine

```

- TouchOSC sends OSC messages (faders, toggles, buttons).
- `bridge.js` receives them and forwards them to the browser via WebSockets.
- p5.js updates all visuals + background music volume.

---

# 🚀 How to Run the Project

## 1️⃣ Start the OSC Bridge

Open a terminal **inside the `bridge` folder** and run:

```bash
node bridge.js
```

Expected output:

```
✅ Socket.IO listening on http://localhost:8081
```

To confirm your IP for TouchOSC:

```bash
ipconfig
```

Look for:

```
Wireless LAN adapter Wi-Fi:
IPv4 Address. . . .: 192.168.xx.xx
```

Use that as **HOST** in TouchOSC.

---

# TouchOSC Setup

Preset used → **Beatmachine Mk2 / Steps layer**

### Controls

- **Toggle 1** → Show intro text
- **Toggle 2** → Show molecular nest (background atoms)
- **Toggle 3**

  - Show CoreEnergy
  - Buttons A/B/C → change color (red/green/yellow)
  - Fader → CoreEnergy size

- **Toggle 4**

  - Show atom moleculs core
  - Fader → open/close the atoms

- **Toggle 5**

  - Show demo circles
  - Fader → size

- **Fader 6** → Background music volume
- **Top round button** → Puff explosion (particle burst)

---

## 📱 TouchOSC Interface Screenshot

![TouchOSC Interface](./life_cycle/assets/TochOSC.jpeg)

---

# 2️⃣ Start the Web Visualization

Launch the `index.html` with Live Server.

⚠️ **Important:**
Use this URL:

```
http://localhost:5500/index.html
```

❌ Do **not** use the LAN version like:

```
http://192.168.x.x:5500/index.html
```

The bridge only works when the browser runs on `localhost`.

---

# Audio System

- Browsers block audio autoplay.
- The project includes a “Activate Sound” overlay to unlock audio.
- TouchOSC fader #6 controls volume in real time.

---

# Included Visual Modules

- Intro text animation
- CoreEnergy (particle vortex with tint overrides)
- SmokeCore (optimized curl-noise smoke)
- Atomic moleculs core
- Molecular nest background
- Particle puff explosion
- Audio engine (p5.sound)

Each one can be toggled from TouchOSC.

---
