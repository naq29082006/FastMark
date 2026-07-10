const { Server } = require("socket.io");
const { auth } = require("../config/firebaseAdmin");
const { findUserByFirebaseUid } = require("../services/userService");

let io = null;

function initSocket(server) {
  io = new Server(server, {
    cors: { origin: "*" },
    transports: ["websocket", "polling"],
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error("Unauthorized"));
      }

      const decoded = await auth.verifyIdToken(token);
      const user = await findUserByFirebaseUid(decoded.uid);
      if (!user) {
        return next(new Error("User not found"));
      }

      socket.userId = String(user._id);
      socket.mongoUser = user;
      next();
    } catch (error) {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.userId}`);

    socket.on("conversation:join", ({ conversationId }) => {
      if (conversationId) {
        socket.join(`conversation:${conversationId}`);
      }
    });

    socket.on("conversation:leave", ({ conversationId }) => {
      if (conversationId) {
        socket.leave(`conversation:${conversationId}`);
      }
    });
  });

  return io;
}

function getIO() {
  return io;
}

function emitConversationEvent(conversationId, event, payload) {
  if (!io || !conversationId) {
    return;
  }
  io.to(`conversation:${conversationId}`).emit(event, payload);
}

function emitUserEvent(userId, event, payload) {
  if (!io || !userId) {
    return;
  }
  io.to(`user:${userId}`).emit(event, payload);
}

module.exports = {
  initSocket,
  getIO,
  emitConversationEvent,
  emitUserEvent,
};
