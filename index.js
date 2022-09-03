const express = require("express");
const SocketServer = require("socket.io").Server;
const { Server } = require("http");
const fs = require("fs");
const paths = require("./paths");
const jwt = require("jsonwebtoken");
const prependFile = require("prepend-file");
const LBL = require("n-readlines");
const { User } = require("./user");
const utils = require("./utils")

const indexLines = 25;

if (!fs.existsSync(paths.chat)) {
  fs.mkdirSync(paths.chat);
}

if (!fs.existsSync(paths.messages)) {
  fs.mkdirSync(paths.messages);
}

if (!fs.existsSync(paths.users)) {
  fs.mkdirSync(paths.users);
}

const app = express();
const http = new Server(app);
const io = new SocketServer(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

function getFile(id1, id2) {
  return new LBL(paths.getChatPath(id1, id2));
}

function getMsgs(id1, id2, indexAt) {
  const msgs = [];
  try {
    var lineNumber = 0;
    var line;
    const rl = getFile(id1, id2);
    line = rl.next();
    while (line) {
      lineNumber++;
      if (lineNumber > indexAt + indexLines) {
        rl.fd = 0;
        rl.close();
        line = false;
        break;
      }
      if (lineNumber >= indexAt) {
        msgs.push(line.toString("utf-8"));
      }
      line = rl.next();
    }
  } catch(e) {
    console.log(e)
  }
  return msgs;
}

function handleAuth(socket) {
  return new Promise((res, rej) => {
    const { id, token } = socket.handshake.query;
    // console.log(socket.handshake.query)
    if (id == "undefined" || token == "undefined") rej();
    try {
      // console.log(id, token);
      jwt.verify(token, process.env.jwtSecret, async (er, decoded) => {
        if (er) {
          rej(er);
        } else if (id === decoded.user.id) {
          res(decoded);
        } else {
          rej(false);
        }
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
    // console.log("ER", e)
  }
  if (!authResult) {
    // console.log("Rejecting socket, not matching auth");
    socket.disconnect();
    return;
  }

  const authId = authResult.user.id;
  socket.data.id = authId;

  const userPath = paths.getUserPath(authId);
  // console.log(userPath, fs.existsSync(userPath));

  const user = new User(authResult);

  if (!fs.existsSync(userPath)) {
    console.log("creating new user");
    user.write();
    // fs.writeFileSync(
    //   userPath,
    //   JSON.stringify({ name: authResult.user.name, id: authId, chats: [], trusted: true })
    // );
  } else {
    await user.read();
    // console.log(user);
    // console.log("reading user")
    if (!user.trusted) {
      user.trusted = true;
      user.name = authResult.user.name;
      user.write();
    }
  }



  // Send list of users previously chatted with
  // fs.readFile(userPath, (er, data) => {
  //   if (er) return console.log("ER Reading FILE REPLIT" + er);
  //   // console.log(JSON.parse(data.toString("utf-8")).chats);
  //   const parsed = JSON.parse(data.toString("utf-8"));
  //   if(!parsed.trusted) {

  //   }
  //   socket.emit("chats", parsed.chats);
  // });
  // console.log("emitting chats", user.chats)
  socket.emit("chats", user.chats);

  socket.on("getName", async (id, isSet = false) => {
    // fs.readFile(paths.getUserPath(id), (e, dat) => {
    //   if (e) {
    //     socket.emit("idToName", id, null);
    //     return;
    //   }
    //   const userDat = JSON.parse(dat.toString("utf-8"));
    //   socket.emit("idToName", id, userDat.name);
    // });
    const userFound = await User.getById(id);
    socket.emit("idToName", id, userFound?.name || null, isSet);
  });

  // Request message history with user, at index
  socket.on("getMessages", (id, index) => {

    socket.emit("msgs", index, id, getMsgs(authId, id, index));
  });

  socket.on("sendMsg", async (msg, id, name) => {
    if (typeof id != "string") {
      socket.emit("er", "Invalid ID " + id);
      return;
    }
    if(id == authId) return;
    
    const chatPath = paths.getChatPath(id, authId);

    user.prependChat(id);

    
    var otherUser = await User.getById(id);
    if(otherUser == null) {
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
    otherUser.prependChat(authId);

    const sortedIds = utils.getSortedIds(id, authId);
    // const fMsg = sortedIds.indexOf(authId) + msg;

    const msgJSON = {
      sender: authId,
      msg,
      date: (new Date()).toDateString()
    };

    const fMsg = JSON.stringify(msgJSON);

    prependFile(chatPath, fMsg + "\n");

    (await io.fetchSockets()).forEach((sock) => {
      if (sock.data.id === id) {
        sock.emit("msg", fMsg, authId, authId);
        
      }
    });
    socket.emit("msg", fMsg, authId, otherUser.id);
  });

  socket.on("startChat", async (id, name) => {
    if(id == authId) return;
    var otherUser = await User.getById(id);
    if(otherUser == null) {
      otherUser = await User.createUntrusted(name, id);
    }
    otherUser.unreadMsgs = true;
    // console.log(otherUser, typeof otherUser, otherUser instanceof User)
    otherUser.prependChat(authId);
    // otherUser.write();
    
    user.prependChat(id);
    // user.write();
  });

  socket.on("unread", () => {
    socket.emit("unread", user.unreadMsgs);
    console.log(user.unreadMsgs);
    user.unreadMsgs = false;
    user.write();
  });

  socket.on("disconnect", () => {
    console.log("Disconnected");
    // user.write();
  });
});

app.use(express.static(__dirname + "/public"));

app.get("/", (req, res) => {
  res.redirect("/index.html");
});

http.listen(3000, () => {
  console.log("server on port 3k");
});
