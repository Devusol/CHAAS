const express = require("express");
const SocketServer = require("socket.io").Server;
const { Server } = require("http");
const fs = require("fs");
const paths = require("./paths");
const jwt = require("jsonwebtoken");
const prependFile = require("prepend-file");
const LBL = require("n-readlines");

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
  var lineNumber = 0;
  var line;
  const rl = getFile(id1, id2);
  line = rl.next();
  while (line) {
    lineNumber++;
    if (lineNumber > indexAt + 10) {
      rl.close();
      break;
    }
    if (lineNumber >= indexAt) {
      msgs.push(line.toString("utf-8"));
    }
    line = rl.next();
  }
}

function handleAuth(socket) {
  return new Promise((res, rej) => {
    const { id, token } = socket.handshake.query;
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
  });
}

io.on("connection", async (socket) => {
  console.log("new connection");
  const authResult = await handleAuth(socket).catch((r) => console.log(r));
  console.log(!authResult, authResult);
  if (!authResult) {
    console.log("Rejecting socket, not matching auth");
    socket.disconnect();
    return;
  }

  const authId = authResult.user.id;
  socket.data.id = authId;

  const userPath = paths.getUserPath(authId);
  console.log(userPath, fs.existsSync(userPath));

  if (!fs.existsSync(userPath)) {
    fs.appendFileSync(
      userPath,
      JSON.stringify({ name: authResult.user.name, id: authId, chats: [] })
    );
  }

  // Send list of users previously chatted with
  fs.readFile(userPath, (er, data) => {
    if (er) return console.log(er);
    // console.log(JSON.parse(data.toString("utf-8")).chats);
    socket.emit("chats", JSON.parse(data.toString("utf-8")).chats);
  });

  socket.on("getName", (id) => {
    fs.readFile(paths.getUserPath(id), (e, dat) => {
      if (e) {
        socket.emit("idToName", id, null);
        return;
      }

      socket.emit("idToName", id, dat.toString("utf-8"));
    });
  });

  // Request message history with user, at index
  socket.on("getMessages", (id, index) => {
    socket.emit("msgs", index, id, getMsgs(authId, id, index));
  });

  socket.on("sendMsg", async (msg, id) => {
    const chatPath = paths.getChatPath(id, authId);
    if (!fs.existsSync(chatPath)) {
      const userPath = paths.getUserPath(authId);
      fs.readFile(userPath, (e, dat) => {
        if (e) {
          console.log(e);
        } else {
          const parsed = JSON.parse(dat);
          parsed.chats.forEach((uId, i) => {
            if (id === uId) parsed.chats.splice(i, 1);
          });
          parsed.chats.unshift(id);
          fs.writeFileSync(userPath, JSON.stringify(parsed));
        }
      });

      const otherUserPath = paths.getUserPath(id);
      fs.readFile(otherUserPath, (e, dat) => {
        if (e) {
          console.log(e);
        } else {
          const parsed = JSON.parse(dat);
          parsed.chats.forEach((uId, i) => {
            if (authId === uId) parsed.chats.splice(i, 1);
          });
          parsed.chats.unshift(authId);
          fs.writeFileSync(otherUserPath, JSON.stringify(parsed));
        }
      });
    }

    prependFile(chatPath, msg);

    (await io.fetchSockets()).forEach((sock) => {
      if (sock.data.id === id) {
        sock.emit("msg", msg);
      }
    });
  });

  socket.on("disconnect", () => {
    console.log("Disconnected, destroying object");
    socket = null;
  });
});

app.use(express.static(__dirname + "/public"));

app.get("/", (req, res) => {
  res.redirect("/index.html");
});

http.listen(3000, () => {
  console.log("server on port 3k");
});
