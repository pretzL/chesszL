const { HandlerEvent, HandlerContext } = require("@netlify/functions");
const { ChessGameServer } = require("../../../server/chessGameServer.js");

let gameServer;

exports.handler = async (event, context) => {
    const { headers } = event;

    if (!gameServer) {
        gameServer = new ChessGameServer();
    }

    if (event.httpMethod === "GET") {
        if (headers["upgrade"] === "websocket") {
            return {
                statusCode: 101,
                headers: {
                    Upgrade: "websocket",
                    Connection: "Upgrade",
                    "Sec-WebSocket-Accept": computeAcceptKey(headers["sec-websocket-key"]),
                },
            };
        }
    }

    return {
        statusCode: 400,
        body: "Invalid request",
    };
};

function computeAcceptKey(key) {
    const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
    return require("crypto")
        .createHash("sha1")
        .update(key + GUID)
        .digest("base64");
}
