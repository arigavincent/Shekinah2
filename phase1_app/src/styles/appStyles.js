import { StyleSheet } from "react-native";

import { ANDROID_STATUS_BAR_HEIGHT, makeThemedStyles } from "../constants/theme";

export const NAV_BAR_HEIGHT = 64;

export const s = makeThemedStyles(C => ({
  app: { flex: 1, backgroundColor: C.background },
  screen: { flex: 1, backgroundColor: C.background, paddingBottom: 76 },
  scrollPad: { paddingHorizontal: 16, paddingBottom: 150 },
  pad: { paddingHorizontal: 16, paddingVertical: 10 },
  topBar: {
    minHeight: 60 + ANDROID_STATUS_BAR_HEIGHT,
    paddingTop: ANDROID_STATUS_BAR_HEIGHT + 8,
    paddingBottom: 8,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.background
  },
  topIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center"
  },
  topIconPressed: { backgroundColor: C.surface2 },
  topTitle: { flex: 1, color: C.white, fontSize: 19, fontFamily: C.fontBold, marginLeft: 6 },
  topRight: {
    minWidth: 44,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 2
  },
  brandLockup: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, marginLeft: 2 },
  brandMark: { width: 42, height: 42 },
  brandTitle: { flex: 1, color: C.white, fontSize: 18, fontFamily: C.fontBold },
  brandName: { color: C.gold, fontSize: 15, fontFamily: C.fontBrand, letterSpacing: 2.2, lineHeight: 18 },
  brandSub: { color: C.gold2, fontSize: 9.5, fontFamily: C.fontBrand, letterSpacing: 3.1, lineHeight: 12 },
  logoWrap: { alignItems: "center", justifyContent: "center", flex: 1 },
  logo: { width: 92, height: 34, borderRadius: 4 },
  logoText: { fontFamily: C.fontBold, color: C.white, fontSize: 13, marginTop: 4, textAlign: "center" },
  floatingMenu: {
    position: "absolute",
    top: ANDROID_STATUS_BAR_HEIGHT + 10,
    left: 10,
    zIndex: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.overlay,
    alignItems: "center",
    justifyContent: "center"
  },
  devotionHero: { flexDirection: "row", backgroundColor: C.surface, borderRadius: 16, padding: 12, marginTop: 6, gap: 14, borderWidth: 1, borderColor: C.line },
  devotionThumb: { width: 108, height: 132, borderRadius: 12, backgroundColor: C.surface2 },
  badgeOnImage: { position: "absolute", top: 8, left: 8, backgroundColor: C.accentPressed, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { color: "#FFFFFF", fontSize: 10, fontFamily: C.fontBold, letterSpacing: 0.6 },
  devotionBody: { flex: 1, justifyContent: "center" },
  cardTitle: { fontFamily: C.fontDisplay, color: C.white, fontSize: 16, lineHeight: 22, marginBottom: 6 },
  mutedText: { fontFamily: C.fontBody, color: C.muted, fontSize: 13, lineHeight: 19 },
  goldSmall: { fontFamily: C.fontBold, color: C.gold, fontSize: 12, marginTop: 6, letterSpacing: 0.3 },
  scriptureCard: { backgroundColor: C.surface, borderRadius: 18, padding: 20, marginTop: 28, borderWidth: 1, borderColor: C.goldSoft, overflow: "hidden" },
  scriptureHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  verseText: { fontFamily: C.fontScripture, color: C.white, fontSize: 21, lineHeight: 31, marginTop: 14 },
  smallCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface2, alignItems: "center", justifyContent: "center" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 28, marginBottom: 12 },
  sectionTitle: { fontFamily: C.fontDisplay, color: C.white, fontSize: 20, letterSpacing: -0.2, flexShrink: 1 },
  viewAll: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: C.surface2, borderRadius: 999, paddingHorizontal: 14, minHeight: 34 },
  viewAllText: { fontFamily: C.fontBold, color: C.gold, fontSize: 13 },
  horizontal: { gap: 12, paddingRight: 16 },
  videoCard: { width: 236 },
  wideVideoCard: { width: "100%", marginBottom: 16 },
  videoThumb: { width: "100%", aspectRatio: 16 / 9, height: undefined, borderRadius: 12, backgroundColor: C.surface2 },
  audioCard: { width: 132 },
  audioThumb: { width: 132, height: 132, borderRadius: 12, backgroundColor: C.surface2 },
  smallTitle: { fontFamily: C.fontMedium, color: C.white, fontSize: 13, marginTop: 8, lineHeight: 18 },
  clipCard: { width: 132, height: 176, borderRadius: 12, overflow: "hidden", backgroundColor: C.surface2 },
  clipImage: { width: "100%", height: "100%" },
  clipOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end", padding: 10 },
  clipText: { color: C.textOnBrand, fontSize: 14, fontFamily: C.fontBold },
  eventMini: { width: 220, backgroundColor: C.surface, borderRadius: 14, paddingBottom: 12, borderWidth: 1, borderColor: C.line, overflow: "hidden" },
  eventMiniImage: { width: "100%", height: 112, marginBottom: 10, backgroundColor: C.surface2 },
  searchInput: { backgroundColor: C.surface2, color: C.white, borderRadius: 999, paddingHorizontal: 20, height: 50, fontSize: 15, marginBottom: 12, fontFamily: C.fontBody },
  listRow: { flexDirection: "row", gap: 14, alignItems: "center", paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.lineStrong },
  rowImage: { width: 112, height: 72, borderRadius: 10, backgroundColor: C.surface2 },
  rowBody: { flex: 1 },
  rowTitle: { fontFamily: C.fontMedium, color: C.white, fontSize: 15.5, lineHeight: 21 },
  tabs: { flexDirection: "row", justifyContent: "center", paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.lineStrong, backgroundColor: C.background },
  tabBtn: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  tabText: { fontFamily: C.fontMedium, color: C.muted, fontSize: 15 },
  tabActiveText: { color: C.white, fontFamily: C.fontBold },
  tabUnderline: { position: "absolute", bottom: 0, height: 3, left: 14, right: 14, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: C.accent },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  categoryCard: { width: "47.5%", marginBottom: 12 },
  categoryImage: { width: "100%", aspectRatio: 1, borderRadius: 14, marginBottom: 8, backgroundColor: C.surface2 },
  playDot: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.accentSoft, alignItems: "center", justifyContent: "center" },
  videoBox: { aspectRatio: 16 / 9, borderRadius: 14, overflow: "hidden", backgroundColor: C.surface2 },
  videoImage: { width: "100%", height: "100%" },
  videoOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.30)" },
  playLarge: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.gold, alignItems: "center", justifyContent: "center" },
  detailTitle: { fontFamily: C.fontDisplay, color: C.white, fontSize: 24, lineHeight: 31, marginTop: 18, letterSpacing: -0.3 },
  detailBody: { fontFamily: C.fontBody, color: C.white, fontSize: 16, lineHeight: 26, marginTop: 14 },
  detailImage: { width: "100%", aspectRatio: 16 / 9, height: undefined, borderRadius: 14, backgroundColor: C.surface2 },
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
  audioTitle: { color: C.textOnBrand, fontSize: 22, lineHeight: 29, fontFamily: C.fontDisplay, textAlign: "center" },
  progressTrack: { width: "100%", height: 4, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.18)", marginTop: 24 },
  progressFill: { width: "38%", height: "100%", borderRadius: 4, backgroundColor: C.accent },
  timeRow: { width: "100%", flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  controls: { flexDirection: "row", gap: 8, marginVertical: 22 },
  controlBtn: { minWidth: 52, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  controlPrimary: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.gold, alignItems: "center", justifyContent: "center", marginTop: -10 },
  categoryPill: { color: "#FFFFFF", backgroundColor: C.accentPressed, borderRadius: 999, overflow: "hidden", paddingHorizontal: 12, paddingVertical: 5, fontFamily: C.fontBold, fontSize: 12, marginBottom: 8 },
  bottomActions: { flexDirection: "row", gap: 10, marginTop: 18 },
  actionBtn: { backgroundColor: C.surface2, borderRadius: 999, paddingHorizontal: 14, minHeight: 40, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderColor: C.line },
  actionText: { fontFamily: C.fontBold, color: C.white, fontSize: 13 },
  primaryBtn: { backgroundColor: C.gold, borderRadius: 999, paddingHorizontal: 22, minHeight: 50, alignItems: "center", justifyContent: "center", marginTop: 16 },
  primaryText: { fontFamily: C.fontBold, color: C.textOnAccent, fontSize: 15, letterSpacing: 0.2 },
  liveNow: { fontFamily: C.fontBold, color: "#FFFFFF", backgroundColor: C.red, borderRadius: 999, overflow: "hidden", paddingHorizontal: 16, paddingVertical: 8, fontSize: 12, letterSpacing: 0.8 },
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
  reaction: { fontFamily: C.fontMedium, color: C.white, backgroundColor: C.surface2, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
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
  plainCard: { backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.line },
  branchCard: { backgroundColor: C.surface, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: C.line },
  branchImage: { width: "100%", height: 150, borderRadius: 10, marginBottom: 12, backgroundColor: C.surface2 },
  profileHead: { alignItems: "center", paddingVertical: 18 },
  avatar: { width: 92, height: 92, borderRadius: 46, backgroundColor: C.blue, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: C.gold },
  avatarText: { color: C.gold, fontSize: 34, fontFamily: C.fontBrand },
  stats: { flexDirection: "row", gap: 10, marginBottom: 16 },
  statBox: { flex: 1, backgroundColor: C.surface, borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1, borderColor: C.line },
  statValue: { color: C.white, fontSize: 20, fontFamily: C.fontDisplay },
  settingRow: { backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, borderWidth: 1, borderColor: C.line },
  tabsCompact: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 14 },
  compactChip: { color: C.white, backgroundColor: C.surface2, borderRadius: 999, overflow: "hidden", paddingHorizontal: 14, paddingVertical: 8, fontFamily: C.fontMedium },
  compactChipBtn: { backgroundColor: C.surface2, borderRadius: 999, paddingHorizontal: 14, minHeight: 36, justifyContent: "center", borderWidth: 1, borderColor: C.line },
  activeChip: { backgroundColor: C.accent, borderColor: C.accent },
  compactChipText: { color: C.white, fontSize: 13, fontFamily: C.fontBold },
  eventLarge: { backgroundColor: C.surface, borderRadius: 16, paddingBottom: 14, marginBottom: 16, borderWidth: 1, borderColor: C.line, overflow: "hidden" },
  eventLargeImage: { width: "100%", height: 190, marginBottom: 12, backgroundColor: C.surface2 },
  rowTight: { flexDirection: "row", gap: 8, alignItems: "center" },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 60, paddingHorizontal: 28 },
  heroWrap: { height: 240, borderRadius: 16, overflow: "hidden", justifyContent: "flex-end" },
  aboutHero: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  aboutTitle: { color: C.textOnBrand, fontSize: 28, fontFamily: C.fontBrand, padding: 18, backgroundColor: "rgba(0,0,0,0.35)" },
  contactCard: { width: 220, borderRadius: 16, backgroundColor: C.blue, padding: 16, borderWidth: 1, borderColor: C.blue2 },
  drawerBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: C.scrim },
  drawer: { position: "absolute", top: 0, bottom: 0, left: 0, backgroundColor: C.backgroundElevated, borderTopRightRadius: 20, borderBottomRightRadius: 20, overflow: "hidden" },
  drawerHeader: { backgroundColor: C.backgroundElevated, alignItems: "center", paddingBottom: 18 },
  drawerHeaderImage: { width: 72, height: 72, marginBottom: 6 },
  drawerBrandName: { color: C.gold, fontFamily: C.fontBrand, fontSize: 24, letterSpacing: 3.5, lineHeight: 28 },
  drawerBrandSub: { color: C.gold2, fontFamily: C.fontBrand, fontSize: 13, letterSpacing: 5.2, lineHeight: 17 },
  drawerHeaderFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 56 },
  goldHairline: { height: 1, marginHorizontal: 20, opacity: 0.9 },
  drawerItemPressed: { backgroundColor: C.surface2 },
  drawerItemIcon: { width: 26, alignItems: "center", justifyContent: "center" },
  drawerVersion: { color: C.faint, fontSize: 12, fontFamily: C.fontBody, textAlign: "center", marginTop: 20 },
  navPill: { minWidth: 70, height: 50, borderRadius: 999, paddingHorizontal: 8, alignItems: "center", justifyContent: "center", gap: 2 },
  navPillActive: { backgroundColor: C.accentSoft },
  liveDot: { position: "absolute", top: -2, right: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: C.red, borderWidth: 1.5, borderColor: C.backgroundElevated },
  tabBtnScroll: { flex: 0, paddingHorizontal: 14 },
  tabsScroll: { paddingHorizontal: 4 },
  tabBtnCompact: { flex: 0, paddingHorizontal: 14 },
  tabsCompact2: { justifyContent: "center" },
  sectionTitleWrap: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  sectionAccent: { width: 3, height: 20, borderRadius: 2, backgroundColor: C.gold },
  actionBtnPressed: { backgroundColor: C.surface3 },
  drawerLogoWrap: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 22 },
  drawerLogo: { width: 118, height: 64, borderRadius: 6 },
  drawerGroup: { paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.lineStrong },
  drawerGroupTitle: { color: C.muted, fontSize: 12, fontFamily: C.fontBold, letterSpacing: 1.4, marginBottom: 4, marginLeft: 16 },
  drawerItem: { flexDirection: "row", alignItems: "center", gap: 18, minHeight: 54, paddingHorizontal: 16, borderRadius: 12 },
  drawerItemText: { flex: 1, color: C.white, fontSize: 16, fontFamily: C.fontMedium },
  bottomNav: { position: "absolute", left: 12, right: 12, borderRadius: 32, backgroundColor: C.backgroundElevated, borderWidth: 1, borderColor: C.lineStrong, flexDirection: "row", alignItems: "center", paddingHorizontal: 6, elevation: 12, shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center" },
  navLabelRow: { flexDirection: "row", gap: 5, alignItems: "center" },
  navLabel: { color: C.muted, fontSize: 11, fontFamily: C.fontMedium },
  navActive: { color: C.accent, fontFamily: C.fontBold },
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
  backgroundColor: C.accent,
  borderColor: C.accent
},
ministryChipText: {
  color: C.white,
  fontSize: 12,
 fontWeight: "800"
},
ministryChipTextActive: {
  color: "#FFFFFF"
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
  color: C.accentText,
  fontSize: 12,
  fontWeight: "900"
},
  miniPlayer: { position: "absolute", left: 0, right: 0, bottom: 76, height: 58, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.line, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, zIndex: 10 },
  miniImage: { width: 42, height: 42, borderRadius: 6 },
  miniTitle: { flex: 1, color: C.white, fontSize: 13, fontFamily: C.fontBold }
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
