/**
 * Caderno de Dois — papel quente, hibisco queimado e uma navegação assimétrica para memórias privadas.
 * Caderno de Dois: trilhos de identidade, bilhetes recortados e linhas de vínculo conduzem memórias, rituais e localização voluntária.
 */
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { geocodeAddress, MapView } from "@/components/Map";
import { useTheme } from "@/contexts/ThemeContext";
import { ACCENT_OPTIONS, type AppearanceMode } from "@/lib/appearance";
import {
  FOUR_DIGIT_YEAR_DATE_HINT,
  formatBrazilianDateInput,
  formatBrazilianDateTyping,
  hasFourDigitYear,
  parseBrazilianDateInput,
} from "@/lib/dateValidation";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import {
  clearLocalPrivacyData,
  installExternalMapDisclosureGuard,
  proximityStorageKey,
  spotifyConnectionStorageKey,
} from "@/lib/privacy";
import {
  getLocationConsentAction,
  locationConsentStorageKey,
} from "@/lib/locationConsent";
import {
  formatLocationAccuracy,
  formatLocationDistance,
  getLocationStatus,
} from "@/lib/locationStatus";
import {
  reverseGeocode,
  type ReverseGeocodedPlace,
} from "@/lib/reverseGeocode";
import type { Session } from "@supabase/supabase-js";
import {
  ArrowUpRight,
  BatteryCharging,
  Bell,
  BookOpen,
  Bookmark,
  CalendarDays,
  Camera,
  Clapperboard,
  Check,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  CloudSun,
  Compass,
  Copy,
  ExternalLink,
  Gamepad,
  Heart,
  Home as HomeIcon,
  ImagePlus,
  Link2,
  LockKeyhole,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Music2,
  Navigation,
  Pause,
  Pencil,
  PenLine,
  Play,
  Plus,
  QrCode,
  Radio,
  RefreshCw,
  Send,
  Settings2,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  ShieldCheck,
  Clock3,
  X,
} from "lucide-react";
import React, {
  type ReactNode,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

installExternalMapDisclosureGuard();

const ASSETS = {
  logo: "/assets/appcasal-logo.svg",
  hero: "/assets/appcasal-hero.svg",
  memory: "/assets/appcasal-memory.svg",
  plans: "/assets/appcasal-plans.svg",
  chat: "/assets/appcasal-chat.svg",
};

const PHOTO_BUCKET = "memory-photos";
const AVATAR_BUCKET = "profile-avatars";
const MUSIC_COVER_BUCKET = "music-room-covers";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_AVATAR_BYTES = 3 * 1024 * 1024;
const ACCEPTED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MUSIC_REACTION_EMOJIS = ["❤️", "🥹", "✨", "🫶", "🔥", "🎶"] as const;
const PROXIMITY_COOLDOWN_MS = 6 * 60 * 60 * 1_000;
// Domínio publicado incluído também na allowlist de Redirect URLs do Supabase Auth.
// Não usamos a origem dinâmica aqui para impedir que uma prévia/localização inesperada
// se torne destino de confirmação de conta.
export const PUBLIC_APP_ORIGIN = "https://appcasal-kzzvckwa.manus.space";
const SPOTIFY_LINK_RETURN_KEY = "appcasal.spotify-link-return";
export const SPOTIFY_PLAYLIST_LIBRARY_URL =
  "https://open.spotify.com/collection/playlists";

export function getSpotifyLinkOptions() {
  return {
    redirectTo: `${PUBLIC_APP_ORIGIN}?spotify_return=1`,
    scopes: "user-read-email user-read-private",
  };
}

export function getSpotifyContinuationUrl(jamUrl: string | null | undefined) {
  return jamUrl && isSpotifyShareUrl(jamUrl)
    ? jamUrl
    : SPOTIFY_PLAYLIST_LIBRARY_URL;
}

type AppTab =
  | "inicio"
  | "momentos"
  | "chat"
  | "planos"
  | "contagem"
  | "musica"
  | "widgets"
  | "localizacao"
  | "leituras"
  | "filmes"
  | "mais";

type DeferredInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function getInitialAppTab(search: string): AppTab {
  const searchParams = new URLSearchParams(search);
  const initialTab = searchParams.get("tab");
  if (searchParams.get("invite")) return "mais";
  return initialTab === "chat" ||
    initialTab === "momentos" ||
    initialTab === "planos" ||
    initialTab === "contagem" ||
    initialTab === "musica" ||
    initialTab === "widgets" ||
    initialTab === "localizacao" ||
    initialTab === "leituras" ||
    initialTab === "filmes" ||
    initialTab === "mais"
    ? initialTab
    : "inicio";
}

const floatingPanelsListeners = new Set<() => void>();
let floatingPanelsContent: ReactNode = null;

function renderFloatingPanels(content: ReactNode) {
  floatingPanelsContent = content;
  floatingPanelsListeners.forEach(listener => listener());
}

function FloatingPanelsPortal() {
  const [, refresh] = useState(0);
  useEffect(() => {
    const listener = () => refresh(version => version + 1);
    floatingPanelsListeners.add(listener);
    listener();
    return () => {
      floatingPanelsListeners.delete(listener);
    };
  }, []);
  return floatingPanelsContent
    ? createPortal(floatingPanelsContent, document.body)
    : null;
}

type Post = {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  author_name: string;
  image_path?: string | null;
  image_url?: string;
};

type ChatMessage = {
  id: string;
  text: string;
  created_at: string;
  sender_id: string;
  sender_name: string;
};

type Plan = {
  id: string;
  title: string;
  details: string;
  scheduled_for: string;
  completed: boolean;
  created_by: string;
};

type LibraryItemType = "book" | "movie";
type BookStatus = "want" | "reading" | "finished";
type MovieStatus = "want" | "upcoming" | "watched";
type LibraryStatus = BookStatus | MovieStatus;

type CoupleLibraryItem = {
  id: string;
  couple_id: string;
  author_id: string;
  item_type: LibraryItemType;
  title: string;
  creator: string;
  notes: string;
  status: LibraryStatus;
  release_on: string | null;
  created_at: string;
  updated_at: string;
};

type AppNotification = {
  id: string;
  kind: "plan_created" | "location_started" | "location_paused";
  title: string;
  body: string;
  plan_id: string | null;
  read_at: string | null;
  created_at: string;
  actor_id: string;
};

type MoodKey = "radiante" | "feliz" | "sereno" | "saudade" | "cansado";

type DailyMood = {
  id: string;
  author_id: string;
  mood: MoodKey;
  mood_date: string;
};

type SharedWish = {
  id: string;
  author_id: string;
  content: string;
  fulfilled_at: string | null;
  created_at: string;
};

type GiftWish = {
  id: string;
  wished_by: string;
  title: string;
  occasion: string;
  notes: string;
  reference_url: string | null;
  created_at: string;
};

type CoupleMusicRoom = {
  couple_id: string;
  host_id: string;
  title: string;
  jam_url: string | null;
  is_active: boolean;
  started_at: string;
  updated_at: string;
};

type MusicQueueItem = {
  id: string;
  couple_id: string;
  added_by: string;
  track_url: string;
  track_title: string;
  artist_name: string | null;
  note: string | null;
  created_at: string;
};

type MusicReaction = {
  id: string;
  queue_item_id: string;
  user_id: string;
  emoji: (typeof MUSIC_REACTION_EMOJIS)[number];
  created_at: string;
};

type MusicRoomDetails = {
  cover_path: string | null;
  listen_at: string | null;
  reminder_note: string | null;
};

type CoupleBatterySnapshot = {
  couple_id: string;
  user_id: string;
  level_percent: number;
  is_charging: boolean;
  updated_at: string;
};

type CoupleWeatherSnapshot = {
  couple_id: string;
  city: string;
  latitude: number;
  longitude: number;
  temperature_c: number | null;
  weather_code: number | null;
  observed_at: string;
  updated_at: string;
};

type CoupleQuizAnswer = {
  couple_id: string;
  quiz_key: string;
  question_key: string;
  user_id: string;
  answer_value: string;
  created_at: string;
  updated_at: string;
};

type CoupleQuiz = {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  questions: { id: string; prompt: string; options: string[] }[];
};

type CoupleLocation = {
  couple_id: string;
  user_id: string;
  sharing_enabled: boolean;
  latitude: number | null;
  longitude: number | null;
  accuracy_meters: number | null;
  updated_at: string;
};

type FavoritePlace = {
  id: string;
  created_by: string;
  title: string;
  address?: string | null;
  meaning: string;
  category: PlaceCategory;
  latitude: number;
  longitude: number;
  created_at: string;
};

type PlaceProximityPreference = {
  place_id: string;
  user_id: string;
  is_enabled: boolean;
  radius_meters: number;
  custom_message: string | null;
  updated_at: string;
};

type CoupleMember = {
  user_id: string;
  name: string;
  avatar_path?: string | null;
  avatar_url?: string;
};

type PlaceCategory = "encontros" | "viagens" | "favoritos";

const PLACE_CATEGORIES: {
  id: PlaceCategory;
  label: string;
  marker: string;
  tone: string;
}[] = [
  {
    id: "encontros",
    label: "Encontros",
    marker: "♥",
    tone: "bg-hibiscus-soft text-hibiscus",
  },
  {
    id: "viagens",
    label: "Viagens",
    marker: "✦",
    tone: "bg-sage/14 text-sage",
  },
  {
    id: "favoritos",
    label: "Favoritos",
    marker: "★",
    tone: "bg-plum/10 text-plum",
  },
];

const COUPLE_QUIZZES: CoupleQuiz[] = [
  {
    id: "proxima-aventura",
    eyebrow: "quiz 01 · para sonhar",
    title: "Qual é a nossa próxima aventura?",
    description: "Três pistas para descobrir o passeio que combina com vocês.",
    questions: [
      {
        id: "saturday",
        prompt: "Um sábado perfeito começa com…",
        options: [
          "Café sem pressa",
          "Estrada e playlist",
          "Museu e conversa",
          "Coberta e filme",
        ],
      },
      {
        id: "postcard",
        prompt: "Qual postal vocês gostariam de guardar?",
        options: ["Pôr do sol", "Cidade nova", "Praia vazia", "Mesa de café"],
      },
      {
        id: "soundtrack",
        prompt: "A trilha da viagem seria…",
        options: [
          "MPB para cantar",
          "Indie para a estrada",
          "Samba para dançar",
          "Silêncio bom",
        ],
      },
    ],
  },
  {
    id: "memorias-que-riem",
    eyebrow: "quiz 02 · para lembrar",
    title: "Memórias que fazem rir",
    description:
      "Perguntas pequenas para revisitarem os detalhes que só vocês conhecem.",
    questions: [
      {
        id: "first-laugh",
        prompt: "O que sempre merece virar piada interna?",
        options: [
          "Uma frase sem querer",
          "Um pedido errado",
          "Uma dança torta",
          "Um apelido improvável",
        ],
      },
      {
        id: "snack",
        prompt: "Qual lanche tem mais cara de nós?",
        options: [
          "Pizza dividida",
          "Doce depois do jantar",
          "Pipoca no sofá",
          "Café em dupla",
        ],
      },
      {
        id: "photo",
        prompt: "Qual foto nunca pode faltar no rolo?",
        options: ["Espelho", "Paisagem", "Comida bonita", "Foto espontânea"],
      },
    ],
  },
  {
    id: "rituais-nossos",
    eyebrow: "quiz 03 · para cuidar",
    title: "Rituais que combinam",
    description: "Descubram gestos simples que deixam os dias mais de vocês.",
    questions: [
      {
        id: "good-morning",
        prompt: "O melhor bom dia chega com…",
        options: [
          "Mensagem carinhosa",
          "Meme escolhido",
          "Áudio curto",
          "Café preparado",
        ],
      },
      {
        id: "weekday",
        prompt: "No meio da semana, vocês escolheriam…",
        options: [
          "Cozinhar juntos",
          "Jogar alguma coisa",
          "Ouvir uma música",
          "Caminhar sem rumo",
        ],
      },
      {
        id: "celebration",
        prompt: "O mêsversário merece…",
        options: [
          "Bilhete guardado",
          "Jantar caseiro",
          "Passeio favorito",
          "Uma nova memória",
        ],
      },
    ],
  },
];

const MOOD_OPTIONS: { id: MoodKey; emoji: string; label: string }[] = [
  { id: "radiante", emoji: "🤩", label: "Radiante" },
  { id: "feliz", emoji: "😊", label: "Feliz" },
  { id: "sereno", emoji: "😌", label: "Sereno" },
  { id: "saudade", emoji: "🥹", label: "Com saudade" },
  { id: "cansado", emoji: "😮‍💨", label: "Cansado" },
];

type DatabasePost = {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  image_path?: string | null;
  profiles?: { name?: string | null } | { name?: string | null }[] | null;
};

type DatabaseMessage = {
  id: string;
  text: string;
  created_at: string;
  sender_id: string;
  sender_name: string | null;
};

type DatabasePlan = {
  id: string;
  title: string;
  details: string;
  scheduled_for: string;
  completed: boolean;
  created_by: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function isSpotifyShareUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return (
      url.protocol === "https:" &&
      ["open.spotify.com", "spotify.link"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

function formatLongDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(value);
}

function toDateKey(value: Date) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 10);
}

function dateFromKey(value: string) {
  return new Date(`${value}T12:00:00`);
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function getUpcomingMonthlyDate(day: number) {
  const today = startOfDay(new Date());
  const candidate = new Date(today.getFullYear(), today.getMonth(), day);
  if (candidate < today) candidate.setMonth(candidate.getMonth() + 1);
  return candidate;
}

function getUpcomingAnnualDate(monthIndex: number, day: number) {
  const today = startOfDay(new Date());
  const candidate = new Date(today.getFullYear(), monthIndex, day);
  if (candidate < today) candidate.setFullYear(candidate.getFullYear() + 1);
  return candidate;
}

function formatCountdown(target: Date) {
  const days = Math.round(
    (startOfDay(target).getTime() - startOfDay(new Date()).getTime()) /
      86_400_000
  );
  if (days <= 0) return "é hoje";
  if (days === 1) return "amanhã";
  return `em ${days} dias`;
}

function formatRelationshipTime(startedOn: string) {
  if (!hasFourDigitYear(startedOn)) return null;
  const start = dateFromKey(startedOn);
  const now = startOfDay(new Date());
  if (Number.isNaN(start.getTime()) || start > now) return null;
  let months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    now.getMonth() -
    start.getMonth();
  if (now.getDate() < start.getDate()) months -= 1;
  return { years: Math.floor(months / 12), months: months % 12 };
}

function relationshipDays(startedOn: string) {
  if (!hasFourDigitYear(startedOn)) return null;
  const difference =
    startOfDay(new Date()).getTime() -
    startOfDay(dateFromKey(startedOn)).getTime();
  return Math.max(0, Math.floor(difference / 86_400_000) + 1);
}

function weatherPresentation(code: number | null) {
  if (code === null) return { icon: "◌", label: "Aguardando clima" };
  if ([0, 1].includes(code)) return { icon: "☀️", label: "Céu aberto" };
  if ([2, 3].includes(code)) return { icon: "⛅", label: "Entre nuvens" };
  if ([45, 48].includes(code)) return { icon: "🌫️", label: "Neblina" };
  if ([51, 53, 55, 56, 57, 61, 63, 65, 80, 81, 82].includes(code))
    return { icon: "🌧️", label: "Chuva" };
  if ([71, 73, 75, 77, 85, 86].includes(code))
    return { icon: "❄️", label: "Neve" };
  if ([95, 96, 99].includes(code)) return { icon: "⛈️", label: "Tempestade" };
  return { icon: "🌤️", label: "Condição atual" };
}

function locationMapUrl(location: CoupleLocation) {
  if (location.latitude === null || location.longitude === null)
    return undefined;
  return `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
}

function LocationStatusBadge({
  location,
  inverse = false,
}: {
  location: CoupleLocation;
  inverse?: boolean;
}) {
  const status = getLocationStatus(location.updated_at);
  const tone = inverse
    ? status.freshness === "live"
      ? "bg-white/15 text-white"
      : "bg-white/10 text-white/75"
    : status.freshness === "live"
      ? "bg-emerald-50 text-emerald-700"
      : status.freshness === "recent"
        ? "bg-amber-50 text-amber-700"
        : "bg-orange-50 text-orange-700";
  const dot =
    status.freshness === "live"
      ? "bg-emerald-500"
      : status.freshness === "recent"
        ? "bg-amber-500"
        : "bg-orange-500";
  return (
    <span
      aria-label={`Status da localização: ${status.label}`}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.59rem] font-extrabold uppercase tracking-[0.1em] ${tone}`}
      data-testid="location-status"
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${dot} ${status.freshness === "live" ? "animate-pulse" : ""}`}
      />
      {status.label}
    </span>
  );
}

function readProximityPreferences(userId: string) {
  if (!userId || typeof window === "undefined")
    return [] as PlaceProximityPreference[];
  try {
    const raw = window.localStorage.getItem(proximityStorageKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as PlaceProximityPreference[]) : [];
  } catch {
    return [] as PlaceProximityPreference[];
  }
}

function persistProximityPreferences(
  userId: string,
  preferences: PlaceProximityPreference[]
) {
  if (!userId || typeof window === "undefined") return;
  window.localStorage.setItem(
    proximityStorageKey(userId),
    JSON.stringify(preferences)
  );
  window.dispatchEvent(new Event("appcasal:proximity-preferences"));
}

function distanceInMeters(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number
) {
  const earthRadius = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLatitude = toRadians(latitudeB - latitudeA);
  const deltaLongitude = toRadians(longitudeB - longitudeA);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(toRadians(latitudeA)) *
      Math.cos(toRadians(latitudeB)) *
      Math.sin(deltaLongitude / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const SAVED_PLACE_MATCH_RADIUS_METERS = 180;

function findSavedPlaceForLocation(
  location: CoupleLocation | undefined,
  places: FavoritePlace[]
) {
  if (
    !location?.sharing_enabled ||
    location.latitude === null ||
    location.longitude === null
  )
    return null;

  return places
    .map(place => ({
      place,
      distance: distanceInMeters(
        location.latitude as number,
        location.longitude as number,
        place.latitude,
        place.longitude
      ),
    }))
    .filter(item => item.distance <= SAVED_PLACE_MATCH_RADIUS_METERS)
    .sort((a, b) => a.distance - b.distance)[0]?.place ?? null;
}

function proximityCopy(
  place: FavoritePlace,
  preference: PlaceProximityPreference
) {
  return (
    preference.custom_message?.trim() ||
    (place.meaning
      ? `Vocês estão perto de ${place.title}. ${place.meaning}`
      : `Vocês estão perto de ${place.title}. Que tal guardar mais um pedacinho dessa história?`)
  );
}

function nameFromProfile(profile: DatabasePost["profiles"]) {
  if (Array.isArray(profile)) return profile[0]?.name ?? "Alguém";
  return profile?.name ?? "Alguém";
}

function mapPost(row: DatabasePost, imageUrl?: string): Post {
  return {
    id: row.id,
    content: row.content,
    created_at: row.created_at,
    author_id: row.author_id,
    author_name: nameFromProfile(row.profiles),
    image_path: row.image_path,
    image_url: imageUrl,
  };
}

function mapMessage(row: DatabaseMessage): ChatMessage {
  return {
    id: row.id,
    text: row.text,
    created_at: row.created_at,
    sender_id: row.sender_id,
    sender_name: row.sender_name ?? "Alguém",
  };
}

function mapPlan(row: DatabasePlan): Plan {
  return {
    id: row.id,
    title: row.title,
    details: row.details,
    scheduled_for: row.scheduled_for,
    completed: row.completed,
    created_by: row.created_by,
  };
}

async function signedPhotoUrl(path?: string | null) {
  if (!path || !supabase) return undefined;
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error) return undefined;
  return data.signedUrl;
}

async function signedAvatarUrl(path?: string | null) {
  if (!path || !supabase) return undefined;
  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error) return undefined;
  return data.signedUrl;
}

function categoryDetails(category: PlaceCategory) {
  return (
    PLACE_CATEGORIES.find(item => item.id === category) ?? PLACE_CATEGORIES[2]
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-label="Símbolo appCasal: dois arcos entrelaçados"
        className="brand-arcs"
        role="img"
      >
        <span />
        <span />
      </span>
      {!compact && (
        <div className="leading-none">
          <p className="font-display text-[1.55rem] tracking-[-0.06em] text-ink">
            appCasal
          </p>
          <p className="mt-1 text-[0.62rem] font-extrabold uppercase tracking-[0.22em] text-ink/45">
            só para dois
          </p>
        </div>
      )}
    </div>
  );
}

function NavItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof HomeIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-current={active ? "page" : undefined}
      className={`group flex w-full items-center gap-3 rounded-[1.05rem] px-3 py-3 text-left text-sm font-bold transition-all duration-200 ${active ? "bg-hibiscus text-white shadow-[0_10px_20px_rgba(201,87,103,0.2)]" : "text-ink/52 hover:bg-white/75 hover:text-ink"}`}
      onClick={onClick}
      type="button"
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.6 : 2} />
      <span>{label}</span>
    </button>
  );
}

function NotificationButton({
  unreadCount,
  isOpen,
  onClick,
  className = "",
}: {
  unreadCount: number;
  isOpen: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      aria-expanded={isOpen}
      aria-haspopup="dialog"
      aria-label={
        unreadCount ? `${unreadCount} avisos não lidos` : "Abrir avisos"
      }
      className={`relative grid h-10 w-10 place-items-center rounded-xl border border-ink/8 bg-white text-ink shadow-sm transition hover:border-hibiscus/35 hover:text-hibiscus ${className}`}
      onClick={onClick}
      type="button"
    >
      <Bell className="h-4 w-4" />
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-hibiscus px-1 text-[0.58rem] font-extrabold text-white ring-2 ring-paper">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
}

function NotificationsPanel({
  notifications,
  onClose,
}: {
  notifications: AppNotification[];
  onClose: () => void;
}) {
  return (
    <section
      aria-label="Avisos do casal"
      aria-modal="true"
      className="fixed inset-x-4 top-[4.8rem] z-[60] mx-auto max-h-[min(560px,calc(100vh-6.5rem))] w-auto max-w-md overflow-hidden rounded-[1.45rem] border border-ink/10 bg-paper shadow-[0_24px_70px_rgba(55,35,42,0.22)] sm:left-auto sm:right-8 sm:mx-0 sm:w-[390px]"
      role="dialog"
    >
      <div className="flex items-start justify-between border-b border-ink/8 bg-white/75 px-5 py-4">
        <div>
          <p className="text-[0.63rem] font-extrabold uppercase tracking-[0.17em] text-hibiscus">
            avisos do caderno
          </p>
          <h2 className="mt-1 font-display text-2xl tracking-[-0.05em] text-ink">
            Pequenas notícias de vocês
          </h2>
        </div>
        <button
          aria-label="Fechar avisos"
          className="rounded-lg p-2 text-ink/48 transition hover:bg-hibiscus-soft hover:text-hibiscus"
          onClick={onClose}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-[420px] space-y-2 overflow-y-auto p-3">
        {notifications.length === 0 ? (
          <div className="px-4 py-9 text-center">
            <Bell className="mx-auto h-6 w-6 text-hibiscus/65" />
            <p className="mt-3 font-extrabold text-ink">
              Tudo tranquilo por aqui.
            </p>
            <p className="mt-1 text-sm leading-6 text-ink/52">
              Novos planos e mudanças de localização aparecem neste espaço.
            </p>
          </div>
        ) : (
          notifications.map(notification => (
            <article
              className={`rounded-xl border px-4 py-3.5 ${notification.read_at ? "border-ink/7 bg-white/55" : "border-hibiscus/20 bg-hibiscus-soft/55"}`}
              key={notification.id}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-1.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${notification.kind === "location_started" ? "bg-sage/15 text-sage" : notification.kind === "location_paused" ? "bg-plum/10 text-plum" : "bg-hibiscus-soft text-hibiscus"}`}
                >
                  {notification.kind === "location_started" ? (
                    <MapPin className="h-3.5 w-3.5" />
                  ) : notification.kind === "location_paused" ? (
                    <Pause className="h-3.5 w-3.5" />
                  ) : (
                    <CalendarDays className="h-3.5 w-3.5" />
                  )}
                </span>
                <div className="min-w-0">
                  <p
                    className={`text-sm ${notification.read_at ? "font-bold text-ink/68" : "font-extrabold text-ink"}`}
                  >
                    {notification.title}
                  </p>
                  <p className="mt-1 text-sm leading-5 text-ink/55">
                    {notification.body}
                  </p>
                  <p className="mt-2 text-[0.64rem] font-extrabold uppercase tracking-[0.12em] text-ink/38">
                    {formatDate(notification.created_at)} ·{" "}
                    {formatTime(notification.created_at)}
                  </p>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function FloatingNotifications({
  isOpen,
  notifications,
  unreadCount,
  onToggle,
  onClose,
}: {
  isOpen: boolean;
  notifications: AppNotification[];
  unreadCount: number;
  onToggle: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed right-5 top-4 z-[55] sm:right-7 lg:right-12">
      <NotificationButton
        isOpen={isOpen}
        onClick={onToggle}
        unreadCount={unreadCount}
      />
      {isOpen && (
        <NotificationsPanel notifications={notifications} onClose={onClose} />
      )}
    </div>
  );
}

function RitualsPanel({
  currentUserId,
  dailyMoods,
  giftNotes,
  giftOccasion,
  giftTitle,
  giftUrl,
  giftWishes,
  isPreview,
  onClose,
  onGiftNotesChange,
  onGiftOccasionChange,
  onGiftTitleChange,
  onGiftUrlChange,
  onSaveGift,
  onSaveMood,
  onSaveRelationshipDate,
  onSaveWish,
  onWishDraftChange,
  relationshipStartedOn,
  saving,
  sharedWishes,
  wishDraft,
}: {
  currentUserId: string;
  dailyMoods: DailyMood[];
  giftNotes: string;
  giftOccasion: string;
  giftTitle: string;
  giftUrl: string;
  giftWishes: GiftWish[];
  isPreview: boolean;
  onClose: () => void;
  onGiftNotesChange: (value: string) => void;
  onGiftOccasionChange: (value: string) => void;
  onGiftTitleChange: (value: string) => void;
  onGiftUrlChange: (value: string) => void;
  onSaveGift: () => void;
  onSaveMood: (mood: MoodKey) => void;
  onSaveRelationshipDate: (value: string) => void;
  onSaveWish: () => void;
  onWishDraftChange: (value: string) => void;
  relationshipStartedOn: string;
  saving: boolean;
  sharedWishes: SharedWish[];
  wishDraft: string;
}) {
  const relationshipTime = relationshipStartedOn
    ? formatRelationshipTime(relationshipStartedOn)
    : null;
  const relationshipLabel = relationshipTime
    ? `${relationshipTime.years ? `${relationshipTime.years} ${relationshipTime.years === 1 ? "ano" : "anos"} e ` : ""}${relationshipTime.months} ${relationshipTime.months === 1 ? "mês" : "meses"} de história`
    : "Escolham a data para começar a contar";
  const reminders = [
    { label: "Nosso mêsversário", date: getUpcomingMonthlyDate(23) },
    {
      label: "Nosso aniversário de namoro",
      date: getUpcomingAnnualDate(5, 23),
    },
    { label: "Aniversário especial", date: getUpcomingAnnualDate(0, 12) },
    { label: "Aniversário especial", date: getUpcomingAnnualDate(7, 21) },
  ];
  const ownMood = dailyMoods.find(
    mood => mood.author_id === currentUserId
  )?.mood;
  return (
    <section
      aria-label="Rituais do casal"
      aria-modal="true"
      className="paper-note fixed inset-x-3 bottom-3 top-[4.8rem] z-[60] mx-auto max-w-2xl overflow-hidden rounded-[1.5rem] border border-ink/10 bg-paper shadow-[0_24px_70px_rgba(55,35,42,0.22)] sm:left-auto sm:right-8 sm:mx-0 sm:w-[min(620px,calc(100vw-4rem))]"
      role="dialog"
    >
      <div className="flex items-start justify-between border-b border-ink/8 bg-white/75 px-5 py-4">
        <div>
          <p className="text-[0.63rem] font-extrabold uppercase tracking-[0.17em] text-hibiscus">
            rituais do nosso caderno
          </p>
          <h2 className="mt-1 font-display text-2xl tracking-[-0.05em] text-ink">
            Coisas boas para esperar
          </h2>
        </div>
        <button
          aria-label="Fechar rituais"
          className="rounded-lg p-2 text-ink/48 transition hover:bg-hibiscus-soft hover:text-hibiscus"
          onClick={onClose}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-[calc(100vh-8.5rem)] space-y-5 overflow-y-auto p-4 sm:p-5">
        <section className="relative overflow-hidden rounded-[1.35rem] bg-plum p-5 text-white">
          <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-hibiscus/30 blur-2xl" />
          <div className="relative flex items-center gap-2 text-white/70">
            <span className="grid h-6 w-6 place-items-center rounded-full border border-white/30 text-[0.6rem] font-extrabold">
              V
            </span>
            <span className="relative h-px flex-1 bg-hibiscus-light/75 before:absolute before:left-1/2 before:top-1/2 before:h-2 before:w-2 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:bg-hibiscus-light" />
            <span className="grid h-6 w-6 place-items-center rounded-full border border-white/30 text-[0.6rem] font-extrabold">
              +
            </span>
          </div>
          <p className="relative mt-4 text-[0.63rem] font-extrabold uppercase tracking-[0.16em] text-white/65">
            o tempo de vocês
          </p>
          <p className="relative mt-2 font-display text-3xl leading-[0.95] tracking-[-0.05em]">
            {relationshipLabel}
          </p>
          <label className="relative mt-4 block max-w-[230px]">
            <span className="mb-1.5 block text-[0.62rem] font-extrabold uppercase tracking-[0.13em] text-white/65">
              começamos em
            </span>
            <BrazilianDateInput
              aria-describedby="relationship-date-hint"
              className="h-9 border-white/15 bg-white/12 text-sm text-white [color-scheme:dark]"
              onDateChange={onSaveRelationshipDate}
              value={relationshipStartedOn}
            />
            <span className="sr-only" id="relationship-date-hint">{FOUR_DIGIT_YEAR_DATE_HINT}</span>
          </label>
        </section>
        <section className="rounded-[1.35rem] border border-ink/8 bg-white p-4">
          <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.16em] text-hibiscus">
            próximos lembretes
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {reminders.map(reminder => (
              <article
                className="flex items-center justify-between gap-3 rounded-xl bg-paper px-3.5 py-3"
                key={`${reminder.label}-${reminder.date.toISOString()}`}
              >
                <div>
                  <p className="text-sm font-extrabold text-ink">
                    {reminder.label}
                  </p>
                  <p className="mt-0.5 text-xs text-ink/48">
                    {formatDate(reminder.date.toISOString())}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-extrabold text-hibiscus">
                  {formatCountdown(reminder.date)}
                </span>
              </article>
            ))}
          </div>
        </section>
        <section className="rounded-[1.35rem] border border-hibiscus/14 bg-hibiscus-soft/45 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.16em] text-hibiscus">
                como está seu coração?
              </p>
              <p className="mt-1 text-sm font-bold text-ink">
                Seu humor de hoje fica guardado para vocês.
              </p>
            </div>
            <span className="text-xl">
              {MOOD_OPTIONS.find(mood => mood.id === ownMood)?.emoji ?? "💌"}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {MOOD_OPTIONS.map(mood => (
              <button
                aria-pressed={ownMood === mood.id}
                className={`flex min-w-[84px] flex-1 flex-col items-center gap-1 rounded-xl border px-2 py-2 text-[0.65rem] font-extrabold transition ${ownMood === mood.id ? "border-hibiscus bg-white text-hibiscus shadow-sm" : "border-white bg-white/65 text-ink/52 hover:border-hibiscus/30"}`}
                key={mood.id}
                onClick={() => onSaveMood(mood.id)}
                type="button"
              >
                <span className="text-xl leading-none">{mood.emoji}</span>
                {mood.label}
              </button>
            ))}
          </div>
        </section>
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[1.35rem] border border-ink/8 bg-white p-4">
            <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.16em] text-hibiscus">
              desejos a dois
            </p>
            <p className="mt-1 text-sm leading-5 text-ink/52">
              Ideias pequenas para viverem juntos.
            </p>
            <Textarea
              className="mt-3 min-h-[74px] resize-none rounded-xl border-ink/10 bg-paper text-sm focus-visible:ring-hibiscus"
              onChange={event => onWishDraftChange(event.target.value)}
              placeholder="Quero ver o pôr do sol com você..."
              value={wishDraft}
            />
            <Button
              className="mt-2 h-9 w-full rounded-lg bg-hibiscus text-xs font-extrabold text-white hover:bg-hibiscus/90"
              disabled={saving || !wishDraft.trim()}
              onClick={onSaveWish}
              type="button"
            >
              guardar desejo
            </Button>
            <div className="mt-3 space-y-2">
              {sharedWishes.length === 0 ? (
                <p className="rounded-lg bg-paper px-3 py-3 text-xs leading-5 text-ink/48">
                  Ainda não há desejos guardados.
                </p>
              ) : (
                sharedWishes.slice(0, 4).map(wish => (
                  <div
                    className="rounded-lg bg-paper px-3 py-2.5"
                    key={wish.id}
                  >
                    <p className="text-sm font-bold leading-5 text-ink">
                      {wish.content}
                    </p>
                    <p className="mt-1 text-[0.62rem] font-extrabold uppercase tracking-[0.12em] text-ink/38">
                      {wish.author_id === currentUserId
                        ? "seu desejo"
                        : "desejo do seu par"}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="rounded-[1.35rem] border border-ink/8 bg-white p-4">
            <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.16em] text-hibiscus">
              presentes desejados
            </p>
            <p className="mt-1 text-sm leading-5 text-ink/52">
              Registrem pistas para as datas especiais.
            </p>
            <Input
              className="mt-3 h-9 rounded-xl border-ink/10 bg-paper text-sm focus-visible:ring-hibiscus"
              onChange={event => onGiftTitleChange(event.target.value)}
              placeholder="Ideia de presente"
              value={giftTitle}
            />
            <Input
              className="mt-2 h-9 rounded-xl border-ink/10 bg-paper text-sm focus-visible:ring-hibiscus"
              onChange={event => onGiftOccasionChange(event.target.value)}
              placeholder="Ocasião, ex.: aniversário"
              value={giftOccasion}
            />
            <Textarea
              className="mt-2 min-h-[58px] resize-none rounded-xl border-ink/10 bg-paper text-sm focus-visible:ring-hibiscus"
              onChange={event => onGiftNotesChange(event.target.value)}
              placeholder="Tamanho, cor ou outro detalhe"
              value={giftNotes}
            />
            <Input
              className="mt-2 h-9 rounded-xl border-ink/10 bg-paper text-sm focus-visible:ring-hibiscus"
              onChange={event => onGiftUrlChange(event.target.value)}
              placeholder="Link de referência (opcional)"
              type="url"
              value={giftUrl}
            />
            <Button
              className="mt-2 h-9 w-full rounded-lg bg-plum text-xs font-extrabold text-white hover:bg-plum/90"
              disabled={saving || !giftTitle.trim()}
              onClick={onSaveGift}
              type="button"
            >
              guardar presente
            </Button>
            <div className="mt-3 space-y-2">
              {giftWishes.length === 0 ? (
                <p className="rounded-lg bg-paper px-3 py-3 text-xs leading-5 text-ink/48">
                  Nenhuma ideia de presente ainda.
                </p>
              ) : (
                giftWishes.slice(0, 4).map(gift => (
                  <div
                    className="rounded-lg bg-paper px-3 py-2.5"
                    key={gift.id}
                  >
                    <p className="text-sm font-bold leading-5 text-ink">
                      {gift.title}
                    </p>
                    {gift.occasion && (
                      <p className="mt-0.5 text-xs text-hibiscus">
                        {gift.occasion}
                      </p>
                    )}
                    {gift.reference_url && (
                      <a
                        className="mt-1 block truncate text-xs font-bold text-plum underline decoration-plum/30 underline-offset-2"
                        href={gift.reference_url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        ver referência
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
        {isPreview && (
          <p className="px-1 text-xs leading-5 text-ink/45">
            Na prévia, os rituais ficam apenas neste dispositivo durante a
            sessão.
          </p>
        )}
      </div>
    </section>
  );
}

function FloatingRituals({
  isOpen,
  onToggle,
  ...props
}: Omit<Parameters<typeof RitualsPanel>[0], "onClose"> & {
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="fixed right-16 top-4 z-[55] sm:right-[4.75rem] lg:right-[7.1rem]">
      <button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label="Abrir rituais do casal"
        className="grid h-10 w-10 place-items-center rounded-xl border border-ink/8 bg-white text-hibiscus shadow-sm transition hover:border-hibiscus/35 hover:bg-hibiscus-soft"
        onClick={onToggle}
        type="button"
      >
        <Heart className="h-4 w-4 fill-current" />
      </button>
      {isOpen && <RitualsPanel {...props} onClose={onToggle} />}
    </div>
  );
}

function LocationSummary({
  currentUserId,
  isPreview,
  locations,
  busy,
  onClose,
  onStart,
  onStop,
}: {
  currentUserId: string;
  isPreview: boolean;
  locations: CoupleLocation[];
  busy: boolean;
  onClose: () => void;
  onStart: () => void;
  onStop: () => void;
}) {
  const mine = locations.find(location => location.user_id === currentUserId);
  const partner = locations.find(
    location => location.user_id !== currentUserId && location.sharing_enabled
  );
  const partnerMap = partner ? locationMapUrl(partner) : undefined;
  return (
    <section
      aria-label="Localização compartilhada"
      aria-modal="true"
      className="paper-note fixed inset-x-3 bottom-3 top-[4.8rem] z-[60] mx-auto max-w-md overflow-hidden rounded-[1.5rem] border border-ink/10 bg-paper shadow-[0_24px_70px_rgba(55,35,42,0.22)] sm:left-auto sm:right-8 sm:mx-0 sm:w-[min(430px,calc(100vw-4rem))]"
      role="dialog"
    >
      <div className="flex items-start justify-between border-b border-ink/8 bg-white/75 px-5 py-4">
        <div>
          <p className="text-[0.63rem] font-extrabold uppercase tracking-[0.17em] text-hibiscus">
            localização a dois
          </p>
          <h2 className="mt-1 font-display text-2xl tracking-[-0.05em] text-ink">
            Perto, quando quiserem
          </h2>
        </div>
        <button
          aria-label="Fechar localização"
          className="rounded-lg p-2 text-ink/48 transition hover:bg-hibiscus-soft hover:text-hibiscus"
          onClick={onClose}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-4 overflow-y-auto p-4 sm:p-5">
        <section
          className={`rounded-[1.3rem] p-4 ${mine?.sharing_enabled ? "bg-plum text-white" : "border border-ink/8 bg-white text-ink"}`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${mine?.sharing_enabled ? "bg-white/14 text-white" : "bg-hibiscus-soft text-hibiscus"}`}
            >
              <MapPin className="h-5 w-5" />
            </span>
            <div>
              <p className="font-extrabold">Sua localização</p>
              <p
                className={`mt-1 text-sm leading-5 ${mine?.sharing_enabled ? "text-white/70" : "text-ink/55"}`}
              >
                {mine?.sharing_enabled
                  ? `Compartilhando agora · atualizada ${formatTime(mine.updated_at)}`
                  : "Pausada. Nenhuma posição fica guardada."}
              </p>
            </div>
          </div>
          <Button
            className={`mt-4 h-10 w-full rounded-xl text-xs font-extrabold ${mine?.sharing_enabled ? "border border-white/20 bg-white/12 text-white hover:bg-white/20" : "bg-hibiscus text-white hover:bg-hibiscus/90"}`}
            disabled={busy}
            onClick={mine?.sharing_enabled ? onStop : onStart}
            type="button"
            variant={mine?.sharing_enabled ? "outline" : "default"}
          >
            {mine?.sharing_enabled ? (
              <>
                <Pause className="mr-1.5 h-3.5 w-3.5" />
                {busy ? "Pausando..." : "pausar compartilhamento"}
              </>
            ) : (
              <>
                <Play className="mr-1.5 h-3.5 w-3.5" />
                {busy ? "Ativando..." : "compartilhar minha localização"}
              </>
            )}
          </Button>
        </section>
        <section className="rounded-[1.3rem] border border-ink/8 bg-white p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-hibiscus-soft text-hibiscus">
              <Compass className="h-5 w-5" />
            </span>
            <div>
              <p className="font-extrabold text-ink">Localização do seu par</p>
              <p className="mt-1 text-sm leading-5 text-ink/55">
                {partner
                  ? `Compartilhada voluntariamente · atualizada ${formatTime(partner.updated_at)}`
                  : "A outra pessoa ainda não está compartilhando."}
              </p>
            </div>
          </div>
          {partnerMap && (
            <a
              className="mt-4 flex h-10 w-full items-center justify-center rounded-xl border border-hibiscus/22 bg-hibiscus-soft text-xs font-extrabold text-hibiscus transition hover:bg-hibiscus hover:text-white"
              href={partnerMap}
              rel="noreferrer"
              target="_blank"
            >
              <ArrowUpRight className="mr-1.5 h-3.5 w-3.5" />
              abrir localização no mapa
            </a>
          )}
        </section>
        <div className="rounded-xl border border-dashed border-ink/13 bg-white/50 px-3.5 py-3 text-xs leading-5 text-ink/52">
          <LockKeyhole className="mr-1.5 inline h-3.5 w-3.5 text-hibiscus" />A
          ativação pede permissão do navegador. Ao pausar, a posição atual é
          apagada; o app não guarda histórico de trajetos.
        </div>
        {isPreview && (
          <p className="px-1 text-xs leading-5 text-ink/45">
            Na prévia, sua posição não sai deste dispositivo.
          </p>
        )}
      </div>
    </section>
  );
}

function CoupleMap({
  coupleMembers,
  currentUserId,
  favoritePlaces,
  locations,
  mapClassName,
}: {
  coupleMembers: CoupleMember[];
  currentUserId: string;
  favoritePlaces: FavoritePlace[];
  locations: CoupleLocation[];
  mapClassName?: string;
}) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const firstLocation = locations.find(
    location =>
      location.sharing_enabled &&
      location.latitude !== null &&
      location.longitude !== null
  );
  const sharedLocations = locations.filter(
    location =>
      location.sharing_enabled &&
      location.latitude !== null &&
      location.longitude !== null
  );
  const initialCenter =
    firstLocation &&
    firstLocation.latitude !== null &&
    firstLocation.longitude !== null
      ? { lat: firstLocation.latitude, lng: firstLocation.longitude }
      : favoritePlaces[0]
        ? { lat: favoritePlaces[0].latitude, lng: favoritePlaces[0].longitude }
        : { lat: 0, lng: 0 };
  const initialZoom =
    sharedLocations.length === 1
      ? 17
      : firstLocation || favoritePlaces[0]
        ? 14
        : 2;

  useEffect(() => {
    if (!map || !window.google?.maps?.marker) return;
    markersRef.current.forEach(marker => {
      marker.map = null;
    });
    markersRef.current = [];
    const bounds = new window.google.maps.LatLngBounds();
    const participantBounds = new window.google.maps.LatLngBounds();
    let markerCount = 0;
    let participantMarkerCount = 0;
    const addMarker = (
      position: google.maps.LatLngLiteral,
      title: string,
      content: HTMLElement,
      participant = false
    ) => {
      const marker = new window.google.maps.marker.AdvancedMarkerElement({
        map,
        position,
        title,
        content,
      });
      markersRef.current.push(marker);
      bounds.extend(position);
      markerCount += 1;
      if (participant) {
        participantBounds.extend(position);
        participantMarkerCount += 1;
      }
    };
    locations
      .filter(
        location =>
          location.sharing_enabled &&
          location.latitude !== null &&
          location.longitude !== null
      )
      .forEach(location => {
        const member = coupleMembers.find(
          item => item.user_id === location.user_id
        );
        const name =
          member?.name ??
          (location.user_id === currentUserId ? "Você" : "Seu par");
        const pin = document.createElement("div");
        pin.style.cssText = `display:grid;place-items:center;overflow:hidden;width:44px;height:44px;border-radius:999px;background:${location.user_id === currentUserId ? "#c95767" : "#573744"};color:#fff;border:3px solid #fff;box-shadow:0 6px 18px rgba(55,35,42,.28);font:800 14px/1 system-ui,sans-serif;`;
        if (member?.avatar_url) {
          const photo = document.createElement("img");
          photo.alt = `Foto de ${name}`;
          photo.src = member.avatar_url;
          photo.style.cssText = "width:100%;height:100%;object-fit:cover;";
          pin.append(photo);
        } else {
          pin.textContent = name.slice(0, 1).toUpperCase();
        }
        addMarker(
          {
            lat: location.latitude as number,
            lng: location.longitude as number,
          },
          `${name} está compartilhando a localização`,
          pin,
          true
        );
      });
    favoritePlaces.forEach(place => {
      const category = categoryDetails(place.category);
      const pin = document.createElement("div");
      const palette =
        place.category === "viagens"
          ? { bg: "#edf5ef", fg: "#567c63" }
          : place.category === "favoritos"
            ? { bg: "#f2eaef", fg: "#573744" }
            : { bg: "#fff7f7", fg: "#c95767" };
      pin.style.cssText = `display:grid;place-items:center;width:34px;height:34px;border-radius:11px;background:${palette.bg};color:${palette.fg};border:2px solid ${palette.fg};box-shadow:0 5px 14px rgba(55,35,42,.16);font-size:16px;font-weight:800;`;
      pin.textContent = category.marker;
      addMarker(
        { lat: place.latitude, lng: place.longitude },
        `${category.label}: ${place.title}`,
        pin
      );
    });
    if (participantMarkerCount > 1) {
      map.fitBounds(participantBounds, 56);
    } else if (participantMarkerCount === 1) {
      map.setCenter(participantBounds.getCenter());
      map.setZoom(17);
    } else if (markerCount > 1) {
      map.fitBounds(bounds, 56);
    } else if (markerCount === 1) {
      map.setCenter(bounds.getCenter());
      map.setZoom(17);
    }
    return () => {
      markersRef.current.forEach(marker => {
        marker.map = null;
      });
    };
  }, [coupleMembers, currentUserId, favoritePlaces, locations, map]);

  return (
      <MapView
        className={`h-[250px] overflow-hidden rounded-[1.15rem] border border-ink/8 ${mapClassName ?? ""}`}
        initialCenter={initialCenter}
        initialZoom={initialZoom}
        onMapReady={setMap}
        showMarker={Boolean(firstLocation || favoritePlaces[0])}
      />
  );
}

function LocationPanel({
  busy,
  addressBusy,
  coupleMembers,
  currentUserId,
  favoritePlaces,
  isPreview,
  locations,
  onClose,
  onSavePlace,
  onStart,
  onStop,
  onFindAddress,
  onUseCurrentPosition,
  placeCoordinates,
  placeAddress,
  placeMeaning,
  placeTitle,
  savingPlace,
  setPlaceAddress,
  setPlaceMeaning,
  setPlaceTitle,
}: {
  busy: boolean;
  addressBusy: boolean;
  coupleMembers: CoupleMember[];
  currentUserId: string;
  favoritePlaces: FavoritePlace[];
  isPreview: boolean;
  locations: CoupleLocation[];
  onClose: () => void;
  onSavePlace: () => void;
  onStart: () => void;
  onStop: () => void;
  onFindAddress: () => void;
  onUseCurrentPosition: () => void;
  placeCoordinates: { latitude: number; longitude: number } | null;
  placeAddress: string;
  placeMeaning: string;
  placeTitle: string;
  savingPlace: boolean;
  setPlaceAddress: (value: string) => void;
  setPlaceMeaning: (value: string) => void;
  setPlaceTitle: (value: string) => void;
}) {
  const mine = locations.find(location => location.user_id === currentUserId);
  const partner = locations.find(
    location => location.user_id !== currentUserId && location.sharing_enabled
  );
  return (
    <section
      aria-label="Mapa afetivo do casal"
      aria-modal="true"
      className="paper-note fixed inset-x-3 bottom-3 top-[4.8rem] z-[60] mx-auto max-w-3xl overflow-hidden rounded-[1.5rem] border border-ink/10 bg-paper shadow-[0_24px_70px_rgba(55,35,42,0.22)] sm:left-auto sm:right-8 sm:mx-0 sm:w-[min(760px,calc(100vw-4rem))]"
      role="dialog"
    >
      <div className="flex items-start justify-between border-b border-ink/8 bg-white/75 px-5 py-4">
        <div>
          <p className="text-[0.63rem] font-extrabold uppercase tracking-[0.17em] text-hibiscus">
            mapa afetivo
          </p>
          <h2 className="mt-1 font-display text-2xl tracking-[-0.05em] text-ink">
            Os lugares que são de vocês
          </h2>
        </div>
        <button
          aria-label="Fechar mapa"
          className="rounded-lg p-2 text-ink/48 transition hover:bg-hibiscus-soft hover:text-hibiscus"
          onClick={onClose}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-[calc(100vh-8.5rem)] space-y-4 overflow-y-auto p-4 sm:p-5">
        <CoupleMap
          coupleMembers={coupleMembers}
          currentUserId={currentUserId}
          favoritePlaces={favoritePlaces}
          locations={locations}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <section
            className={`rounded-[1.25rem] p-4 ${mine?.sharing_enabled ? "bg-plum text-white" : "border border-ink/8 bg-white text-ink"}`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${mine?.sharing_enabled ? "bg-white/14 text-white" : "bg-hibiscus-soft text-hibiscus"}`}
              >
                <Navigation className="h-4 w-4" />
              </span>
              <div>
                <p className="font-extrabold">Seu marcador</p>
                <p
                  className={`mt-1 text-xs leading-5 ${mine?.sharing_enabled ? "text-white/70" : "text-ink/55"}`}
                >
                  {mine?.sharing_enabled
                    ? `Ativo · ${formatTime(mine.updated_at)}`
                    : "Pausado e sem coordenadas guardadas."}
                </p>
              </div>
            </div>
            <Button
              className={`mt-3 h-9 w-full rounded-xl text-xs font-extrabold ${mine?.sharing_enabled ? "border border-white/20 bg-white/12 text-white hover:bg-white/20" : "bg-hibiscus text-white hover:bg-hibiscus/90"}`}
              disabled={busy}
              onClick={mine?.sharing_enabled ? onStop : onStart}
              type="button"
              variant={mine?.sharing_enabled ? "outline" : "default"}
            >
              {mine?.sharing_enabled ? (
                <>
                  <Pause className="mr-1.5 h-3.5 w-3.5" />
                  {busy ? "pausando..." : "pausar"}
                </>
              ) : (
                <>
                  <Play className="mr-1.5 h-3.5 w-3.5" />
                  {busy ? "ativando..." : "compartilhar"}
                </>
              )}
            </Button>
          </section>
          <section className="rounded-[1.25rem] border border-ink/8 bg-white p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-hibiscus-soft text-hibiscus">
                <MapPin className="h-4 w-4" />
              </span>
              <div>
                <p className="font-extrabold text-ink">Marcador do seu par</p>
                <p className="mt-1 text-xs leading-5 text-ink/55">
                  {partner
                    ? `Visível por escolha · ${formatTime(partner.updated_at)}`
                    : "Aparece somente quando a outra pessoa compartilhar."}
                </p>
              </div>
            </div>
            <p className="mt-3 border-t border-ink/7 pt-3 text-xs leading-5 text-ink/48">
              Os círculos levam as iniciais de cada pessoa; os corações são os
              lugares guardados.
            </p>
          </section>
        </div>
        <section className="rounded-[1.25rem] border border-hibiscus/14 bg-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.16em] text-hibiscus">
                guardar um lugar
              </p>
              <p className="mt-1 text-sm leading-5 text-ink/52">
                Primeiro encontro, um café favorito ou qualquer capítulo
                especial.
              </p>
            </div>
            <Bookmark className="h-5 w-5 shrink-0 text-hibiscus" />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
            <Input
              className="h-9 rounded-xl border-ink/10 bg-paper text-sm focus-visible:ring-hibiscus"
              onChange={event => setPlaceTitle(event.target.value)}
              placeholder="Ex.: nosso primeiro encontro"
              value={placeTitle}
            />
            <Button
              className="h-9 rounded-xl border border-hibiscus/22 bg-hibiscus-soft px-3 text-xs font-extrabold text-hibiscus hover:bg-hibiscus hover:text-white"
              onClick={onUseCurrentPosition}
              type="button"
              variant="outline"
            >
              <Navigation className="mr-1.5 h-3.5 w-3.5" />
              usar minha posição
            </Button>
          </div>
          <div className="mt-2 flex gap-2">
            <Input
              className="h-10 flex-1 rounded-xl border-ink/10 bg-paper text-sm focus-visible:ring-hibiscus"
              onChange={event => {
                setPlaceAddress(event.target.value);
              }}
              placeholder="Ex.: Rodovia Presidente Dutra, 2550"
              value={placeAddress}
            />
            <Button
              className="h-10 rounded-xl border border-hibiscus/22 bg-hibiscus-soft px-3 text-xs font-extrabold text-hibiscus hover:bg-hibiscus hover:text-white"
              disabled={addressBusy || !placeAddress.trim()}
              onClick={onFindAddress}
              type="button"
              variant="outline"
            >
              {addressBusy ? "buscando..." : "buscar endereço"}
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button className="rounded-full bg-plum/10 px-3 py-1.5 text-xs font-extrabold text-plum" onClick={() => setPlaceTitle("Casa")} type="button">Casa</button>
            <button className="rounded-full bg-hibiscus-soft px-3 py-1.5 text-xs font-extrabold text-hibiscus" onClick={() => setPlaceTitle("Trabalho")} type="button">Trabalho</button>
          </div>
          <Textarea
            className="mt-2 min-h-[58px] resize-none rounded-xl border-ink/10 bg-paper text-sm focus-visible:ring-hibiscus"
            onChange={event => setPlaceMeaning(event.target.value)}
            placeholder="Por que esse lugar é importante para vocês?"
            value={placeMeaning}
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p
              className={`text-xs font-bold ${placeCoordinates ? "text-sage" : "text-ink/42"}`}
            >
              {placeCoordinates
                ? "posição pronta para guardar"
                : "escolha sua posição atual para marcar o lugar"}
            </p>
            <Button
              className="h-9 rounded-xl bg-hibiscus px-4 text-xs font-extrabold text-white hover:bg-hibiscus/90"
              disabled={savingPlace || !placeTitle.trim() || !placeCoordinates}
              onClick={onSavePlace}
              type="button"
            >
              {savingPlace ? "guardando..." : "guardar lugar"}
            </Button>
          </div>
        </section>
        <section className="space-y-2">
          <p className="memory-marker">lugares de vocês</p>
          {favoritePlaces.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ink/13 bg-white/55 px-4 py-4 text-sm leading-6 text-ink/52">
              O primeiro ponto pode ser aquele lugar que sempre faz vocês
              voltarem à mesma história.
            </p>
          ) : (
            favoritePlaces.map(place => (
              <article
                className="flex items-start gap-3 rounded-xl border border-ink/8 bg-white px-4 py-3"
                key={place.id}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-hibiscus-soft text-hibiscus">
                  <Heart className="h-3.5 w-3.5 fill-current" />
                </span>
                <div>
                  <p className="text-sm font-extrabold text-ink">
                    {place.title}
                  </p>
                  {place.meaning && (
                    <p className="mt-0.5 text-sm leading-5 text-ink/54">
                      {place.meaning}
                    </p>
                  )}
                </div>
              </article>
            ))
          )}
        </section>
        <div className="rounded-xl border border-dashed border-ink/13 bg-white/50 px-3.5 py-3 text-xs leading-5 text-ink/52">
          <LockKeyhole className="mr-1.5 inline h-3.5 w-3.5 text-hibiscus" />A
          posição aparece apenas com consentimento. Pausar remove coordenadas;
          lugares favoritos só ficam salvos quando vocês escolhem guardá-los.
        </div>
        {isPreview && (
          <p className="px-1 text-xs leading-5 text-ink/45">
            Na prévia, os lugares ficam somente nesta sessão.
          </p>
        )}
      </div>
    </section>
  );
}

function LocationPanelEnhanced({
  busy,
  addressBusy,
  coupleMembers,
  currentUserId,
  editingPlaceId,
  favoritePlaces,
  isPreview,
  locations,
  onAvatarUpload,
  onCancelEdit,
  onClose,
  onDeletePlace,
  onEditPlace,
  onPlaceCategoryChange,
  onPlaceFilterChange,
  onSavePlace,
  onStart,
  onStop,
  onFindAddress,
  onUseCurrentPosition,
  placeCategory,
  placeCoordinates,
  placeFilter,
  placeAddress,
  placeMeaning,
  placeTitle,
  savingAvatar,
  savingPlace,
  setPlaceAddress,
  setPlaceMeaning,
  setPlaceTitle,
}: {
  busy: boolean;
  addressBusy: boolean;
  coupleMembers: CoupleMember[];
  currentUserId: string;
  editingPlaceId: string | null;
  favoritePlaces: FavoritePlace[];
  isPreview: boolean;
  locations: CoupleLocation[];
  onAvatarUpload: (file: File | null) => void;
  onCancelEdit: () => void;
  onClose: () => void;
  onDeletePlace: (place: FavoritePlace) => void;
  onEditPlace: (place: FavoritePlace) => void;
  onPlaceCategoryChange: (category: PlaceCategory) => void;
  onPlaceFilterChange: (category: PlaceCategory | "todos") => void;
  onSavePlace: () => void;
  onStart: () => void;
  onStop: () => void;
  onFindAddress: () => void;
  onUseCurrentPosition: () => void;
  placeCategory: PlaceCategory;
  placeCoordinates: { latitude: number; longitude: number } | null;
  placeFilter: PlaceCategory | "todos";
  placeAddress: string;
  placeMeaning: string;
  placeTitle: string;
  savingAvatar: boolean;
  savingPlace: boolean;
  setPlaceAddress: (value: string) => void;
  setPlaceMeaning: (value: string) => void;
  setPlaceTitle: (value: string) => void;
}) {
  const mine = locations.find(location => location.user_id === currentUserId);
  const me = coupleMembers.find(member => member.user_id === currentUserId);
  const visiblePlaces =
    placeFilter === "todos"
      ? favoritePlaces
      : favoritePlaces.filter(place => place.category === placeFilter);
  const editing = editingPlaceId !== null;
  return (
    <section
      aria-label="Mapa afetivo do casal"
      aria-modal="true"
      className="paper-note fixed inset-x-3 bottom-3 top-[4.8rem] z-[60] mx-auto max-w-3xl overflow-hidden rounded-[1.5rem] border border-ink/10 bg-paper shadow-[0_24px_70px_rgba(55,35,42,0.22)] sm:left-auto sm:right-8 sm:mx-0 sm:w-[min(760px,calc(100vw-4rem))]"
      role="dialog"
    >
      <div className="flex items-start justify-between border-b border-ink/8 bg-white/75 px-5 py-4">
        <div>
          <p className="text-[0.63rem] font-extrabold uppercase tracking-[0.17em] text-hibiscus">
            mapa afetivo
          </p>
          <h2 className="mt-1 font-display text-2xl tracking-[-0.05em] text-ink">
            Os lugares que são de vocês
          </h2>
        </div>
        <button
          aria-label="Fechar mapa"
          className="rounded-lg p-2 text-ink/48 transition hover:bg-hibiscus-soft hover:text-hibiscus"
          onClick={onClose}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-[calc(100vh-8.5rem)] space-y-4 overflow-y-auto p-4 sm:p-5">
        <CoupleMap
          coupleMembers={coupleMembers}
          currentUserId={currentUserId}
          favoritePlaces={visiblePlaces}
          locations={locations}
        />
        <section className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div
            className={`flex items-center gap-3 rounded-[1.25rem] p-4 ${mine?.sharing_enabled ? "bg-plum text-white" : "border border-ink/8 bg-white text-ink"}`}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-hibiscus text-sm font-extrabold text-white">
              {me?.avatar_url ? (
                <img
                  alt="Sua foto de perfil"
                  className="h-full w-full object-cover"
                  src={me.avatar_url}
                />
              ) : (
                (me?.name ?? "V").slice(0, 1).toUpperCase()
              )}
            </span>
            <div className="min-w-0">
              <p className="font-extrabold">Seu marcador</p>
              <p
                className={`mt-0.5 text-xs ${mine?.sharing_enabled ? "text-white/70" : "text-ink/52"}`}
              >
                {mine?.sharing_enabled
                  ? `Compartilhando · ${formatTime(mine.updated_at)}`
                  : "Pausado e sem coordenadas guardadas."}
              </p>
            </div>
            <Button
              className={`ml-auto h-9 shrink-0 rounded-xl px-3 text-xs font-extrabold ${mine?.sharing_enabled ? "border border-white/20 bg-white/12 text-white hover:bg-white/20" : "bg-hibiscus text-white hover:bg-hibiscus/90"}`}
              disabled={busy}
              onClick={mine?.sharing_enabled ? onStop : onStart}
              type="button"
              variant={mine?.sharing_enabled ? "outline" : "default"}
            >
              {mine?.sharing_enabled ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
          <label className="flex min-h-[72px] cursor-pointer items-center justify-center gap-2 rounded-[1.25rem] border border-dashed border-hibiscus/30 bg-hibiscus-soft/45 px-4 text-xs font-extrabold text-hibiscus transition hover:bg-hibiscus hover:text-white">
            <input
              accept={ACCEPTED_PHOTO_TYPES.join(",")}
              className="sr-only"
              disabled={savingAvatar}
              onChange={event =>
                onAvatarUpload(event.target.files?.[0] ?? null)
              }
              type="file"
            />
            <Camera className="h-4 w-4" />
            {savingAvatar
              ? "enviando..."
              : me?.avatar_url
                ? "trocar foto"
                : "usar minha foto"}
          </label>
        </section>
        <section className="rounded-[1.25rem] border border-hibiscus/14 bg-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.16em] text-hibiscus">
                {editing ? "editar lugar" : "guardar um lugar"}
              </p>
              <p className="mt-1 text-sm leading-5 text-ink/52">
                {editing
                  ? "Atualizem nome, categoria, significado ou posição."
                  : "Um encontro, uma viagem ou o ponto favorito de vocês."}
              </p>
            </div>
            {editing && (
              <button
                className="text-xs font-extrabold text-ink/45 hover:text-hibiscus"
                onClick={onCancelEdit}
                type="button"
              >
                cancelar
              </button>
            )}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
            <Input
              className="h-9 rounded-xl border-ink/10 bg-paper text-sm focus-visible:ring-hibiscus"
              onChange={event => setPlaceTitle(event.target.value)}
              placeholder="Ex.: nosso primeiro encontro"
              value={placeTitle}
            />
            <Button
              className="h-9 rounded-xl border border-hibiscus/22 bg-hibiscus-soft px-3 text-xs font-extrabold text-hibiscus hover:bg-hibiscus hover:text-white"
              onClick={onUseCurrentPosition}
              type="button"
              variant="outline"
            >
              <Navigation className="mr-1.5 h-3.5 w-3.5" />
              usar posição
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {PLACE_CATEGORIES.map(category => (
              <button
                aria-pressed={placeCategory === category.id}
                className={`rounded-full px-3 py-1.5 text-xs font-extrabold transition ${placeCategory === category.id ? "bg-plum text-white" : `${category.tone} hover:brightness-95`}`}
                key={category.id}
                onClick={() => onPlaceCategoryChange(category.id)}
                type="button"
              >
                <span className="mr-1">{category.marker}</span>
                {category.label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Input
              className="h-10 flex-1 rounded-xl border-ink/10 bg-paper text-sm focus-visible:ring-hibiscus"
              onChange={event => {
                setPlaceAddress(event.target.value);
              }}
              placeholder="Ex.: Rodovia Presidente Dutra, 2550"
              value={placeAddress}
            />
            <Button
              className="h-10 rounded-xl border border-hibiscus/22 bg-hibiscus-soft px-3 text-xs font-extrabold text-hibiscus hover:bg-hibiscus hover:text-white"
              disabled={addressBusy || !placeAddress.trim()}
              onClick={onFindAddress}
              type="button"
              variant="outline"
            >
              {addressBusy ? "buscando..." : "buscar endereço"}
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button className="rounded-full bg-plum/10 px-3 py-1.5 text-xs font-extrabold text-plum" onClick={() => setPlaceTitle("Casa")} type="button">Casa</button>
            <button className="rounded-full bg-hibiscus-soft px-3 py-1.5 text-xs font-extrabold text-hibiscus" onClick={() => setPlaceTitle("Trabalho")} type="button">Trabalho</button>
          </div>
          <Textarea
            className="mt-2 min-h-[58px] resize-none rounded-xl border-ink/10 bg-paper text-sm focus-visible:ring-hibiscus"
            onChange={event => setPlaceMeaning(event.target.value)}
            placeholder="Por que esse lugar é importante para vocês?"
            value={placeMeaning}
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p
              className={`text-xs font-bold ${placeCoordinates ? "text-sage" : "text-ink/42"}`}
            >
              {placeCoordinates
                ? "posição pronta para guardar"
                : "escolha a posição atual para marcar o lugar"}
            </p>
            <Button
              className="h-9 rounded-xl bg-hibiscus px-4 text-xs font-extrabold text-white hover:bg-hibiscus/90"
              disabled={savingPlace || !placeTitle.trim() || !placeCoordinates}
              onClick={onSavePlace}
              type="button"
            >
              {savingPlace
                ? "guardando..."
                : editing
                  ? "salvar ajustes"
                  : "guardar lugar"}
            </Button>
          </div>
        </section>
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="memory-marker">lugares de vocês</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                aria-pressed={placeFilter === "todos"}
                className={`rounded-full px-2.5 py-1 text-[0.66rem] font-extrabold ${placeFilter === "todos" ? "bg-ink text-white" : "bg-white text-ink/48"}`}
                onClick={() => onPlaceFilterChange("todos")}
                type="button"
              >
                todos
              </button>
              {PLACE_CATEGORIES.map(category => (
                <button
                  aria-pressed={placeFilter === category.id}
                  className={`rounded-full px-2.5 py-1 text-[0.66rem] font-extrabold ${placeFilter === category.id ? "bg-hibiscus text-white" : "bg-white text-ink/48"}`}
                  key={category.id}
                  onClick={() => onPlaceFilterChange(category.id)}
                  type="button"
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>
          {visiblePlaces.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ink/13 bg-white/55 px-4 py-4 text-sm leading-6 text-ink/52">
              Ainda não há lugares nesta categoria. O primeiro ponto pode ser
              aquele capítulo que sempre faz vocês sorrirem.
            </p>
          ) : (
            visiblePlaces.map(place => {
              const category = categoryDetails(place.category);
              return (
                <article
                  className="flex items-start gap-3 rounded-xl border border-ink/8 bg-white px-4 py-3"
                  key={place.id}
                >
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${category.tone}`}
                  >
                    <span className="text-sm">{category.marker}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-extrabold text-ink">
                        {place.title}
                      </p>
                      <span className="rounded-full bg-paper px-2 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-[0.1em] text-ink/46">
                        {category.label}
                      </span>
                    </div>
                    {place.meaning && (
                      <p className="mt-0.5 text-sm leading-5 text-ink/54">
                        {place.meaning}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      aria-label={`Editar ${place.title}`}
                      className="rounded-lg p-2 text-ink/42 transition hover:bg-hibiscus-soft hover:text-hibiscus"
                      onClick={() => onEditPlace(place)}
                      type="button"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      aria-label={`Remover ${place.title}`}
                      className="rounded-lg p-2 text-ink/42 transition hover:bg-hibiscus-soft hover:text-hibiscus"
                      onClick={() => onDeletePlace(place)}
                      type="button"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </section>
        <div className="rounded-xl border border-dashed border-ink/13 bg-white/50 px-3.5 py-3 text-xs leading-5 text-ink/52">
          <LockKeyhole className="mr-1.5 inline h-3.5 w-3.5 text-hibiscus" />
          Fotos e lugares são privados para o casal. Para mostrar o nome e o
          endereço, as coordenadas atuais são consultadas por geocodificação
          reversa; o app não guarda histórico de trajetos. Pausar a localização
          remove a posição atual, mas não apaga lugares guardados.
        </div>
        {isPreview && (
          <p className="px-1 text-xs leading-5 text-ink/45">
            Na prévia, fotos e lugares ficam apenas nesta sessão.
          </p>
        )}
      </div>
    </section>
  );
}

function LocationTab({
  busy,
  addressBusy,
  coupleMembers,
  currentUserId,
  editingPlaceId,
  favoritePlaces,
  isPreview,
  locations,
  onAvatarUpload,
  onCancelEdit,
  onDeletePlace,
  onEditPlace,
  onOpenProximity,
  onRefresh,
  onPlaceCategoryChange,
  onPlaceFilterChange,
  onSavePlace,
  onStart,
  onStop,
  onFindAddress,
  onUseCurrentPosition,
  placeCategory,
  placeCoordinates,
  placeFilter,
  placeAddress,
  placeMeaning,
  placeTitle,
  savingAvatar,
  savingPlace,
  setPlaceAddress,
  setPlaceMeaning,
  setPlaceTitle,
}: Omit<Parameters<typeof LocationPanelEnhanced>[0], "onClose"> & {
  onOpenProximity: () => void;
  onRefresh: () => void;
}) {
  const [, setLocationStatusTick] = useState(0);
  const [placeDetails, setPlaceDetails] = useState<
    Record<string, ReverseGeocodedPlace | null>
  >({});
  useEffect(() => {
    const interval = window.setInterval(() => {
      setLocationStatusTick(Date.now());
    }, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const mine = locations.find(location => location.user_id === currentUserId);
  const partnerLocation = locations.find(
    location => location.user_id !== currentUserId
  );
  const partner = partnerLocation?.sharing_enabled ? partnerLocation : undefined;
  const me = coupleMembers.find(member => member.user_id === currentUserId);
  const partnerMember = coupleMembers.find(
    member => member.user_id !== currentUserId
  );
  const partnerName = partnerMember?.name ?? "seu par";
  const mineStatus = mine?.sharing_enabled
    ? getLocationStatus(mine.updated_at)
    : null;
  const partnerStatus = partner ? getLocationStatus(partner.updated_at) : null;
  const mineAccuracy = mine?.sharing_enabled
    ? formatLocationAccuracy(mine.accuracy_meters)
    : null;
  const partnerAccuracy = partner
    ? formatLocationAccuracy(partner.accuracy_meters)
    : null;
  const partnerDistance =
    mine?.sharing_enabled &&
    partner &&
    partner.latitude !== null &&
    partner.longitude !== null &&
    mine.latitude !== null &&
    mine.longitude !== null
      ? formatLocationDistance(
          distanceInMeters(
            mine.latitude,
            mine.longitude,
            partner.latitude,
            partner.longitude
          )
        )
      : null;
  const partnerMap = partner ? locationMapUrl(partner) : undefined;
  const placeKey = (location: CoupleLocation) =>
    `${location.user_id}:${location.latitude}:${location.longitude}`;
  const minePlace = mine ? placeDetails[placeKey(mine)] : null;
  const partnerPlace = partner ? placeDetails[placeKey(partner)] : null;
  const mineSavedPlace = findSavedPlaceForLocation(mine, favoritePlaces);
  const partnerSavedPlace = findSavedPlaceForLocation(partner, favoritePlaces);
  useEffect(() => {
    const controller = new AbortController();
    const targets = [mine, partner].filter(
      (location): location is CoupleLocation =>
        Boolean(
          location?.sharing_enabled &&
            location.latitude !== null &&
            location.longitude !== null
        )
    );
    void Promise.all(
      targets.map(async location => {
        const key = placeKey(location);
        const place = await reverseGeocode(
          location.latitude as number,
          location.longitude as number,
          controller.signal
        );
        if (!controller.signal.aborted) {
          setPlaceDetails(current => ({ ...current, [key]: place }));
        }
      })
    );
    return () => controller.abort();
  }, [
    mine?.latitude,
    mine?.longitude,
    mine?.sharing_enabled,
    partner?.latitude,
    partner?.longitude,
    partner?.sharing_enabled,
  ]);
  const visiblePlaces =
    placeFilter === "todos"
      ? favoritePlaces
      : favoritePlaces.filter(place => place.category === placeFilter);
  const editing = editingPlaceId !== null;
  const sharedLocations = locations.filter(
    location =>
      location.sharing_enabled &&
      location.latitude !== null &&
      location.longitude !== null
  );
  const latestLocation = sharedLocations.reduce<CoupleLocation | null>(
    (latest, location) =>
      !latest || location.updated_at > latest.updated_at ? location : latest,
    null
  );

  return (
    <div className="space-y-6" data-testid="location-tab">
      <section className="paper-note overflow-hidden rounded-[1.65rem] border border-ink/8 bg-white shadow-[0_12px_28px_rgba(103,65,72,0.05)]">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-7">
          <div className="max-w-2xl">
            <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.16em] text-hibiscus">
              compartilhamento ao vivo
            </p>
            <h2 className="mt-2 font-display text-4xl tracking-[-0.055em] text-ink">
              Perto, sem adivinhar.
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink/55">
              Compartilhe sua localização com seu par quando quiser. Você decide
              quando começa, vê quando foi atualizada e pode pausar em um toque.
            </p>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:min-w-[230px]">
            <Button
              className={`h-10 w-full rounded-xl px-4 text-xs font-extrabold ${mine?.sharing_enabled ? "border border-plum/16 bg-plum text-white hover:bg-plum/90" : "bg-hibiscus text-white hover:bg-hibiscus/90"}`}
              disabled={busy}
              onClick={mine?.sharing_enabled ? onStop : onStart}
              type="button"
              variant={mine?.sharing_enabled ? "outline" : "default"}
            >
              {mine?.sharing_enabled ? (
                <>
                  <Pause className="mr-1.5 h-3.5 w-3.5" />
                  {busy ? "pausando..." : "pausar compartilhamento"}
                </>
              ) : (
                <>
                  <Play className="mr-1.5 h-3.5 w-3.5" />
                  {busy ? "ativando..." : "compartilhar localização"}
                </>
              )}
            </Button>
            {mine?.sharing_enabled && (
              <Button
                className="h-9 w-full rounded-xl border border-ink/10 bg-white text-xs font-extrabold text-ink/65 hover:border-hibiscus/30 hover:bg-hibiscus-soft hover:text-hibiscus"
                disabled={busy}
                onClick={onRefresh}
                type="button"
                variant="outline"
              >
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
                {busy ? "atualizando..." : "atualizar agora"}
              </Button>
            )}
          </div>
        </div>
      </section>

      <section
        aria-label="Resumo do círculo"
        className="rounded-[1.45rem] border border-ink/8 bg-white p-5 shadow-[0_10px_24px_rgba(103,65,72,0.04)] sm:p-6"
        data-testid="location-circle-summary"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-[0.63rem] font-extrabold uppercase tracking-[0.15em] text-hibiscus">
              <Users className="h-3.5 w-3.5" /> círculo privado
            </p>
            <h3 className="mt-1 font-display text-2xl tracking-[-0.04em] text-ink">
              O círculo de vocês
            </h3>
            <p className="mt-1 text-xs leading-5 text-ink/52">
              Veja quem está visível agora, sem transformar o cuidado em vigilância.
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-hibiscus-soft px-3 py-1.5 text-[0.68rem] font-extrabold text-hibiscus">
            <ShieldCheck className="h-3.5 w-3.5" />
            {sharedLocations.length === coupleMembers.length && coupleMembers.length > 0
              ? "todos visíveis"
              : `${sharedLocations.length}/${coupleMembers.length || 2} visível`}
          </span>
        </div>
        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {coupleMembers.map(member => {
            const memberLocation = locations.find(
              location => location.user_id === member.user_id
            );
            const visible = Boolean(memberLocation?.sharing_enabled);
            const savedPlace = findSavedPlaceForLocation(memberLocation, favoritePlaces);
            return (
              <div
                className="flex min-w-[9.5rem] items-center gap-2 rounded-2xl border border-ink/8 bg-paper px-3 py-2.5"
                key={member.user_id}
              >
                <span className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-plum text-xs font-extrabold text-white">
                  {member.avatar_url ? (
                    <img alt={`Foto de ${member.name ?? "membro"}`} className="h-full w-full object-cover" src={member.avatar_url} />
                  ) : (
                    (member.name ?? "?").slice(0, 1).toUpperCase()
                  )}
                  <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-paper ${visible ? "bg-emerald-500" : "bg-ink/25"}`} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-extrabold text-ink">
                    {member.user_id === currentUserId ? "Você" : member.name ?? "Seu par"}
                  </span>
                  <span className="block text-[0.65rem] text-ink/48">
                    {savedPlace
                      ? `está em ${savedPlace.title}`
                      : visible
                        ? "compartilhando"
                        : "pausado"}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-paper px-3 py-2.5">
            <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.12em] text-ink/42">visíveis</p>
            <p className="mt-1 text-sm font-extrabold text-ink">{sharedLocations.length}/{coupleMembers.length || 2}</p>
          </div>
          <div className="rounded-xl bg-paper px-3 py-2.5">
            <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.12em] text-ink/42">último sinal</p>
            <p className="mt-1 flex items-center gap-1 text-sm font-extrabold text-ink">
              <Clock3 className="h-3 w-3 text-hibiscus" />
              {latestLocation ? formatTime(latestLocation.updated_at) : "aguardando"}
            </p>
          </div>
          <div className="rounded-xl bg-paper px-3 py-2.5">
            <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.12em] text-ink/42">lugares</p>
            <p className="mt-1 text-sm font-extrabold text-ink">{favoritePlaces.length}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="paper-note overflow-hidden rounded-[1.45rem] border border-ink/8 bg-white p-3 shadow-[0_10px_24px_rgba(103,65,72,0.04)] sm:p-4">
          <div className="relative">
            <CoupleMap
              coupleMembers={coupleMembers}
              currentUserId={currentUserId}
              favoritePlaces={visiblePlaces}
              locations={locations}
              mapClassName="!h-[58vh] min-h-[360px] sm:!h-[360px] sm:min-h-0"
            />
            <div
              className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-center justify-between sm:hidden"
              data-testid="location-mobile-controls"
            >
              <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/85 bg-white/92 px-4 py-2.5 text-sm font-extrabold text-plum shadow-[0_8px_22px_rgba(55,35,42,0.16)] backdrop-blur-xl">
                <Users className="h-4 w-4 text-hibiscus" />
                círculo a dois
                <ChevronRight className="h-4 w-4 rotate-90 text-ink/45" />
              </div>
              <Button
                aria-label="Atualizar localização"
                className="pointer-events-auto h-11 w-11 rounded-full border border-white/85 bg-white/92 p-0 text-plum shadow-[0_8px_22px_rgba(55,35,42,0.16)] hover:bg-white"
                disabled={busy || !mine?.sharing_enabled}
                onClick={onRefresh}
                type="button"
                variant="outline"
              >
                <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
              </Button>
            </div>
            <div className="absolute inset-x-3 bottom-3 z-10 flex gap-2 sm:hidden">
              <Button
                className={`h-11 flex-1 rounded-full border border-white/85 text-xs font-extrabold shadow-[0_8px_22px_rgba(55,35,42,0.16)] ${mine?.sharing_enabled ? "bg-plum text-white hover:bg-plum/90" : "bg-white/92 text-plum hover:bg-white"}`}
                disabled={busy}
                onClick={mine?.sharing_enabled ? onStop : onStart}
                type="button"
                variant="outline"
              >
                {mine?.sharing_enabled ? <Pause className="mr-1.5 h-3.5 w-3.5" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
                {mine?.sharing_enabled ? "pausar" : "check-in"}
              </Button>
              <Button
                className="h-11 flex-1 rounded-full border border-white/85 bg-white/92 text-xs font-extrabold text-plum shadow-[0_8px_22px_rgba(55,35,42,0.16)] hover:bg-white"
                onClick={onOpenProximity}
                type="button"
                variant="outline"
              >
                <MapPin className="mr-1.5 h-3.5 w-3.5 text-hibiscus" />
                lugares
              </Button>
            </div>
          </div>
        </div>
        <aside className="space-y-3">
          <section
            className={`rounded-[1.35rem] p-5 ${mine?.sharing_enabled ? "bg-plum text-white" : "border border-ink/8 bg-white text-ink"}`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full ${mine?.sharing_enabled ? "bg-white/15" : "bg-hibiscus-soft text-hibiscus"}`}
              >
                {me?.avatar_url ? (
                  <img
                    alt="Sua foto de perfil"
                    className="h-full w-full object-cover"
                    src={me.avatar_url}
                  />
                ) : (
                  <Navigation className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-extrabold">Seu compartilhamento</p>
                  {mine?.sharing_enabled && (
                    <LocationStatusBadge location={mine} inverse />
                  )}
                </div>
                <p
                  aria-live="polite"
                  className={`mt-1 text-xs leading-5 ${mine?.sharing_enabled ? "text-white/70" : "text-ink/52"}`}
                >
                  {mine?.sharing_enabled
                    ? `${mineStatus?.detail ?? `atualizado às ${formatTime(mine.updated_at)}`}${mineAccuracy ? ` · precisão ${mineAccuracy}` : ""}`
                    : "Pausado. Nenhuma coordenada fica guardada."}
                </p>
                {mineSavedPlace && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl bg-white/10 px-3 py-2.5">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white" />
                    <div className="min-w-0">
                      <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.12em] text-white/60">
                        você está em
                      </p>
                      <p className="truncate text-xs font-extrabold text-white">
                        {mineSavedPlace.title}
                      </p>
                      {mineSavedPlace.address && (
                        <p className="mt-0.5 truncate text-[0.68rem] leading-4 text-white/70">
                          {mineSavedPlace.address}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {mine?.sharing_enabled && (
                  <div className="mt-3 flex items-start gap-2 border-t border-white/12 pt-3">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/70" />
                    <div className="min-w-0">
                      <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.12em] text-white/55">
                        endereço detectado pelo GPS
                      </p>
                      <p className="truncate text-xs font-extrabold text-white">
                        {minePlace?.name ?? "Identificando o lugar..."}
                      </p>
                      <p className="mt-0.5 text-[0.68rem] leading-4 text-white/65">
                        {minePlace?.address ?? "Buscando o endereço desta posição."}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
          <section className="rounded-[1.35rem] border border-ink/8 bg-white p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-hibiscus-soft text-hibiscus">
                {partnerMember?.avatar_url ? (
                  <img
                    alt={`Foto de ${partnerName}`}
                    className="h-full w-full object-cover"
                    src={partnerMember.avatar_url}
                  />
                ) : (
                  <MapPin className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-extrabold text-ink">
                    Localização de {partnerName}
                  </p>
                  {partner && <LocationStatusBadge location={partner} />}
                </div>
                <p aria-live="polite" className="mt-1 text-xs leading-5 text-ink/52">
                  {partner
                    ? `${partnerStatus?.detail ?? `atualizada às ${formatTime(partner.updated_at)}`}${partnerAccuracy ? ` · precisão ${partnerAccuracy}` : ""}`
                    : partnerLocation
                      ? `${partnerName} pausou o compartilhamento e a posição foi apagada.`
                      : `${partnerName} ainda não permitiu o compartilhamento.`}
                </p>
                {partnerSavedPlace && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-hibiscus/15 bg-hibiscus-soft px-3 py-2.5">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-hibiscus" />
                    <div className="min-w-0">
                      <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.12em] text-hibiscus">
                        {partnerName} está em
                      </p>
                      <p className="truncate text-xs font-extrabold text-ink">
                        {partnerSavedPlace.title}
                      </p>
                      {partnerSavedPlace.address && (
                        <p className="mt-0.5 truncate text-[0.68rem] leading-4 text-ink/60">
                          {partnerSavedPlace.address}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {partnerPlace && (
                  <div className="mt-3 flex items-start gap-2 border-t border-ink/8 pt-3">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-hibiscus" />
                    <div className="min-w-0">
                      <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.12em] text-hibiscus/70">
                        endereço detectado pelo GPS
                      </p>
                      <p className="truncate text-xs font-extrabold text-ink">
                        {partnerPlace.name}
                      </p>
                      <p className="mt-0.5 text-[0.68rem] leading-4 text-ink/55">
                        {partnerPlace.address}
                      </p>
                    </div>
                  </div>
                )}
                {partnerDistance && (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-[0.68rem] font-extrabold text-ink/58">
                    <Navigation className="h-3 w-3 text-hibiscus" />
                    {partnerDistance}
                  </p>
                )}
                {partnerStatus?.freshness === "stale" && (
                  <p className="mt-2 text-[0.68rem] font-bold leading-5 text-orange-700">
                    A posição pode não refletir o local atual. Peça para {partnerName} abrir o app.
                  </p>
                )}
              </div>
            </div>
            {partnerMap && (
              <a
                className="mt-3 flex h-9 w-full items-center justify-center rounded-xl border border-hibiscus/20 bg-hibiscus-soft text-xs font-extrabold text-hibiscus transition hover:bg-hibiscus hover:text-white"
                href={partnerMap}
                rel="noreferrer"
                target="_blank"
              >
                <ArrowUpRight className="mr-1.5 h-3.5 w-3.5" />
                abrir localização compartilhada
              </a>
            )}
            <Button
              className="mt-4 h-9 w-full rounded-xl border border-hibiscus/20 bg-hibiscus-soft text-xs font-extrabold text-hibiscus hover:bg-hibiscus hover:text-white"
              onClick={onOpenProximity}
              type="button"
              variant="outline"
            >
              <Compass className="mr-1.5 h-3.5 w-3.5" />
              lembretes por proximidade
            </Button>
          </section>
          <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-ink/16 bg-paper px-4 text-xs font-extrabold text-ink/58 transition hover:border-hibiscus/40 hover:text-hibiscus">
            <input
              accept={ACCEPTED_PHOTO_TYPES.join(",")}
              className="sr-only"
              disabled={savingAvatar}
              onChange={event =>
                onAvatarUpload(event.target.files?.[0] ?? null)
              }
              type="file"
            />
            <Camera className="h-3.5 w-3.5" />
            {savingAvatar
              ? "enviando foto..."
              : me?.avatar_url
                ? "alterar foto no mapa"
                : "adicionar foto ao mapa"}
          </label>
        </aside>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <section className="rounded-[1.4rem] border border-ink/8 bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[0.63rem] font-extrabold uppercase tracking-[0.15em] text-hibiscus">
                {editing ? "editar lugar" : "novo lugar"}
              </p>
              <h3 className="mt-1 font-display text-2xl tracking-[-0.04em] text-ink">
                Guardar um capítulo
              </h3>
            </div>
            {editing && (
              <button
                className="text-xs font-extrabold text-ink/48 transition hover:text-hibiscus"
                onClick={onCancelEdit}
                type="button"
              >
                cancelar
              </button>
            )}
          </div>
          <label className="mt-4 block">
            <span className="sr-only">Nome do lugar</span>
            <Input
              className="h-10 rounded-xl border-ink/10 bg-paper text-sm focus-visible:ring-hibiscus"
              onChange={event => setPlaceTitle(event.target.value)}
              placeholder="Nome do lugar"
              value={placeTitle}
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PLACE_CATEGORIES.map(category => (
              <button
                aria-pressed={placeCategory === category.id}
                className={`rounded-full px-3 py-1.5 text-xs font-extrabold transition ${placeCategory === category.id ? "bg-plum text-white" : `${category.tone} hover:brightness-95`}`}
                key={category.id}
                onClick={() => onPlaceCategoryChange(category.id)}
                type="button"
              >
                {category.marker} {category.label}
              </button>
            ))}
          </div>
          <label className="mt-2 block">
            <span className="sr-only">Endereço do lugar</span>
            <div className="flex gap-2">
              <Input
                className="h-10 flex-1 rounded-xl border-ink/10 bg-paper text-sm focus-visible:ring-hibiscus"
                onChange={event => {
                setPlaceAddress(event.target.value);
              }}
                placeholder="Ex.: Rodovia Presidente Dutra, 2550"
                value={placeAddress}
              />
              <Button
                className="h-10 rounded-xl border border-hibiscus/22 bg-hibiscus-soft px-3 text-xs font-extrabold text-hibiscus hover:bg-hibiscus hover:text-white"
                disabled={addressBusy || !placeAddress.trim()}
                onClick={onFindAddress}
                type="button"
                variant="outline"
              >
                {addressBusy ? "buscando..." : "buscar"}
              </Button>
            </div>
          </label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button className="rounded-full bg-plum/10 px-3 py-1.5 text-xs font-extrabold text-plum" onClick={() => setPlaceTitle("Casa")} type="button">Casa</button>
            <button className="rounded-full bg-hibiscus-soft px-3 py-1.5 text-xs font-extrabold text-hibiscus" onClick={() => setPlaceTitle("Trabalho")} type="button">Trabalho</button>
          </div>
          <label className="mt-2 block">
            <span className="sr-only">Significado do lugar</span>
            <Textarea
              className="min-h-[82px] resize-none rounded-xl border-ink/10 bg-paper text-sm focus-visible:ring-hibiscus"
              onChange={event => setPlaceMeaning(event.target.value)}
              placeholder="Por que esse lugar é especial? (opcional)"
              value={placeMeaning}
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              className="h-9 rounded-xl border border-ink/11 bg-paper text-xs font-extrabold text-ink/60 hover:border-hibiscus/35 hover:text-hibiscus"
              onClick={onUseCurrentPosition}
              type="button"
              variant="outline"
            >
              <Navigation className="mr-1.5 h-3.5 w-3.5" />
              usar minha posição
            </Button>
            <Button
              className="h-9 rounded-xl bg-hibiscus px-4 text-xs font-extrabold text-white hover:bg-hibiscus/90"
              disabled={savingPlace || !placeTitle.trim() || !placeCoordinates}
              onClick={onSavePlace}
              type="button"
            >
              {savingPlace
                ? "guardando..."
                : editing
                  ? "salvar ajustes"
                  : "guardar lugar"}
            </Button>
          </div>
          <p
            className={`mt-3 text-xs ${placeCoordinates ? "text-sage" : "text-ink/45"}`}
          >
            {placeCoordinates
              ? "Posição selecionada para este lugar."
              : "Use sua posição atual quando quiser registrar este lugar."}
          </p>
        </section>

        <section className="rounded-[1.4rem] border border-ink/8 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[0.63rem] font-extrabold uppercase tracking-[0.15em] text-hibiscus">
                memória do mapa
              </p>
              <h3 className="mt-1 font-display text-2xl tracking-[-0.04em] text-ink">
                Lugares de vocês
              </h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                aria-pressed={placeFilter === "todos"}
                className={`rounded-full px-2.5 py-1 text-[0.66rem] font-extrabold ${placeFilter === "todos" ? "bg-ink text-white" : "bg-paper text-ink/50"}`}
                onClick={() => onPlaceFilterChange("todos")}
                type="button"
              >
                todos
              </button>
              {PLACE_CATEGORIES.map(category => (
                <button
                  aria-pressed={placeFilter === category.id}
                  className={`rounded-full px-2.5 py-1 text-[0.66rem] font-extrabold ${placeFilter === category.id ? "bg-hibiscus text-white" : "bg-paper text-ink/50"}`}
                  key={category.id}
                  onClick={() => onPlaceFilterChange(category.id)}
                  type="button"
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {visiblePlaces.length === 0 ? (
              <p className="rounded-xl bg-paper px-4 py-5 text-sm leading-6 text-ink/52">
                Ainda não há lugares nesta seleção. Quando quiserem, guardem o
                primeiro capítulo no mapa.
              </p>
            ) : (
              visiblePlaces.map(place => {
                const category = categoryDetails(place.category);
                return (
                  <article
                    className="flex items-start gap-3 rounded-xl bg-paper/75 px-4 py-3"
                    key={place.id}
                  >
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${category.tone}`}
                    >
                      {category.marker}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-extrabold text-ink">
                        {place.title}
                      </p>
                      {place.address && (
                        <p className="mt-0.5 flex items-start gap-1 text-xs font-semibold leading-5 text-ink/60">
                          <MapPin className="mt-1 h-3 w-3 shrink-0 text-hibiscus" />
                          <span>{place.address}</span>
                        </p>
                      )}
                      {place.meaning && (
                        <p className="mt-0.5 text-xs leading-5 text-ink/54">
                          {place.meaning}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        aria-label={`Editar ${place.title}`}
                        className="rounded-lg p-2 text-ink/42 transition hover:bg-hibiscus-soft hover:text-hibiscus"
                        onClick={() => onEditPlace(place)}
                        type="button"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        aria-label={`Remover ${place.title}`}
                        className="rounded-lg p-2 text-ink/42 transition hover:bg-hibiscus-soft hover:text-hibiscus"
                        onClick={() => onDeletePlace(place)}
                        type="button"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </section>
      {isPreview && (
        <p className="px-1 text-xs leading-5 text-ink/45">
          Na prévia, fotos, posições e lugares permanecem somente neste
          dispositivo.
        </p>
      )}
    </div>
  );
}

function FloatingProximity({
  currentUserId,
  favoritePlaces,
  isOpen,
  onSavePreference,
  onToggle,
  preferences,
  savingPlaceId,
}: {
  currentUserId: string;
  favoritePlaces: FavoritePlace[];
  isOpen: boolean;
  onSavePreference: (
    place: FavoritePlace,
    change: Partial<
      Pick<
        PlaceProximityPreference,
        "is_enabled" | "radius_meters" | "custom_message"
      >
    >
  ) => void;
  onToggle: () => void;
  preferences: PlaceProximityPreference[];
  savingPlaceId: string | null;
}) {
  return (
    <div className="fixed right-[10rem] top-4 z-[55] sm:right-[10.75rem] lg:right-[13.15rem]">
      <button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label="Abrir lembretes de proximidade"
        className="relative grid h-10 w-10 place-items-center rounded-xl border border-ink/8 bg-white text-hibiscus shadow-sm transition hover:border-hibiscus/35 hover:bg-hibiscus-soft"
        onClick={onToggle}
        type="button"
      >
        <Compass className="h-4 w-4" />
        {preferences.some(preference => preference.is_enabled) && (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-sage ring-2 ring-paper" />
        )}
      </button>
      {isOpen && (
        <section
          aria-label="Lembretes de proximidade"
          aria-modal="true"
          className="paper-note fixed inset-x-3 bottom-3 top-[4.8rem] z-[60] mx-auto max-w-xl overflow-hidden rounded-[1.5rem] border border-ink/10 bg-paper shadow-[0_24px_70px_rgba(55,35,42,0.22)] sm:left-auto sm:right-8 sm:mx-0 sm:w-[min(540px,calc(100vw-4rem))]"
          role="dialog"
        >
          <div className="flex items-start justify-between border-b border-ink/8 bg-white/75 px-5 py-4">
            <div>
              <p className="text-[0.63rem] font-extrabold uppercase tracking-[0.17em] text-hibiscus">
                por perto
              </p>
              <h2 className="mt-1 font-display text-2xl tracking-[-0.05em] text-ink">
                Lembretes para o caminho
              </h2>
            </div>
            <button
              aria-label="Fechar lembretes de proximidade"
              className="rounded-lg p-2 text-ink/48 transition hover:bg-hibiscus-soft hover:text-hibiscus"
              onClick={onToggle}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[calc(100vh-8.5rem)] space-y-3 overflow-y-auto p-4 sm:p-5">
            <p className="rounded-xl border border-hibiscus/14 bg-hibiscus-soft/45 px-3.5 py-3 text-sm leading-5 text-ink/62">
              Ativem um raio para receber um bilhete quando estiverem perto de
              um lugar especial. No navegador, o aviso depende da localização
              autorizada; o app móvel usará estas mesmas escolhas em segundo
              plano.
            </p>
            {favoritePlaces.length === 0 ? (
              <p className="rounded-xl border border-dashed border-ink/13 bg-white/55 px-4 py-5 text-sm leading-6 text-ink/52">
                Guardem primeiro um lugar no mapa afetivo para criar um lembrete
                de proximidade.
              </p>
            ) : (
              favoritePlaces.map(place => {
                const preference = preferences.find(
                  item => item.place_id === place.id
                );
                const enabled = preference?.is_enabled ?? false;
                const category = categoryDetails(place.category);
                return (
                  <article
                    className={`rounded-[1.15rem] border p-4 transition ${enabled ? "border-hibiscus/24 bg-white shadow-sm" : "border-ink/8 bg-white/65"}`}
                    key={place.id}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${category.tone}`}
                      >
                        {category.marker}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-extrabold text-ink">
                          {place.title}
                        </p>
                        <p className="mt-0.5 text-xs text-ink/48">
                          {category.label}
                          {place.meaning ? ` · ${place.meaning}` : ""}
                        </p>
                      </div>
                      <button
                        aria-pressed={enabled}
                        className={`rounded-full px-3 py-1.5 text-xs font-extrabold transition ${enabled ? "bg-hibiscus text-white" : "border border-ink/12 bg-paper text-ink/55 hover:border-hibiscus/35 hover:text-hibiscus"}`}
                        disabled={savingPlaceId === place.id}
                        onClick={() =>
                          onSavePreference(place, { is_enabled: !enabled })
                        }
                        type="button"
                      >
                        {savingPlaceId === place.id
                          ? "salvando"
                          : enabled
                            ? "ativo"
                            : "ativar"}
                      </button>
                    </div>
                    {enabled && (
                      <div className="mt-3 grid gap-2 border-t border-ink/7 pt-3 sm:grid-cols-[136px_1fr]">
                        <label>
                          <span className="mb-1 block text-[0.6rem] font-extrabold uppercase tracking-[0.13em] text-ink/42">
                            raio de aviso
                          </span>
                          <select
                            className="h-9 w-full rounded-xl border border-ink/10 bg-paper px-2 text-sm font-bold text-ink outline-none focus:border-hibiscus"
                            onChange={event =>
                              onSavePreference(place, {
                                radius_meters: Number(event.target.value),
                              })
                            }
                            value={preference?.radius_meters ?? 150}
                          >
                            <option value={75}>75 metros</option>
                            <option value={150}>150 metros</option>
                            <option value={300}>300 metros</option>
                            <option value={500}>500 metros</option>
                          </select>
                        </label>
                        <label>
                          <span className="mb-1 block text-[0.6rem] font-extrabold uppercase tracking-[0.13em] text-ink/42">
                            bilhete (opcional)
                          </span>
                          <Input
                            className="h-9 rounded-xl border-ink/10 bg-paper text-sm focus-visible:ring-hibiscus"
                            defaultValue={preference?.custom_message ?? ""}
                            onBlur={event => {
                              const value = event.target.value.trim() || null;
                              if (
                                value !== (preference?.custom_message ?? null)
                              )
                                onSavePreference(place, {
                                  custom_message: value,
                                });
                            }}
                            placeholder="Ex.: lembra do nosso primeiro beijo?"
                          />
                        </label>
                      </div>
                    )}
                  </article>
                );
              })
            )}
            <div className="rounded-xl border border-dashed border-ink/13 bg-white/50 px-3.5 py-3 text-xs leading-5 text-ink/52">
              <LockKeyhole className="mr-1.5 inline h-3.5 w-3.5 text-hibiscus" />
              O app não registra seus trajetos. Cada lembrete tem intervalo de
              seis horas para não interromper o dia de vocês.
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export type SignupDestination = "workspace" | "email-confirmation";

export function getSignupDestination(
  session: Session | null
): SignupDestination {
  return session ? "workspace" : "email-confirmation";
}

export function EmailConfirmationView({
  email,
  onBack,
}: {
  email: string;
  onBack: () => void;
}) {
  return (
    <main className="relative grid min-h-screen overflow-x-hidden place-items-center bg-paper px-5 py-8">
      <div className="paper-grain pointer-events-none absolute inset-0 opacity-40" />
      <section className="paper-note relative z-10 w-full max-w-md rounded-[2rem] border border-hibiscus/14 bg-white/85 p-7 text-center shadow-[0_20px_55px_rgba(103,65,72,0.1)] sm:p-9">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-hibiscus-soft text-hibiscus">
          <CheckCircle2 className="h-7 w-7" />
        </span>
        <p className="mt-7 text-[0.65rem] font-extrabold uppercase tracking-[0.18em] text-hibiscus">
          conta criada
        </p>
        <h1 className="mt-3 font-display text-4xl leading-[0.92] tracking-[-0.06em] text-ink">
          O primeiro capítulo já começou.
        </h1>
        <p className="mt-5 text-sm leading-6 text-ink/58">
          Enviamos um link de confirmação para{" "}
          <strong className="font-extrabold text-ink">{email}</strong>. Abra
          esse e-mail e volte por ele para entrar diretamente no início do
          caderno.
        </p>
        <p className="mt-4 rounded-xl bg-paper px-4 py-3 text-xs leading-5 text-ink/48">
          Assim que a confirmação for concluída, seu espaço privado ficará
          pronto para receber as memórias de vocês.
        </p>
        <Button
          className="mt-7 h-11 w-full rounded-xl border border-hibiscus/22 bg-hibiscus-soft text-sm font-extrabold text-hibiscus hover:bg-hibiscus hover:text-white"
          onClick={onBack}
          type="button"
          variant="outline"
        >
          Usar outro e-mail
        </Button>
      </section>
    </main>
  );
}

export function LoginView({
  onPreview,
  onAuth,
}: {
  onPreview: () => void;
  onAuth: (
    mode: "login" | "signup",
    email: string,
    password: string,
    name: string
  ) => Promise<void>;
}) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    await onAuth(mode, email, password, name);
    setPending(false);
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-paper px-5 py-5 sm:px-8 lg:grid lg:grid-cols-[minmax(0,0.92fr)_minmax(500px,1.08fr)] lg:gap-8 lg:p-7">
      <div className="paper-grain pointer-events-none absolute inset-0 opacity-40" />
      <section className="relative z-10 flex min-h-[calc(100vh-2.5rem)] flex-col justify-between lg:min-h-0 lg:px-[clamp(1rem,5vw,7rem)] lg:py-[clamp(1.2rem,5vh,4rem)]">
        <Brand />
        <div className="my-12 max-w-md lg:my-0">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-hibiscus/15 bg-white/75 px-3 py-1.5 text-[0.68rem] font-extrabold uppercase tracking-[0.16em] text-hibiscus shadow-sm">
            <LockKeyhole className="h-3.5 w-3.5" />
            um lugar privado
          </div>
          <h1 className="max-w-sm font-display text-[clamp(3rem,6vw,5.4rem)] leading-[0.87] tracking-[-0.065em] text-ink">
            Um espaço feito para <em className="text-hibiscus">vocês.</em>
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-ink/58">
            Guardem conversas, planos e pequenos momentos em uma memória que só
            dois podem abrir.
          </p>
          <form
            aria-describedby="access-form-hint"
            className="mt-8 space-y-3"
            onSubmit={submit}
          >
            {mode === "signup" && (
              <label className="block">
                <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.12em] text-ink/52">
                  Seu nome
                </span>
                <Input
                  autoComplete="name"
                  className="h-12 rounded-xl border-ink/10 bg-white/85 px-4 shadow-sm focus-visible:ring-hibiscus"
                  name="name"
                  onChange={event => setName(event.target.value)}
                  placeholder="Como você quer aparecer?"
                  value={name}
                />
              </label>
            )}
            <label className="block">
              <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.12em] text-ink/52">
                E-mail
              </span>
              <Input
                autoComplete="email"
                className="h-12 rounded-xl border-ink/10 bg-white/85 px-4 shadow-sm focus-visible:ring-hibiscus"
                name="email"
                onChange={event => setEmail(event.target.value)}
                placeholder="nome@exemplo.com"
                type="email"
                value={email}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.12em] text-ink/52">
                Senha
              </span>
              <Input
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                className="h-12 rounded-xl border-ink/10 bg-white/85 px-4 shadow-sm focus-visible:ring-hibiscus"
                minLength={6}
                name="password"
                onChange={event => setPassword(event.target.value)}
                placeholder="Pelo menos 6 caracteres"
                type="password"
                value={password}
              />
            </label>
            <Button
              className="mt-2 h-12 w-full rounded-xl bg-hibiscus text-sm font-extrabold text-white shadow-[0_12px_26px_rgba(201,87,103,0.25)] hover:bg-hibiscus/90"
              disabled={pending}
              type="submit"
            >
              {pending
                ? "Só um instante..."
                : mode === "login"
                  ? "Entrar no espaço de vocês"
                  : "Criar o nosso espaço"}
              {!pending && <ArrowUpRight className="ml-2 h-4 w-4" />}
            </Button>
          </form>
          <p
            className="mt-3 text-xs font-semibold text-ink/42"
            id="access-form-hint"
          >
            Pressione Enter para confirmar. Após criar sua conta, você será
            levada ao início do caderno.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3 text-sm">
            <button
              className="font-bold text-ink/58 underline decoration-hibiscus/35 underline-offset-4 hover:text-hibiscus"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              type="button"
            >
              {mode === "login"
                ? "Ainda não tenho conta"
                : "Já tenho uma conta"}
            </button>
            <span className="h-4 w-px bg-ink/15" />
            <button
              className="font-bold text-hibiscus hover:text-ink"
              onClick={onPreview}
              type="button"
            >
              Explorar a prévia
            </button>
          </div>
          {!isSupabaseConfigured && (
            <p className="mt-5 rounded-xl border border-dashed border-hibiscus/25 bg-white/60 px-3 py-2 text-xs leading-5 text-ink/50">
              O modo prévia está ativo. Configure as variáveis públicas do
              Supabase para habilitar contas e dados reais.
            </p>
          )}
        </div>
        <p className="text-xs font-semibold text-ink/38">
          Feito para acompanhar o que importa, sem plateia.
        </p>
      </section>
      <section className="relative z-10 hidden overflow-hidden rounded-[2rem] bg-ink shadow-[0_28px_80px_rgba(55,35,42,0.2)] lg:block">
        <img
          alt="Caderno, carta e duas xícaras sobre uma mesa iluminada"
          className="absolute inset-0 h-full w-full object-cover opacity-95"
          src={ASSETS.hero}
        />
        <div className="absolute inset-0 bg-[linear-gradient(125deg,rgba(38,23,29,0.56),rgba(38,23,29,0.02)_60%)]" />
        <div className="absolute left-9 top-9 flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md">
          <Heart className="h-3.5 w-3.5 fill-white text-white" />
          história compartilhada
        </div>
        <div className="absolute bottom-10 left-10 max-w-sm text-white">
          <p className="font-display text-5xl leading-[0.9] tracking-[-0.06em]">
            O próximo capítulo começa com uma mensagem.
          </p>
          <div className="mt-8 flex items-center gap-3 text-sm font-bold text-white/75">
            <span className="h-px w-10 bg-white/60" />
            conversas, planos e memórias
          </div>
        </div>
      </section>
    </main>
  );
}

function Composer({
  value,
  onChange,
  onSubmit,
  busy,
  photoPreview,
  photoName,
  onPhotoChange,
  onClearPhoto,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
  photoPreview?: string;
  photoName?: string;
  onPhotoChange: (file: File | null) => void;
  onClearPhoto: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="paper-memory paper-note relative overflow-hidden rounded-[1.45rem] border border-hibiscus/16 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-plum text-xs font-extrabold text-white">
            V
          </span>
          <div>
            <p className="text-sm font-extrabold text-ink">
              Deixa um pedaço do seu dia aqui.
            </p>
            <p className="text-xs text-ink/45">
              Um bilhete guardado só para vocês.
            </p>
          </div>
        </div>
        <span className="love-seal love-seal--soft soft-heartbeat">
          <Heart className="h-3.5 w-3.5 fill-current" />
        </span>
      </div>
      <p className="memory-marker mb-2">memória de agora</p>
      <Textarea
        className="min-h-[86px] resize-none border-0 bg-transparent px-0 text-[0.95rem] leading-6 shadow-none placeholder:text-ink/35 focus-visible:ring-0"
        onChange={event => onChange(event.target.value)}
        placeholder="O que você quer guardar hoje?"
        value={value}
      />
      {photoPreview && (
        <div className="relative mt-2 overflow-hidden rounded-xl border border-ink/8 bg-paper">
          <img
            alt={photoName ? `Prévia de ${photoName}` : "Prévia da foto"}
            className="max-h-64 w-full object-cover"
            src={photoPreview}
          />
          <button
            aria-label="Remover foto"
            className="absolute right-2 top-2 rounded-full bg-ink/75 p-2 text-white transition hover:bg-hibiscus"
            onClick={onClearPhoto}
            type="button"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between border-t border-ink/7 pt-3">
        <input
          accept={ACCEPTED_PHOTO_TYPES.join(",")}
          className="hidden"
          onChange={event => onPhotoChange(event.target.files?.[0] ?? null)}
          ref={inputRef}
          type="file"
        />
        <button
          className="inline-flex items-center gap-2 text-xs font-extrabold text-ink/48 transition hover:text-hibiscus"
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          <ImagePlus className="h-4 w-4" />
          {photoName ?? "adicionar foto"}
        </button>
        <Button
          className="h-9 rounded-lg bg-hibiscus px-4 text-xs font-extrabold text-white shadow-[0_8px_16px_rgba(201,87,103,0.2)] hover:bg-hibiscus/90"
          disabled={busy || (!value.trim() && !photoPreview)}
          onClick={onSubmit}
          type="button"
        >
          {busy ? "Guardando..." : "Guardar memória"}
          <ChevronRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function MemoryThread() {
  return (
    <div className="chapter-thread relative flex items-center gap-3 px-1 pb-4 pt-1">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-paper bg-hibiscus text-[0.67rem] font-extrabold text-white shadow-[0_4px_12px_rgba(201,87,103,0.22)]">
        HOJE
      </span>
      <div className="min-w-0">
        <p className="memory-marker">um capítulo para guardar</p>
        <p className="mt-1 text-sm font-bold text-ink/58">
          A linha de vocês continua daqui.
        </p>
      </div>
      <span className="relative ml-auto hidden h-px w-20 bg-hibiscus/35 before:absolute before:left-1/2 before:top-1/2 before:h-2 before:w-2 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:bg-hibiscus sm:block" />
    </div>
  );
}

function FeedPanel({
  posts,
  currentUserId,
  value,
  onChange,
  onSubmit,
  busy,
  isPreview,
  photoPreview,
  photoName,
  onPhotoChange,
  onClearPhoto,
  onEditPost,
  onDeletePost,
}: {
  posts: Post[];
  currentUserId: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
  isPreview: boolean;
  photoPreview?: string;
  photoName?: string;
  onPhotoChange: (file: File | null) => void;
  onClearPhoto: () => void;
  onEditPost: (post: Post) => void;
  onDeletePost: (post: Post) => void;
}) {
  return (
    <div className="space-y-6">
      <section className="romance-opening">
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="memory-marker">um lugar que é só de vocês</p>
            <h2 className="mt-3 max-w-md font-display text-[2.25rem] leading-[0.94] tracking-[-0.06em] text-ink sm:text-4xl">
              Tudo que é vivido{" "}
              <span className="love-underline">com carinho</span> merece ficar.
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-6 text-ink/62">
              Um caderno para os dias comuns, as datas importantes e os pequenos
              gestos que fazem vocês dois se sentirem em casa.
            </p>
          </div>
          <span className="love-seal soft-heartbeat shrink-0">
            <Heart className="h-4 w-4 fill-current" />
          </span>
        </div>
        <div className="mt-5 flex items-center gap-2.5 text-xs font-bold text-ink/48">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-hibiscus text-[0.6rem] font-extrabold text-white">
            V
          </span>
          <span className="relative h-px max-w-[10rem] flex-1 bg-hibiscus/45 before:absolute before:left-1/2 before:top-1/2 before:h-2 before:w-2 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:bg-hibiscus" />
          <span className="grid h-7 w-7 place-items-center rounded-full bg-plum text-[0.6rem] font-extrabold text-white">
            +
          </span>
          <span className="ml-1 hidden sm:inline">
            uma história escrita a quatro mãos
          </span>
        </div>
      </section>
      <MemoryThread />
      <Composer
        busy={busy}
        onChange={onChange}
        onClearPhoto={onClearPhoto}
        onPhotoChange={onPhotoChange}
        onSubmit={onSubmit}
        photoName={photoName}
        photoPreview={photoPreview}
        value={value}
      />
      {posts.length === 0 ? (
        <section className="relative overflow-hidden rounded-[1.7rem] bg-ink px-6 py-7 text-white shadow-[0_18px_45px_rgba(55,35,42,0.16)] sm:min-h-[250px] sm:px-8">
          <img
            alt="Envelope, fotografia e selo em tons quentes"
            className="absolute inset-y-0 right-0 hidden h-full w-[45%] object-cover opacity-75 mix-blend-luminosity sm:block"
            src={ASSETS.memory}
          />
          <div className="absolute inset-y-0 right-0 hidden w-[58%] bg-[linear-gradient(90deg,#2b1e26_10%,rgba(43,30,38,0.1))] sm:block" />
          <div className="relative z-10 max-w-sm">
            <span className="mb-6 inline-flex h-9 w-9 items-center justify-center rounded-full bg-hibiscus text-white">
              <Sparkles className="h-4 w-4" />
            </span>
            <h2 className="font-display text-3xl leading-[0.94] tracking-[-0.055em]">
              A primeira página está esperando vocês.
            </h2>
            <p className="mt-4 text-sm leading-6 text-white/68">
              Escrevam uma mensagem, salvem uma foto ou escolham uma data. As
              pequenas coisas formam a história inteira.
            </p>
            {isPreview && (
              <p className="mt-5 text-xs font-bold text-hibiscus-light">
                Esta é uma prévia local: escreva ou adicione uma foto para
                experimentar.
              </p>
            )}
          </div>
        </section>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 px-1 text-xs font-extrabold uppercase tracking-[0.16em] text-ink/40">
            <span className="h-px flex-1 bg-ink/10" />
            memórias recentes
            <span className="h-px flex-1 bg-ink/10" />
          </div>
          {posts.map(post => (
            <article
              className="paper-memory paper-note animate-rise overflow-hidden rounded-[1.35rem] border border-ink/7 bg-white shadow-[0_10px_26px_rgba(103,65,72,0.055)]"
              key={post.id}
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-hibiscus text-xs font-extrabold text-white">
                      {post.author_name.slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <p className="text-sm font-extrabold text-ink">
                        {post.author_name}
                      </p>
                      <p className="text-xs text-ink/45">
                        {formatDate(post.created_at)}
                      </p>
                    </div>
                  </div>
                  {post.author_id === currentUserId && (
                    <div className="flex items-center gap-1">
                      <button
                        aria-label={`Editar memória de ${formatDate(post.created_at)}`}
                        className="rounded-full p-1.5 text-ink/42 transition hover:bg-paper hover:text-hibiscus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hibiscus"
                        onClick={() => onEditPost(post)}
                        type="button"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        aria-label={`Apagar memória de ${formatDate(post.created_at)}`}
                        className="rounded-full p-1.5 text-ink/42 transition hover:bg-hibiscus/10 hover:text-hibiscus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hibiscus"
                        onClick={() => onDeletePost(post)}
                        type="button"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                {post.content && (
                  <p className="mt-4 whitespace-pre-wrap text-[0.96rem] leading-7 text-ink/78">
                    {post.content}
                  </p>
                )}
              </div>
              {post.image_url && (
                <img
                  alt={`Memória compartilhada por ${post.author_name}`}
                  className="max-h-[500px] w-full border-y border-ink/7 object-cover"
                  src={post.image_url}
                />
              )}
              <div className="mx-5 flex items-center gap-4 border-t border-ink/7 py-3 text-xs font-bold text-ink/44">
                <button
                  className="inline-flex items-center gap-1.5 transition hover:text-hibiscus"
                  onClick={() =>
                    toast.success("Ficou guardado como um pequeno carinho.")
                  }
                  type="button"
                >
                  <Heart className="h-3.5 w-3.5" />
                  guardar
                </button>
                <span className="inline-flex items-center gap-1.5">
                  <LockKeyhole className="h-3.5 w-3.5" />
                  privado
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function MomentsPanel({
  posts,
  currentUserId,
  value,
  onChange,
  onSubmit,
  busy,
  photoPreview,
  photoName,
  onPhotoChange,
  onClearPhoto,
  widgetMomentId,
  onChooseWidgetMoment,
  onEditPost,
  onDeletePost,
}: {
  posts: Post[];
  currentUserId: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
  photoPreview?: string;
  photoName?: string;
  onPhotoChange: (file: File | null) => void;
  onClearPhoto: () => void;
  widgetMomentId: string | null;
  onChooseWidgetMoment: (post: Post) => void;
  onEditPost: (post: Post) => void;
  onDeletePost: (post: Post) => void;
}) {
  const photoPosts = posts.filter(post => Boolean(post.image_url));
  return (
    <div className="space-y-6">
      <section className="romance-opening">
        <p className="memory-marker">álbum compartilhado</p>
        <h2 className="mt-3 max-w-xl font-display text-[2.25rem] leading-[0.94] tracking-[-0.06em] text-ink sm:text-4xl">
          Fotos que fazem o tempo <span className="love-underline">parar um pouco.</span>
        </h2>
        <p className="mt-4 max-w-xl text-sm leading-6 text-ink/62">
          Guardem aqui os detalhes que querem rever. Cada foto continua privada
          para quem escreve este caderno com vocês.
        </p>
      </section>
      <Composer
        busy={busy}
        onChange={onChange}
        onClearPhoto={onClearPhoto}
        onPhotoChange={onPhotoChange}
        onSubmit={onSubmit}
        photoName={photoName}
        photoPreview={photoPreview}
        value={value}
      />
      <section className="paper-note rounded-[1.5rem] border border-ink/8 bg-white/70 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="memory-marker">foto em destaque</p>
            <h3 className="mt-1 font-display text-2xl tracking-[-0.04em] text-ink">
              Um atalho para abrir um momento.
            </h3>
            <p className="mt-2 max-w-xl text-xs leading-5 text-ink/52">
              Escolha uma foto para o cartão de Momentos no aplicativo. No
              telefone, instale o site na tela inicial para abrir o álbum com um toque.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-hibiscus/10 px-3 py-2 text-xs font-extrabold text-hibiscus">
            <Camera className="h-3.5 w-3.5" /> somente vocês
          </span>
        </div>
      </section>
      {photoPosts.length === 0 ? (
        <section className="rounded-[1.55rem] border border-dashed border-ink/15 bg-paper/80 px-6 py-12 text-center">
          <ImagePlus className="mx-auto h-7 w-7 text-hibiscus" />
          <h3 className="mt-4 font-display text-2xl text-ink">O álbum começa com uma foto.</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-ink/55">
            Escolham uma imagem de um dia simples ou de uma data importante para abrir esta página.
          </p>
        </section>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {photoPosts.map(post => (
            <article className="group overflow-hidden rounded-[1.35rem] border border-ink/8 bg-white shadow-[0_10px_24px_rgba(55,35,42,0.06)]" key={post.id}>
              <img alt={`Momento compartilhado por ${post.author_name}`} className="aspect-[4/3] w-full object-cover" src={post.image_url} />
              <div className="p-4">
                <p className="line-clamp-2 text-sm leading-6 text-ink/72">{post.content || "Um momento guardado em silêncio."}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-ink/48">
                  <span>{formatDate(post.created_at)}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      aria-pressed={widgetMomentId === post.id}
                      className={`rounded-full px-3 py-1.5 transition ${widgetMomentId === post.id ? "bg-hibiscus text-white" : "bg-paper text-ink/60 hover:bg-hibiscus/12 hover:text-hibiscus"}`}
                      onClick={() => onChooseWidgetMoment(post)}
                      type="button"
                    >
                      {widgetMomentId === post.id ? "em destaque" : "destacar"}
                    </button>
                    {post.author_id === currentUserId && (
                      <>
                        <button aria-label={`Editar momento de ${formatDate(post.created_at)}`} className="rounded-full p-1.5 text-ink/42 hover:bg-paper hover:text-hibiscus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hibiscus" onClick={() => onEditPost(post)} type="button"><Pencil className="h-3.5 w-3.5" /></button>
                        <button aria-label={`Apagar momento de ${formatDate(post.created_at)}`} className="rounded-full p-1.5 text-ink/42 hover:bg-hibiscus/10 hover:text-hibiscus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hibiscus" onClick={() => onDeletePost(post)} type="button"><Trash2 className="h-3.5 w-3.5" /></button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

const libraryStatusCopy: Record<LibraryStatus, string> = {
  want: "queremos",
  reading: "lendo",
  finished: "lido",
  upcoming: "estreia em breve",
  watched: "visto",
};

function LibraryPanel({
  kind,
  items,
  title,
  creator,
  notes,
  releaseOn,
  busy,
  onTitleChange,
  onCreatorChange,
  onNotesChange,
  onReleaseOnChange,
  onAdd,
  onChangeStatus,
  onDelete,
  onEdit,
  currentUserId,
}: {
  kind: LibraryItemType;
  items: CoupleLibraryItem[];
  title: string;
  creator: string;
  notes: string;
  releaseOn: string;
  busy: boolean;
  onTitleChange: (value: string) => void;
  onCreatorChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onReleaseOnChange: (value: string) => void;
  onAdd: () => void;
  onChangeStatus: (item: CoupleLibraryItem, status: LibraryStatus) => void;
  onDelete: (item: CoupleLibraryItem) => void;
  onEdit: (item: CoupleLibraryItem) => void;
  currentUserId: string;
}) {
  const isBook = kind === "book";
  const statuses: LibraryStatus[] = isBook
    ? ["want", "reading", "finished"]
    : ["want", "upcoming", "watched"];
  const icon = isBook ? <BookOpen className="h-5 w-5" /> : <Clapperboard className="h-5 w-5" />;
  const singular = isBook ? "livro" : "filme";
  const creatorLabel = isBook ? "autor(a)" : "direção ou elenco";
  const intro = isBook
    ? "Uma estante pequena para os livros que vocês querem dividir, estão lendo ou já terminaram."
    : "Uma sala de cinema particular para o que querem ver, o que chega em breve e o que já virou lembrança.";
  return (
    <div className="space-y-6">
      <section className="romance-opening">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="memory-marker">{isBook ? "estante compartilhada" : "sessão compartilhada"}</p>
            <h2 className="mt-3 font-display text-[2.25rem] leading-[0.94] tracking-[-0.06em] text-ink sm:text-4xl">
              {isBook ? <>Palavras para <span className="love-underline">passar adiante.</span></> : <>Histórias para <span className="love-underline">ver juntas.</span></>}
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-ink/62">{intro}</p>
          </div>
          <span className="grid h-11 w-11 place-items-center rounded-full bg-hibiscus/10 text-hibiscus">{icon}</span>
        </div>
      </section>
      <section className="paper-memory paper-note rounded-[1.45rem] border border-hibiscus/16 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input aria-label={`Título do ${singular}`} onChange={event => onTitleChange(event.target.value)} placeholder={isBook ? "Título do livro" : "Título do filme"} value={title} />
          <Input aria-label={creatorLabel} onChange={event => onCreatorChange(event.target.value)} placeholder={creatorLabel} value={creator} />
          {!isBook && <BrazilianDateInput aria-label="Data de estreia" onDateChange={onReleaseOnChange} value={releaseOn} />}
          <Input aria-label={`Bilhete sobre este ${singular}`} className={isBook ? "sm:col-span-2" : ""} onChange={event => onNotesChange(event.target.value)} placeholder="Um bilhete curto para a outra pessoa" value={notes} />
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-ink/8 pt-4">
          <p className="hidden text-xs italic text-ink/46 sm:block">“Todo encontro começa com uma indicação.”</p>
          <Button className="ml-auto rounded-xl bg-hibiscus text-white hover:bg-hibiscus/90" disabled={busy || !title.trim()} onClick={onAdd} type="button">
            <Plus className="mr-1.5 h-4 w-4" /> guardar {singular}
          </Button>
        </div>
      </section>
      <div className="grid gap-4 xl:grid-cols-3">
        {statuses.map(status => {
          const columnItems = items.filter(item => item.status === status);
          return <section className="rounded-[1.35rem] border border-ink/8 bg-white/65 p-4" key={status}>
            <div className="flex items-center justify-between border-b border-ink/8 pb-3">
              <h3 className="font-display text-xl text-ink">{libraryStatusCopy[status]}</h3>
              <span className="text-xs font-extrabold text-ink/42">{columnItems.length}</span>
            </div>
            <div className="mt-3 space-y-3">
              {columnItems.length === 0 ? <p className="py-4 text-xs leading-5 text-ink/45">Ainda há espaço para escolher juntas.</p> : columnItems.map(item => (
                <article className="rounded-xl border border-ink/8 bg-paper/70 p-3" key={item.id}>
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-sm font-extrabold text-ink">{item.title}</h4>
                      {item.creator && <p className="mt-0.5 truncate text-xs text-ink/50">{item.creator}</p>}
                    </div>
                    {item.author_id === currentUserId && <div className="flex items-center gap-1">
                      <button aria-label={`Editar ${item.title}`} className="rounded-full p-1 text-ink/35 hover:bg-white hover:text-hibiscus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hibiscus" onClick={() => onEdit(item)} type="button"><Pencil className="h-3.5 w-3.5" /></button>
                      <button aria-label={`Remover ${item.title}`} className="rounded-full p-1 text-ink/35 hover:bg-hibiscus/10 hover:text-hibiscus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hibiscus" onClick={() => onDelete(item)} type="button"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>}
                  </div>
                  {item.notes && <p className="mt-2 line-clamp-2 text-xs leading-5 text-ink/62">{item.notes}</p>}
                  {item.release_on && <p className="mt-2 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-hibiscus">estreia: {formatDate(item.release_on)}</p>}
                  <select aria-label={`Alterar status de ${item.title}`} className="mt-3 w-full rounded-lg border border-ink/10 bg-white/70 px-2 py-1.5 text-xs font-bold text-ink outline-none focus-visible:ring-2 focus-visible:ring-hibiscus/50 disabled:cursor-not-allowed disabled:opacity-60" disabled={item.author_id !== currentUserId} onChange={event => onChangeStatus(item, event.target.value as LibraryStatus)} value={item.status}>
                    {statuses.map(option => <option key={option} value={option}>{libraryStatusCopy[option]}</option>)}
                  </select>
                </article>
              ))}
            </div>
          </section>;
        })}
      </div>
    </div>
  );
}

function ChatPanel({
  messages,
  value,
  onChange,
  onSend,
  busy,
  currentUserId,
  isPreview,
  onEditMessage,
  onDeleteMessage,
}: {
  messages: ChatMessage[];
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  busy: boolean;
  currentUserId: string;
  isPreview: boolean;
  onEditMessage: (message: ChatMessage) => void;
  onDeleteMessage: (message: ChatMessage) => void;
}) {
  return (
    <section className="overflow-hidden rounded-[1.7rem] border border-ink/8 bg-white shadow-[0_14px_36px_rgba(103,65,72,0.06)]">
      <div className="flex items-center justify-between border-b border-ink/7 bg-paper/65 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="relative flex -space-x-2">
            <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-paper bg-hibiscus text-xs font-extrabold text-white">
              V
            </span>
            <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-paper bg-plum text-xs font-extrabold text-white">
              +
            </span>
          </div>
          <div>
            <p className="text-sm font-extrabold text-ink">
              A conversa de vocês
            </p>
            <p className="text-xs text-ink/45">um lugar sem plateia</p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-bold text-sage">
          <span className="h-2 w-2 rounded-full bg-sage" /> privado
        </span>
      </div>
      <div className="chat-canvas min-h-[370px] space-y-3 px-5 py-6">
        {messages.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
            <img
              alt="Duas pedras de vidro unidas por um fio"
              className="h-24 w-24 rounded-[1.35rem] object-cover shadow-md"
              src={ASSETS.chat}
            />
            <h2 className="mt-5 font-display text-3xl tracking-[-0.05em] text-ink">
              Comecem com um oi.
            </h2>
            <p className="mt-2 max-w-xs text-sm leading-6 text-ink/52">
              Uma mensagem simples já pode virar parte da história de vocês.
            </p>
            {isPreview && (
              <p className="mt-3 text-xs font-bold text-hibiscus">
                Envie uma mensagem para testar a prévia.
              </p>
            )}
          </div>
        ) : (
          messages.map(message => {
            const mine = message.sender_id === currentUserId;
            return (
              <div
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
                key={message.id}
              >
                <div
                  className={`max-w-[82%] rounded-[1.1rem] px-4 py-3 ${mine ? "rounded-br-sm bg-hibiscus text-white" : "rounded-bl-sm bg-paper text-ink"}`}
                >
                  {!mine && (
                    <p className="mb-1 text-xs font-extrabold text-hibiscus">
                      {message.sender_name}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap text-sm leading-6">
                    {message.text}
                  </p>
                  <div className={`mt-1.5 flex items-center gap-1 ${mine ? "justify-end" : "justify-start"}`}>
                    <p className={`text-[0.65rem] font-bold ${mine ? "text-white/60" : "text-ink/35"}`}>{formatTime(message.created_at)}</p>
                    {mine && (
                      <>
                        <button aria-label="Editar mensagem" className="rounded p-1 text-white/62 hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" onClick={() => onEditMessage(message)} type="button"><Pencil className="h-3 w-3" /></button>
                        <button aria-label="Apagar mensagem" className="rounded p-1 text-white/62 hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" onClick={() => onDeleteMessage(message)} type="button"><Trash2 className="h-3 w-3" /></button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="border-t border-ink/7 bg-white p-3">
        <div className="flex items-end gap-2 rounded-[1.1rem] bg-paper p-2">
          <Textarea
            className="min-h-[42px] max-h-28 resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0"
            onChange={event => onChange(event.target.value)}
            placeholder="Escreve para vocês..."
            value={value}
          />
          <Button
            aria-label="Enviar mensagem"
            className="h-10 w-10 shrink-0 rounded-xl bg-hibiscus p-0 text-white shadow-[0_8px_16px_rgba(201,87,103,0.2)] hover:bg-hibiscus/90"
            disabled={busy || !value.trim()}
            onClick={onSend}
            type="button"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}

function PlansPanel({
  plans,
  selectedDate,
  onSelectDate,
  planTitle,
  onPlanTitleChange,
  planDetails,
  onPlanDetailsChange,
  onCreatePlan,
  busy,
  onTogglePlan,
  onEditPlan,
  onDeletePlan,
  currentUserId,
  isPreview,
}: {
  plans: Plan[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  planTitle: string;
  onPlanTitleChange: (value: string) => void;
  planDetails: string;
  onPlanDetailsChange: (value: string) => void;
  onCreatePlan: () => void;
  busy: boolean;
  onTogglePlan: (plan: Plan) => void;
  onEditPlan: (plan: Plan) => void;
  onDeletePlan: (plan: Plan) => void;
  currentUserId: string;
  isPreview: boolean;
}) {
  const selectedKey = toDateKey(selectedDate);
  const plansForSelectedDate = plans.filter(
    plan => plan.scheduled_for === selectedKey
  );
  const plannedDates = plans.map(plan => dateFromKey(plan.scheduled_for));
  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[1.75rem] bg-plum px-7 py-8 text-white shadow-[0_18px_45px_rgba(55,35,42,0.18)] sm:px-9">
        <img
          alt="Mapa, passagens e itens de viagem sobre papel creme"
          className="absolute inset-0 h-full w-full object-cover opacity-35"
          src={ASSETS.plans}
        />
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(55,35,42,0.95),rgba(55,35,42,0.3))]" />
        <div className="relative z-10 max-w-xl">
          <span className="mb-5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-hibiscus">
            <CalendarDays className="h-4 w-4" />
          </span>
          <h2 className="font-display text-4xl leading-[0.9] tracking-[-0.06em]">
            Toda história merece um próximo capítulo.
          </h2>
          <p className="mt-4 text-sm leading-6 text-white/72">
            Marquem as pequenas âncoras que vão viver juntos. Cada data fica
            protegida na memória do casal.
          </p>
        </div>
      </section>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(280px,0.72fr)]">
        <section className="paper-note rounded-[1.45rem] border border-ink/8 bg-white p-4 shadow-[0_12px_28px_rgba(103,65,72,0.05)] sm:p-5">
          <p className="px-2 text-[0.66rem] font-extrabold uppercase tracking-[0.16em] text-hibiscus">
            calendário a dois
          </p>
          <Calendar
            className="mt-2 w-full rounded-xl bg-transparent p-0 [&_.rdp-root]:w-full [&_.rdp-month]:w-full [&_.rdp-table]:w-full"
            mode="single"
            modifiers={{ planned: plannedDates }}
            modifiersClassNames={{
              planned:
                "relative after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-hibiscus",
            }}
            onSelect={date => date && onSelectDate(date)}
            selected={selectedDate}
            weekStartsOn={1}
          />
        </section>
        <section className="rounded-[1.45rem] border border-hibiscus/15 bg-hibiscus-soft/55 p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <PenLine className="h-4 w-4 text-hibiscus" />
            <p className="text-sm font-extrabold text-ink">Nova data</p>
          </div>
          <p className="mt-1 text-xs font-bold capitalize text-ink/48">
            {formatLongDate(selectedDate)}
          </p>
          <Input
            className="mt-4 h-10 rounded-xl border-white bg-white px-3 text-sm focus-visible:ring-hibiscus"
            onChange={event => onPlanTitleChange(event.target.value)}
            placeholder="O que vocês vão viver?"
            value={planTitle}
          />
          <Textarea
            className="mt-3 min-h-[76px] resize-none rounded-xl border-white bg-white text-sm focus-visible:ring-hibiscus"
            onChange={event => onPlanDetailsChange(event.target.value)}
            placeholder="Um detalhe para lembrar..."
            value={planDetails}
          />
          <Button
            className="mt-3 h-10 w-full rounded-xl bg-hibiscus text-xs font-extrabold text-white hover:bg-hibiscus/90"
            disabled={busy || !planTitle.trim()}
            onClick={onCreatePlan}
            type="button"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {busy ? "Guardando..." : "guardar no calendário"}
          </Button>
          {isPreview && (
            <p className="mt-3 text-xs leading-5 text-ink/48">
              Na prévia, a data fica só nesta sessão.
            </p>
          )}
        </section>
      </div>
      <section className="paper-note rounded-[1.45rem] border border-ink/8 bg-white p-5 shadow-[0_12px_28px_rgba(103,65,72,0.05)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.16em] text-ink/42">
              marcado para
            </p>
            <h3 className="mt-1 font-display text-3xl tracking-[-0.05em] text-ink">
              {formatLongDate(selectedDate)}
            </h3>
          </div>
          <span className="rounded-full bg-paper px-3 py-1.5 text-xs font-extrabold text-ink/52">
            {plansForSelectedDate.length}{" "}
            {plansForSelectedDate.length === 1 ? "plano" : "planos"}
          </span>
        </div>
        <div className="mt-5 space-y-3">
          {plansForSelectedDate.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ink/12 bg-paper/60 px-4 py-5 text-sm leading-6 text-ink/48">
              Ainda não há nada marcado para este dia. Comecem por uma coisa
              simples que valha a espera.
            </p>
          ) : (
            plansForSelectedDate.map(plan => (
              <article
                className="flex items-start gap-3 rounded-xl border border-ink/7 bg-paper/55 p-4"
                key={plan.id}
              >
                <button
                  aria-label={
                    plan.completed
                      ? "Marcar plano como pendente"
                      : "Marcar plano como concluído"
                  }
                  className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border transition ${plan.completed ? "border-sage bg-sage text-white" : "border-hibiscus/35 bg-white text-transparent hover:border-hibiscus"}`}
                  onClick={() => onTogglePlan(plan)}
                  type="button"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <div className="min-w-0 flex-1">
                  <p
                    className={`font-extrabold ${plan.completed ? "text-ink/42 line-through" : "text-ink"}`}
                  >
                    {plan.title}
                  </p>
                  {plan.details && (
                    <p className="mt-1 text-sm leading-6 text-ink/54">
                      {plan.details}
                    </p>
                  )}
                </div>
                {plan.created_by === currentUserId && <div className="flex shrink-0 items-center gap-1">
                  <button aria-label={`Editar ${plan.title}`} className="rounded-full p-1.5 text-ink/42 hover:bg-white hover:text-hibiscus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hibiscus" onClick={() => onEditPlan(plan)} type="button"><Pencil className="h-3.5 w-3.5" /></button>
                  <button aria-label={`Apagar ${plan.title}`} className="rounded-full p-1.5 text-ink/42 hover:bg-hibiscus/10 hover:text-hibiscus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hibiscus" onClick={() => onDeletePlan(plan)} type="button"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>}
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function RelationshipCounterPanel({
  onAddCounterToHome,
  canInstallCounter,
  onSaveRelationshipDate,
  relationshipStartedOn,
  saving,
}: {
  onAddCounterToHome: () => void;
  canInstallCounter: boolean;
  onSaveRelationshipDate: (value: string) => void;
  relationshipStartedOn: string;
  saving: boolean;
}) {
  const relationshipTime = relationshipStartedOn
    ? formatRelationshipTime(relationshipStartedOn)
    : null;
  const daysTogether = relationshipDays(relationshipStartedOn);
  const relationshipStart = relationshipStartedOn
    ? dateFromKey(relationshipStartedOn)
    : null;
  const milestones = [
    { label: "próximo mêsversário", date: getUpcomingMonthlyDate(23) },
    ...(relationshipStart
      ? [
          {
            label: "próximo aniversário juntos",
            date: getUpcomingAnnualDate(
              relationshipStart.getMonth(),
              relationshipStart.getDate()
            ),
          },
        ]
      : []),
    { label: "nosso 23 de junho", date: getUpcomingAnnualDate(5, 23) },
  ];

  return (
    <div className="space-y-6">
      <section className="romance-opening relative overflow-hidden rounded-[1.85rem] p-6 sm:p-8">
        <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-hibiscus/14 blur-3xl" />
        <div className="relative max-w-2xl">
          <span className="memory-marker">capítulo em andamento</span>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-5">
            <div>
              <h2 className="font-display text-4xl leading-[0.94] tracking-[-0.06em] text-ink sm:text-5xl">
                O tempo de vocês.
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-6 text-ink/58">
                {relationshipStartedOn
                  ? `Uma história contada desde ${formatDate(`${relationshipStartedOn}T12:00:00`)}.`
                  : "Escolham a data que abriu este caderno para começar a contagem."}
              </p>
            </div>
            <span className="love-seal love-seal--soft" aria-hidden="true" />
          </div>
        </div>
      </section>

      <section aria-label="Contagem do relacionamento" className="rounded-[1.7rem] bg-plum p-5 text-white shadow-[0_18px_42px_rgba(74,44,58,0.16)] sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.17em] text-white/65">
              juntos até aqui
            </p>
            <p className="mt-2 font-display text-4xl leading-none tracking-[-0.055em] sm:text-5xl">
              {relationshipTime
                ? `${relationshipTime.years ? `${relationshipTime.years} ${relationshipTime.years === 1 ? "ano" : "anos"}` : ""}${relationshipTime.years && relationshipTime.months ? " e " : ""}${relationshipTime.months} ${relationshipTime.months === 1 ? "mês" : "meses"}`
                : "À espera da primeira data"}
            </p>
          </div>
          <Heart className="h-6 w-6 shrink-0 text-hibiscus-light" aria-hidden="true" />
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <article className="rounded-2xl border border-white/12 bg-white/8 p-4">
            <p className="font-display text-3xl tracking-[-0.05em]">
              {daysTogether ?? "—"}
            </p>
            <p className="mt-1 text-xs font-bold text-white/62">
              {daysTogether === 1 ? "dia vivido" : "dias vividos"}
            </p>
          </article>
          <article className="rounded-2xl border border-white/12 bg-white/8 p-4">
            <p className="font-display text-3xl tracking-[-0.05em]">
              {relationshipTime?.years ?? "—"}
            </p>
            <p className="mt-1 text-xs font-bold text-white/62">anos completos</p>
          </article>
          <article className="rounded-2xl border border-white/12 bg-white/8 p-4">
            <p className="font-display text-3xl tracking-[-0.05em]">
              {relationshipTime?.months ?? "—"}
            </p>
            <p className="mt-1 text-xs font-bold text-white/62">meses deste ano</p>
          </article>
        </div>
        <div className="mt-5 flex flex-col gap-3 border-t border-white/12 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-xs leading-5 text-white/67">
            {canInstallCounter
              ? "Instale o Caderno de Dois e use o atalho “Contador” para abrir esta contagem com um toque."
              : "No iPhone/iPad, abra o compartilhamento do navegador e escolha “Adicionar à Tela de Início”. No Android, instale o app e mantenha o ícone pressionado para escolher “Contador”."}
          </p>
          <Button
            className="shrink-0 rounded-xl bg-white text-plum hover:bg-white/90"
            onClick={onAddCounterToHome}
            type="button"
            variant="secondary"
          >
            <Heart className="h-4 w-4" aria-hidden="true" />
            {canInstallCounter ? "Instalar contador" : "Adicionar à tela inicial"}
          </Button>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_0.9fr]">
        <article className="paper-note rounded-[1.55rem] border border-ink/8 bg-white p-5 shadow-[0_12px_28px_rgba(103,65,72,0.05)]">
          <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.16em] text-hibiscus">
            a primeira página
          </p>
          <h3 className="mt-2 font-display text-3xl tracking-[-0.05em] text-ink">
            Quando começou?
          </h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-ink/56">
            Esta data atualiza a contagem e fica somente no espaço privado de vocês.
          </p>
          <label className="mt-5 block max-w-xs">
            <span className="mb-2 block text-xs font-extrabold uppercase tracking-[0.13em] text-ink/56">
              data de início
            </span>
            <BrazilianDateInput
              aria-describedby="relationship-date-help relationship-counter-date-hint"
              className="h-11 rounded-xl border-ink/12 bg-paper text-ink focus-visible:ring-hibiscus"
              onDateChange={onSaveRelationshipDate}
              value={relationshipStartedOn}
            />
            <span className="mt-2 block text-xs text-ink/56" id="relationship-counter-date-hint">{FOUR_DIGIT_YEAR_DATE_HINT}</span>
          </label>
          <p className="mt-2 text-xs text-ink/44" id="relationship-date-help">
            {saving ? "Guardando a data…" : "Vocês podem alterar esta data quando quiserem."}
          </p>
        </article>

        <article className="rounded-[1.55rem] border border-hibiscus/15 bg-hibiscus-soft/42 p-5">
          <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.16em] text-hibiscus">
            próximos capítulos
          </p>
          <div className="mt-4 space-y-3">
            {milestones.map(milestone => (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-white/72 px-3.5 py-3" key={milestone.label}>
                <div>
                  <p className="text-sm font-extrabold text-ink">{milestone.label}</p>
                  <p className="mt-0.5 text-xs text-ink/48">
                    {formatDate(milestone.date.toISOString())}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-extrabold text-hibiscus">
                  {formatCountdown(milestone.date)}
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

function BrazilianDateInput({
  value,
  onDateChange,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type" | "value" | "onChange"> & {
  value: string;
  onDateChange: (value: string) => void;
}) {
  const [displayValue, setDisplayValue] = useState(() => formatBrazilianDateInput(value));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setDisplayValue(formatBrazilianDateInput(value));
    setInvalid(false);
  }, [value]);

  return (
    <Input
      {...props}
      aria-invalid={invalid || props["aria-invalid"]}
      className={className}
      inputMode="numeric"
      maxLength={10}
      onBlur={() => {
        if (!displayValue) {
          setInvalid(false);
          onDateChange("");
          return;
        }

        const parsed = parseBrazilianDateInput(displayValue);
        if (!parsed) {
          setInvalid(true);
          return;
        }

        setInvalid(false);
        onDateChange(parsed);
      }}
      onChange={event => {
        setDisplayValue(formatBrazilianDateTyping(event.target.value));
        setInvalid(false);
      }}
      placeholder="DD/MM/AAAA"
      type="text"
      value={displayValue}
    />
  );
}

function MorePanel({
  configured,
  hasCouple,
  inviteCode,
  inviteBusy,
  acceptCode,
  onAcceptCodeChange,
  onCreateInvite,
  onCopyInvite,
  onAcceptInvite,
  onDeleteAccount,
  acceptBusy,
  isPreview,
  onSignOut,
  deletingAccount,
}: {
  configured: boolean;
  hasCouple: boolean;
  inviteCode: string;
  inviteBusy: boolean;
  acceptCode: string;
  onAcceptCodeChange: (value: string) => void;
  onCreateInvite: () => void;
  onCopyInvite: () => void;
  onAcceptInvite: () => void;
  onDeleteAccount: () => void;
  acceptBusy: boolean;
  isPreview: boolean;
  onSignOut: () => void;
  deletingAccount: boolean;
}) {
  const { accent, mode, setAccent, setMode, theme } = useTheme();
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const appearanceModes: { id: AppearanceMode; label: string; description: string }[] = [
    { id: "light", label: "Claro", description: "papel quente" },
    { id: "dark", label: "Noturno", description: "leitura suave" },
    { id: "system", label: "Automático", description: "acompanha o dispositivo" },
  ];

  return (
    <div className="space-y-4">
      <section className="rounded-[1.6rem] border border-ink/8 bg-white p-6 shadow-[0_12px_28px_rgba(103,65,72,0.05)]">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-plum text-white">
          <Settings2 className="h-5 w-5" />
        </span>
        <h2 className="mt-5 font-display text-4xl tracking-[-0.055em] text-ink">
          O espaço de vocês, do jeito de vocês.
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-ink/56">
          Convites, fotos, lembretes e localização podem crescer a partir desta
          base sem diluir a privacidade do casal.
        </p>
      </section>
      <section aria-labelledby="appearance-heading" className="paper-note rounded-[1.55rem] border border-ink/8 bg-white p-5 shadow-[0_12px_28px_rgba(103,65,72,0.05)]">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-hibiscus-soft text-hibiscus">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.16em] text-hibiscus">
              aparência
            </p>
            <h3 className="mt-1 font-display text-2xl tracking-[-0.045em] text-ink" id="appearance-heading">
              Do jeito que acalma vocês.
            </h3>
            <p className="mt-1 text-sm leading-6 text-ink/55">
              Escolham o contraste e a cor que acompanham a leitura do caderno.
            </p>
          </div>
        </div>

        <fieldset className="mt-5">
          <legend className="text-xs font-extrabold uppercase tracking-[0.13em] text-ink/55">
            modo de leitura
          </legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Modo de aparência">
            {appearanceModes.map(option => {
              const active = mode === option.id;
              return (
                <button
                  aria-checked={active}
                  className={`rounded-xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hibiscus focus-visible:ring-offset-2 ${active ? "border-hibiscus bg-hibiscus-soft/72 text-ink" : "border-ink/10 bg-paper text-ink/58 hover:border-hibiscus/35"}`}
                  key={option.id}
                  onClick={() => setMode(option.id)}
                  role="radio"
                  type="button"
                >
                  <span className="block text-sm font-extrabold">{option.label}</span>
                  <span className="mt-0.5 block text-[0.68rem] leading-4 opacity-70">
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-ink/44">
            {mode === "system"
              ? `Agora o dispositivo está no modo ${theme === "dark" ? "noturno" : "claro"}.`
              : "A troca acontece apenas neste dispositivo e pode ser desfeita a qualquer momento."}
          </p>
        </fieldset>

        <fieldset className="mt-5">
          <legend className="text-xs font-extrabold uppercase tracking-[0.13em] text-ink/55">
            cor de destaque
          </legend>
          <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Cor de destaque">
            {ACCENT_OPTIONS.map(option => {
              const active = accent === option.id;
              return (
                <button
                  aria-checked={active}
                  className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hibiscus focus-visible:ring-offset-2 ${active ? "border-ink/28 bg-paper text-ink" : "border-ink/10 bg-white text-ink/58 hover:border-ink/24"}`}
                  key={option.id}
                  onClick={() => setAccent(option.id)}
                  role="radio"
                  type="button"
                >
                  <span aria-hidden="true" className="h-3 w-3 rounded-full ring-1 ring-black/10" style={{ backgroundColor: option.swatch }} />
                  {option.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      </section>
      <section className="paper-note rounded-[1.55rem] border border-hibiscus/15 bg-white p-5 shadow-[0_12px_28px_rgba(103,65,72,0.05)]">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-hibiscus-soft text-hibiscus">
            <UserPlus className="h-5 w-5" />
          </span>
          <div>
            <p className="font-extrabold text-ink">
              Convide quem vai escrever este caderno com você.
            </p>
            <p className="mt-1 text-sm leading-6 text-ink/55">
              O link é válido por sete dias, aceita apenas uma pessoa e não
              expõe memórias antes da entrada no casal.
            </p>
          </div>
        </div>
        {hasCouple ? (
          <div className="mt-5 rounded-xl border border-sage/20 bg-sage/10 px-4 py-3 text-sm font-bold text-sage">
            <CheckCircle2 className="mr-1.5 inline h-4 w-4" />O espaço já tem
            duas pessoas vinculadas.
          </div>
        ) : (
          <>
            <Button
              className="mt-5 h-10 rounded-xl bg-hibiscus text-xs font-extrabold text-white hover:bg-hibiscus/90"
              disabled={inviteBusy}
              onClick={onCreateInvite}
              type="button"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {inviteBusy
                ? "Gerando convite..."
                : inviteCode
                  ? "gerar novo convite"
                  : "criar convite do casal"}
            </Button>
            {inviteCode && (
              <div className="mt-4 rounded-xl border border-hibiscus/16 bg-hibiscus-soft/45 p-4">
                <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.15em] text-hibiscus">
                  convite ativo
                </p>
                <p className="mt-2 text-xs font-bold text-ink/58">
                  Código para enviar ao seu par
                </p>
                <code className="mt-1 block break-all rounded-lg border border-hibiscus/15 bg-white/85 px-3 py-2 font-mono text-sm font-bold tracking-[0.08em] text-plum">
                  {inviteCode}
                </code>
                <p className="mt-3 text-xs font-bold text-ink/58">
                  Link do convite
                </p>
                <p className="mt-2 break-all font-mono text-xs leading-5 text-ink/62">
                  {PUBLIC_APP_ORIGIN}/?invite={inviteCode}
                </p>
                <Button
                  className="mt-3 h-9 rounded-lg border-hibiscus/25 bg-white text-xs font-extrabold text-hibiscus hover:bg-hibiscus hover:text-white"
                  onClick={onCopyInvite}
                  type="button"
                  variant="outline"
                >
                  <Clipboard className="mr-1.5 h-3.5 w-3.5" />
                  copiar novamente
                </Button>
              </div>
            )}
          </>
        )}
      </section>
      <section className="rounded-[1.55rem] border border-ink/8 bg-white p-5 shadow-[0_12px_28px_rgba(103,65,72,0.05)]">
        <p className="font-extrabold text-ink">Recebeu um convite?</p>
        <p className="mt-1 text-sm leading-6 text-ink/55">
          Entre ou crie sua conta e cole o código recebido para se juntar ao
          espaço privado.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Input
            className="h-10 rounded-xl border-ink/10 bg-paper px-3 font-mono text-sm uppercase focus-visible:ring-hibiscus"
            onChange={event => onAcceptCodeChange(event.target.value)}
            placeholder="código do convite"
            value={acceptCode}
          />
          <Button
            className="h-10 rounded-xl bg-plum px-4 text-xs font-extrabold text-white hover:bg-plum/90"
            disabled={acceptBusy || !acceptCode.trim()}
            onClick={onAcceptInvite}
            type="button"
          >
            {acceptBusy ? "Entrando..." : "juntar-se"}
          </Button>
        </div>
        {isPreview && (
          <p className="mt-3 text-xs text-ink/45">
            A aceitação só é habilitada com Supabase configurado.
          </p>
        )}
      </section>
      <section aria-labelledby="account-heading" className="rounded-[1.55rem] border border-ink/8 bg-white p-5 shadow-[0_12px_28px_rgba(103,65,72,0.05)]">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-plum/10 text-plum">
            <LogOut className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.16em] text-plum">
              conta e privacidade
            </p>
            <h3 className="mt-1 font-display text-2xl tracking-[-0.045em] text-ink" id="account-heading">
              Seus acessos, nas suas mãos.
            </h3>
            <p className="mt-1 text-sm leading-6 text-ink/55">
              Sair encerra esta sessão neste dispositivo. Excluir remove sua identidade,
              suas mídias e os conteúdos criados por você — sem apagar o que pertence ao seu par.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Button
            className="h-10 rounded-xl border-ink/15 bg-paper text-xs font-extrabold text-ink hover:bg-ink hover:text-white"
            onClick={onSignOut}
            type="button"
            variant="outline"
          >
            <LogOut className="mr-1.5 h-3.5 w-3.5" />
            {isPreview ? "encerrar prévia" : "sair da conta"}
          </Button>
          {!isPreview && (
            <AlertDialog onOpenChange={open => !open && setDeleteConfirmation("")}>
              <AlertDialogTrigger asChild>
                <Button
                  className="h-10 rounded-xl border-red-500/35 bg-red-50 text-xs font-extrabold text-red-700 hover:bg-red-600 hover:text-white dark:bg-red-950/30 dark:text-red-300"
                  type="button"
                  variant="outline"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  excluir conta
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir sua conta definitivamente?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação remove sua identidade de acesso, seus conteúdos e mídias privadas.
                    O e-mail ficará livre para uma nova conta, sem recuperar este histórico.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <label className="grid gap-2 text-sm font-bold text-ink" htmlFor="delete-account-confirmation">
                  Digite <span className="font-mono text-hibiscus">EXCLUIR</span> para confirmar
                  <Input
                    aria-label="Confirme a exclusão digitando EXCLUIR"
                    autoComplete="off"
                    id="delete-account-confirmation"
                    onChange={event => setDeleteConfirmation(event.target.value)}
                    placeholder="EXCLUIR"
                    value={deleteConfirmation}
                  />
                </label>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deletingAccount}>cancelar</AlertDialogCancel>
                  <AlertDialogAction asChild>
                    <Button
                      className="bg-red-600 text-white hover:bg-red-700"
                      disabled={deleteConfirmation !== "EXCLUIR" || deletingAccount}
                      onClick={onDeleteAccount}
                      type="button"
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" />
                      {deletingAccount ? "excluindo..." : "excluir definitivamente"}
                    </Button>
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </section>
      <section className="rounded-[1.45rem] border border-dashed border-hibiscus/30 bg-hibiscus-soft/55 p-5">
        <div className="flex items-start gap-3">
          <LockKeyhole className="mt-0.5 h-5 w-5 text-hibiscus" />
          <div>
            <p className="font-extrabold text-ink">
              {configured
                ? "Supabase conectado"
                : "Conecte o Supabase para publicar dados reais"}
            </p>
            <p className="mt-1 text-sm leading-6 text-ink/55">
              {configured
                ? "Fotos, planos e convites respeitam as políticas de acesso por casal."
                : "Adicione VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY nas variáveis de ambiente públicas do projeto."}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

/* Sala Spotify: o appCasal guarda somente o convite e os bilhetes do casal; a reprodução acontece no Spotify. */
function MusicPanel({
  busy,
  isPreview,
  jamDraft,
  musicRoom,
  onAddTrack,
  onConnectSpotify,
  onCopyInvite,
  onCreateRoom,
  onCreateSpotifyPlaylist,
  onEndRoom,
  onJamDraftChange,
  onOpenSpotifyPlaylist,
  onRemoveTrack,
  onRoomTitleChange,
  onSaveJam,
  onTrackArtistChange,
  onTrackNoteChange,
  onTrackTitleChange,
  onTrackUrlChange,
  queue,
  roomTitle,
  spotifyBusy,
  spotifyConnected,
  spotifyPlaylistCreating,
  spotifyName,
  trackArtist,
  trackNote,
  trackTitle,
  trackUrl,
}: {
  busy: boolean;
  isPreview: boolean;
  jamDraft: string;
  musicRoom: CoupleMusicRoom | null;
  onAddTrack: () => void;
  onConnectSpotify: () => void;
  onCopyInvite: () => void;
  onCreateRoom: () => void;
  onCreateSpotifyPlaylist: () => void;
  onEndRoom: () => void;
  onJamDraftChange: (value: string) => void;
  onOpenSpotifyPlaylist: () => void;
  onRemoveTrack: (item: MusicQueueItem) => void;
  onRoomTitleChange: (value: string) => void;
  onSaveJam: () => void;
  onTrackArtistChange: (value: string) => void;
  onTrackNoteChange: (value: string) => void;
  onTrackTitleChange: (value: string) => void;
  onTrackUrlChange: (value: string) => void;
  queue: MusicQueueItem[];
  roomTitle: string;
  spotifyBusy: boolean;
  spotifyConnected: boolean;
  spotifyPlaylistCreating: boolean;
  spotifyName: string | null;
  trackArtist: string;
  trackNote: string;
  trackTitle: string;
  trackUrl: string;
}) {
  const canJoin = Boolean(musicRoom?.is_active && musicRoom.jam_url);
  const invitationValue = musicRoom?.jam_url ?? "spotify:appcasal-sala";

  return (
    <div className="space-y-6">
      <section className="paper-memory chapter-thread music-hero relative overflow-hidden rounded-[1.85rem] border border-hibiscus/18 p-6 shadow-[0_18px_45px_rgba(103,65,72,0.08)] sm:p-8">
        <div className="absolute -right-12 -top-14 h-44 w-44 rounded-full border-[22px] border-hibiscus/10" />
        <div className="music-hero-icon absolute right-8 top-8 flex h-11 w-11 items-center justify-center rounded-full border border-hibiscus/18 text-hibiscus shadow-sm">
          <Music2 className="h-5 w-5" />
        </div>
        <div className="relative max-w-2xl">
          <div className="mb-5 flex items-center gap-3">
            <Brand compact />
            <div>
              <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.19em] text-hibiscus">
                appCasal · capítulo a dois
              </p>
              <p className="mt-0.5 text-xs font-bold text-ink/46">
                uma faixa para guardar
              </p>
            </div>
          </div>
          <p className="memory-marker">
            <Radio className="h-3.5 w-3.5" />a trilha de vocês
          </p>
          <h2 className="mt-3 max-w-xl font-display text-4xl leading-[0.95] tracking-[-0.055em] text-ink sm:text-5xl">
            Uma música no mesmo instante.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-6 text-ink/58">
            Criem um Jam no Spotify, guardem o convite neste caderno e escolham
            as próximas faixas a quatro mãos.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs font-bold text-ink/58">
            <span className="music-hero-chip rounded-full border border-hibiscus/18 px-3 py-1.5">
              Spotify Premium
            </span>
            <span className="music-hero-chip rounded-full border border-sage/20 px-3 py-1.5">
              Wi‑Fi sugerido pelo Spotify
            </span>
            <span className="music-hero-chip rounded-full border border-plum/12 px-3 py-1.5">
              sem senha no caderno
            </span>
          </div>
        </div>
      </section>

      <section className="paper-note spotify-account flex flex-col justify-between gap-4 rounded-[1.45rem] border border-[#1db954]/20 p-5 shadow-[0_12px_28px_rgba(41,110,66,0.06)] sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <span
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${spotifyConnected ? "bg-[#1db954] text-white" : "bg-[#1db954]/12 text-[#168b43]"}`}
          >
            <Music2 className="h-5 w-5" />
          </span>
          <div>
            <p className="spotify-account-label text-[0.64rem] font-extrabold uppercase tracking-[0.16em] text-[#168b43]">
              sua conta Spotify
            </p>
            <p className="spotify-account-title mt-1 font-extrabold text-ink">
              {spotifyConnected
                ? `Conectada${spotifyName ? ` como ${spotifyName}` : ""}`
                : "Conecte a sua conta, se quiser."}
            </p>
            <p className="spotify-account-copy mt-1 max-w-xl text-xs leading-5 text-ink/53">
              A conexão é individual. O appCasal não armazena senha, token nem
              biblioteca; o parceiro vê apenas o status de vínculo.
            </p>
          </div>
        </div>
        {spotifyConnected ? (
          <div className="flex flex-wrap items-center gap-2 self-start">
            <Button
              aria-label="Criar uma playlist privada no Spotify"
              className="h-10 rounded-xl border border-[#1db954]/30 bg-[#1db954]/10 px-4 text-xs font-extrabold text-[#168b43] hover:bg-[#1db954]/18"
              disabled={isPreview || spotifyPlaylistCreating}
              onClick={onCreateSpotifyPlaylist}
              type="button"
              variant="outline"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {spotifyPlaylistCreating ? "abrindo Spotify..." : "criar playlist"}
            </Button>
            <Button
              aria-label="Abrir playlist no Spotify"
              className="h-10 rounded-xl bg-[#1db954] px-4 text-xs font-extrabold text-white hover:bg-[#168b43]"
              onClick={onOpenSpotifyPlaylist}
              type="button"
            >
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              abrir playlist
            </Button>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1db954]/12 px-3 py-2 text-xs font-extrabold text-[#168b43]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              conectada
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 self-start">
            <Button
              aria-label="Entrar no Spotify para conectar sua conta"
              className="h-10 self-start rounded-xl bg-[#1db954] px-4 text-xs font-extrabold text-white hover:bg-[#168b43]"
              disabled={isPreview || spotifyBusy}
              onClick={onConnectSpotify}
              type="button"
            >
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              {spotifyBusy ? "Abrindo login seguro..." : "entrar no Spotify"}
            </Button>
            <Button
              aria-label="Criar uma playlist privada no Spotify"
              className="h-10 rounded-xl border border-[#1db954]/30 bg-[#1db954]/10 px-4 text-xs font-extrabold text-[#168b43] hover:bg-[#1db954]/18"
              disabled={isPreview || spotifyPlaylistCreating}
              onClick={onCreateSpotifyPlaylist}
              type="button"
              variant="outline"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {spotifyPlaylistCreating ? "abrindo Spotify..." : "criar playlist"}
            </Button>
          </div>
        )}
        {isPreview && (
          <p className="spotify-account-preview basis-full text-xs leading-5 text-ink/44">
            A conexão fica disponível quando entrarem com uma conta real e
            habilitarem o provedor Spotify no Supabase.
          </p>
        )}
      </section>

      {!musicRoom ? (
        <section className="paper-note rounded-[1.6rem] border border-ink/8 bg-white p-6 shadow-[0_12px_28px_rgba(103,65,72,0.05)]">
          <div className="flex items-start gap-4">
            <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-[1rem] bg-hibiscus-soft text-hibiscus shadow-[0_10px_20px_rgba(201,87,103,0.14)]">
              <span
                aria-hidden
                className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#1db954] ring-2 ring-white"
              />
              <Play className="ml-0.5 h-5 w-5 fill-current" />
            </span>
            <div>
              <p className="font-display text-3xl tracking-[-0.04em] text-ink">
                Abram a primeira sessão.
              </p>
              <p className="mt-2 max-w-lg text-sm leading-6 text-ink/57">
                Dêem um nome para esta escuta. Depois, iniciem um Jam no Spotify
                e colem aqui o link de convite.
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Input
              className="h-11 rounded-xl border-ink/10 bg-paper px-4 text-sm focus-visible:ring-hibiscus"
              maxLength={80}
              onChange={event => onRoomTitleChange(event.target.value)}
              placeholder="ex.: nossa noite de sexta"
              value={roomTitle}
            />
            <Button
              className="h-11 rounded-xl bg-hibiscus px-5 text-xs font-extrabold text-white hover:bg-hibiscus/90"
              disabled={busy || !roomTitle.trim()}
              onClick={onCreateRoom}
              type="button"
            >
              <Music2 className="mr-2 h-4 w-4" />
              {busy ? "Abrindo..." : "abrir sala"}
            </Button>
          </div>
          {isPreview && (
            <p className="mt-3 text-xs text-ink/44">
              Na prévia, a sala fica somente neste navegador.
            </p>
          )}
        </section>
      ) : (
        <>
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_240px]">
            <div className="paper-note relative overflow-hidden rounded-[1.6rem] border border-ink/8 bg-white p-6 shadow-[0_12px_28px_rgba(103,65,72,0.05)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.17em] text-hibiscus">
                    sala em conjunto
                  </p>
                  <h3 className="mt-2 font-display text-3xl tracking-[-0.045em] text-ink">
                    {musicRoom.title}
                  </h3>
                </div>
                <span
                  className={`rounded-full px-3 py-1.5 text-[0.64rem] font-extrabold uppercase tracking-[0.14em] ${musicRoom.is_active ? "bg-sage/12 text-sage" : "bg-ink/6 text-ink/45"}`}
                >
                  {musicRoom.is_active ? "aberta" : "encerrada"}
                </span>
              </div>
              <div className="mt-6 rounded-[1.15rem] border border-dashed border-hibiscus/24 bg-hibiscus-soft/35 p-4">
                <label
                  className="text-[0.64rem] font-extrabold uppercase tracking-[0.15em] text-hibiscus"
                  htmlFor="spotify-jam-link"
                >
                  link do Spotify Jam
                </label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <Input
                    className="h-10 rounded-lg border-hibiscus/16 bg-white px-3 text-xs focus-visible:ring-hibiscus"
                    id="spotify-jam-link"
                    onChange={event => onJamDraftChange(event.target.value)}
                    placeholder="Cole o convite criado no Spotify"
                    value={jamDraft}
                  />
                  <Button
                    className="h-10 rounded-lg border border-hibiscus/22 bg-white px-4 text-xs font-extrabold text-hibiscus hover:bg-hibiscus hover:text-white"
                    disabled={busy || !musicRoom.is_active}
                    onClick={onSaveJam}
                    type="button"
                    variant="outline"
                  >
                    <Link2 className="mr-1.5 h-3.5 w-3.5" />
                    guardar
                  </Button>
                </div>
                <p className="mt-2 text-xs leading-5 text-ink/46">
                  O caderno só armazena este convite. A entrada, o áudio e a
                  detecção na mesma rede ficam dentro do Spotify.
                </p>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  asChild
                  className="h-10 rounded-xl border border-hibiscus/24 bg-white px-4 text-xs font-extrabold text-hibiscus hover:bg-hibiscus hover:text-white"
                  disabled={!canJoin}
                >
                  <a
                    href={canJoin ? (musicRoom.jam_url ?? "#") : "#"}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <span
                      aria-hidden
                      className="mr-2 h-2 w-2 rounded-full bg-[#1db954]"
                    />
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    abrir no Spotify
                  </a>
                </Button>
                <Button
                  className="h-10 rounded-xl border-ink/10 bg-white px-4 text-xs font-extrabold text-ink/60 hover:border-hibiscus/25 hover:text-hibiscus"
                  disabled={!canJoin}
                  onClick={onCopyInvite}
                  type="button"
                  variant="outline"
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  copiar convite
                </Button>
                <Button
                  className="h-10 rounded-xl px-4 text-xs font-extrabold text-ink/42 hover:text-hibiscus"
                  disabled={busy || !musicRoom.is_active}
                  onClick={onEndRoom}
                  type="button"
                  variant="ghost"
                >
                  encerrar sala
                </Button>
              </div>
            </div>
            <aside className="relative grid place-items-center overflow-hidden rounded-[1.6rem] border border-hibiscus/15 bg-[radial-gradient(circle_at_45%_20%,#fff,transparent_45%),linear-gradient(155deg,#fceff0,#fff7f3)] p-6 shadow-[0_12px_28px_rgba(103,65,72,0.05)]">
              <div className="absolute left-0 top-0 h-full w-1.5 bg-hibiscus" />
              <div className="relative grid place-items-center rounded-[1.25rem] bg-white p-3 shadow-[0_12px_22px_rgba(103,65,72,0.1)]">
                <QRCodeSVG
                  bgColor="#fffdf9"
                  fgColor="#34232a"
                  includeMargin
                  level="M"
                  size={144}
                  value={invitationValue}
                />
              </div>
              <div className="mt-4 text-center">
                <p className="flex items-center justify-center gap-1.5 text-xs font-extrabold text-ink">
                  <QrCode className="h-3.5 w-3.5 text-hibiscus" />
                  convite para duas
                </p>
                <p className="mt-1 text-xs leading-5 text-ink/46">
                  Aponte a câmera para abrir o convite no Spotify.
                </p>
              </div>
            </aside>
          </section>

          <MusicRoomEnhancements
            isPreview={isPreview}
            musicRoom={musicRoom}
            queue={queue}
          />

          <section className="paper-note rounded-[1.6rem] border border-ink/8 bg-white p-6 shadow-[0_12px_28px_rgba(103,65,72,0.05)]">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.17em] text-hibiscus">
                  fila afetiva
                </p>
                <h3 className="mt-2 font-display text-3xl tracking-[-0.045em] text-ink">
                  O que toca depois?
                </h3>
                <p className="mt-1 text-sm text-ink/54">
                  Cada faixa pode vir com um bilhete pequeno sobre o motivo de
                  ela estar aqui.
                </p>
              </div>
              <span className="rounded-full bg-hibiscus-soft px-3 py-1.5 text-xs font-extrabold text-hibiscus">
                {queue.length} {queue.length === 1 ? "faixa" : "faixas"}
              </span>
            </div>
            <div className="mt-5 grid gap-3 rounded-[1.25rem] border border-dashed border-hibiscus/20 bg-paper/70 p-4 lg:grid-cols-[1fr_0.7fr]">
              <Input
                className="h-10 rounded-lg border-ink/10 bg-white px-3 text-sm focus-visible:ring-hibiscus"
                maxLength={140}
                onChange={event => onTrackTitleChange(event.target.value)}
                placeholder="Título da faixa"
                value={trackTitle}
              />
              <Input
                className="h-10 rounded-lg border-ink/10 bg-white px-3 text-sm focus-visible:ring-hibiscus"
                maxLength={140}
                onChange={event => onTrackArtistChange(event.target.value)}
                placeholder="Artista (opcional)"
                value={trackArtist}
              />
              <Input
                className="h-10 rounded-lg border-ink/10 bg-white px-3 text-sm focus-visible:ring-hibiscus lg:col-span-2"
                onChange={event => onTrackUrlChange(event.target.value)}
                placeholder="Link da faixa no Spotify"
                value={trackUrl}
              />
              <div className="flex flex-col gap-2 sm:flex-row lg:col-span-2">
                <Input
                  className="h-10 flex-1 rounded-lg border-ink/10 bg-white px-3 text-sm focus-visible:ring-hibiscus"
                  maxLength={240}
                  onChange={event => onTrackNoteChange(event.target.value)}
                  placeholder="Um bilhete sobre esta música (opcional)"
                  value={trackNote}
                />
                <Button
                  className="h-10 rounded-lg bg-hibiscus px-4 text-xs font-extrabold text-white hover:bg-hibiscus/90"
                  disabled={busy || !trackTitle.trim() || !trackUrl.trim()}
                  onClick={onAddTrack}
                  type="button"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  guardar na fila
                </Button>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {queue.length ? (
                queue.map((item, index) => (
                  <article
                    className="group flex items-start gap-3 rounded-[1.15rem] border border-ink/7 bg-white px-4 py-3 shadow-[0_6px_16px_rgba(103,65,72,0.035)]"
                    key={item.id}
                  >
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-plum text-xs font-extrabold text-white">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <a
                        className="font-extrabold text-ink transition hover:text-hibiscus"
                        href={item.track_url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {item.track_title}
                      </a>
                      {item.artist_name && (
                        <span className="text-sm text-ink/52">
                          {" "}
                          · {item.artist_name}
                        </span>
                      )}
                      {item.note && (
                        <p className="mt-1 text-sm italic leading-5 text-ink/54">
                          “{item.note}”
                        </p>
                      )}
                    </div>
                    <button
                      aria-label={`Remover ${item.track_title}`}
                      className="rounded-lg p-2 text-ink/30 transition hover:bg-hibiscus-soft hover:text-hibiscus"
                      onClick={() => onRemoveTrack(item)}
                      type="button"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </article>
                ))
              ) : (
                <div className="rounded-[1.15rem] border border-dashed border-ink/12 bg-paper/60 px-4 py-6 text-sm leading-6 text-ink/48">
                  A primeira faixa pode ser aquela que faz vocês lembrarem de
                  onde tudo começou.
                </div>
              )}
            </div>
          </section>
        </>
      )}
      <p className="px-1 text-xs leading-5 text-ink/42">
        Sala privada por casal. O appCasal não solicita sua senha Spotify nem
        examina dispositivos ou conexões Wi‑Fi.
      </p>
    </div>
  );
}

function vapidKeyToBytes(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const normalized = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  return Uint8Array.from(raw, character => character.charCodeAt(0));
}

function WebPushConsent({
  coupleId,
  currentUserId,
  isPreview,
}: {
  coupleId: string;
  currentUserId: string;
  isPreview: boolean;
}) {
  const config = trpc.push.publicKey.useQuery(undefined, {
    enabled: !isPreview,
  });
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >(() =>
    typeof Notification === "undefined"
      ? "unsupported"
      : Notification.permission
  );
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (
      isPreview ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    )
      return;
    let active = true;
    navigator.serviceWorker
      .getRegistration()
      .then(async registration => {
        const subscription = registration
          ? await registration.pushManager.getSubscription()
          : null;
        if (active) setSubscribed(Boolean(subscription));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [isPreview]);

  async function enable() {
    if (isPreview) {
      toast.success("Na prévia, a permissão fica simulada.");
      return;
    }
    if (!supabase || !currentUserId) {
      toast.error("Entre novamente para ativar os avisos.");
      return;
    }
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      typeof Notification === "undefined"
    ) {
      setPermission("unsupported");
      toast.error("Este navegador não oferece notificações Web.");
      return;
    }
    if (!config.data?.publicKey) {
      toast.error(
        "As chaves de notificação ainda não estão prontas no servidor."
      );
      return;
    }
    setBusy(true);
    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") {
        toast.error("A permissão de avisos não foi concedida.");
        return;
      }
      const registration =
        await navigator.serviceWorker.register("/web-push-sw.js");
      const readyRegistration = await navigator.serviceWorker.ready;
      const subscription = await readyRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKeyToBytes(config.data.publicKey),
      });
      const serialized = subscription.toJSON();
      const p256dh = serialized.keys?.p256dh;
      const auth = serialized.keys?.auth;
      if (!p256dh || !auth) throw new Error("Dados de inscrição incompletos.");
      const { error } = await supabase
        .from("couple_web_push_subscriptions")
        .upsert(
          {
            couple_id: coupleId,
            user_id: currentUserId,
            endpoint: subscription.endpoint,
            p256dh,
            auth,
            user_agent: navigator.userAgent,
            revoked_at: null,
          },
          { onConflict: "user_id,endpoint" }
        );
      if (error) throw error;
      setSubscribed(true);
      toast.success("Este dispositivo receberá os lembretes da sala.");
    } catch {
      toast.error("Não foi possível ativar os avisos neste dispositivo.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (isPreview) {
      setSubscribed(false);
      return;
    }
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription && supabase && currentUserId) {
        const { error } = await supabase
          .from("couple_web_push_subscriptions")
          .update({ revoked_at: new Date().toISOString() })
          .eq("user_id", currentUserId)
          .eq("endpoint", subscription.endpoint);
        if (error) throw error;
        await subscription.unsubscribe();
      }
      setSubscribed(false);
      toast.success("Os avisos foram pausados neste dispositivo.");
    } catch {
      toast.error("Não foi possível pausar os avisos agora.");
    } finally {
      setBusy(false);
    }
  }

  const description =
    permission === "unsupported"
      ? "Este navegador não oferece avisos Web."
      : subscribed
        ? "Ativo somente neste dispositivo. Você pode pausar quando quiser."
        : "Escolha receber um aviso no horário marcado, mesmo com a aba fechada.";
  return (
    <div className="mt-4 rounded-xl border border-hibiscus/14 bg-hibiscus-soft/35 p-3">
      <div className="flex items-start gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-hibiscus">
          <Bell className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-extrabold text-ink">
            Aviso neste dispositivo
          </p>
          <p className="mt-0.5 text-xs leading-5 text-ink/52">{description}</p>
        </div>
      </div>
      <Button
        className="mt-3 h-9 w-full rounded-lg border border-hibiscus/22 bg-white text-xs font-extrabold text-hibiscus hover:bg-hibiscus hover:text-white"
        disabled={
          busy ||
          permission === "unsupported" ||
          (!subscribed && config.isLoading)
        }
        onClick={subscribed ? disable : enable}
        type="button"
        variant="outline"
      >
        {busy
          ? "atualizando..."
          : subscribed
            ? "pausar avisos neste dispositivo"
            : "ativar lembrete neste dispositivo"}
      </Button>
      <p className="mt-2 text-[0.68rem] leading-4 text-ink/42">
        O endpoint do aparelho fica protegido no banco e não é compartilhado com
        seu par.
      </p>
    </div>
  );
}

function MusicRoomEnhancements({
  isPreview,
  musicRoom,
  queue,
}: {
  isPreview: boolean;
  musicRoom: CoupleMusicRoom;
  queue: MusicQueueItem[];
}) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [details, setDetails] = useState<MusicRoomDetails>({
    cover_path: null,
    listen_at: null,
    reminder_note: null,
  });
  const [reactions, setReactions] = useState<MusicReaction[]>([]);
  const [currentUserId, setCurrentUserId] = useState("preview-user");
  const [listenAtDraft, setListenAtDraft] = useState("");
  const [reminderDraft, setReminderDraft] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadEnhancements() {
      if (isPreview || !supabase) return;
      const [{ data: authData }, { data: roomData }, { data: reactionData }] =
        await Promise.all([
          supabase.auth.getUser(),
          supabase
            .from("couple_music_rooms")
            .select("cover_path, listen_at, reminder_note")
            .eq("couple_id", musicRoom.couple_id)
            .maybeSingle(),
          supabase
            .from("couple_music_reactions")
            .select("id, queue_item_id, user_id, emoji, created_at")
            .in(
              "queue_item_id",
              queue.map(item => item.id).length
                ? queue.map(item => item.id)
                : ["00000000-0000-0000-0000-000000000000"]
            ),
        ]);
      if (!active) return;
      setCurrentUserId(authData.user?.id ?? "");
      const nextDetails = (roomData ?? {
        cover_path: null,
        listen_at: null,
        reminder_note: null,
      }) as MusicRoomDetails;
      setDetails(nextDetails);
      setListenAtDraft(
        nextDetails.listen_at
          ? new Date(nextDetails.listen_at).toISOString().slice(0, 16)
          : ""
      );
      setReminderDraft(nextDetails.reminder_note ?? "");
      setReactions((reactionData ?? []) as MusicReaction[]);
      if (nextDetails.cover_path) {
        const { data } = await supabase.storage
          .from(MUSIC_COVER_BUCKET)
          .createSignedUrl(nextDetails.cover_path, 60 * 60);
        if (active) setCoverUrl(data?.signedUrl ?? null);
      } else {
        setCoverUrl(null);
      }
    }
    loadEnhancements();
    return () => {
      active = false;
    };
  }, [isPreview, musicRoom.couple_id, musicRoom.updated_at, queue]);

  useEffect(() => {
    if (isPreview || !supabase) return;
    const client = supabase;
    const channel = client
      .channel(`music-reactions:${musicRoom.couple_id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "couple_music_reactions",
          filter: `couple_id=eq.${musicRoom.couple_id}`,
        },
        payload => {
          if (payload.eventType === "DELETE") {
            const previous = payload.old as Pick<MusicReaction, "id">;
            setReactions(current =>
              current.filter(reaction => reaction.id !== previous.id)
            );
            return;
          }
          const incoming = payload.new as MusicReaction;
          if (!incoming.id) return;
          setReactions(current => [
            ...current.filter(reaction => reaction.id !== incoming.id),
            incoming,
          ]);
        }
      )
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [isPreview, musicRoom.couple_id]);

  async function handleCover(file: File | null) {
    if (!file) return;
    if (
      !ACCEPTED_PHOTO_TYPES.includes(file.type) ||
      file.size > MAX_PHOTO_BYTES
    ) {
      toast.error("Use uma imagem JPG, PNG ou WebP de até 5 MB.");
      return;
    }
    setBusy(true);
    if (isPreview) {
      setCoverUrl(URL.createObjectURL(file));
      setBusy(false);
      toast.success("Capa trocada nesta prévia.");
      return;
    }
    if (!supabase) {
      setBusy(false);
      return;
    }
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      setBusy(false);
      toast.error("Entre novamente para trocar a capa.");
      return;
    }
    const extension =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";
    const path = `${musicRoom.couple_id}/${authData.user.id}/cover-${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from(MUSIC_COVER_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      setBusy(false);
      toast.error("Não foi possível guardar a capa. Execute a migration 0010.");
      return;
    }
    const { error: updateError } = await supabase
      .from("couple_music_rooms")
      .update({ cover_path: path })
      .eq("couple_id", musicRoom.couple_id);
    if (updateError) {
      await supabase.storage.from(MUSIC_COVER_BUCKET).remove([path]);
      setBusy(false);
      toast.error("Não foi possível vincular a capa à sala.");
      return;
    }
    if (details.cover_path)
      await supabase.storage
        .from(MUSIC_COVER_BUCKET)
        .remove([details.cover_path]);
    const { data } = await supabase.storage
      .from(MUSIC_COVER_BUCKET)
      .createSignedUrl(path, 60 * 60);
    setDetails(current => ({ ...current, cover_path: path }));
    setCoverUrl(data?.signedUrl ?? null);
    setBusy(false);
    toast.success("Capa íntima guardada para vocês.");
  }

  async function handleReaction(
    queueItemId: string,
    emoji: MusicReaction["emoji"]
  ) {
    const existing = reactions.find(
      reaction =>
        reaction.queue_item_id === queueItemId &&
        reaction.user_id === currentUserId &&
        reaction.emoji === emoji
    );
    if (isPreview) {
      setReactions(current =>
        existing
          ? current.filter(reaction => reaction.id !== existing.id)
          : [
              ...current,
              {
                id: crypto.randomUUID(),
                queue_item_id: queueItemId,
                user_id: currentUserId,
                emoji,
                created_at: new Date().toISOString(),
              },
            ]
      );
      return;
    }
    if (!supabase || !currentUserId) return;
    if (existing) {
      const { error } = await supabase
        .from("couple_music_reactions")
        .delete()
        .eq("id", existing.id);
      if (error) {
        toast.error("Não foi possível retirar a reação.");
        return;
      }
      setReactions(current =>
        current.filter(reaction => reaction.id !== existing.id)
      );
    } else {
      const { data, error } = await supabase
        .from("couple_music_reactions")
        .insert({
          couple_id: musicRoom.couple_id,
          queue_item_id: queueItemId,
          user_id: currentUserId,
          emoji,
        })
        .select("id, queue_item_id, user_id, emoji, created_at")
        .single();
      if (error) {
        toast.error(
          "Não foi possível salvar a reação. Execute a migration 0010."
        );
        return;
      }
      setReactions(current => [...current, data as MusicReaction]);
    }
  }

  async function handleSaveReminder() {
    if (!listenAtDraft) {
      toast.error("Escolham uma data e um horário para a escuta.");
      return;
    }
    const listenAt = new Date(listenAtDraft).toISOString();
    setBusy(true);
    if (isPreview) {
      setDetails(current => ({
        ...current,
        listen_at: listenAt,
        reminder_note: reminderDraft.trim() || null,
      }));
      setBusy(false);
      toast.success("Encontro musical agendado nesta prévia.");
      return;
    }
    if (!supabase || !currentUserId) {
      setBusy(false);
      return;
    }
    const { error } = await supabase
      .from("couple_music_rooms")
      .update({
        listen_at: listenAt,
        reminder_note: reminderDraft.trim() || null,
        reminder_created_by: currentUserId,
        reminder_sent_at: null,
      })
      .eq("couple_id", musicRoom.couple_id);
    setBusy(false);
    if (error) {
      toast.error("Não foi possível agendar. Execute a migration 0010.");
      return;
    }
    setDetails(current => ({
      ...current,
      listen_at: listenAt,
      reminder_note: reminderDraft.trim() || null,
    }));
    toast.success("Lembrete de escuta guardado para vocês.");
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <article className="paper-note overflow-hidden rounded-[1.6rem] border border-ink/8 bg-white shadow-[0_12px_28px_rgba(103,65,72,0.05)]">
        <div className="relative aspect-[16/9] overflow-hidden bg-plum/90">
          {coverUrl ? (
            <img
              alt="Capa privada da Sala Spotify"
              className="h-full w-full object-cover"
              src={coverUrl}
            />
          ) : (
            <div className="flex h-full flex-col justify-end bg-[radial-gradient(circle_at_75%_15%,rgba(255,255,255,0.17),transparent_28%),linear-gradient(135deg,#4a2c3a,#c95767)] p-5 text-white">
              <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.2em] text-white/65">
                capa para duas
              </p>
              <p className="mt-2 max-w-[13rem] font-display text-3xl leading-[0.9] tracking-[-0.05em]">
                Uma foto de vocês nesta escuta.
              </p>
            </div>
          )}
          <label className="absolute bottom-3 right-3 inline-flex h-9 cursor-pointer items-center rounded-lg bg-white/92 px-3 text-xs font-extrabold text-hibiscus shadow-sm transition hover:bg-white">
            <Camera className="mr-1.5 h-3.5 w-3.5" />
            {busy ? "guardando" : "escolher foto"}
            <input
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={busy}
              onChange={event => handleCover(event.target.files?.[0] ?? null)}
              type="file"
            />
          </label>
        </div>
        <div className="p-4">
          <p className="text-sm leading-6 text-ink/55">
            A foto fica em um bucket privado e é acessível apenas por quem
            participa deste caderno.
          </p>
        </div>
        <WebPushConsent
          coupleId={musicRoom.couple_id}
          currentUserId={currentUserId}
          isPreview={isPreview}
        />
      </article>
      <article className="paper-note rounded-[1.6rem] border border-ink/8 bg-white p-5 shadow-[0_12px_28px_rgba(103,65,72,0.05)]">
        <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.17em] text-hibiscus">
          próxima escuta
        </p>
        <h3 className="mt-2 font-display text-3xl tracking-[-0.045em] text-ink">
          Marquem um instante.
        </h3>
        <p className="mt-1 text-sm leading-6 text-ink/54">
          Guardem o horário e um bilhete para abrir a sala juntas.
        </p>
        <div className="mt-4 grid gap-2">
          <Input
            className="h-10 rounded-lg border-ink/10 bg-paper px-3 text-sm focus-visible:ring-hibiscus"
            min={new Date().toISOString().slice(0, 16)}
            onChange={event => setListenAtDraft(event.target.value)}
            type="datetime-local"
            value={listenAtDraft}
          />
          <Input
            className="h-10 rounded-lg border-ink/10 bg-paper px-3 text-sm focus-visible:ring-hibiscus"
            maxLength={180}
            onChange={event => setReminderDraft(event.target.value)}
            placeholder="ex.: prepara a nossa música favorita"
            value={reminderDraft}
          />
          <Button
            className="h-10 rounded-lg bg-hibiscus text-xs font-extrabold text-white hover:bg-hibiscus/90"
            disabled={busy || !listenAtDraft}
            onClick={handleSaveReminder}
            type="button"
          >
            <Bell className="mr-1.5 h-3.5 w-3.5" />
            agendar lembrete
          </Button>
        </div>
        {details.listen_at && (
          <p className="mt-3 rounded-lg bg-hibiscus-soft px-3 py-2 text-xs leading-5 text-hibiscus">
            Próxima escuta:{" "}
            {new Date(details.listen_at).toLocaleString("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            })}
            .
          </p>
        )}
        <p className="mt-3 text-xs leading-5 text-ink/42">
          A entrega com a aba fechada é ativada depois da configuração de
          notificações do projeto.
        </p>
      </article>
      {queue.length > 0 && (
        <article className="paper-note rounded-[1.6rem] border border-ink/8 bg-white p-5 shadow-[0_12px_28px_rgba(103,65,72,0.05)] xl:col-span-2">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.17em] text-hibiscus">
                reações na fila
              </p>
              <h3 className="mt-2 font-display text-3xl tracking-[-0.045em] text-ink">
                O que essa música desperta?
              </h3>
            </div>
            <Heart className="h-5 w-5 text-hibiscus/60" />
          </div>
          <div className="mt-4 space-y-3">
            {queue.map(track => (
              <div
                className="flex flex-col gap-2 rounded-xl border border-ink/7 bg-paper/50 p-3 sm:flex-row sm:items-center sm:justify-between"
                key={track.id}
              >
                <p className="min-w-0 truncate text-sm font-extrabold text-ink">
                  {track.track_title}
                  <span className="font-normal text-ink/48">
                    {track.artist_name ? ` · ${track.artist_name}` : ""}
                  </span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {MUSIC_REACTION_EMOJIS.map(emoji => {
                    const count = reactions.filter(
                      reaction =>
                        reaction.queue_item_id === track.id &&
                        reaction.emoji === emoji
                    ).length;
                    const active = reactions.some(
                      reaction =>
                        reaction.queue_item_id === track.id &&
                        reaction.user_id === currentUserId &&
                        reaction.emoji === emoji
                    );
                    return (
                      <button
                        aria-label={`Reagir com ${emoji} à faixa ${track.track_title}`}
                        className={`rounded-full border px-2 py-1 text-xs transition ${active ? "border-hibiscus bg-hibiscus-soft shadow-sm" : "border-ink/10 bg-white hover:border-hibiscus/35"}`}
                        key={emoji}
                        onClick={() => handleReaction(track.id, emoji)}
                        type="button"
                      >
                        {emoji}
                        {count ? ` ${count}` : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </article>
      )}
    </section>
  );
}

function WidgetsPanel({
  batteryChargingDraft,
  batteryLevelDraft,
  batterySnapshots,
  busy,
  currentUserId,
  isPreview,
  onAnswerQuiz,
  onBatteryChargingChange,
  onBatteryLevelChange,
  onSaveWeatherCity,
  onShareBattery,
  onShareBatteryManually,
  onWeatherCityChange,
  quizAnswers,
  relationshipStartedOn,
  weatherSnapshot,
  weatherCityDraft,
}: {
  batteryChargingDraft: boolean;
  batteryLevelDraft: string;
  batterySnapshots: CoupleBatterySnapshot[];
  busy: "battery" | "weather" | null;
  currentUserId: string;
  isPreview: boolean;
  onAnswerQuiz: (
    quizKey: string,
    questionKey: string,
    answerValue: string
  ) => void;
  onBatteryChargingChange: (checked: boolean) => void;
  onBatteryLevelChange: (value: string) => void;
  onSaveWeatherCity: () => void;
  onShareBattery: () => void;
  onShareBatteryManually: () => void;
  onWeatherCityChange: (value: string) => void;
  quizAnswers: CoupleQuizAnswer[];
  relationshipStartedOn: string;
  weatherSnapshot: CoupleWeatherSnapshot | null;
  weatherCityDraft: string;
}) {
  const ownBattery = batterySnapshots.find(
    snapshot => snapshot.user_id === currentUserId
  );
  const partnerBattery = batterySnapshots.find(
    snapshot => snapshot.user_id !== currentUserId
  );
  const daysTogether = relationshipDays(relationshipStartedOn);
  const weather = weatherPresentation(weatherSnapshot?.weather_code ?? null);

  return (
    <div className="space-y-6">
      <section className="paper-memory chapter-thread relative overflow-hidden rounded-[1.85rem] border border-hibiscus/18 bg-[linear-gradient(125deg,#fdf9f5_0%,#fff8fa_55%,#f6ebe8_100%)] p-5 shadow-[0_18px_45px_rgba(103,65,72,0.08)] sm:p-8">
        <div className="absolute -right-12 -top-14 h-44 w-44 rounded-full border-[22px] border-hibiscus/10" />
        <div className="relative max-w-2xl">
          <p className="memory-marker">
            <Sparkles className="h-3.5 w-3.5" />
            pequenos sinais do dia
          </p>
          <h2 className="mt-3 font-display text-[2.25rem] leading-[0.95] tracking-[-0.055em] text-ink sm:text-5xl">
            Um pedacinho de vocês na tela.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-6 text-ink/58">
            Escolham o que faz sentido compartilhar: o tempo de história, um
            retrato da bateria e o clima da cidade que vocês quiserem chamar de
            casa.
          </p>
        </div>
      </section>

      <section className="grid gap-3 sm:gap-4 lg:grid-cols-3">
        <article className="paper-note relative overflow-hidden rounded-[1.55rem] border border-ink/8 bg-white p-4 sm:p-5 shadow-[0_12px_28px_rgba(103,65,72,0.05)]">
          <Heart className="absolute right-4 top-4 h-5 w-5 text-hibiscus/45" />
          <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.16em] text-hibiscus">
            dias juntos
          </p>
          <p className="mt-4 font-display text-5xl tracking-[-0.06em] text-ink">
            {daysTogether ?? "—"}
          </p>
          <p className="mt-1 text-sm font-bold text-ink/62">
            {daysTogether === 1 ? "dia de história" : "dias de história"}
          </p>
          <p className="mt-4 text-xs leading-5 text-ink/46">
            {relationshipStartedOn
              ? `Contando desde ${formatDate(`${relationshipStartedOn}T12:00:00`)}.`
              : "Escolham a data no botão de coração do topo para começar a contagem."}
          </p>
        </article>
        <article className="paper-note relative overflow-hidden rounded-[1.55rem] border border-ink/8 bg-white p-4 sm:p-5 shadow-[0_12px_28px_rgba(103,65,72,0.05)]">
          <BatteryCharging className="absolute right-4 top-4 h-5 w-5 text-sage" />
          <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.16em] text-sage">
            bateria, se quiser
          </p>
          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="font-display text-4xl tracking-[-0.06em] text-ink">
                {ownBattery ? `${ownBattery.level_percent}%` : "—"}
              </p>
              <p className="mt-1 text-xs font-bold text-ink/52">
                sua última partilha
              </p>
            </div>
            {partnerBattery && (
              <div className="rounded-xl bg-sage/10 px-3 py-2 text-right">
                <p className="text-sm font-extrabold text-sage">
                  {partnerBattery.level_percent}%{" "}
                  {partnerBattery.is_charging ? "· carregando" : ""}
                </p>
                <p className="mt-0.5 text-[0.62rem] font-bold text-ink/45">
                  do seu par
                </p>
              </div>
            )}
          </div>
          <Button
            className="mt-5 h-9 w-full rounded-lg border border-sage/25 bg-white text-xs font-extrabold text-sage hover:bg-sage hover:text-white"
            disabled={busy === "battery"}
            onClick={onShareBattery}
            type="button"
            variant="outline"
          >
            <BatteryCharging className="mr-1.5 h-3.5 w-3.5" />
            {busy === "battery" ? "lendo agora…" : "compartilhar agora"}
          </Button>
          <div className="mt-3 rounded-xl border border-sage/16 bg-sage/5 p-3">
            <p className="text-xs font-extrabold text-ink/70">
              Seu navegador não lê a bateria?
            </p>
            <p className="mt-1 text-xs leading-5 text-ink/48">
              Informe o nível mostrado no aparelho e compartilhe este retrato com
              seu par.
            </p>
            <div className="mt-2 flex gap-2">
              <Input
                aria-label="Percentual de bateria para compartilhar"
                className="h-9 min-w-0 rounded-lg border-sage/18 bg-white text-sm focus-visible:ring-sage"
                inputMode="numeric"
                max="100"
                min="0"
                onChange={event => onBatteryLevelChange(event.target.value)}
                placeholder="Ex.: 78"
                type="number"
                value={batteryLevelDraft}
              />
              <Button
                className="h-9 shrink-0 rounded-lg bg-sage px-3 text-xs font-extrabold text-white hover:bg-sage/90"
                disabled={busy === "battery" || !batteryLevelDraft.trim()}
                onClick={onShareBatteryManually}
                type="button"
              >
                enviar
              </Button>
            </div>
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs font-bold text-ink/58">
              <input
                checked={batteryChargingDraft}
                className="h-3.5 w-3.5 accent-sage"
                onChange={event => onBatteryChargingChange(event.target.checked)}
                type="checkbox"
              />
              está carregando
            </label>
          </div>
          <p className="mt-3 text-xs leading-5 text-ink/43">
            O retrato só é enviado quando você tocar em compartilhar; nunca é
            atualizado em segundo plano.
          </p>
        </article>
        <article className="paper-note relative overflow-hidden rounded-[1.55rem] border border-ink/8 bg-white p-4 sm:p-5 shadow-[0_12px_28px_rgba(103,65,72,0.05)]">
          <CloudSun className="absolute right-4 top-4 h-5 w-5 text-hibiscus" />
          <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.16em] text-hibiscus">
            clima escolhido
          </p>
          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="font-display text-4xl tracking-[-0.06em] text-ink">
                {weatherSnapshot?.temperature_c === null ||
                weatherSnapshot?.temperature_c === undefined
                  ? "—"
                  : `${Math.round(weatherSnapshot.temperature_c)}°`}
              </p>
              <p className="mt-1 text-xs font-bold text-ink/52">
                {weatherSnapshot
                  ? `${weather.icon} ${weather.label} · ${weatherSnapshot.city}`
                  : "Escolham uma cidade"}
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Input
              aria-label="Cidade do widget de clima"
              className="h-9 min-w-0 rounded-lg border-ink/10 bg-paper px-3 text-xs focus-visible:ring-hibiscus"
              maxLength={100}
              onChange={event => onWeatherCityChange(event.target.value)}
              placeholder="Cidade de vocês"
              value={weatherCityDraft}
            />
            <Button
              aria-label="Atualizar clima da cidade"
              className="h-9 shrink-0 rounded-lg bg-hibiscus px-3 text-white hover:bg-hibiscus/90"
              disabled={busy === "weather" || !weatherCityDraft.trim()}
              onClick={onSaveWeatherCity}
              type="button"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${busy === "weather" ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
          <p className="mt-3 text-xs leading-5 text-ink/43">
            A cidade é escrita por vocês; o app não pede a localização do
            aparelho.
          </p>
        </article>
      </section>

      <section className="paper-note rounded-[1.75rem] border border-ink/8 bg-white p-4 shadow-[0_12px_28px_rgba(103,65,72,0.05)] sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.16em] text-hibiscus">
              quizzes a dois
            </p>
            <h3 className="mt-2 font-display text-[2rem] leading-[0.96] tracking-[-0.055em] text-ink sm:text-4xl">
              Perguntas para descobrir de novo.
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/56">
              Sua resposta fica lacrada até a outra pessoa responder à mesma
              pergunta. Depois, comparem as escolhas e guardem a conversa boa.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-hibiscus-soft px-3 py-1.5 text-xs font-extrabold text-hibiscus">
            <Gamepad className="h-3.5 w-3.5" />9 perguntas
          </span>
        </div>
        <div className="mt-6 grid gap-4 sm:gap-5 lg:grid-cols-2">
          {COUPLE_QUIZZES.map(quiz => (
            <article
              className="rounded-[1.35rem] border border-ink/8 bg-paper/55 p-3.5 sm:p-5 last:lg:col-span-2"
              key={quiz.id}
            >
              <p className="text-[0.61rem] font-extrabold uppercase tracking-[0.15em] text-hibiscus">
                {quiz.eyebrow}
              </p>
              <h4 className="mt-2 font-display text-[1.45rem] leading-none tracking-[-0.045em] text-ink sm:text-2xl">
                {quiz.title}
              </h4>
              <p className="mt-2 text-xs leading-5 text-ink/52">
                {quiz.description}
              </p>
              <div className="mt-4 space-y-4">
                {quiz.questions.map(question => {
                  const answers = quizAnswers.filter(
                    answer =>
                      answer.quiz_key === quiz.id &&
                      answer.question_key === question.id
                  );
                  const ownAnswer = answers.find(
                    answer => answer.user_id === currentUserId
                  );
                  const partnerAnswer = answers.find(
                    answer => answer.user_id !== currentUserId
                  );
                  const revealed = Boolean(ownAnswer && partnerAnswer);
                  return (
                    <div
                      className="rounded-xl border border-ink/7 bg-white p-3"
                      key={question.id}
                    >
                      <p className="text-sm font-extrabold leading-5 text-ink">
                        {question.prompt}
                      </p>
                      <div className="mt-3 grid gap-1.5">
                        {question.options.map(option => (
                          <button
                            aria-pressed={ownAnswer?.answer_value === option}
                            className={`min-h-10 rounded-lg border px-3 py-2 text-left text-xs font-bold transition ${ownAnswer?.answer_value === option ? "border-hibiscus bg-hibiscus-soft text-hibiscus" : "border-ink/9 text-ink/60 hover:border-hibiscus/30 hover:text-hibiscus"}`}
                            disabled={Boolean(ownAnswer)}
                            key={option}
                            onClick={() =>
                              onAnswerQuiz(quiz.id, question.id, option)
                            }
                            type="button"
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                      {revealed ? (
                        <div className="mt-3 rounded-lg bg-sage/10 px-3 py-2 text-xs leading-5 text-sage">
                          <strong>Resposta revelada.</strong> Você:{" "}
                          {ownAnswer?.answer_value}. Seu par:{" "}
                          {partnerAnswer?.answer_value}.
                        </div>
                      ) : ownAnswer ? (
                        <p className="mt-3 rounded-lg bg-paper px-3 py-2 text-xs leading-5 text-ink/48">
                          Sua resposta está lacrada até a outra pessoa escolher.
                        </p>
                      ) : (
                        <p className="mt-3 text-xs leading-5 text-ink/42">
                          Escolham sem espiar a resposta da outra pessoa.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
        {isPreview && (
          <p className="mt-5 text-xs leading-5 text-ink/44">
            Na prévia, suas respostas ficam apenas nesta sessão. Em dados reais,
            cada resposta pertence somente ao casal.
          </p>
        )}
      </section>
    </div>
  );
}

function RightRailContent({
  activeTab,
  hasCouple,
  onInvite,
}: {
  activeTab: AppTab;
  hasCouple: boolean;
  onInvite: () => void;
}) {
  return (
    <aside className="hidden space-y-4 xl:block">
      <section className="paper-note relative overflow-hidden rounded-[1.5rem] border border-ink/8 bg-white p-5 shadow-[0_12px_30px_rgba(103,65,72,0.05)]">
        <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.17em] text-ink/42">
          o vínculo de vocês
        </p>
        <div className="mt-5 flex items-center gap-2">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-hibiscus text-sm font-extrabold text-white">
            V
          </span>
          <span className="relative h-px flex-1 bg-hibiscus/35 before:absolute before:left-1/2 before:top-1/2 before:h-2 before:w-2 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:bg-hibiscus" />
          <span className="grid h-11 w-11 place-items-center rounded-full bg-plum text-sm font-extrabold text-white">
            +
          </span>
        </div>
        <p className="mt-4 text-sm leading-6 text-ink/56">
          {hasCouple
            ? "O caderno de vocês já está completo."
            : "Convide a outra pessoa quando estiver pronto para começar a memória a dois."}
        </p>
        {!hasCouple && (
          <Button
            className="mt-4 h-9 w-full rounded-lg border border-hibiscus/25 bg-hibiscus-soft text-xs font-extrabold text-hibiscus hover:bg-hibiscus hover:text-white"
            onClick={onInvite}
            type="button"
            variant="outline"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            convidar alguém
          </Button>
        )}
      </section>
      <section className="relative min-h-[220px] overflow-hidden rounded-[1.5rem] bg-plum p-5 text-white shadow-[0_15px_35px_rgba(55,35,42,0.16)]">
        <img
          alt="Itens de planejamento sobre um mapa"
          className="absolute inset-0 h-full w-full object-cover opacity-40"
          src={ASSETS.plans}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(55,35,42,0.2),rgba(55,35,42,0.94))]" />
        <div className="relative z-10 flex h-full min-h-[180px] flex-col justify-end">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-white/60">
            próximo capítulo
          </p>
          <p className="mt-2 font-display text-3xl leading-[0.92] tracking-[-0.05em]">
            {activeTab === "planos"
              ? "Uma ideia já basta para começar."
              : "Escolham algo para esperar juntos."}
          </p>
        </div>
      </section>
      <section className="paper-note relative overflow-hidden rounded-[1.4rem] bg-white/65 px-5 py-4">
        <div className="flex items-center gap-2 text-xs font-extrabold text-ink/56">
          <Check className="h-4 w-4 text-sage" />
          privado por padrão
        </div>
        <p className="mt-2 text-xs leading-5 text-ink/45">
          O conteúdo é organizado por casal e protegido pelas regras do banco.
        </p>
      </section>
    </aside>
  );
}

function RightRail(props: {
  activeTab: AppTab;
  hasCouple: boolean;
  onInvite: () => void;
}) {
  return (
    <>
      <FloatingPanelsPortal />
      <RightRailContent {...props} />
    </>
  );
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<
    string | null
  >(null);
  const [isPreview, setIsPreview] = useState(
    () => new URLSearchParams(window.location.search).get("preview") === "1"
  );
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("Você");
  const [tab, setTab] = useState<AppTab>(() =>
    getInitialAppTab(window.location.search)
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] =
    useState<DeferredInstallPrompt | null>(null);
  const floatingPanelsRoot = useRef<{
    render: (content: ReactNode) => void;
  } | null>(null);
  const locationWatchRef = useRef<number | null>(null);
  const locationPermissionPromptedRef = useRef(false);
  const quizAnswersRlsBlockedRef = useRef(false);
  const proximityWatchRef = useRef<number | null>(null);
  const lastLocationWriteRef = useRef(0);
  const [posts, setPosts] = useState<Post[]>([]);
  const [libraryItems, setLibraryItems] = useState<CoupleLibraryItem[]>([]);
  const [libraryTitleDraft, setLibraryTitleDraft] = useState("");
  const [libraryCreatorDraft, setLibraryCreatorDraft] = useState("");
  const [libraryNotesDraft, setLibraryNotesDraft] = useState("");
  const [libraryReleaseDraft, setLibraryReleaseDraft] = useState("");
  const [savingLibrary, setSavingLibrary] = useState(false);
  const [widgetMomentId, setWidgetMomentId] = useState<string | null>(() =>
    window.localStorage.getItem("appcasal:moment-widget")
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [ritualsOpen, setRitualsOpen] = useState(false);
  const [proximityOpen, setProximityOpen] = useState(false);
  const [locations, setLocations] = useState<CoupleLocation[]>([]);
  const [locationBusy, setLocationBusy] = useState(false);
  const [favoritePlaces, setFavoritePlaces] = useState<FavoritePlace[]>([]);
  const [proximityPreferences, setProximityPreferences] = useState<
    PlaceProximityPreference[]
  >([]);
  const [savingProximityPlaceId, setSavingProximityPlaceId] = useState<
    string | null
  >(null);
  const [coupleMembers, setCoupleMembers] = useState<CoupleMember[]>([]);
  const [placeTitle, setPlaceTitle] = useState("");
  const [placeAddress, setPlaceAddress] = useState("");
  const [placeMeaning, setPlaceMeaning] = useState("");
  const [placeCategory, setPlaceCategory] =
    useState<PlaceCategory>("favoritos");
  const [editingPlaceId, setEditingPlaceId] = useState<string | null>(null);
  const [placeFilter, setPlaceFilter] = useState<PlaceCategory | "todos">(
    "todos"
  );
  const [placeCoordinates, setPlaceCoordinates] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [savingPlace, setSavingPlace] = useState(false);
  const [addressBusy, setAddressBusy] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [relationshipStartedOn, setRelationshipStartedOn] = useState("");
  const [dailyMoods, setDailyMoods] = useState<DailyMood[]>([]);
  const [sharedWishes, setSharedWishes] = useState<SharedWish[]>([]);
  const [giftWishes, setGiftWishes] = useState<GiftWish[]>([]);
  const [wishDraft, setWishDraft] = useState("");
  const [giftTitle, setGiftTitle] = useState("");
  const [giftOccasion, setGiftOccasion] = useState("");
  const [giftNotes, setGiftNotes] = useState("");
  const [giftUrl, setGiftUrl] = useState("");
  const [savingRitual, setSavingRitual] = useState(false);
  const [postDraft, setPostDraft] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [planTitle, setPlanTitle] = useState("");
  const [planDetails, setPlanDetails] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | undefined>();
  const [posting, setPosting] = useState(false);
  const [sending, setSending] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [musicRoom, setMusicRoom] = useState<CoupleMusicRoom | null>(null);
  const [musicQueue, setMusicQueue] = useState<MusicQueueItem[]>([]);
  const [musicRoomTitle, setMusicRoomTitle] = useState("");
  const [jamDraft, setJamDraft] = useState("");
  const [trackTitle, setTrackTitle] = useState("");
  const [trackArtist, setTrackArtist] = useState("");
  const [trackUrl, setTrackUrl] = useState("");
  const [trackNote, setTrackNote] = useState("");
  const [savingMusic, setSavingMusic] = useState(false);
  const [spotifyLinking, setSpotifyLinking] = useState(false);
  const [spotifyPlaylistCreating, setSpotifyPlaylistCreating] = useState(false);
  const [spotifyReturnConfirmedForUserId, setSpotifyReturnConfirmedForUserId] =
    useState("");
  const [batterySnapshots, setBatterySnapshots] = useState<
    CoupleBatterySnapshot[]
  >([]);
  const [batteryLevelDraft, setBatteryLevelDraft] = useState("");
  const [batteryChargingDraft, setBatteryChargingDraft] = useState(false);
  const [weatherSnapshot, setWeatherSnapshot] =
    useState<CoupleWeatherSnapshot | null>(null);
  const [weatherCityDraft, setWeatherCityDraft] = useState("");
  const [quizAnswers, setQuizAnswers] = useState<CoupleQuizAnswer[]>([]);
  const [widgetBusy, setWidgetBusy] = useState<"battery" | "weather" | null>(
    null
  );
  const [inviteCode, setInviteCode] = useState("");
  const [acceptCode, setAcceptCode] = useState(
    () => new URLSearchParams(window.location.search).get("invite") ?? ""
  );
  const [inviteBusy, setInviteBusy] = useState(false);
  const [acceptBusy, setAcceptBusy] = useState(false);
  const proximityAlertedAtRef = useRef<Record<string, number>>({});
  const deleteAccountMutation = trpc.account.delete.useMutation();
  const spotifyPlaylistAuthorizationMutation =
    trpc.spotify.createPlaylistAuthorization.useMutation();

  const currentUserId = useMemo(
    () => (isPreview ? "preview-user" : (session?.user.id ?? "")),
    [isPreview, session?.user.id]
  );
  const spotifyIdentity = useMemo(
    () =>
      session?.user.identities?.find(
        identity => identity.provider === "spotify"
      ) ?? null,
    [session?.user.identities]
  );
  const spotifyName =
    typeof spotifyIdentity?.identity_data?.full_name === "string"
      ? spotifyIdentity.identity_data.full_name
      : typeof spotifyIdentity?.identity_data?.name === "string"
        ? spotifyIdentity.identity_data.name
        : null;
  const spotifyConnected =
    Boolean(spotifyIdentity) || spotifyReturnConfirmedForUserId === currentUserId;
  const hasWorkspace = isPreview || Boolean(session);
  const hasDatabaseAccess = Boolean(session && coupleId && supabase);
  const hasCompleteCouple = isPreview ? false : coupleMembers.length >= 2;
  const unreadCount = notifications.filter(
    notification => !notification.read_at
  ).length;

  async function refreshProfile(activeSession: Session | null) {
    if (!activeSession || !supabase) {
      setCoupleId(null);
      return;
    }
    const client = supabase;
    const fallbackName =
      activeSession.user.user_metadata?.display_name ??
      activeSession.user.user_metadata?.name ??
      activeSession.user.email?.split("@")[0] ??
      "Você";
    setProfileName(fallbackName);
    const [{ data: membership }, { data: profile }] = await Promise.all([
      client
        .from("couple_members")
        .select("couple_id")
        .eq("user_id", activeSession.user.id)
        .maybeSingle(),
      client
        .from("profiles")
        .select("name")
        .eq("id", activeSession.user.id)
        .maybeSingle(),
    ]);
    setCoupleId(membership?.couple_id ?? null);
    if (profile?.name) setProfileName(profile.name);
  }

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    client.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = client.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        if (nextSession) setPendingConfirmationEmail(null);
      }
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function captureInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredInstallPrompt(event as DeferredInstallPrompt);
    }

    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
    };
  }, []);

  useEffect(() => {
    refreshProfile(session);
  }, [session]);

  useEffect(() => {
    if (session && acceptCode) setTab("mais");
  }, [acceptCode, session]);

  useEffect(() => {
    if (isPreview || !supabase || !session) {
      if (!isPreview) setInviteCode("");
      return;
    }

    const client = supabase;
    const currentSession = session;
    let cancelled = false;
    async function restorePendingInvite() {
      const { data, error } = await client
        .from("partner_invites")
        .select("code")
        .eq("invited_by", currentSession.user.id)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled || error) return;
      setInviteCode(data?.code ?? "");
    }

    void restorePendingInvite();
    return () => {
      cancelled = true;
    };
  }, [isPreview, session?.user.id]);

  useEffect(() => {
    if (isPreview || !session || typeof window === "undefined") {
      setSpotifyReturnConfirmedForUserId("");
      return;
    }
    const userId = session.user.id;
    setSpotifyReturnConfirmedForUserId(
      window.localStorage.getItem(spotifyConnectionStorageKey(userId)) === "linked"
        ? userId
        : ""
    );
  }, [isPreview, session?.user.id]);

  useEffect(() => {
    if (isPreview || !supabase || !session || typeof window === "undefined") {
      return;
    }
    const hasReturnQuery =
      new URLSearchParams(window.location.search).get("spotify_return") === "1";
    const hasPendingLink =
      window.sessionStorage.getItem(SPOTIFY_LINK_RETURN_KEY) === "pending";
    if (!hasReturnQuery && !hasPendingLink) return;
    const client = supabase;
    const currentSession = session;

    let cancelled = false;
    let retryTimer: number | undefined;

    async function reconcileSpotifyIdentity(attempt: number) {
      const { data: refreshed } = await client.auth.refreshSession();
      const activeSession = refreshed.session ?? currentSession;
      const { data: identityData, error: identitiesError } =
        await client.auth.getUserIdentities();
      if (cancelled) return;

      const identities =
        identityData?.identities ?? activeSession.user.identities ?? [];
      const spotifyWasLinked = identities.some(
        identity => identity.provider === "spotify"
      );

      if (!identitiesError) {
        setSession({
          ...activeSession,
          user: { ...activeSession.user, identities },
        });
      }

      // A atualização da identidade pode levar alguns instantes para ser
      // refletida no endpoint do Auth após o retorno externo do Spotify.
      if (!spotifyWasLinked && attempt < 2) {
        retryTimer = window.setTimeout(() => {
          void reconcileSpotifyIdentity(attempt + 1);
        }, 700);
        return;
      }

      window.sessionStorage.removeItem(SPOTIFY_LINK_RETURN_KEY);
      setSpotifyLinking(false);
      if (hasReturnQuery) {
        window.history.replaceState({}, "", PUBLIC_APP_ORIGIN);
      }
      const confirmedReturn = hasReturnQuery && hasPendingLink;
      if (spotifyWasLinked || confirmedReturn) {
        if (spotifyWasLinked || confirmedReturn) {
          window.localStorage.setItem(
            spotifyConnectionStorageKey(currentSession.user.id),
            "linked"
          );
          setSpotifyReturnConfirmedForUserId(currentSession.user.id);
        }
        setTab("musica");
        toast.success("Spotify conectado. Abrindo a playlist de vocês.");
        window.setTimeout(() => {
          if (!cancelled) {
            window.location.assign(getSpotifyContinuationUrl(musicRoom?.jam_url));
          }
        }, 500);
      } else {
        toast.error(
          "A autorização do Spotify não foi confirmada. Tente conectar novamente."
        );
      }
    }

    void reconcileSpotifyIdentity(0);
    return () => {
      cancelled = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [isPreview, musicRoom?.jam_url, session?.user.id, supabase]);

  useEffect(() => {
    if (!hasDatabaseAccess || !supabase || !coupleId || !session) {
      setNotifications([]);
      setLocations([]);
      setFavoritePlaces([]);
      setProximityPreferences(
        isPreview ? readProximityPreferences(currentUserId) : []
      );
      setCoupleMembers([]);
      setMusicRoom(null);
      setMusicQueue([]);
      setJamDraft("");
      setLibraryItems([]);
      setBatterySnapshots([]);
      setWeatherSnapshot(null);
      setQuizAnswers([]);
      return;
    }
    const client = supabase;
    const recipientId = session.user.id;
    async function loadContent() {
      const favoritePlacesQuery = client
        .from("favorite_places")
        .select(
          "id, created_by, title, address, meaning, category, latitude, longitude, created_at"
        )
        .eq("couple_id", coupleId)
        .order("created_at", { ascending: false })
        .limit(40)
        .then(async result => {
          if (
            result.error &&
            (result.error.code === "42703" || result.status === 400)
          ) {
            return client
              .from("favorite_places")
              .select(
                "id, created_by, title, meaning, category, latitude, longitude, created_at"
              )
              .eq("couple_id", coupleId)
              .order("created_at", { ascending: false })
              .limit(40);
          }
          return result;
        });
      const [
        { data: postData, error: postError },
        { data: messageData, error: messageError },
        { data: planData, error: planError },
        { data: notificationData, error: notificationError },
        { data: settingsData, error: settingsError },
        { data: moodData, error: moodError },
        { data: wishData, error: wishError },
        { data: giftData, error: giftError },
        { data: locationData, error: locationError },
        { data: placeData, error: placeError },
        { data: proximityData, error: proximityError },
        { data: memberData, error: memberError },
        { data: musicRoomData },
        { data: musicQueueData },
        { data: batteryData, error: batteryError },
        { data: weatherData, error: weatherError },
        { data: quizData, error: quizError },
        { data: libraryData, error: libraryError },
      ] = await Promise.all([
        client
          .from("posts")
          .select(
            "id, content, created_at, author_id, image_path, profiles(name)"
          )
          .eq("couple_id", coupleId)
          .order("created_at", { ascending: false }),
        client
          .from("messages")
          .select("id, text, created_at, sender_id, sender_name")
          .eq("couple_id", coupleId)
          .order("created_at", { ascending: true }),
        client
          .from("plans")
          .select("id, title, details, scheduled_for, completed, created_by")
          .eq("couple_id", coupleId)
          .order("scheduled_for", { ascending: true }),
        client
          .from("notifications")
          .select(
            "id, kind, title, body, plan_id, read_at, created_at, actor_id"
          )
          .eq("recipient_id", recipientId)
          .order("created_at", { ascending: false })
          .limit(20),
        client
          .from("couple_settings")
          .select("relationship_started_on")
          .eq("couple_id", coupleId)
          .maybeSingle(),
        client
          .from("daily_moods")
          .select("id, author_id, mood, mood_date")
          .eq("couple_id", coupleId)
          .eq("mood_date", toDateKey(new Date())),
        client
          .from("shared_wishes")
          .select("id, author_id, content, fulfilled_at, created_at")
          .eq("couple_id", coupleId)
          .order("created_at", { ascending: false })
          .limit(30),
        client
          .from("gift_wishes")
          .select(
            "id, wished_by, title, occasion, notes, reference_url, created_at"
          )
          .eq("couple_id", coupleId)
          .order("created_at", { ascending: false })
          .limit(30),
        client
          .from("couple_locations")
          .select(
            "couple_id, user_id, sharing_enabled, latitude, longitude, accuracy_meters, updated_at"
          )
          .eq("couple_id", coupleId),
        favoritePlacesQuery,
        client
          .from("place_proximity_preferences")
          .select(
            "place_id, user_id, is_enabled, radius_meters, custom_message, updated_at"
          )
          .eq("user_id", recipientId),
        client
          .from("couple_members")
          .select("user_id, profiles(name, avatar_path)")
          .eq("couple_id", coupleId),
        client
          .from("couple_music_rooms")
          .select(
            "couple_id, host_id, title, jam_url, is_active, started_at, updated_at"
          )
          .eq("couple_id", coupleId)
          .maybeSingle(),
        client
          .from("couple_music_queue")
          .select(
            "id, couple_id, added_by, track_url, track_title, artist_name, note, created_at"
          )
          .eq("couple_id", coupleId)
          .order("created_at", { ascending: true })
          .limit(40),
        client
          .from("couple_widget_battery_snapshots")
          .select("couple_id, user_id, level_percent, is_charging, updated_at")
          .eq("couple_id", coupleId),
        client
          .from("couple_widget_weather")
          .select(
            "couple_id, city, latitude, longitude, temperature_c, weather_code, observed_at, updated_at"
          )
          .eq("couple_id", coupleId)
          .maybeSingle(),
        quizAnswersRlsBlockedRef.current
          ? Promise.resolve({ data: [], error: null })
          : client
              .from("couple_quiz_answers")
              .select(
                "couple_id, quiz_key, question_key, user_id, answer_value, created_at, updated_at"
              )
              .eq("couple_id", coupleId),
        client
          .from("couple_library_items")
          .select(
            "id, couple_id, author_id, item_type, title, creator, notes, status, release_on, created_at, updated_at"
          )
          .eq("couple_id", coupleId)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      if (quizError?.code === "42P17") {
        quizAnswersRlsBlockedRef.current = true;
      }
      const unavailablePrivateAreas = [
        postError && "memórias",
        messageError && "conversas",
        planError && "planos",
        notificationError && "avisos",
        settingsError && "tempo juntos",
        moodError && "humores",
        wishError && "desejos",
        giftError && "presentes",
        locationError && "localização",
        placeError && "mapa afetivo",
        proximityError && "proximidade",
        memberError && "perfis do casal",
        batteryError && "bateria",
        weatherError && "clima",
        quizError && "quizzes",
        libraryError && "biblioteca",
      ].filter(Boolean);

      // Uma tabela opcional indisponível (por exemplo, após uma atualização de
      // schema) não deve impedir que o restante do caderno privado seja aberto.
      // Não mostramos detalhes de API nem o nome das áreas para proteger a
      // privacidade da pessoa em produção.
      if (unavailablePrivateAreas.length > 0 && import.meta.env.DEV) {
        console.warn("Algumas áreas privadas não puderam ser atualizadas.");
      }
      const hydratedPosts = await Promise.all(
        ((postData ?? []) as DatabasePost[]).map(async row =>
          mapPost(row, await signedPhotoUrl(row.image_path))
        )
      );
      setPosts(hydratedPosts);
      setMessages(((messageData ?? []) as DatabaseMessage[]).map(mapMessage));
      setPlans(((planData ?? []) as DatabasePlan[]).map(mapPlan));
      setNotifications((notificationData ?? []) as AppNotification[]);
      setRelationshipStartedOn(settingsData?.relationship_started_on ?? "");
      setDailyMoods((moodData ?? []) as DailyMood[]);
      setSharedWishes((wishData ?? []) as SharedWish[]);
      setGiftWishes((giftData ?? []) as GiftWish[]);
      setLocations((locationData ?? []) as CoupleLocation[]);
      setFavoritePlaces((placeData ?? []) as FavoritePlace[]);
      setProximityPreferences(
        (proximityData ?? []) as PlaceProximityPreference[]
      );
      const nextMusicRoom = (musicRoomData ?? null) as CoupleMusicRoom | null;
      setMusicRoom(nextMusicRoom);
      setJamDraft(nextMusicRoom?.jam_url ?? "");
      setMusicQueue((musicQueueData ?? []) as MusicQueueItem[]);
      setBatterySnapshots((batteryData ?? []) as CoupleBatterySnapshot[]);
      setWeatherSnapshot((weatherData ?? null) as CoupleWeatherSnapshot | null);
      setQuizAnswers((quizData ?? []) as CoupleQuizAnswer[]);
      setLibraryItems(
        libraryError ? [] : ((libraryData ?? []) as CoupleLibraryItem[])
      );
      const hydratedMembers = await Promise.all(
        (
          (memberData ?? []) as {
            user_id: string;
            profiles?:
              | { name?: string | null; avatar_path?: string | null }
              | { name?: string | null; avatar_path?: string | null }[]
              | null;
          }[]
        ).map(async member => {
          const profile = Array.isArray(member.profiles)
            ? member.profiles[0]
            : member.profiles;
          return {
            user_id: member.user_id,
            name: profile?.name ?? "Seu par",
            avatar_path: profile?.avatar_path ?? null,
            avatar_url: await signedAvatarUrl(profile?.avatar_path),
          };
        })
      );
      setCoupleMembers(hydratedMembers);
    }
    loadContent();
  }, [coupleId, hasDatabaseAccess, session]);

  useEffect(() => {
    if (
      !session ||
      !("Notification" in window) ||
      Notification.permission !== "default"
    )
      return;
    Notification.requestPermission().catch(() => undefined);
  }, [session]);

  useEffect(() => {
    if (!hasDatabaseAccess || !supabase || !coupleId || !session) return;
    const client = supabase;
    const channel = client
      .channel(`appcasal-web-realtime:${coupleId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `couple_id=eq.${coupleId}`,
        },
        payload => {
          const incoming = mapMessage(payload.new as DatabaseMessage);
          setMessages(current =>
            current.some(message => message.id === incoming.id)
              ? current
              : [...current, incoming]
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "plans",
          filter: `couple_id=eq.${coupleId}`,
        },
        payload => {
          const incoming = mapPlan(payload.new as DatabasePlan);
          setPlans(current =>
            current.some(plan => plan.id === incoming.id)
              ? current
              : [...current, incoming].sort((a, b) =>
                  a.scheduled_for.localeCompare(b.scheduled_for)
                )
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "plans",
          filter: `couple_id=eq.${coupleId}`,
        },
        payload => {
          const incoming = mapPlan(payload.new as DatabasePlan);
          setPlans(current =>
            current.map(plan => (plan.id === incoming.id ? incoming : plan))
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${session.user.id}`,
        },
        payload => {
          const incoming = payload.new as AppNotification;
          setNotifications(current =>
            current.some(notification => notification.id === incoming.id)
              ? current
              : [incoming, ...current].slice(0, 20)
          );
          toast.success(incoming.title, { description: incoming.body });
          if (
            "Notification" in window &&
            Notification.permission === "granted" &&
            document.hidden
          ) {
            try {
              new Notification(incoming.title, {
                body: incoming.body,
                icon: ASSETS.logo,
                tag: incoming.id,
              });
            } catch {
              /* O toast continua disponível quando o navegador bloqueia a notificação. */
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "couple_settings",
          filter: `couple_id=eq.${coupleId}`,
        },
        payload => {
          const incoming = payload.new as {
            relationship_started_on?: string | null;
          };
          setRelationshipStartedOn(incoming.relationship_started_on ?? "");
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "daily_moods",
          filter: `couple_id=eq.${coupleId}`,
        },
        payload => {
          const incoming = payload.new as DailyMood;
          if (!incoming.id) return;
          setDailyMoods(current => [
            ...current.filter(
              item =>
                item.id !== incoming.id &&
                !(
                  item.author_id === incoming.author_id &&
                  item.mood_date === incoming.mood_date
                )
            ),
            incoming,
          ]);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "shared_wishes",
          filter: `couple_id=eq.${coupleId}`,
        },
        payload => {
          const incoming = payload.new as SharedWish;
          setSharedWishes(current =>
            current.some(wish => wish.id === incoming.id)
              ? current
              : [incoming, ...current].slice(0, 30)
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "gift_wishes",
          filter: `couple_id=eq.${coupleId}`,
        },
        payload => {
          const incoming = payload.new as GiftWish;
          setGiftWishes(current =>
            current.some(gift => gift.id === incoming.id)
              ? current
              : [incoming, ...current].slice(0, 30)
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "couple_locations",
          filter: `couple_id=eq.${coupleId}`,
        },
        payload => {
          if (payload.eventType === "DELETE") {
            const previous = payload.old as Pick<CoupleLocation, "user_id">;
            setLocations(current =>
              current.filter(location => location.user_id !== previous.user_id)
            );
            return;
          }
          const incoming = payload.new as CoupleLocation;
          if (!incoming.user_id) return;
          setLocations(current => [
            ...current.filter(
              location => location.user_id !== incoming.user_id
            ),
            incoming,
          ]);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "favorite_places",
          filter: `couple_id=eq.${coupleId}`,
        },
        payload => {
          if (payload.eventType === "DELETE") {
            const previous = payload.old as Pick<FavoritePlace, "id">;
            setFavoritePlaces(current =>
              current.filter(place => place.id !== previous.id)
            );
            return;
          }
          const incoming = payload.new as FavoritePlace;
          if (!incoming.id) return;
          setFavoritePlaces(current =>
            [
              incoming,
              ...current.filter(place => place.id !== incoming.id),
            ].slice(0, 40)
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "place_proximity_preferences",
          filter: `user_id=eq.${session.user.id}`,
        },
        payload => {
          if (payload.eventType === "DELETE") {
            const previous = payload.old as Pick<
              PlaceProximityPreference,
              "place_id"
            >;
            setProximityPreferences(current =>
              current.filter(
                preference => preference.place_id !== previous.place_id
              )
            );
            return;
          }
          const incoming = payload.new as PlaceProximityPreference;
          if (!incoming.place_id) return;
          setProximityPreferences(current => [
            incoming,
            ...current.filter(
              preference => preference.place_id !== incoming.place_id
            ),
          ]);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "couple_music_rooms",
          filter: `couple_id=eq.${coupleId}`,
        },
        payload => {
          if (payload.eventType === "DELETE") {
            setMusicRoom(null);
            setJamDraft("");
            return;
          }
          const incoming = payload.new as CoupleMusicRoom;
          if (!incoming.couple_id) return;
          setMusicRoom(incoming);
          setJamDraft(incoming.jam_url ?? "");
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "couple_music_queue",
          filter: `couple_id=eq.${coupleId}`,
        },
        payload => {
          if (payload.eventType === "DELETE") {
            const previous = payload.old as Pick<MusicQueueItem, "id">;
            setMusicQueue(current =>
              current.filter(item => item.id !== previous.id)
            );
            return;
          }
          const incoming = payload.new as MusicQueueItem;
          if (!incoming.id) return;
          setMusicQueue(current =>
            [...current.filter(item => item.id !== incoming.id), incoming]
              .sort((a, b) => a.created_at.localeCompare(b.created_at))
              .slice(0, 40)
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "couple_widget_battery_snapshots",
          filter: `couple_id=eq.${coupleId}`,
        },
        payload => {
          if (payload.eventType === "DELETE") {
            const previous = payload.old as Pick<
              CoupleBatterySnapshot,
              "user_id"
            >;
            setBatterySnapshots(current =>
              current.filter(snapshot => snapshot.user_id !== previous.user_id)
            );
            return;
          }
          const incoming = payload.new as CoupleBatterySnapshot;
          if (!incoming.user_id) return;
          setBatterySnapshots(current => [
            incoming,
            ...current.filter(
              snapshot => snapshot.user_id !== incoming.user_id
            ),
          ]);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "couple_widget_weather",
          filter: `couple_id=eq.${coupleId}`,
        },
        payload => {
          if (payload.eventType !== "DELETE")
            setWeatherSnapshot(payload.new as CoupleWeatherSnapshot);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "couple_quiz_answers",
          filter: `couple_id=eq.${coupleId}`,
        },
        payload => {
          if (payload.eventType === "DELETE") {
            const previous = payload.old as Pick<
              CoupleQuizAnswer,
              "quiz_key" | "question_key" | "user_id"
            >;
            setQuizAnswers(current =>
              current.filter(
                answer =>
                  !(
                    answer.quiz_key === previous.quiz_key &&
                    answer.question_key === previous.question_key &&
                    answer.user_id === previous.user_id
                  )
              )
            );
            return;
          }
          const incoming = payload.new as CoupleQuizAnswer;
          if (!incoming.user_id) return;
          setQuizAnswers(current => [
            incoming,
            ...current.filter(
              answer =>
                !(
                  answer.quiz_key === incoming.quiz_key &&
                  answer.question_key === incoming.question_key &&
                  answer.user_id === incoming.user_id
                )
            ),
          ]);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "couple_library_items",
          filter: `couple_id=eq.${coupleId}`,
        },
        payload => {
          if (payload.eventType === "DELETE") {
            const previous = payload.old as Pick<CoupleLibraryItem, "id">;
            setLibraryItems(current =>
              current.filter(item => item.id !== previous.id)
            );
            return;
          }
          const incoming = payload.new as CoupleLibraryItem;
          if (!incoming.id) return;
          setLibraryItems(current =>
            [incoming, ...current.filter(item => item.id !== incoming.id)]
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .slice(0, 100)
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        payload => {
          const incoming = payload.new as {
            id?: string;
            name?: string | null;
            avatar_path?: string | null;
          };
          if (!incoming.id) return;
          void (async () => {
            const avatarUrl = await signedAvatarUrl(incoming.avatar_path);
            setCoupleMembers(current =>
              current.map(member =>
                member.user_id === incoming.id
                  ? {
                      ...member,
                      name: incoming.name ?? member.name,
                      avatar_path: incoming.avatar_path ?? null,
                      avatar_url: avatarUrl,
                    }
                  : member
              )
            );
          })();
        }
      )
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [coupleId, hasDatabaseAccess, session]);

  useEffect(
    () => () => {
      if (photoPreview?.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
    },
    [photoPreview]
  );

  useEffect(
    () => () => {
      clearLocationWatch();
    },
    []
  );

  useEffect(() => {
    if (!hasWorkspace) clearLocationWatch();
  }, [hasWorkspace]);

  function clearPhoto() {
    setSelectedPhoto(null);
    setPhotoPreview(undefined);
  }

  function handlePhotoChange(file: File | null) {
    if (!file) return;
    if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) {
      toast.error("Escolha uma foto JPG, PNG ou WebP.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("A foto deve ter no máximo 5 MB.");
      return;
    }
    clearPhoto();
    setSelectedPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleAuth(
    mode: "login" | "signup",
    email: string,
    password: string,
    name: string
  ) {
    if (!supabase) {
      toast.error(
        "Configure as variáveis públicas do Supabase para entrar com uma conta real."
      );
      return;
    }
    if (!email || !password || (mode === "signup" && !name.trim())) {
      toast.error("Preencha os campos para continuar.");
      return;
    }
    const { data, error } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { display_name: name.trim(), name: name.trim() },
              emailRedirectTo: PUBLIC_APP_ORIGIN,
            },
          });
    if (error) {
      toast.error(error.message);
      return;
    }
    if (mode === "signup") {
      setTab("inicio");
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.delete("tab");
      window.history.replaceState(
        {},
        "",
        `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`
      );
      if (getSignupDestination(data.session) === "workspace") {
        if (!data.session) return;
        setSession(data.session);
        toast.success("Conta criada. Bem-vinda ao início do caderno de vocês.");
      } else {
        setPendingConfirmationEmail(email);
        toast.success("Conta criada. Confirme o e-mail para abrir o caderno.");
      }
    }
  }

  async function handlePost() {
    const content = postDraft.trim();
    if (!content && !selectedPhoto) return;
    setPosting(true);
    if (isPreview) {
      setPosts(current => [
        {
          id: crypto.randomUUID(),
          content,
          created_at: new Date().toISOString(),
          author_id: currentUserId,
          author_name: "Você",
          image_url: photoPreview,
        },
        ...current,
      ]);
      setPostDraft("");
      clearPhoto();
      setPosting(false);
      toast.success("Memória guardada na prévia.");
      return;
    }
    if (!supabase || !session || !coupleId) {
      toast.error("Crie ou entre em um casal para guardar uma memória.");
      setPosting(false);
      return;
    }
    let imagePath: string | undefined;
    if (selectedPhoto) {
      const safeName = selectedPhoto.name
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, "-");
      imagePath = `${coupleId}/${session.user.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(imagePath, selectedPhoto, {
          contentType: selectedPhoto.type,
          upsert: false,
        });
      if (uploadError) {
        toast.error(uploadError.message);
        setPosting(false);
        return;
      }
    }
    const { data, error } = await supabase
      .from("posts")
      .insert({
        couple_id: coupleId,
        author_id: session.user.id,
        content,
        image_path: imagePath ?? null,
      })
      .select("id, content, created_at, author_id, image_path, profiles(name)")
      .single();
    if (error) {
      if (imagePath)
        await supabase.storage.from(PHOTO_BUCKET).remove([imagePath]);
      toast.error(error.message);
    }
    if (data) {
      const freshPost = mapPost(
        data as DatabasePost,
        await signedPhotoUrl(imagePath)
      );
      setPosts(current => [freshPost, ...current]);
      setPostDraft("");
      clearPhoto();
      toast.success("Memória guardada.");
    }
    setPosting(false);
  }

  async function handleEditPost(post: Post) {
    const requested = window.prompt("Edite sua memória", post.content);
    if (requested === null) return;
    const content = requested.trim();
    if (!content && !post.image_path) {
      toast.error("Uma memória com foto precisa manter uma legenda ou ser apagada.");
      return;
    }
    const optimistic = { ...post, content };
    setPosts(current => current.map(entry => entry.id === post.id ? optimistic : entry));
    if (isPreview) {
      toast.success("Memória corrigida na prévia.");
      return;
    }
    if (!supabase || !coupleId || !currentUserId) return;
    const { error } = await supabase
      .from("posts")
      .update({ content })
      .eq("id", post.id)
      .eq("couple_id", coupleId)
      .eq("author_id", currentUserId);
    if (error) {
      setPosts(current => current.map(entry => entry.id === post.id ? post : entry));
      toast.error("Não foi possível corrigir esta memória agora.");
      return;
    }
    toast.success("Memória corrigida.");
  }

  async function handleDeletePost(post: Post) {
    if (!window.confirm("Apagar esta memória? Esta ação não pode ser desfeita.")) return;
    setPosts(current => current.filter(entry => entry.id !== post.id));
    if (widgetMomentId === post.id) {
      window.localStorage.removeItem("appcasal:moment-widget");
      setWidgetMomentId(null);
    }
    if (isPreview) {
      toast.success("Memória apagada na prévia.");
      return;
    }
    if (!supabase || !coupleId || !currentUserId) return;
    const { error } = await supabase
      .from("posts")
      .delete()
      .eq("id", post.id)
      .eq("couple_id", coupleId)
      .eq("author_id", currentUserId);
    if (error) {
      setPosts(current => [post, ...current]);
      toast.error("Não foi possível apagar esta memória agora.");
      return;
    }
    if (post.image_path) {
      const { error: storageError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .remove([post.image_path]);
      if (storageError) console.warn("Não foi possível limpar a foto removida.");
    }
    toast.success("Memória apagada.");
  }

  function handleChooseWidgetMoment(post: Post) {
    if (!post.image_url) return;
    window.localStorage.setItem("appcasal:moment-widget", post.id);
    setWidgetMomentId(post.id);
    toast.success("Foto escolhida para abrir seus Momentos.");
  }

  function resetLibraryDraft() {
    setLibraryTitleDraft("");
    setLibraryCreatorDraft("");
    setLibraryNotesDraft("");
    setLibraryReleaseDraft("");
  }

  async function handleAddLibraryItem(itemType: LibraryItemType) {
    const title = libraryTitleDraft.trim();
    if (!title) return;
    if (itemType === "movie" && libraryReleaseDraft && !hasFourDigitYear(libraryReleaseDraft)) {
      toast.error(FOUR_DIGIT_YEAR_DATE_HINT);
      return;
    }
    const defaultStatus: LibraryStatus = itemType === "book" ? "want" : "want";
    setSavingLibrary(true);
    const optimistic: CoupleLibraryItem = {
      id: crypto.randomUUID(),
      couple_id: coupleId ?? "preview",
      author_id: currentUserId,
      item_type: itemType,
      title,
      creator: libraryCreatorDraft.trim(),
      notes: libraryNotesDraft.trim(),
      status: defaultStatus,
      release_on: itemType === "movie" && libraryReleaseDraft ? libraryReleaseDraft : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (isPreview) {
      setLibraryItems(current => [optimistic, ...current]);
      resetLibraryDraft();
      setSavingLibrary(false);
      toast.success("Guardado na prévia.");
      return;
    }
    if (!supabase || !session || !coupleId) {
      toast.error("Entre no caderno de um casal para guardar esta indicação.");
      setSavingLibrary(false);
      return;
    }
    const { data, error } = await supabase
      .from("couple_library_items")
      .insert({
        couple_id: coupleId,
        author_id: session.user.id,
        item_type: itemType,
        title,
        creator: optimistic.creator,
        notes: optimistic.notes,
        status: defaultStatus,
        release_on: optimistic.release_on,
      })
      .select("id, couple_id, author_id, item_type, title, creator, notes, status, release_on, created_at, updated_at")
      .single();
    if (error) {
      toast.error("Não foi possível guardar agora. A migration 0014 pode ainda não estar ativa.");
    } else if (data) {
      const incoming = data as CoupleLibraryItem;
      setLibraryItems(current => [incoming, ...current.filter(item => item.id !== incoming.id)]);
      resetLibraryDraft();
      toast.success(itemType === "book" ? "Livro guardado na estante." : "Filme guardado para vocês.");
    }
    setSavingLibrary(false);
  }

  async function handleLibraryStatus(item: CoupleLibraryItem, status: LibraryStatus) {
    if (item.status === status) return;
    const optimistic = { ...item, status, updated_at: new Date().toISOString() };
    setLibraryItems(current => current.map(entry => entry.id === item.id ? optimistic : entry));
    if (isPreview) return;
    if (!supabase || !coupleId) return;
    const { error } = await supabase
      .from("couple_library_items")
      .update({ status })
      .eq("id", item.id)
      .eq("couple_id", coupleId);
    if (error) {
      setLibraryItems(current => current.map(entry => entry.id === item.id ? item : entry));
      toast.error("Não foi possível atualizar o status agora.");
    }
  }

  async function handleEditLibraryItem(item: CoupleLibraryItem) {
    const requestedTitle = window.prompt("Edite o título", item.title);
    if (requestedTitle === null) return;
    const title = requestedTitle.trim();
    if (!title) {
      toast.error("O título não pode ficar vazio.");
      return;
    }
    const requestedCreator = window.prompt("Edite autora, autor ou direção", item.creator);
    if (requestedCreator === null) return;
    const requestedNotes = window.prompt("Edite a anotação", item.notes);
    if (requestedNotes === null) return;
    const optimistic = {
      ...item,
      title,
      creator: requestedCreator.trim(),
      notes: requestedNotes.trim(),
      updated_at: new Date().toISOString(),
    };
    setLibraryItems(current => current.map(entry => entry.id === item.id ? optimistic : entry));
    if (isPreview) {
      toast.success("Item corrigido na prévia.");
      return;
    }
    if (!supabase || !coupleId || !currentUserId) return;
    const { error } = await supabase
      .from("couple_library_items")
      .update({ title: optimistic.title, creator: optimistic.creator, notes: optimistic.notes })
      .eq("id", item.id)
      .eq("couple_id", coupleId)
      .eq("author_id", currentUserId);
    if (error) {
      setLibraryItems(current => current.map(entry => entry.id === item.id ? item : entry));
      toast.error("Não foi possível corrigir este item agora.");
      return;
    }
    toast.success("Item corrigido.");
  }

  async function handleDeleteLibraryItem(item: CoupleLibraryItem) {
    if (!window.confirm(`Apagar “${item.title}” da lista? Esta ação não pode ser desfeita.`)) return;
    setLibraryItems(current => current.filter(entry => entry.id !== item.id));
    if (isPreview) return;
    if (!supabase || !coupleId) return;
    const { error } = await supabase
      .from("couple_library_items")
      .delete()
      .eq("id", item.id)
      .eq("couple_id", coupleId);
    if (error) {
      setLibraryItems(current => [item, ...current]);
      toast.error("Não foi possível remover agora.");
    }
  }

  async function handleSend() {
    const text = messageDraft.trim();
    if (!text) return;
    setSending(true);
    if (isPreview) {
      setMessages(current => [
        ...current,
        {
          id: crypto.randomUUID(),
          text,
          created_at: new Date().toISOString(),
          sender_id: currentUserId,
          sender_name: "Você",
        },
      ]);
      setMessageDraft("");
      setSending(false);
      return;
    }
    if (!supabase || !session || !coupleId) {
      toast.error("Crie ou entre em um casal para conversar aqui.");
      setSending(false);
      return;
    }
    const { data, error } = await supabase
      .from("messages")
      .insert({
        couple_id: coupleId,
        sender_id: session.user.id,
        sender_name: profileName,
        text,
      })
      .select("id, text, created_at, sender_id, sender_name")
      .single();
    if (error) toast.error(error.message);
    if (data) {
      const fresh = mapMessage(data as DatabaseMessage);
      setMessages(current =>
        current.some(message => message.id === fresh.id)
          ? current
          : [...current, fresh]
      );
      setMessageDraft("");
    }
    setSending(false);
  }

  async function handleEditMessage(message: ChatMessage) {
    const requested = window.prompt("Edite sua mensagem", message.text);
    if (requested === null) return;
    const text = requested.trim();
    if (!text) {
      toast.error("A mensagem não pode ficar vazia.");
      return;
    }
    const optimistic = { ...message, text };
    setMessages(current => current.map(entry => entry.id === message.id ? optimistic : entry));
    if (isPreview) return;
    if (!supabase || !coupleId || !currentUserId) return;
    const { error } = await supabase
      .from("messages")
      .update({ text })
      .eq("id", message.id)
      .eq("couple_id", coupleId)
      .eq("sender_id", currentUserId);
    if (error) {
      setMessages(current => current.map(entry => entry.id === message.id ? message : entry));
      toast.error("Não foi possível corrigir esta mensagem agora.");
      return;
    }
    toast.success("Mensagem corrigida.");
  }

  async function handleDeleteMessage(message: ChatMessage) {
    if (!window.confirm("Apagar esta mensagem? Esta ação não pode ser desfeita.")) return;
    setMessages(current => current.filter(entry => entry.id !== message.id));
    if (isPreview) return;
    if (!supabase || !coupleId || !currentUserId) return;
    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("id", message.id)
      .eq("couple_id", coupleId)
      .eq("sender_id", currentUserId);
    if (error) {
      setMessages(current => [...current, message].sort((a, b) => a.created_at.localeCompare(b.created_at)));
      toast.error("Não foi possível apagar esta mensagem agora.");
      return;
    }
    toast.success("Mensagem apagada.");
  }

  async function handleCreatePlan() {
    const title = planTitle.trim();
    if (!title) return;
    setSavingPlan(true);
    const scheduledFor = toDateKey(selectedDate);
    if (isPreview) {
      setPlans(current =>
        [
          ...current,
          {
            id: crypto.randomUUID(),
            title,
            details: planDetails.trim(),
            scheduled_for: scheduledFor,
            completed: false,
            created_by: currentUserId,
          },
        ].sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for))
      );
      setPlanTitle("");
      setPlanDetails("");
      setSavingPlan(false);
      toast.success("Data guardada na prévia.");
      return;
    }
    if (!supabase || !session || !coupleId) {
      toast.error("Crie ou entre em um casal para guardar uma data.");
      setSavingPlan(false);
      return;
    }
    const { data, error } = await supabase
      .from("plans")
      .insert({
        couple_id: coupleId,
        created_by: session.user.id,
        title,
        details: planDetails.trim(),
        scheduled_for: scheduledFor,
      })
      .select("id, title, details, scheduled_for, completed, created_by")
      .single();
    if (error) toast.error(error.message);
    if (data) {
      const fresh = mapPlan(data as DatabasePlan);
      setPlans(current =>
        current.some(plan => plan.id === fresh.id)
          ? current
          : [...current, fresh].sort((a, b) =>
              a.scheduled_for.localeCompare(b.scheduled_for)
            )
      );
      setPlanTitle("");
      setPlanDetails("");
      toast.success("Data guardada no calendário.");
    }
    setSavingPlan(false);
  }

  async function handleTogglePlan(plan: Plan) {
    if (isPreview) {
      setPlans(current =>
        current.map(item =>
          item.id === plan.id ? { ...item, completed: !item.completed } : item
        )
      );
      return;
    }
    if (!supabase || !coupleId) {
      toast.error("Entre em um casal para atualizar o calendário.");
      return;
    }
    const { data, error } = await supabase
      .from("plans")
      .update({ completed: !plan.completed })
      .eq("id", plan.id)
      .eq("couple_id", coupleId)
      .select("id, title, details, scheduled_for, completed, created_by")
      .single();
    if (error) toast.error(error.message);
    if (data)
      setPlans(current =>
        current.map(item =>
          item.id === plan.id ? mapPlan(data as DatabasePlan) : item
        )
      );
  }

  async function handleEditPlan(plan: Plan) {
    const requestedTitle = window.prompt("Edite o plano", plan.title);
    if (requestedTitle === null) return;
    const title = requestedTitle.trim();
    if (!title) {
      toast.error("O plano precisa de um título.");
      return;
    }
    const requestedDetails = window.prompt("Edite o detalhe", plan.details);
    if (requestedDetails === null) return;
    const optimistic = { ...plan, title, details: requestedDetails.trim() };
    setPlans(current => current.map(entry => entry.id === plan.id ? optimistic : entry));
    if (isPreview) return;
    if (!supabase || !coupleId) return;
    const { error } = await supabase
      .from("plans")
      .update({ title: optimistic.title, details: optimistic.details })
      .eq("id", plan.id)
      .eq("couple_id", coupleId);
    if (error) {
      setPlans(current => current.map(entry => entry.id === plan.id ? plan : entry));
      toast.error("Não foi possível corrigir este plano agora.");
      return;
    }
    toast.success("Plano corrigido.");
  }

  async function handleDeletePlan(plan: Plan) {
    if (!window.confirm(`Apagar o plano “${plan.title}”? Esta ação não pode ser desfeita.`)) return;
    setPlans(current => current.filter(entry => entry.id !== plan.id));
    if (isPreview) return;
    if (!supabase || !coupleId) return;
    const { error } = await supabase
      .from("plans")
      .delete()
      .eq("id", plan.id)
      .eq("couple_id", coupleId);
    if (error) {
      setPlans(current => [...current, plan].sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for)));
      toast.error("Não foi possível apagar este plano agora.");
      return;
    }
    toast.success("Plano apagado.");
  }

  async function handleCreateMusicRoom() {
    const title = musicRoomTitle.trim();
    if (!title) return;
    setSavingMusic(true);
    const nextRoom: CoupleMusicRoom = {
      couple_id: coupleId ?? "preview-couple",
      host_id: currentUserId,
      title,
      jam_url: null,
      is_active: true,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (isPreview) {
      setMusicRoom(nextRoom);
      setMusicRoomTitle("");
      setSavingMusic(false);
      toast.success("Sala Spotify aberta na prévia.");
      return;
    }
    if (!supabase || !session || !coupleId) {
      setSavingMusic(false);
      toast.error("Entre no espaço do casal para abrir uma sala musical.");
      return;
    }
    const { data, error } = await supabase
      .from("couple_music_rooms")
      .upsert(
        {
          couple_id: coupleId,
          host_id: session.user.id,
          title,
          jam_url: null,
          is_active: true,
          started_at: new Date().toISOString(),
        },
        { onConflict: "couple_id" }
      )
      .select(
        "couple_id, host_id, title, jam_url, is_active, started_at, updated_at"
      )
      .single();
    setSavingMusic(false);
    if (error) {
      toast.error(
        "Não foi possível abrir a sala. Confirme que a migration 0009 foi executada."
      );
      return;
    }
    setMusicRoom(data as CoupleMusicRoom);
    setMusicRoomTitle("");
    toast.success("Sala Spotify aberta para vocês.");
  }

  async function handleSaveJam() {
    const jamUrl = jamDraft.trim();
    if (!musicRoom) return;
    if (!isSpotifyShareUrl(jamUrl)) {
      toast.error("Use um link do Spotify ou spotify.link criado pelo Jam.");
      return;
    }
    setSavingMusic(true);
    if (isPreview) {
      setMusicRoom(current =>
        current
          ? {
              ...current,
              jam_url: jamUrl,
              is_active: true,
              updated_at: new Date().toISOString(),
            }
          : current
      );
      setSavingMusic(false);
      toast.success("Convite do Jam guardado na prévia.");
      return;
    }
    if (!supabase || !coupleId) {
      setSavingMusic(false);
      return;
    }
    const { data, error } = await supabase
      .from("couple_music_rooms")
      .update({ jam_url: jamUrl, is_active: true })
      .eq("couple_id", coupleId)
      .select(
        "couple_id, host_id, title, jam_url, is_active, started_at, updated_at"
      )
      .single();
    setSavingMusic(false);
    if (error) {
      toast.error("Não foi possível guardar o convite do Spotify.");
      return;
    }
    setMusicRoom(data as CoupleMusicRoom);
    toast.success("Convite pronto para o seu par.");
  }

  async function handleCopyMusicInvite() {
    if (!musicRoom?.jam_url) return;
    try {
      await navigator.clipboard.writeText(musicRoom.jam_url);
      toast.success(
        "Convite copiado. Envie somente para quem escreve este caderno com você."
      );
    } catch {
      toast.error("Não foi possível copiar o convite neste navegador.");
    }
  }

  async function handleEndMusicRoom() {
    if (!musicRoom) return;
    setSavingMusic(true);
    if (isPreview) {
      setMusicRoom(current =>
        current
          ? {
              ...current,
              is_active: false,
              jam_url: null,
              updated_at: new Date().toISOString(),
            }
          : current
      );
      setJamDraft("");
      setSavingMusic(false);
      toast.success("Sala encerrada e convite removido.");
      return;
    }
    if (!supabase || !coupleId) {
      setSavingMusic(false);
      return;
    }
    const { data, error } = await supabase
      .from("couple_music_rooms")
      .update({ is_active: false, jam_url: null })
      .eq("couple_id", coupleId)
      .select(
        "couple_id, host_id, title, jam_url, is_active, started_at, updated_at"
      )
      .single();
    setSavingMusic(false);
    if (error) {
      toast.error("Não foi possível encerrar a sala agora.");
      return;
    }
    setMusicRoom(data as CoupleMusicRoom);
    setJamDraft("");
    toast.success("Sala encerrada e convite removido.");
  }

  async function handleAddMusicTrack() {
    const title = trackTitle.trim();
    const url = trackUrl.trim();
    if (!musicRoom || !title || !url) return;
    if (!isSpotifyShareUrl(url)) {
      toast.error("Cole um link de faixa, álbum ou playlist do Spotify.");
      return;
    }
    setSavingMusic(true);
    const nextTrack: MusicQueueItem = {
      id: crypto.randomUUID(),
      couple_id: coupleId ?? "preview-couple",
      added_by: currentUserId,
      track_url: url,
      track_title: title,
      artist_name: trackArtist.trim() || null,
      note: trackNote.trim() || null,
      created_at: new Date().toISOString(),
    };
    if (isPreview) {
      setMusicQueue(current => [...current, nextTrack]);
      setTrackTitle("");
      setTrackArtist("");
      setTrackUrl("");
      setTrackNote("");
      setSavingMusic(false);
      toast.success("Faixa guardada na fila de vocês.");
      return;
    }
    if (!supabase || !session || !coupleId) {
      setSavingMusic(false);
      return;
    }
    const { data, error } = await supabase
      .from("couple_music_queue")
      .insert({
        couple_id: coupleId,
        added_by: session.user.id,
        track_url: url,
        track_title: title,
        artist_name: trackArtist.trim() || null,
        note: trackNote.trim() || null,
      })
      .select(
        "id, couple_id, added_by, track_url, track_title, artist_name, note, created_at"
      )
      .single();
    setSavingMusic(false);
    if (error) {
      toast.error("Não foi possível guardar esta faixa.");
      return;
    }
    const saved = data as MusicQueueItem;
    setMusicQueue(current =>
      current.some(item => item.id === saved.id) ? current : [...current, saved]
    );
    setTrackTitle("");
    setTrackArtist("");
    setTrackUrl("");
    setTrackNote("");
    toast.success("Faixa guardada na fila de vocês.");
  }

  async function handleRemoveMusicTrack(item: MusicQueueItem) {
    if (isPreview) {
      setMusicQueue(current => current.filter(track => track.id !== item.id));
      return;
    }
    if (!supabase || !coupleId) return;
    const { error } = await supabase
      .from("couple_music_queue")
      .delete()
      .eq("id", item.id)
      .eq("couple_id", coupleId);
    if (error) {
      toast.error("Não foi possível remover a faixa agora.");
      return;
    }
    setMusicQueue(current => current.filter(track => track.id !== item.id));
  }

  function clearLocationWatch() {
    if (locationWatchRef.current !== null && "geolocation" in navigator)
      navigator.geolocation.clearWatch(locationWatchRef.current);
    locationWatchRef.current = null;
    lastLocationWriteRef.current = 0;
  }

  function clearProximityWatch() {
    if (proximityWatchRef.current !== null && "geolocation" in navigator)
      navigator.geolocation.clearWatch(proximityWatchRef.current);
    proximityWatchRef.current = null;
  }

  function checkProximityReminders(latitude: number, longitude: number) {
    const now = Date.now();
    proximityPreferences
      .filter(preference => preference.is_enabled)
      .forEach(preference => {
        const place = favoritePlaces.find(
          item => item.id === preference.place_id
        );
        if (!place) return;
        const distance = distanceInMeters(
          latitude,
          longitude,
          place.latitude,
          place.longitude
        );
        const lastAlert = proximityAlertedAtRef.current[place.id] ?? 0;
        if (
          distance > preference.radius_meters ||
          now - lastAlert < PROXIMITY_COOLDOWN_MS
        )
          return;
        proximityAlertedAtRef.current[place.id] = now;
        const title = `Um lugar de vocês está pertinho`;
        const body = proximityCopy(place, preference);
        toast.success(title, { description: body });
        if ("Notification" in window && Notification.permission === "granted") {
          try {
            new Notification(title, {
              body,
              icon: ASSETS.logo,
              tag: `proximity-${place.id}`,
            });
          } catch {
            /* O aviso no app continua disponível. */
          }
        }
      });
  }

  useEffect(() => {
    clearProximityWatch();
    if (
      !hasWorkspace ||
      !proximityPreferences.some(preference => preference.is_enabled) ||
      !("geolocation" in navigator)
    )
      return;
    proximityWatchRef.current = navigator.geolocation.watchPosition(
      position =>
        checkProximityReminders(
          position.coords.latitude,
          position.coords.longitude
        ),
      () => {
        /* A interface mantém os controles para uma nova tentativa quando a permissão mudar. */
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 15_000 }
    );
    return clearProximityWatch;
  }, [favoritePlaces, hasWorkspace, proximityPreferences]);

  async function saveCurrentLocation(
    position: GeolocationPosition,
    announce = false
  ) {
    const coordinates = position.coords;
    const gpsTimestamp = Number.isFinite(position.timestamp) && position.timestamp > 0
      ? position.timestamp
      : Date.now();
    const gpsAgeMs = Math.max(0, Date.now() - gpsTimestamp);
    if (gpsAgeMs > 5 * 60_000) {
      setLocationBusy(false);
      toast.error("O navegador devolveu uma posição antiga. Atualize a localização novamente.");
      return;
    }
    checkProximityReminders(coordinates.latitude, coordinates.longitude);
    const next: CoupleLocation = {
      couple_id: coupleId ?? "preview-couple",
      user_id: currentUserId,
      sharing_enabled: true,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      accuracy_meters: coordinates.accuracy,
      updated_at: new Date(gpsTimestamp).toISOString(),
    };
    if (isPreview) {
      setLocations(current => [
        ...current.filter(location => location.user_id !== currentUserId),
        next,
      ]);
      if (announce)
        toast.success("Sua localização está sendo compartilhada nesta prévia.");
      return;
    }
    if (!supabase || !session || !coupleId) {
      toast.error(
        "Entre no espaço do casal para compartilhar sua localização."
      );
      return;
    }
    const { data, error } = await supabase
      .from("couple_locations")
      .upsert(
        {
          couple_id: coupleId,
          user_id: session.user.id,
          sharing_enabled: true,
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          accuracy_meters: coordinates.accuracy,
        },
        { onConflict: "couple_id,user_id" }
      )
      .select(
        "couple_id, user_id, sharing_enabled, latitude, longitude, accuracy_meters, updated_at"
      )
      .single();
    if (error) {
      toast.error("Não foi possível atualizar sua localização.");
      return;
    }
    const saved = data as CoupleLocation;
    setLocations(current => [
      ...current.filter(location => location.user_id !== saved.user_id),
      saved,
    ]);
    if (announce)
      toast.success("Sua localização está sendo compartilhada com seu par.");
  }

  function handleLocationError(error: GeolocationPositionError) {
    setLocationBusy(false);
    if (error.code === error.PERMISSION_DENIED)
      toast.error(
        "A localização só é compartilhada se você autorizar no navegador."
      );
    else if (error.code === error.TIMEOUT)
      toast.error(
        "Não foi possível obter a localização a tempo. Tente novamente."
      );
    else toast.error("Não foi possível obter sua localização agora.");
  }

  function handleStartLocation() {
    if (!("geolocation" in navigator)) {
      toast.error("Este navegador não oferece localização.");
      return;
    }
    clearLocationWatch();
    setLocationBusy(true);
    let firstPosition = true;
    locationWatchRef.current = navigator.geolocation.watchPosition(
      position => {
        const now = Date.now();
        if (!firstPosition && now - lastLocationWriteRef.current < 60_000)
          return;
        const shouldAnnounce = firstPosition;
        firstPosition = false;
        window.localStorage.setItem(
          locationConsentStorageKey(currentUserId),
          "granted"
        );
        lastLocationWriteRef.current = now;
        void saveCurrentLocation(position, shouldAnnounce).finally(() =>
          setLocationBusy(false)
        );
      },
      handleLocationError,
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 }
    );
  }

  function handleRefreshLocation() {
    if (!("geolocation" in navigator)) {
      toast.error("Este navegador não oferece localização.");
      return;
    }
    const mine = locations.find(location => location.user_id === currentUserId);
    if (!mine?.sharing_enabled) {
      handleStartLocation();
      return;
    }
    setLocationBusy(true);
    navigator.geolocation.getCurrentPosition(
      position => {
        window.localStorage.setItem(
          locationConsentStorageKey(currentUserId),
          "granted"
        );
        lastLocationWriteRef.current = Date.now();
        void saveCurrentLocation(position).finally(() => setLocationBusy(false));
      },
      handleLocationError,
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 }
    );
  }

  async function handleStopLocation(silent = false) {
    clearLocationWatch();
    if (!silent)
      window.localStorage.setItem(
        locationConsentStorageKey(currentUserId),
        "paused"
      );
    setLocationBusy(true);
    const inactive: CoupleLocation = {
      couple_id: coupleId ?? "preview-couple",
      user_id: currentUserId,
      sharing_enabled: false,
      latitude: null,
      longitude: null,
      accuracy_meters: null,
      updated_at: new Date().toISOString(),
    };
    if (isPreview) {
      setLocations(current => [
        ...current.filter(location => location.user_id !== currentUserId),
        inactive,
      ]);
      setLocationBusy(false);
      if (!silent) toast.success("Compartilhamento pausado e posição apagada.");
      return;
    }
    if (!supabase || !session || !coupleId) {
      setLocationBusy(false);
      return;
    }
    const { data, error } = await supabase
      .from("couple_locations")
      .upsert(
        {
          couple_id: coupleId,
          user_id: session.user.id,
          sharing_enabled: false,
          latitude: null,
          longitude: null,
          accuracy_meters: null,
        },
        { onConflict: "couple_id,user_id" }
      )
      .select(
        "couple_id, user_id, sharing_enabled, latitude, longitude, accuracy_meters, updated_at"
      )
      .single();
    setLocationBusy(false);
    if (error) {
      if (!silent)
        toast.error("Não foi possível pausar o compartilhamento agora.");
      return;
    }
    const saved = data as CoupleLocation;
    setLocations(current => [
      ...current.filter(location => location.user_id !== saved.user_id),
      saved,
    ]);
    if (!silent) toast.success("Compartilhamento pausado e posição apagada.");
  }

  useEffect(() => {
    if (
      !hasWorkspace ||
      !currentUserId ||
      (!isPreview && !coupleId) ||
      locationPermissionPromptedRef.current
    )
      return;

    const geolocationAvailable =
      typeof navigator !== "undefined" && "geolocation" in navigator;
    const storageKey = locationConsentStorageKey(currentUserId);
    const action = getLocationConsentAction(
      window.localStorage.getItem(storageKey),
      geolocationAvailable
    );

    if (action === "skip") return;
    if (action === "start") {
      locationPermissionPromptedRef.current = true;
      handleStartLocation();
      return;
    }

    locationPermissionPromptedRef.current = true;
    navigator.geolocation.getCurrentPosition(
      () => {
        window.localStorage.setItem(storageKey, "granted");
        handleStartLocation();
        toast.success(
          "Localização compartilhada com seu par. Você pode pausar quando quiser."
        );
      },
      error => {
        if (error.code === error.PERMISSION_DENIED) {
          // Não persistimos a recusa: ao entrar novamente, o app tentará
          // solicitar o compartilhamento outra vez. Se o navegador bloqueou
          // a origem, a própria mensagem orienta a liberar nas configurações.
          window.localStorage.removeItem(storageKey);
          toast.message(
            "Não foi possível ativar agora. Ao entrar novamente, pediremos sua autorização outra vez; se o navegador bloqueou, libere a permissão nas configurações."
          );
        }
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 }
    );
  }, [coupleId, currentUserId, hasWorkspace, isPreview]);

  function handleUseCurrentPositionForPlace() {
    const mine = locations.find(
      location =>
        location.user_id === currentUserId &&
        location.latitude !== null &&
        location.longitude !== null
    );
    if (mine && mine.latitude !== null && mine.longitude !== null) {
      setPlaceCoordinates({
        latitude: mine.latitude,
        longitude: mine.longitude,
      });
      toast.success("Usamos sua posição compartilhada para este lugar.");
      return;
    }
    if (!("geolocation" in navigator)) {
      toast.error("Este navegador não oferece localização.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      position => {
        setPlaceCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        toast.success("Posição pronta para guardar como lugar favorito.");
      },
      handleLocationError,
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 }
    );
  }

  async function handleFindAddress() {
    const address = placeAddress.trim();
    if (!address) {
      toast.error("Digite um endereço para buscar no Google Maps.");
      return;
    }
    setAddressBusy(true);
    try {
      const coordinates = await geocodeAddress(address);
      if (!coordinates) {
        toast.error("Não encontramos esse endereço no Google Maps.");
        return;
      }
      setPlaceCoordinates(coordinates);
      toast.success("Endereço encontrado no Google Maps.");
    } catch {
      toast.error("Não foi possível consultar o Google Maps agora.");
    } finally {
      setAddressBusy(false);
    }
  }

  async function handleSaveFavoritePlace() {
    const title = placeTitle.trim();
    if (!title || !placeCoordinates) {
      toast.error("Dê um nome e escolha uma posição para guardar o lugar.");
      return;
    }
    setSavingPlace(true);
    const existing = editingPlaceId
      ? favoritePlaces.find(place => place.id === editingPlaceId)
      : undefined;
    const draft: FavoritePlace = {
      id: existing?.id ?? crypto.randomUUID(),
      created_by: existing?.created_by ?? currentUserId,
      title,
      address: placeAddress.trim() || null,
      meaning: placeMeaning.trim(),
      category: placeCategory,
      latitude: placeCoordinates.latitude,
      longitude: placeCoordinates.longitude,
      created_at: existing?.created_at ?? new Date().toISOString(),
    };
    if (isPreview) {
      setFavoritePlaces(current => [
        draft,
        ...current.filter(place => place.id !== draft.id),
      ]);
      resetPlaceDraft();
      setSavingPlace(false);
      toast.success(
        existing
          ? "Lugar atualizado na prévia."
          : "Lugar favorito guardado na prévia."
      );
      return;
    }
    if (!supabase || !session || !coupleId) {
      setSavingPlace(false);
      toast.error("Entre no espaço do casal para guardar este lugar.");
      return;
    }
    const query = existing
      ? supabase
          .from("favorite_places")
          .update({
            title,
            address: placeAddress.trim() || null,
            meaning: placeMeaning.trim(),
            category: placeCategory,
            latitude: placeCoordinates.latitude,
            longitude: placeCoordinates.longitude,
          })
          .eq("id", existing.id)
          .eq("couple_id", coupleId)
      : supabase
          .from("favorite_places")
          .insert({
            couple_id: coupleId,
            created_by: session.user.id,
            title,
            address: placeAddress.trim() || null,
            meaning: placeMeaning.trim(),
            category: placeCategory,
            latitude: placeCoordinates.latitude,
            longitude: placeCoordinates.longitude,
          });
    const { data, error } = await query
      .select(
        "id, created_by, title, address, meaning, category, latitude, longitude, created_at"
      )
      .single();
    setSavingPlace(false);
    if (error) {
      toast.error(
        existing
          ? "Não foi possível atualizar o lugar agora."
          : "Não foi possível guardar o lugar agora."
      );
      return;
    }
    const saved = data as FavoritePlace;
    setFavoritePlaces(current => [
      saved,
      ...current.filter(place => place.id !== saved.id),
    ]);
    resetPlaceDraft();
    toast.success(
      existing
        ? "Lugar atualizado para vocês."
        : "Lugar favorito guardado para vocês."
    );
  }

  function resetPlaceDraft() {
    setEditingPlaceId(null);
    setPlaceTitle("");
    setPlaceAddress("");
    setPlaceMeaning("");
    setPlaceCategory("favoritos");
    setPlaceCoordinates(null);
  }

  function handleEditPlace(place: FavoritePlace) {
    setEditingPlaceId(place.id);
    setPlaceTitle(place.title);
    setPlaceAddress(place.address ?? "");
    setPlaceMeaning(place.meaning);
    setPlaceCategory(place.category);
    setPlaceCoordinates({
      latitude: place.latitude,
      longitude: place.longitude,
    });
  }

  async function handleDeletePlace(place: FavoritePlace) {
    if (!window.confirm(`Remover “${place.title}” do mapa afetivo?`)) return;
    if (isPreview) {
      setFavoritePlaces(current =>
        current.filter(item => item.id !== place.id)
      );
      if (editingPlaceId === place.id) resetPlaceDraft();
      toast.success("Lugar removido da prévia.");
      return;
    }
    if (!supabase || !coupleId) {
      toast.error("Entre no espaço do casal para remover este lugar.");
      return;
    }
    const { error } = await supabase
      .from("favorite_places")
      .delete()
      .eq("id", place.id)
      .eq("couple_id", coupleId);
    if (error) {
      toast.error("Não foi possível remover o lugar agora.");
      return;
    }
    setFavoritePlaces(current => current.filter(item => item.id !== place.id));
    if (editingPlaceId === place.id) resetPlaceDraft();
    toast.success("Lugar removido do mapa afetivo.");
  }

  async function handleSaveProximityPreference(
    place: FavoritePlace,
    change: Partial<
      Pick<
        PlaceProximityPreference,
        "is_enabled" | "radius_meters" | "custom_message"
      >
    >
  ) {
    const current = proximityPreferences.find(
      preference => preference.place_id === place.id
    );
    const preference: PlaceProximityPreference = {
      place_id: place.id,
      user_id: currentUserId,
      is_enabled: change.is_enabled ?? current?.is_enabled ?? false,
      radius_meters: change.radius_meters ?? current?.radius_meters ?? 150,
      custom_message: change.custom_message ?? current?.custom_message ?? null,
      updated_at: new Date().toISOString(),
    };
    if (
      preference.is_enabled &&
      "Notification" in window &&
      Notification.permission === "default"
    )
      void Notification.requestPermission();
    setSavingProximityPlaceId(place.id);
    if (isPreview) {
      setProximityPreferences(existing => {
        const next = [
          preference,
          ...existing.filter(item => item.place_id !== place.id),
        ];
        persistProximityPreferences(currentUserId, next);
        return next;
      });
      setSavingProximityPlaceId(null);
      toast.success(
        preference.is_enabled
          ? `Lembrete ativado para ${place.title}.`
          : `Lembrete pausado para ${place.title}.`
      );
      return;
    }
    if (!supabase || !session) {
      setSavingProximityPlaceId(null);
      toast.error("Entre no espaço do casal para guardar este lembrete.");
      return;
    }
    const { data, error } = await supabase
      .from("place_proximity_preferences")
      .upsert(
        {
          place_id: place.id,
          user_id: session.user.id,
          is_enabled: preference.is_enabled,
          radius_meters: preference.radius_meters,
          custom_message: preference.custom_message,
        },
        { onConflict: "place_id,user_id" }
      )
      .select(
        "place_id, user_id, is_enabled, radius_meters, custom_message, updated_at"
      )
      .single();
    setSavingProximityPlaceId(null);
    if (error) {
      toast.error("Não foi possível guardar o lembrete agora.");
      return;
    }
    const saved = data as PlaceProximityPreference;
    setProximityPreferences(existing => [
      saved,
      ...existing.filter(item => item.place_id !== saved.place_id),
    ]);
    toast.success(
      saved.is_enabled
        ? `Lembrete ativado para ${place.title}.`
        : `Lembrete pausado para ${place.title}.`
    );
  }

  async function handleAvatarUpload(file: File | null) {
    if (!file) return;
    if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) {
      toast.error("Escolha uma foto JPG, PNG ou WebP.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("A foto de perfil deve ter no máximo 3 MB.");
      return;
    }
    setSavingAvatar(true);
    if (isPreview) {
      const avatarUrl = URL.createObjectURL(file);
      setCoupleMembers(current => {
        const own = current.find(member => member.user_id === currentUserId);
        const next = {
          user_id: currentUserId,
          name: own?.name ?? profileName,
          avatar_path: null,
          avatar_url: avatarUrl,
        };
        return [
          next,
          ...current.filter(member => member.user_id !== currentUserId),
        ];
      });
      setSavingAvatar(false);
      toast.success("Foto aplicada ao seu marcador nesta prévia.");
      return;
    }
    if (!supabase || !session) {
      setSavingAvatar(false);
      toast.error("Entre com sua conta para atualizar a foto de perfil.");
      return;
    }
    const oldPath = coupleMembers.find(
      member => member.user_id === session.user.id
    )?.avatar_path;
    const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]/g, "-");
    const path = `${session.user.id}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      setSavingAvatar(false);
      toast.error("Não foi possível enviar a foto agora.");
      return;
    }
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ avatar_path: path })
      .eq("id", session.user.id);
    if (profileError) {
      await supabase.storage.from(AVATAR_BUCKET).remove([path]);
      setSavingAvatar(false);
      toast.error("Não foi possível salvar a foto de perfil.");
      return;
    }
    const avatarUrl = await signedAvatarUrl(path);
    setCoupleMembers(current => {
      const own = current.find(member => member.user_id === session.user.id);
      const next = {
        user_id: session.user.id,
        name: own?.name ?? profileName,
        avatar_path: path,
        avatar_url: avatarUrl,
      };
      return [
        next,
        ...current.filter(member => member.user_id !== session.user.id),
      ];
    });
    if (oldPath) await supabase.storage.from(AVATAR_BUCKET).remove([oldPath]);
    setSavingAvatar(false);
    toast.success("Foto de perfil atualizada no mapa afetivo.");
  }

  function handleProximityToggle() {
    if (proximityOpen) {
      setProximityOpen(false);
      return;
    }
    setNotificationsOpen(false);
    setRitualsOpen(false);
    setProximityOpen(true);
  }

  async function markNotificationsRead(ids: string[]) {
    if (!ids.length || !supabase || !session) return;
    const readAt = new Date().toISOString();
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .in("id", ids)
      .eq("recipient_id", session.user.id);
    if (error) {
      toast.error("Não foi possível marcar os avisos como lidos.");
      return;
    }
    setNotifications(current =>
      current.map(notification =>
        ids.includes(notification.id)
          ? { ...notification, read_at: readAt }
          : notification
      )
    );
  }

  function handleNotificationsToggle() {
    if (notificationsOpen) {
      setNotificationsOpen(false);
      return;
    }
    setRitualsOpen(false);
    setProximityOpen(false);
    setNotificationsOpen(true);
    void markNotificationsRead(
      notifications
        .filter(notification => !notification.read_at)
        .map(notification => notification.id)
    );
  }

  async function handleSaveRelationshipDate(value: string) {
    if (value && !hasFourDigitYear(value)) {
      toast.error(FOUR_DIGIT_YEAR_DATE_HINT);
      return;
    }
    setRelationshipStartedOn(value);
    if (isPreview) return;
    if (!supabase || !coupleId) {
      toast.error("Entre em um casal para guardar esta data.");
      return;
    }
    setSavingRitual(true);
    const { error } = await supabase
      .from("couple_settings")
      .upsert(
        { couple_id: coupleId, relationship_started_on: value || null },
        { onConflict: "couple_id" }
      );
    if (error) toast.error(error.message);
    else toast.success("A data de vocês foi guardada.");
    setSavingRitual(false);
  }

  async function handleAddCounterToHome() {
    const target = new URL(window.location.href);
    target.searchParams.set("tab", "contagem");
    window.history.replaceState(
      {},
      "",
      `${target.pathname}${target.search}${target.hash}`
    );
    setTab("contagem");

    if (deferredInstallPrompt) {
      try {
        await deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        if (choice.outcome === "accepted") {
          toast.success(
            "Caderno instalado. No Android, mantenha o ícone pressionado e escolha Contador."
          );
        } else {
          toast.message(
            "Quando quiser, use o menu do navegador para adicionar o Contador à tela inicial."
          );
        }
      } finally {
        setDeferredInstallPrompt(null);
      }
      return;
    }

    toast.message(
      "No iPhone/iPad, use Compartilhar > Adicionar à Tela de Início. No Android, instale o app e mantenha o ícone pressionado para escolher Contador."
    );
  }

  async function saveBatterySnapshot(levelPercent: number, isCharging: boolean) {
    setWidgetBusy("battery");
    try {
      const snapshot: CoupleBatterySnapshot = {
        couple_id: coupleId ?? "preview-couple",
        user_id: currentUserId,
        level_percent: levelPercent,
        is_charging: isCharging,
        updated_at: new Date().toISOString(),
      };
      if (isPreview) {
        setBatterySnapshots(current => [
          snapshot,
          ...current.filter(item => item.user_id !== snapshot.user_id),
        ]);
        setBatteryLevelDraft(String(snapshot.level_percent));
        setBatteryChargingDraft(snapshot.is_charging);
        toast.success("Seu retrato de bateria ficou disponível nesta prévia.");
        return;
      }
      if (!supabase || !session || !coupleId) {
        toast.error("Entre no espaço do casal para compartilhar este retrato.");
        return;
      }
      const { data, error } = await supabase
        .from("couple_widget_battery_snapshots")
        .upsert(snapshot, { onConflict: "couple_id,user_id" })
        .select("couple_id, user_id, level_percent, is_charging, updated_at")
        .single();
      if (error) {
        toast.error(
          "Não foi possível guardar a bateria. Execute a migration 0011."
        );
        return;
      }
      const saved = data as CoupleBatterySnapshot;
      setBatterySnapshots(current => [
        saved,
        ...current.filter(item => item.user_id !== saved.user_id),
      ]);
      setBatteryLevelDraft(String(saved.level_percent));
      setBatteryChargingDraft(saved.is_charging);
      toast.success("Seu retrato de bateria foi compartilhado com seu par.");
    } finally {
      setWidgetBusy(null);
    }
  }

  async function handleShareBattery() {
    const batteryNavigator = navigator as Navigator & {
      getBattery?: () => Promise<{ level: number; charging: boolean }>;
    };
    if (!batteryNavigator.getBattery) {
      toast.message(
        "Este navegador não expõe a bateria. Use o envio manual abaixo para compartilhar."
      );
      return;
    }
    try {
      const battery = await batteryNavigator.getBattery();
      await saveBatterySnapshot(
        Math.round(battery.level * 100),
        battery.charging
      );
    } catch {
      toast.error(
        "Não foi possível ler a bateria neste dispositivo. Você pode enviar o nível manualmente."
      );
    }
  }

  function handleShareBatteryManually() {
    const level = Number(batteryLevelDraft);
    if (
      !batteryLevelDraft.trim() ||
      !Number.isInteger(level) ||
      level < 0 ||
      level > 100
    ) {
      toast.error("Informe uma bateria inteira entre 0% e 100%.");
      return;
    }
    void saveBatterySnapshot(level, batteryChargingDraft);
  }

  async function handleSaveWeatherCity() {
    const city = weatherCityDraft.trim();
    if (!city) return;
    setWidgetBusy("weather");
    try {
      const searchResponse = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=pt&format=json`
      );
      const searchData = (await searchResponse.json()) as {
        results?: Array<{
          name: string;
          admin1?: string;
          latitude: number;
          longitude: number;
        }>;
      };
      const place = searchData.results?.[0];
      if (!place) {
        toast.error("Não encontramos essa cidade. Tente nome e estado.");
        return;
      }
      const weatherResponse = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code&timezone=auto`
      );
      const weatherData = (await weatherResponse.json()) as {
        current?: {
          temperature_2m?: number;
          weather_code?: number;
          time?: string;
        };
      };
      if (
        !weatherData.current ||
        typeof weatherData.current.temperature_2m !== "number"
      ) {
        toast.error(
          "O clima não respondeu agora. Tentem de novo em instantes."
        );
        return;
      }
      const cityLabel = [place.name, place.admin1].filter(Boolean).join(", ");
      const snapshot: CoupleWeatherSnapshot = {
        couple_id: coupleId ?? "preview-couple",
        city: cityLabel,
        latitude: place.latitude,
        longitude: place.longitude,
        temperature_c: weatherData.current.temperature_2m,
        weather_code: weatherData.current.weather_code ?? null,
        observed_at: weatherData.current.time
          ? new Date(weatherData.current.time).toISOString()
          : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (isPreview) {
        setWeatherSnapshot(snapshot);
        setWeatherCityDraft(cityLabel);
        toast.success("O clima escolhido apareceu nesta prévia.");
        return;
      }
      if (!supabase || !session || !coupleId) {
        toast.error("Entre no espaço do casal para guardar o clima.");
        return;
      }
      const { data, error } = await supabase
        .from("couple_widget_weather")
        .upsert(snapshot, { onConflict: "couple_id" })
        .select(
          "couple_id, city, latitude, longitude, temperature_c, weather_code, observed_at, updated_at"
        )
        .single();
      if (error) {
        toast.error(
          "Não foi possível guardar o clima. Execute a migration 0011."
        );
        return;
      }
      const saved = data as CoupleWeatherSnapshot;
      setWeatherSnapshot(saved);
      setWeatherCityDraft(saved.city);
      toast.success("O clima escolhido foi guardado para vocês.");
    } catch {
      toast.error("Não foi possível atualizar o clima agora.");
    } finally {
      setWidgetBusy(null);
    }
  }

  async function handleAnswerQuiz(
    quizKey: string,
    questionKey: string,
    answerValue: string
  ) {
    const answer: CoupleQuizAnswer = {
      couple_id: coupleId ?? "preview-couple",
      quiz_key: quizKey,
      question_key: questionKey,
      user_id: currentUserId,
      answer_value: answerValue,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (isPreview) {
      setQuizAnswers(current => [
        answer,
        ...current.filter(
          item =>
            !(
              item.quiz_key === quizKey &&
              item.question_key === questionKey &&
              item.user_id === currentUserId
            )
        ),
      ]);
      toast.success(
        "Resposta guardada nesta prévia — sem espiar a outra pessoa."
      );
      return;
    }
    if (!supabase || !session || !coupleId) {
      toast.error("Entre no espaço do casal para responder ao quiz.");
      return;
    }
    const { data, error } = await supabase
      .from("couple_quiz_answers")
      .upsert(answer, { onConflict: "couple_id,quiz_key,question_key,user_id" })
      .select(
        "couple_id, quiz_key, question_key, user_id, answer_value, created_at, updated_at"
      )
      .single();
    if (error) {
      toast.error(
        "Não foi possível guardar a resposta. Execute a migration 0011."
      );
      return;
    }
    const saved = data as CoupleQuizAnswer;
    setQuizAnswers(current => [
      saved,
      ...current.filter(
        item =>
          !(
            item.quiz_key === saved.quiz_key &&
            item.question_key === saved.question_key &&
            item.user_id === saved.user_id
          )
      ),
    ]);
    const { data: revealedAnswers } = await supabase
      .from("couple_quiz_answers")
      .select(
        "couple_id, quiz_key, question_key, user_id, answer_value, created_at, updated_at"
      )
      .eq("couple_id", coupleId)
      .eq("quiz_key", quizKey)
      .eq("question_key", questionKey);
    if (revealedAnswers) {
      const revealed = revealedAnswers as CoupleQuizAnswer[];
      setQuizAnswers(current => [
        ...revealed,
        ...current.filter(
          item =>
            !(item.quiz_key === quizKey && item.question_key === questionKey)
        ),
      ]);
    }
    toast.success("Resposta lacrada até a outra pessoa responder.");
  }

  async function handleConnectSpotify() {
    if (isPreview) {
      toast.message("Entre com uma conta real para conectar o Spotify.");
      return;
    }
    if (!supabase || !session) {
      toast.error("Entre no appCasal para conectar a sua conta Spotify.");
      return;
    }
    setSpotifyLinking(true);
    window.sessionStorage.setItem(SPOTIFY_LINK_RETURN_KEY, "pending");
    try {
      const { data, error } = await supabase.auth.linkIdentity({
        provider: "spotify",
        options: {
          ...getSpotifyLinkOptions(),
          skipBrowserRedirect: true,
        },
      });
      if (error || !data?.url) {
        window.sessionStorage.removeItem(SPOTIFY_LINK_RETURN_KEY);
        setSpotifyLinking(false);
        toast.error(
          "Não foi possível iniciar a conexão com o Spotify. Tente novamente em alguns instantes."
        );
        return;
      }

      const authorizationUrl = new URL(data.url);
      if (authorizationUrl.protocol !== "https:") {
        throw new Error("Endereço de autorização Spotify não seguro.");
      }
      window.location.assign(data.url);
    } catch {
      window.sessionStorage.removeItem(SPOTIFY_LINK_RETURN_KEY);
      setSpotifyLinking(false);
      toast.error(
        "Não foi possível iniciar a conexão com o Spotify. Tente novamente em alguns instantes."
      );
    }
  }

  async function handleCreateSpotifyPlaylist() {
    if (isPreview) {
      toast.message("Entre com uma conta real para criar uma playlist no Spotify.");
      return;
    }
    if (!session?.access_token) {
      toast.error("Entre no appCasal para criar uma playlist no Spotify.");
      return;
    }
    setSpotifyPlaylistCreating(true);
    try {
      const result = await spotifyPlaylistAuthorizationMutation.mutateAsync({
        accessToken: session.access_token,
      });
      const authorizationUrl = new URL(result.authorizationUrl);
      if (authorizationUrl.protocol !== "https:") {
        throw new Error("authorization-url");
      }
      window.location.assign(result.authorizationUrl);
    } catch {
      setSpotifyPlaylistCreating(false);
      toast.error("Não foi possível abrir a autorização para criar a playlist.");
    }
  }

  function handleOpenSpotifyPlaylist() {
    if (typeof window === "undefined") return;
    window.location.assign(getSpotifyContinuationUrl(musicRoom?.jam_url));
  }

  async function handleSaveMood(mood: MoodKey) {
    const moodDate = toDateKey(new Date());
    const localMood: DailyMood = {
      id: crypto.randomUUID(),
      author_id: currentUserId,
      mood,
      mood_date: moodDate,
    };
    if (isPreview) {
      setDailyMoods(current => [
        ...current.filter(
          item =>
            item.author_id !== currentUserId || item.mood_date !== moodDate
        ),
        localMood,
      ]);
      toast.success(
        `${MOOD_OPTIONS.find(item => item.id === mood)?.emoji ?? "💌"} Seu coração de hoje ficou guardado.`
      );
      return;
    }
    if (!supabase || !session || !coupleId) {
      toast.error("Entre em um casal para guardar seu humor.");
      return;
    }
    setSavingRitual(true);
    const { data, error } = await supabase
      .from("daily_moods")
      .upsert(
        {
          couple_id: coupleId,
          author_id: session.user.id,
          mood,
          mood_date: moodDate,
        },
        { onConflict: "couple_id,author_id,mood_date" }
      )
      .select("id, author_id, mood, mood_date")
      .single();
    if (error) toast.error(error.message);
    if (data) {
      const saved = data as DailyMood;
      setDailyMoods(current => [
        ...current.filter(
          item =>
            item.author_id !== saved.author_id ||
            item.mood_date !== saved.mood_date
        ),
        saved,
      ]);
      toast.success(
        `${MOOD_OPTIONS.find(item => item.id === mood)?.emoji ?? "💌"} Seu coração de hoje ficou guardado.`
      );
    }
    setSavingRitual(false);
  }

  async function handleSaveWish() {
    const content = wishDraft.trim();
    if (!content) return;
    const localWish: SharedWish = {
      id: crypto.randomUUID(),
      author_id: currentUserId,
      content,
      fulfilled_at: null,
      created_at: new Date().toISOString(),
    };
    if (isPreview) {
      setSharedWishes(current => [localWish, ...current]);
      setWishDraft("");
      toast.success("Desejo guardado no caderno de vocês.");
      return;
    }
    if (!supabase || !session || !coupleId) {
      toast.error("Entre em um casal para guardar um desejo.");
      return;
    }
    setSavingRitual(true);
    const { data, error } = await supabase
      .from("shared_wishes")
      .insert({ couple_id: coupleId, author_id: session.user.id, content })
      .select("id, author_id, content, fulfilled_at, created_at")
      .single();
    if (error) toast.error(error.message);
    if (data) {
      const saved = data as SharedWish;
      setSharedWishes(current =>
        current.some(item => item.id === saved.id)
          ? current
          : [saved, ...current]
      );
      setWishDraft("");
      toast.success("Desejo guardado no caderno de vocês.");
    }
    setSavingRitual(false);
  }

  async function handleSaveGift() {
    const title = giftTitle.trim();
    const referenceUrl = giftUrl.trim();
    if (!title) return;
    if (referenceUrl) {
      try {
        new URL(referenceUrl);
      } catch {
        toast.error("Use um link válido ou deixe o campo em branco.");
        return;
      }
    }
    const localGift: GiftWish = {
      id: crypto.randomUUID(),
      wished_by: currentUserId,
      title,
      occasion: giftOccasion.trim(),
      notes: giftNotes.trim(),
      reference_url: referenceUrl || null,
      created_at: new Date().toISOString(),
    };
    if (isPreview) {
      setGiftWishes(current => [localGift, ...current]);
      setGiftTitle("");
      setGiftOccasion("");
      setGiftNotes("");
      setGiftUrl("");
      toast.success("Pista de presente guardada com carinho.");
      return;
    }
    if (!supabase || !session || !coupleId) {
      toast.error("Entre em um casal para guardar um presente desejado.");
      return;
    }
    setSavingRitual(true);
    const { data, error } = await supabase
      .from("gift_wishes")
      .insert({
        couple_id: coupleId,
        wished_by: session.user.id,
        title,
        occasion: giftOccasion.trim(),
        notes: giftNotes.trim(),
        reference_url: referenceUrl || null,
      })
      .select(
        "id, wished_by, title, occasion, notes, reference_url, created_at"
      )
      .single();
    if (error) toast.error(error.message);
    if (data) {
      const saved = data as GiftWish;
      setGiftWishes(current =>
        current.some(item => item.id === saved.id)
          ? current
          : [saved, ...current]
      );
      setGiftTitle("");
      setGiftOccasion("");
      setGiftNotes("");
      setGiftUrl("");
      toast.success("Pista de presente guardada com carinho.");
    }
    setSavingRitual(false);
  }

  async function handleCreateInvite() {
    setInviteBusy(true);
    if (isPreview) {
      const code = crypto.randomUUID().replaceAll("-", "").slice(0, 20);
      setInviteCode(code);
      setInviteBusy(false);
      toast.success("Convite de prévia criado.");
      return;
    }
    if (!supabase || !session) {
      toast.error("Entre com sua conta para criar um convite.");
      setInviteBusy(false);
      return;
    }
    const { data, error } = await supabase.rpc("create_partner_invite");
    if (error) {
      toast.error(error.message);
      setInviteBusy(false);
      return;
    }
    const invitation = Array.isArray(data) ? data[0] : data;
    const code = invitation?.invite_code as string | undefined;
    if (!code) {
      toast.error("Não foi possível criar o convite agora.");
      setInviteBusy(false);
      return;
    }
    setInviteCode(code);
    await refreshProfile(session);
    setInviteBusy(false);
    toast.success("Convite privado criado.");
  }

  async function handleCopyInvite() {
    if (!inviteCode) return;
    const url = `${PUBLIC_APP_ORIGIN}/?invite=${inviteCode}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado. Envie-o só para seu parceiro.");
    } catch {
      toast.error(
        "Não foi possível copiar automaticamente. Copie o link exibido."
      );
    }
  }

  async function handleAcceptInvite() {
    const code = acceptCode.trim().toLowerCase();
    if (!code || !supabase || !session) {
      toast.error("Entre com sua conta e informe o código do convite.");
      return;
    }
    setAcceptBusy(true);
    const { data, error } = await supabase.rpc("accept_partner_invite", {
      invite_code: code,
    });
    if (error) toast.error(error.message);
    if (data) {
      setCoupleId(data as string);
      setAcceptCode("");
      setInviteCode("");
      toast.success("Você entrou no caderno compartilhado.");
    }
    setAcceptBusy(false);
  }

  async function handleSignOut() {
    clearProximityWatch();
    clearLocalPrivacyData(
      currentUserId,
      typeof window === "undefined" ? undefined : window.localStorage
    );
    await handleStopLocation(true);
    if (isPreview) {
      setIsPreview(false);
      setPosts([]);
      setMessages([]);
      setPlans([]);
      setNotifications([]);
      setLocations([]);
      clearPhoto();
      return;
    }
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(SPOTIFY_LINK_RETURN_KEY);
    }
    if (supabase) await supabase.auth.signOut({ scope: "local" });
  }

  async function handleDeleteAccount() {
    if (isPreview) {
      toast.message("A prévia não possui uma conta para excluir.");
      return;
    }
    if (!supabase || !session) {
      toast.error("Entre novamente antes de excluir a conta.");
      return;
    }

    try {
      // Renovamos o token no instante da operação destrutiva. Isso evita que
      // uma sessão mantida aberta por muito tempo seja rejeitada pelo servidor.
      const { data: refreshed, error: refreshError } =
        await supabase.auth.refreshSession();
      if (refreshError || !refreshed.session) {
        throw new Error("Sua sessão expirou. Entre novamente para excluir a conta.");
      }
      await handleStopLocation(true);
      await deleteAccountMutation.mutateAsync({
        accessToken: refreshed.session.access_token,
        confirmation: "EXCLUIR",
      });
      clearProximityWatch();
      clearLocalPrivacyData(
        currentUserId,
        typeof window === "undefined" ? undefined : window.localStorage
      );
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(SPOTIFY_LINK_RETURN_KEY);
        window.history.replaceState({}, "", PUBLIC_APP_ORIGIN);
      }
      clearPhoto();
      await supabase.auth.signOut({ scope: "local" });
      setSession(null);
      setCoupleId(null);
      setPosts([]);
      setMessages([]);
      setPlans([]);
      setNotifications([]);
      setLocations([]);
      toast.success("Sua conta foi excluída. Você pode usar este e-mail em uma nova conta.");
    } catch (error) {
      const message =
        error instanceof Error && error.message.includes("sessão")
          ? error.message
          : "Não foi possível excluir a conta agora. Tente novamente.";
      toast.error(message);
    }
  }

  useEffect(() => {
    if (!hasWorkspace) return;
    floatingPanelsRoot.current = { render: renderFloatingPanels };
    return () => {
      renderFloatingPanels(null);
      floatingPanelsRoot.current = null;
    };
  }, [hasWorkspace]);

  useEffect(() => {
    const root = floatingPanelsRoot.current;
    if (!root) return;
    root.render(
      <>
        <FloatingNotifications
          isOpen={notificationsOpen}
          notifications={notifications}
          onClose={() => setNotificationsOpen(false)}
          onToggle={handleNotificationsToggle}
          unreadCount={unreadCount}
        />
        <FloatingRituals
          currentUserId={currentUserId}
          dailyMoods={dailyMoods}
          giftNotes={giftNotes}
          giftOccasion={giftOccasion}
          giftTitle={giftTitle}
          giftUrl={giftUrl}
          giftWishes={giftWishes}
          isOpen={ritualsOpen}
          isPreview={isPreview}
          onGiftNotesChange={setGiftNotes}
          onGiftOccasionChange={setGiftOccasion}
          onGiftTitleChange={setGiftTitle}
          onGiftUrlChange={setGiftUrl}
          onSaveGift={handleSaveGift}
          onSaveMood={handleSaveMood}
          onSaveRelationshipDate={handleSaveRelationshipDate}
          onSaveWish={handleSaveWish}
          onToggle={() => {
            setProximityOpen(false);
            setNotificationsOpen(false);
            setRitualsOpen(current => !current);
          }}
          onWishDraftChange={setWishDraft}
          relationshipStartedOn={relationshipStartedOn}
          saving={savingRitual}
          sharedWishes={sharedWishes}
          wishDraft={wishDraft}
        />
        <FloatingProximity
          currentUserId={currentUserId}
          favoritePlaces={favoritePlaces}
          isOpen={proximityOpen}
          onSavePreference={(place, change) => {
            void handleSaveProximityPreference(place, change);
          }}
          onToggle={handleProximityToggle}
          preferences={proximityPreferences}
          savingPlaceId={savingProximityPlaceId}
        />
      </>
    );
  }, [
    coupleMembers,
    currentUserId,
    dailyMoods,
    editingPlaceId,
    favoritePlaces,
    giftNotes,
    giftOccasion,
    giftTitle,
    giftUrl,
    giftWishes,
    isPreview,
    locationBusy,
    locations,
    notifications,
    notificationsOpen,
    placeCategory,
    placeCoordinates,
    placeFilter,
    placeAddress,
  placeMeaning,
    placeTitle,
    proximityOpen,
    proximityPreferences,
    relationshipStartedOn,
    ritualsOpen,
    savingAvatar,
    savingPlace,
    savingProximityPlaceId,
    savingRitual,
    sharedWishes,
    unreadCount,
    wishDraft,
  ]);

  if (pendingConfirmationEmail && !session)
    return (
      <EmailConfirmationView
        email={pendingConfirmationEmail}
        onBack={() => setPendingConfirmationEmail(null)}
      />
    );
  if (!hasWorkspace)
    return (
      <LoginView
        onAuth={handleAuth}
        onPreview={() => {
          setIsPreview(true);
          setProfileName("Você");
        }}
      />
    );

  const pageTitle = {
    inicio: "Entre páginas, vocês",
    momentos: "Momentos de vocês",
    chat: "Conversa privada",
    planos: "Próximos capítulos",
    contagem: "O tempo de vocês",
    musica: "Sala Spotify",
    widgets: "Pequenos sinais",
    localizacao: "Mapa afetivo",
    leituras: "Leituras a dois",
    filmes: "Filmes para viver",
    mais: "O espaço de vocês",
  }[tab];
  const navItems: { id: AppTab; label: string; icon: typeof HomeIcon }[] = [
    { id: "inicio", label: "Início", icon: HomeIcon },
    { id: "momentos", label: "Momentos", icon: Camera },
    { id: "chat", label: "Chat", icon: MessageCircle },
    { id: "planos", label: "Planos", icon: CalendarDays },
    { id: "contagem", label: "Tempo", icon: Heart },
    { id: "musica", label: "Música", icon: Music2 },
    { id: "widgets", label: "A dois", icon: Sparkles },
    { id: "localizacao", label: "Mapa", icon: MapPin },
    { id: "leituras", label: "Leituras", icon: BookOpen },
    { id: "filmes", label: "Filmes", icon: Clapperboard },
    { id: "mais", label: "Mais", icon: MoreHorizontal },
  ];

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="paper-grain pointer-events-none fixed inset-0 opacity-50" />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[244px] min-h-0 flex-col overflow-hidden border-r border-ink/8 bg-paper/90 px-4 py-6 backdrop-blur-xl lg:flex">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_18%_12%,rgba(201,87,103,0.15),transparent_56%)]" />
        <div className="relative">
          <Brand />
          <div className="mt-7 rounded-[1.15rem] border border-hibiscus/13 bg-white/65 p-3.5 shadow-sm">
            <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.17em] text-hibiscus">
              caderno compartilhado
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-hibiscus text-[0.6rem] font-extrabold text-white">
                V
              </span>
              <span className="relative h-px flex-1 bg-hibiscus/35 before:absolute before:left-1/2 before:top-1/2 before:h-2 before:w-2 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:bg-hibiscus" />
              <span className="grid h-7 w-7 place-items-center rounded-full bg-plum text-[0.6rem] font-extrabold text-white">
                +
              </span>
            </div>
          </div>
        </div>
        <nav
          aria-label="Navegação principal"
          className="relative mt-6 min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pr-1 pb-5 [scrollbar-width:thin]"
          tabIndex={0}
        >
          {navItems.map(item => (
            <NavItem
              active={tab === item.id}
              icon={item.icon}
              key={item.id}
              label={item.label}
              onClick={() => setTab(item.id)}
            />
          ))}
        </nav>
        <div className="relative mt-auto space-y-3">
          <div className="paper-note relative overflow-hidden rounded-[1.2rem] bg-white/80 p-3.5 shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-plum text-xs font-extrabold text-white">
                {profileName.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-ink">
                  {profileName}
                </p>
                <p className="truncate text-xs text-ink/45">
                  {isPreview ? "modo prévia" : "seu espaço"}
                </p>
              </div>
            </div>
          </div>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-xs font-extrabold text-ink/46 transition hover:text-hibiscus"
            onClick={handleSignOut}
            type="button"
          >
            <LogOut className="h-3.5 w-3.5" />
            {isPreview ? "sair da prévia" : "sair"}
          </button>
        </div>
      </aside>
      <header className="sticky top-0 z-20 border-b border-ink/7 bg-paper/90 px-4 py-3 backdrop-blur-xl sm:px-5 sm:py-4 lg:ml-[244px] lg:px-10 xl:px-14">
        <div className="mx-auto flex max-w-[1460px] items-center justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <button
              aria-label="Abrir menu"
              className="grid h-9 w-9 place-items-center rounded-xl bg-white text-ink shadow-sm lg:hidden"
              onClick={() => setMenuOpen(true)}
              type="button"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.18em] text-ink/42">
                seu caderno
              </p>
              <h1 className="mt-0.5 max-w-[calc(100vw-6.5rem)] truncate font-display text-[1.55rem] leading-none tracking-[-0.05em] text-ink sm:max-w-none sm:text-2xl">
                {pageTitle}
              </h1>
            </div>
          </div>
          <div className="hidden sm:block">
            <img
              alt="Símbolo do Caderno de Dois"
              className="h-9 w-9 rounded-full bg-hibiscus-soft p-1.5"
              src={ASSETS.logo}
            />
          </div>
        </div>
      </header>
      {menuOpen && (
        <div
          className="fixed inset-0 z-50 bg-ink/30 p-5 lg:hidden"
          onClick={() => setMenuOpen(false)}
          role="presentation"
        >
          <aside
            className="animate-rise flex h-full min-h-0 w-[min(290px,86vw)] flex-col overflow-hidden rounded-[1.8rem] bg-paper p-5 shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <Brand compact />
              <button
                aria-label="Fechar menu"
                className="rounded-xl bg-white p-2 text-ink"
                onClick={() => setMenuOpen(false)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav
              aria-label="Navegação do menu"
              className="mt-7 min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pr-1 pb-4 [scrollbar-width:thin]"
              tabIndex={0}
            >
              {navItems.map(item => (
                <NavItem
                  active={tab === item.id}
                  icon={item.icon}
                  key={item.id}
                  label={item.label}
                  onClick={() => {
                    setTab(item.id);
                    setMenuOpen(false);
                  }}
                />
              ))}
            </nav>
          </aside>
        </div>
      )}
      <main className="relative z-10 px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-5 sm:px-5 sm:pb-28 sm:pt-7 lg:ml-[244px] lg:px-10 lg:pb-10 xl:px-14">
        <div className="mx-auto max-w-[1460px]">
          <div className="mb-6">
            <div>
              <p className="text-sm font-bold text-ink/52">
                Olá, {profileName}.
              </p>
              <p className="mt-1 max-w-xl text-sm leading-6 text-ink/52">
                {isPreview
                  ? "Experimente o espaço com calma antes de conectar as memórias reais do casal."
                  : coupleId
                    ? "Este é um espaço privado para vocês dois."
                    : "Quando quiser, crie um convite para começar a compartilhar."}
              </p>
            </div>
          </div>
          <div className="grid gap-5 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_290px]">
            <section className="min-w-0">
              {tab === "inicio" && (
                <FeedPanel
                  busy={posting}
                  currentUserId={currentUserId}
                  isPreview={isPreview}
                  onChange={setPostDraft}
                  onClearPhoto={clearPhoto}
                  onDeletePost={post => {
                    void handleDeletePost(post);
                  }}
                  onEditPost={post => {
                    void handleEditPost(post);
                  }}
                  onPhotoChange={handlePhotoChange}
                  onSubmit={handlePost}
                  photoName={selectedPhoto?.name}
                  photoPreview={photoPreview}
                  posts={posts}
                  value={postDraft}
                />
              )}
              {tab === "momentos" && (
                <MomentsPanel
                  busy={posting}
                  currentUserId={currentUserId}
                  onChange={setPostDraft}
                  onChooseWidgetMoment={handleChooseWidgetMoment}
                  onClearPhoto={clearPhoto}
                  onDeletePost={post => {
                    void handleDeletePost(post);
                  }}
                  onEditPost={post => {
                    void handleEditPost(post);
                  }}
                  onPhotoChange={handlePhotoChange}
                  onSubmit={() => {
                    void handlePost();
                  }}
                  photoName={selectedPhoto?.name}
                  photoPreview={photoPreview}
                  posts={posts}
                  value={postDraft}
                  widgetMomentId={widgetMomentId}
                />
              )}
              {tab === "chat" && (
                <ChatPanel
                  busy={sending}
                  currentUserId={currentUserId}
                  isPreview={isPreview}
                  messages={messages}
                  onChange={setMessageDraft}
                  onDeleteMessage={message => {
                    void handleDeleteMessage(message);
                  }}
                  onEditMessage={message => {
                    void handleEditMessage(message);
                  }}
                  onSend={handleSend}
                  value={messageDraft}
                />
              )}
              {tab === "planos" && (
                <PlansPanel
                  busy={savingPlan}
                  currentUserId={currentUserId}
                  isPreview={isPreview}
                  onCreatePlan={handleCreatePlan}
                  onDeletePlan={plan => {
                    void handleDeletePlan(plan);
                  }}
                  onEditPlan={plan => {
                    void handleEditPlan(plan);
                  }}
                  onPlanDetailsChange={setPlanDetails}
                  onPlanTitleChange={setPlanTitle}
                  onSelectDate={setSelectedDate}
                  onTogglePlan={handleTogglePlan}
                  planDetails={planDetails}
                  planTitle={planTitle}
                  plans={plans}
                  selectedDate={selectedDate}
                />
              )}
              {tab === "contagem" && (
                <RelationshipCounterPanel
                  canInstallCounter={Boolean(deferredInstallPrompt)}
                  onAddCounterToHome={() => {
                    void handleAddCounterToHome();
                  }}
                  onSaveRelationshipDate={handleSaveRelationshipDate}
                  relationshipStartedOn={relationshipStartedOn}
                  saving={savingRitual}
                />
              )}
              {tab === "musica" && (
                <MusicPanel
                  busy={savingMusic}
                  isPreview={isPreview}
                  jamDraft={jamDraft}
                  musicRoom={musicRoom}
                  onAddTrack={handleAddMusicTrack}
                  onConnectSpotify={() => {
                    void handleConnectSpotify();
                  }}
                  onCopyInvite={handleCopyMusicInvite}
                  onCreateRoom={handleCreateMusicRoom}
                  onCreateSpotifyPlaylist={() => {
                    void handleCreateSpotifyPlaylist();
                  }}
                  onEndRoom={handleEndMusicRoom}
                  onJamDraftChange={setJamDraft}
                  onOpenSpotifyPlaylist={handleOpenSpotifyPlaylist}
                  onRemoveTrack={handleRemoveMusicTrack}
                  onRoomTitleChange={setMusicRoomTitle}
                  onSaveJam={handleSaveJam}
                  onTrackArtistChange={setTrackArtist}
                  onTrackNoteChange={setTrackNote}
                  onTrackTitleChange={setTrackTitle}
                  onTrackUrlChange={setTrackUrl}
                  queue={musicQueue}
                  roomTitle={musicRoomTitle}
                  spotifyBusy={spotifyLinking}
                  spotifyConnected={spotifyConnected}
                  spotifyPlaylistCreating={spotifyPlaylistCreating}
                  spotifyName={spotifyName}
                  trackArtist={trackArtist}
                  trackNote={trackNote}
                  trackTitle={trackTitle}
                  trackUrl={trackUrl}
                />
              )}
              {tab === "widgets" && (
                <WidgetsPanel
                  batteryChargingDraft={batteryChargingDraft}
                  batteryLevelDraft={batteryLevelDraft}
                  batterySnapshots={batterySnapshots}
                  busy={widgetBusy}
                  currentUserId={currentUserId}
                  isPreview={isPreview}
                  onAnswerQuiz={handleAnswerQuiz}
                  onBatteryChargingChange={setBatteryChargingDraft}
                  onBatteryLevelChange={setBatteryLevelDraft}
                  onSaveWeatherCity={() => {
                    void handleSaveWeatherCity();
                  }}
                  onShareBattery={() => {
                    void handleShareBattery();
                  }}
                  onShareBatteryManually={handleShareBatteryManually}
                  onWeatherCityChange={setWeatherCityDraft}
                  quizAnswers={quizAnswers}
                  relationshipStartedOn={relationshipStartedOn}
                  weatherCityDraft={weatherCityDraft}
                  weatherSnapshot={weatherSnapshot}
                />
              )}
              {tab === "localizacao" && (
                <LocationTab
                  addressBusy={addressBusy}
                  busy={locationBusy}
                  coupleMembers={coupleMembers}
                  currentUserId={currentUserId}
                  editingPlaceId={editingPlaceId}
                  favoritePlaces={favoritePlaces}
                  isPreview={isPreview}
                  locations={locations}
                  onAvatarUpload={file => {
                    void handleAvatarUpload(file);
                  }}
                  onCancelEdit={resetPlaceDraft}
                  onDeletePlace={place => {
                    void handleDeletePlace(place);
                  }}
                  onEditPlace={handleEditPlace}
                  onOpenProximity={() => setProximityOpen(true)}
                  onRefresh={handleRefreshLocation}
                  onPlaceCategoryChange={setPlaceCategory}
                  onPlaceFilterChange={setPlaceFilter}
                  onSavePlace={() => {
                    void handleSaveFavoritePlace();
                  }}
                  onStart={handleStartLocation}
                  onStop={() => {
                    void handleStopLocation();
                  }}
                  onFindAddress={handleFindAddress}
                  onUseCurrentPosition={handleUseCurrentPositionForPlace}
                  placeCategory={placeCategory}
                   placeCoordinates={placeCoordinates}
                   placeFilter={placeFilter}
                   placeAddress={placeAddress}
                   placeMeaning={placeMeaning}
                  placeTitle={placeTitle}
                  savingAvatar={savingAvatar}
                  savingPlace={savingPlace}
                   setPlaceAddress={setPlaceAddress}
                   setPlaceMeaning={setPlaceMeaning}
                   setPlaceTitle={setPlaceTitle}
                />
              )}
              {tab === "leituras" && (
                <LibraryPanel
                  busy={savingLibrary}
                  creator={libraryCreatorDraft}
                  currentUserId={currentUserId}
                  items={libraryItems.filter(item => item.item_type === "book")}
                  kind="book"
                  notes={libraryNotesDraft}
                  onAdd={() => {
                    void handleAddLibraryItem("book");
                  }}
                  onChangeStatus={(item, status) => {
                    void handleLibraryStatus(item, status);
                  }}
                  onCreatorChange={setLibraryCreatorDraft}
                  onDelete={item => {
                    void handleDeleteLibraryItem(item);
                  }}
                  onEdit={item => {
                    void handleEditLibraryItem(item);
                  }}
                  onNotesChange={setLibraryNotesDraft}
                  onReleaseOnChange={setLibraryReleaseDraft}
                  onTitleChange={setLibraryTitleDraft}
                  releaseOn={libraryReleaseDraft}
                  title={libraryTitleDraft}
                />
              )}
              {tab === "filmes" && (
                <LibraryPanel
                  busy={savingLibrary}
                  creator={libraryCreatorDraft}
                  currentUserId={currentUserId}
                  items={libraryItems.filter(item => item.item_type === "movie")}
                  kind="movie"
                  notes={libraryNotesDraft}
                  onAdd={() => {
                    void handleAddLibraryItem("movie");
                  }}
                  onChangeStatus={(item, status) => {
                    void handleLibraryStatus(item, status);
                  }}
                  onCreatorChange={setLibraryCreatorDraft}
                  onDelete={item => {
                    void handleDeleteLibraryItem(item);
                  }}
                  onEdit={item => {
                    void handleEditLibraryItem(item);
                  }}
                  onNotesChange={setLibraryNotesDraft}
                  onReleaseOnChange={setLibraryReleaseDraft}
                  onTitleChange={setLibraryTitleDraft}
                  releaseOn={libraryReleaseDraft}
                  title={libraryTitleDraft}
                />
              )}
              {tab === "mais" && (
                <MorePanel
                  acceptBusy={acceptBusy}
                  acceptCode={acceptCode}
                  configured={isSupabaseConfigured}
                  hasCouple={hasCompleteCouple}
                  inviteBusy={inviteBusy}
                  inviteCode={inviteCode}
                  isPreview={isPreview}
                  onAcceptCodeChange={setAcceptCode}
                  onAcceptInvite={handleAcceptInvite}
                  onCopyInvite={handleCopyInvite}
                  onCreateInvite={handleCreateInvite}
                  onDeleteAccount={() => {
                    void handleDeleteAccount();
                  }}
                  onSignOut={() => {
                    void handleSignOut();
                  }}
                  deletingAccount={deleteAccountMutation.isPending}
                />
              )}
            </section>
            <RightRail
              activeTab={tab}
              hasCouple={hasCompleteCouple}
              onInvite={() => setTab("mais")}
            />
          </div>
        </div>
      </main>
      <nav
        aria-label="Navegação móvel"
        className="mobile-tab-bar fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 flex touch-pan-x gap-1 overflow-x-auto rounded-[1.35rem] border border-white/80 bg-white/92 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_12px_36px_rgba(55,35,42,0.16)] backdrop-blur-xl [scrollbar-width:none] lg:hidden"
      >
        {navItems.map(item => {
          const Icon = item.icon;
          const active = item.id === tab;
          return (
            <button
              aria-current={active ? "page" : undefined}
              className={`grid min-h-11 min-w-[4.4rem] shrink-0 place-items-center gap-1 rounded-xl px-2 py-2 text-[0.6rem] font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hibiscus focus-visible:ring-offset-2 ${active ? "bg-hibiscus text-white" : "text-ink/54"}`}
              key={item.id}
              onClick={() => setTab(item.id)}
              type="button"
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
