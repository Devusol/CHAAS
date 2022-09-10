const fs = require("fs");
const paths = require("./paths")

class User {
  name = "";
  id = "";
  chats = [];
  trusted = true;
  userPath = "";
  unreadMsgs = false;
  constructor(authResult) {
    if (authResult != null) {
      const authUser = authResult.user;
      this.name = authUser.name;
      this.id = authUser.id;
      this.userPath = paths.getUserPath(authUser.id);
    }
    // console.log(authResult, this.userPath)
  }

  /**
  *  Writes the data in the user object to the user file
  *  @returns {Promise<User>} the current user object in a promise
  */

  write() {
    // console.log("user", this.unreadMsgs)
    return new Promise((res, rej) => {
      // console.log(this.userPath, this.toString())
      fs.writeFile(this.userPath, this.toString(), "utf-8", (er) => {
        if (er) rej(er);
        res(this);
      });
    });

    // fs.writeFileSync(
    //   this.userPath,
    //   JSON.stringify({ name: this.name, id: this.id, chats: this.chats, trusted: this.trusted })
    // );
  }

  /**
  * Brings the data from the user file into the object
  * @returns {Promise<User>} the current user object in a promise
  */

  read() {
    return new Promise((res, rej) => {
      // const parsed = JSON.parse(fs.readFileSync(this.userPath, "utf-8"));
      // console.log(this.userPath);
      fs.readFile(this.userPath, "utf-8", (er, data) => {
        if (er) {
          rej(er);
          return;
        }
        const parsed = JSON.parse(data);
        this.name = parsed.name;
        this.id = parsed.id;
        this.chats = parsed.chats;
        this.trusted = parsed.trusted;
        this.unreadMsgs = parsed.unread;
        res(this);
      });

    })
  }

  async prependChat(id) {
    this.chats.forEach((uId, i) => {
      if (id === uId) this.chats.splice(i, 1);
    });
    this.chats.unshift(id);
    await this.write();
  }

  static async getById(id) {
    const user = new User(null);
    user.userPath = paths.getUserPath(id);
    var er = null;
    await user.read().catch(e => {
      er = e;
    });

    if (er) {
      console.log("error saving user", er)
      return null;
    }
    return user;
  }

  static async createUntrusted(name, id) {
    const user = new User({
        user: {
          name,
          id,
        }
      });
    user.trusted = false;
    await user.write();
    return user;
  }

  async delete() {
    return new Promise((res, rej) => {
      fs.unlink(this.path, (er) => {
        if(er) rej(er);
        res();
      });
    });
  }

  toString() {
    return JSON.stringify({ name: this.name, id: this.id, chats: this.chats, trusted: this.trusted, unread: this.unreadMsgs})
  }
}

module.exports = { User };