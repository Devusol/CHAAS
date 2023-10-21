import { Schema, model } from "mongoose";

const userSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  conversations: [{
    type: Schema.Types.ObjectId,
    ref: "Conversation",
  }],
});

export const User = model("User", userSchema);