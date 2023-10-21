import { Schema, model } from "mongoose";

const conversationSchema = new Schema({
  users: [String],
});

export const Conversation = model("Conversation", conversationSchema);