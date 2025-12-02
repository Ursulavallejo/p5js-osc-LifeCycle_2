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

## 1 Start Program Procesing >> And from the folder on the pc open the OSC file >>

./life_cycle/osc/ProcessingOSC_Sound.pde

You will see teh code of this file opened on processind and click start.

## 2 Start the OSC Bridge

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

# 3 TouchOSC Setup

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

# 4 Start the Web Visualization

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

# Audio System on P5 - Background Sound

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

# **Audio → Visual Mapping **

## Audio Input Breakdown

| **Audio Range**                          | **Meaning**                                       | **Typical Values (Human Voice)** | **Controls in Three.js**                         | **Visual Effect on the Sphere**                                 |
| ---------------------------------------- | ------------------------------------------------- | -------------------------------- | ------------------------------------------------ | --------------------------------------------------------------- |
| **BASS** (low frequencies)               | Plosives (“B”, “P”), deep tone, body of the voice | 0.05 – 0.25                      | `coreSpinSpeed`, part of `uDisplacementAmp`      | The sphere **rotates faster** and feels heavier, slight pulsing |
| **MID** (mid frequencies)                | Most of the human voice, vowels, natural speech   | 0.10 – 0.40                      | `uNoiseScale` (noise detail), `uDisplacementAmp` | **Internal smoke** becomes more detailed, swirling turbulence   |
| **TREBLE** (high frequencies)            | “S”, “SH”,louder speech, sharp consonants         | 0.18 – 0.60                      | **Halo Sparks** generation                       | Bright **outer sparks** activate in a ring around the sphere    |
| **ENERGY** (average of bass + mid + tre) | Overall loudness and activity                     | 0.10 – 0.40                      | `uSmokeIntensity`                                | Core becomes more **glowing**, luminous, alive                  |

---

## 🔁 Signal Flow Overview

```
Human voice → Microphone → Processing (FFT)
           → { bass, mid, tre } → OSC → Browser (WebSocket)
           → ThreeCore.update({ audio })
           → Real-time visual reaction in Three.js
```

---

## How It Feels in Practice

- **Normal speaking** →
  Only the **inner smoke core** reacts: movement, glow, texture, rotation.

- **High-frequency sounds (“sss”, louder speech)** →
  The **yellow halo sparks** activate.

- **Stronger speech or sharp peaks** →
  Core glows brighter, rotates faster, and emits more sparks.

- **Background music or far sounds** →
  Not very reactive — the system is intentionally tuned for
  **close, human-interaction sound**.

---

### **How the Audio Reactive System Works**

The system uses a Processing sketch to capture microphone input, run FFT analysis, and extract three frequency bands: **bass**, **mid**, and **treble**.
These normalized values are sent to the browser via OSC (using oscP5 → WebSocket bridge).

In the browser, Three.js receives these values and animates the sphere:

- **Bass** → increases rotation speed and adds weight to the deformation
- **Mid** → enhances turbulence and noise detail of the smoke shader
- **Treble** → triggers the bright halo sparks around the sphere
- **Energy** (average) → increases smoke glow and internal luminosity

This creates an interactive, voice-responsive visual designed for real-time human interaction.
