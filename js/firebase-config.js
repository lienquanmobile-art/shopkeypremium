// firebase-config.js
const firebaseConfig = {
  apiKey: "AIzaSyCX2uQJsj3HuhNe9N3Dh5vP_9Ga6iYweLM",
  authDomain: "shopblackkeypremium.firebaseapp.com",
  databaseURL: "https://shopblackkeypremium-default-rtdb.firebaseio.com",
  projectId: "shopblackkeypremium",
  storageBucket: "shopblackkeypremium.firebasestorage.app",
  messagingSenderId: "552944431229",
  appId: "1:552944431229:web:6a874f98d12e7ff376c114",
  measurementId: "G-BGEGZEWX39"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
