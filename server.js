import { createServer } from "http";
import { handler } from "./build/handler.js";
import { WebSocketServer } from "ws";
import { nanoid } from "nanoid";

const server = createServer(handler);
const wss = new WebSocketServer({
    server,
    path: "/chess",
});

wss.on("connection", (ws) => {
    const userId = nanoid();

    ws.on("message", (message) => {
        try {
            const data = JSON.parse(message);
            switch (data.type) {
                case "join_lobby":
                    break;
            }
        } catch (error) {
            console.error("Error handling message:", error);
        }
    });

    ws.on("close", () => {
        console.log(`Connection closed: ${userId}`);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
