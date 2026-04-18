/**
 * Singleton WebSocket server + room management.
 * Extracted to avoid circular imports between index.ts and services.
 */
import { WebSocketServer, WebSocket } from "ws";

export const wss = new WebSocketServer({ noServer: true });

const rooms = new Map<string, Set<WebSocket>>();

export function joinRoom(ws: WebSocket, roomId: string) {
  if (!rooms.has(roomId)) rooms.set(roomId, new Set());
  rooms.get(roomId)!.add(ws);
}

export function leaveAllRooms(ws: WebSocket) {
  for (const [roomId, clients] of rooms) {
    clients.delete(ws);
    if (clients.size === 0) rooms.delete(roomId);
  }
}

export function broadcast(event: string, payload: unknown, roomId?: string) {
  const message = JSON.stringify({ event, payload });
  if (roomId) {
    const clients = rooms.get(roomId);
    if (clients) {
      for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) client.send(message);
      }
    }
  } else {
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(message);
    }
  }
}
