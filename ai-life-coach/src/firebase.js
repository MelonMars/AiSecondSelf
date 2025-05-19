import { initializeApp } from "firebase/app";
import { getAuth, browserLocalPersistence, setPersistence, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyDfO_DAZksXeTQFzIlLR3mqLxYIiVtMoxQ",
    authDomain: "aisecondself-8a616.firebaseapp.com",
    projectId: "aisecondself-8a616",
    storageBucket: "aisecondself-8a616.firebasestorage.app",
    messagingSenderId: "749277301844",
    appId: "1:749277301844:web:dc4410fcfb0f2beb9e31c1",
    measurementId: "G-VGEXD915LD"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log("Firebase Auth persistence set to local.");
  })
  .catch((error) => {
    console.error("Error setting Firebase Auth persistence:", error);
  });

const googleProvider = new GoogleAuthProvider();

export { auth, googleProvider };