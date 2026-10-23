export interface Env { EMBEDDINGROOM_DO: DurableObjectNamespace; }
interface RoomState { embeddings: Map<string, any> }
export class EmbeddingRoomDO {
  private state: DurableObjectState;
  private rooms: Map<string, RoomState> = new Map();
  private websockets: Map<string, WebSocket[]> = new Map();
  constructor(state: DurableObjectState, env: Env) { this.state = state; }
  private getRoom(id: string): RoomState {
    if (!this.rooms.has(id)) this.rooms.set(id, { embeddings: new Map() });
    return this.rooms.get(id)!;
  }
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const roomId = url.pathname.split('/')[2] || 'default';
    if (url.pathname.endsWith('/ws')) {
      const pair = new WebSocketPair();
      this.state.acceptWebSocket(pair[1]);
      if (!this.websockets.has(roomId)) this.websockets.set(roomId, []);
      this.websockets.get(roomId)!.push(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    if (url.pathname.endsWith('/embeddings') && request.method === 'GET') {
      const room = this.getRoom(roomId);
      return Response.json(Array.from(room.embeddings.values()));
    }
    if (url.pathname.endsWith('/embedding') && request.method === 'POST') {
      const data = await request.json();
      const vec = Array.from({ length: 128 }, (_, i) => {
        let sum = 0;
        for (let j = 0; j < data.text.length; j++) sum += (data.text.charCodeAt(j) - 32) / 100 * Math.sin((i + j) * 0.1);
        return sum;
      });
      const norm = Math.sqrt(vec.reduce((s: number, v: number) => s + v * v, 0)) || 1;
      const vector = vec.map((v: number) => v / norm);
      const embedding = { ...data, id: crypto.randomUUID(), vector, createdAt: new Date().toISOString() };
      const room = this.getRoom(roomId);
      room.embeddings.set(embedding.id, embedding);
      this.broadcast(roomId, JSON.stringify({ type: 'embedding', data: embedding }));
      return Response.json({ success: true, embedding });
    }
    if (url.pathname.endsWith('/search') && request.method === 'POST') {
      const { query, topK = 5 } = await request.json();
      const room = this.getRoom(roomId);
      const queryVec = Array.from({ length: 128 }, (_, i) => {
        let sum = 0;
        for (let j = 0; j < query.length; j++) sum += (query.charCodeAt(j) - 32) / 100 * Math.sin((i + j) * 0.1);
        return sum;
      });
      const qNorm = Math.sqrt(queryVec.reduce((s: number, v: number) => s + v * v, 0)) || 1;
      const qVec = queryVec.map((v: number) => v / qNorm);
      const results = Array.from(room.embeddings.values())
        .map((e: any) => {
          let dot = 0;
          for (let i = 0; i < 128; i++) dot += qVec[i] * e.vector[i];
          return { embedding: e, similarity: dot };
        })
        .sort((a: any, b: any) => b.similarity - a.similarity)
        .slice(0, topK);
      return Response.json({ results });
    }
    return new Response('Not Found', { status: 404 });
  }
  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) { }
  webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    for (const [roomId, sockets] of this.websockets) {
      this.websockets.set(roomId, sockets.filter(w => w !== ws));
    }
  }
  private broadcast(roomId: string, msg: string) {
    const sockets = this.websockets.get(roomId) || [];
    for (const ws of sockets) { if (ws.readyState === 1) ws.send(msg); }
  }
}
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const id = env.EMBEDDINGROOM_DO.idFromName(url.pathname);
    const stub = env.EMBEDDINGROOM_DO.get(id);
    return stub.fetch(request);
  }
}