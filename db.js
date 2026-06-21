import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  orderBy,
  limit,
  addDoc,
  deleteDoc,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAnalytics
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyB9Z5Tjc0yWg69GlWdUBTZ9VgUcGrh5mMU",
  authDomain: "v-scans.firebaseapp.com",
  projectId: "v-scans",
  storageBucket: "v-scans.firebasestorage.app",
  messagingSenderId: "545198752043",
  appId: "1:545198752043:web:efdc1656b5fd4f354ec56e",
  measurementId: "G-NDQER8NPM9"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
const analytics = getAnalytics(app);

export const IMGBB_API_KEY = "7d8f9e0a1b2c3d4e5f6a7b8c9d0e1f2a";
export const ADMIN_EMAIL = "anwarbah96@gmail.com";

// ─── ImgBB Upload ─────────────────────────────────────────────────────────────
export async function uploadImageToImgBB(file) {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("key", IMGBB_API_KEY);

  const response = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    throw new Error(`ImgBB upload failed: ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error("ImgBB upload was unsuccessful.");
  }

  return data.data.url;
}

// ─── Auth Helpers ─────────────────────────────────────────────────────────────
export async function loginWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function logoutUser() {
  await signOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

// ─── User Profile ─────────────────────────────────────────────────────────────
export async function getOrCreateUserProfile(user) {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    const profileData = {
      uid: user.uid,
      displayName: user.displayName || "Reader",
      email: user.email,
      photoURL: user.photoURL || "",
      createdAt: serverTimestamp()
    };
    await setDoc(userRef, profileData);
    return profileData;
  }
  return snap.data();
}

export async function updateUserProfile(uid, updates) {
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, updates);
}

// ─── Manga CRUD ────────────────────────────────────────────────────────────────
export async function getAllManga() {
  const mangaCol = collection(db, "manga");
  const q = query(mangaCol, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getMangaById(mangaId) {
  const mangaRef = doc(db, "manga", mangaId);
  const snap = await getDoc(mangaRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function addManga(mangaData) {
  const mangaCol = collection(db, "manga");
  const docRef = await addDoc(mangaCol, {
    ...mangaData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
}

export async function updateManga(mangaId, updates) {
  const mangaRef = doc(db, "manga", mangaId);
  await updateDoc(mangaRef, { ...updates, updatedAt: serverTimestamp() });
}

export async function deleteManga(mangaId) {
  // Delete chapters first
  const chaptersRef = collection(db, "manga", mangaId, "chapters");
  const chapSnap = await getDocs(chaptersRef);
  const deletePromises = chapSnap.docs.map(d => deleteDoc(d.ref));
  await Promise.all(deletePromises);
  // Delete manga doc
  await deleteDoc(doc(db, "manga", mangaId));
}

// ─── Chapter CRUD ──────────────────────────────────────────────────────────────
export async function getChaptersByManga(mangaId) {
  const chaptersRef = collection(db, "manga", mangaId, "chapters");
  const q = query(chaptersRef, orderBy("chapterNumber", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getLatestChapters(mangaId, limitCount = 3) {
  const chaptersRef = collection(db, "manga", mangaId, "chapters");
  const q = query(chaptersRef, orderBy("createdAt", "desc"), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addChapter(mangaId, chapterData) {
  const chaptersRef = collection(db, "manga", mangaId, "chapters");
  const docRef = await addDoc(chaptersRef, {
    ...chapterData,
    createdAt: serverTimestamp()
  });
  // Update manga's updatedAt
  await updateDoc(doc(db, "manga", mangaId), { updatedAt: serverTimestamp() });
  return docRef.id;
}

export async function deleteChapter(mangaId, chapterId) {
  await deleteDoc(doc(db, "manga", mangaId, "chapters", chapterId));
}

// ─── Comments ──────────────────────────────────────────────────────────────────
export async function getComments(mangaId, chapterId = null) {
  let commentsRef;
  if (chapterId) {
    commentsRef = collection(db, "manga", mangaId, "chapters", chapterId, "comments");
  } else {
    commentsRef = collection(db, "manga", mangaId, "comments");
  }
  const q = query(commentsRef, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addComment(mangaId, commentData, chapterId = null) {
  let commentsRef;
  if (chapterId) {
    commentsRef = collection(db, "manga", mangaId, "chapters", chapterId, "comments");
  } else {
    commentsRef = collection(db, "manga", mangaId, "comments");
  }
  await addDoc(commentsRef, {
    ...commentData,
    createdAt: serverTimestamp()
  });
}

export {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  orderBy,
  limit,
  addDoc,
  deleteDoc,
  where,
  serverTimestamp
};
