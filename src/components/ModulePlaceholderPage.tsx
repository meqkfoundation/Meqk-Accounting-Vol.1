import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft, Coins, Construction, ShieldAlert } from "lucide-react";

export default function ModulePlaceholderPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Extract path and capitalize nicely
  const pathPart = location.pathname.replace("/", "");
  const moduleName = pathPart.charAt(0).toUpperCase() + pathPart.slice(1);

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-center items-center bg-[#050505] overflow-y-auto overflow-x-hidden px-4 py-16 text-white">
      {/* Background Ambient Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-900/15 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-950/20 blur-[120px] rounded-full pointer-events-none"></div>

      {/* Decorative Gold Header Asset */}
      <header className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-20 w-full max-w-7xl mx-auto">
        <div id="main-brand" className="flex items-center gap-2 group cursor-pointer" onClick={() => navigate("/modules")}>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-600 to-yellow-200 shadow-[0_0_20px_rgba(251,191,36,0.3)] p-[1px]">
            <div className="flex h-full w-full items-center justify-center rounded-lg bg-neutral-950">
              <Coins className="h-4.5 w-4.5 text-amber-400 group-hover:rotate-12 transition-transform duration-300" />
            </div>
          </div>
          <span className="font-serif font-semibold tracking-wider text-sm text-neutral-200 group-hover:text-amber-400 transition-colors">
            MEQK
          </span>
        </div>
      </header>

      {/* Main Glassmorphic Card (Perfect Centering) */}
      <main className="w-full max-w-md z-10 flex flex-col justify-center">
        <div className="relative group">
          {/* Card Outer Glow */}
          <div className="absolute -inset-1 bg-gradient-to-b from-amber-500/20 to-transparent blur-xl opacity-50 rounded-2xl"></div>

          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative w-full rounded-2xl bg-[#0f0f0f]/80 backdrop-blur-2xl border border-white/10 p-8 md:p-10 shadow-2xl text-center overflow-hidden"
          >
            {/* Subtle top brand decoration line */}
            <div className="h-px w-24 bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-50 mx-auto mb-6"></div>

            <div className="mx-auto w-12 h-12 bg-gradient-to-tr from-amber-600 to-yellow-200 rounded-lg shadow-[0_0_20px_rgba(251,191,36,0.2)] flex items-center justify-center mb-5">
              <Construction className="h-6 w-6 text-black animate-pulse" />
            </div>

            <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-amber-500/80 mb-2 block">
              Node Pending Integration
            </span>
            <h1 className="text-2xl font-light tracking-tight text-white mb-2">
              {moduleName || "Module"}
            </h1>
            <p className="text-xs text-white/40 uppercase tracking-[0.2em] font-mono mb-4">
              Meqk Accounting Vol.1
            </p>

            <p className="text-neutral-400 text-xs font-light leading-relaxed mb-6">
              This node's data pipeline is verified and schema configurations stand ready. Local database integration will be established in the upcoming tier.
            </p>

            {/* Back to Modules Button */}
            <button
              onClick={() => navigate("/modules")}
              className="w-full py-3 bg-neutral-950 border border-white/5 hover:border-amber-500/40 text-neutral-300 hover:text-amber-400 font-bold text-xs uppercase tracking-widest rounded-lg transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-md"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              <span>Back to Modules</span>
            </button>
          </motion.div>
        </div>
      </main>

      {/* Footer Message */}
      <footer className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center z-10">
        <p className="text-[12px] text-white/30 tracking-[0.4em] uppercase font-light">
          Thanks <span className="text-amber-500/60 font-medium">GOD</span>
        </p>
        <div className="mt-4 h-[2px] w-8 bg-amber-500/20 rounded-full"></div>
      </footer>
    </div>
  );
}
