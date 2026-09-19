import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  BrowserRouter, Route, Routes, useLocation, useNavigate,
} from "react-router-dom";
import { ThemeProvider } from "./theme/ThemeProvider";
import { AnimatedBackground } from "./theme/AnimatedBackground";
import { SessionProvider, useSession } from "./auth/SessionProvider";
import { SignInDialog } from "./auth/SignInDialog";
import { ViewModeProvider, useViewMode } from "./view/ViewModeProvider";
import { ViewModeSwitch } from "./components/ViewModeSwitch";
import { NavbarControls } from "./components/NavbarControls";
import { ThemeDialog } from "./theme/ThemeDialog";
import { RealtimeProvider, useRealtime } from "./realtime/RealtimeProvider";
import {
  Badge, BottomNav, Card, Icon, IconButton, MobileDrawer, Skeleton,
  TopNavbar, TopProgressBar, PUBLIC_NAV_ITEMS, PERSONAL_NAV_ITEMS,
} from "./components/m3";
import Dashboard from "./pages/Dashboard";

// Charting is heavy and only needed on one route, so the rest of the pages are
// split out and fetched on navigation.
const Transactions = lazy(() => import("./pages/Transactions"));
const Players = lazy(() => import("./pages/Players"));
const PlayerDetail = lazy(() => import("./pages/PlayerDetail"));
const Leaderboards = lazy(() => import("./pages/Leaderboards"));
const Orders = lazy(() => import("./pages/Orders"));
const Balances = lazy(() => import("./pages/Balances"));
const Me = lazy(() => import("./pages/Me"));
const MeTransactions = lazy(() => import("./pages/MeTransactions"));
const MeOrders = lazy(() => import("./pages/MeOrders"));
const MeFriends = lazy(() => import("./pages/MeFriends"));
const MeBalance = lazy(() => import("./pages/MeBalance"));
const Statistics = lazy(() => import("./pages/Statistics"));
const Settings = lazy(() => import("./pages/Settings"));

interface PageMeta {
  title: string;
  subtitle: string;
}

const PAGES: Record<string, PageMeta> = {
  "/": { title: "Dashboard", subtitle: "Live overview of observed transactions" },
  "/transactions": { title: "Transactions", subtitle: "Every parsed event from connected trackers" },
  "/orders": { title: "Orders", subtitle: "Buy orders and their fulfilment progress" },
  "/balances": { title: "Balances", subtitle: "Balance snapshots observed in chat" },
  "/me": { title: "Overview", subtitle: "Your spending, earnings and profit" },
  "/me/transactions": { title: "History", subtitle: "Every event that belongs to you" },
  "/me/orders": { title: "Your Orders", subtitle: "Orders you created and their progress" },
  "/me/friends": { title: "Friends", subtitle: "Players you follow and their observed activity" },
  "/me/balance": { title: "Your Balance", subtitle: "Balance snapshots seen in chat" },
  "/players": { title: "Players", subtitle: "Observed traders and their activity" },
  "/leaderboards": { title: "Leaderboards", subtitle: "Top players ranked on donutstats.co" },
  "/statistics": { title: "Statistics", subtitle: "Aggregated totals and money flow" },
  "/settings": { title: "Settings", subtitle: "Configuration and connection details" },
};

function metaFor(pathname: string): PageMeta {
  if (PAGES[pathname]) return PAGES[pathname];
  if (pathname.startsWith("/players/")) {
    return { title: "Player", subtitle: "Player detail and recent activity" };
  }
  return { title: "Not found", subtitle: "The requested page does not exist" };
}

function ConnectionBadge({ compact = false }: { compact?: boolean }) {
  const { connected } = useRealtime();
  return (
    <Badge tone={connected ? "primary" : "error"} icon={connected ? "wifi" : "wifi-off"}>
      {compact ? (
        <span>{connected ? "Live" : "Off"}</span>
      ) : (
        <>
          <span className="hidden sm:inline">{connected ? "Live" : "Offline"}</span>
          <span className="sm:hidden">{connected ? "Live" : "Off"}</span>
        </>
      )}
    </Badge>
  );
}

/** Account row used inside the mobile drawer footer. */
function DrawerAccount() {
  const { username, openSignIn, signOut } = useSession();
  const navigate = useNavigate();
  const { setMode } = useViewMode();

  if (!username) {
    return (
      <button
        type="button"
        onClick={openSignIn}
        className="state-layer relative flex w-full items-center gap-3 rounded-2xl bg-primary px-4 py-3 text-left text-on-primary"
      >
        <Icon name="lock" size={20} />
        <span className="text-sm font-medium">Sign in to your view</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface-container px-3 py-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-primary">
        <Icon name="person" size={20} filled />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-on-surface">{username}</p>
        <p className="text-[11px] text-on-surface-variant">Signed in</p>
      </div>
      <IconButton
        icon="logout"
        label="Sign out"
        size="sm"
        onClick={() => {
          void signOut();
          setMode("public");
          navigate("/");
        }}
      />
    </div>
  );
}

function Shell() {
  const location = useLocation();
  const { signInOpen, closeSignIn } = useSession();
  const { mode, setMode } = useViewMode();
  const [themeOpen, setThemeOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [navigating, setNavigating] = useState(false);

  const meta = useMemo(() => metaFor(location.pathname), [location.pathname]);
  const navItems = mode === "personal" ? PERSONAL_NAV_ITEMS : PUBLIC_NAV_ITEMS;

  // The `/me/*` routes only make sense in personal mode, so a deep link or the
  // sign-in dialog flipping to them also flips the navigation.
  useEffect(() => {
    if (location.pathname.startsWith("/me") && mode !== "personal") {
      setMode("personal");
    }
  }, [location.pathname, mode, setMode]);

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  // Show a brief progress rail and reset scroll on navigation.
  useEffect(() => {
    setNavigating(true);
    window.scrollTo({ top: 0, behavior: "auto" });
    const timer = window.setTimeout(() => setNavigating(false), 450);
    return () => window.clearTimeout(timer);
  }, [location.pathname]);

  const actions = <NavbarControls onOpenAppearance={() => setThemeOpen(true)} />;

  return (
    <div className="relative z-[1] min-h-screen text-on-surface">
      <TopProgressBar active={navigating} />

      <TopNavbar
        items={navItems}
        actions={actions}
        onOpenMenu={() => setNavOpen(true)}
      />

      <main className="app-container pb-28 pt-6 md:pb-12 md:pt-8">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3 md:mb-7">
          <div className="min-w-0">
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              <Icon name={mode === "personal" ? "lock" : "dashboard"} size={14} filled />
              {mode === "personal" ? "Personal" : "Public"}
            </p>
            <h1 className="truncate text-2xl font-semibold tracking-[-0.02em] text-on-surface sm:text-[28px]">
              {meta.title}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">{meta.subtitle}</p>
          </div>
          <div className="hidden md:flex md:items-center md:gap-2">
            <ConnectionBadge compact />
          </div>
        </header>

        {/* Keyed by path so each route plays its entrance animation */}
        <div key={location.pathname} className="animate-page-in">
          <Suspense fallback={<RouteSkeleton />}>
            <Routes location={location}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/balances" element={<Balances />} />
              <Route path="/me" element={<Me />} />
              <Route path="/me/transactions" element={<MeTransactions />} />
              <Route path="/me/orders" element={<MeOrders />} />
              <Route path="/me/friends" element={<MeFriends />} />
              <Route path="/me/balance" element={<MeBalance />} />
              <Route path="/players" element={<Players />} />
              <Route path="/players/:username" element={<PlayerDetail />} />
              <Route path="/leaderboards" element={<Leaderboards />} />
              <Route path="/statistics" element={<Statistics />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </div>
      </main>

      <MobileDrawer
        open={navOpen}
        onClose={() => setNavOpen(false)}
        items={navItems}
        beforeNav={<ViewModeSwitch />}
        footer={
          <>
            <ConnectionBadge />
            <DrawerAccount />
          </>
        }
      />

      <BottomNav items={navItems} onOpenMenu={() => setNavOpen(true)} />

      <ThemeDialog open={themeOpen} onClose={() => setThemeOpen(false)} />
      <SignInDialog open={signInOpen} onClose={closeSignIn} />
    </div>
  );
}

function RouteSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading page">
      <Card>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-3 h-3 w-72" />
      </Card>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <Skeleton className="mb-3 h-4 w-24" />
            <Skeleton className="h-7 w-28" />
          </Card>
        ))}
      </div>
      <Card>
        <Skeleton className="h-40 w-full rounded-xl" />
      </Card>
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex flex-col items-center py-24 text-center">
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
        <Icon name="alert" size={28} />
      </span>
      <h2 className="text-xl font-medium">Page not found</h2>
      <p className="mt-1 text-sm text-on-surface-variant">
        Use the navigation to return to the dashboard.
      </p>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <RealtimeProvider>
        <ViewModeProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <SessionProvider>
              <AnimatedBackground />
              <Shell />
            </SessionProvider>
          </BrowserRouter>
        </ViewModeProvider>
      </RealtimeProvider>
    </ThemeProvider>
  );
}
