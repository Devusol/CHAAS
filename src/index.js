import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";
import { config } from "dotenv";
import mongoose from "mongoose";
import { Server as HTTPServer } from "http";
import { Server as SocketServer } from "socket.io";

import { User } from "./models/user.js";
import { Message } from "./models/message.js";

const BASE_DIR = process.cwd();

config();

const PORT = process.env.PORT || 5000;

const app = express();
const http = new HTTPServer(app);
const io = new SocketServer(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB");
  });

function handleAuth(socket) {
  return new Promise((res, rej) => {
    const { token } = socket.handshake.query;
    console.log("token", token);
    if (token == "undefined") rej();
    try {
      jwt.verify(token, process.env.JWT_SECRET, async (er, decoded) => {

        if (er) {
          rej(er);
          return;
        }

        res(decoded);
      });
    } catch (e) {
      rej(e);
    }
  });
}

io.on("connection", async (socket) => {
  console.log("new connection");
  var authResult;

  try {
    authResult = await handleAuth(socket).catch();
  } catch (e) {
    console.log("ER", e)
  }

  if (!authResult) {
    console.log("Rejecting socket, not matching auth");
    socket.disconnect();
    return;
  }

  const authEmail = authResult.email;

  if (!authEmail) {// old jwt, cannot create user
    socket.disconnect();
    return;
  }

  let user = await User.findOne({ email: authEmail });

  if (user == null) {
    user = new User({
      email: authEmail,
    });

    console.log("creating new user");
    await user.save();
  }

  socket.emit("conversations", user.conversations);

  // Request message history with user, at index
  socket.on("messages", async (conversationId, index) => {
    const messages = await Message.find({ conversation: conversationId });

    socket.emit("messages", messages);
  });

  socket.on("sendMsg", async (msg, id, name) => {
    if (typeof id != "string") {
      socket.emit("er", "Invalid ID " + id);
      return;
    }
    if (id == authEmail || !msg?.length) return;

    const chatPath = paths.getChatPath(id, authEmail);

    user.prependChat(id);


    var otherUser = await User.getById(id);
    if (otherUser == null) {
      // otherUser = new User({
      //   user: {
      //     name,
      //     id,
      //   }
      // });
      // otherUser.trusted = false;
      // await otherUser.write();
      otherUser = await User.createUntrusted(name, id);
    }
    otherUser.unreadMsgs = true;

    // const sortedIds = utils.getSortedIds(id, authId);
    // const fMsg = sortedIds.indexOf(authId) + msg;

    // const msgJSON = {
    //   sender: authId,
    //   msg,
    //   date: (new Date()).toDateString()
    // };

    const msgJSON = new Message(msg, authEmail);

    const fMsg = JSON.stringify(msgJSON);

    prependFile(chatPath, fMsg + "\n");

    (await io.fetchSockets()).forEach((sock) => {
      if (sock.data.id === id) {
        sock.emit("msg", fMsg, authEmail, authEmail);
        otherUser.unreadMsgs = false;
      }
    });

    otherUser.prependChat(authEmail);
    socket.emit("msg", fMsg, authEmail, otherUser.id);
  });

  socket.on("startChat", async (id, name) => {
    if (id == authEmail) return;
    var otherUser = await User.getById(id);
    if (otherUser == null) {
      otherUser = await User.createUntrusted(name, id);
    }
    otherUser.unreadMsgs = true;
    // console.log(otherUser, typeof otherUser, otherUser instanceof User)
    await otherUser.prependChat(authEmail);
    // otherUser.write();

    await user.prependChat(id);
    socket.emit("chatCreated");
    // user.write();
  });

  socket.on("unread", () => {
    socket.emit("unread", user.unreadMsgs);
    console.log("UNREAD", user.unreadMsgs);
    user.unreadMsgs = false;
    user.write();
  });

  socket.on("deleteConvo", async (id) => {
    try {
      for (let i = 0; i < user.chats.length; i++) {
        if (user.chats[i] == id) {
          user.chats.splice(i, 1);
          await user.write();
          socket.emit("deleteResult", true);
          return;
        }
      }
      socket.emit("deleteResult", false, id);
    } catch (e) {
      console.log(e);
      socket.emit("deleteResult", false, e.message);
    }
  });

  socket.on("disconnect", () => {
    console.log("Disconnected");
    // user.write();
  });
});

app.use(cors())
app.use(express.static(BASE_DIR + "/public"));

app.get("/", (req, res) => {
  res.redirect("/index.html");
});

http.listen(PORT, () => {
  console.log(`server on port ${PORT}`);
});
