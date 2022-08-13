const socket = window.io(
  {
    query: {
      id: localStorage.id,
      token: localStorage.token
    }
  });

const chatDiv = document.getElementById("chatBox");
const sendBtn = document.getElementById("sendMsg");
const chatBox = document.getElementById("chatBox");

socket.on("connect", () => {
  console.log("connected");
});

socket.on("msg", (message, sender) => {
  const para = document.createElement("p");
  para.innerText = `[${sender}] - ${message}`;
  chatDiv.appendChild(para);
});

sendBtn.addEventListener("click", () => {
  socket.emit("sendMsg", chatBox.value);
  chatBox.value = "";
});