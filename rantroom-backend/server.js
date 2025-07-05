// server.js
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // allow all origins (for development)
    methods: ["GET", "POST"]
  }
});

// Track waiting ranter and listener
let waitingRanter = null;
let waitingListener = null;

// When someone connects
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Handle role selection
  socket.on("role", (role) => {
    socket.role = role;

    if (role === "ranter") {
      if (waitingListener) {
        pairUsers(socket, waitingListener);
        waitingListener = null;
      } else {
        waitingRanter = socket;
        socket.emit("status", "Waiting for a listener...");
      }
    } else if (role === "listener") {
      if (waitingRanter) {
        pairUsers(waitingRanter, socket);
        waitingRanter = null;
      } else {
        waitingListener = socket;
        socket.emit("status", "Waiting for a ranter...");
      }
    }
  });

  // Forward message from ranter to listener
  socket.on("rant-message", (message) => {
    if (socket.partner) {
      socket.partner.emit("receive-message", message);
    }
  });

  // Clean up on disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    if (waitingRanter === socket) waitingRanter = null;
    if (waitingListener === socket) waitingListener = null;
    if (socket.partner) {
      socket.partner.emit("status", "Partner disconnected.");
      socket.partner.partner = null;
    }
  });
});

// Pair two sockets
function pairUsers(ranter, listener) {
  ranter.partner = listener;
  listener.partner = ranter;

  ranter.emit("status", "Connected to a listener.");
  listener.emit("status", "Connected to a ranter.");
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`RantRoom server running on ${PORT}`));
