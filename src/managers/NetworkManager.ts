import Peer, { DataConnection } from 'peerjs';

// ============================================================
// Network events that get synced between players
// ============================================================
export enum NetEventType {
  // Lobby
  PLAYER_READY = 'player_ready',
  GAME_START = 'game_start',

  // Game actions (sent by either player)
  TOWER_PLACE = 'tower_place',
  TOWER_UPGRADE = 'tower_upgrade',
  TOWER_SELL = 'tower_sell',
  WAVE_START = 'wave_start',
  TIME_WARP = 'time_warp',
  SPEED_CHANGE = 'speed_change',

  // Host → guest state sync
  GOLD_SYNC = 'gold_sync',
  LIVES_SYNC = 'lives_sync',
  WAVE_COMPLETE = 'wave_complete',
  GAME_OVER = 'game_over',
  ENEMY_SPAWN = 'enemy_spawn',

  // Cursor sync (show where other player is looking)
  CURSOR_MOVE = 'cursor_move',

  // Connection
  PING = 'ping',
  PONG = 'pong',
  DISCONNECT = 'disconnect',
}

export interface NetEvent {
  type: NetEventType;
  data?: any;
  player?: number; // 1 = host, 2 = guest
  timestamp?: number;
}

type EventCallback = (event: NetEvent) => void;

// ============================================================
// Room code generator — 4 uppercase letters
// ============================================================
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O to avoid confusion
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Prefix for PeerJS IDs to avoid collisions
const PEER_PREFIX = 'chrono-siege-';

// ============================================================
// NetworkManager
// ============================================================
export class NetworkManager {
  public isHost: boolean = false;
  public isConnected: boolean = false;
  public isMultiplayer: boolean = false;
  public roomCode: string = '';
  public playerNumber: number = 0; // 1 = host, 2 = guest
  public latency: number = 0;

  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private listeners: Map<string, EventCallback[]> = new Map();
  private pingTimer: number = 0;
  private lastPingTime: number = 0;

  // Connection state callbacks
  public onConnected: (() => void) | null = null;
  public onDisconnected: ((reason: string) => void) | null = null;
  public onError: ((error: string) => void) | null = null;
  public onHostReady: ((code: string) => void) | null = null;

  constructor() {}

  // ========================
  // HOST: Create a game room
  // ========================
  async hostGame(): Promise<string> {
    this.isHost = true;
    this.isMultiplayer = true;
    this.playerNumber = 1;
    this.roomCode = generateRoomCode();

    return new Promise((resolve, reject) => {
      const peerId = PEER_PREFIX + this.roomCode;
      this.peer = new Peer(peerId);

      this.peer.on('open', () => {
        console.log('[NET] Hosting as:', peerId);
        if (this.onHostReady) this.onHostReady(this.roomCode);
        resolve(this.roomCode);
      });

      this.peer.on('connection', (conn) => {
        console.log('[NET] Guest connected');
        this.connection = conn;
        this.setupConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.error('[NET] Host error:', err);
        if (err.type === 'unavailable-id') {
          // Room code collision, try again
          this.peer?.destroy();
          this.roomCode = generateRoomCode();
          const retryId = PEER_PREFIX + this.roomCode;
          this.peer = new Peer(retryId);
          this.peer.on('open', () => {
            if (this.onHostReady) this.onHostReady(this.roomCode);
            resolve(this.roomCode);
          });
          this.peer.on('connection', (conn) => {
            this.connection = conn;
            this.setupConnection(conn);
          });
          this.peer.on('error', (e) => {
            const msg = e.message || 'Failed to create room';
            if (this.onError) this.onError(msg);
            reject(msg);
          });
        } else {
          const msg = err.message || 'Connection error';
          if (this.onError) this.onError(msg);
          reject(msg);
        }
      });
    });
  }

  // ========================
  // GUEST: Join a game room
  // ========================
  async joinGame(code: string): Promise<void> {
    this.isHost = false;
    this.isMultiplayer = true;
    this.playerNumber = 2;
    this.roomCode = code.toUpperCase();

    return new Promise((resolve, reject) => {
      this.peer = new Peer();

      this.peer.on('open', () => {
        console.log('[NET] Joining room:', this.roomCode);
        const targetId = PEER_PREFIX + this.roomCode;
        const conn = this.peer!.connect(targetId, { reliable: true });
        this.connection = conn;
        this.setupConnection(conn);

        // Resolve when connection opens (handled in setupConnection)
        const timeout = setTimeout(() => {
          reject('Connection timed out');
        }, 10000);

        conn.on('open', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this.peer.on('error', (err) => {
        console.error('[NET] Join error:', err);
        let msg = 'Could not find room';
        if (err.type === 'peer-unavailable') {
          msg = `Room "${this.roomCode}" not found`;
        } else {
          msg = err.message || 'Connection error';
        }
        if (this.onError) this.onError(msg);
        reject(msg);
      });
    });
  }

  // ========================
  // Connection setup
  // ========================
  private setupConnection(conn: DataConnection): void {
    conn.on('open', () => {
      console.log('[NET] Connection established');
      this.isConnected = true;
      if (this.onConnected) this.onConnected();
    });

    conn.on('data', (rawData: unknown) => {
      const event = rawData as NetEvent;
      this.handleEvent(event);
    });

    conn.on('close', () => {
      console.log('[NET] Connection closed');
      this.isConnected = false;
      if (this.onDisconnected) this.onDisconnected('Connection lost');
    });

    conn.on('error', (err) => {
      console.error('[NET] Connection error:', err);
      if (this.onError) this.onError('Connection error');
    });
  }

  // ========================
  // Send/Receive events
  // ========================
  send(type: NetEventType, data?: any): void {
    if (!this.connection || !this.isConnected) return;

    const event: NetEvent = {
      type,
      data,
      player: this.playerNumber,
      timestamp: Date.now(),
    };

    this.connection.send(event);
  }

  on(type: NetEventType | string, callback: EventCallback): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(callback);
  }

  off(type: NetEventType | string): void {
    this.listeners.delete(type);
  }

  private handleEvent(event: NetEvent): void {
    // Handle ping/pong internally
    if (event.type === NetEventType.PING) {
      this.send(NetEventType.PONG, { time: event.data?.time });
      return;
    }
    if (event.type === NetEventType.PONG) {
      this.latency = Date.now() - (event.data?.time || 0);
      return;
    }

    // Dispatch to listeners
    const callbacks = this.listeners.get(event.type);
    if (callbacks) {
      for (const cb of callbacks) {
        cb(event);
      }
    }

    // Also dispatch to wildcard listeners
    const wildcardCallbacks = this.listeners.get('*');
    if (wildcardCallbacks) {
      for (const cb of wildcardCallbacks) {
        cb(event);
      }
    }
  }

  // ========================
  // Ping for latency measurement
  // ========================
  sendPing(): void {
    this.lastPingTime = Date.now();
    this.send(NetEventType.PING, { time: this.lastPingTime });
  }

  // ========================
  // Cleanup
  // ========================
  disconnect(): void {
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.isConnected = false;
    this.isMultiplayer = false;
    this.roomCode = '';
    this.playerNumber = 0;
    this.listeners.clear();
  }
}

// Singleton instance
export const networkManager = new NetworkManager();
