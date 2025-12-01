## LifeCycle : Interactive MIDO ( p5.js + TouchOSC + OSC)

### by Ursula Vallejo Janne

This experiment connects **OSC** with **p5.js (visuals)** and **TouchOSC** to create an **interactive star-stuff moleculs** that has diferent stages. All is handle via Ipad/Iphone APP TouchOSC.

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

To set the TouchOSc we use the Beatmachine Mk2/steps layer.

Number 1 >> Handle to show text.
Number 2 >> Handle to show Nest core atoms.
Number 3 >> Handle to ShowCore Energy >> a. show / c.change color red , d. change color green and d. chnage color yellow. Fader change size.
Number 4 >> Handle show atoms . Fader move In/out
Number 5 >> show Demo circles. Fader size.
Number 6 >> Fader sound volume.
1st circle top >> Puff effect explode..

## [<img src="./life_cycle/assets/TochOSC.jpeg" width="500"/>](Touch-osc-config)

#### 2️⃣ Start the Web Visualization

Go to the folder and start the index.js via Live Server

Project should be run in >> http://localhost:5500/index.html
