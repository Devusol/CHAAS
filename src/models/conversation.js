import { Schema, model } from "mongoose";

const conversationSchema = new Schema({
  userEmails: [String],
  notSeenByEmail: String,
});

export const Conversation = model("Conversation", conversationSchema);