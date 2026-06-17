import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { WebView } from "react-native-webview";

import { Screen } from "./Screen";
import { TopBar } from "./TopBar";
import { C } from "../constants/theme";
import { s } from "../styles/appStyles";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildPdfReaderHtml(base64Pdf, title, initialPage = 1) {
  const safeTitle = escapeHtml(title || "PDF Reader");
  const encodedPdf = JSON.stringify(base64Pdf);
  const safeInitialPage = Number.isFinite(Number(initialPage)) ? Math.max(1, Number(initialPage)) : 1;

  return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>
    html, body {
      margin: 0;
      padding: 0;
      background: #050505;
      color: white;
      height: 100%;
      overflow: hidden;
      font-family: Arial, sans-serif;
    }

    #toolbar {
      height: 52px;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      background: #111;
      box-sizing: border-box;
      border-bottom: 1px solid #2a2a2a;
    }

    button {
      background: #2a2a2a;
      color: white;
      border: 0;
      border-radius: 16px;
      padding: 8px 10px;
      font-weight: 800;
      font-size: 12px;
    }

    button:disabled {
      opacity: 0.4;
    }

    #pageInfo {
      flex: 1;
      text-align: center;
      color: #e0ad32;
      font-weight: 900;
      font-size: 12px;
    }

    #viewer {
      height: calc(100vh - 52px);
      overflow: auto;
      display: block;
      background: #050505;
      box-sizing: border-box;
      padding: 10px 0 24px;
      text-align: center;
      touch-action: none;
    }

    canvas {
      background: white;
      display: block;
      margin: 0 auto;
      width: auto;
      height: auto;
      max-width: none;
      touch-action: none;
      transform-origin: top center;
      will-change: transform;
      box-shadow: 0 8px 22px rgba(0,0,0,0.55);
    }

    #message {
      padding: 20px;
      color: #ddd;
      line-height: 1.5;
      text-align: center;
    }
  </style>
</head>
<body>
  <div id="toolbar">
    <button id="prevBtn">Prev</button>
    <button id="zoomOutBtn">−</button>
    <div id="pageInfo">Loading...</div>
    <button id="zoomInBtn">+</button>
    <button id="nextBtn">Next</button>
  </div>

  <div id="viewer">
    <canvas id="pdfCanvas"></canvas>
    <div id="message" style="display:none;"></div>
  </div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <script>
    const base64Pdf = ${encodedPdf};
    const initialPage = ${safeInitialPage};

    let pdfDoc = null;
    let pageNum = initialPage;
    let scale = 1.15;
    let rendering = false;
    let pendingPage = null;
    let pinchStartDistance = 0;
    let pinchStartScale = 1.15;

    const viewer = document.getElementById("viewer");
    const canvas = document.getElementById("pdfCanvas");
    const ctx = canvas.getContext("2d");
    const pageInfo = document.getElementById("pageInfo");
    const message = document.getElementById("message");

    function post(type, payload) {
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, payload }));
      } catch (_) {}
    }

    function showMessage(text) {
      canvas.style.display = "none";
      message.style.display = "block";
      message.textContent = text;
    }

    function clampScale(value) {
      return Math.max(0.65, Math.min(3, Number(value.toFixed(2))));
    }

    function applyPinchPreview() {
      if (!pinchStartScale) return;
      const visualRatio = scale / pinchStartScale;
      canvas.style.transform = "scale(" + visualRatio + ")";
    }

    function resetPinchPreview() {
      canvas.style.transform = "none";
    }

    function touchDistance(touches) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function sendPageState() {
      if (!pdfDoc) return;
      post("PAGE_STATE", {
        page: pageNum,
        totalPages: pdfDoc.numPages,
        scale
      });
    }

    function updateButtons() {
      document.getElementById("prevBtn").disabled = pageNum <= 1;
      document.getElementById("nextBtn").disabled = !pdfDoc || pageNum >= pdfDoc.numPages;
      pageInfo.textContent = pdfDoc
        ? "Page " + pageNum + " / " + pdfDoc.numPages + " · " + Math.round(scale * 100) + "%"
        : "Loading...";
      sendPageState();
    }

    function queueRenderPage(num) {
      if (rendering) {
        pendingPage = num;
      } else {
        renderPage(num);
      }
    }

    async function renderPage(num) {
      if (!pdfDoc) return;

      resetPinchPreview();
      rendering = true;
      updateButtons();

      try {
        const page = await pdfDoc.getPage(num);
        const viewport = page.getViewport({ scale });

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
          canvasContext: ctx,
          viewport
        }).promise;
      } catch (error) {
        showMessage("Unable to render this page.");
      }

      rendering = false;
      updateButtons();

      if (pendingPage !== null) {
        const next = pendingPage;
        pendingPage = null;
        renderPage(next);
      }
    }

    function goToPage(num) {
      if (!pdfDoc) return;
      pageNum = Math.max(1, Math.min(pdfDoc.numPages, Number(num) || 1));
      queueRenderPage(pageNum);
    }

    window.goToPage = goToPage;

    document.getElementById("prevBtn").addEventListener("click", () => goToPage(pageNum - 1));
    document.getElementById("nextBtn").addEventListener("click", () => goToPage(pageNum + 1));

    document.getElementById("zoomOutBtn").addEventListener("click", () => {
      scale = clampScale(scale - 0.2);
      queueRenderPage(pageNum);
    });

    document.getElementById("zoomInBtn").addEventListener("click", () => {
      scale = clampScale(scale + 0.2);
      queueRenderPage(pageNum);
    });

    viewer.addEventListener("touchstart", event => {
      if (event.touches.length === 2) {
        event.preventDefault();
        pinchStartDistance = touchDistance(event.touches);
        pinchStartScale = scale;
        resetPinchPreview();
      }
    }, { passive: false });

    viewer.addEventListener("touchmove", event => {
      if (event.touches.length === 2 && pinchStartDistance > 0) {
        event.preventDefault();

        const nextDistance = touchDistance(event.touches);
        const ratio = nextDistance / pinchStartDistance;
        scale = clampScale(pinchStartScale * ratio);

        updateButtons();
        applyPinchPreview();
      }
    }, { passive: false });

    viewer.addEventListener("touchend", event => {
      if (event.touches.length < 2 && pinchStartDistance > 0) {
        event.preventDefault();
        pinchStartDistance = 0;
        pinchStartScale = scale;
        resetPinchPreview();
        queueRenderPage(pageNum);
      }
    }, { passive: false });

    viewer.addEventListener("touchcancel", () => {
      pinchStartDistance = 0;
      pinchStartScale = scale;
      resetPinchPreview();
    }, { passive: false });

    async function start() {
      try {
        if (!window.pdfjsLib) {
          showMessage("Reader failed to load. Check internet connection and try again.");
          return;
        }

        pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

        const binary = atob(base64Pdf);
        const length = binary.length;
        const bytes = new Uint8Array(length);

        for (let i = 0; i < length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
        pageNum = Math.max(1, Math.min(pdfDoc.numPages, initialPage));
        updateButtons();
        renderPage(pageNum);
      } catch (error) {
        showMessage("Unable to open this PDF in the reader.");
      }
    }

    start();
  </script>
</body>
</html>`;
}

async function pdfUriToBase64(uri) {
  if (!uri) throw new Error("Missing PDF file.");

  if (uri.startsWith("file://")) {
    return FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64
    });
  }

  const target = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}reader-${Date.now()}.pdf`;
  const result = await FileSystem.downloadAsync(uri, target);

  if (result?.status && result.status >= 400) {
    throw new Error(`PDF download failed with HTTP ${result.status}`);
  }

  return FileSystem.readAsStringAsync(result.uri, {
    encoding: FileSystem.EncodingType.Base64
  });
}

export function ExpoPdfReader({
  title,
  sourceUri,
  go,
  onBack,
  appLanguage = "en",
  itemId,
  readerState = {},
  readerFeaturesEnabled = false,
  onRequireLogin,
  onReaderStateChange
}) {
  const webViewRef = useRef(null);
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(readerFeaturesEnabled ? Number(readerState.lastPage || 1) : 1);
  const [totalPages, setTotalPages] = useState(readerFeaturesEnabled ? Number(readerState.totalPages || 0) : 0);
  const [noteOpen, setNoteOpen] = useState(false);
  const [bookmarkOpen, setBookmarkOpen] = useState(false);
  const [draftNote, setDraftNote] = useState("");

  const bookmarks = Array.isArray(readerState.bookmarks) ? readerState.bookmarks : [];
  const notes = readerState.notes && typeof readerState.notes === "object" ? readerState.notes : {};
  const hasBookmark = bookmarks.includes(page);
  const pageNote = notes[String(page)] || "";

  function savePatch(patch) {
    if (!readerFeaturesEnabled || !itemId || typeof onReaderStateChange !== "function") return;

    onReaderStateChange(itemId, {
      ...patch,
      updatedAt: new Date().toISOString()
    });
  }

  function jumpToPage(nextPage) {
    const safePage = Math.max(1, Math.min(totalPages || nextPage, Number(nextPage) || 1));
    webViewRef.current?.injectJavaScript(`window.goToPage && window.goToPage(${safePage}); true;`);
    setBookmarkOpen(false);
  }

  function toggleBookmark() {
    const nextBookmarks = hasBookmark
      ? bookmarks.filter(item => item !== page)
      : [...bookmarks, page].sort((a, b) => a - b);

    savePatch({ bookmarks: nextBookmarks, lastPage: page, totalPages });
  }

  function openNoteEditor() {
    setDraftNote(pageNote);
    setNoteOpen(true);
  }

  function saveNote() {
    const nextNotes = { ...notes };
    const key = String(page);

    if (draftNote.trim()) {
      nextNotes[key] = draftNote.trim();
    } else {
      delete nextNotes[key];
    }

    savePatch({ notes: nextNotes, lastPage: page, totalPages });
    setNoteOpen(false);
  }

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const base64 = await pdfUriToBase64(sourceUri);
        if (!active) return;
        setHtml(buildPdfReaderHtml(base64, title, readerFeaturesEnabled ? readerState.lastPage || 1 : 1));
      } catch (error) {
        Alert.alert("Reader", error instanceof Error ? error.message : "Unable to open this PDF.");
        if (typeof onBack === "function") onBack();
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [sourceUri, title, readerFeaturesEnabled, readerState.lastPage]);

  function handleMessage(event) {
    try {
      const message = JSON.parse(event.nativeEvent.data || "{}");
      if (message.type !== "PAGE_STATE") return;

      const nextPage = Number(message.payload?.page || 1);
      const nextTotal = Number(message.payload?.totalPages || 0);

      setPage(nextPage);
      setTotalPages(nextTotal);

      savePatch({
        lastPage: nextPage,
        totalPages: nextTotal
      });
    } catch {
      // Ignore malformed WebView messages.
    }
  }

  return (
    <Screen>
      <TopBar title={title || "Library Reader"} go={go} back="Library" onBack={onBack} appLanguage={appLanguage} />

      {readerFeaturesEnabled ? (
        <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingBottom: 10 }}>
          <Pressable style={[s.actionBtn, hasBookmark && { backgroundColor: C.gold }]} onPress={toggleBookmark}>
            <Text style={[s.actionText, hasBookmark && { color: C.black }]}>
              {hasBookmark ? "Bookmarked" : "Bookmark"}
            </Text>
          </Pressable>

          <Pressable style={s.actionBtn} onPress={openNoteEditor}>
            <Text style={s.actionText}>{pageNote ? "Edit Note" : "Add Note"}</Text>
          </Pressable>

          <Pressable style={s.actionBtn} onPress={() => setBookmarkOpen(true)}>
            <Text style={s.actionText}>Bookmarks</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 12, paddingBottom: 10 }}>
          <View style={[s.plainCard, { backgroundColor: C.surface2, marginBottom: 0 }]}>
            <Text style={[s.rowTitle, { color: C.white }]}>Sign in to save reading progress</Text>
            <Text style={[s.mutedText, { color: C.muted, marginTop: 6 }]}>
              Bookmarks, notes, resume-last-page, and future highlights are available for logged-in members.
            </Text>
            <Pressable style={[s.primaryBtn, { alignSelf: "flex-start" }]} onPress={onRequireLogin}>
              <Text style={s.primaryText}>Login / Register</Text>
            </Pressable>
          </View>
        </View>
      )}

      {loading || !html ? (
        <View style={[s.empty, { flex: 1 }]}>
          <ActivityIndicator color={C.gold} />
          <Text style={[s.mutedText, { color: C.muted, marginTop: 12 }]}>Preparing reader...</Text>
        </View>
      ) : (
        <View style={{ flex: 1, borderRadius: 12, overflow: "hidden", backgroundColor: C.background }}>
          <WebView
            ref={webViewRef}
            originWhitelist={["*"]}
            source={{ html, baseUrl: "" }}
            javaScriptEnabled
            domStorageEnabled
            allowFileAccess
            allowUniversalAccessFromFileURLs
            mixedContentMode="always"
            onMessage={handleMessage}
            style={{ flex: 1, backgroundColor: C.background }}
          />
        </View>
      )}

      <Modal visible={noteOpen} transparent animationType="slide" onRequestClose={() => setNoteOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: C.surface, padding: 16, borderTopLeftRadius: 18, borderTopRightRadius: 18 }}>
            <Text style={[s.rowTitle, { color: C.white }]}>Note for page {page}</Text>
            <TextInput
              value={draftNote}
              onChangeText={setDraftNote}
              multiline
              placeholder="Write your study note here..."
              placeholderTextColor={C.muted}
              style={{
                minHeight: 120,
                marginTop: 12,
                backgroundColor: C.surface2,
                color: C.white,
                borderRadius: 12,
                padding: 12,
                textAlignVertical: "top"
              }}
            />

            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <Pressable style={[s.actionBtn, { flex: 1, justifyContent: "center" }]} onPress={() => setNoteOpen(false)}>
                <Text style={s.actionText}>Cancel</Text>
              </Pressable>
              <Pressable style={[s.primaryBtn, { flex: 1, marginTop: 0 }]} onPress={saveNote}>
                <Text style={s.primaryText}>Save Note</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={bookmarkOpen} transparent animationType="slide" onRequestClose={() => setBookmarkOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "flex-end" }}>
          <View style={{ maxHeight: "70%", backgroundColor: C.surface, padding: 16, borderTopLeftRadius: 18, borderTopRightRadius: 18 }}>
            <Text style={[s.rowTitle, { color: C.white }]}>Saved Bookmarks</Text>

            <ScrollView style={{ marginTop: 12 }}>
              {bookmarks.length === 0 ? (
                <Text style={[s.mutedText, { color: C.muted }]}>No bookmarked pages yet.</Text>
              ) : (
                bookmarks.map(bookmarkPage => (
                  <Pressable
                    key={bookmarkPage}
                    style={[s.plainCard, { backgroundColor: C.surface2 }]}
                    onPress={() => jumpToPage(bookmarkPage)}
                  >
                    <Text style={[s.rowTitle, { color: C.white }]}>Page {bookmarkPage}</Text>
                    {notes[String(bookmarkPage)] ? (
                      <Text style={[s.mutedText, { color: C.muted, marginTop: 6 }]} numberOfLines={2}>
                        {notes[String(bookmarkPage)]}
                      </Text>
                    ) : null}
                  </Pressable>
                ))
              )}
            </ScrollView>

            <Pressable style={s.primaryBtn} onPress={() => setBookmarkOpen(false)}>
              <Text style={s.primaryText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
