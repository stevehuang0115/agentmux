# Device Relay Auto-Discovery

Technical design for automatic device discovery and connection between Crewly instances on the same paid account. Eliminates manual pairing codes — machines on the same account see each other and connect automatically.

**Status:** Draft
**Author:** Leo (crewly-product-leo-member-n)
**Date:** 2026-03-14

---

## 1. Problem Statement

Today, connecting two Crewly instances via Cloud Relay requires:
1. Both machines must know a shared `pairingCode`
2. Both machines must know a shared `sharedSecret` for E2EE
3. A human must copy these values between machines
4. Connection is manually initiated via `POST /relay/connect`

This friction blocks the "zero-config multi-machine" goal. A paid user who logs in on two machines should see them auto-discover and connect with no manual steps.

## 2. Target Flow

```
Machine A (home laptop)                    Cloud                         Machine B (office desktop)
─────────────────────                    ─────                         ─────────────────────────
1. User logs in (paid)
   → POST /v1/devices/register  ───────►  Stores device A
                                           userId: u-123
                                           deviceId: dev-A

                                                                       2. Same user logs in
                                                              ◄─────── POST /v1/devices/register
                                           Stores device B              userId: u-123
                                           userId: u-123                deviceId: dev-B
                                           deviceId: dev-B

3. OSS polls GET /v1/devices   ────────►  Returns [dev-A, dev-B]
   Sees dev-B is new peer

4. Initiates relay connect     ────────►  auto_connect message
   (no pairingCode needed —               Server checks: same userId?
    userId is the implicit pair)          Yes → auto-pair

5. dev-B receives connect_request  ◄────  Server forwards
   Same account → auto-accept     ─────► accept message

6. E2EE key exchange via              ◄──► ECDH ephemeral keys
   server-mediated handshake               (relay never sees plaintext)

7. Orchestrator ↔ Orchestrator         ◄──► Encrypted OrcMessage frames
   direct communication channel
```

## 3. Architecture

### 3.1 Cloud Device Registry

A server-side in-memory store (upgradeable to Redis/Postgres) mapping authenticated users to their online devices.

```
DeviceRegistry
├── userId: string
│   └── devices: Map<deviceId, DeviceRecord>
│       ├── deviceId: string (uuid v4, generated client-side, persisted in ~/.crewly/device.json)
│       ├── deviceName: string (hostname or user-chosen label)
│       ├── platform: 'darwin' | 'linux' | 'win32'
│       ├── crewlyVersion: string
│       ├── role: 'orchestrator' (always — each machine runs its own orc)
│       ├── relaySessionId: string | null (set when WS connected)
│       ├── capabilities: string[] (e.g. ['gpu', 'high-memory'])
│       ├── registeredAt: string (ISO)
│       └── lastHeartbeatAt: string (ISO)
└── ...
```

**Data model — TypeScript interface:**

```typescript
/** Persistent device identity stored in ~/.crewly/device.json */
interface DeviceIdentity {
  deviceId: string;       // uuid v4, generated once, persisted locally
  deviceName: string;     // os.hostname() default, user-overridable
  platform: NodeJS.Platform;
}

/** Cloud-side record for one device */
interface DeviceRecord {
  deviceId: string;
  userId: string;
  deviceName: string;
  platform: string;
  crewlyVersion: string;
  role: 'orchestrator';
  relaySessionId: string | null;
  capabilities: string[];
  registeredAt: string;
  lastHeartbeatAt: string;
  online: boolean;
}

/** Cloud-side registry (in-memory, keyed by userId) */
interface DeviceRegistryStore {
  // userId → Map<deviceId, DeviceRecord>
  [userId: string]: Map<string, DeviceRecord>;
}
```

**Lifecycle rules:**
- Device record is created on first `POST /v1/devices/register`
- `online` set to `true` on register, `false` when heartbeat times out or explicit disconnect
- Stale devices (no heartbeat > 5 min) are marked offline but NOT deleted (allows reconnect)
- Device records persist across reconnections (same `deviceId`)
- Deleted when user explicitly calls `DELETE /v1/devices/:deviceId`

### 3.2 Device Discovery API

All endpoints require a valid Cloud auth token (`Authorization: Bearer <token>`). The Cloud server extracts `userId` from the token — devices can only see other devices on the same account.

#### `POST /v1/devices/register`

Register or update a device in the Cloud registry. Called automatically when an OSS instance logs in to Cloud.

**Request:**
```json
{
  "deviceId": "dev-abc-123",
  "deviceName": "Steves-MacBook-Pro",
  "platform": "darwin",
  "crewlyVersion": "1.3.41",
  "capabilities": ["gpu"]
}
```

**Response:**
```json
{
  "success": true,
  "device": {
    "deviceId": "dev-abc-123",
    "userId": "u-123",
    "deviceName": "Steves-MacBook-Pro",
    "online": true,
    "registeredAt": "2026-03-14T12:00:00.000Z"
  },
  "peers": [
    {
      "deviceId": "dev-xyz-789",
      "deviceName": "Office-Desktop",
      "platform": "linux",
      "online": true,
      "capabilities": ["gpu", "high-memory"]
    }
  ]
}
```

The `peers` array immediately tells the caller about other online devices on the same account — no separate discovery call needed for the fast path.

#### `GET /v1/devices`

List all devices on the caller's account.

**Response:**
```json
{
  "success": true,
  "devices": [
    {
      "deviceId": "dev-abc-123",
      "deviceName": "Steves-MacBook-Pro",
      "platform": "darwin",
      "online": true,
      "self": true,
      "relaySessionId": "sess-001",
      "lastHeartbeatAt": "2026-03-14T12:05:00.000Z"
    },
    {
      "deviceId": "dev-xyz-789",
      "deviceName": "Office-Desktop",
      "platform": "linux",
      "online": true,
      "self": false,
      "relaySessionId": "sess-002",
      "lastHeartbeatAt": "2026-03-14T12:04:55.000Z"
    }
  ]
}
```

#### `DELETE /v1/devices/:deviceId`

Remove a device from the registry. Only the device owner (same userId) can delete.

**Response:**
```json
{
  "success": true,
  "removed": "dev-abc-123"
}
```

#### `POST /v1/devices/heartbeat`

Keep-alive signal. Updates `lastHeartbeatAt` and `online` status. Sent every 30s by the OSS client alongside the relay WS heartbeat.

**Request:**
```json
{
  "deviceId": "dev-abc-123"
}
```

**Response:**
```json
{
  "success": true,
  "online": true
}
```

### 3.3 Auto-Pairing (Same-Account, No Pairing Code)

The current relay system uses `pairingCode` to match two nodes. Auto-discovery replaces this with **userId-based implicit pairing**.

**New relay register message (v2):**

```typescript
/** v2 register: auto-pair by userId instead of pairingCode */
interface RelayRegisterMessageV2 extends RelayMessageBase {
  type: 'register';
  version: 2;
  role: 'orchestrator';
  token: string;            // Cloud JWT — server extracts userId
  deviceId: string;         // From ~/.crewly/device.json
  targetDeviceId?: string;  // If connecting to a specific peer
}
```

**Server-side pairing logic:**

```
on register(msg):
  userId = verifyToken(msg.token)
  session = createSession(userId, msg.deviceId, msg.role)

  if msg.targetDeviceId:
    // Directed connect: find the specific peer
    peer = findSession(userId, msg.targetDeviceId)
    if peer && peer.state === 'waiting':
      pair(session, peer)  // Both get 'paired' message
    else:
      session.state = 'waiting'
      notifyPeer(msg.targetDeviceId, 'connect_request', session)
  else:
    // Broadcast mode: auto-pair with first available same-account peer
    peer = findFirstWaitingSession(userId, excludeDeviceId=msg.deviceId)
    if peer:
      pair(session, peer)
    else:
      session.state = 'waiting'
```

**Key difference from v1:** No `pairingCode` field. The server uses `userId` (from JWT) as the implicit pairing scope. Two devices on the same account are trusted to connect.

### 3.4 OSS Auto-Connect

When the OSS backend logs in to Cloud, it automatically registers the device and starts discovery polling.

**Integration point:** `backend/src/services/cloud/cloud-connection.service.ts` (or wherever Cloud login happens)

**New service: `DeviceAutoConnectService`**

Located at: `backend/src/services/cloud/device-auto-connect.service.ts`

```typescript
class DeviceAutoConnectService {
  private deviceId: string;
  private pollInterval: NodeJS.Timeout | null = null;

  /**
   * Called after successful Cloud login.
   * 1. Load or generate ~/.crewly/device.json
   * 2. POST /v1/devices/register
   * 3. Start polling GET /v1/devices every 30s
   * 4. When a new peer appears, initiate auto-connect
   */
  async onCloudLogin(token: string): Promise<void> {
    this.deviceId = await this.loadOrCreateDeviceIdentity();
    const result = await this.registerDevice(token);

    // If peers already online, connect immediately
    if (result.peers.length > 0) {
      await this.autoConnectToPeer(result.peers[0], token);
    }

    // Start polling for new peers
    this.startDiscoveryPolling(token);
  }

  /**
   * Poll /v1/devices every 30s. When a new online peer is found
   * that we're not already connected to, initiate relay connect.
   */
  private startDiscoveryPolling(token: string): void {
    this.pollInterval = setInterval(async () => {
      const devices = await this.fetchDevices(token);
      const unconnectedPeers = devices.filter(
        d => d.online && !d.self && !this.isConnectedTo(d.deviceId)
      );
      for (const peer of unconnectedPeers) {
        await this.autoConnectToPeer(peer, token);
      }
    }, 30_000);
  }

  /**
   * Initiate a relay connection to a peer device.
   * Uses v2 register (userId-based, no pairingCode).
   * E2EE key derived from ECDH exchange, not a shared secret.
   */
  private async autoConnectToPeer(peer: DeviceRecord, token: string): Promise<void> {
    const client = RelayClientService.getInstance();
    client.connect({
      wsUrl: `wss://cloud.crewly.dev/relay`,
      role: 'orchestrator',
      token,
      deviceId: this.deviceId,
      targetDeviceId: peer.deviceId,
      // sharedSecret replaced by ECDH in v2 — see section 3.5
    });
  }
}
```

**Device identity persistence (`~/.crewly/device.json`):**

```json
{
  "deviceId": "dev-abc-123",
  "deviceName": "Steves-MacBook-Pro",
  "platform": "darwin",
  "createdAt": "2026-03-14T12:00:00.000Z"
}
```

Generated once on first Cloud login. The `deviceId` is stable across reinstalls (persisted in `~/.crewly/`) but unique per machine.

### 3.5 Connection Accept Flow

When Machine B receives a `connect_request` from Machine A (same account), it auto-accepts without user intervention.

**New wire messages:**

```typescript
/** Server → Client: another device on your account wants to connect */
interface RelayConnectRequestMessage extends RelayMessageBase {
  type: 'connect_request';
  fromDeviceId: string;
  fromDeviceName: string;
  fromPlatform: string;
}

/** Client → Server: accept or reject a connect request */
interface RelayConnectResponseMessage extends RelayMessageBase {
  type: 'connect_response';
  fromDeviceId: string;
  accepted: boolean;
}
```

**Accept policy (same-account auto-accept):**

```typescript
// In RelayClientService, on receiving 'connect_request':
private handleConnectRequest(msg: RelayConnectRequestMessage): void {
  // Auto-accept: the server already verified both devices are on
  // the same userId. No user confirmation needed for same-account.
  this.sendRaw({
    type: 'connect_response',
    fromDeviceId: msg.fromDeviceId,
    accepted: true,
  });
  this.logger.info('Auto-accepted connect request (same account)', {
    from: msg.fromDeviceName,
  });
}
```

**After accept — ECDH key exchange:**

Once both sides accept, they perform an ephemeral ECDH key exchange through the relay to establish the E2EE session key. This replaces the static `sharedSecret` from v1.

```typescript
/** Key exchange messages (mediated through relay as opaque payloads) */
interface KeyExchangeMessage {
  type: 'key_exchange';
  publicKey: string;  // Base64-encoded ECDH public key (P-256)
}
```

Flow:
1. Both devices generate ephemeral ECDH P-256 key pairs
2. Both send their public key as a `relay` message (encrypted? no — this IS the key exchange, so it's sent as a special unencrypted `key_exchange` message type before E2EE is active)
3. Both derive the shared secret from `ECDH(myPrivate, peerPublic)`
4. Shared secret is fed into `deriveKey()` (existing PBKDF2 function in `relay-crypto.service.ts`) to produce the AES-256-GCM key
5. From this point, all messages are encrypted using the existing `encrypt()`/`decrypt()` functions

**Security note:** The relay server mediates the ECDH exchange but cannot derive the shared secret (it never sees private keys). Man-in-the-middle is prevented because both devices are authenticated via Cloud JWT — the server only forwards between verified same-account devices.

### 3.6 Orc-to-Orc Message Protocol

Once two machines are paired and E2EE is active, orchestrators communicate using a structured message protocol layered on top of the relay's `send(plaintext)`.

**Message format:**

```typescript
/** Top-level envelope for all Orc-to-Orc messages */
interface OrcMessage {
  /** Protocol version for forward compatibility */
  v: 1;
  /** Message type discriminator */
  type: OrcMessageType;
  /** Unique message ID (uuid v4) for dedup and ack tracking */
  id: string;
  /** Sender device ID */
  from: string;
  /** ISO timestamp */
  ts: string;
  /** Optional: reply-to message ID for request-response patterns */
  replyTo?: string;
  /** Type-specific payload */
  payload: Record<string, unknown>;
}

type OrcMessageType =
  | 'ping'              // Health check
  | 'pong'              // Health check response
  | 'agent:delegate'    // Delegate a task to an agent on the remote machine
  | 'agent:status'      // Agent status update from remote
  | 'agent:result'      // Task result from remote agent
  | 'team:sync'         // Sync team config between machines
  | 'task:assign'       // Assign a task to be executed remotely
  | 'task:update'       // Task progress update
  | 'resource:query'    // Ask remote machine about available resources (GPU, memory)
  | 'resource:report'   // Remote machine reports its resources
  | 'chat:forward'      // Forward a chat message to the remote orchestrator
  | 'chat:reply'        // Reply from remote orchestrator
  | 'event:broadcast'   // Broadcast an event to all connected orchestrators
  ;
```

**Example messages:**

```json
// Delegate a task to an agent on Machine B
{
  "v": 1,
  "type": "agent:delegate",
  "id": "msg-001",
  "from": "dev-abc-123",
  "ts": "2026-03-14T12:10:00.000Z",
  "payload": {
    "targetSession": "crewly-product-sam",
    "task": "Implement the login page",
    "priority": "high",
    "context": "Sprint 3.2 — see specs/auth-flow.md"
  }
}

// Agent status update flowing back
{
  "v": 1,
  "type": "agent:status",
  "id": "msg-002",
  "from": "dev-xyz-789",
  "ts": "2026-03-14T12:15:00.000Z",
  "replyTo": "msg-001",
  "payload": {
    "session": "crewly-product-sam",
    "status": "in_progress",
    "summary": "Working on login page, 60% complete"
  }
}

// Resource query
{
  "v": 1,
  "type": "resource:query",
  "id": "msg-003",
  "from": "dev-abc-123",
  "ts": "2026-03-14T12:20:00.000Z",
  "payload": {}
}

// Resource report
{
  "v": 1,
  "type": "resource:report",
  "id": "msg-004",
  "from": "dev-xyz-789",
  "ts": "2026-03-14T12:20:01.000Z",
  "replyTo": "msg-003",
  "payload": {
    "agents": {
      "active": 3,
      "idle": 1,
      "capacity": 6
    },
    "system": {
      "cpuUsage": 0.45,
      "memoryFreeGB": 8.2,
      "gpu": true
    }
  }
}
```

**Transport layer:**

OrcMessages are serialized as JSON, then sent through the existing `RelayClientService.send(plaintext)` which handles E2EE:

```typescript
// Sending
const msg: OrcMessage = { v: 1, type: 'agent:delegate', ... };
relayClient.send(JSON.stringify(msg));

// Receiving
relayClient.on('message', (plaintext: string) => {
  const msg: OrcMessage = JSON.parse(plaintext);
  orcMessageRouter.handle(msg);
});
```

**Message router:**

```typescript
/** Routes incoming OrcMessages to registered handlers */
class OrcMessageRouter {
  private handlers: Map<OrcMessageType, OrcMessageHandler[]> = new Map();

  on(type: OrcMessageType, handler: OrcMessageHandler): void { ... }
  handle(msg: OrcMessage): void {
    const handlers = this.handlers.get(msg.type) || [];
    for (const h of handlers) h(msg);
  }
}
```

**Reliability:**
- Messages include `id` for dedup (receiver keeps a 5-min sliding window of seen IDs)
- Request-response pattern uses `replyTo` for correlation
- No at-least-once delivery guarantee at this layer — the relay is best-effort. Critical operations (task delegation) should use the existing REST API as fallback when relay is unavailable

## 4. Integration Points with Existing Code

| Component | File | Change Required |
|-----------|------|-----------------|
| Relay Types | `backend/src/services/cloud/relay.types.ts` | Add v2 register message, connect_request/response, key_exchange types, OrcMessage types |
| Relay Client | `backend/src/services/cloud/relay-client.service.ts` | Add `connect_request` handler, ECDH key exchange, OrcMessage send/receive helpers |
| Relay Crypto | `backend/src/services/cloud/relay-crypto.service.ts` | Add ECDH key pair generation and shared secret derivation |
| Relay Controller | `backend/src/controllers/cloud/relay.controller.ts` | Add auto-connect endpoint, update `getRelayDevices` to call Cloud registry |
| Relay Routes | `backend/src/controllers/cloud/relay.routes.ts` | Add `/auto-connect` and `/devices/register` routes |
| Constants | `backend/src/constants.ts` | Add `DEVICE_REGISTRY` config (poll interval, heartbeat timeout, etc.) |
| Cloud Connection | `backend/src/services/cloud/cloud-connection.service.ts` | Hook `DeviceAutoConnectService.onCloudLogin()` into login flow |
| NEW: Device Auto-Connect | `backend/src/services/cloud/device-auto-connect.service.ts` | New service — device identity, registration, discovery polling |
| NEW: Orc Message Router | `backend/src/services/cloud/orc-message-router.ts` | New service — message routing, handler registration, dedup |
| Cloud Server (separate repo) | Cloud relay server | Add device registry store, v2 register handler, connect_request forwarding, ECDH mediation |

## 5. Implementation Steps

### Phase 1: Device Registry (Cloud-side)
1. Add `DeviceRegistryStore` to Cloud relay server (in-memory Map)
2. Implement `POST /v1/devices/register` endpoint
3. Implement `GET /v1/devices` endpoint
4. Implement `DELETE /v1/devices/:deviceId` endpoint
5. Implement `POST /v1/devices/heartbeat` endpoint
6. Add stale-device cleanup timer (mark offline after 5 min no heartbeat)
7. Write tests (unit + integration)

### Phase 2: OSS Auto-Registration
1. Create `~/.crewly/device.json` identity file management
2. Create `DeviceAutoConnectService` in OSS backend
3. Hook into Cloud login flow — auto-register device on login
4. Start discovery polling (30s interval)
5. Update `GET /relay/devices` controller to merge local state with Cloud registry
6. Write tests

### Phase 3: Auto-Pairing
1. Add v2 register message type to `relay.types.ts`
2. Update Cloud relay server to support userId-based pairing (no pairingCode)
3. Add `connect_request` / `connect_response` wire messages
4. Implement auto-accept in `RelayClientService`
5. Write tests

### Phase 4: ECDH Key Exchange
1. Add ECDH P-256 key pair generation to `relay-crypto.service.ts`
2. Add `key_exchange` message handling to `RelayClientService`
3. Replace static `sharedSecret` with ECDH-derived key for auto-connect flows
4. Keep v1 `sharedSecret` path for backward compatibility (manual pairing)
5. Write tests

### Phase 5: Orc-to-Orc Protocol
1. Define `OrcMessage` types in new `orc-message.types.ts`
2. Create `OrcMessageRouter` service
3. Implement `ping`/`pong` for health checking
4. Implement `agent:delegate` / `agent:status` / `agent:result` for cross-machine task delegation
5. Implement `resource:query` / `resource:report` for capacity-aware scheduling
6. Wire into existing orchestrator delegation logic (when target agent is on a remote machine, use OrcMessage instead of local PTY)
7. Write tests

### Phase 6: UI Integration
1. Add "Connected Devices" panel to frontend dashboard
2. Show device status, connected peers, relay state
3. Allow manual device naming and removal

## 6. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Device impersonation | All device API calls require valid Cloud JWT. Server extracts `userId` from token — cannot register as another user's device. |
| Relay MITM | ECDH key exchange between authenticated endpoints. Relay server cannot derive shared secret (no private keys). |
| Replay attacks | OrcMessage `id` dedup window (5 min). `ts` timestamp checked for freshness (reject messages > 5 min old). |
| Device enumeration | `GET /v1/devices` only returns devices on the caller's own account. No cross-account visibility. |
| Stale sessions | Heartbeat timeout (5 min) marks devices offline. Stale WS connections cleaned up server-side. |
| Backward compatibility | v1 pairing (with `pairingCode` + `sharedSecret`) continues to work. Auto-discovery is additive, not a replacement. |

## 7. Configuration Constants

```typescript
// Add to CLOUD_CONSTANTS in backend/src/constants.ts
DEVICE_REGISTRY: {
  /** How often the OSS client polls GET /v1/devices (ms) */
  DISCOVERY_POLL_INTERVAL_MS: 30_000,
  /** How often the OSS client sends POST /v1/devices/heartbeat (ms) */
  HEARTBEAT_INTERVAL_MS: 30_000,
  /** Cloud server marks device offline after this many ms without heartbeat */
  OFFLINE_THRESHOLD_MS: 300_000,  // 5 minutes
  /** Maximum devices per user account */
  MAX_DEVICES_PER_USER: 10,
  /** OrcMessage dedup window (ms) */
  MESSAGE_DEDUP_WINDOW_MS: 300_000,  // 5 minutes
  /** OrcMessage max age to accept (ms) */
  MESSAGE_MAX_AGE_MS: 300_000,  // 5 minutes
}
```

## 8. Open Questions

1. **Multi-peer topology**: Should one machine be able to relay-connect to multiple peers simultaneously? Current `RelayClientService` is a singleton with one WS connection. Multi-peer requires either multiple instances or a multiplexed connection.

2. **Conflict resolution**: If both machines have agents with the same `sessionName`, how do we disambiguate when delegating? Proposal: prefix with `deviceId` → `dev-abc:crewly-product-sam`.

3. **Offline queue**: Should OrcMessages be queued when the peer is offline and delivered on reconnect? Or is best-effort acceptable for v1?

4. **Cloud relay server hosting**: The relay server is referenced as a separate repository (`services/relay/`). The device registry needs to live on the same server or share state. Confirm deployment topology.
