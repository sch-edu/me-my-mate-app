import {
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  ArrowDownToLine,
  ArrowUpToLine,
  BookOpen,
  Calendar,
  Check,
  ChevronRight,
  CircleHelp,
  Clock,
  Code2,
  Copy,
  Flame,
  Gauge,
  Home as House,
  Info,
  Link2,
  LogIn,
  LogOut,
  Moon,
  PencilLine,
  Play,
  Plus,
  RotateCcw,
  Settings,
  Share2,
  Shield,
  ShieldAlert,
  Sparkles,
  Sun,
  Timer,
  Trophy,
  Upload,
  User as UserIcon,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { Link, Route, Switch as WouterSwitch, Router as WouterRouter, useLocation, useParams } from 'wouter';
import type { User } from 'firebase/auth';
import type { Card, DraftTopic, Knight, Theme, Topic } from '@/types';
import {
  firebaseConfigured,
  loadCloudKnights,
  loadSharedKnight,
  logOut,
  saveCloudKnight,
  saveSharedKnight,
  signInWithEmail,
  signUpWithEmail,
  subscribeToFirebaseAuth,
} from '@/lib/firebase';
import {
  type SoundEffect,
  type SoundSettings,
  getSoundVolume,
  isSoundEnabled,
  playSound,
  setSoundEnabled as updateSoundEnabled,
  setSoundVolume as updateSoundVolume,
  subscribeSoundSettings,
} from '@/lib/sounds';

const queryClient = new QueryClient();
const STORAGE_KEY = 'memy-mate-knights-v1';
const THEME_KEY = 'memy-mate-theme-v1';
const SHARED_KEY = 'memy-mate-shared-v1';
const GUEST_CREATED_KEY = 'memy-mate-guest-created-at-v1';
const POLICY_DISMISSED_KEY = 'memy-mate-policy-dismissed-v1';

const seededKnights: Knight[] = [
  {
    id: 'neural-pathways',
    name: 'Neural Pathways',
    topic: 'Biology · Chapter 04',
    description: 'The signals behind how we learn, move, and remember.',
    sessions: 6,
    bestScore: 88,
    createdAt: '2026-01-12',
    cards: [
      { id: 'np-1', prompt: 'What is a synapse?', answer: 'The junction where one neuron communicates with another cell.', seconds: 12 },
      { id: 'np-2', prompt: 'Name the two major types of neurotransmitters.', answer: 'Excitatory and inhibitory neurotransmitters.', seconds: 12 },
      { id: 'np-3', prompt: 'What does long-term potentiation strengthen?', answer: 'The connection between neurons after repeated activation.', seconds: 12 },
    ],
  },
  {
    id: 'french-cafe',
    name: 'French at the Café',
    topic: 'Language · Starter set',
    description: 'Small phrases for a brave first conversation.',
    sessions: 3,
    bestScore: 64,
    createdAt: '2026-01-19',
    cards: [
      { id: 'fr-1', prompt: 'How do you ask for a coffee?', answer: 'Je voudrais un café, s’il vous plaît.', seconds: 10 },
      { id: 'fr-2', prompt: 'What does “à bientôt” mean?', answer: 'See you soon.', seconds: 10 },
    ],
  },
  {
    id: 'design-principles',
    name: 'Design Principles',
    topic: 'Studio · Foundations',
    description: 'A compact set for making visual decisions with intent.',
    sessions: 0,
    bestScore: 0,
    createdAt: '2026-02-01',
    cards: [
      { id: 'dp-1', prompt: 'What creates visual hierarchy?', answer: 'Difference: size, weight, color, spacing, or position.', seconds: 14 },
      { id: 'dp-2', prompt: 'Why use a spacing system?', answer: 'To make relationships predictable and the interface easier to scan.', seconds: 14 },
    ],
  },
];

function getTopics(knight: Knight): Topic[] {
  if (knight.topics?.length) return knight.topics;
  return [{ id: `${knight.id}-topic`, name: knight.topic, cards: knight.cards }];
}

function getCards(knight: Knight): Card[] {
  return getTopics(knight).flatMap((topic) => topic.cards);
}

function autoSeconds(text: string): number {
  return Math.max(1, Math.ceil(text.length / 20));
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function getGuestCreatedAt(): string {
  if (typeof window === 'undefined') return new Date().toISOString();
  try {
    let stored = window.localStorage.getItem(GUEST_CREATED_KEY);
    if (!stored) {
      stored = new Date().toISOString();
      window.localStorage.setItem(GUEST_CREATED_KEY, stored);
    }
    return stored;
  } catch {
    return new Date().toISOString();
  }
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Recently';
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return 'Recently';
  }
}

function getDaysActive(createdAtIso: string): number {
  try {
    const created = new Date(createdAtIso).getTime();
    if (Number.isNaN(created)) return 1;
    const diff = Math.max(0, Date.now() - created);
    return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)) + 1);
  } catch {
    return 1;
  }
}

function exportKnightsAsJson(knights: Knight[]): void {
  const data = {
    app: 'MeMyMate by ARCT',
    version: '2.0.0',
    exportedAt: new Date().toISOString(),
    deckCount: knights.length,
    knights,
  };
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `memymate-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  playSound('correct');
}

type AuthModalOptions = {
  prompt?: string;
  defaultTab?: 'signin' | 'signup';
};

type AppState = {
  knights: Knight[];
  addKnight: (knight: Knight) => void;
  updateKnight: (id: string, patch: Partial<Knight>) => void;
  shareKnight: (knight: Knight) => Promise<string | null>;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  firebaseUser: User | null;
  firebaseReady: boolean;
  isGuest: boolean;
  openAuthModal: (options?: AuthModalOptions) => void;
  closeAuthModal: () => void;
  signOutUser: () => Promise<void>;
  soundSettings: SoundSettings;
  setSoundEnabled: (enabled: boolean) => void;
  setSoundVolume: (volume: number) => void;
  accountCreatedAt: string;
  daysActive: number;
  downloadBackup: () => void;
  importKnights: (imported: Knight[]) => void;
};

const AppContext = createContext<AppState | null>(null);

export const useAppState = () => {
  const value = useContext(AppContext);
  if (!value) throw new Error('MeMyMate state is unavailable');
  return value;
};

function readKnights(): Knight[] {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : seededKnights;
  } catch {
    return seededKnights;
  }
}

function readTheme(): Theme {
  const stored = window.localStorage.getItem(THEME_KEY);
  return stored === 'dark' || stored === 'sunset' ? stored : 'light';
}

function sharePath(id: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/share/${encodeURIComponent(id)}`;
}

function saveLocalSharedKnight(knight: Knight): void {
  try {
    const current = JSON.parse(window.localStorage.getItem(SHARED_KEY) || '{}') as Record<string, Knight>;
    window.localStorage.setItem(SHARED_KEY, JSON.stringify({ ...current, [knight.id]: knight }));
  } catch {
    // Sharing still returns a usable link when local storage is unavailable.
  }
}

function loadLocalSharedKnight(id: string): Knight | null {
  try {
    const current = JSON.parse(window.localStorage.getItem(SHARED_KEY) || '{}') as Record<string, Knight>;
    return current[id] ?? null;
  } catch {
    return null;
  }
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const input = document.createElement('textarea');
  input.value = text;
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  input.remove();
}

function LogoMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand" aria-label="MeMyMate home">
      <span className="brand-symbol">M</span>
      {!compact && (
        <span className="brand-name">
          MeMy<b>Mate</b>
        </span>
      )}
    </span>
  );
}

const navItems = [
  { href: '/', label: 'Dashboard', icon: House },
  { href: '/create', label: 'Create a Knight', icon: Plus },
  { href: '/guide', label: 'Quick guide', icon: CircleHelp },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function Navigation() {
  const [location] = useLocation();
  const { firebaseUser, isGuest, openAuthModal } = useAppState();
  return (
    <>
      <aside className="sidebar">
        <Link href="/" className="brand" data-testid="link-brand">
          <LogoMark />
        </Link>
        <nav className="nav-list" aria-label="Main navigation">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`nav-link ${location === href ? 'active' : ''}`}
              aria-current={location === href ? 'page' : undefined}
              data-testid={`link-${label.toLowerCase().replaceAll(' ', '-')}`}
              onClick={() => playSound('click')}
            >
              <Icon className="nav-icon" strokeWidth={1.8} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="side-bottom">
          <Link
            href="/guide"
            className="button button-soft"
            data-testid="button-open-guide"
            onClick={() => playSound('click')}
          >
            <BookOpen size={15} /> How it works
          </Link>

          {isGuest ? (
            <button
              type="button"
              className="profile-chip"
              style={{ width: '100%', textAlign: 'left', cursor: 'pointer', border: 'none', background: 'transparent' }}
              onClick={() => {
                playSound('click');
                openAuthModal({ prompt: 'Sign in to sync your flashcards across devices and share decks.' });
              }}
              title="Click to sign in or create an account"
              data-testid="button-sidebar-signin"
            >
              <span className="avatar">GM</span>
              <span>
                <strong>Guest Student</strong>
                <small style={{ color: 'hsl(var(--accent))' }}>Tap to sign in &amp; sync</small>
              </span>
            </button>
          ) : (
            <div className="profile-chip" data-testid="chip-signed-in">
              <span className="avatar" style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))' }}>
                {firebaseUser?.email ? firebaseUser.email.slice(0, 2).toUpperCase() : 'MM'}
              </span>
              <span>
                <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px', display: 'block' }}>
                  {firebaseUser?.email ?? 'Student'}
                </strong>
                <small style={{ color: '#10b981' }}>Cloud synced</small>
              </span>
            </div>
          )}
        </div>
      </aside>
      <nav className="mobile-bar" aria-label="Mobile navigation">
        {navItems.slice(0, 4).map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`nav-link ${location === href ? 'active' : ''}`}
            aria-current={location === href ? 'page' : undefined}
            data-testid={`mobile-link-${label.toLowerCase().replaceAll(' ', '-')}`}
            onClick={() => playSound('click')}
          >
            <Icon className="nav-icon" strokeWidth={1.8} />
            <span>{label.split(' ')[0]}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <Navigation />
      <main className="main">
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <div className="page-wrap" id="main-content" tabIndex={-1}>
          {children}
        </div>
      </main>
    </div>
  );
}

function Topbar({ current }: { current: string }) {
  const { isGuest, openAuthModal } = useAppState();
  return (
    <header className="topbar">
      <div className="breadcrumb">
        <span>MeMyMate</span>
        <ChevronRight size={12} style={{ verticalAlign: 'middle', margin: '0 5px' }} />
        <strong>{current}</strong>
      </div>
      <div className="top-actions">
        {isGuest && (
          <button
            type="button"
            className="button button-soft"
            style={{ padding: '7px 12px', fontSize: 12 }}
            onClick={() => {
              playSound('click');
              openAuthModal();
            }}
            data-testid="button-top-auth"
          >
            <LogIn size={14} /> Sign in
          </button>
        )}
        <Link
          href="/guide"
          className="icon-button"
          aria-label="Open quick guide"
          data-testid="button-top-guide"
          onClick={() => playSound('click')}
        >
          <CircleHelp size={17} />
        </Link>
        <Link
          href="/settings"
          className="icon-button"
          aria-label="Open settings"
          data-testid="button-top-settings"
          onClick={() => playSound('click')}
        >
          <Settings size={17} />
        </Link>
        <Link
          href="/create"
          className="button button-primary"
          data-testid="button-top-create"
          onClick={() => playSound('click')}
        >
          <Plus size={15} /> New Knight
        </Link>
      </div>
    </header>
  );
}

/**
 * Cinematic Splash Screen:
 * Retro, cinematic "MeMyMate by ARCT" splash screen on launch with the
 * transparent ARCT logo and synthesized retro chime chords.
 */
function CinematicSplash({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => {
    // Synthesize retro chime chords on launch
    playSound('chime');
  }, []);

  const handleEnter = () => {
    playSound('click');
    onDismiss();
  };

  return (
    <div className="splash-retro fade-in" data-testid="status-splash">
      <div className="splash-scanlines" />
      <div className="splash-bloom" />

      <div className="splash-center">
        <div className="splash-logo-wrap">
          <img
            src={`${import.meta.env.BASE_URL}arct-logo.png`}
            alt="ARCT Logo"
            className="splash-logo-img"
          />
        </div>

        <h1 className="splash-retro-title">MeMyMate</h1>
        <div className="splash-arct-badge">[ BY ARCT ]</div>
        <p className="splash-tagline">Cinematic Memory Arena</p>

        <div className="splash-footer-action">
          <button
            type="button"
            className="splash-enter-btn"
            onClick={handleEnter}
            data-testid="button-enter-arena"
          >
            <Sparkles size={16} /> Enter the Arena
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Auth Modal Dialog for Email/Password Sign Up & Sign In with Guest Mode Support.
 */
function AuthModal({
  isOpen,
  onClose,
  initialPrompt,
  initialTab = 'signin',
}: {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
  initialTab?: 'signin' | 'signup';
}) {
  const [tab, setTab] = useState<'signin' | 'signup'>(initialTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setError('');
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Please provide both an email and a password.');
      playSound('error');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      playSound('error');
      return;
    }

    setLoading(true);
    try {
      if (tab === 'signup') {
        await signUpWithEmail(email.trim(), password);
        playSound('levelup');
      } else {
        await signInWithEmail(email.trim(), password);
        playSound('correct');
      }
      setLoading(false);
      onClose();
    } catch (err: unknown) {
      setLoading(false);
      playSound('error');
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password') || msg.includes('auth/user-not-found')) {
        setError('Invalid email or password. Please try again.');
      } else if (msg.includes('auth/email-already-in-use')) {
        setError('This email is already registered. Please sign in instead.');
      } else if (msg.includes('auth/weak-password')) {
        setError('Password should be at least 6 characters.');
      } else {
        setError(msg || 'Authentication failed. Please try again.');
      }
    }
  };

  const handleGuest = () => {
    playSound('click');
    onClose();
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose} data-testid="auth-modal">
      <div className="auth-modal-card rise-in" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <LogoMark compact />
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
            data-testid="button-close-auth-modal"
          >
            <X size={16} />
          </button>
        </div>

        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            className={`auth-tab ${tab === 'signin' ? 'active' : ''}`}
            onClick={() => {
              setTab('signin');
              setError('');
              playSound('click');
            }}
            data-testid="button-tab-signin"
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab ${tab === 'signup' ? 'active' : ''}`}
            onClick={() => {
              setTab('signup');
              setError('');
              playSound('click');
            }}
            data-testid="button-tab-signup"
          >
            Create Account
          </button>
        </div>

        {initialPrompt && (
          <p style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', marginBottom: 16, lineHeight: 1.5 }}>
            {initialPrompt}
          </p>
        )}

        {error && (
          <div className="auth-error" role="alert" data-testid="auth-error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="auth-email">Email Address</label>
            <input
              id="auth-email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
              data-testid="input-auth-email"
            />
          </div>
          <div className="auth-field">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              data-testid="input-auth-password"
            />
          </div>

          <div className="auth-actions">
            <button
              type="submit"
              className="button button-primary"
              disabled={loading}
              data-testid="button-submit-auth"
            >
              {loading ? 'Connecting…' : tab === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
            <button
              type="button"
              className="button button-ghost"
              onClick={handleGuest}
              data-testid="button-stay-guest"
            >
              Continue as Guest (Device-only)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * 30-Day Account Policy Dashboard Banner
 */
function PolicyBanner({ onDownloadBackup }: { onDownloadBackup: () => void }) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(POLICY_DISMISSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    playSound('click');
    setDismissed(true);
    try {
      window.localStorage.setItem(POLICY_DISMISSED_KEY, 'true');
    } catch {
      // Storage unavailable
    }
  };

  return (
    <section className="policy-banner rise-in" data-testid="banner-30day-policy">
      <div className="policy-banner-content">
        <div className="policy-banner-icon">
          <Clock size={20} />
        </div>
        <div className="policy-banner-text">
          <strong>30-Day Account Lifecycle Notice</strong>
          <p>
            Study decks and practice sessions are maintained for 30 days of inactivity. Safeguard your Knights with a
            1-tap JSON backup anytime.
          </p>
        </div>
      </div>
      <div className="policy-banner-actions">
        <button
          type="button"
          className="button button-soft"
          onClick={() => {
            onDownloadBackup();
          }}
          data-testid="button-banner-download-backup"
          style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <ArrowDownToLine size={14} /> Download Backup
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={handleDismiss}
          aria-label="Dismiss 30-day notice"
          title="Dismiss notice"
          data-testid="button-banner-dismiss"
        >
          <X size={15} />
        </button>
      </div>
    </section>
  );
}

function Home() {
  const { knights, shareKnight, isGuest, downloadBackup } = useAppState();
  const featured = knights[0];
  const totalCards = knights.reduce((sum, knight) => sum + getCards(knight).length, 0);
  const [sharedId, setSharedId] = useState('');

  const handleShare = async (event: MouseEvent, knight: Knight) => {
    event.preventDefault();
    event.stopPropagation();
    playSound('click');
    try {
      const link = await shareKnight(knight);
      if (link) {
        await copyText(link);
        setSharedId(knight.id);
        playSound('correct');
        window.setTimeout(() => setSharedId(''), 2800);
      }
    } catch {
      setSharedId('');
    }
  };

  return (
    <Shell>
      <Topbar current="Dashboard" />

      {/* 30-Day Lifecycle Reminder Banner with 1-tap backup */}
      <PolicyBanner onDownloadBackup={downloadBackup} />

      <section className="hero-grid fade-in">
        <div>
          <div className="eyebrow">Your study arena</div>
          <h1 className="display hero-title">
            Ready to make
            <br />
            memory <em>stick?</em>
          </h1>
          <p className="hero-copy">
            Turn your notes into Knights, then take them for a quick speaking-and-tapping duel. One card at a time. No
            dull drills.
          </p>
          <div style={{ marginTop: 24 }}>
            <Link
              href={`/practice/${featured.id}`}
              className="button button-primary"
              data-testid="button-continue-practice"
              onClick={() => playSound('click')}
            >
              <Play size={15} fill="currentColor" /> Continue practice
            </Link>
          </div>
        </div>
        <div className="level-card rise-in stagger-2">
          <div className="level-meta">
            <span>Your progress</span>
            <strong>LEVEL 04</strong>
          </div>
          <h3 className="display">Pathfinder</h3>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: '68%' }} />
          </div>
          <div className="level-foot">
            <span>340 XP to next rank</span>
            <span>68%</span>
          </div>
        </div>
      </section>

      <div className="section-head">
        <div>
          <h2 className="display">Your Knights</h2>
          <p>Small challenges, real recall.</p>
        </div>
        <Link
          href="/create"
          className="text-link"
          data-testid="link-see-create"
          onClick={() => playSound('click')}
        >
          Build a new one <ChevronRight size={14} style={{ verticalAlign: 'middle' }} />
        </Link>
      </div>

      <section className="knight-grid" aria-label="Your Knights">
        {knights.slice(0, 3).map((knight, index) => (
          <Link
            href={`/practice/${knight.id}`}
            key={knight.id}
            className={`knight-card rise-in stagger-${index + 1} ${index === 0 ? 'large' : ''}`}
            data-testid={`card-knight-${knight.id}`}
            onClick={() => playSound('click')}
          >
            <div className="card-art">
              <span className="card-number">0{index + 1} / KNIGHT</span>
            </div>
            <div className="card-body">
              <span className="tag">{knight.topic.split(' · ')[0]}</span>
              <h3>{knight.name}</h3>
              <p>{knight.description}</p>
              <div className="card-bottom">
                <span>
                  {getTopics(knight).length} topics · {getCards(knight).length} cards
                </span>
                <span className="card-actions">
                  <span>{knight.bestScore ? `${knight.bestScore}% best` : 'Not started'}</span>
                  <button
                    type="button"
                    className="card-share"
                    onClick={(event) => void handleShare(event, knight)}
                    aria-label={`Copy share link for ${knight.name}`}
                    title={isGuest ? 'Sign in to share public study link' : 'Copy share link'}
                    data-testid={`button-share-${knight.id}`}
                  >
                    <Share2 size={13} />
                    {sharedId === knight.id ? 'Copied' : 'Share'}
                  </button>
                </span>
              </div>
            </div>
          </Link>
        ))}
      </section>
      <p className="share-note" aria-live="polite">
        {sharedId
          ? 'Share link copied! Anyone with the link can open a read-only study preview.'
          : isGuest
          ? 'Guest mode: flashcards stay locally on this device. Sign in to share cloud decks.'
          : 'Share any Knight with a friend from its card.'}
      </p>

      <div className="section-head">
        <div>
          <h2 className="display">Your rhythm</h2>
          <p>A little consistency beats a perfect plan.</p>
        </div>
      </div>
      <section className="stats-row">
        <div className="stat-card">
          <span className="label">Cards in your armory</span>
          <strong className="value">
            {totalCards}
            <small> total</small>
          </strong>
        </div>
        <div className="stat-card">
          <span className="label">Practice sessions</span>
          <strong className="value">
            {knights.reduce((sum, knight) => sum + knight.sessions, 0)}
            <small> wins</small>
          </strong>
        </div>
        <div className="stat-card streak-card">
          <span className="label">
            <Flame size={13} style={{ verticalAlign: 'middle' }} /> Current streak
          </span>
          <strong className="value">
            4<small> days</small>
          </strong>
          <div className="streak-dots" aria-label="Four day streak">
            <i className="on" />
            <i className="on" />
            <i className="on" />
            <i className="on" />
            <i />
          </div>
        </div>
      </section>
    </Shell>
  );
}

function parseCardBody(body: string, secondsToken?: string, repetitionsToken?: string): Card {
  const [promptPart, answerPart] = body.trim().split(/\s*(?:=>|->|\|)\s*/, 2);
  const prompt = answerPart ? promptPart.trim() : 'Say the memorized content';
  const answer = (answerPart ?? promptPart).trim();
  const requestedSeconds = Number(secondsToken);
  const requestedRepetitions = Number(repetitionsToken);
  return {
    id: makeId('card'),
    prompt,
    answer,
    seconds: requestedSeconds > 0 ? requestedSeconds : autoSeconds(answer),
    repetitions: requestedRepetitions > 0 ? Math.floor(requestedRepetitions) : 1,
  };
}

function parseKnightLanguage(
  input: string,
  fallbackTopic: string,
): { name: string; topic: string; topics: Topic[]; cards: Card[] } {
  const lines = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  let name = fallbackTopic.trim() || 'Untitled Knight';
  let currentTopic = 'Custom set';
  const topicMap = new Map<string, Card[]>();
  const ensureTopic = (topicName: string) => {
    currentTopic = topicName.trim() || `Topic ${topicMap.size + 1}`;
    if (!topicMap.has(currentTopic)) topicMap.set(currentTopic, []);
  };
  ensureTopic(currentTopic);

  const xmlTokens = /<topic\d*\s*>([\s\S]*?)<\/topic\s*>|<k\d*(?:\s+([\d.]+))?\s*>([\s\S]*?)<(\d+)?\/k\s*>/gi;
  const titleMatch = input.match(/<title\s*>([\s\S]*?)<\/title\s*>/i);
  if (titleMatch) name = titleMatch[1].trim();
  let xmlMatch: RegExpExecArray | null;
  let hadXml = false;
  while ((xmlMatch = xmlTokens.exec(input))) {
    hadXml = true;
    if (xmlMatch[1] !== undefined) {
      ensureTopic(xmlMatch[1]);
    } else {
      topicMap.get(currentTopic)?.push(parseCardBody(xmlMatch[3], xmlMatch[2], xmlMatch[4]));
    }
  }

  if (!hadXml) {
    for (const line of lines) {
      const topicMatch = line.match(/^(?:topic|title|name)\s*[:=]\s*(.+)$/i) ?? line.match(/^\[topic\]\s*(.+)$/i);
      if (topicMatch) {
        const topicName = topicMatch[1].trim();
        if (/^(?:title|name)$/i.test(topicMatch[0].split(/[:=]/)[0].trim())) name = topicName;
        ensureTopic(topicName);
        continue;
      }
      const cardMatch =
        line.match(/^(?:k|card)\s*(?:(\d+(?:\.\d+)?)\s*)?(?:x(\d+)\s*)?(?::|=)\s*(.+)$/i) ??
        line.match(/^\[k\]\s*(.+)$/i);
      if (cardMatch) {
        const body = cardMatch[3] ?? cardMatch[1] ?? cardMatch[2];
        if (body) topicMap.get(currentTopic)?.push(parseCardBody(body, cardMatch[1], cardMatch[2]));
      }
    }
    if (!Array.from(topicMap.values()).some((cards) => cards.length)) {
      for (const line of lines) {
        if (/^(?:topic|title|name|k|card)\b/i.test(line)) continue;
        topicMap.get(currentTopic)?.push(parseCardBody(line));
      }
    }
  }

  const topics = Array.from(topicMap.entries())
    .map(([topicName, cards], index) => ({
      id: makeId(`topic-${index}`),
      name: topicName,
      cards: cards.slice(0, 50),
    }))
    .filter((topic) => topic.cards.length);
  if (!topics.length) topics.push({ id: makeId('topic'), name: currentTopic, cards: [] });
  const cards = topics.flatMap((topic) => topic.cards);
  const firstTopic = topics[0]?.name ?? 'Custom set';
  if (name === fallbackTopic && firstTopic !== 'Custom set') name = firstTopic;
  return { name, topic: topics.length > 1 ? `${firstTopic} · ${topics.length} topics` : firstTopic, topics, cards };
}

function CreatePage() {
  const [, setLocation] = useLocation();
  const { addKnight } = useAppState();
  const [mode, setMode] = useState<'typed' | 'language'>('typed');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [typedTopics, setTypedTopics] = useState<DraftTopic[]>([
    {
      id: 'topic-draft-1',
      name: 'Topic 1',
      cards: [{ id: 'card-draft-1', prompt: '', answer: '', seconds: 1, repetitions: 1 }],
    },
  ]);
  const [language, setLanguage] = useState(
    '<knightcode>\n<title>The Water Cycle</title>\n<topic1>Evaporation</topic>\n<k1 5>What powers evaporation? => Heat from the sun.<3/k>\n<topic2>Rainfall</topic>\n<k1>Where does rain begin? => In clouds, when water vapor condenses.</k>\n</knightcode>',
  );
  const [error, setError] = useState('');
  const [promptCopied, setPromptCopied] = useState(false);
  const aiPrompt =
    'Create Knight Code for MeMyMate. Use 2 to 4 topics. Each topic must contain concise spoken-answer playcards. Format every card as <k1 5>Question => Answer<3/k>. Use 100 characters = 5 seconds when timing is omitted. Return only the Knight Code.';

  const updateTopic = (topicId: string, patch: Partial<DraftTopic>) => {
    setTypedTopics((topics) =>
      topics.map((topicItem) => (topicItem.id === topicId ? { ...topicItem, ...patch } : topicItem)),
    );
  };

  const updateCard = (topicId: string, cardId: string, patch: Partial<Card>) => {
    setTypedTopics((topics) =>
      topics.map((topicItem) =>
        topicItem.id === topicId
          ? { ...topicItem, cards: topicItem.cards.map((card) => (card.id === cardId ? { ...card, ...patch } : card)) }
          : topicItem,
      ),
    );
  };

  const addTopic = () => {
    playSound('click');
    const index = typedTopics.length + 1;
    setTypedTopics((topics) => [
      ...topics,
      {
        id: makeId('topic-draft'),
        name: `Topic ${index}`,
        cards: [{ id: makeId('card-draft'), prompt: '', answer: '', seconds: 1, repetitions: 1 }],
      },
    ]);
  };

  const removeTopic = (topicId: string) => {
    playSound('click');
    setTypedTopics((topics) => (topics.length > 1 ? topics.filter((topicItem) => topicItem.id !== topicId) : topics));
  };

  const addCard = (topicId: string) => {
    playSound('click');
    setTypedTopics((topics) =>
      topics.map((topicItem) =>
        topicItem.id === topicId
          ? {
              ...topicItem,
              cards: [
                ...topicItem.cards,
                { id: makeId('card-draft'), prompt: '', answer: '', seconds: 1, repetitions: 1 },
              ],
            }
          : topicItem,
      ),
    );
  };

  const removeCard = (topicId: string, cardId: string) => {
    playSound('click');
    setTypedTopics((topics) =>
      topics.map((topicItem) =>
        topicItem.id === topicId && topicItem.cards.length > 1
          ? { ...topicItem, cards: topicItem.cards.filter((card) => card.id !== cardId) }
          : topicItem,
      ),
    );
  };

  const submit = () => {
    let parsed: { name: string; topic: string; topics: Topic[]; cards: Card[] };
    if (mode === 'language') {
      if (!language.trim()) {
        setError('Add Knight Code before you enter the arena.');
        playSound('error');
        return;
      }
      parsed = parseKnightLanguage(language, name || 'My New Knight');
    } else {
      const topics = typedTopics
        .map((topicItem, topicIndex) => ({
          id: makeId(`topic-${topicIndex}`),
          name: topicItem.name.trim() || `Topic ${topicIndex + 1}`,
          cards: topicItem.cards
            .filter((card) => card.prompt.trim() || card.answer.trim())
            .map((card) => {
              const prompt = card.prompt.trim() || card.answer.trim();
              const answer = card.answer.trim() || prompt;
              return {
                ...card,
                id: makeId('card'),
                prompt,
                answer,
                seconds: card.seconds > 0 ? card.seconds : autoSeconds(answer),
                repetitions: Math.max(1, Math.floor(card.repetitions ?? 1)),
              };
            }),
        }))
        .filter((topicItem) => topicItem.cards.length);
      const cards = topics.flatMap((topicItem) => topicItem.cards);
      if (!cards.length) {
        setError('Add at least one playcard before you enter the arena.');
        playSound('error');
        return;
      }
      parsed = { name: name.trim() || 'My New Knight', topic: topics[0].name, topics, cards };
    }
    if (!parsed.cards.length) {
      setError('Add at least one playcard before you enter the arena.');
      playSound('error');
      return;
    }
    const knight: Knight = {
      ...parsed,
      name: name.trim() || parsed.name,
      id: makeId('knight'),
      description: description.trim() || 'A fresh challenge from your notes.',
      sessions: 0,
      bestScore: 0,
      createdAt: new Date().toISOString(),
    };
    addKnight(knight);
    playSound('correct');
    setLocation(`/practice/${knight.id}`);
  };

  return (
    <Shell>
      <Topbar current="Create a Knight" />
      <div className="page-title fade-in">
        <div className="eyebrow">Forge a new challenge</div>
        <h1 className="display">
          Give your notes
          <br />a fighting chance.
        </h1>
        <p>
          One Knight can hold many topics. Each topic holds playcards with their own speaking time and consecutive
          repeats.
        </p>
      </div>
      <div className="form-layout">
        <section className="panel rise-in">
          <h2>Build your Knight</h2>
          <p>
            During memorization, each answer stays visible for the number of repetitions you choose. The final test
            hides it.
          </p>
          <div className="mode-toggle" role="tablist" aria-label="Card input mode">
            <button
              type="button"
              className={mode === 'typed' ? 'active' : ''}
              onClick={() => {
                setMode('typed');
                playSound('click');
              }}
              data-testid="button-mode-typed"
            >
              <PencilLine size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} /> Type notes
            </button>
            <button
              type="button"
              className={mode === 'language' ? 'active' : ''}
              onClick={() => {
                setMode('language');
                playSound('click');
              }}
              data-testid="button-mode-language"
            >
              <Code2 size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} /> Knight Code
            </button>
          </div>
          <div className="field">
            <label htmlFor="knight-name">Knight name</label>
            <input
              id="knight-name"
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Organic Chemistry"
              data-testid="input-knight-name"
            />
          </div>
          {mode === 'typed' ? (
            <>
              <div className="field">
                <label htmlFor="knight-description">
                  Short description <span className="field-hint">(optional)</span>
                </label>
                <input
                  id="knight-description"
                  className="input"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="e.g. Biology, Chapter 04"
                  data-testid="input-knight-description"
                />
              </div>
              <div className="topic-stack">
                {typedTopics.map((topicItem, topicIndex) => (
                  <section className="topic-builder" key={topicItem.id}>
                    <div className="topic-builder-head">
                      <div>
                        <span className="eyebrow">Topic {String(topicIndex + 1).padStart(2, '0')}</span>
                        <input
                          className="input topic-name-input"
                          value={topicItem.name}
                          onChange={(event) => updateTopic(topicItem.id, { name: event.target.value })}
                          aria-label={`Topic ${topicIndex + 1} name`}
                          data-testid={`input-topic-name-${topicIndex}`}
                        />
                      </div>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => removeTopic(topicItem.id)}
                        aria-label={`Remove topic ${topicIndex + 1}`}
                        disabled={typedTopics.length === 1}
                      >
                        <X size={15} />
                      </button>
                    </div>
                    <div className="playcard-stack">
                      {topicItem.cards.map((card, cardIndex) => (
                        <div className="playcard-builder" key={card.id}>
                          <div className="playcard-number">{String(cardIndex + 1).padStart(2, '0')}</div>
                          <div className="playcard-fields">
                            <div className="field">
                              <label htmlFor={`${card.id}-prompt`}>Question / cue</label>
                              <input
                                id={`${card.id}-prompt`}
                                className="input"
                                value={card.prompt}
                                onChange={(event) => updateCard(topicItem.id, card.id, { prompt: event.target.value })}
                                placeholder="What do you want to be asked?"
                                data-testid={`input-card-prompt-${topicIndex}-${cardIndex}`}
                              />
                            </div>
                            <div className="field">
                              <label htmlFor={`${card.id}-answer`}>Answer to say</label>
                              <textarea
                                id={`${card.id}-answer`}
                                className="textarea compact-textarea"
                                value={card.answer}
                                onChange={(event) =>
                                  updateCard(topicItem.id, card.id, {
                                    answer: event.target.value,
                                    ...(!card.secondsManual ? { seconds: autoSeconds(event.target.value) } : {}),
                                  })
                                }
                                placeholder="What you will say aloud"
                                data-testid={`input-card-answer-${topicIndex}-${cardIndex}`}
                              />
                              <small className="field-note">
                                {card.secondsManual
                                  ? 'Custom time'
                                  : `${card.seconds || autoSeconds(card.answer)} sec · updates as you type`}
                              </small>
                            </div>
                            <div className="card-settings">
                              <div className="field">
                                <label htmlFor={`${card.id}-seconds`}>Seconds</label>
                                <input
                                  id={`${card.id}-seconds`}
                                  className="input"
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={card.seconds}
                                  onChange={(event) =>
                                    updateCard(topicItem.id, card.id, {
                                      seconds: Number(event.target.value) || 1,
                                      secondsManual: true,
                                    })
                                  }
                                  data-testid={`input-card-seconds-${topicIndex}-${cardIndex}`}
                                />
                              </div>
                              <div className="field">
                                <label htmlFor={`${card.id}-repetitions`}>Repeats</label>
                                <input
                                  id={`${card.id}-repetitions`}
                                  className="input"
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={card.repetitions ?? 1}
                                  onChange={(event) =>
                                    updateCard(topicItem.id, card.id, {
                                      repetitions: Number(event.target.value),
                                    })
                                  }
                                  data-testid={`input-card-repetitions-${topicIndex}-${cardIndex}`}
                                />
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="icon-button playcard-remove"
                            onClick={() => removeCard(topicItem.id, card.id)}
                            aria-label={`Remove playcard ${cardIndex + 1}`}
                            disabled={topicItem.cards.length === 1}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="button button-soft add-card-button"
                      onClick={() => addCard(topicItem.id)}
                      data-testid={`button-add-card-${topicIndex}`}
                    >
                      <Plus size={14} /> Add playcard
                    </button>
                  </section>
                ))}
              </div>
              <button
                type="button"
                className="button button-ghost add-topic-button"
                onClick={addTopic}
                data-testid="button-add-topic"
              >
                <Plus size={14} /> Add another topic
              </button>
            </>
          ) : (
            <div className="field">
              <label htmlFor="knight-cards">Knight Code</label>
              <textarea
                id="knight-cards"
                className="textarea code-textarea"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                placeholder={'<topic1>Topic name</topic>\n<k1 5>Question => Answer<3/k>'}
                data-testid="textarea-knight-cards"
              />
            </div>
          )}
          {error && (
            <p
              role="alert"
              style={{ color: 'hsl(var(--destructive))', fontSize: 11, margin: '12px 0 0' }}
              data-testid="status-create-error"
            >
              {error}
            </p>
          )}
          <div className="form-footer">
            <Link
              href="/"
              className="button button-ghost"
              data-testid="button-cancel-create"
              onClick={() => playSound('click')}
            >
              Cancel
            </Link>
            <button
              type="button"
              className="button button-primary"
              onClick={submit}
              data-testid="button-create-knight"
            >
              <Sparkles size={15} /> Enter the arena
            </button>
          </div>
        </section>
        <aside>
          <section className="panel rise-in stagger-1">
            <h2>Build for speaking</h2>
            <p>Each playcard is a small spoken memory, not a multiple-choice question.</p>
            <div className="tip-list">
              <div className="tip">
                <span className="tip-mark">01</span>
                <div>
                  <strong>One idea</strong>
                  <p>Write a cue and the answer you want to say aloud.</p>
                </div>
              </div>
              <div className="tip">
                <span className="tip-mark">02</span>
                <div>
                  <strong>One clock</strong>
                  <p>100 characters equals 5 seconds. Knight Code fills this in when you omit time.</p>
                </div>
              </div>
              <div className="tip">
                <span className="tip-mark">03</span>
                <div>
                  <strong>Repeat it</strong>
                  <p>Set consecutive repeats until the answer feels familiar.</p>
                </div>
              </div>
            </div>
          </section>
          <section className="panel rise-in stagger-2">
            <h2>Knight Code</h2>
            <p>Use tags when you want to paste a set quickly.</p>
            <div className="syntax-box">&lt;topic1&gt;Memory basics&lt;/topic&gt;{'\n'}&lt;k1 5&gt;What is recall? =&gt; Finding stored knowledge&lt;3/k&gt;</div>
            <div style={{ marginTop: 15 }}>
              <Link
                href="/guide"
                className="text-link"
                data-testid="link-learn-syntax"
                onClick={() => playSound('click')}
              >
                See the full syntax <ChevronRight size={13} style={{ verticalAlign: 'middle' }} />
              </Link>
            </div>
          </section>
          <section className="panel rise-in stagger-3">
            <h2>Prompt an AI</h2>
            <p>Paste this into your preferred AI tool, then paste its result into Knight Code.</p>
            <div className="syntax-box ai-prompt">{aiPrompt}</div>
            <button
              type="button"
              className="button button-soft prompt-copy"
              onClick={() => {
                void copyText(aiPrompt);
                playSound('click');
                setPromptCopied(true);
                window.setTimeout(() => setPromptCopied(false), 2200);
              }}
            >
              <Copy size={14} /> {promptCopied ? 'Prompt copied' : 'Copy prompt'}
            </button>
          </section>
        </aside>
      </div>
    </Shell>
  );
}

function PracticePage() {
  const params = useParams<{ id: string }>();
  const { knights, updateKnight } = useAppState();
  const knight = knights.find((item) => item.id === params.id) ?? knights[0];
  const topics = knight ? getTopics(knight).filter((topic) => topic.cards.length) : [];
  const [topicIndex, setTopicIndex] = useState(0);
  const [cardIndex, setCardIndex] = useState(0);
  const [repeatIndex, setRepeatIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [status, setStatus] = useState<'topic-intro' | 'memorize' | 'test' | 'failed' | 'complete'>('topic-intro');
  const topic = topics[topicIndex];
  const card = topic?.cards[cardIndex];
  const total = topics.reduce((sum, item) => sum + item.cards.length, 0);
  const repetitions = card?.repetitions ?? 1;

  useEffect(() => {
    if ((status !== 'memorize' && status !== 'test') || !card) return;
    if (timeLeft <= 0) {
      setStatus('failed');
      playSound('error');
      return;
    }
    const timer = window.setInterval(() => setTimeLeft((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [status, card, timeLeft]);

  useEffect(() => {
    if ((status === 'memorize' || status === 'test') && timeLeft > 0 && timeLeft <= 3) {
      playSound('tick');
    }
  }, [status, timeLeft]);

  const reset = () => {
    setTopicIndex(0);
    setCardIndex(0);
    setRepeatIndex(0);
    setTimeLeft(0);
    setStatus('topic-intro');
    playSound('flip');
  };

  const startTopic = () => {
    if (!card) return;
    setTimeLeft(card.seconds);
    setStatus('memorize');
    playSound('flip');
  };

  const nextTopicOrComplete = () => {
    if (topicIndex < topics.length - 1) {
      setTopicIndex((current) => current + 1);
      setCardIndex(0);
      setRepeatIndex(0);
      setTimeLeft(0);
      setStatus('topic-intro');
      playSound('flip');
      return;
    }
    setStatus('complete');
    updateKnight(knight.id, { sessions: knight.sessions + 1, bestScore: Math.max(knight.bestScore, 100) });
    playSound('fanfare');
  };

  const advance = () => {
    if (!card) return;
    // Live synthesized sound effect for card flips and correct answers
    if (status === 'test') {
      playSound('correct');
    } else {
      playSound('flip');
    }

    if (status === 'memorize' && repeatIndex + 1 < repetitions) {
      setRepeatIndex((current) => current + 1);
      setTimeLeft(card.seconds);
      return;
    }
    if (cardIndex < topic.cards.length - 1) {
      setCardIndex((current) => current + 1);
      setRepeatIndex(0);
      setTimeLeft(card.seconds);
      return;
    }
    if (status === 'memorize') {
      setCardIndex(0);
      setRepeatIndex(0);
      setTimeLeft(topic.cards[0].seconds);
      setStatus('test');
      playSound('flip');
      return;
    }
    nextTopicOrComplete();
  };

  const handleCardKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      advance();
    }
  };

  if (!knight || !topic || !card) {
    return (
      <Shell>
        <Topbar current="Practice" />
        <div className="panel">
          This Knight has no cards yet.{' '}
          <Link href="/create" className="text-link" data-testid="link-empty-create">
            Create one
          </Link>
        </div>
      </Shell>
    );
  }

  const progress = card.seconds ? Math.max(0, Math.min(1, timeLeft / card.seconds)) : 0;
  const active = status === 'memorize' || status === 'test';

  return (
    <Shell>
      <Topbar current={`Practice · ${knight.name}`} />
      <div className="practice-wrap fade-in">
        <div className="practice-top">
          <div>
            <div className="eyebrow">
              {status === 'test'
                ? 'Recall test'
                : status === 'memorize'
                ? 'Speak and remember'
                : 'Topic checkpoint'}
            </div>
            <h1 className="display">{topic.name}</h1>
          </div>
          <div className="practice-top-actions">
            <span data-testid="text-practice-progress">
              TOPIC {String(topicIndex + 1).padStart(2, '0')} / {String(topics.length).padStart(2, '0')}
            </span>
            <button
              type="button"
              className="icon-button"
              onClick={reset}
              aria-label="Restart Knight"
              title="Restart Knight"
              data-testid="button-restart-practice"
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>

        {active && (
          <div className="timer-card" data-testid="status-timer">
            <svg className="timer-ring" viewBox="0 0 100 100" aria-label={`${timeLeft} seconds remaining`}>
              <circle className="timer-bg" cx="50" cy="50" r="45" />
              <circle
                className="timer-progress"
                cx="50"
                cy="50"
                r="45"
                strokeDasharray="283"
                strokeDashoffset={283 * (1 - progress)}
              />
            </svg>
            <div className="timer-center">
              <strong>{timeLeft}</strong>
              <span>seconds</span>
            </div>
            <span className="timer-topic">
              {status === 'test' ? 'test' : `repeat ${repeatIndex + 1}/${repetitions}`}
            </span>
          </div>
        )}

        <div className="screen-swap" key={`${topicIndex}-${status}-${cardIndex}-${repeatIndex}`}>
          {status === 'topic-intro' && (
            <button
              type="button"
              className="practice-card topic-gate"
              onClick={startTopic}
              data-testid="button-start-topic"
            >
              <span className="topic-gate-mark">
                <Play size={22} fill="currentColor" />
              </span>
              <span className="card-index">{topic.name}</span>
              <h2>Start this topic</h2>
              <span className="topic-gate-meta">{topic.cards.length} playcards · no time limit to begin</span>
            </button>
          )}
          {active && (
            <button
              type="button"
              className={`practice-card content-card ${status === 'test' ? 'test-card' : ''}`}
              onClick={advance}
              onKeyDown={handleCardKeyDown}
              aria-label="Tap when you have said the answer"
              data-testid="button-advance-card"
            >
              <span className="practice-card-content">{status === 'memorize' ? card.answer : card.prompt}</span>
            </button>
          )}
          {status === 'failed' && (
            <div className="result fail">
              <div className="result-mark">
                <X size={27} />
              </div>
              <h2 className="display">Time slipped away.</h2>
              <p>Restart the Knight and try the topic again. The next attempt starts with a fresh clock.</p>
              <button
                type="button"
                className="button button-primary"
                onClick={reset}
                data-testid="button-restart-failed"
              >
                <RotateCcw size={15} /> Restart Knight
              </button>
            </div>
          )}
          {status === 'complete' && (
            <div className="result">
              <div className="result-mark">
                <Trophy size={27} />
              </div>
              <h2 className="display">Knight cleared.</h2>
              <p>
                You completed all {total} playcards across {topics.length} topics.
              </p>
              <button
                type="button"
                className="button button-primary"
                onClick={reset}
                data-testid="button-practice-again"
              >
                <Play size={15} fill="currentColor" /> Run it again
              </button>
            </div>
          )}
        </div>
        {status === 'topic-intro' && (
          <p className="practice-hint">
            <Volume2 size={13} /> Tap the topic card when you are ready to begin.
          </p>
        )}
        {active && (
          <p className="practice-hint">
            <Volume2 size={13} /> Tap anywhere on the card after you say the content.
          </p>
        )}
      </div>
    </Shell>
  );
}

/**
 * Shared flashcard links are public read-only for studying.
 */
function SharedPage() {
  const params = useParams<{ id: string }>();
  const { addKnight, firebaseUser } = useAppState();
  const [knight, setKnight] = useState<Knight | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const shared = params.id ? (await loadSharedKnight(params.id)) ?? loadLocalSharedKnight(params.id) : null;
      if (!mounted) return;
      setKnight(shared);
      setStatus(shared ? 'ready' : 'missing');
    })();
    return () => {
      mounted = false;
    };
  }, [params.id]);

  const copyToCollection = () => {
    if (!knight) return;
    const copy = {
      ...knight,
      id: makeId('knight'),
      name: `${knight.name} · copy`,
      sessions: 0,
      bestScore: 0,
      createdAt: new Date().toISOString(),
    };
    addKnight(copy);
    playSound('correct');
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2400);
  };

  return (
    <Shell>
      <Topbar current="Shared Knight" />
      {status === 'loading' && (
        <div className="panel share-loading">
          <div className="loading-orbit" />
          <p>Opening the shared Knight…</p>
        </div>
      )}
      {status === 'missing' && (
        <div className="result fail">
          <div className="result-mark">
            <Link2 size={27} />
          </div>
          <h1 className="display">This link is unavailable.</h1>
          <p>The Knight may have expired or is not public.</p>
          <Link href="/" className="button button-primary" onClick={() => playSound('click')}>
            Back to dashboard
          </Link>
        </div>
      )}
      {status === 'ready' && knight && (
        <div className="shared-layout fade-in">
          <section className="shared-hero">
            <div className="eyebrow">Public Study Deck</div>
            <h1 className="display">{knight.name}</h1>
            <p>{knight.description}</p>
            <div className="shared-meta">
              <span>{getTopics(knight).length} topics</span>
              <span>{getCards(knight).length} playcards</span>
              <span>Public read-only deck</span>
            </div>
            <div className="shared-actions">
              <button
                type="button"
                className="button button-primary"
                onClick={copyToCollection}
                data-testid="button-copy-shared-knight"
              >
                <Copy size={15} /> {copied ? 'Saved to your Knights!' : 'Copy to my Knights'}
              </button>
              <Link
                href={`/practice/${knight.id}`}
                className="button button-ghost"
                onClick={() => playSound('click')}
              >
                <Play size={14} fill="currentColor" /> Study this Knight
              </Link>
            </div>
          </section>
          <section className="shared-topics">
            {getTopics(knight).map((topic) => (
              <article className="shared-topic" key={topic.id}>
                <span className="card-index">{topic.name}</span>
                <h2>{topic.cards.length} playcards</h2>
                <p>{topic.cards.slice(0, 2).map((card) => card.answer).join(' · ')}</p>
              </article>
            ))}
          </section>
        </div>
      )}
    </Shell>
  );
}

function GuidePage() {
  return (
    <Shell>
      <Topbar current="Quick guide" />
      <div className="page-title fade-in">
        <div className="eyebrow">The Knight loop</div>
        <h1 className="display">
          Study like you
          <br />
          have a quest.
        </h1>
        <p>
          MeMyMate makes memorization a short, active challenge. Build a set, recall it under a timer, then return when
          the gaps start to feel comfortable.
        </p>
      </div>
      <section className="guide-grid">
        <article className="loop-card accent rise-in">
          <span className="loop-number">01 / FORGE</span>
          <h3>Build a Knight</h3>
          <p>
            Turn a topic into compact sentence cards. Each card is one thing you want your future self to be able to say.
          </p>
        </article>
        <article className="loop-card rise-in stagger-1">
          <span className="loop-number">02 / START</span>
          <h3>Tap when ready</h3>
          <p>
            Each topic opens on a calm checkpoint. There is no countdown until you tap its playcard.
          </p>
        </article>
        <article className="loop-card rise-in stagger-2">
          <span className="loop-number">03 / RECALL</span>
          <h3>Speak, then tap</h3>
          <p>
            The answer or question is the only thing on the playcard. Tap the card after you say it aloud.
          </p>
        </article>
        <article className="loop-card rise-in stagger-3">
          <span className="loop-number">04 / MOVE</span>
          <h3>Change the scene</h3>
          <p>
            Every topic ends with a screen transition and a new topic checkpoint, so the session stays easy to follow.
          </p>
        </article>
        <section className="panel guide-wide rise-in">
          <h2>Knight Code</h2>
          <p>Use a topic tag, then give each playcard an optional time and repeat count.</p>
          <table className="syntax-table">
            <thead>
              <tr>
                <th>Write</th>
                <th>What it does</th>
                <th>Example</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>&lt;topic1&gt;</td>
                <td>Starts a topic. A Knight can have many.</td>
                <td>
                  <span className="mono">&lt;topic1&gt;Cell biology&lt;/topic&gt;</span>
                </td>
              </tr>
              <tr>
                <td>&lt;k1 5&gt;</td>
                <td>Creates a card with a 5 second timer.</td>
                <td>
                  <span className="mono">&lt;k1 5&gt;What is ATP? =&gt; Cell energy&lt;/k&gt;</span>
                </td>
              </tr>
              <tr>
                <td>&lt;3/k&gt;</td>
                <td>Repeats the card 3 consecutive times.</td>
                <td>
                  <span className="mono">&lt;k1 5&gt;...&lt;3/k&gt;</span>
                </td>
              </tr>
              <tr>
                <td>Omitted values</td>
                <td>Repeat defaults to 1. Time uses 100 characters = 5 seconds.</td>
                <td>
                  <span className="mono">&lt;k1&gt;A long answer...&lt;/k&gt;</span>
                </td>
              </tr>
            </tbody>
          </table>
          <div style={{ marginTop: 19 }}>
            <Link
              href="/create"
              className="button button-primary"
              data-testid="button-try-language"
              onClick={() => playSound('click')}
            >
              <Code2 size={15} /> Try Knight Code
            </Link>
          </div>
        </section>
      </section>
    </Shell>
  );
}

function SettingsPage() {
  const {
    theme,
    setTheme,
    firebaseUser,
    firebaseReady,
    isGuest,
    openAuthModal,
    signOutUser,
    soundSettings,
    setSoundEnabled,
    setSoundVolume,
    accountCreatedAt,
    daysActive,
    downloadBackup,
    importKnights,
  } = useAppState();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const choices: { id: Theme; label: string; caption: string; icon: typeof Sun }[] = [
    { id: 'light', label: 'Paper', caption: 'Bright and clear', icon: Sun },
    { id: 'dark', label: 'Midnight', caption: 'Low light focus', icon: Moon },
    { id: 'sunset', label: 'Apricot', caption: 'Warm and vivid', icon: Sparkles },
  ];

  const soundTests: { name: SoundEffect; label: string }[] = [
    { name: 'click', label: 'Click' },
    { name: 'flip', label: 'Card Flip' },
    { name: 'correct', label: 'Correct' },
    { name: 'error', label: 'Error' },
    { name: 'tick', label: 'Timer Tick' },
    { name: 'fanfare', label: 'Fanfare' },
    { name: 'levelup', label: 'Level Up' },
    { name: 'chime', label: 'Retro Chime' },
  ];

  const handleImportFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = JSON.parse(text);
        const imported = Array.isArray(parsed) ? parsed : parsed.knights;
        if (Array.isArray(imported) && imported.length > 0) {
          importKnights(imported as Knight[]);
          playSound('levelup');
          alert(`Successfully imported ${imported.length} Knight(s)!`);
        } else {
          playSound('error');
          alert('No valid flashcards found in this JSON file.');
        }
      } catch {
        playSound('error');
        alert('Invalid JSON file format.');
      }
    };
    reader.readAsText(file);
    // Reset file input
    e.target.value = '';
  };

  return (
    <Shell>
      <Topbar current="Settings" />
      <div className="page-title fade-in">
        <div className="eyebrow">Your study space</div>
        <h1 className="display">
          Make it feel
          <br />
          like yours.
        </h1>
        <p>Choose the atmosphere and audio balance that makes opening a Knight feel like an invitation.</p>
      </div>

      <div className="settings-layout">
        {/* Appearance Settings */}
        <section className="panel rise-in">
          <h2>Appearance</h2>
          <p>Your theme is saved on this device.</p>
          <div className="theme-grid">
            {choices.map(({ id, label, caption, icon: Icon }) => (
              <button
                type="button"
                key={id}
                className={`theme-choice ${theme === id ? 'active' : ''}`}
                onClick={() => {
                  setTheme(id);
                  playSound('click');
                }}
                aria-pressed={theme === id}
                data-testid={`button-theme-${id}`}
              >
                <div className={`theme-preview ${id}`}>
                  <span />
                </div>
                <strong>
                  <Icon size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {label}
                </strong>
                <small>{caption}</small>
              </button>
            ))}
          </div>
        </section>

        {/* Live Web Audio Sound Engine Controls */}
        <section className="panel rise-in stagger-1" data-testid="settings-audio-section">
          <h2>Audio &amp; Synthesizer Engine</h2>
          <p>Zero audio files — 100% synthesized in real time with the Web Audio API.</p>

          <div className="setting-row">
            <div className="setting-label">
              <strong>Sound Effects</strong>
              <small>Audio cues for card flips, ticks, answers, and victories</small>
            </div>
            <Switch
              checked={soundSettings.enabled}
              onCheckedChange={(checked) => {
                setSoundEnabled(checked);
                if (checked) playSound('click');
              }}
              data-testid="switch-sound-enabled"
            />
          </div>

          <div className="setting-row">
            <div className="setting-label">
              <strong>Master Volume</strong>
              <small>{Math.round(soundSettings.volume * 100)}% gain</small>
            </div>
            <div className="volume-slider-wrap">
              {soundSettings.enabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              <Slider
                min={0}
                max={100}
                step={1}
                value={[Math.round(soundSettings.volume * 100)]}
                onValueChange={([val]) => {
                  setSoundVolume(val / 100);
                }}
                data-testid="slider-sound-volume"
              />
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--muted-foreground))' }}>
              Live Synthesizer Previews
            </span>
            <div className="sound-test-grid">
              {soundTests.map(({ name, label }) => (
                <button
                  type="button"
                  key={name}
                  className="sound-test-btn"
                  onClick={() => playSound(name)}
                  data-testid={`button-test-sound-${name}`}
                >
                  <Sparkles size={11} /> {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 30-Day Account Policy & JSON Backup */}
        <section className="panel rise-in stagger-2" data-testid="settings-policy-section">
          <h2>30-Day Policy &amp; Decks Backup</h2>
          <p>
            Accounts and study decks operate on a 30-day lifecycle of inactivity. Back up your flashcards anytime in JSON
            format.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, margin: '16px 0' }}>
            <div style={{ padding: '12px 14px', borderRadius: 14, background: 'hsl(var(--muted) / 0.5)', border: '1px solid hsl(var(--border))' }}>
              <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Account Created
              </span>
              <strong style={{ fontSize: 14, marginTop: 4, display: 'block' }}>{formatDate(accountCreatedAt)}</strong>
            </div>
            <div style={{ padding: '12px 14px', borderRadius: 14, background: 'hsl(var(--muted) / 0.5)', border: '1px solid hsl(var(--border))' }}>
              <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Days Active
              </span>
              <strong style={{ fontSize: 14, marginTop: 4, display: 'block' }}>
                {daysActive} {daysActive === 1 ? 'day' : 'days'}
              </strong>
            </div>
            <div style={{ padding: '12px 14px', borderRadius: 14, background: 'hsl(var(--muted) / 0.5)', border: '1px solid hsl(var(--border))' }}>
              <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Lifecycle Window
              </span>
              <strong style={{ fontSize: 14, marginTop: 4, display: 'block', color: 'hsl(var(--accent))' }}>
                30-day rolling
              </strong>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
            <button
              type="button"
              className="button button-primary"
              onClick={downloadBackup}
              data-testid="button-settings-download-backup"
            >
              <ArrowDownToLine size={14} /> Download JSON Backup
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={handleImportFile}
            />
            <button
              type="button"
              className="button button-soft"
              onClick={() => {
                playSound('click');
                fileInputRef.current?.click();
              }}
              data-testid="button-settings-import-backup"
            >
              <ArrowUpToLine size={14} /> Restore from JSON
            </button>
          </div>
        </section>

        {/* Profile & Cloud Auth Section */}
        <section className="panel rise-in stagger-3">
          <h2>Authentication &amp; Cloud Sync</h2>
          <p>
            {isGuest
              ? 'You are browsing in guest mode. Flashcards are saved locally on this device.'
              : 'You are signed in. Your Knights sync to cloud Firestore automatically.'}
          </p>
          <div className="profile-card">
            <div
              className="profile-avatar"
              style={{
                background: isGuest
                  ? undefined
                  : 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))',
              }}
            >
              {isGuest ? 'GM' : firebaseUser?.email ? firebaseUser.email.slice(0, 2).toUpperCase() : 'MM'}
            </div>
            <div>
              <h3>{isGuest ? 'Guest Student' : firebaseUser?.email ?? 'Signed-in Student'}</h3>
              <p>
                {isGuest
                  ? 'Device-only storage · sign in to enable Firestore sync and deck sharing'
                  : 'Cloud Firestore storage active'}
              </p>
            </div>
          </div>
          <div className="auth-status">
            <span className={`status-dot ${!isGuest ? 'online' : ''}`} />
            {isGuest ? 'Guest mode (No cloud writes)' : 'Authenticated (Cloud active)'}
          </div>

          <div style={{ marginTop: 16 }}>
            {isGuest ? (
              <button
                type="button"
                className="button button-primary"
                onClick={() => {
                  playSound('click');
                  openAuthModal();
                }}
                data-testid="button-settings-signin"
              >
                <LogIn size={14} /> Sign in / Register
              </button>
            ) : (
              <button
                type="button"
                className="button button-ghost"
                onClick={() => {
                  playSound('click');
                  void signOutUser();
                }}
                data-testid="button-settings-signout"
              >
                <LogOut size={14} /> Sign out
              </button>
            )}
          </div>
        </section>
      </div>
    </Shell>
  );
}

function NotFound() {
  return (
    <Shell>
      <Topbar current="Lost page" />
      <div className="panel" style={{ textAlign: 'center', padding: 60 }}>
        <h1 className="display">This path is not on the map.</h1>
        <p style={{ color: 'hsl(var(--muted-foreground))' }}>Return to your dashboard and pick a Knight.</p>
        <Link
          href="/"
          className="button button-primary"
          data-testid="button-return-home"
          onClick={() => playSound('click')}
        >
          <House size={15} /> Back to dashboard
        </Link>
      </div>
    </Shell>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Router() {
  const [location] = useLocation();
  const [showSplash, setShowSplash] = useState(location === '/');

  useEffect(() => {
    if (location !== '/') {
      setShowSplash(false);
      return;
    }
    const timer = window.setTimeout(() => setShowSplash(false), 3200);
    return () => window.clearTimeout(timer);
  }, [location]);

  if (showSplash) {
    return <CinematicSplash onDismiss={() => setShowSplash(false)} />;
  }

  return (
    <RoutedErrorBoundary>
      <WouterSwitch>
        <Route path="/" component={Home} />
        <Route path="/create" component={CreatePage} />
        <Route path="/practice/:id" component={PracticePage} />
        <Route path="/share/:id" component={SharedPage} />
        <Route path="/guide" component={GuidePage} />
        <Route path="/settings" component={SettingsPage} />
        <Route component={NotFound} />
      </WouterSwitch>
    </RoutedErrorBoundary>
  );
}

function App() {
  const [knights, setKnights] = useState<Knight[]>(readKnights);
  const [theme, setThemeState] = useState<Theme>(readTheme);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [guestCreatedAt] = useState<string>(getGuestCreatedAt);
  const [authModalState, setAuthModalState] = useState<{
    isOpen: boolean;
    prompt?: string;
    defaultTab?: 'signin' | 'signup';
  }>({ isOpen: false });

  const [soundSettings, setSoundSettingsState] = useState<SoundSettings>({
    enabled: isSoundEnabled(),
    volume: getSoundVolume(),
  });

  // Keep sound settings updated
  useEffect(() => {
    return subscribeSoundSettings((settings) => {
      setSoundSettingsState(settings);
    });
  }, []);

  // Sync to local storage
  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(knights));
  }, [knights]);

  // Firebase auth subscription
  useEffect(() => {
    const unsubscribe = subscribeToFirebaseAuth(async (user) => {
      setFirebaseUser(user);
      setFirebaseReady(true);

      // Only signed-in users sync to Firestore cloud storage
      if (user && !user.isAnonymous) {
        try {
          const cloudKnights = await loadCloudKnights(user.uid);
          if (cloudKnights.length > 0) {
            setKnights(cloudKnights);
          } else {
            // Upload local knights to cloud on first login
            await Promise.all(knights.map((k) => saveCloudKnight(user.uid, k)));
          }
        } catch (error) {
          console.warn('Firebase Firestore sync failed', error);
        }
      }
    });

    return unsubscribe;
  }, []);

  // Theme application
  useEffect(() => {
    window.localStorage.setItem(THEME_KEY, theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('theme-sunset', theme === 'sunset');
  }, [theme]);

  const isGuest = !firebaseUser || Boolean(firebaseUser.isAnonymous);

  const accountCreatedAt = useMemo(() => {
    if (firebaseUser && firebaseUser.metadata.creationTime) {
      return firebaseUser.metadata.creationTime;
    }
    return guestCreatedAt;
  }, [firebaseUser, guestCreatedAt]);

  const daysActive = useMemo(() => {
    return getDaysActive(accountCreatedAt);
  }, [accountCreatedAt]);

  const openAuthModal = (options?: AuthModalOptions) => {
    setAuthModalState({
      isOpen: true,
      prompt: options?.prompt,
      defaultTab: options?.defaultTab ?? 'signin',
    });
  };

  const closeAuthModal = () => {
    setAuthModalState((s) => ({ ...s, isOpen: false }));
  };

  const signOutUser = async () => {
    await logOut();
    setFirebaseUser(null);
    playSound('flip');
  };

  const downloadBackup = () => {
    exportKnightsAsJson(knights);
  };

  const importKnights = (imported: Knight[]) => {
    setKnights((current) => {
      const existingIds = new Set(current.map((k) => k.id));
      const fresh = imported.filter((k) => !existingIds.has(k.id));
      const merged = [...fresh, ...current];
      if (firebaseUser && !firebaseUser.isAnonymous) {
        fresh.forEach((k) => void saveCloudKnight(firebaseUser.uid, k));
      }
      return merged;
    });
  };

  const value = useMemo<AppState>(
    () => ({
      knights,
      addKnight: (knight) => {
        setKnights((current) => [knight, ...current]);
        // Only signed-in users sync to Firestore cloud storage
        if (firebaseUser && !firebaseUser.isAnonymous) {
          void saveCloudKnight(firebaseUser.uid, knight);
        }
      },
      updateKnight: (id, patch) => {
        setKnights((current) =>
          current.map((knight) => (knight.id === id ? { ...knight, ...patch } : knight)),
        );
        const updated = knights.find((knight) => knight.id === id);
        // Only signed-in users sync to Firestore cloud storage
        if (firebaseUser && !firebaseUser.isAnonymous && updated) {
          void saveCloudKnight(firebaseUser.uid, { ...updated, ...patch });
        }
      },
      shareKnight: async (knight) => {
        // Tapping "Share" as a guest opens the sign-up dialog
        if (isGuest) {
          openAuthModal({
            prompt: 'Create an account or sign in to share your Knights with a public study link and sync them to the cloud.',
            defaultTab: 'signup',
          });
          return null;
        }

        // Signed-in users save to Firestore sharedKnights
        saveLocalSharedKnight(knight);
        if (firebaseUser) {
          await saveSharedKnight(firebaseUser.uid, knight);
        }
        const link = new URL(sharePath(knight.id), window.location.origin).toString();
        return link;
      },
      theme,
      setTheme: setThemeState,
      firebaseUser,
      firebaseReady,
      isGuest,
      openAuthModal,
      closeAuthModal,
      signOutUser,
      soundSettings,
      setSoundEnabled: updateSoundEnabled,
      setSoundVolume: updateSoundVolume,
      accountCreatedAt,
      daysActive,
      downloadBackup,
      importKnights,
    }),
    [
      knights,
      theme,
      firebaseUser,
      firebaseReady,
      isGuest,
      soundSettings,
      accountCreatedAt,
      daysActive,
    ],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContext.Provider value={value}>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <AuthModal
            isOpen={authModalState.isOpen}
            onClose={closeAuthModal}
            initialPrompt={authModalState.prompt}
            initialTab={authModalState.defaultTab}
          />
          <Toaster />
        </AppContext.Provider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
