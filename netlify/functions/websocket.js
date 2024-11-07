import { nanoid } from "nanoid";

// Store connections and game state
const clients = new Map();
const games = new Map();

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

async function broadcast(message) {
    const stringifiedMessage = JSON.stringify(message);
    const promises = [];

    for (const [connectionId] of clients) {
        promises.push(
            fetch(`${process.env.URL}/.netlify/functions/websocket/${connectionId}`, {
                method: "POST",
                body: stringifiedMessage,
            }).catch(console.error)
        );
    }

    await Promise.all(promises);
}

async function broadcastLobbyState() {
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

    await broadcast({
        type: "lobby_update",
        lobby: lobbyState,
        games: gamesList,
    });
}

export const handler = async (event, context) => {
    const { type } = event;

    if (type === "websocket") {
        const { connectionId } = event;

        switch (event.body) {
            case "$connect":
                console.log("Client connected:", connectionId);
                return { statusCode: 200 };

            case "$disconnect":
                console.log("Client disconnected:", connectionId);
                const client = clients.get(connectionId);
                if (client) {
                    clients.delete(connectionId);
                    await broadcastLobbyState();
                }
                return { statusCode: 200 };

            default:
                try {
                    const data = JSON.parse(event.body);
                    console.log("Received message:", data);

                    switch (data.type) {
                        case "join_lobby":
                            clients.set(connectionId, {
                                username: data.username,
                                status: "available",
                            });
                            await broadcastLobbyState();
                            break;

                        case "create_game":
                            const gameId = nanoid();
                            const creator = clients.get(connectionId);

                            if (creator) {
                                games.set(gameId, {
                                    white: { connectionId, username: creator.username },
                                    black: null,
                                    spectators: [],
                                    gameState: {
                                        board: getInitialBoard(),
                                        currentPlayer: "white",
                                        moveHistory: [],
                                        status: "waiting",
                                    },
                                });

                                creator.status = "playing";

                                await broadcast({
                                    type: "game_started",
                                    gameId,
                                    color: "white",
                                    gameState: games.get(gameId).gameState,
                                });

                                await broadcastLobbyState();
                            }
                            break;

                        case "join_game":
                            const game = games.get(data.gameId);
                            const joiningPlayer = clients.get(connectionId);

                            if (game && joiningPlayer && !game.black) {
                                game.black = {
                                    connectionId,
                                    username: joiningPlayer.username,
                                };
                                game.gameState.status = "active";
                                joiningPlayer.status = "playing";

                                await broadcast({
                                    type: "game_update",
                                    gameId: data.gameId,
                                    gameState: game.gameState,
                                });

                                await broadcastLobbyState();
                            }
                            break;

                        case "make_move":
                            const gameToUpdate = games.get(data.gameId);
                            if (gameToUpdate) {
                                gameToUpdate.gameState.board = data.move.newBoard;
                                gameToUpdate.gameState.currentPlayer =
                                    gameToUpdate.gameState.currentPlayer === "white" ? "black" : "white";

                                const moveEntry = {
                                    piece: data.move.piece,
                                    from:
                                        data.move.notation?.from ||
                                        `${String.fromCharCode(97 + data.move.fromCol)}${8 - data.move.fromRow}`,
                                    to:
                                        data.move.notation?.to ||
                                        `${String.fromCharCode(97 + data.move.toCol)}${8 - data.move.toRow}`,
                                    player: gameToUpdate.gameState.currentPlayer === "white" ? "black" : "white",
                                };

                                gameToUpdate.gameState.moveHistory = [...gameToUpdate.gameState.moveHistory, moveEntry];

                                await broadcast({
                                    type: "game_update",
                                    gameState: gameToUpdate.gameState,
                                });
                            }
                            break;
                    }

                    return { statusCode: 200 };
                } catch (error) {
                    console.error("Error handling message:", error);
                    return { statusCode: 500 };
                }
        }
    }

    return { statusCode: 404 };
};
