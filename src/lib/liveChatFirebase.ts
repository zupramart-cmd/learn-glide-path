import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const liveChatConfig = {
  apiKey: "AIzaSyCICjtha3F5PYNjXHv9otRiMbf1qDMOM24",
  authDomain: "live-chat-609e7.firebaseapp.com",
  databaseURL: "https://live-chat-609e7-default-rtdb.firebaseio.com",
  projectId: "live-chat-609e7",
  storageBucket: "live-chat-609e7.firebasestorage.app",
  messagingSenderId: "903602846360",
  appId: "1:903602846360:web:512f93a88d8f410401aeed",
};

const liveChatApp = initializeApp(liveChatConfig, "live-chat");
export const liveChatDb = getDatabase(liveChatApp);
