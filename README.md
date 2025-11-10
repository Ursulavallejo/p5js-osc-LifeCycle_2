## LifeCycle : Interactive MIDO ( p5.js + TouchOSC + OSC)

### by Ursula Vallejo Janne

This experiment connects **OSC** with **p5.js (visuals)** and **TouchOSC** to create an **interactive flower** that has phases of motion.

---

### Video:

---

### How to Run the Project

#### 1️⃣ Start the OSC Bridge

Open a terminal in the bridge folder and run:

```bash
node bridge.js
```

You should see something like:

```
✅ Socket.IO listening on http://localhost:8081
```

And on terminal you will see the touch IP yo need to use. Otherwise:

### Connect to TouchOSc app check IP

```bash
ipconfig

Wireless LAN adapter Wi-Fi:
IPv4 Address. . . .: THIS NUMBER AS HOSt
```

---

#### 2️⃣ Start the Web Visualization

Go to the folder and start the index.js via Live Server
