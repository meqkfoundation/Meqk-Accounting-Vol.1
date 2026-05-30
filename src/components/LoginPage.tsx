import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "motion/react";
import { 
  Building2, 
  Lock, 
  User, 
  Loader2, 
  AlertCircle, 
  TrendingUp, 
  Coins, 
  KeyRound, 
  ArrowRight,
  Database,
  CheckCircle2,
  HelpCircle
} from "lucide-react";
import { supabase, supabaseUrl } from "../lib/supabase";

// Validation schema using Zod
// Meets requirement 8 (Zod validation) and requirement 5, 6, 7 (clean, empty, no placeholders/example credentials)
const loginSchema = z.object({
  username: z.string().min(1, "Username or email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface LoginPageProps {
  onLoginSuccess: (session: any) => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showConfigTips, setShowConfigTips] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  // Handle submit and authenticate with Supabase Auth
  // Meets requirement 9, 10, 11
  const onSubmit = async (data: LoginFormValues) => {
    setLoading(true);
    setErrorMessage(null);

    if (!supabase) {
      setLoading(false);
      setErrorMessage(
        "Supabase is not configured yet. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to authenticate with live database."
      );
      return;
    }

    try {
      // In Supabase, standard sign-in is done with email.
      // We pass the entered Username parameter as email to the Supabase client.
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.username,
        password: data.password,
      });

      if (authError) {
        throw authError;
      }

      if (authData?.session) {
        onLoginSuccess(authData.session);
      } else {
        throw new Error("Login failed. No session returned.");
      }
    } catch (err: any) {
      // Show clean error messages when login fails
      setErrorMessage(err.message || "Invalid credentials or authentication failure.");
    } finally {
      setLoading(false);
    }
  };

  const isSupabaseConfigured = !!supabaseUrl && (supabaseUrl as string) !== "PASTE_SUPABASE_URL_HERE" && (supabaseUrl as string) !== "";

  return (
    <div id="login-container" className="relative min-h-screen w-full overflow-hidden text-white">
      {/* Isolated background layer */}
      <div className="absolute inset-0 pointer-events-none -z-0 login-animated-bg overflow-hidden">
        {/* Background Ambient Glows */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-gradient-to-tr from-amber-500/20 to-yellow-600/10 blur-[130px] rounded-full pointer-events-none animate-float-1"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[55%] h-[55%] bg-gradient-to-bl from-amber-600/25 to-yellow-500/10 blur-[140px] rounded-full pointer-events-none animate-float-2"></div>
        <div className="absolute top-[25%] left-[25%] w-[40%] h-[40%] bg-amber-500/15 blur-[150px] rounded-full pointer-events-none animate-pulse"></div>
      </div>

      {/* Static Content layer */}
      <div className="relative z-10 min-h-screen w-full flex flex-col justify-center items-center overflow-y-auto overflow-x-hidden px-4 py-4 md:py-6 animate-fade-in">
        {/* Decors & System Status Info matching the Design HTML */}
        <div className="absolute top-4 right-4 md:top-8 md:right-8 flex items-center space-x-2 z-20">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
          <span className="text-[10px] text-white/20 uppercase tracking-widest font-mono">System Online</span>
        </div>
        <div className="absolute bottom-4 left-4 md:bottom-8 md:left-8 text-[11px] text-white/10 [writing-mode:vertical-lr] transform rotate-180 uppercase tracking-widest font-mono hidden md:block">
          Ver. 1.0.4 // Production Build
        </div>

        {/* Decorative Gold Header Asset */}
        <header className="absolute top-0 left-0 right-0 p-4 md:p-6 flex justify-between items-center z-20 w-full max-w-7xl mx-auto">
          <div id="main-brand" className="flex items-center gap-2 group cursor-pointer">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-600 to-yellow-200 shadow-[0_0_20px_rgba(251,191,36,0.3)] p-[1px]">
              <div className="flex h-full w-full items-center justify-center rounded-lg bg-neutral-950">
                <Coins className="h-4 w-4 text-amber-400 group-hover:rotate-12 transition-transform duration-300" />
              </div>
            </div>
            <span className="font-serif font-semibold tracking-wider text-xs md:text-sm text-neutral-200 group-hover:text-amber-400 transition-colors">
              MEQK
            </span>
          </div>
        </header>

        {/* Main Glassmorphic Card (Perfect Centering) */}
        <main className="w-full max-w-md z-10 flex flex-col justify-center my-auto py-12">
          <div className="relative group">
            {/* Card Outer Glow matching the Design HTML */}
            <div className="absolute -inset-1 bg-gradient-to-b from-amber-500/20 to-transparent blur-xl opacity-50 rounded-2xl"></div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full rounded-2xl bg-[#0a0a0a]/45 backdrop-blur-3xl border border-white/10 p-6 md:p-8 shadow-2xl overflow-hidden"
            >
            {/* Subtle top brand decoration line */}
            <div className="h-px w-24 bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-50 mx-auto mb-3"></div>

            <div className="text-center mb-3">
              <div className="mx-auto w-11 h-11 bg-gradient-to-tr from-amber-600 to-yellow-200 rounded-lg shadow-[0_0_20px_rgba(251,191,36,0.3)] flex items-center justify-center mb-2">
                <Building2 className="h-4.5 w-4.5 text-black" />
              </div>
              
              {/* Welcome on its own line */}
              <h1 className="text-xl font-light tracking-tight text-white mb-0">
                Welcome
              </h1>
              {/* Meqk Accounting Vol.1 directly below */}
              <div className="text-2xl font-bold tracking-tight bg-gradient-to-r from-amber-200 via-yellow-500 to-amber-600 bg-clip-text text-transparent mb-0.5">
                Meqk Accounting Vol.1
              </div>
              <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-mono mb-1">Institutional Access</p>
            </div>

            {/* Form Segment with reduced spacing */}
            <form id="accounting-login-form" onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              {/* Feedback Alert - Meets requirement 11 (Clean Error Messages ONLY when login fails) */}
              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="p-3 bg-red-950/40 border border-red-500/30 rounded-lg flex items-start gap-2.5 text-left"
                >
                  <AlertCircle className="h-4.5 w-4.5 text-red-400 shrink-0 mt-0.5" />
                  <span className="text-red-300 text-xs leading-relaxed font-light">{errorMessage}</span>
                </motion.div>
              )}

              {/* Username block - Meets requirement 4, 5, 6, 7 (clean, empty, no placeholders/examples) */}
              <div id="username-field-group" className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-amber-500/80 font-medium ml-1 block text-left">
                  Username
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                    <User className="h-4 w-4" />
                  </span>
                  <input
                    id="username-input"
                    type="text"
                    autoComplete="username"
                    {...register("username")}
                    className={`w-full bg-black/40 border border-white/5 focus:border-amber-500/50 outline-none rounded-lg pl-10 pr-4 py-2.5 text-sm transition-all focus:ring-1 focus:ring-amber-500/20 ${
                      errors.username ? "border-red-500/50 focus:border-red-500" : ""
                    }`}
                  />
                </div>
                <div className="h-4 text-left">
                  {errors.username && (
                    <span className="text-[11px] text-red-400 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.username.message}
                    </span>
                  )}
                </div>
              </div>

              {/* Password block - Meets requirement 4, 5, 6, 7 (clean, empty, no placeholders/examples) */}
              <div id="password-field-group" className="space-y-1">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] uppercase tracking-wider text-amber-500/80 font-medium">
                    Password
                  </label>
                  <span className="text-[9px] text-white/30 hover:text-amber-400 cursor-pointer">Recovery</span>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    id="password-input"
                    type="password"
                    autoComplete="current-password"
                    {...register("password")}
                    className={`w-full bg-black/40 border border-white/5 focus:border-amber-500/50 outline-none rounded-lg pl-10 pr-4 py-2.5 text-sm transition-all focus:ring-1 focus:ring-amber-500/20 ${
                      errors.password ? "border-red-500/50 focus:border-red-500" : ""
                    }`}
                  />
                </div>
                <div className="h-4 text-left">
                  {errors.password && (
                    <span className="text-[11px] text-red-400 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.password.message}
                    </span>
                  )}
                </div>
              </div>

              {/* Submit Button - Meets requirement 10 */}
              <div className="pt-2">
                <button
                  id="login-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 text-black font-bold text-sm rounded-lg shadow-[0_4px_15px_rgba(180,120,0,0.3)] hover:shadow-[0_6px_20px_rgba(180,120,0,0.5)] transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-black shrink-0" />
                      <span>AUTHENTICATING SECURELY...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to Terminal</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Microcopy inside card matching Design HTML */}
            <div className="mt-6 flex items-center justify-center space-x-4 opacity-40">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/20"></div>
              <span className="text-[9px] uppercase tracking-[0.3em] font-mono whitespace-nowrap">Secure Environment</span>
              <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/20"></div>
            </div>

            {/* Secure Audit Legend */}
            <div className="mt-5 pt-3.5 border-t border-neutral-900 flex items-center justify-between text-[10px] font-mono text-neutral-500">
              <div className="flex items-center gap-1">
                <KeyRound className="h-3 w-3 text-amber-500/60" />
                <span>TLS 1.3 SECURED</span>
              </div>
              <div>AUDITED VOL.1</div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer Message matching the Design HTML exactly (Thanks GOD at center bottom) */}
      <footer className="absolute bottom-3 sm:bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center z-10">
        <p className="text-[12px] text-white/30 tracking-[0.4em] uppercase font-light">
          Thanks <span className="text-amber-500/60 font-medium">GOD</span>
        </p>
        <div className="mt-3 h-[2px] w-8 bg-amber-500/20 rounded-full"></div>
      </footer>
      </div>
    </div>
  );
}
