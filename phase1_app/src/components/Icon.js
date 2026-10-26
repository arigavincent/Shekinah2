import React from "react";
import { Ionicons as FallbackIonicons } from "@expo/vector-icons";

import { ArrowLeftIcon } from "phosphor-react-native/src/icons/ArrowLeft";
import { ArrowRightIcon } from "phosphor-react-native/src/icons/ArrowRight";
import { ArrowSquareOutIcon } from "phosphor-react-native/src/icons/ArrowSquareOut";
import { ArrowsInIcon } from "phosphor-react-native/src/icons/ArrowsIn";
import { ArrowsOutIcon } from "phosphor-react-native/src/icons/ArrowsOut";
import { ArticleIcon } from "phosphor-react-native/src/icons/Article";
import { BellIcon } from "phosphor-react-native/src/icons/Bell";
import { BookOpenIcon } from "phosphor-react-native/src/icons/BookOpen";
import { BookmarkSimpleIcon } from "phosphor-react-native/src/icons/BookmarkSimple";
import { BooksIcon } from "phosphor-react-native/src/icons/Books";
import { BroadcastIcon } from "phosphor-react-native/src/icons/Broadcast";
import { CalendarBlankIcon } from "phosphor-react-native/src/icons/CalendarBlank";
import { CaretDownIcon } from "phosphor-react-native/src/icons/CaretDown";
import { CaretLeftIcon } from "phosphor-react-native/src/icons/CaretLeft";
import { CaretRightIcon } from "phosphor-react-native/src/icons/CaretRight";
import { CaretUpIcon } from "phosphor-react-native/src/icons/CaretUp";
import { ChatsCircleIcon } from "phosphor-react-native/src/icons/ChatsCircle";
import { CheckCircleIcon } from "phosphor-react-native/src/icons/CheckCircle";
import { CheckIcon } from "phosphor-react-native/src/icons/Check";
import { CircleIcon } from "phosphor-react-native/src/icons/Circle";
import { ClockIcon } from "phosphor-react-native/src/icons/Clock";
import { CoffeeIcon } from "phosphor-react-native/src/icons/Coffee";
import { CreditCardIcon } from "phosphor-react-native/src/icons/CreditCard";
import { DownloadSimpleIcon } from "phosphor-react-native/src/icons/DownloadSimple";
import { EnvelopeIcon } from "phosphor-react-native/src/icons/Envelope";
import { EyeIcon } from "phosphor-react-native/src/icons/Eye";
import { FastForwardIcon } from "phosphor-react-native/src/icons/FastForward";
import { FileTextIcon } from "phosphor-react-native/src/icons/FileText";
import { FlameIcon } from "phosphor-react-native/src/icons/Flame";
import { FlowerIcon } from "phosphor-react-native/src/icons/Flower";
import { GearSixIcon } from "phosphor-react-native/src/icons/GearSix";
import { GlobeIcon } from "phosphor-react-native/src/icons/Globe";
import { HandsPrayingIcon } from "phosphor-react-native/src/icons/HandsPraying";
import { HeartIcon } from "phosphor-react-native/src/icons/Heart";
import { HourglassIcon } from "phosphor-react-native/src/icons/Hourglass";
import { HouseIcon } from "phosphor-react-native/src/icons/House";
import { InfoIcon } from "phosphor-react-native/src/icons/Info";
import { LightningIcon } from "phosphor-react-native/src/icons/Lightning";
import { ListBulletsIcon } from "phosphor-react-native/src/icons/ListBullets";
import { ListIcon } from "phosphor-react-native/src/icons/List";
import { MagnifyingGlassIcon } from "phosphor-react-native/src/icons/MagnifyingGlass";
import { MapPinIcon } from "phosphor-react-native/src/icons/MapPin";
import { MegaphoneIcon } from "phosphor-react-native/src/icons/Megaphone";
import { MusicNotesIcon } from "phosphor-react-native/src/icons/MusicNotes";
import { NavigationArrowIcon } from "phosphor-react-native/src/icons/NavigationArrow";
import { PaintBucketIcon } from "phosphor-react-native/src/icons/PaintBucket";
import { PaperPlaneRightIcon } from "phosphor-react-native/src/icons/PaperPlaneRight";
import { PauseIcon } from "phosphor-react-native/src/icons/Pause";
import { PhoneIcon } from "phosphor-react-native/src/icons/Phone";
import { PlayCircleIcon } from "phosphor-react-native/src/icons/PlayCircle";
import { PlayIcon } from "phosphor-react-native/src/icons/Play";
import { QrCodeIcon } from "phosphor-react-native/src/icons/QrCode";
import { ReceiptIcon } from "phosphor-react-native/src/icons/Receipt";
import { RepeatIcon } from "phosphor-react-native/src/icons/Repeat";
import { RewindIcon } from "phosphor-react-native/src/icons/Rewind";
import { ShareNetworkIcon } from "phosphor-react-native/src/icons/ShareNetwork";
import { ShieldCheckIcon } from "phosphor-react-native/src/icons/ShieldCheck";
import { SkipBackIcon } from "phosphor-react-native/src/icons/SkipBack";
import { SkipForwardIcon } from "phosphor-react-native/src/icons/SkipForward";
import { SmileyIcon } from "phosphor-react-native/src/icons/Smiley";
import { StackIcon } from "phosphor-react-native/src/icons/Stack";
import { SunHorizonIcon } from "phosphor-react-native/src/icons/SunHorizon";
import { TextAaIcon } from "phosphor-react-native/src/icons/TextAa";
import { TrashIcon } from "phosphor-react-native/src/icons/Trash";
import { UserIcon } from "phosphor-react-native/src/icons/User";
import { UsersThreeIcon } from "phosphor-react-native/src/icons/UsersThree";
import { VideoCameraIcon } from "phosphor-react-native/src/icons/VideoCamera";
import { WarningCircleIcon } from "phosphor-react-native/src/icons/WarningCircle";
import { WhatsappLogoIcon } from "phosphor-react-native/src/icons/WhatsappLogo";
import { XCircleIcon } from "phosphor-react-native/src/icons/XCircle";
import { XIcon } from "phosphor-react-native/src/icons/X";
import { YoutubeLogoIcon } from "phosphor-react-native/src/icons/YoutubeLogo";

// Ionicons base name -> Phosphor icon. "-outline" names render the regular
// (stroked) weight, plain names render the filled weight, matching how the
// screens already toggle between active and inactive states.
const MAP = {
  albums: StackIcon,
  "alert-circle": WarningCircleIcon,
  "arrow-back": ArrowLeftIcon,
  "arrow-forward": ArrowRightIcon,
  book: BookOpenIcon,
  bookmark: BookmarkSimpleIcon,
  cafe: CoffeeIcon,
  calendar: CalendarBlankIcon,
  call: PhoneIcon,
  card: CreditCardIcon,
  chatbubbles: ChatsCircleIcon,
  checkmark: CheckIcon,
  "checkmark-circle": CheckCircleIcon,
  "chevron-back": CaretLeftIcon,
  "chevron-down": CaretDownIcon,
  "chevron-forward": CaretRightIcon,
  "chevron-up": CaretUpIcon,
  close: XIcon,
  "close-circle": XCircleIcon,
  "color-fill": PaintBucketIcon,
  contract: ArrowsInIcon,
  "document-text": FileTextIcon,
  download: DownloadSimpleIcon,
  ellipse: CircleIcon,
  expand: ArrowsOutIcon,
  eye: EyeIcon,
  flame: FlameIcon,
  flash: LightningIcon,
  globe: GlobeIcon,
  "hand-left": HandsPrayingIcon,
  happy: SmileyIcon,
  heart: HeartIcon,
  home: HouseIcon,
  hourglass: HourglassIcon,
  "information-circle": InfoIcon,
  library: BooksIcon,
  list: ListBulletsIcon,
  location: MapPinIcon,
  "logo-whatsapp": WhatsappLogoIcon,
  "logo-youtube": YoutubeLogoIcon,
  mail: EnvelopeIcon,
  megaphone: MegaphoneIcon,
  menu: ListIcon,
  "musical-notes": MusicNotesIcon,
  navigate: NavigationArrowIcon,
  notifications: BellIcon,
  open: ArrowSquareOutIcon,
  pause: PauseIcon,
  people: UsersThreeIcon,
  person: UserIcon,
  play: PlayIcon,
  "play-back": RewindIcon,
  "play-circle": PlayCircleIcon,
  "play-forward": FastForwardIcon,
  "play-skip-back": SkipBackIcon,
  "play-skip-forward": SkipForwardIcon,
  "qr-code": QrCodeIcon,
  radio: BroadcastIcon,
  reader: ArticleIcon,
  receipt: ReceiptIcon,
  repeat: RepeatIcon,
  rose: FlowerIcon,
  search: MagnifyingGlassIcon,
  sunny: SunHorizonIcon,
  send: PaperPlaneRightIcon,
  settings: GearSixIcon,
  "share-social": ShareNetworkIcon,
  "shield-checkmark": ShieldCheckIcon,
  text: TextAaIcon,
  time: ClockIcon,
  trash: TrashIcon,
  videocam: VideoCameraIcon
};

// Line glyphs read better stroked even when the Ionicons name is "filled".
const ALWAYS_STROKED = new Set([
  "arrow-back",
  "arrow-forward",
  "checkmark",
  "chevron-back",
  "chevron-down",
  "chevron-forward",
  "chevron-up",
  "close",
  "contract",
  "expand",
  "menu",
  "search",
  "repeat",
  "list",
  "open"
]);

function resolve(name = "") {
  const outline = name.endsWith("-outline");
  const base = outline ? name.slice(0, -"-outline".length) : name;
  const Component = MAP[base];
  if (!Component) return null;
  if (ALWAYS_STROKED.has(base)) return { Component, weight: "bold" };
  return { Component, weight: outline ? "regular" : "fill" };
}

// Drop-in replacement for `Ionicons` from @expo/vector-icons. Unknown names
// fall back to the Ionicons font so nothing renders blank.
export function Ionicons({ name, size = 24, color, style, weight, ...rest }) {
  const resolved = resolve(name);

  if (!resolved) {
    return <FallbackIonicons name={name} size={size} color={color} style={style} {...rest} />;
  }

  const { Component, weight: defaultWeight } = resolved;
  return <Component size={size} color={color} weight={weight || defaultWeight} style={style} {...rest} />;
}

export const Icon = Ionicons;
