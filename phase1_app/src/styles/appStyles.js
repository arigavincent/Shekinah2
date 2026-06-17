import { StyleSheet } from "react-native";

import { ANDROID_STATUS_BAR_HEIGHT, makeThemedStyles } from "../constants/theme";

export const s = makeThemedStyles(C => ({
  app: { flex: 1, backgroundColor: C.background },
  screen: { flex: 1, backgroundColor: C.background, paddingBottom: 76 },
  scrollPad: { paddingHorizontal: 16, paddingBottom: 120 },
  pad: { paddingHorizontal: 16, paddingVertical: 10 },
  topBar: {
    minHeight: 94 + ANDROID_STATUS_BAR_HEIGHT,
    paddingTop: ANDROID_STATUS_BAR_HEIGHT + 16,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.background
  },
  topIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.surface2,
    alignItems: "center",
    justifyContent: "center"
  },
  topRight: {
    minWidth: 52,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8
  },
  logoWrap: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1
  },
  logo: { width: 92, height: 34, borderRadius: 4 },
  logoText: { fontFamily: C.fontDisplay,
    color: C.white,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 4,
    textAlign: "center"
  },
  floatingMenu: {
    position: "absolute",
    top: ANDROID_STATUS_BAR_HEIGHT + 18,
    left: 14,
    zIndex: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.surface2,
    alignItems: "center",
    justifyContent: "center"
  },
  devotionHero: { flexDirection: "row", backgroundColor: C.surface, borderRadius: 8, padding: 10, marginTop: 6, gap: 12 },
  devotionThumb: { width: 108, height: 126, borderRadius: 8 },
  badgeOnImage: { position: "absolute", top: 8, right: 8, backgroundColor: C.blue2, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { color: C.textOnBrand, fontSize: 10, fontWeight: "800" },
  devotionBody: { flex: 1, justifyContent: "center" },
  cardTitle: { fontFamily: C.fontDisplay, color: C.white, fontSize: 16, fontWeight: "800", marginBottom: 6 },
  mutedText: { fontFamily: C.fontBody, color: C.muted, fontSize: 13, lineHeight: 19 },
  goldSmall: { fontFamily: C.fontBold, color: C.gold, fontSize: 12, fontWeight: "700", marginTop: 6 },
  scriptureCard: { backgroundColor: C.blue, borderRadius: 8, padding: 16, marginTop: 14 },
  scriptureHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  verseText: { fontFamily: C.fontDisplay, color: C.textOnBrand, fontSize: 19, fontWeight: "800", lineHeight: 27, marginTop: 10 },
  smallCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface2, alignItems: "center", justifyContent: "center" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24, marginBottom: 10 },
  sectionTitle: { fontFamily: C.fontDisplay, color: C.white, fontSize: 20, fontWeight: "900" },
  viewAll: { backgroundColor: C.surface2, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  viewAllText: { fontFamily: C.fontBold, color: C.white, fontSize: 12, fontWeight: "800" },
  horizontal: { gap: 12, paddingRight: 16 },
  videoCard: { width: 178 },
  wideVideoCard: { width: "100%", marginBottom: 16 },
  videoThumb: { width: "100%", height: 116, borderRadius: 8, backgroundColor: C.surface2 },
  audioCard: { width: 108 },
  audioThumb: { width: 108, height: 108, borderRadius: 8, backgroundColor: C.surface2 },
  smallTitle: { fontFamily: C.fontBody, color: C.white, fontSize: 12, fontWeight: "700", marginTop: 8, lineHeight: 16 },
  clipCard: { width: 130, height: 130, borderRadius: 8, overflow: "hidden" },
  clipImage: { width: "100%", height: "100%" },
  clipOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end", padding: 10 },
  clipText: { color: C.textOnBrand, fontSize: 15, fontWeight: "900" },
  eventMini: { width: 196, backgroundColor: C.surface, borderRadius: 8, paddingBottom: 10 },
  eventMiniImage: { width: "100%", height: 102, borderTopLeftRadius: 8, borderTopRightRadius: 8, marginBottom: 10 },
  searchInput: { backgroundColor: C.surface2, color: C.white, borderRadius: 24, paddingHorizontal: 16, height: 48, fontSize: 14, marginBottom: 10, fontWeight: "800",},
  listRow: { flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  rowImage: { width: 72, height: 72, borderRadius: 8, backgroundColor: C.surface2 },
  rowBody: { flex: 1 },
  rowTitle: { fontFamily: C.fontDisplay, color: C.white, fontSize: 15, fontWeight: "800", lineHeight: 20 },
  tabs: { flexDirection: "row", paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  tabBtn: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center" },
  tabText: { fontFamily: C.fontBold, color: C.muted, fontSize: 13, fontWeight: "800" },
  tabActiveText: { color: C.white },
  tabUnderline: { position: "absolute", bottom: 0, height: 3, width: "58%", borderRadius: 3, backgroundColor: C.gold },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  categoryCard: { width: "47%", marginBottom: 10 },
  categoryImage: { width: "100%", aspectRatio: 1, borderRadius: 8, marginBottom: 8 },
  playDot: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.surface2, alignItems: "center", justifyContent: "center" },
  videoBox: { height: 220, borderRadius: 8, overflow: "hidden", backgroundColor: C.surface2 },
  videoImage: { width: "100%", height: "100%" },
  videoOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.35)" },
  playLarge: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.gold, alignItems: "center", justifyContent: "center" },
  detailTitle: { fontFamily: C.fontDisplay, color: C.white, fontSize: 25, fontWeight: "900", lineHeight: 31, marginTop: 18 },
  detailBody: { fontFamily: C.fontBody, color: C.white, fontSize: 15, lineHeight: 24, marginTop: 14 },
  detailImage: { width: "100%", height: 220, borderRadius: 8, backgroundColor: C.surface2 },
  audioBg: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
    opacity: 0.62,
    transform: [{ scale: 1.16 }]
  },
  audioShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.58)" },
  audioGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(9,43,87,0.18)"
  },
  audioContent: { flex: 1, alignItems: "center", paddingHorizontal: 24, paddingTop: 20, paddingBottom: 120 },
  albumFrame: {
    marginTop: 10,
    padding: 10,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)"
  },
  albumLarge: { width: 240, height: 240, borderRadius: 18 },
  audioInfoBlock: {
    width: "100%",
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderRadius: 24,
    backgroundColor: "rgba(10,10,10,0.42)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)"
  },
  audioTitle: { color: C.textOnBrand, fontSize: 24, fontWeight: "900", textAlign: "center" },
  progressTrack: { width: "100%", height: 6, borderRadius: 4, backgroundColor: C.surface2, marginTop: 24 },
  progressFill: { width: "38%", height: "100%", borderRadius: 4, backgroundColor: C.gold },
  timeRow: { width: "100%", flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  controls: { flexDirection: "row", gap: 8, marginVertical: 22 },
  controlBtn: { minWidth: 52, height: 44, borderRadius: 22, backgroundColor: C.surface2, alignItems: "center", justifyContent: "center" },
  controlPrimary: { width: 62, height: 62, borderRadius: 31, backgroundColor: C.gold, alignItems: "center", justifyContent: "center", marginTop: -9 },
  categoryPill: { color: C.textOnAccent, backgroundColor: C.gold, borderRadius: 18, overflow: "hidden", paddingHorizontal: 14, paddingVertical: 7, fontWeight: "900", marginBottom: 8 },
  bottomActions: { flexDirection: "row", gap: 10, marginTop: 18 },
  actionBtn: { backgroundColor: C.surface2, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6 },
  actionText: { fontFamily: C.fontBold, color: C.white, fontSize: 12, fontWeight: "800" },
  primaryBtn: { backgroundColor: C.gold, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 13, alignItems: "center", justifyContent: "center", marginTop: 16 },
  primaryText: { fontFamily: C.fontBold, color: C.textOnAccent, fontSize: 14, fontWeight: "900" },
  liveNow: { fontFamily: C.fontBold, color: C.textOnBrand, backgroundColor: C.red, borderRadius: 20, overflow: "hidden", paddingHorizontal: 18, paddingVertical: 10, fontWeight: "900" },
  liveStage: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: C.surface2,
    marginTop: 8,
    marginBottom: 18
  },
  livePlayerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    padding: 14
  },
  livePlayerShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.22)"
  },
  liveStageTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12
  },
  liveStageTitleWrap: {
    flex: 1,
    gap: 8
  },
  liveStageBadgeRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap"
  },
  liveStagePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(10,10,10,0.72)",
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  liveStagePillText: {
    color: C.textOnBrand,
    fontSize: 11,
    fontWeight: "900"
  },
  liveStageTitle: {
    color: C.textOnBrand,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 26
  },
  liveStageMeta: {
    color: C.textOnBrand,
    fontSize: 12,
    lineHeight: 18
  },
  liveStageActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center"
  },
  liveStageActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(10,10,10,0.72)",
    alignItems: "center",
    justifyContent: "center"
  },
  liveOverlayPanel: {
    backgroundColor: "rgba(0,0,0,0.62)",
    borderRadius: 12,
    paddingTop: 10,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)"
  },
  reactionStrip: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 16 },
  reaction: { fontFamily: C.fontBody, color: C.white, backgroundColor: C.surface2, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, fontWeight: "700" },
  liveChatShell: {
    backgroundColor: C.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.line,
    overflow: "hidden",
    marginBottom: 18
  },
  liveChatHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.line
  },
  liveChatHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1
  },
  liveChatStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.red
  },
  liveChatTitle: {
    color: C.textOnBrand,
    fontSize: 14,
    fontWeight: "900"
  },
  liveChatSubtle: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 17
  },
  liveStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: C.surface2
  },
  liveStatusPillText: {
    color: C.white,
    fontSize: 11,
    fontWeight: "800"
  },
  liveChatList: {
    maxHeight: 220
  },
  liveChatListContent: {
    paddingBottom: 2
  },
  liveMessageRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 12
  },
  liveAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.surface2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2
  },
  liveAvatarText: {
    color: C.gold,
    fontSize: 11,
    fontWeight: "900"
  },
  liveMessageBody: {
    flex: 1
  },
  liveMessageMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 3
  },
  liveMessageName: {
    color: C.gold,
    fontSize: 12,
    fontWeight: "900",
    flexShrink: 1
  },
  liveMessageTime: {
    color: C.faint,
    fontSize: 11,
    fontWeight: "700"
  },
  liveMessageText: {
    color: C.textOnBrand,
    fontSize: 13,
    lineHeight: 18
  },
  liveComposer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingTop: 10
  },
  liveComposerInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 92,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 21,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 11,
    color: C.white,
    fontSize: 14,
    fontWeight: "700",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)"
  },
  liveSendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.gold,
    alignItems: "center",
    justifyContent: "center"
  },
  liveChatEmpty: {
    paddingVertical: 10
  },
  storage: { height: 10, borderRadius: 5, backgroundColor: C.surface2, marginBottom: 8 },
  storageFill: { width: "32%", height: "100%", borderRadius: 5, backgroundColor: C.gold },
  plainCard: { backgroundColor: C.surface, borderRadius: 8, padding: 16, marginBottom: 12 },
  branchCard: { backgroundColor: C.surface, borderRadius: 8, padding: 14, marginBottom: 16 },
  branchImage: { width: "100%", height: 140, borderRadius: 8, marginBottom: 12 },
  profileHead: { alignItems: "center", paddingVertical: 18 },
  avatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: C.blue, alignItems: "center", justifyContent: "center" },
  avatarText: { color: C.gold, fontSize: 34, fontWeight: "900" },
  stats: { flexDirection: "row", gap: 10, marginBottom: 16 },
  statBox: { flex: 1, backgroundColor: C.surface, borderRadius: 8, padding: 14, alignItems: "center" },
  statValue: { color: C.white, fontSize: 18, fontWeight: "900" },
  settingRow: { backgroundColor: C.surface, borderRadius: 8, padding: 16, marginBottom: 12, flexDirection: "row", justifyContent: "space-between", gap: 12 },
  tabsCompact: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 14 },
  compactChip: { color: C.white, backgroundColor: C.surface2, borderRadius: 16, overflow: "hidden", paddingHorizontal: 12, paddingVertical: 8 },
  compactChipBtn: { backgroundColor: C.surface2, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 9 },
  activeChip: { backgroundColor: C.gold },
  compactChipText: { color: C.white, fontSize: 12, fontWeight: "800" },
  eventLarge: { backgroundColor: C.surface, borderRadius: 8, paddingBottom: 14, marginBottom: 16 },
  eventLargeImage: { width: "100%", height: 180, borderTopLeftRadius: 8, borderTopRightRadius: 8, marginBottom: 12 },
  rowTight: { flexDirection: "row", gap: 8, alignItems: "center" },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 60, paddingHorizontal: 28 },
  heroWrap: { height: 240, borderRadius: 8, overflow: "hidden", justifyContent: "flex-end" },
  aboutHero: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  aboutTitle: { color: C.textOnBrand, fontSize: 30, fontWeight: "900", padding: 18, backgroundColor: "rgba(0,0,0,0.3)" },
  contactCard: { width: 220, borderRadius: 8, backgroundColor: C.blue, padding: 16 },
  drawerBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  drawer: { width: "82%", height: "100%", backgroundColor: C.backgroundElevated, borderRightWidth: 1, borderRightColor: C.line, paddingTop: 34, paddingHorizontal: 16 },
  drawerLogoWrap: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 22 },
  drawerLogo: { width: 118, height: 64, borderRadius: 6 },
  drawerGroup: { marginBottom: 18 },
  drawerGroupTitle: { color: C.faint, fontSize: 11, fontWeight: "900", marginBottom: 6 },
  drawerItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.line },
  drawerItemText: { color: C.white, fontSize: 15, fontWeight: "750" },
  bottomNav: { position: "absolute", left: 0, right: 0, bottom: 0, height: 76, backgroundColor: C.backgroundElevated, borderTopWidth: 1, borderTopColor: C.line, flexDirection: "row", paddingBottom: 8 },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center" },
  navLabelRow: { flexDirection: "row", gap: 5, alignItems: "center" },
  navLabel: { color: C.muted, fontSize: 11, fontWeight: "800", marginTop: 3 },
  navActive: { color: C.gold },
  redBadge: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.red, marginTop: 3 },
  serveHero: {
  backgroundColor: C.blue,
  borderRadius: 14,
  padding: 16,
  marginTop: 10,
  marginBottom: 16,
  flexDirection: "row",
  gap: 14,
  alignItems: "center",
  borderWidth: 1,
  borderColor: C.blue2
},
serveIcon: {
  width: 56,
  height: 56,
  borderRadius: 28,
  backgroundColor: C.gold,
  alignItems: "center",
  justifyContent: "center"
},
serveHeroText: {
  flex: 1
},
serveTitle: {
  color: C.textOnBrand,
  fontSize: 21,
  fontWeight: "900",
  marginBottom: 6
},
serveSubtitle: {
  color: C.muted,
  fontSize: 13,
  lineHeight: 19
},
formSection: {
  backgroundColor: C.surface,
  borderRadius: 14,
  padding: 14,
  marginBottom: 16,
  borderWidth: 1,
  borderColor: C.line
},
formSectionTitle: {
  color: C.gold,
  fontSize: 15,
  fontWeight: "900",
  marginBottom: 14,
  textTransform: "uppercase"
},
formRow: {
  flexDirection: "row",
  gap: 10
},
formHalf: {
  flex: 1
},
inputLabel: {
  color: C.white,
  fontSize: 12,
 fontWeight: "800",
  marginBottom: 7,
  marginTop: 8
},
formInput: {
  backgroundColor: C.surface2,
  color: C.white,
  borderRadius: 12,
  paddingHorizontal: 14,
  height: 48,
  fontSize: 14,
  marginBottom: 8,
  borderWidth: 1,
  borderColor: C.line,
  fontWeight: "800",
},
formHelp: {
  color: C.muted,
  fontSize: 13,
  lineHeight: 19,
  marginTop: -6,
  marginBottom: 12
},
ministryGrid: {
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 10
},
ministryChip: {
  flexDirection: "row",
  alignItems: "center",
  gap: 7,
  backgroundColor: C.surface2,
  borderRadius: 18,
  paddingHorizontal: 12,
  paddingVertical: 10,
  borderWidth: 1,
  borderColor: C.line
},
ministryChipActive: {
  backgroundColor: C.gold,
  borderColor: C.gold
},
ministryChipText: {
  color: C.white,
  fontSize: 12,
 fontWeight: "800"
},
ministryChipTextActive: {
  color: C.black
},
formNote: {
  flexDirection: "row",
  gap: 10,
  backgroundColor: C.surface,
  borderRadius: 12,
  padding: 14,
  borderWidth: 1,
  borderColor: C.line
},
formNoteText: {
  flex: 1,
  color: C.muted,
  fontSize: 13,
  lineHeight: 19
},
contentSourceRow: {
  marginHorizontal: 14,
  marginTop: 8,
  marginBottom: 4,
  backgroundColor: C.surface,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: C.line,
  paddingHorizontal: 12,
  paddingVertical: 10,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between"
},
contentSourceText: {
  color: C.muted,
  fontSize: 12,
  fontWeight: "700"
},
contentReloadText: {
  color: C.gold,
  fontSize: 12,
  fontWeight: "900"
},
  miniPlayer: { position: "absolute", left: 0, right: 0, bottom: 76, height: 58, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.line, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, zIndex: 10 },
  miniImage: { width: 42, height: 42, borderRadius: 6 },
  miniTitle: { flex: 1, color: C.white, fontSize: 13, fontWeight: "800" }
}));

export const bibleExtraStyles = makeThemedStyles(C => ({
  searchInput: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.text,
    backgroundColor: C.card,
    marginBottom: 14
  },
  searchResult: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.line
  }
}));
