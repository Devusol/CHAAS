const chat = "./chat";
const users = chat + "/users";
const messages = chat + "/messages";
const utils = require("./utils");

function getUserPath(id) {
  return `${users}/${id}.txt`;
}

function getChatPath(id1, id2) {
  return `${messages}/${utils.getChatId(id1, id2)}.txt`;
}

module.exports = { chat, users, messages, getUserPath, getChatPath };
