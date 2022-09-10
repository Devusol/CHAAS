class Message {
  msg = "";
  sender = "";
  date = (new Date()).toDateString();
  constructor(msg, senderId) {
    this.msg = msg;
    this.sender = senderId;
  }
}

module.exports = Message;