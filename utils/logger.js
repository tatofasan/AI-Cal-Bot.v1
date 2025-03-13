import WebSocket from "ws";

// Guarda los métodos originales
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleInfo = console.info;

// Conjunto de clientes conectados al WebSocket de logs
const logClients = new Set();

console.log = function (...args) {
  const formattedMessage = `[LOG] ${args.join(" ")}`;
  originalConsoleLog.apply(console, args);
  logClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(formattedMessage);
      } catch (error) {
        originalConsoleError("Error enviando log al cliente:", error);
        logClients.delete(client);
      }
    }
  });
};

console.error = function (...args) {
  const formattedMessage = `[ERROR] ${args.join(" ")}`;
  originalConsoleError.apply(console, args);
  logClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(formattedMessage);
    }
  });
};

console.info = function (...args) {
  const formattedMessage = `[INFO] ${args.join(" ")}`;
  originalConsoleInfo.apply(console, args);
  logClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(formattedMessage);
    }
  });
};

export { logClients };
