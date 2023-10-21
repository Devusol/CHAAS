import { Schema, model } from "mongoose";

const messageSchema = new Schema({
  text: String,
  senderEmail: String,
  date: {
    type: Date,
    default: Date.now,
  },
  conversation: {
    type: Schema.Types.ObjectId,
    ref: "Conversation",
  }
});

export const Message = model("Message", messageSchema);