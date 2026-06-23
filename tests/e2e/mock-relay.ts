import { WebSocketServer, type WebSocket } from "ws";

export interface MockRelay {
  url: string;
  close: () => Promise<void>;
}

export async function startMockRelay(port = 8765): Promise<MockRelay> {
  const server = new WebSocketServer({ port });
  const sockets = new Set<WebSocket>();

  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("message", (raw) => {
      let message: unknown;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (!Array.isArray(message)) {
        return;
      }

      const [type, second] = message;
      if (type === "REQ" && typeof second === "string") {
        socket.send(JSON.stringify(["EOSE", second]));
      }

      if (type === "EVENT") {
        const eventId = typeof message[1]?.id === "string" ? message[1].id : "";
        socket.send(JSON.stringify(["OK", eventId, true, ""]));
      }
    });
  });

  await new Promise<void>((resolve) => server.once("listening", resolve));

  return {
    url: `ws://127.0.0.1:${port}`,
    close: async () => {
      for (const socket of sockets) {
        socket.close();
      }

      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
  };
}
