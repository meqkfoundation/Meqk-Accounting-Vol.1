import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { 
  Building2, 
  Briefcase, 
  Coins, 
  Activity, 
  Users, 
  Settings, 
  LogOut, 
  KeyRound,
  ArrowRight,
  UserCheck,
  ChevronDown
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { isRouteAllowed } from "../App";

interface ModulesPageProps {
  session: any;
  profile?: any;
  roleName?: string;
  isProfileLoading?: boolean;
  onLogout: () => void;
}

export default function ModulesPage({ 
  session, 
  profile, 
  roleName = "", 
  isProfileLoading = false, 
  onLogout 
}: ModulesPageProps) {
  const navigate = useNavigate();

  const [companies, setCompanies] = React.useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = React.useState<string>(() => {
    return localStorage.getItem("meqk_active_company_id") || "all";
  });

  const isSuperUser = profile?.company_name === "Meqk Foundation";

  React.useEffect(() => {
    if (isSuperUser) {
      async function fetchCompanies() {
        const { data, error } = await supabase
          .from("companies")
          .select("*")
          .eq("is_active", true)
          .order("company_name", { ascending: true });
        if (!error && data) {
          setCompanies(data);
        }
      }
      fetchCompanies();
    }
  }, [isSuperUser]);

  const handleCompanyChange = (value: string) => {
    setSelectedCompanyId(value);
    localStorage.setItem("meqk_active_company_id", value);
  };

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    onLogout();
    navigate("/login");
  };

  const modules = [
    {
      id: "management",
      name: "Management",
      path: "/management",
      icon: Briefcase,
      color: "from-amber-500 to-yellow-500",
      description: "Executive control, compliance audits & authorization rosters."
    },
    {
      id: "finance",
      name: "Finance",
      path: "/finance",
      icon: Coins,
      color: "from-yellow-400 to-amber-600",
      description: "General ledger alignment, smart accounts & liquidity monitoring."
    },
    {
      id: "operations",
      name: "Operations",
      path: "/operations",
      icon: Activity,
      color: "from-amber-600 to-yellow-400",
      description: "Secure pipelines, activity streams & system integrity controls."
    },
    {
      id: "hr",
      name: "HR",
      path: "/hr",
      icon: Users,
      color: "from-yellow-500 to-amber-700",
      description: "Identity verification, node access controls & workforce ledgers."
    },
    {
      id: "setup",
      name: "Setup",
      path: "/setup",
      icon: Settings,
      color: "from-amber-700 to-yellow-300",
      description: "Terminal telemetry, gateway configurations & crypt-keys rotation."
    },
  ];

  const filteredModules = modules.filter(mod => isRouteAllowed(roleName, mod.id, isSuperUser));

  if (isProfileLoading) {
    return (
      <div id="modules-container" className="relative min-h-screen w-full flex flex-col justify-center items-center bg-[#050505]">
        <Coins className="h-6 w-6 text-amber-500 animate-pulse mb-3" />
        <span className="font-mono text-[10px] tracking-[0.3em] text-amber-500/60 font-medium">
          RESOLVING SECURITY CLEARANCE...
        </span>
      </div>
    );
  }

  return (
    <div id="modules-container" className="relative min-h-screen w-full overflow-hidden text-white">
      {/* Isolated background layer */}
      <div className="absolute inset-0 pointer-events-none -z-0 modules-animated-bg overflow-hidden">
        {/* Background Ambient Glows with warm gold glow */}
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-amber-500/15 blur-[140px] rounded-full pointer-events-none animate-float-1"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-yellow-500/12 blur-[140px] rounded-full pointer-events-none animate-float-2"></div>
        <div className="absolute top-[30%] left-[20%] w-[45%] h-[45%] bg-amber-600/11 blur-[120px] rounded-full pointer-events-none animate-pulse"></div>
      </div>

      {/* Static Content layer */}
      <div className="relative z-10 min-h-screen w-full flex flex-col justify-between items-center overflow-y-auto overflow-x-hidden px-4 py-4 md:py-6">
        {/* Header telemetry & layout matching Design HTML */}
        <div className="absolute top-4 right-4 md:top-8 md:right-8 flex items-center space-x-2 z-20">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
          <span className="text-[10px] text-white/20 uppercase tracking-widest font-mono">Telemetry Active</span>
        </div>
        <div className="absolute bottom-4 left-4 md:bottom-8 md:left-8 text-[11px] text-white/10 [writing-mode:vertical-lr] transform rotate-180 uppercase tracking-widest font-mono hidden md:block">
          Meqk OS // Secure Gateway
        </div>

        {/* Decorative Gold Header Asset */}
        <header className="absolute top-0 left-0 right-0 p-4 md:p-6 flex justify-between items-center z-20 w-full max-w-7xl mx-auto">
          <div id="main-brand" className="flex items-center gap-2 group cursor-pointer" onClick={() => navigate("/modules")}>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-600 to-yellow-200 shadow-[0_0_20px_rgba(251,191,36,0.3)] p-[1px]">
              <div className="flex h-full w-full items-center justify-center rounded-lg bg-neutral-950">
                <Coins className="h-4 w-4 text-amber-400 group-hover:rotate-12 transition-transform duration-300" />
              </div>
            </div>
            <span className="font-serif font-semibold tracking-wider text-xs md:text-sm text-neutral-200 group-hover:text-amber-400 transition-colors">
              MEQK
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono tracking-wide bg-neutral-950 border border-white/5 hover:border-amber-500/40 text-neutral-400 hover:text-amber-400 transition-all duration-300 shadow-md cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            SECURE OUT
          </button>
        </header>

      {/* Center Dashboard */}
      <main className="w-full max-w-7xl my-auto z-10 flex flex-col items-center pt-12 pb-6">
        
        {/* Title Group */}
        <div className="text-center mb-6 w-full max-w-xl">
          <span className="text-[11px] font-mono uppercase tracking-[0.3em] text-amber-500/80 mb-1 block">
            System Terminal
          </span>
          <h1 className="text-3xl md:text-4xl font-light tracking-tight text-white mb-2">
            Select{" "}
            <span className="bg-gradient-to-r from-amber-200 via-yellow-500 to-amber-600 bg-clip-text text-transparent font-semibold">
              Module
            </span>
          </h1>
          <p className="text-xs text-white/40 uppercase tracking-[0.2em] font-mono leading-relaxed">
            Meqk Accounting Vol.1
          </p>
          <div className="h-px w-24 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent mx-auto mt-3"></div>
        </div>

        {/* Super User Company Selector */}
        {isSuperUser && (
          <div className="w-full max-w-md bg-zinc-950/65 backdrop-blur-md border border-amber-500/25 rounded-2xl p-4 mb-6 shadow-[0_0_20px_rgba(245,158,11,0.08)] text-center">
            <label className="block text-[10px] font-mono uppercase tracking-[0.3em] text-amber-400/80 mb-1.5 font-medium">
              Select Company Context (Super User)
            </label>
            <div className="relative animate-fade-in">
              <select
                value={selectedCompanyId}
                onChange={(e) => handleCompanyChange(e.target.value)}
                className="w-full bg-neutral-900 border border-amber-500/15 rounded-xl py-2 pl-3 pr-10 text-xs text-neutral-200 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/40 transition-colors cursor-pointer appearance-none uppercase font-mono tracking-wider h-9"
              >
                <option value="all" className="bg-zinc-950 text-amber-400">--- All Companies (Aggregated) ---</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id} className="bg-zinc-950 text-neutral-300">
                     {c.company_name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-amber-500">
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          </div>
        )}

        {/* Modules Centered Grid Layout */}
        <div className="flex flex-wrap lg:flex-nowrap justify-center gap-4 w-full max-w-7xl px-4 overflow-x-auto lg:overflow-x-visible py-2 custom-scrollbar">
          {filteredModules.length === 0 ? (
            <div id="no-access-warning" className="p-8 rounded-2xl border border-dashed border-amber-500/25 text-center bg-zinc-950/20 backdrop-blur-md max-w-xl mx-auto">
              <UserCheck className="h-8 w-8 text-amber-500/50 mx-auto mb-2 animate-bounce" />
              <h3 className="text-sm font-semibold text-neutral-300">No module access assigned.</h3>
              <p className="text-xs text-neutral-500 mt-1">Please contact your administrator to configure security role details.</p>
            </div>
          ) : (
            filteredModules.map((mod, index) => {
              const IconComponent = mod.icon;
              return (
                <motion.div
                  key={mod.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1, ease: "easeOut" }}
                  onClick={() => navigate(mod.path)}
                  className="group relative cursor-pointer rounded-2xl bg-zinc-950/45 backdrop-blur-md border border-amber-500/15 p-5 md:p-6 flex flex-col items-center text-center transition-all duration-300 hover:scale-[1.02] hover:border-amber-500/45 hover:bg-amber-950/10 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)] overflow-hidden w-full sm:w-[250px] md:w-[260px] lg:w-[210px] xl:w-[230px] shrink-0 lg:shrink"
                >
                  {/* Accent line appearing on hover */}
                  <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                  {/* Styled Luxury Gold Icon Frame */}
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-neutral-900 to-neutral-800 border border-white/10 group-hover:border-amber-500/25 group-hover:from-amber-600/10 group-hover:to-yellow-500/15 group-hover:shadow-[0_0_15px_rgba(251,191,36,0.2)] p-[1px] transition-all duration-300">
                    <div className="flex h-full w-full items-center justify-center rounded-xl bg-[#0b0b0b]/60">
                      <IconComponent className="h-5.5 w-5.5 text-amber-500 group-hover:scale-110 group-hover:text-amber-400 transition-transform duration-300" />
                    </div>
                  </div>

                  {/* Module Details */}
                  <h3 className="text-base font-medium text-neutral-100 tracking-tight group-hover:text-amber-300 transition-colors duration-300 mb-1.5">
                    {mod.name}
                  </h3>
                  
                  <p className="text-[11px] text-neutral-400 font-light leading-relaxed mb-3 flex-grow">
                    {mod.description}
                  </p>

                  {/* Action Arrow */}
                  <div className="flex items-center gap-1 text-[9px] uppercase tracking-widest font-semibold text-amber-500/50 group-hover:text-amber-400 transition-colors duration-300 mt-auto pt-1">
                    <span>Enter Node</span>
                    <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform duration-300" />
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Minimal Session Telemetry indicator */}
        <div className="mt-8 text-[10px] font-mono text-neutral-500 bg-neutral-950/40 border border-white/5 rounded-full px-4 py-1.5 flex items-center gap-2">
          <KeyRound className="h-3 w-3 text-amber-500/60" />
          <span>SESSION AUTHENTICATED:</span>
          <span className="text-neutral-300 truncate max-w-[150px]">{session?.user?.email || session?.email || "Admin"}</span>
        </div>

      </main>

      {/* Footer Message matching Design HTML */}
      <footer className="absolute bottom-2 sm:bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center z-10">
        <p className="text-[12px] text-white/30 tracking-[0.4em] uppercase font-light">
          Thanks <span className="text-amber-500/60 font-medium">GOD</span>
        </p>
        <div className="mt-3 h-[2px] w-8 bg-amber-500/20 rounded-full"></div>
      </footer>
      </div>
    </div>
  );
}
