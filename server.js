import { createServer } from "http";
import { WebSocketServer } from "ws";
import { nanoid } from "nanoid";
import { fileURLToPath } from "url";
import { dirname } from "path";
import express from "express";
import { handler } from "./build/handler.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(handler);

const clients = new Map();
const games = new Map();

wss.on("connection", (ws) => {
    const userId = nanoid();

    ws.on("message", (message) => {
        try {
            const data = JSON.parse(message);

            switch (data.type) {
                case "join_lobby":
                    clients.set(userId, {
                        username: data.username,
                        ws,
                        status: "available",
                    });

                    broadcastLobbyState();
                    break;

                case "create_game":
                    const gameId = nanoid();
                    const client = clients.get(userId);

                    if (client) {
                        const initialBoard = getInitialBoard();

                        games.set(gameId, {
                            white: { userId, username: client.username },
                            black: null,
                            spectators: [],
                            gameState: {
                                board: initialBoard,
                                currentPlayer: "white",
                                moveHistory: [],
                                status: "waiting",
                            },
                        });

                        client.status = "playing";
                        client.ws.send(
                            JSON.stringify({
                                type: "game_started",
                                gameId,
                                color: "white",
                                gameState: {
                                    board: initialBoard,
                                    currentPlayer: "white",
                                    moveHistory: [],
                                    status: "waiting",
                                },
                            })
                        );

                        broadcastLobbyState();
                    }
                    break;

                case "join_game":
                    const game = games.get(data.gameId);
                    const joiningClient = clients.get(userId);

                    if (game && joiningClient && !game.black) {
                        game.black = {
                            userId,
                            username: joiningClient.username,
                        };
                        game.gameState.status = "active";
                        joiningClient.status = "playing";

                        // Update notification to white player
                        const whitePlayer = clients.get(game.white.userId);
                        if (whitePlayer) {
                            whitePlayer.ws.send(
                                JSON.stringify({
                                    type: "game_started",
                                    gameId: data.gameId,
                                    gameState: game.gameState,
                                    color: "white",
                                    opponent: joiningClient.username,
                                })
                            );
                        }

                        // Notification to black player
                        ws.send(
                            JSON.stringify({
                                type: "game_joined",
                                gameId: data.gameId,
                                gameState: game.gameState,
                                color: "black",
                                opponent: game.white.username,
                            })
                        );

                        broadcastLobbyState();
                    }
                    break;

                case "make_move":
                    const gameToUpdate = games.get(data.gameId);
                    if (gameToUpdate) {
                        const movingPiece = data.move.piece;

                        const moveEntry = {
                            piece: movingPiece,
                            from: `${String.fromCharCode(97 + data.move.fromCol)}${8 - data.move.fromRow}`,
                            to: `${String.fromCharCode(97 + data.move.toCol)}${8 - data.move.toRow}`,
                            player: gameToUpdate.gameState.currentPlayer,
                        };

                        gameToUpdate.gameState.board = data.move.newBoard;
                        gameToUpdate.gameState.currentPlayer =
                            gameToUpdate.gameState.currentPlayer === "white" ? "black" : "white";
                        gameToUpdate.gameState.moveHistory = [...gameToUpdate.gameState.moveHistory, moveEntry];

                        const gameUpdate = JSON.stringify({
                            type: "game_update",
                            gameState: gameToUpdate.gameState,
                        });

                        const whitePlayerWs = clients.get(gameToUpdate.white.userId)?.ws;
                        const blackPlayerWs = clients.get(gameToUpdate.black.userId)?.ws;

                        if (whitePlayerWs) whitePlayerWs.send(gameUpdate);
                        if (blackPlayerWs) blackPlayerWs.send(gameUpdate);
                    }
                    break;
            }
        } catch (error) {
            console.error("Error handling message:", error);
        }
    });

    ws.on("close", () => {
        const client = clients.get(userId);
        if (client) {
            clients.delete(userId);
            broadcastLobbyState();
        }
    });
});

function broadcastLobbyState() {
    const lobbyState = Array.from(clients.entries()).map(([id, client]) => ({
        userId: id,
        username: client.username,
        status: client.status,
    }));

    const gamesList = Array.from(games.entries()).map(([id, game]) => ({
        gameId: id,
        white: game.white.username,
        black: game.black?.username || "Waiting...",
        status: game.gameState.status,
    }));

    const message = JSON.stringify({
        type: "lobby_update",
        lobby: lobbyState,
        games: gamesList,
    });

    clients.forEach((client) => {
        client.ws.send(message);
    });
}

function getInitialBoard() {
    return Array(8)
        .fill(null)
        .map((_, row) =>
            Array(8)
                .fill(null)
                .map((_, col) => {
                    if (row === 0) {
                        return {
                            piece: ["♜", "♞", "♝", "♛", "♚", "♝", "♞", "♜"][col],
                            color: "black",
                            hasMoved: false,
                        };
                    }
                    if (row === 1) {
                        return {
                            piece: "♟",
                            color: "black",
                            hasMoved: false,
                        };
                    }
                    if (row === 6) {
                        return {
                            piece: "♙",
                            color: "white",
                            hasMoved: false,
                        };
                    }
                    if (row === 7) {
                        return {
                            piece: ["♖", "♘", "♗", "♕", "♔", "♗", "♘", "♖"][col],
                            color: "white",
                            hasMoved: false,
                        };
                    }
                    return {
                        piece: "",
                        color: null,
                        hasMoved: false,
                    };
                })
        );
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
