type MessageHandler = (data: any) => void;
type EventHandler = () => void;
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private connectionState: ConnectionState = 'disconnected';
  private messageHandlers: Set<MessageHandler> = new Set();
  private openHandlers: Set<EventHandler> = new Set();
  private closeHandlers: Set<EventHandler> = new Set();
  private errorHandlers: Set<EventHandler> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastPong = true;

  constructor(url?: string) {
    this.url = url || 'ws://localhost:8080/ws';
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.connectionState = 'connecting';

    try {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.connectionState = 'disconnected';
    this.reconnectAttempts = this.maxReconnectAttempts;
    this.clearTimers();

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;

      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        this.ws.close(1000, 'Client disconnect');
      }
      this.ws = null;
    }
  }

  send(data: unknown): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, cannot send message');
      return false;
    }

    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      this.ws.send(message);
      return true;
    } catch (error) {
      console.error('WebSocket send error:', error);
      return false;
    }
  }

  on(event: 'message', handler: MessageHandler): void;
  on(event: 'open', handler: EventHandler): void;
  on(event: 'close', handler: EventHandler): void;
  on(event: 'error', handler: EventHandler): void;
  on(event: string, handler: any): void {
    switch (event) {
      case 'message':
        this.messageHandlers.add(handler);
        break;
      case 'open':
        this.openHandlers.add(handler);
        break;
      case 'close':
        this.closeHandlers.add(handler);
        break;
      case 'error':
        this.errorHandlers.add(handler);
        break;
    }
  }

  off(event: 'message', handler: MessageHandler): void;
  off(event: 'open', handler: EventHandler): void;
  off(event: 'close', handler: EventHandler): void;
  off(event: 'error', handler: EventHandler): void;
  off(event: string, handler: any): void {
    switch (event) {
      case 'message':
        this.messageHandlers.delete(handler);
        break;
      case 'open':
        this.openHandlers.delete(handler);
        break;
      case 'close':
        this.closeHandlers.delete(handler);
        break;
      case 'error':
        this.errorHandlers.delete(handler);
        break;
    }
  }

  getState(): ConnectionState {
    return this.connectionState;
  }

  isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  private handleOpen(): void {
    this.connectionState = 'connected';
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
    this.startHeartbeat();
    this.openHandlers.forEach((handler) => handler());
  }

  private handleClose(event: CloseEvent): void {
    this.connectionState = 'disconnected';
    this.stopHeartbeat();

    if (event.code !== 1000) {
      this.scheduleReconnect();
    }

    this.closeHandlers.forEach((handler) => handler());
  }

  private handleError(event: Event): void {
    console.error('WebSocket error:', event);
    this.errorHandlers.forEach((handler) => handler());
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      this.messageHandlers.forEach((handler) => handler(data));
    } catch {
      this.messageHandlers.forEach((handler) => handler(event.data));
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    if (this.connectionState === 'disconnected') return;

    this.connectionState = 'reconnecting';
    const delay = Math.min(
      this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts),
      this.maxReconnectDelay
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (!this.lastPong) {
        this.ws?.close(1000, 'Heartbeat timeout');
        return;
      }
      this.lastPong = false;
      this.send({ type: 'ping', timestamp: Date.now() });
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private clearTimers(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
