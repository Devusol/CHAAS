import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";
import { config } from "dotenv";
import mongoose from "mongoose";
import { Server as HTTPServer } from "http";
import { Server as SocketServer } from "socket.io";

import { User } from "./models/user.js";
import { Message } from "./models/message.js";
import { Conversation } from "./models/conversation.js";

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

  const currentEmail = authResult.email.toLowerCase();

  if (!currentEmail) {// old jwt, cannot create user
    socket.disconnect();
    return;
  }


  let user = await User.findOne({ email: currentEmail });

  if (user == null) {
    user = new User({
      email: currentEmail,
    });

    console.log("creating new user");
    await user.save();
  }

  const conversations = await Conversation.find({ userEmails: [currentEmail] })
    .where("hiddenByEmail").ne(currentEmail)
    .exec();
  socket.emit("conversations", conversations);


  // Request message history with user, at index
  socket.on("messages", async (conversationId, index) => {
    const messages = await Message.find({ conversation: conversationId });

    socket.emit("messages", messages);
  });

  socket.on("startConversation", async (otherEmail) => {
    otherEmail = otherEmail.toLowerCase();
    if (typeof otherEmail != "string" || otherEmail == currentEmail) {
      socket.emit("er", "Invalid email " + otherEmail);
      return;
    }

    let conversation = await Conversation.findOne({ userEmails: [currentEmail, otherEmail] });

    if (conversation != null) {
      socket.emit("conversation", conversation._id, false);
      return;
    }

    conversation = new Conversation({
      userEmails: [currentEmail, otherEmail],
      notSeenByEmail: otherEmail,
    });

    await conversation.save();

    socket.emit("conversation", conversation._id, true);
  });

  socket.on("sendMessage", async (msg, conversationId) => {
    const conversation = await Conversation.findById(conversationId);
    if (conversation == null) {
      socket.emit("er", "Conversation not found");
      return;
    }

    const otherEmail = conversation.userEmails.find((e) => e != currentEmail);

    const message = new Message({
      text: msg,
      conversation: conversationId,
    });

    conversation.notSeenByEmail = otherEmail;

    const otherUser = await User.findOne({ email: otherEmail });
    otherUser.unreadMessageAmount++;

    await otherUser.save();
    await message.save();
    await conversation.save();

    socket.emit("messageSent", message._id);
  });

  socket.on("unread", async () => {
    const user = await User.findOne({ email: currentEmail });

    socket.emit("unread", user.unreadMessageAmount);
  });

  socket.on("deleteConversation", async (id) => {

    const conversation = await Conversation.findById(id);

    if (conversation == null) {
      socket.emit("deleteResult", false, "Conversation not found");
      return;
    }

    conversation.hiddenByEmail.set(currentEmail, true);
    conversation.save();
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
