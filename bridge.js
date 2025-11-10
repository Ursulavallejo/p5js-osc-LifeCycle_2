// bridge.js (v4 friendly, Windows-friendly)
// Socket.IO v4 compatible OSC <-> WebSocket bridge.
// - Local IP discovery with Windows-friendly heuristics (prefers Wi-Fi).
// - Clear logs, better error handling, and graceful shutdown.
// - Binds UDP server on 0.0.0.0 so TouchOSC on LAN can reach it.

// ---------------------------
// Imports
// ---------------------------
const http = require('http')
const { Server } = require('socket.io')
const osc = require('node-osc')
const os = require('os')

// ---------------------------
// Config (env overridable)
// ---------------------------
const WS_PORT = Number(process.env.PORT || 8081)
const DEFAULT_OSC_SERVER_HOST = process.env.OSC_SERVER_HOST || '0.0.0.0' // UDP IN (from TouchOSC)
const DEFAULT_OSC_SERVER_PORT = Number(process.env.OSC_SERVER_PORT || 3333)
const DEFAULT_OSC_CLIENT_HOST = process.env.OSC_CLIENT_HOST || '127.0.0.1' // UDP OUT (to Processing/DAW/etc.)
const DEFAULT_OSC_CLIENT_PORT = Number(process.env.OSC_CLIENT_PORT || 3334)

// Optional: very-verbose OSC logging (set VERBOSE_OSC=1)
const VERBOSE_OSC = process.env.VERBOSE_OSC === '1'

// ---------------------------
// Helpers (improved Windows pick)
// ---------------------------
function listIPv4Interfaces() {
  const nics = os.networkInterfaces()
  const out = []
  for (const name of Object.keys(nics)) {
    for (const iface of nics[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        out.push({ name, address: iface.address })
      }
    }
  }
  return out
}

function pickBestLocalIP() {
  // 1) Manual override via env (highest priority)
  if (process.env.LOCAL_IP)
    return { address: process.env.LOCAL_IP, source: 'env:LOCAL_IP' }
  if (process.env.LOCAL_IFACE) {
    const chosen = listIPv4Interfaces().find(
      (i) => i.name.toLowerCase() === process.env.LOCAL_IFACE.toLowerCase()
    )
    if (chosen)
      return { ...chosen, source: `env:LOCAL_IFACE=${process.env.LOCAL_IFACE}` }
  }

  // 2) Heuristics: prefer Wi-Fi / WLAN / Wireless names on Windows
  const all = listIPv4Interfaces()
  const byWifiName = all.find((i) => /(wi-?fi|wlan|wireless)/i.test(i.name))
  if (byWifiName) return { ...byWifiName, source: 'heuristic:wifi-name' }

  // 3) Prefer common LAN ranges (192.168.x.x > 10.x.x.x > 172.16–31.x.x)
  const prefer = (regex) => all.find((i) => regex.test(i.address))
  const r192 = prefer(/^192\.168\./)
  if (r192) return { ...r192, source: 'heuristic:192.168' }
  const r10 = prefer(/^10\./)
  if (r10) return { ...r10, source: 'heuristic:10.x' }
  const r172 = all.find((i) => /^172\.(1[6-9]|2\d|3[0-1])\./.test(i.address))
  if (r172) return { ...r172, source: 'heuristic:172.16-31' }

  // 4) Fallback: first non-internal IPv4 (may be a virtual adapter)
  return all[0]
    ? { ...all[0], source: 'fallback:first' }
    : { address: null, source: 'none' }
}

// Pretty print an OSC array (node-osc format)
function prettyOsc(msg) {
  try {
    if (!Array.isArray(msg) || msg.length === 0) return String(msg)
    const [addr, ...args] = msg
    return `${addr} ${args.map((a) => JSON.stringify(a)).join(' ')}`
  } catch {
    return String(msg)
  }
}

// ---------------------------
// HTTP + Socket.IO server
// ---------------------------
const httpServer = http.createServer((req, res) => {
  // Tiny health/info endpoint (no Express needed)
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('OSC <-> WebSocket bridge is running.\n')
    return
  }
  res.writeHead(404)
  res.end()
})

const io = new Server(httpServer, {
  // For local development, allow any origin. For production, restrict this.
  cors: { origin: '*' },
  // transports: ['websocket', 'polling'], // <— habilita ambos
  // allowUpgrades: true, // <— permite upgrade de polling→WS
  // pingTimeout: 20000,
  // pingInterval: 20000,
})

httpServer.listen(WS_PORT, () => {
  const all = listIPv4Interfaces()
  const picked = pickBestLocalIP()

  console.log('──────────────────────────────────────────────')
  console.log('📡 Available IPv4 interfaces:')
  if (all.length === 0) {
    console.log('  (none found)')
  } else {
    for (const i of all) console.log(`  • ${i.name.padEnd(24)} ${i.address}`)
  }
  console.log('──────────────────────────────────────────────')
  console.log(
    `🖥️  Chosen IP: ${picked.address || 'Unavailable'}  (${picked.source})`
  )
  console.log(
    `👉 Use this IP in TouchOSC → Host: ${picked.address || 'check ipconfig'}`
  )
  console.log(`🔌 Socket.IO listening on http://0.0.0.0:${WS_PORT}`)
  console.log('──────────────────────────────────────────────')
})

// ---------------------------
// OSC server/client lifecycle
// ---------------------------
let oscServer = null // receives from TouchOSC (UDP)
let oscClient = null // sends to Processing/DAW/etc. (UDP)

// Utility to (re)create OSC endpoints safely
function setupOsc(serverHost, serverPort, clientHost, clientPort) {
  // Kill any previous instances
  try {
    oscServer && oscServer.kill()
  } catch {}
  try {
    oscClient && oscClient.kill()
  } catch {}
  oscServer = null
  oscClient = null

  // Create new ones
  oscServer = new osc.Server(serverPort, serverHost)
  oscClient = new osc.Client(clientHost, clientPort)

  console.log(`🎛️  OSC Server listening on  ${serverHost}:${serverPort} (UDP)`)
  console.log(`📤 OSC Client sending to     ${clientHost}:${clientPort} (UDP)`)

  // Forward any incoming OSC messages to ALL web clients
  oscServer.on('message', (msg, rinfo) => {
    if (VERBOSE_OSC) {
      console.log(
        `📥 OSC IN  ${rinfo.address}:${rinfo.port} → ${prettyOsc(msg)}`
      )
    }
    // Emit using a dedicated "osc" event…
    io.emit('osc', { msg, from: rinfo })
    // …and also "message" for backward compatibility with older sketches
    io.emit('message', msg)
  })

  // Basic error logging for the UDP socket
  oscServer._sock &&
    oscServer._sock.on('error', (err) => {
      console.error('⚠️  OSC Server socket error:', err.message)
    })
}

// Initialize with defaults so it works even before a web client configures it
setupOsc(
  DEFAULT_OSC_SERVER_HOST,
  DEFAULT_OSC_SERVER_PORT,
  DEFAULT_OSC_CLIENT_HOST,
  DEFAULT_OSC_CLIENT_PORT
)

// ---------------------------
// Socket.IO handlers
// ---------------------------
io.on('connection', (socket) => {
  console.log('🔌 Web client connected:', socket.id)

  // Optional heartbeat so the client can verify connectivity
  socket.emit('connected', 1)

  // Client can (re)configure OSC endpoints at runtime
  // Expected obj:
  // {
  //   server: { host: '0.0.0.0', port: 3333 }, // UDP IN (from TouchOSC)
  //   client: { host: '127.0.0.1', port: 3334 } // UDP OUT (to Processing/etc.)
  // }
  socket.on('config', (obj = {}) => {
    try {
      const serverHost = obj?.server?.host || DEFAULT_OSC_SERVER_HOST
      const serverPort = Number(obj?.server?.port || DEFAULT_OSC_SERVER_PORT)
      const clientHost = obj?.client?.host || DEFAULT_OSC_CLIENT_HOST
      const clientPort = Number(obj?.client?.port || DEFAULT_OSC_CLIENT_PORT)

      // Tip for Windows: prefer explicit IPv4 hostnames/IPs
      setupOsc(serverHost, serverPort, clientHost, clientPort)

      // Let the client know it's good to go
      socket.emit('connected', 1)

      // Also send a small OSC status to the OUT target (optional)
      try {
        oscClient && oscClient.send('/status', `${socket.id} connected`)
      } catch (e) {
        console.warn('⚠️  Could not send /status to OSC client:', e.message)
      }
    } catch (e) {
      console.error('⚠️  Error in config:', e)
      socket.emit('connected', 0)
    }
  })

  // Web → OSC (generic)
  // Expected: ['/address', arg1, arg2, ...]
  socket.on('message', (arr) => {
    if (!oscClient || !Array.isArray(arr) || arr.length === 0) return
    try {
      if (VERBOSE_OSC) console.log('📤 OSC OUT (message):', prettyOsc(arr))
      oscClient.send.apply(oscClient, arr)
    } catch (e) {
      console.error('⚠️  Error sending OSC (message):', e.message)
    }
  })

  // Web → OSC (explicit event name)
  socket.on('osc-send', (arr) => {
    if (!oscClient || !Array.isArray(arr) || arr.length === 0) return
    try {
      if (VERBOSE_OSC) console.log('📤 OSC OUT (osc-send):', prettyOsc(arr))
      oscClient.send.apply(oscClient, arr)
    } catch (e) {
      console.error('⚠️  Error sending OSC (osc-send):', e.message)
    }
  })

  socket.on('disconnect', () => {
    console.log('❌ Web client disconnected:', socket.id)
    // Keep OSC endpoints alive; tear down only if NO clients remain:
    if (io.engine.clientsCount === 0) {
      try {
        oscServer && oscServer.kill()
      } catch {}
      try {
        oscClient && oscClient.kill()
      } catch {}
      oscServer = null
      oscClient = null
      // Recreate defaults so the next client finds a working bridge
      setupOsc(
        DEFAULT_OSC_SERVER_HOST,
        DEFAULT_OSC_SERVER_PORT,
        DEFAULT_OSC_CLIENT_HOST,
        DEFAULT_OSC_CLIENT_PORT
      )
    }
  })
})

// ---------------------------
// Graceful shutdown (Ctrl+C / kill)
// ---------------------------
function shutdown(reason = 'shutdown') {
  console.log(`\n🛑 Graceful ${reason}…`)
  try {
    oscServer && oscServer.kill()
  } catch {}
  try {
    oscClient && oscClient.kill()
  } catch {}
  try {
    io && io.close()
  } catch {}
  try {
    httpServer && httpServer.close()
  } catch {}
  setTimeout(() => process.exit(0), 200)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
