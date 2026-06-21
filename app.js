/**
 * V SCANS — app.js
 * Core application logic
 */

import {
  auth,
  db,
  loginWithGoogle,
  logoutUser,
  onAuthChange,
  getOrCreateUserProfile,
  updateUserProfile,
  uploadImageToImgBB,
  getAllManga,
  getMangaById,
  addManga,
  updateManga,
  deleteManga,
  getChaptersByManga,
  getLatestChapters,
  addChapter,
  deleteChapter,
  getComments,
  addComment,
  ADMIN_EMAIL
} from "./db.js";

/* ═══════════════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════════════ */
let currentUser = null;
let currentUserProfile = null;
let allMangaData = [];
let currentCategory = "all";
let currentMangaId = null;
let currentChapterId = null;
let currentView = "home"; // "home" | "detail" | "reader" | "admin"

/* ═══════════════════════════════════════════════════════════════
   UTILITY: timeAgo
═══════════════════════════════════════════════════════════════ */
function timeAgo(timestamp) {
  if (!timestamp) return "Just now";

  let date;
  if (timestamp.toDate) {
    date = timestamp.toDate();
  } else if (timestamp.seconds) {
    date = new Date(timestamp.seconds * 1000);
  } else {
    date = new Date(timestamp);
  }

  const now = new Date();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 30) return "Just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
  return `${Math.floor(diff / 31536000)}y ago`;
}

/* ═══════════════════════════════════════════════════════════════
   UTILITY: Toast Notifications
═══════════════════════════════════════════════════════════════ */
function showToast(message, type = "info", duration = 3500) {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  const iconMap = {
    success: "fa-circle-check",
    error: "fa-circle-exclamation",
    info: "fa-circle-info"
  };

  toast.innerHTML = `<i class="fa-solid ${iconMap[type] || iconMap.info}"></i><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "opacity 0.3s ease, transform 0.3s ease";
    setTimeout(() => toast.remove(), 350);
  }, duration);
}

/* ═══════════════════════════════════════════════════════════════
   UTILITY: Escape HTML
═══════════════════════════════════════════════════════════════ */
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ═══════════════════════════════════════════════════════════════
   THEME MANAGEMENT
═══════════════════════════════════════════════════════════════ */
function initTheme() {
  const savedTheme = localStorage.getItem("vscans-theme") || "dark";
  applyTheme(savedTheme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const icon = document.getElementById("theme-icon");
  if (theme === "dark") {
    icon.className = "fa-solid fa-moon";
  } else {
    icon.className = "fa-solid fa-sun";
  }
  localStorage.setItem("vscans-theme", theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  applyTheme(current === "dark" ? "light" : "dark");
}

document.getElementById("theme-toggle-btn").addEventListener("click", toggleTheme);

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR
═══════════════════════════════════════════════════════════════ */
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebar-overlay");
const hamburgerBtn = document.getElementById("hamburger-btn");
const sidebarCloseBtn = document.getElementById("sidebar-close-btn");

function openSidebar() {
  sidebar.classList.add("open");
  sidebarOverlay.classList.add("active");
  hamburgerBtn.classList.add("active");
  hamburgerBtn.setAttribute("aria-expanded", "true");
  document.body.style.overflow = "hidden";
}

function closeSidebar() {
  sidebar.classList.remove("open");
  sidebarOverlay.classList.remove("active");
  hamburgerBtn.classList.remove("active");
  hamburgerBtn.setAttribute("aria-expanded", "false");
  document.body.style.overflow = "";
}

hamburgerBtn.addEventListener("click", () => {
  if (sidebar.classList.contains("open")) {
    closeSidebar();
  } else {
    openSidebar();
  }
});

sidebarCloseBtn.addEventListener("click", closeSidebar);
sidebarOverlay.addEventListener("click", closeSidebar);

/* ═══════════════════════════════════════════════════════════════
   VIEW SWITCHING
═══════════════════════════════════════════════════════════════ */
function showView(view) {
  const homeView = document.getElementById("home-view");
  const mangaDetail = document.getElementById("manga-detail");
  const chapterReader = document.getElementById("chapter-reader");
  const adminPanel = document.getElementById("admin-panel");

  homeView.style.display = "none";
  mangaDetail.classList.remove("active");
  chapterReader.classList.remove("active");
  adminPanel.classList.remove("active");

  currentView = view;

  switch (view) {
    case "home":
      homeView.style.display = "block";
      break;
    case "detail":
      mangaDetail.classList.add("active");
      break;
    case "reader":
      chapterReader.classList.add("active");
      break;
    case "admin":
      adminPanel.classList.add("active");
      break;
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Sidebar nav links
document.querySelectorAll(".sidebar-nav-link").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".sidebar-nav-link").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    showView("home");
    closeSidebar();
  });
});

// Header logo -> home
document.getElementById("header-logo-link").addEventListener("click", (e) => {
  e.preventDefault();
  showView("home");
  closeSidebar();
});

/* ═══════════════════════════════════════════════════════════════
   AUTHENTICATION
═══════════════════════════════════════════════════════════════ */
function updateAuthUI(user, profile) {
  const loginBtn = document.getElementById("sidebar-login-btn");
  const logoutBtn = document.getElementById("sidebar-logout-btn");
  const userInfoBlock = document.getElementById("sidebar-user-info");
  const adminBtn = document.getElementById("sidebar-admin-btn");
  const headerAvatar = document.getElementById("header-user-avatar");
  const headerAvatarImg = document.getElementById("header-avatar-img");

  if (user && profile) {
    loginBtn.classList.add("hidden");
    logoutBtn.classList.remove("hidden");
    userInfoBlock.classList.add("visible");

    const displayName = profile.displayName || user.displayName || "Reader";
    const email = profile.email || user.email || "";
    const photo = profile.photoURL || user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=7c6af7&color=fff&size=64`;

    document.getElementById("sidebar-username").textContent = displayName;
    document.getElementById("sidebar-useremail").textContent = email;
    document.getElementById("sidebar-avatar").src = photo;

    headerAvatarImg.src = photo;
    headerAvatar.classList.add("visible");

    // Admin check
    if (email === ADMIN_EMAIL) {
      adminBtn.classList.add("visible");
    } else {
      adminBtn.classList.remove("visible");
    }

    // Update comment form avatars
    const mangaCommentAvatar = document.getElementById("manga-comment-avatar");
    const chapterCommentAvatar = document.getElementById("chapter-comment-avatar");
    if (mangaCommentAvatar) mangaCommentAvatar.src = photo;
    if (chapterCommentAvatar) chapterCommentAvatar.src = photo;

    // Show comment forms, hide login prompts
    setCommentForms(true);

  } else {
    loginBtn.classList.remove("hidden");
    logoutBtn.classList.add("hidden");
    userInfoBlock.classList.remove("visible");
    adminBtn.classList.remove("visible");
    headerAvatar.classList.remove("visible");

    setCommentForms(false);
  }
}

function setCommentForms(loggedIn) {
  const mangaForm = document.getElementById("manga-comment-form");
  const mangaPrompt = document.getElementById("manga-comment-login-prompt");
  const chapterForm = document.getElementById("chapter-comment-form");
  const chapterPrompt = document.getElementById("chapter-comment-login-prompt");

  if (loggedIn) {
    if (mangaForm) { mangaForm.style.display = "flex"; }
    if (mangaPrompt) { mangaPrompt.style.display = "none"; }
    if (chapterForm) { chapterForm.style.display = "flex"; }
    if (chapterPrompt) { chapterPrompt.style.display = "none"; }
  } else {
    if (mangaForm) { mangaForm.style.display = "none"; }
    if (mangaPrompt) { mangaPrompt.style.display = "block"; }
    if (chapterForm) { chapterForm.style.display = "none"; }
    if (chapterPrompt) { chapterPrompt.style.display = "block"; }
  }
}

// Login
document.getElementById("sidebar-login-btn").addEventListener("click", async () => {
  try {
    showToast("Opening Google login...", "info");
    await loginWithGoogle();
  } catch (err) {
    showToast("Login failed: " + err.message, "error");
  }
});

// Logout
document.getElementById("sidebar-logout-btn").addEventListener("click", async () => {
  try {
    await logoutUser();
    currentUser = null;
    currentUserProfile = null;
    updateAuthUI(null, null);
    showToast("Logged out successfully.", "success");
  } catch (err) {
    showToast("Logout error: " + err.message, "error");
  }
});

// Comment login links
document.getElementById("manga-comment-login-link").addEventListener("click", async (e) => {
  e.preventDefault();
  try {
    await loginWithGoogle();
  } catch (err) {
    showToast("Login failed.", "error");
  }
});

document.getElementById("chapter-comment-login-link").addEventListener("click", async (e) => {
  e.preventDefault();
  try {
    await loginWithGoogle();
  } catch (err) {
    showToast("Login failed.", "error");
  }
});

// Header avatar -> sidebar
document.getElementById("header-user-avatar").addEventListener("click", openSidebar);

// Auth state changes
onAuthChange(async (user) => {
  if (user) {
    currentUser = user;
    try {
      currentUserProfile = await getOrCreateUserProfile(user);
      updateAuthUI(user, currentUserProfile);
    } catch (err) {
      console.error("Error loading profile:", err);
      updateAuthUI(user, { displayName: user.displayName, email: user.email, photoURL: user.photoURL });
    }
  } else {
    currentUser = null;
    currentUserProfile = null;
    updateAuthUI(null, null);
  }
});

/* ═══════════════════════════════════════════════════════════════
   PROFILE PICTURE UPLOAD
═══════════════════════════════════════════════════════════════ */
const sidebarAvatar = document.getElementById("sidebar-avatar");
const profilePicInput = document.getElementById("profile-pic-input");

sidebarAvatar.addEventListener("click", () => {
  if (!currentUser) {
    showToast("Please login first.", "info");
    return;
  }
  profilePicInput.click();
});

profilePicInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file || !currentUser) return;

  showToast("Uploading profile picture...", "info");

  try {
    const imageUrl = await uploadImageToImgBB(file);

    await updateUserProfile(currentUser.uid, { photoURL: imageUrl });

    // Update local profile state
    if (currentUserProfile) {
      currentUserProfile.photoURL = imageUrl;
    }

    // Update UI
    document.getElementById("sidebar-avatar").src = imageUrl;
    document.getElementById("header-avatar-img").src = imageUrl;
    const mangaCommentAvatar = document.getElementById("manga-comment-avatar");
    const chapterCommentAvatar = document.getElementById("chapter-comment-avatar");
    if (mangaCommentAvatar) mangaCommentAvatar.src = imageUrl;
    if (chapterCommentAvatar) chapterCommentAvatar.src = imageUrl;

    showToast("Profile picture updated!", "success");
  } catch (err) {
    showToast("Upload failed: " + err.message, "error");
  } finally {
    profilePicInput.value = "";
  }
});

/* ═══════════════════════════════════════════════════════════════
   CATEGORIES FILTER
═══════════════════════════════════════════════════════════════ */
document.getElementById("categories-scroll").addEventListener("click", (e) => {
  const chip = e.target.closest(".category-chip");
  if (!chip) return;

  document.querySelectorAll(".category-chip").forEach(c => c.classList.remove("active"));
  chip.classList.add("active");

  currentCategory = chip.dataset.category || "all";
  renderMangaFeed(allMangaData, currentCategory);
});

/* ═══════════════════════════════════════════════════════════════
   RENDER MANGA FEED (Home)
═══════════════════════════════════════════════════════════════ */
function renderMangaFeed(mangaList, category = "all") {
  const feedEl = document.getElementById("manga-feed");
  const emptyEl = document.getElementById("feed-empty");
  const loadingEl = document.getElementById("feed-loading");

  loadingEl.style.display = "none";

  let filtered = mangaList;
  if (category !== "all") {
    filtered = mangaList.filter(m => m.category === category);
  }

  feedEl.innerHTML = "";

  if (filtered.length === 0) {
    emptyEl.classList.remove("hidden");
    return;
  }

  emptyEl.classList.add("hidden");

  filtered.forEach(manga => {
    const row = createMangaRow(manga);
    feedEl.appendChild(row);
  });
}

function createMangaRow(manga) {
  const row = document.createElement("div");
  row.className = "manga-row";
  row.setAttribute("data-manga-id", manga.id);
  row.setAttribute("role", "article");

  const coverUrl = manga.coverUrl || "https://placehold.co/90x140/1a1a2e/7c6af7?text=No+Cover";
  const status = manga.status || "Ongoing";
  const statusClass = status.toLowerCase() === "completed" ? "completed" : "ongoing";
  const category = manga.category || "";
  const title = escapeHtml(manga.title || "Untitled");
  const latestChapters = manga._latestChapters || [];

  let chaptersHTML = "";
  if (latestChapters.length > 0) {
    latestChapters.forEach(ch => {
      const chName = ch.chapterName
        ? `Ch. ${escapeHtml(String(ch.chapterNumber))} — ${escapeHtml(ch.chapterName)}`
        : `Ch. ${escapeHtml(String(ch.chapterNumber))}`;
      chaptersHTML += `
        <div class="chapter-item" data-chapter-id="${escapeHtml(ch.id)}" data-manga-id="${escapeHtml(manga.id)}">
          <span class="chapter-name">
            <i class="fa-solid fa-book-open"></i>
            <span>${chName}</span>
          </span>
          <span class="chapter-time">${timeAgo(ch.createdAt)}</span>
        </div>
      `;
    });
  } else {
    chaptersHTML = `<div class="chapter-item"><span class="chapter-name" style="color: var(--text-muted);"><i class="fa-regular fa-clock"></i> No chapters yet</span></div>`;
  }

  row.innerHTML = `
    <div class="manga-row-cover">
      <img src="${coverUrl}" alt="${title} cover" loading="lazy" />
      <span class="manga-status-badge ${statusClass}">${escapeHtml(status)}</span>
    </div>
    <div class="manga-row-info">
      <div class="manga-row-title">${title}</div>
      ${category ? `<span class="manga-category-tag"><i class="fa-solid fa-tag"></i>${escapeHtml(category)}</span>` : ""}
      <div class="manga-chapters-list">${chaptersHTML}</div>
    </div>
  `;

  // Click on the row itself -> detail view
  row.addEventListener("click", (e) => {
    // Check if clicking on a chapter item
    const chapterItem = e.target.closest(".chapter-item");
    if (chapterItem) {
      const chapterId = chapterItem.dataset.chapterId;
      const mId = chapterItem.dataset.mangaId;
      if (chapterId && mId) {
        e.stopPropagation();
        openChapterReader(mId, chapterId);
        return;
      }
    }
    openMangaDetail(manga.id);
  });

  return row;
}

/* ═══════════════════════════════════════════════════════════════
   LOAD MANGA DATA
═══════════════════════════════════════════════════════════════ */
async function loadAllManga() {
  const loadingEl = document.getElementById("feed-loading");
  loadingEl.style.display = "flex";
  document.getElementById("manga-feed").innerHTML = "";
  document.getElementById("feed-empty").classList.add("hidden");

  try {
    const mangaList = await getAllManga();

    // Fetch latest 3 chapters for each manga concurrently
    await Promise.all(
      mangaList.map(async (manga) => {
        try {
          manga._latestChapters = await getLatestChapters(manga.id, 3);
        } catch {
          manga._latestChapters = [];
        }
      })
    );

    allMangaData = mangaList;
    renderMangaFeed(allMangaData, currentCategory);
  } catch (err) {
    loadingEl.style.display = "none";
    showToast("Failed to load manga: " + err.message, "error");
    console.error(err);
  }
}

/* ═══════════════════════════════════════════════════════════════
   MANGA DETAIL VIEW
═══════════════════════════════════════════════════════════════ */
async function openMangaDetail(mangaId) {
  currentMangaId = mangaId;
  showView("detail");

  // Reset UI
  document.getElementById("detail-manga-title").textContent = "Loading...";
  document.getElementById("detail-description").textContent = "";
  document.getElementById("detail-cover-img").src = "";
  document.getElementById("detail-title").textContent = "Loading...";
  document.getElementById("detail-chapters-list").innerHTML = "";
  document.getElementById("detail-chapters-loading").style.display = "flex";
  document.getElementById("detail-chapters-empty").classList.add("hidden");
  document.getElementById("manga-comments-list").innerHTML = "";
  document.getElementById("manga-comment-count").textContent = "";

  try {
    const manga = allMangaData.find(m => m.id === mangaId) || await getMangaById(mangaId);

    if (!manga) {
      showToast("Manga not found.", "error");
      showView("home");
      return;
    }

    const coverUrl = manga.coverUrl || "https://placehold.co/120x180/1a1a2e/7c6af7?text=No+Cover";
    const status = manga.status || "Ongoing";
    const statusClass = status.toLowerCase() === "completed" ? "completed" : "ongoing";

    document.getElementById("detail-title").textContent = manga.title || "Untitled";
    document.getElementById("detail-manga-title").textContent = manga.title || "Untitled";
    document.getElementById("detail-cover-img").src = coverUrl;
    document.getElementById("detail-cover-img").alt = manga.title;
    document.getElementById("detail-description").textContent = manga.description || "No description available.";

    const statusBadge = document.getElementById("detail-status-badge");
    statusBadge.textContent = status;
    statusBadge.className = `manga-status-badge ${statusClass}`;
    statusBadge.style.position = "static";
    statusBadge.style.borderRadius = "4px";

    const categoryTag = document.getElementById("detail-category-tag");
    if (manga.category) {
      categoryTag.innerHTML = `<i class="fa-solid fa-tag"></i>${escapeHtml(manga.category)}`;
      categoryTag.style.display = "inline-flex";
    } else {
      categoryTag.style.display = "none";
    }

    // Load chapters
    await loadDetailChapters(mangaId);

    // Load comments
    await loadMangaComments(mangaId);

  } catch (err) {
    showToast("Error loading manga: " + err.message, "error");
    showView("home");
  }
}

async function loadDetailChapters(mangaId) {
  const listEl = document.getElementById("detail-chapters-list");
  const loadingEl = document.getElementById("detail-chapters-loading");
  const emptyEl = document.getElementById("detail-chapters-empty");

  loadingEl.style.display = "flex";
  listEl.innerHTML = "";

  try {
    const chapters = await getChaptersByManga(mangaId);

    loadingEl.style.display = "none";
    document.getElementById("detail-chapter-count").textContent = `(${chapters.length})`;

    if (chapters.length === 0) {
      emptyEl.classList.remove("hidden");
      return;
    }

    emptyEl.classList.add("hidden");

    chapters.forEach(ch => {
      const item = document.createElement("div");
      item.className = "chapter-list-item";
      const chName = ch.chapterName
        ? `Ch. ${escapeHtml(String(ch.chapterNumber))} — ${escapeHtml(ch.chapterName)}`
        : `Ch. ${escapeHtml(String(ch.chapterNumber))}`;

      item.innerHTML = `
        <div class="chapter-list-name">
          <i class="fa-solid fa-book-open"></i>
          <span>${chName}</span>
        </div>
        <span class="chapter-list-time">${timeAgo(ch.createdAt)}</span>
      `;

      item.addEventListener("click", () => openChapterReader(mangaId, ch.id));
      listEl.appendChild(item);
    });

  } catch (err) {
    loadingEl.style.display = "none";
    showToast("Failed to load chapters.", "error");
    console.error(err);
  }
}

// Detail back button
document.getElementById("detail-back-btn").addEventListener("click", () => {
  currentMangaId = null;
  showView("home");
});

/* ═══════════════════════════════════════════════════════════════
   CHAPTER READER
═══════════════════════════════════════════════════════════════ */
async function openChapterReader(mangaId, chapterId) {
  currentMangaId = mangaId;
  currentChapterId = chapterId;
  showView("reader");

  document.getElementById("reader-chapter-title").textContent = "Loading...";
  document.getElementById("reader-pages-container").innerHTML = `
    <div style="text-align:center; padding:40px; color: var(--text-muted);">
      <i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;"></i>
      <p style="margin-top:12px; font-size:0.9rem;">Loading chapter...</p>
    </div>
  `;

  try {
    const manga = allMangaData.find(m => m.id === mangaId) || await getMangaById(mangaId);
    const allChapters = await getChaptersByManga(mangaId);
    const chapter = allChapters.find(c => c.id === chapterId);

    if (!chapter) {
      showToast("Chapter not found.", "error");
      showView("detail");
      return;
    }

    const chName = chapter.chapterName
      ? `Ch. ${chapter.chapterNumber} — ${chapter.chapterName}`
      : `Ch. ${chapter.chapterNumber}`;
    const fullTitle = manga ? `${manga.title} — ${chName}` : chName;
    document.getElementById("reader-chapter-title").textContent = fullTitle;

    const pagesContainer = document.getElementById("reader-pages-container");
    pagesContainer.innerHTML = "";

    const pages = chapter.pages || [];
    if (pages.length === 0) {
      pagesContainer.innerHTML = `
        <div class="empty-state" style="padding:60px 20px;">
          <i class="fa-solid fa-image"></i>
          <h3>No pages uploaded</h3>
          <p>This chapter has no images yet.</p>
        </div>
      `;
    } else {
      pages.forEach((url, idx) => {
        const img = document.createElement("img");
        img.className = "reader-page-img";
        img.src = url;
        img.alt = `Page ${idx + 1}`;
        img.loading = "lazy";
        pagesContainer.appendChild(img);
      });
    }

    // Load chapter comments
    await loadChapterComments(mangaId, chapterId);

  } catch (err) {
    showToast("Error loading chapter: " + err.message, "error");
    showView("detail");
    console.error(err);
  }
}

// Reader back button (returns to detail view of same manga)
document.getElementById("reader-back-btn").addEventListener("click", () => {
  currentChapterId = null;
  if (currentMangaId) {
    openMangaDetail(currentMangaId);
  } else {
    showView("home");
  }
});

/* ═══════════════════════════════════════════════════════════════
   COMMENTS
═══════════════════════════════════════════════════════════════ */
function renderComments(containerEl, comments, countEl) {
  containerEl.innerHTML = "";

  if (countEl) {
    countEl.textContent = comments.length > 0 ? `(${comments.length})` : "";
  }

  if (comments.length === 0) {
    containerEl.innerHTML = `<div class="comments-empty"><i class="fa-regular fa-comment" style="margin-right:6px;"></i>No comments yet. Be the first!</div>`;
    return;
  }

  comments.forEach(comment => {
    const item = document.createElement("div");
    item.className = "comment-item";

    const avatarUrl = comment.userPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.userName || "User")}&background=7c6af7&color=fff&size=64`;

    item.innerHTML = `
      <img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(comment.userName || 'User')}" class="comment-avatar" />
      <div class="comment-body">
        <div class="comment-meta">
          <span class="comment-username">${escapeHtml(comment.userName || "Anonymous")}</span>
          <span class="comment-time">${timeAgo(comment.createdAt)}</span>
        </div>
        <div class="comment-text">${escapeHtml(comment.text)}</div>
      </div>
    `;

    containerEl.appendChild(item);
  });
}

async function loadMangaComments(mangaId) {
  const listEl = document.getElementById("manga-comments-list");
  const countEl = document.getElementById("manga-comment-count");

  try {
    const comments = await getComments(mangaId, null);
    renderComments(listEl, comments, countEl);
  } catch (err) {
    console.error("Failed to load manga comments:", err);
  }
}

async function loadChapterComments(mangaId, chapterId) {
  const listEl = document.getElementById("chapter-comments-list");
  const countEl = document.getElementById("chapter-comment-count");

  try {
    const comments = await getComments(mangaId, chapterId);
    renderComments(listEl, comments, countEl);
  } catch (err) {
    console.error("Failed to load chapter comments:", err);
  }
}

// Submit manga comment
document.getElementById("manga-comment-submit-btn").addEventListener("click", async () => {
  if (!currentUser || !currentUserProfile) {
    showToast("Please login to comment.", "info");
    return;
  }

  const input = document.getElementById("manga-comment-input");
  const text = input.value.trim();

  if (!text) {
    showToast("Comment cannot be empty.", "info");
    return;
  }

  if (!currentMangaId) return;

  const btn = document.getElementById("manga-comment-submit-btn");
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Posting...`;

  try {
    await addComment(currentMangaId, {
      text,
      userName: currentUserProfile.displayName || currentUser.displayName || "Reader",
      userPhoto: currentUserProfile.photoURL || currentUser.photoURL || "",
      userId: currentUser.uid
    }, null);

    input.value = "";
    await loadMangaComments(currentMangaId);
    showToast("Comment posted!", "success");
  } catch (err) {
    showToast("Failed to post comment: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> <span>Post Comment</span>`;
  }
});

// Submit chapter comment
document.getElementById("chapter-comment-submit-btn").addEventListener("click", async () => {
  if (!currentUser || !currentUserProfile) {
    showToast("Please login to comment.", "info");
    return;
  }

  const input = document.getElementById("chapter-comment-input");
  const text = input.value.trim();

  if (!text) {
    showToast("Comment cannot be empty.", "info");
    return;
  }

  if (!currentMangaId || !currentChapterId) return;

  const btn = document.getElementById("chapter-comment-submit-btn");
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Posting...`;

  try {
    await addComment(currentMangaId, {
      text,
      userName: currentUserProfile.displayName || currentUser.displayName || "Reader",
      userPhoto: currentUserProfile.photoURL || currentUser.photoURL || "",
      userId: currentUser.uid
    }, currentChapterId);

    input.value = "";
    await loadChapterComments(currentMangaId, currentChapterId);
    showToast("Comment posted!", "success");
  } catch (err) {
    showToast("Failed to post comment: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> <span>Post Comment</span>`;
  }
});

/* ═══════════════════════════════════════════════════════════════
   SEARCH
═══════════════════════════════════════════════════════════════ */
const searchInput = document.getElementById("search-input");
const searchDropdown = document.getElementById("search-results-dropdown");
let searchTimeout = null;

searchInput.addEventListener("input", () => {
  clearTimeout(searchTimeout);
  const query = searchInput.value.trim().toLowerCase();

  if (!query) {
    searchDropdown.classList.remove("active");
    return;
  }

  searchTimeout = setTimeout(() => {
    const results = allMangaData.filter(m =>
      (m.title || "").toLowerCase().includes(query) ||
      (m.category || "").toLowerCase().includes(query)
    ).slice(0, 8);

    searchDropdown.innerHTML = "";

    if (results.length === 0) {
      searchDropdown.innerHTML = `<div style="padding:16px; text-align:center; color:var(--text-muted); font-size:0.85rem;"><i class="fa-solid fa-magnifying-glass" style="margin-right:6px;"></i>No results found</div>`;
    } else {
      results.forEach(manga => {
        const item = document.createElement("div");
        item.className = "search-result-item";
        item.setAttribute("role", "option");
        const coverUrl = manga.coverUrl || "https://placehold.co/40x56/1a1a2e/7c6af7?text=?";

        item.innerHTML = `
          <img src="${escapeHtml(coverUrl)}" alt="${escapeHtml(manga.title)}" class="search-result-cover" loading="lazy" />
          <div class="search-result-info">
            <div class="search-result-title">${escapeHtml(manga.title || "Untitled")}</div>
            <div class="search-result-category">${escapeHtml(manga.category || "")}</div>
          </div>
        `;

        item.addEventListener("click", () => {
          searchInput.value = "";
          searchDropdown.classList.remove("active");
          openMangaDetail(manga.id);
        });

        searchDropdown.appendChild(item);
      });
    }

    searchDropdown.classList.add("active");
  }, 300);
});

searchInput.addEventListener("blur", () => {
  setTimeout(() => {
    searchDropdown.classList.remove("active");
  }, 200);
});

/* ═══════════════════════════════════════════════════════════════
   ADMIN: Navigation
═══════════════════════════════════════════════════════════════ */
document.getElementById("sidebar-admin-btn").addEventListener("click", () => {
  if (!currentUser || currentUser.email !== ADMIN_EMAIL) {
    showToast("Access denied.", "error");
    return;
  }
  showView("admin");
  closeSidebar();
  loadAdminMangaList();
  populateChapterMangaSelect();
});

/* ─── Admin Tabs ─────────────────────────────────────────────── */
document.querySelectorAll(".admin-tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".admin-tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".admin-tab-content").forEach(t => t.classList.remove("active"));

    btn.classList.add("active");
    const tabId = `tab-${btn.dataset.tab}`;
    document.getElementById(tabId).classList.add("active");
  });
});

/* ═══════════════════════════════════════════════════════════════
   ADMIN: Add Manga
═══════════════════════════════════════════════════════════════ */
const mangaCoverInput = document.getElementById("manga-cover-input");
let selectedCoverFile = null;

mangaCoverInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  selectedCoverFile = file;

  document.getElementById("manga-cover-label-text").textContent = file.name;

  const reader = new FileReader();
  reader.onload = (ev) => {
    const preview = document.getElementById("manga-cover-preview");
    const previewImg = document.getElementById("manga-cover-preview-img");
    previewImg.src = ev.target.result;
    preview.classList.add("visible");
  };
  reader.readAsDataURL(file);
});

document.getElementById("add-manga-submit-btn").addEventListener("click", async () => {
  const title = document.getElementById("manga-title-input").value.trim();
  const description = document.getElementById("manga-desc-input").value.trim();
  const category = document.getElementById("manga-category-select").value;
  const status = document.getElementById("manga-status-select").value;

  if (!title) { showToast("Please enter a title.", "info"); return; }
  if (!category) { showToast("Please select a category.", "info"); return; }
  if (!selectedCoverFile) { showToast("Please select a cover image.", "info"); return; }

  const btn = document.getElementById("add-manga-submit-btn");
  const progress = document.getElementById("manga-upload-progress");
  btn.disabled = true;
  progress.classList.add("visible");
  document.getElementById("manga-upload-progress-text").textContent = "Uploading cover image...";

  try {
    const coverUrl = await uploadImageToImgBB(selectedCoverFile);

    document.getElementById("manga-upload-progress-text").textContent = "Saving to database...";
    const mangaId = await addManga({ title, description, category, status, coverUrl });

    showToast(`"${title}" added successfully!`, "success");

    // Reset form
    document.getElementById("manga-title-input").value = "";
    document.getElementById("manga-desc-input").value = "";
    document.getElementById("manga-category-select").value = "";
    document.getElementById("manga-status-select").value = "Ongoing";
    document.getElementById("manga-cover-label-text").textContent = "Select Cover Image from Gallery";
    document.getElementById("manga-cover-preview").classList.remove("visible");
    selectedCoverFile = null;
    mangaCoverInput.value = "";

    // Refresh manga list
    await loadAllManga();
    await loadAdminMangaList();
    await populateChapterMangaSelect();

  } catch (err) {
    showToast("Failed to add manga: " + err.message, "error");
    console.error(err);
  } finally {
    btn.disabled = false;
    progress.classList.remove("visible");
  }
});

/* ═══════════════════════════════════════════════════════════════
   ADMIN: Manage Manga
═══════════════════════════════════════════════════════════════ */
async function loadAdminMangaList() {
  const listEl = document.getElementById("admin-manga-list");
  listEl.innerHTML = `
    <div style="text-align:center; padding:20px; color:var(--text-muted);">
      <i class="fa-solid fa-spinner fa-spin"></i> Loading...
    </div>
  `;

  try {
    const mangaList = await getAllManga();

    if (mangaList.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state" style="padding:30px;">
          <i class="fa-solid fa-book-open"></i>
          <h3>No manga yet</h3>
          <p>Add some manga first.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = "";

    mangaList.forEach(manga => {
      const item = document.createElement("div");
      item.className = "admin-manga-item";

      const coverUrl = manga.coverUrl || "https://placehold.co/48x64/1a1a2e/7c6af7?text=?";

      item.innerHTML = `
        <img src="${escapeHtml(coverUrl)}" alt="${escapeHtml(manga.title)}" class="admin-manga-cover" />
        <div class="admin-manga-info">
          <div class="admin-manga-title">${escapeHtml(manga.title || "Untitled")}</div>
          <div class="admin-manga-category">${escapeHtml(manga.category || "")} · ${escapeHtml(manga.status || "")}</div>
        </div>
        <div class="admin-manga-actions">
          <button class="btn-edit admin-edit-btn" data-manga-id="${escapeHtml(manga.id)}" aria-label="Edit manga">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn-danger admin-delete-btn" data-manga-id="${escapeHtml(manga.id)}" data-manga-title="${escapeHtml(manga.title || 'Untitled')}" aria-label="Delete manga">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      `;

      listEl.appendChild(item);
    });

    // Attach edit/delete listeners
    listEl.querySelectorAll(".admin-edit-btn").forEach(btn => {
      btn.addEventListener("click", () => openEditModal(btn.dataset.mangaId));
    });

    listEl.querySelectorAll(".admin-delete-btn").forEach(btn => {
      btn.addEventListener("click", () => openDeleteModal(btn.dataset.mangaId, btn.dataset.mangaTitle));
    });

  } catch (err) {
    listEl.innerHTML = `<div style="color:var(--accent-red); padding:16px; font-size:0.85rem;">Error loading list.</div>`;
    console.error(err);
  }
}

document.getElementById("refresh-manga-list-btn").addEventListener("click", loadAdminMangaList);

/* ═══════════════════════════════════════════════════════════════
   ADMIN: Edit Manga Modal
═══════════════════════════════════════════════════════════════ */
let editCoverFile = null;

async function openEditModal(mangaId) {
  const manga = allMangaData.find(m => m.id === mangaId) || await getMangaById(mangaId);
  if (!manga) { showToast("Manga not found.", "error"); return; }

  document.getElementById("edit-manga-id").value = manga.id;
  document.getElementById("edit-manga-title").value = manga.title || "";
  document.getElementById("edit-manga-desc").value = manga.description || "";
  document.getElementById("edit-manga-category").value = manga.category || "";
  document.getElementById("edit-manga-status").value = manga.status || "Ongoing";
  document.getElementById("edit-cover-label-text").textContent = "Select New Cover Image";
  editCoverFile = null;

  document.getElementById("edit-manga-modal").classList.add("active");
}

document.getElementById("edit-cover-input").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  editCoverFile = file;
  document.getElementById("edit-cover-label-text").textContent = file.name;
});

document.getElementById("edit-modal-close-btn").addEventListener("click", () => {
  document.getElementById("edit-manga-modal").classList.remove("active");
  editCoverFile = null;
});

document.getElementById("edit-manga-modal").addEventListener("click", (e) => {
  if (e.target === document.getElementById("edit-manga-modal")) {
    document.getElementById("edit-manga-modal").classList.remove("active");
  }
});

document.getElementById("edit-manga-save-btn").addEventListener("click", async () => {
  const mangaId = document.getElementById("edit-manga-id").value;
  const title = document.getElementById("edit-manga-title").value.trim();
  const description = document.getElementById("edit-manga-desc").value.trim();
  const category = document.getElementById("edit-manga-category").value;
  const status = document.getElementById("edit-manga-status").value;

  if (!title) { showToast("Title is required.", "info"); return; }

  const btn = document.getElementById("edit-manga-save-btn");
  const progress = document.getElementById("edit-upload-progress");
  btn.disabled = true;
  progress.classList.add("visible");

  try {
    const updates = { title, description, category, status };

    if (editCoverFile) {
      updates.coverUrl = await uploadImageToImgBB(editCoverFile);
    }

    await updateManga(mangaId, updates);
    showToast("Manga updated!", "success");

    document.getElementById("edit-manga-modal").classList.remove("active");
    editCoverFile = null;

    await loadAllManga();
    await loadAdminMangaList();

  } catch (err) {
    showToast("Update failed: " + err.message, "error");
    console.error(err);
  } finally {
    btn.disabled = false;
    progress.classList.remove("visible");
  }
});

/* ═══════════════════════════════════════════════════════════════
   ADMIN: Delete Manga Modal
═══════════════════════════════════════════════════════════════ */
function openDeleteModal(mangaId, mangaTitle) {
  document.getElementById("delete-manga-id").value = mangaId;
  document.getElementById("delete-manga-name").textContent = mangaTitle;
  document.getElementById("delete-confirm-modal").classList.add("active");
}

document.getElementById("delete-modal-close-btn").addEventListener("click", () => {
  document.getElementById("delete-confirm-modal").classList.remove("active");
});

document.getElementById("delete-cancel-btn").addEventListener("click", () => {
  document.getElementById("delete-confirm-modal").classList.remove("active");
});

document.getElementById("delete-confirm-modal").addEventListener("click", (e) => {
  if (e.target === document.getElementById("delete-confirm-modal")) {
    document.getElementById("delete-confirm-modal").classList.remove("active");
  }
});

document.getElementById("delete-confirm-btn").addEventListener("click", async () => {
  const mangaId = document.getElementById("delete-manga-id").value;
  if (!mangaId) return;

  const btn = document.getElementById("delete-confirm-btn");
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Deleting...`;

  try {
    await deleteManga(mangaId);
    showToast("Manga deleted.", "success");
    document.getElementById("delete-confirm-modal").classList.remove("active");

    await loadAllManga();
    await loadAdminMangaList();
    await populateChapterMangaSelect();

  } catch (err) {
    showToast("Delete failed: " + err.message, "error");
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-trash"></i> <span>Delete</span>`;
  }
});

/* ═══════════════════════════════════════════════════════════════
   ADMIN: Add Chapter
═══════════════════════════════════════════════════════════════ */
async function populateChapterMangaSelect() {
  const select = document.getElementById("chapter-manga-select");
  select.innerHTML = `<option value="">Select manga...</option>`;

  try {
    const mangaList = await getAllManga();
    mangaList.forEach(manga => {
      const opt = document.createElement("option");
      opt.value = manga.id;
      opt.textContent = manga.title || "Untitled";
      select.appendChild(opt);
    });
  } catch (err) {
    console.error("Failed to populate manga select:", err);
  }
}

let selectedPagesFiles = [];

document.getElementById("chapter-pages-input").addEventListener("change", (e) => {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;
  selectedPagesFiles = files;

  const labelText = document.getElementById("chapter-pages-label-text");
  labelText.textContent = `${files.length} image${files.length > 1 ? "s" : ""} selected`;

  const preview = document.getElementById("chapter-pages-preview");
  preview.innerHTML = "";
  preview.classList.add("visible");

  const countDiv = document.createElement("div");
  countDiv.className = "file-preview-count";
  countDiv.innerHTML = `<i class="fa-solid fa-images"></i> ${files.length} page${files.length > 1 ? "s" : ""} selected`;
  preview.appendChild(countDiv);
});

document.getElementById("add-chapter-submit-btn").addEventListener("click", async () => {
  const mangaId = document.getElementById("chapter-manga-select").value;
  const chapterNumber = document.getElementById("chapter-number-input").value.trim();
  const chapterName = document.getElementById("chapter-name-input").value.trim();

  if (!mangaId) { showToast("Please select a manga.", "info"); return; }
  if (!chapterNumber) { showToast("Please enter a chapter number.", "info"); return; }
  if (selectedPagesFiles.length === 0) { showToast("Please select chapter page images.", "info"); return; }

  const btn = document.getElementById("add-chapter-submit-btn");
  const progress = document.getElementById("chapter-upload-progress");
  btn.disabled = true;
  progress.classList.add("visible");

  const total = selectedPagesFiles.length;
  let uploaded = 0;

  const updateProgress = (n) => {
    document.getElementById("chapter-upload-progress-text").textContent = `Uploading pages... ${n} / ${total}`;
  };

  updateProgress(0);

  try {
    // Upload all pages concurrently with progress tracking
    const uploadPromises = selectedPagesFiles.map((file) =>
      uploadImageToImgBB(file).then(url => {
        uploaded++;
        updateProgress(uploaded);
        return url;
      })
    );

    const pageUrls = await Promise.all(uploadPromises);

    document.getElementById("chapter-upload-progress-text").textContent = "Saving to database...";

    await addChapter(mangaId, {
      chapterNumber: parseFloat(chapterNumber),
      chapterName: chapterName || null,
      pages: pageUrls
    });

    showToast(`Chapter ${chapterNumber} uploaded with ${pageUrls.length} pages!`, "success");

    // Reset form
    document.getElementById("chapter-manga-select").value = "";
    document.getElementById("chapter-number-input").value = "";
    document.getElementById("chapter-name-input").value = "";
    document.getElementById("chapter-pages-label-text").textContent = "Select Multiple Page Images";
    document.getElementById("chapter-pages-preview").innerHTML = "";
    document.getElementById("chapter-pages-preview").classList.remove("visible");
    selectedPagesFiles = [];
    document.getElementById("chapter-pages-input").value = "";

    // Refresh manga data
    await loadAllManga();

  } catch (err) {
    showToast("Chapter upload failed: " + err.message, "error");
    console.error(err);
  } finally {
    btn.disabled = false;
    progress.classList.remove("visible");
  }
});

/* ═══════════════════════════════════════════════════════════════
   SYSTEM QUEST POPUP (Solo Leveling style)
═══════════════════════════════════════════════════════════════ */
const DISCORD_INVITE_URL = "https://discord.gg/P4AgBnpfHU";
const SYSTEM_QUEST_TASK = "Join the official V Scans Guild on Discord.";
const SYSTEM_QUEST_REWARD = "Obtain the [Awakened Player] role & Chat Access.";
const SYSTEM_QUEST_SEEN_KEY = "vscans-system-quest-seen";

function typeText(el, text, speed = 28) {
  return new Promise((resolve) => {
    el.textContent = "";
    el.classList.add("typing");

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      el.textContent = text;
      el.classList.remove("typing");
      resolve();
      return;
    }

    let i = 0;
    function step() {
      if (i < text.length) {
        el.textContent += text.charAt(i);
        i++;
        setTimeout(step, speed);
      } else {
        el.classList.remove("typing");
        resolve();
      }
    }
    step();
  });
}

async function runSystemQuestSequence() {
  const taskEl = document.getElementById("system-task-text");
  const rewardEl = document.getElementById("system-reward-text");

  await typeText(taskEl, SYSTEM_QUEST_TASK, 25);
  await typeText(rewardEl, SYSTEM_QUEST_REWARD, 25);
}

function openSystemQuestModal() {
  const overlay = document.getElementById("system-quest-overlay");
  overlay.classList.add("active");
  document.body.style.overflow = "hidden";
  runSystemQuestSequence();
}

function closeSystemQuestModal() {
  const overlay = document.getElementById("system-quest-overlay");
  overlay.classList.remove("active");
  // Only restore scroll if the sidebar isn't also open
  if (!document.getElementById("sidebar").classList.contains("open")) {
    document.body.style.overflow = "";
  }
}

document.getElementById("system-accept-btn").addEventListener("click", () => {
  closeSystemQuestModal();
  window.open(DISCORD_INVITE_URL, "_blank", "noopener,noreferrer");
});

function initSystemQuestPopup() {
  // Show once per session (remove this check to show on every visit)
  if (sessionStorage.getItem(SYSTEM_QUEST_SEEN_KEY)) return;

  setTimeout(() => {
    openSystemQuestModal();
    sessionStorage.setItem(SYSTEM_QUEST_SEEN_KEY, "1");
  }, 2000);
}

/* ═══════════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════════ */
async function init() {
  initTheme();
  showView("home");
  await loadAllManga();
  initSystemQuestPopup();
}

init();
