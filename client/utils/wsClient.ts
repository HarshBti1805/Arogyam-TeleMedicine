/**
 * WebSocket client with exponential backoff reconnect.
 * Use one instance per logical "room" (appointmentId, planId, userId).
 */

const WS_BASE =
  (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:5000")
    .replace(/^http/, "ws")
    .replace(/\/$/, "");

type EventHandler = (payload: unknown) => void;

interface WsClientOptions {
  roomId?: string;
  onOpen?: () => void;
  onClose?: () => void;
}

export class WsClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, EventHandler[]>();
  private retryDelay = 1000;
  private maxDelay = 30000;
  private shouldReconnect = true;
  private roomId?: string;
  private onOpen?: () => void;
  private onClose?: () => void;

  /** Pending frames collected during disconnect for retry on reconnect. */
  private pendingFrames: unknown[] = [];

  constructor(options: WsClientOptions = {}) {
    this.roomId = options.roomId;
    this.onOpen = options.onOpen;
    this.onClose = options.onClose;
    this.connect();
  }

  private connect() {
    const url = this.roomId ? `${WS_BASE}?room=${this.roomId}` : WS_BASE;
    try {
      this.ws = new WebSocket(url);
    } catch (e) {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.retryDelay = 1000;
      this.onOpen?.();
      // Flush any frames queued during disconnect
      const pending = [...this.pendingFrames];
      this.pendingFrames = [];
      for (const frame of pending) this.send(frame);
    };

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string);
        const handlers = this.handlers.get(msg.event) ?? [];
        handlers.forEach((h) => h(msg.payload));
      } catch {}
    };

    this.ws.onclose = () => {
      this.onClose?.();
      if (this.shouldReconnect) this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onclose fires after onerror
    };
  }

  private scheduleReconnect() {
    setTimeout(() => {
      if (this.shouldReconnect) this.connect();
    }, this.retryDelay);
    this.retryDelay = Math.min(this.retryDelay * 2, this.maxDelay);
  }

  on(event: string, handler: EventHandler) {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event)!.push(handler);
    return this;
  }

  off(event: string, handler: EventHandler) {
    const handlers = this.handlers.get(event) ?? [];
    this.handlers.set(
      event,
      handlers.filter((h) => h !== handler)
    );
    return this;
  }

  send(data: unknown) {
    const msg = typeof data === "string" ? data : JSON.stringify(data);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(msg);
    } else {
      // Queue for retry
      this.pendingFrames.push(data);
    }
  }

  joinRoom(roomId: string) {
    this.send({ event: "join.room", roomId });
  }

  destroy() {
    this.shouldReconnect = false;
    this.ws?.close();
  }

  get isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
