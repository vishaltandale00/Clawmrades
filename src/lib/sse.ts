type Controller = ReadableStreamDefaultController<Uint8Array>;

const clients = new Set<Controller>();

export function broadcast(event: string, data: object): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const encoded = new TextEncoder().encode(payload);
  for (const controller of clients) {
    try {
      controller.enqueue(encoded);
    } catch {
      clients.delete(controller);
    }
  }
}

export function createSSEStream(): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      clients.add(controller);
      // Send initial keepalive
      controller.enqueue(new TextEncoder().encode(": keepalive\n\n"));
    },
    cancel(controller) {
      clients.delete(controller as Controller);
    },
  });
}
