import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./components/LoginPage";
import ModulesPage from "./components/ModulesPage";
import FinancePage from "./components/FinancePage";
import OperationsPage from "./components/OperationsPage";
import HRPage from "./components/HRPage";
import ManagementPage from "./components/ManagementPage";
import SetupPage from "./components/SetupPage";
import ModulePlaceholderPage from "./components/ModulePlaceholderPage";
import { supabase, resolveProfile } from "./lib/supabase";
import { Coins } from "lucide-react";

// Helper function to check Role Module Security Rules
export const isRouteAllowed = (roleName: string, moduleName: string, isSuperUser?: boolean): boolean => {
  if (isSuperUser) return true;
  const normRole = (roleName || "").trim().toLowerCase();
  const normMod = moduleName.toLowerCase();

  if (normRole === "admin") return true;
  if (normRole === "manager" && normMod === "management") return true;
  if (
    (normRole === "accountant" || normRole === "assistant accountant") &&
    normMod === "finance"
  ) {
    return true;
  }
  if (normRole === "hr officer" && normMod === "hr") return true;
  if (
    (normRole === "operational officer" || normRole === "operation officer") &&
    normMod === "operations"
  ) {
    return true;
  }

  if (normMod === "setup" && normRole === "admin") return true;

  return false;
};

// Route Security Guardian component
function ProtectedRoute({ 
  session, 
  profile,
  roleName, 
  isProfileLoading, 
  module, 
  children 
}: {
  session: any;
  profile: any;
  roleName: string;
  isProfileLoading: boolean;
  module: string;
  children: React.ReactNode;
}) {
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (isProfileLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col justify-center items-center">
        <div className="relative flex flex-col items-center">
          <div className="absolute w-[200px] h-[200px] bg-amber-500/5 blur-[50px] rounded-full"></div>
          <Coins className="h-6 w-6 text-amber-500 animate-pulse mb-3 z-10" />
          <span className="font-mono text-[10px] tracking-[0.3em] text-amber-500/60 z-10">
            SECURE ACCESS VALIDATION...
          </span>
        </div>
      </div>
    );
  }

  const isSuper = profile?.company_name === "Meqk Foundation";
  const allowed = isRouteAllowed(roleName, module, isSuper);
  if (!allowed) {
    return <Navigate to="/modules" replace />;
  }

  return <>{children}</>;
}

// Global App router orchestration
export default function App() {
  const [session, setSession] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Profile-based access controls
  const [profile, setProfile] = useState<any>(null);
  const [roleName, setRoleName] = useState<string>("");
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);

  // Auto logout after 30 minutes of inactivity
  useEffect(() => {
    if (!session) {
      return;
    }

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      // 30 minutes = 30 * 60 * 1000 = 1,800,000 ms
      timeoutId = setTimeout(() => {
        handleInactivityLogout();
      }, 1800000);
    };

    const handleInactivityLogout = async () => {
      try {
        if (supabase) {
          await supabase.auth.signOut();
        }
      } catch (err) {
        console.error("Error signing out due to inactivity:", err);
      }
      handleLogout();
      setShowInactivityWarning(true);
    };

    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart", "click"];
    
    // Add dynamic event listeners
    events.forEach((event) => {
      window.addEventListener(event, resetTimer, { passive: true });
    });

    // Start the timer
    resetTimer();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [session]);

  useEffect(() => {
    // 1. Initial local session validation (helps prevent full locks if sandbox refreshes)
    const storedSession = localStorage.getItem("meqk_session");
    if (storedSession) {
      try {
        setSession(JSON.parse(storedSession));
      } catch (e) {
        console.error("Error loading session cache", e);
      }
    }

    if (!supabase) {
      setIsInitializing(false);
      setIsProfileLoading(false);
      return;
    }

    // 2. Fetch connection state directly from live Supabase Auth
    supabase.auth.getSession().then(({ data: { session: activeSession } }) => {
      if (activeSession) {
        setSession(activeSession);
        localStorage.setItem("meqk_session", JSON.stringify(activeSession));
      } else {
        setIsProfileLoading(false);
      }
      setIsInitializing(false);
    });

    // 3. Listen to auth updates automatically
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (newSession) {
        setSession(newSession);
        localStorage.setItem("meqk_session", JSON.stringify(newSession));
      } else {
        setSession(null);
        setProfile(null);
        setRoleName("");
        setIsProfileLoading(false);
        localStorage.removeItem("meqk_session");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch logged-in user profile, roles caching mechanism
  useEffect(() => {
    if (!session) {
      setProfile(null);
      setRoleName("");
      setIsProfileLoading(false);
      return;
    }

    async function loadProfile() {
      const uId = session.user.id;
      // Only show full-screen loader if we don't have a profile OR the profile belongs to a different user
      const hasCorrectProfile = profile && profile.id === uId;
      if (!hasCorrectProfile) {
        setIsProfileLoading(true);
      }
      try {
        const profileData = await resolveProfile(uId);
        
        if (profileData) {
          if (profileData.is_active === false) {
            handleLogout();
            return;
          }
          setProfile(profileData);
          if (profileData.role_id) {
            const { data: roleData } = await supabase
              .from("roles")
              .select("role_name")
              .eq("id", profileData.role_id)
              .single();
            if (roleData) {
              setRoleName(roleData.role_name || "");
            }
          }
        }
      } catch (err) {
        console.error("Error loading app profile", err);
      } finally {
        setIsProfileLoading(false);
      }
    }

    loadProfile();
  }, [session]);

  const handleLoginSuccess = (userSession: any) => {
    setSession(userSession);
    localStorage.setItem("meqk_session", JSON.stringify(userSession));
  };

  const handleLogout = () => {
    setSession(null);
    setProfile(null);
    setRoleName("");
    setIsProfileLoading(false);
    localStorage.removeItem("meqk_session");
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col justify-center items-center">
        <div className="relative flex flex-col items-center">
          <div className="absolute w-[200px] h-[200px] bg-amber-500/5 blur-[50px] rounded-full"></div>
          <Coins className="h-6 w-6 text-amber-500 animate-pulse mb-3 z-10" />
          <span className="font-mono text-[10px] tracking-[0.3em] text-amber-500/60 z-10">
            LOADING MEQK COMPILERS...
          </span>
        </div>
      </div>
    );
  }

  return (
    <Router>
      {showInactivityWarning && !session && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-[90%] bg-amber-500/10 border border-amber-500/30 text-amber-250 backdrop-blur-xl px-4 py-3 rounded-xl shadow-[0_0_30px_rgba(245,158,11,0.15)] flex justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-amber-500 shrink-0" />
            <span className="text-xs font-medium">Session expired due to inactivity.</span>
          </div>
          <button 
            onClick={() => setShowInactivityWarning(false)} 
            className="text-[10px] font-mono uppercase bg-amber-500 hover:bg-amber-400 text-black px-2 py-1 rounded cursor-pointer font-bold shrink-0 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}
      <Routes>
        {/* Redirect from root index either to modules if logged in, or login */}
        <Route 
          path="/" 
          element={
            session ? <Navigate to="/modules" replace /> : <Navigate to="/login" replace />
          } 
        />
        
        {/* Login Page Route */}
        <Route 
          path="/login" 
          element={
            session ? (
              <Navigate to="/modules" replace />
            ) : (
              <LoginPage onLoginSuccess={handleLoginSuccess} />
            )
          } 
        />
        
        {/* Modules Redirect Route - Targets beautiful ModulesPage */}
        <Route 
          path="/modules" 
          element={
            session ? (
              <ModulesPage 
                session={session} 
                profile={profile}
                roleName={roleName}
                isProfileLoading={isProfileLoading}
                onLogout={handleLogout} 
              />
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />

        {/* Secure sub-module placeholder paths */}
        <Route 
          path="/management" 
          element={
            <ProtectedRoute session={session} profile={profile} roleName={roleName} isProfileLoading={isProfileLoading} module="management">
              <ManagementPage session={session} onLogout={handleLogout} />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/finance" 
          element={
            <ProtectedRoute session={session} profile={profile} roleName={roleName} isProfileLoading={isProfileLoading} module="finance">
              <FinancePage session={session} onLogout={handleLogout} />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/operations" 
          element={
            <ProtectedRoute session={session} profile={profile} roleName={roleName} isProfileLoading={isProfileLoading} module="operations">
              <OperationsPage session={session} onLogout={handleLogout} />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/hr" 
          element={
            <ProtectedRoute session={session} profile={profile} roleName={roleName} isProfileLoading={isProfileLoading} module="hr">
              <HRPage session={session} onLogout={handleLogout} />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/setup" 
          element={
            <ProtectedRoute session={session} profile={profile} roleName={roleName} isProfileLoading={isProfileLoading} module="setup">
              <SetupPage />
            </ProtectedRoute>
          } 
        />

        {/* Fallback routing */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
