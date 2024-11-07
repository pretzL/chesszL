import { nanoid } from "nanoid";

const clients = new Map();
const games = new Map();

function getInitialBoard() {
    // Your existing getInitialBoard function
}

exports.handler = function (event, context) {
    if (event.headers["Upgrade"] !== "websocket") {
        return {
            statusCode: 426,
            body: "Upgrade Required",
        };
    }

    const { connectionId, domainName, stage } = event.requestContext;

    // Handle different WebSocket events
    switch (event.requestContext.routeKey) {
        case "$connect":
            console.log("Client connected:", connectionId);
            return { statusCode: 200, body: "Connected" };

        case "$disconnect":
            console.log("Client disconnected:", connectionId);
            const client = clients.get(connectionId);
            if (client) {
                clients.delete(connectionId);
                broadcastLobbyState();
            }
            return { statusCode: 200, body: "Disconnected" };

        case "$default":
        case "message":
            try {
                const data = JSON.parse(event.body);
                handleMessage(connectionId, data);
                return { statusCode: 200, body: "Message received" };
            } catch (error) {
                console.error("Error handling message:", error);
                return { statusCode: 500, body: "Error handling message" };
            }
    }

    return { statusCode: 404, body: "Not Found" };
};

async function handleMessage(connectionId, data) {
    switch (data.type) {
        case "join_lobby":
            clients.set(connectionId, {
                username: data.username,
                connectionId,
                status: "available",
            });
            await broadcastLobbyState();
            break;

        case "create_game":
            const gameId = nanoid();
            const client = clients.get(connectionId);

            if (client) {
                const initialBoard = getInitialBoard();
                games.set(gameId, {
                    white: { connectionId, username: client.username },
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
                await sendMessageTo(connectionId, {
                    type: "game_started",
                    gameId,
                    color: "white",
                    gameState: {
                        board: initialBoard,
                        currentPlayer: "white",
                        moveHistory: [],
                        status: "waiting",
                    },
                });

                await broadcastLobbyState();
            }
            break;

        // Add other message handlers (join_game, make_move, etc.)
    }
}

async function sendMessageTo(connectionId, message) {
    try {
        await fetch(`https://${domainName}/${stage}/@connections/${connectionId}`, {
            method: "POST",
            body: JSON.stringify(message),
        });
    } catch (error) {
        console.error("Error sending message:", error);
    }
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

    const message = {
        type: "lobby_update",
        lobby: lobbyState,
        games: gamesList,
    };

    for (const [connectionId] of clients) {
        await sendMessageTo(connectionId, message);
    }
}
