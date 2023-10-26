import { Schema, model } from "mongoose";

const userSchema = new Schema({
  email: {
    type: String,
    unique: true,
  },
  unreadMessageAmount: Number,
});

export const User = model("User", userSchema);