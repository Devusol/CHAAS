import { Schema, model } from "mongoose";

const conversationSchema = new Schema({
  userEmails: [String],
  notSeenByEmail: String,
  hiddenByEmail: {
    type: Map,
    of: Boolean,
  },
});

export const Conversation = model("Conversation", conversationSchema);