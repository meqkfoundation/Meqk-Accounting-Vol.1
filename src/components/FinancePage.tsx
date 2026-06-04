import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  LayoutDashboard,
  ReceiptText,
  CirclePlus,
  MessageSquareText,
  FileBarChart,
  Coins,
  LogOut,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  User,
  Calendar,
  Lock,
  Menu,
  Database,
  Grid,
  TrendingUp,
  FileText,
  BadgeAlert,
  ArrowRightLeft,
  Workflow,
  HelpCircle,
  FileCheck,
  Bus,
  Trash2,
  Plus,
  Save,
  CheckCircle2,
  FileSpreadsheet,
  Upload,
  AlertTriangle,
  Filter,
  Download,
  Search,
  FileDown,
  Mail,
  Send,
  Inbox,
  Pencil
} from "lucide-react";
import { supabase, resolveProfile, getActiveCompanyId } from "../lib/supabase";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  useReactTable,
  getCoreRowModel,
  flexRender
} from "@tanstack/react-table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import * as XLSX from "xlsx";

const singleLineSchema = z.object({
  transaction_date: z.any().optional(),
  cash_type_id: z.any().optional(),
  staff_id: z.any().optional(),
  bus_id: z.any().optional(),
  route_id: z.any().optional(),
  account_id: z.any().optional(),
  category_id: z.any().optional(),
  reference_number: z.string().optional().nullable(),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
});

const transactionsFormSchema = z.object({
  lines: z.array(singleLineSchema).min(1, "At least one line is required"),
});

type TransactionsFormValues = z.infer<typeof transactionsFormSchema>;

const singleInvoiceLineSchema = z.object({
  invoice_date: z.any().optional(),
  invoice_type_id: z.any().optional(),
  staff_id: z.any().optional(),
  bus_id: z.any().optional(),
  route_id: z.any().optional(),
  gross_amount: z.coerce.number().positive("Amount must be greater than 0"),
});

const invoicesFormSchema = z.object({
  lines: z.array(singleInvoiceLineSchema).min(1, "At least one line is required"),
});

type InvoicesFormValues = z.infer<typeof invoicesFormSchema>;

interface FinancePageProps {
  session: any;
  onLogout: () => void;
}

type TabType = "dashboard" | "invoices" | "transactions" | "actions" | "memos" | "reports";

export default function FinancePage({ session, onLogout }: FinancePageProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [currentUserRoleName, setCurrentUserRoleName] = useState<string>("");
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  useEffect(() => {
    async function fetchUserProfile() {
      const uId = session?.user?.id || session?.id;
      if (!uId) {
        setIsProfileLoading(false);
        return;
      }
      try {
        setIsProfileLoading(true);
        const data = await resolveProfile(uId);
        if (data) {
          const activeCompanyId = getActiveCompanyId(data);
          data.company_id = activeCompanyId;
          setCurrentUserProfile(data);
          
          if (data.role_id) {
            const { data: rData, error: rError } = await supabase
              .from("roles")
              .select("role_name")
              .eq("id", data.role_id)
              .single();
            if (!rError && rData) {
              setCurrentUserRoleName(rData.role_name || "");
            }
          }
        }
      } catch (err) {
        console.error("Error fetching user profile:", err);
      } finally {
        setIsProfileLoading(false);
      }
    }
    fetchUserProfile();
  }, [session]);

  const [unreadMemosCount, setUnreadMemosCount] = useState<number>(0);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);

  const fetchUnreadMemosCount = async () => {
    if (!currentUserProfile?.id) return;
    try {
      const { count, error } = await supabase
        .from("memos")
        .select("*", { count: "exact", head: true })
        .eq("receiver_id", currentUserProfile.id)
        .eq("is_read", false);
      if (!error && count !== null) {
        setUnreadMemosCount(count);
      }
    } catch (err) {
      console.error("Error fetching unread memos count:", err);
    }
  };

  const fetchPendingApprovalsCount = async () => {
    if (!currentUserProfile) return;
    try {
      const companyId = currentUserProfile.company_id;
      const { data: statusRows } = await supabase
        .from("transaction_statuses")
        .select("id, slug, display_name");
      const pendingObj = statusRows?.find(
        (s: any) => s.slug?.toLowerCase() === "pending" || s.display_name?.toLowerCase() === "pending"
      );
      if (pendingObj) {
        const pendingId = pendingObj.id;
        let q = supabase
          .from("cash")
          .select("*", { count: "exact", head: true })
          .eq("status_id", pendingId);
        if (companyId) {
          q = q.eq("company_id", companyId);
        }
        const { count, error } = await q;
        if (!error && count !== null) {
          setPendingApprovalsCount(count);
        }
      }
    } catch (err) {
      console.error("Error fetching pending approvals count:", err);
    }
  };

  useEffect(() => {
    if (currentUserProfile) {
      fetchUnreadMemosCount();
      fetchPendingApprovalsCount();
    }
  }, [currentUserProfile]);

  // Lifted lookups state at FinancePage top level (cached, fetched once)
  const [lookups, setLookups] = useState<{
    cashTypes: any[];
    staffs: any[];
    buses: any[];
    routes: any[];
    accounts: any[];
    categories: any[];
    invoiceTypes: any[];
    transactionStatuses: any[];
    loaded: boolean;
    loading: boolean;
    error: string | null;
  }>({
    cashTypes: [],
    staffs: [],
    buses: [],
    routes: [],
    accounts: [],
    categories: [],
    invoiceTypes: [],
    transactionStatuses: [],
    loaded: false,
    loading: false,
    error: null,
  });

  useEffect(() => {
    async function loadAllLookups() {
      if (!currentUserProfile) return;
      if (lookups.loaded || lookups.loading) return;
      
      const companyId = currentUserProfile.company_id;
      if (!companyId) return;

      try {
        setLookups(prev => ({ ...prev, loading: true }));
        
        let qCashTypes = supabase.from("cash_types").select("id, type_name").eq("is_active", true);
        let qStaffs = supabase.from("staffs").select("id, full_name").eq("is_active", true);
        let qBuses = supabase.from("buses").select("id, plate_number").eq("is_active", true);
        let qRoutes = supabase.from("routes").select("id, route_name").eq("is_active", true);
        let qAccounts = supabase.from("accounts").select("id, account_name").eq("is_active", true);
        let qCategories = supabase.from("categories").select("id, category_name").eq("is_active", true);
        let qInvoiceTypes = supabase.from("invoice_types").select("id, type_name").eq("is_active", true);
        let qStatuses = supabase.from("transaction_statuses").select("*");

        if (companyId) {
          qStaffs = qStaffs.eq("company_id", companyId);
          qBuses = qBuses.eq("company_id", companyId);
          qRoutes = qRoutes.eq("company_id", companyId);
          qAccounts = qAccounts.eq("company_id", companyId);
          qCategories = qCategories.eq("company_id", companyId);
        }

        const [
          resCashTypes,
          resStaffs,
          resBuses,
          resRoutes,
          resAccounts,
          resCategories,
          resInvoiceTypes,
          resStatuses
        ] = await Promise.all([
          qCashTypes,
          qStaffs,
          qBuses,
          qRoutes,
          qAccounts,
          qCategories,
          qInvoiceTypes,
          qStatuses
        ]);

        const errors = [
          resCashTypes.error,
          resStaffs.error,
          resBuses.error,
          resRoutes.error,
          resAccounts.error,
          resCategories.error,
          resInvoiceTypes.error,
          resStatuses.error
        ].filter(Boolean);

        if (errors.length > 0) {
          console.warn("Some lookup tables failed to load from Supabase:", errors);
        }

        setLookups({
          cashTypes: resCashTypes.data?.map(o => ({ id: o.id, name: o.type_name })) || [],
          staffs: resStaffs.data?.map(o => ({ id: o.id, name: o.full_name })) || [],
          buses: resBuses.data?.map(o => ({ id: o.id, name: o.plate_number })) || [],
          routes: resRoutes.data?.map(o => ({ id: o.id, name: o.route_name })) || [],
          accounts: resAccounts.data?.map(o => ({ id: o.id, name: o.account_name })) || [],
          categories: resCategories.data?.map(o => ({ id: o.id, name: o.category_name })) || [],
          invoiceTypes: resInvoiceTypes.data?.map(o => ({ id: o.id, name: o.type_name })) || [],
          transactionStatuses: resStatuses.data || [],
          loaded: true,
          loading: false,
          error: null
        });
      } catch (err: any) {
        console.error("Failed loading all lookup tables:", err);
        setLookups(prev => ({ ...prev, loading: false, error: err.message || String(err) }));
      }
    }
    loadAllLookups();
  }, [currentUserProfile, lookups.loaded, lookups.loading]);

  // Authenticated user session info extraction
  const email = session?.user?.email || session?.email || "";
  const username = currentUserProfile?.full_name || email || "Current User";
  const userRole = currentUserRoleName || "Role Not Assigned";
  const fiscalYear = "FY 2026-2027"; // This exists, if missing we fallback to 'Current Fiscal Year'

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    onLogout();
    navigate("/login");
  };

  const navItems = [
    {
      id: "dashboard" as TabType,
      label: "Financial Dashboard",
      subtitle: "Monitor financial performance, cash flow, and accounting summaries.",
      icon: LayoutDashboard,
    },
    {
      id: "invoices" as TabType,
      label: "Invoices",
      subtitle: "Track billing statements and bulk parse spreadsheets.",
      icon: FileText,
    },
    {
      id: "transactions" as TabType,
      label: "Transactions",
      subtitle: "Record, review, and manage financial entries.",
      icon: ReceiptText,
    },
    {
      id: "actions" as TabType,
      label: "Actions",
      subtitle: "Manage approvals, posting actions, reversals, and finance workflows.",
      icon: CirclePlus,
    },
    {
      id: "memos" as TabType,
      label: "Memos",
      subtitle: "Create and track internal finance communication.",
      icon: MessageSquareText,
    },
    {
      id: "reports" as TabType,
      label: "Reports",
      subtitle: "Generate financial reports, exports, and compliance outputs.",
      icon: FileBarChart,
    },
  ];

  const currentNav = navItems.find((item) => item.id === activeTab) || navItems[0];

  return (
    <div className="relative min-h-screen finance-animated-bg text-neutral-200 font-sans flex overflow-hidden">
      
      {/* BACKGROUND DECORATIONS (Gold & Deep Blue Subtle Ambient Lighting) */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-gradient-to-tr from-blue-600/25 to-blue-500/10 blur-[165px] rounded-full pointer-events-none animate-float-1"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-gradient-to-bl from-amber-500/22 to-yellow-500/10 blur-[165px] rounded-full pointer-events-none animate-float-2"></div>
      <div className="absolute top-[25%] left-[25%] w-[45%] h-[45%] bg-gradient-to-tr from-amber-600/18 to-blue-500/5 blur-[180px] rounded-full pointer-events-none animate-pulse"></div>

      {/* Mobile/Tablet Backdrop overlay when sidebar is open */}
      {!isSidebarCollapsed && (
        <div 
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setIsSidebarCollapsed(true)}
        />
      )}

      {/* SIDEBAR NAVIGATION */}
      <motion.aside
        id="finance-sidebar"
        animate={{ width: isSidebarCollapsed ? "80px" : "280px" }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={`fixed md:relative inset-y-0 left-0 z-30 shrink-0 border-r border-white/5 bg-[#090b11]/95 md:bg-slate-950/60 backdrop-blur-xl flex flex-col justify-between overflow-hidden ${isSidebarCollapsed ? "hidden md:flex" : "flex"}`}
      >
        {/* Sidebar Header */}
        <div className="p-5 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            {!isSidebarCollapsed && (
              <div 
                id="sidebar-brand" 
                onClick={() => navigate("/modules")}
                className="flex items-center gap-2.5 cursor-pointer group"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-600 to-yellow-200 shadow-[0_0_15px_rgba(251,191,36,0.2)] p-[1px]">
                  <div className="flex h-full w-full items-center justify-center rounded-lg bg-neutral-950">
                    <Coins className="h-4 w-4 text-amber-400 group-hover:rotate-12 transition-transform duration-300" />
                  </div>
                </div>
                <span className="font-serif font-black tracking-widest text-sm text-neutral-100 group-hover:text-amber-400 transition-colors">
                  MEQK
                </span>
              </div>
            )}

            {isSidebarCollapsed && (
              <div 
                onClick={() => navigate("/modules")}
                className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-600 to-yellow-200 cursor-pointer p-[1px]"
              >
                <div className="flex h-full w-full items-center justify-center rounded-lg bg-neutral-950">
                  <Coins className="h-4 w-4 text-amber-400" />
                </div>
              </div>
            )}

            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-400 hover:text-amber-400 transition-colors hidden md:block"
            >
              {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>

          {!isSidebarCollapsed && (
            <div className="px-1 py-2">
              <span className="text-[9px] font-mono uppercase tracking-[0.25em] text-amber-500/60 block mb-1">
                Active Environment
              </span>
              <div className="text-xs font-semibold text-white tracking-tight flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                Finance Operations
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Nav Items */}
        <nav className="flex-1 px-3 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const badgeCount = item.id === "memos" 
              ? (unreadMemosCount > 0 ? unreadMemosCount : undefined) 
              : item.id === "actions" 
                ? (pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined) 
                : undefined;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between rounded-xl p-3 text-xs tracking-wide transition-all duration-300 relative group cursor-pointer ${
                  isActive
                    ? "bg-gradient-to-r from-amber-950/30 to-amber-900/10 border border-amber-500/30 text-amber-300 shadow-[0_0_15px_rgba(217,119,6,0.05)]"
                    : "hover:bg-neutral-900/50 border border-transparent text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <div className="flex items-center flex-1">
                  <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? "text-amber-400" : "text-neutral-400 group-hover:text-amber-400"} ${isSidebarCollapsed ? "mx-auto" : "mr-3"}`} />
                  
                  {!isSidebarCollapsed && (
                    <span className="font-medium transition-colors">{item.label}</span>
                  )}
                </div>

                {!isSidebarCollapsed && badgeCount !== undefined && (
                  <span className="bg-blue-950/40 text-amber-400 border border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.2)] animate-pulse font-mono text-[9px] px-1.5 py-0.5 rounded-full scale-90 shrink-0">
                    {badgeCount}
                  </span>
                )}
                
                {/* Collapsed Tooltip */}
                {isSidebarCollapsed && (
                  <div className="absolute left-20 bg-neutral-950 text-amber-300 border border-amber-500/20 px-3 py-1.5 rounded-md text-[11px] font-mono tracking-wide opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-300 shadow-xl z-50 whitespace-nowrap">
                    {item.label} {badgeCount !== undefined ? `(${badgeCount})` : ""}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer Controls */}
        <div className="p-4 border-t border-white/5 space-y-3">
          <button
            onClick={() => navigate("/modules")}
            className={`w-full flex items-center justify-center rounded-xl border border-white/5 bg-neutral-950 hover:border-amber-500/30 text-xs text-neutral-400 hover:text-amber-300 p-3 transition-all duration-300 group cursor-pointer`}
          >
            <ArrowLeft className={`h-4 w-4 shrink-0 ${isSidebarCollapsed ? "mx-auto" : "mr-2 group-hover:-translate-x-0.5 transition-transform"}`} />
            {!isSidebarCollapsed && <span className="font-medium">Modules Menu</span>}
          </button>

          <button
            onClick={handleLogout}
            className={`w-full flex items-center justify-center rounded-xl border border-red-500/10 bg-red-950/5 hover:bg-red-950/20 hover:border-red-500/30 text-xs text-red-400 p-3 transition-all duration-300 cursor-pointer`}
          >
            <LogOut className={`h-4 w-4 shrink-0 ${isSidebarCollapsed ? "mx-auto" : "mr-2"}`} />
            {!isSidebarCollapsed && <span className="font-medium">Secure Out</span>}
          </button>
        </div>
      </motion.aside>

      {/* VIEWPORT CONTENT CONTAINER */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        
        {/* PREMIUM GLOBAL HEADER (With Top-Right User Info Capsule) */}
        <header className="border-b border-white/5 bg-[#090909]/45 backdrop-blur-md px-6 py-4 flex flex-row justify-between items-center gap-4 z-10 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-2 rounded-xl border border-white/10 hover:bg-neutral-800 text-neutral-400 hover:text-amber-400 md:hidden cursor-pointer shrink-0"
              title="Toggle Sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs uppercase font-mono tracking-[0.25em] bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent font-bold">
                {currentUserProfile?.company_name || "Company Name"}
              </span>
              <h2 className="text-xl md:text-2xl font-serif font-black tracking-wide bg-gradient-to-r from-white via-neutral-100 to-blue-400 bg-clip-text text-transparent uppercase leading-none">
                Finance
              </h2>
            </div>
          </div>

          {/* Luxury Executive User Status Block - Meets requirements */}
          <div className="flex items-center gap-3 bg-[#110f0e]/90 border border-amber-500/10 shadow-2xl rounded-2xl p-2.5 px-4 shrink-0 font-mono tracking-wide">
            <div className="h-8.5 w-8.5 rounded-xl bg-gradient-to-tr from-amber-600/20 to-yellow-500/5 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <User className="h-4 w-4" />
            </div>
            <div className="text-left flex flex-col gap-0.5">
              <div className="text-xs font-semibold text-amber-300 uppercase leading-tight">
                {username}
              </div>
              <div className="text-[9px] text-neutral-300 uppercase flex items-center gap-1.5 leading-none font-medium">
                <span className="h-1 w-1 rounded-full bg-amber-500"></span>
                <span>{userRole || "Role Not Assigned"}</span>
              </div>
              <div className="text-[8px] text-neutral-500 uppercase flex items-center gap-1 leading-none">
                <Calendar className="h-3 w-3 text-neutral-600 shrink-0" />
                <span>{fiscalYear || "Current Fiscal Year"}</span>
              </div>
            </div>
          </div>
        </header>

        {/* ACTIVE MODULE VIEW CONTENT */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-6 mx-auto w-full max-w-[1650px]"
            >
              
              {/* Local View Header & Abstract Subtext */}
              {activeTab !== "reports" && (
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3 pb-6 border-b border-white/5">
                  <div>
                    <h1 className="text-3xl font-light tracking-tight text-white">
                      {currentNav.label}
                    </h1>
                    <p className="text-xs text-neutral-400 mt-1.5 font-light leading-relaxed max-w-2xl">
                      {currentNav.subtitle}
                    </p>
                  </div>
                  
                  {/* Micro Metadata Indicator */}
                  <div className="flex items-center gap-2 bg-amber-950/5 border border-amber-500/10 rounded-full px-3 py-1 font-mono text-[9px] text-amber-400/80">
                    <Database className="h-3.5 w-3.5" />
                    <span>NODE ID: MEQK-FN-{activeTab.toUpperCase()}</span>
                  </div>
                </div>
              )}

              {/* RENDER DYNAMIC SECTION VIEWS (Clean wireframes & Supabase integration empty states) */}
              {activeTab === "dashboard" && <DashboardView currentUserProfile={currentUserProfile} />}
              {activeTab === "invoices" && <InvoicesView lookups={lookups} currentUserProfile={currentUserProfile} />}
              {activeTab === "transactions" && <TransactionsView lookups={lookups} currentUserProfile={currentUserProfile} />}
              {activeTab === "actions" && <ActionsView lookups={lookups} currentUserProfile={currentUserProfile} onApprovalsUpdated={fetchPendingApprovalsCount} />}
              {activeTab === "memos" && <MemosView currentUserProfile={currentUserProfile} onMemosUpdated={fetchUnreadMemosCount} />}
              {activeTab === "reports" && <ReportsView currentUserProfile={currentUserProfile} />}

            </motion.div>
          </AnimatePresence>
        </main>

        {/* FOOTER */}
        <footer className="border-t border-white/5 bg-[#090909]/20 px-6 py-4 flex justify-between items-center z-10 shrink-0 text-[10px] font-mono text-neutral-600">
          <span>MEQK SYSTEM VOL 1.0 (SECURE NODE)</span>
          <div className="flex items-center gap-1">
            <span>THANKS</span>
            <span className="text-amber-500/70 font-bold">GOD</span>
          </div>
        </footer>
      </div>

    </div>
  );
}

/* ========================================================================== */
/* VIEW COMPONENT 1: FINANCIAL DASHBOARD (Live dynamic Supabase visualization)*/
/* ========================================================================== */
interface MonthlyDashboardRow {
  month: string;
  total_pending: number | null;
  total_income: number | null;
  total_expenses: number | null;
}

interface StaffShortageRow {
  staff_name: string | null;
  shortage: number | null;
}

interface BusPerformanceRow {
  month: string | null;
  bus: string | null;
  income: number | null;
}

function DashboardView({ currentUserProfile }: { currentUserProfile?: any }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [monthlyData, setMonthlyData] = useState<MonthlyDashboardRow[]>([]);
  const [currentMonthData, setCurrentMonthData] = useState<MonthlyDashboardRow | null>(null);
  const [shortageData, setShortageData] = useState<StaffShortageRow[]>([]);
  const [busData, setBusData] = useState<BusPerformanceRow[]>([]);

  // Dynamically calculate the local YYYY-MM formatted string
  const getYearMonthString = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  };

  const currentMonthStr = getYearMonthString();

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      const activeCompanyId = currentUserProfile?.company_id;
      if (!activeCompanyId) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // 1. Fetch monthly financial dashboard for trend chart (ordered by month) directly with company_id
        const monthlyRes = await supabase
          .from("v_monthly_financial_dashboard")
          .select("month,total_income,total_expenses,company_id")
          .eq("company_id", activeCompanyId)
          .order("month", { ascending: true });

        if (monthlyRes.error) throw monthlyRes.error;

        // 1b. Fetch specific record for current month safely using .maybeSingle() and exact columns list with company_id
        const currentMonthRes = await supabase
          .from("v_monthly_financial_dashboard")
          .select("month,total_income,total_expenses,total_pending,company_id")
          .eq("month", currentMonthStr)
          .eq("company_id", activeCompanyId)
          .maybeSingle();

        if (currentMonthRes.error) throw currentMonthRes.error;

        let dashboardRecord = currentMonthRes.data;

        if (!dashboardRecord) {
          // Fallback: Fetch latest available month
          const fallbackRes = await supabase
            .from("v_monthly_financial_dashboard")
            .select("month,total_income,total_expenses,total_pending,company_id")
            .eq("company_id", activeCompanyId)
            .order("month", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (fallbackRes.error) throw fallbackRes.error;
          if (fallbackRes.data) {
            dashboardRecord = fallbackRes.data;
          }
        }

        // 2. Fetch staff shortages directly
        const shortageRes = await supabase
          .from("v_staff_shortage")
          .select("staff_name,occupation,office,shortage")
          .order("shortage", { ascending: false })
          .limit(3);

        if (shortageRes.error) throw shortageRes.error;

        // 3. Fetch bus performance sorted descending and filtered by monthToUse directly
        const monthToUse = dashboardRecord?.month || currentMonthStr;
        const busRes = await supabase
          .from("v_bus_performance")
          .select("month,bus,income")
          .eq("month", monthToUse)
          .order("income", { ascending: false })
          .limit(3);

        if (busRes.error) throw busRes.error;

        if (isMounted) {
          setMonthlyData(monthlyRes.data || []);
          setCurrentMonthData(dashboardRecord || null);
          setShortageData(shortageRes.data || []);
          setBusData(busRes.data || []);
        }
      } catch (err: any) {
        console.error("Error fetching financial dashboard:", err);
        if (isMounted) {
          setError(err.message || String(err));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [currentMonthStr, currentUserProfile]);

  // Helper to format currency in TZS
  const formatCurrency = (val: number | null | undefined) => {
    if (val === undefined || val === null || isNaN(val)) return "TZS 0";
    return "TZS " + Math.round(val).toLocaleString("en-US");
  };

  // Extract variables for current month card calculations
  const totalPending = currentMonthData?.total_pending ?? 0;
  const totalIncome = currentMonthData?.total_income ?? 0;
  const totalExpenses = currentMonthData?.total_expenses ?? 0;
  const netProfit = totalIncome - totalExpenses;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#0c0c0c] border border-white/10 p-4 rounded-xl shadow-2xl font-sans text-xs">
          <p className="font-mono text-amber-400 font-semibold mb-2 uppercase tracking-wider">{label}</p>
          <div className="space-y-1.5">
            <p className="text-amber-100 flex items-center justify-between gap-6">
              <span className="flex items-center gap-1.5 font-light">
                <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                Income:
              </span>
              <span className="font-mono font-medium">{formatCurrency(payload[0].value)}</span>
            </p>
            <p className="text-amber-100 flex items-center justify-between gap-6">
              <span className="flex items-center gap-1.5 font-light">
                <span className="h-2 w-2 rounded-full bg-red-500"></span>
                Expenses:
              </span>
              <span className="font-mono font-medium">{formatCurrency(payload[1].value)}</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  if (!currentUserProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] py-12">
        <div className="relative flex flex-col items-center">
          <div className="absolute w-24 h-24 bg-amber-500/10 blur-[30px] rounded-full"></div>
          <Coins className="h-8 w-8 text-amber-500 animate-spin mb-4" />
          <span className="font-mono text-xs tracking-widest text-amber-500/80 animate-pulse">
            LOADING COMPANY CONTEXT...
          </span>
        </div>
      </div>
    );
  }

  const activeCompanyId = currentUserProfile.company_id;

  if (!activeCompanyId) {
    return (
      <div className="rounded-2xl bg-[#24283b]/60 border border-amber-500/10 p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
        <BadgeAlert className="h-10 w-10 text-amber-500 mb-3 animate-pulse" />
        <h3 className="text-base font-semibold text-white mb-2">Company Context</h3>
        <p className="text-xs text-neutral-400 max-w-md leading-relaxed">
          Company context not found.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] py-12">
        <div className="relative flex flex-col items-center">
          <div className="absolute w-24 h-24 bg-amber-500/10 blur-[30px] rounded-full"></div>
          <Coins className="h-8 w-8 text-amber-500 animate-spin mb-4" />
          <span className="font-mono text-xs tracking-widest text-amber-500/80 animate-pulse">
            QUERYING LEDGES & LEDGER VIEWS...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-neutral-900/60 border border-red-500/20 p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
        <BadgeAlert className="h-10 w-10 text-red-500 mb-3 animate-pulse" />
        <h3 className="text-base font-semibold text-white mb-2">Supabase Query Error</h3>
        <p className="text-xs text-neutral-400 max-w-md leading-relaxed mb-6">
          Failed to fetch records from ledger views. Check connection parameters and secure schema pipelines.
        </p>
        <div className="font-mono text-[11px] bg-black/60 text-red-300 border border-red-500/10 p-3.5 rounded-lg max-w-lg overflow-x-auto">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      
      {/* 4-Card Responsive Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Card 1: Total Pendings */}
        <div className="relative rounded-2xl bg-[#24283b]/60 backdrop-blur-xl border border-white/10 p-6 shadow-2xl flex flex-col justify-between overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/25 to-transparent"></div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-500/80">Pending Allocation</span>
              <ReceiptText className="h-4.5 w-4.5 text-amber-500" />
            </div>
            <div>
              <h3 className="text-xs text-neutral-400 font-light uppercase tracking-wider">Total Pendings</h3>
              <p className="text-2xl font-serif font-semibold text-amber-300 mt-1">{formatCurrency(totalPending)}</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-neutral-500">
            <span>REF: {currentMonthData?.month || currentMonthStr}</span>
            <span className="text-amber-500/60 uppercase">Meqk Core</span>
          </div>
        </div>

        {/* Card 2: Income Statement (Small table layout) */}
        <div className="relative rounded-2xl bg-[#24283b]/60 backdrop-blur-xl border border-white/10 p-5 shadow-2xl flex flex-col justify-between overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/25 to-transparent"></div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-500/80">Statement Period</span>
              <TrendingUp className="h-4.5 w-4.5 text-amber-400 animate-pulse" />
            </div>
            
            <div>
              <h3 className="text-xs text-neutral-400 font-light uppercase tracking-wider mb-0.5">Income Statement</h3>
              {currentMonthData && currentMonthData.month !== currentMonthStr && (
                <div className="text-[9px] text-amber-400/80 font-mono italic select-none">
                  Showing latest available month: {currentMonthData.month}
                </div>
              )}
            </div>
            
            {!currentMonthData ? (
              <div className="py-6 text-center text-xs text-neutral-500 font-light italic border border-white/5 rounded-lg bg-neutral-950/40">
                No financial dashboard data found for this company.
              </div>
            ) : (
              <div className="w-full overflow-hidden rounded-lg border border-white/5 bg-neutral-950/40">
                <table className="w-full text-left text-[11px] font-mono border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-neutral-900/40 text-[9px] text-neutral-500 uppercase tracking-wider">
                      <th className="py-1.5 px-2.5 font-semibold">Details</th>
                      <th className="py-1.5 px-2.5 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    <tr className="hover:bg-white/2 transition-colors">
                      <td className="py-1.5 px-2.5 text-neutral-300 font-light">Income</td>
                      <td className="py-1.5 px-2.5 text-right text-blue-400 font-medium">{formatCurrency(totalIncome)}</td>
                    </tr>
                    <tr className="hover:bg-white/2 transition-colors">
                      <td className="py-1.5 px-2.5 text-neutral-300 font-light">Expenses</td>
                      <td className="py-1.5 px-2.5 text-right text-red-400 font-medium">{formatCurrency(totalExpenses)}</td>
                    </tr>
                    <tr className="bg-amber-500/5 hover:bg-amber-500/10 transition-colors">
                      <td className="py-2 px-2.5 text-amber-300 font-semibold uppercase tracking-wider">Net Profit</td>
                      <td className={`py-2 px-2.5 text-right font-bold ${netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {formatCurrency(netProfit)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Top Shortages */}
        <div className="relative rounded-2xl bg-[#24283b]/60 backdrop-blur-xl border border-white/10 p-6 shadow-2xl flex flex-col justify-between overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/25 to-transparent"></div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-500/80">Top Shortages</span>
              <BadgeAlert className="h-4.5 w-4.5 text-amber-500" />
            </div>
            
            {shortageData.length === 0 ? (
              <div className="py-4 text-center text-xs text-neutral-500 font-light italic">
                No shortages reported.
              </div>
            ) : (
              <ul className="space-y-2 text-xs">
                {shortageData.map((s, idx) => (
                  <li key={idx} className="flex justify-between items-center py-1 border-b border-white/5 last:border-0">
                    <span className="text-neutral-300 font-light truncate max-w-[110px]">{s.staff_name || "N/A"}</span>
                    <span className="font-mono text-red-400 leading-none">{formatCurrency(s.shortage)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-white/5 flex justify-between text-[9px] font-mono text-neutral-500">
            <span>TOP AUDIT MARGINS</span>
            <span className="text-neutral-400 font-medium">STAFF</span>
          </div>
        </div>

        {/* Card 4: Bus Performance Table */}
        <div className="relative rounded-2xl bg-[#24283b]/60 backdrop-blur-xl border border-white/10 p-5 shadow-2xl flex flex-col justify-between overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/25 to-transparent"></div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-500/80">Route Operations</span>
              <Bus className="h-4.5 w-4.5 text-amber-500" />
            </div>
            
            <h3 className="text-xs text-neutral-400 font-light uppercase tracking-wider mb-1">Bus Performance</h3>
            
            <div className="w-full overflow-hidden rounded-lg border border-white/5 bg-neutral-950/40">
              <table className="w-full text-left text-[11px] font-mono border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-neutral-900/40 text-[9px] text-neutral-500 uppercase tracking-wider">
                    <th className="py-1.5 px-2.5 font-semibold">Bus</th>
                    <th className="py-1.5 px-2.5 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {busData.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="py-4 text-center text-xs text-neutral-500 font-light italic">
                        No records for {currentMonthStr}
                      </td>
                    </tr>
                  ) : (
                    busData.map((b, idx) => (
                      <tr key={idx} className="hover:bg-white/2 transition-colors">
                        <td className="py-1.5 px-2.5 text-neutral-300 font-light truncate max-w-[100px]">
                          Bus {b.bus || "N/A"}
                        </td>
                        <td className="py-1.5 px-2.5 text-right text-blue-400 font-medium">
                          {formatCurrency(b.income)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

      {/* Large responsive Recharts bar chart */}
      <div className="relative rounded-2xl bg-[#24283b]/60 backdrop-blur-xl border border-white/10 p-6 md:p-8 shadow-2xl overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/25 to-transparent"></div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-white/5">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-amber-500/80">Trend Visualizer</span>
            <h3 className="text-base font-light text-white mt-1">Income vs Expenses Trend</h3>
          </div>
          <div className="text-[10px] font-mono text-neutral-500 bg-neutral-950/60 px-3 py-1.5 border border-white/5 rounded-lg">
            SOURCE: V_MONTHLY_FINANCIAL_DASHBOARD
          </div>
        </div>

        {monthlyData.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center text-neutral-500 font-light font-mono text-xs p-6 border border-dashed border-white/5 rounded-xl">
            <Database className="h-8 w-8 text-neutral-600 mb-2 animate-pulse" />
            NO MONTHLY TREND RECORDS TO GRAPH
          </div>
        ) : (
          <div className="h-80 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthlyData}
                margin={{ top: 20, right: 10, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis 
                  dataKey="month" 
                  stroke="rgba(255,255,255,0.4)" 
                  fontSize={10} 
                  fontFamily="monospace"
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                />
                <YAxis 
                  stroke="rgba(255,255,255,0.4)" 
                  fontSize={10} 
                  fontFamily="monospace"
                  tickFormatter={(val) => `TZS ${val >= 1000000 ? (val / 1000000).toFixed(1) + 'M' : val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                <Legend 
                  verticalAlign="top" 
                  height={36} 
                  iconType="circle"
                  wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace', color: '#d4d4d8' }} 
                />
                <Bar dataKey="total_income" name="Total Income" fill="#60a5fa" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar dataKey="total_expenses" name="Total Expenses" fill="#f87171" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

    </div>
  );
}


/* ========================================================================== */
/* VIEW COMPONENT 2: TRANSACTIONS (Multi-Row Searchable Journal Entry)        */
/* ========================================================================== */
interface DropdownOption {
  id: string | number;
  name: string;
}

interface SearchableSelectProps {
  options: DropdownOption[];
  value: string | number;
  onChange: (val: string | number) => void;
  placeholder: string;
  label: string;
  error?: string;
}

function SearchableSelect({ options, value, onChange, placeholder, label, error }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => 
    String(opt.name || "").toLowerCase().includes(search.toLowerCase())
  );

  const selectedOption = options.find(opt => String(opt.id) === String(value));

  return (
    <div className={`relative flex-1 min-w-[105px] ${isOpen ? "z-50" : "z-10"}`} ref={containerRef}>
      <label className="block text-[10px] uppercase tracking-wider text-neutral-500 font-mono mb-1 xl:hidden">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full text-left bg-[#0c0c0c]/95 border ${
          error ? "border-red-500/40 focus:border-red-500" : "border-white/10 hover:border-amber-500/30 focus:border-amber-500/60"
        } rounded-xl p-2 text-xs text-neutral-200 flex items-center justify-between gap-1 focus:outline-none transition-colors h-[38px]`}
      >
        <span className="truncate">{selectedOption ? selectedOption.name : placeholder}</span>
        <span className="text-neutral-500 text-[8px] pointer-events-none shrink-0 ml-1">▼</span>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-60 right-0 xl:left-0 bg-[#0e0e0e] border border-white/15 rounded-xl shadow-2xl p-2 space-y-2">
          <input
            type="text"
            className="w-full bg-[#161616] border border-white/10 rounded-lg px-2 py-1 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/50 font-mono"
            placeholder={`Search ${label}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className="max-h-48 overflow-y-auto space-y-0.5 custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <div className="text-neutral-500 text-[10px] p-2 text-center italic">No results found</div>
            ) : (
              filteredOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onChange(opt.id);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className={`w-full text-left rounded-lg px-2 py-1 text-xs transition-colors block truncate ${
                    String(opt.id) === String(value)
                      ? "bg-amber-500/10 text-amber-400 font-medium" 
                      : "text-neutral-300 hover:bg-white/5"
                  }`}
                >
                  {opt.name}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TransactionsView({ lookups, currentUserProfile }: { lookups?: any; currentUserProfile?: any }) {
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  // Lists from backend tables
  const [cashTypes, setCashTypes] = useState<DropdownOption[]>([]);
  const [staffs, setStaffs] = useState<DropdownOption[]>([]);
  const [buses, setBuses] = useState<DropdownOption[]>([]);
  const [routes, setRoutes] = useState<DropdownOption[]>([]);
  const [accounts, setAccounts] = useState<DropdownOption[]>([]);
  const [categories, setCategories] = useState<DropdownOption[]>([]);

  // Alerts
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Fetch dropdown collections on load
  useEffect(() => {
    let isMounted = true;
    async function fetchOptions() {
      try {
        setOptionsLoading(true);
        setOptionsError(null);

        if (lookups?.loaded) {
          if (isMounted) {
            setCashTypes(lookups.cashTypes);
            setStaffs(lookups.staffs);
            setBuses(lookups.buses);
            setRoutes(lookups.routes);
            setAccounts(lookups.accounts);
            setCategories(lookups.categories);
            setOptionsLoading(false);
          }
          return;
        }

        const companyId = currentUserProfile?.company_id;
        let qCashTypes = supabase.from("cash_types").select("id, type_name").eq("is_active", true);
        let qStaffs = supabase.from("staffs").select("id, full_name").eq("is_active", true);
        let qBuses = supabase.from("buses").select("id, plate_number").eq("is_active", true);
        let qRoutes = supabase.from("routes").select("id, route_name").eq("is_active", true);
        let qAccounts = supabase.from("accounts").select("id, account_name").eq("is_active", true);
        let qCategories = supabase.from("categories").select("id, category_name").eq("is_active", true);

        if (companyId) {
          qStaffs = qStaffs.eq("company_id", companyId);
          qBuses = qBuses.eq("company_id", companyId);
          qRoutes = qRoutes.eq("company_id", companyId);
          qAccounts = qAccounts.eq("company_id", companyId);
          qCategories = qCategories.eq("company_id", companyId);
        }

        const [
          resCashTypes,
          resStaffs,
          resBuses,
          resRoutes,
          resAccounts,
          resCategories
        ] = await Promise.all([
          qCashTypes,
          qStaffs,
          qBuses,
          qRoutes,
          qAccounts,
          qCategories
        ]);

        const errors = [
          resCashTypes.error,
          resStaffs.error,
          resBuses.error,
          resRoutes.error,
          resAccounts.error,
          resCategories.error
        ].filter(Boolean);

        if (errors.length > 0) {
          console.warn("Some options failed to load from Supabase:", errors);
        }

        if (isMounted) {
          setCashTypes(resCashTypes.data?.map(o => ({ id: o.id, name: o.type_name })) || []);
          setStaffs(resStaffs.data?.map(o => ({ id: o.id, name: o.full_name })) || []);
          setBuses(resBuses.data?.map(o => ({ id: o.id, name: o.plate_number })) || []);
          setRoutes(resRoutes.data?.map(o => ({ id: o.id, name: o.route_name })) || []);
          setAccounts(resAccounts.data?.map(o => ({ id: o.id, name: o.account_name })) || []);
          setCategories(resCategories.data?.map(o => ({ id: o.id, name: o.category_name })) || []);
        }
      } catch (err: any) {
        console.error("Failed loading select options:", err);
        if (isMounted) {
          setOptionsError(err.message || String(err));
        }
      } finally {
        if (isMounted) {
          setOptionsLoading(false);
        }
      }
    }
    fetchOptions();
    return () => { isMounted = false; };
  }, [lookups, currentUserProfile]);

  const defaultLineValues = {
    transaction_date: new Date().toISOString().split("T")[0],
    cash_type_id: "",
    staff_id: "",
    bus_id: "",
    route_id: "",
    account_id: "",
    category_id: "",
    reference_number: "",
    amount: "" as any,
  };

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors }
  } = useForm<any>({
    resolver: zodResolver(transactionsFormSchema) as any,
    defaultValues: {
      lines: [defaultLineValues]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "lines"
  });

  const watchedLines = watch("lines") || [];

  const liveTotal = watchedLines.reduce((acc, current) => {
    const amt = Number(current?.amount);
    return acc + (isNaN(amt) ? 0 : amt);
  }, 0);

  const formatCurrency = (val: number) => {
    return "TZS " + Math.round(val).toLocaleString("en-US");
  };

  const onSubmit = async (data: any) => {
    try {
      setIsSaving(true);
      setSaveError(null);
      setSaveSuccess(false);

      const records = data.lines.map((line: any, idx: number) => {
        const cash_type_id = line.cash_type_id ? String(line.cash_type_id) : null;
        const staff_id = line.staff_id ? String(line.staff_id) : null;
        const bus_id = line.bus_id ? String(line.bus_id) : null;
        const route_id = line.route_id ? String(line.route_id) : null;
        const account_id = line.account_id ? String(line.account_id) : null;
        const category_id = line.category_id ? String(line.category_id) : null;

        const amt = Number(line.amount);
        if (isNaN(amt) || amt <= 0) {
          throw new Error(`Row ${idx + 1}: Amount is required and must be greater than 0.`);
        }

        const rec: any = {
          transaction_date: line.transaction_date || null,
          cash_type_id,
          staff_id,
          bus_id,
          route_id,
          account_id,
          category_id,
          reference_number: line.reference_number?.trim() || null,
          amount: amt
        };
        if (currentUserProfile?.company_id) {
          rec.company_id = currentUserProfile.company_id;
        }
        return rec;
      });

      console.log("Supabase cash table insert payload:", records);

      const { error: insertErr } = await supabase
        .from("cash")
        .insert(records);

      if (insertErr) throw insertErr;

      setSaveSuccess(true);
      reset({
        lines: [defaultLineValues]
      });
    } catch (err: any) {
      console.error("Database submission error:", err);
      // Ensure Supabase error message or other error message is displayed clearly
      setSaveError(err.message || String(err));
    } finally {
      setIsSaving(false);
    }
  };

  if (optionsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] py-12">
        <Coins className="h-7 w-7 text-amber-500 animate-spin mb-3" />
        <span className="font-mono text-xs tracking-wider text-neutral-400">
          LOADING SYSTEM CODES FROM SUPABASE...
        </span>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] w-full mx-auto space-y-6">
      {saveSuccess && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-emerald-300 flex items-center gap-3 shadow-lg"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          <div className="text-xs">
            <span className="font-semibold block mb-0.5">Transactions Audited and Saved</span>
            <span>All entries have been vetted and posted securely to the primary ledger.</span>
          </div>
        </motion.div>
      )}

      {saveError && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-4 text-rose-300 flex items-center gap-3 shadow-lg"
        >
          <BadgeAlert className="h-5 w-5 shrink-0 text-rose-400" />
          <div className="text-xs">
            <span className="font-semibold block mb-0.5">Posting Refused</span>
            <span className="font-mono text-[11px] block text-rose-400/90 whitespace-pre-wrap">{saveError}</span>
          </div>
        </motion.div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div 
          id="transactions-form-wrapper"
          className="rounded-2xl bg-[#24283b]/60 backdrop-blur-xl border border-white/10 shadow-2xl p-6 relative"
          style={{ width: "1604px", maxWidth: "100%" }}
        >
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent"></div>
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-5 border-b border-white/5 mb-6">
            <div>
              <span className="text-[10px] font-mono tracking-widest text-amber-500/80 uppercase">Double Entry ledger</span>
              <h2 className="text-base font-light text-white mt-0.5">Line-Based Cash Entry Form</h2>
            </div>
            <button
              type="button"
              onClick={() => append(defaultLineValues)}
              className="flex items-center gap-2 text-xs font-semibold px-4 py-2 bg-amber-500/10 border border-amber-500/25 hover:bg-amber-500/20 text-amber-300 rounded-xl transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Add Entry line
            </button>
          </div>

          {/* Desktop Matrix scroll container */}
          <div className="hidden xl:block overflow-x-auto pb-48 custom-scrollbar relative z-20">
            <div className="min-w-[1280px] space-y-3">
              {/* Desktop Matrix Headers: displayed on xl screens */}
              <div className="grid grid-cols-[115px_1fr_1.1fr_0.9fr_1fr_1.1fr_1.1fr_150px_110px_42px] gap-2 bg-neutral-900/40 text-[10px] font-mono uppercase tracking-wider text-neutral-400 p-3 rounded-xl border border-white/5">
                <div>Date</div>
                <div>T.Type</div>
                <div>Staff</div>
                <div>Bus</div>
                <div>Route</div>
                <div>Account</div>
                <div>Category</div>
                <div>Reference</div>
                <div className="text-right">Amount</div>
                <div className="text-center">Actions</div>
              </div>

              {/* Desktop Grid Rows list */}
              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div 
                    key={field.id} 
                    className="grid grid-cols-[115px_1fr_1.1fr_0.9fr_1fr_1.1fr_1.1fr_150px_110px_42px] gap-2 items-center p-2.5 rounded-xl border border-white/5 bg-neutral-950/20 hover:bg-neutral-900/40 transition-all relative"
                  >
                    {/* 1. Date */}
                    <div>
                      <Controller
                        control={control}
                        name={`lines.${index}.transaction_date`}
                        render={({ field }) => (
                          <input
                            type="date"
                            {...field}
                            className={`w-[115px] bg-[#0c0c0c]/90 border ${
                              errors.lines?.[index]?.transaction_date ? "border-red-500/40 focus:border-red-500" : "border-white/10 hover:border-amber-500/20 focus:border-amber-500/50"
                            } rounded-xl p-2 text-xs text-white focus:outline-none transition-colors h-[38px]`}
                          />
                        )}
                      />
                    </div>

                    {/* 2. T.Type */}
                    <Controller
                      control={control}
                      name={`lines.${index}.cash_type_id`}
                      render={({ field }) => (
                        <SearchableSelect
                          options={cashTypes}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Select Type"
                          label="T.Type"
                          error={errors.lines?.[index]?.cash_type_id?.message}
                        />
                      )}
                    />

                    {/* 3. Staff */}
                    <Controller
                      control={control}
                      name={`lines.${index}.staff_id`}
                      render={({ field }) => (
                        <SearchableSelect
                          options={staffs}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Select Staff"
                          label="Staff"
                          error={errors.lines?.[index]?.staff_id?.message}
                        />
                      )}
                    />

                    {/* 4. Bus */}
                    <Controller
                      control={control}
                      name={`lines.${index}.bus_id`}
                      render={({ field }) => (
                        <SearchableSelect
                          options={buses}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Select Bus"
                          label="Bus"
                          error={errors.lines?.[index]?.bus_id?.message}
                        />
                      )}
                    />

                    {/* 5. Route */}
                    <Controller
                      control={control}
                      name={`lines.${index}.route_id`}
                      render={({ field }) => (
                        <SearchableSelect
                          options={routes}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Select Route"
                          label="Route"
                          error={errors.lines?.[index]?.route_id?.message}
                        />
                      )}
                    />

                    {/* 6. Account */}
                    <Controller
                      control={control}
                      name={`lines.${index}.account_id`}
                      render={({ field }) => (
                        <SearchableSelect
                          options={accounts}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Select Account"
                          label="Account"
                          error={errors.lines?.[index]?.account_id?.message}
                        />
                      )}
                    />

                    {/* 7. Category */}
                    <Controller
                      control={control}
                      name={`lines.${index}.category_id`}
                      render={({ field }) => (
                        <SearchableSelect
                          options={categories}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Select Category"
                          label="Category"
                          error={errors.lines?.[index]?.category_id?.message}
                        />
                      )}
                    />

                    {/* 8. Reference */}
                    <div>
                      <Controller
                        control={control}
                        name={`lines.${index}.reference_number`}
                        render={({ field }) => (
                          <input
                            type="text"
                            {...field}
                            placeholder="Ref code"
                            className="w-[150px] bg-[#0c0c0c]/90 border border-white/10 hover:border-amber-500/20 focus:border-amber-500/50 rounded-xl p-2 text-xs text-white focus:outline-none transition-colors h-[38px] font-mono placeholder:text-neutral-600"
                          />
                        )}
                      />
                    </div>

                    {/* 9. Amount */}
                    <div>
                      <Controller
                        control={control}
                        name={`lines.${index}.amount`}
                        render={({ field }) => (
                          <input
                            type="number"
                            {...field}
                            placeholder="Amount"
                            className={`text-right w-[110px] bg-[#0c0c0c]/90 border ${
                              errors.lines?.[index]?.amount ? "border-red-500/40 focus:border-red-500" : "border-white/10 hover:border-amber-500/20 focus:border-amber-500/50"
                            } rounded-xl p-2 text-xs text-white focus:outline-none transition-colors h-[38px] font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                          />
                        )}
                      />
                    </div>

                    {/* Delete row trigger */}
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => {
                          if (fields.length > 1) remove(index);
                        }}
                        disabled={fields.length === 1}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          fields.length === 1 
                            ? "border-white/5 text-neutral-800 cursor-not-allowed" 
                            : "border-red-500/10 hover:bg-red-500/10 text-red-400 hover:border-red-500/30"
                        }`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Smartphone / Tablet Stacked Cards Screen: shown on < xl screens */}
          <div className="block xl:hidden space-y-4 mb-6">
            {fields.map((field, index) => (
              <motion.div
                key={field.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-neutral-950/40 p-5 border border-white/5 space-y-4 relative"
              >
                <div className="flex justify-between items-center pb-3 border-b border-white/5">
                  <span className="text-xs font-mono font-medium text-amber-500/80">
                    Line Draft #{index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (fields.length > 1) remove(index);
                    }}
                    disabled={fields.length === 1}
                    className={`flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1.5 rounded-lg border transition-colors ${
                      fields.length === 1 
                        ? "border-white/5 text-neutral-700 cursor-not-allowed" 
                        : "border-red-500/10 hover:bg-neutral-900 text-red-400"
                    }`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Row
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Date Input */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-neutral-500 font-mono mb-1">
                      Date
                    </label>
                    <Controller
                      control={control}
                      name={`lines.${index}.transaction_date`}
                      render={({ field }) => (
                        <input
                          type="date"
                          {...field}
                          className={`w-full bg-[#0c0c0c]/90 border ${
                            errors.lines?.[index]?.transaction_date ? "border-red-500/40 focus:border-red-500" : "border-white/10 focus:border-amber-500/50"
                          } rounded-xl p-2.5 text-xs text-white focus:outline-none h-[38px]`}
                        />
                      )}
                    />
                  </div>

                  {/* Type Input */}
                  <Controller
                    control={control}
                    name={`lines.${index}.cash_type_id`}
                    render={({ field }) => (
                      <SearchableSelect
                        options={cashTypes}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select Type"
                        label="T.Type"
                        error={errors.lines?.[index]?.cash_type_id?.message}
                      />
                    )}
                  />

                  {/* Staff Select */}
                  <Controller
                    control={control}
                    name={`lines.${index}.staff_id`}
                    render={({ field }) => (
                      <SearchableSelect
                        options={staffs}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select Staff"
                        label="Staff"
                        error={errors.lines?.[index]?.staff_id?.message}
                      />
                    )}
                  />

                  {/* Bus Select */}
                  <Controller
                    control={control}
                    name={`lines.${index}.bus_id`}
                    render={({ field }) => (
                      <SearchableSelect
                        options={buses}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select Bus"
                        label="Bus"
                        error={errors.lines?.[index]?.bus_id?.message}
                      />
                    )}
                  />

                  {/* Route Select */}
                  <Controller
                    control={control}
                    name={`lines.${index}.route_id`}
                    render={({ field }) => (
                      <SearchableSelect
                        options={routes}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select Route"
                        label="Route"
                        error={errors.lines?.[index]?.route_id?.message}
                      />
                    )}
                  />

                  {/* Account Select */}
                  <Controller
                    control={control}
                    name={`lines.${index}.account_id`}
                    render={({ field }) => (
                      <SearchableSelect
                        options={accounts}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select Account"
                        label="Account"
                        error={errors.lines?.[index]?.account_id?.message}
                      />
                    )}
                  />

                  {/* Category Select */}
                  <Controller
                    control={control}
                    name={`lines.${index}.category_id`}
                    render={({ field }) => (
                      <SearchableSelect
                        options={categories}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select Category"
                        label="Category"
                        error={errors.lines?.[index]?.category_id?.message}
                      />
                    )}
                  />

                  {/* Reference text */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-neutral-500 font-mono mb-1">
                      Reference
                    </label>
                    <Controller
                      control={control}
                      name={`lines.${index}.reference_number`}
                      render={({ field }) => (
                        <input
                          type="text"
                          {...field}
                          placeholder="Ref code"
                          className="w-full bg-[#0c0c0c]/90 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50 h-[38px] font-mono"
                        />
                      )}
                    />
                  </div>

                  {/* Amount Numeric */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-neutral-500 font-mono mb-1">
                      Amount
                    </label>
                    <Controller
                      control={control}
                      name={`lines.${index}.amount`}
                      render={({ field }) => (
                        <input
                          type="number"
                          {...field}
                          placeholder="Amount in TZS"
                          className={`w-full bg-[#0c0c0c]/90 border ${
                            errors.lines?.[index]?.amount ? "border-red-500/40 focus:border-red-500" : "border-white/10 focus:border-amber-500/50"
                          } rounded-xl p-2.5 text-xs text-white focus:outline-none h-[38px] font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                        />
                      )}
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Form Actions footer segment & Live Totals card */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 pt-5 border-t border-white/5">
            {/* Live Total box shown as TZS */}
            <div className="w-full md:w-auto flex items-center gap-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 pr-6">
              <div className="h-10 w-10 text-amber-400 bg-amber-500/10 rounded-xl flex items-center justify-center font-mono text-[11px] font-semibold border border-amber-500/15 font-bold">
                ∑
              </div>
              <div className="text-left font-mono">
                <span className="text-[10px] uppercase text-neutral-500 tracking-wider block font-light">Journal Entry Sum</span>
                <span className="text-base font-bold text-amber-300">{formatCurrency(liveTotal)}</span>
              </div>
            </div>

            {/* Submission triggers */}
            <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => {
                  reset({
                    lines: [defaultLineValues]
                  });
                  setSaveError(null);
                  setSaveSuccess(false);
                }}
                className="px-5 py-3 rounded-xl border border-white/5 bg-neutral-950/60 hover:bg-neutral-900 text-xs text-neutral-400 font-medium transition-colors cursor-pointer"
              >
                Clear Form
              </button>
              
              <button
                type="submit"
                disabled={isSaving}
                className={`flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-neutral-950 font-semibold rounded-xl text-xs transition-colors cursor-pointer ${
                  isSaving ? "opacity-60 cursor-not-allowed" : "shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:shadow-[0_0_25px_rgba(245,158,11,0.25)]"
                }`}
              >
                {isSaving ? (
                  <>
                    <Coins className="h-4 w-4 animate-spin text-neutral-950" />
                    Committing Entries...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 text-neutral-950" />
                    Save Transactions
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ========================================================================== */
/* VIEW COMPONENT 2.5: INVOICES (Manual and Excel Entry Registry)             */
/* ========================================================================== */
function InvoicesView({ lookups, currentUserProfile }: { lookups?: any; currentUserProfile?: any }) {
  const [activeSubTab, setActiveSubTab] = useState<"manual" | "excel">("manual");
  
  // Dropdown options loaders
  const [invoiceTypes, setInvoiceTypes] = useState<DropdownOption[]>([]);
  const [staffs, setStaffs] = useState<DropdownOption[]>([]);
  const [buses, setBuses] = useState<DropdownOption[]>([]);
  const [routes, setRoutes] = useState<DropdownOption[]>([]);
  
  const [isClassificationsLoading, setIsClassificationsLoading] = useState(true);
  const [classificationsError, setClassificationsError] = useState<string | null>(null);

  // Manual Form hook
  const defaultLineValues = {
    invoice_date: new Date().toISOString().split("T")[0],
    invoice_type_id: "",
    staff_id: "",
    bus_id: "",
    route_id: "",
    gross_amount: 0,
  };

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<any>({
    resolver: zodResolver(invoicesFormSchema),
    defaultValues: {
      lines: [defaultLineValues],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "lines",
  });

  // Calculate live total sum for manual entries
  const liveLines = watch("lines") || [];
  const liveTotal = liveLines.reduce((sum, item) => sum + (Number(item.gross_amount) || 0), 0);

  // Saving states
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Excel Bulk upload states
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelMatchingLoading, setExcelMatchingLoading] = useState(false);
  const [allParsedRows, setAllParsedRows] = useState<any[]>([]);
  const [validatedRows, setValidatedRows] = useState<any[]>([]);
  const [invalidRows, setInvalidRows] = useState<any[]>([]);
  const [excelError, setExcelError] = useState<string | null>(null);
  const [excelSuccess, setExcelSuccess] = useState(false);

  // Fetch options on mount
  useEffect(() => {
    async function loadClassifications() {
      try {
        setIsClassificationsLoading(true);
        setClassificationsError(null);

        if (lookups?.loaded) {
          setInvoiceTypes(lookups.invoiceTypes);
          setStaffs(lookups.staffs);
          setBuses(lookups.buses);
          setRoutes(lookups.routes);
          setIsClassificationsLoading(false);
          return;
        }

        const companyId = currentUserProfile?.company_id;
        let qTypes = supabase.from("invoice_types").select("id, type_name").eq("is_active", true);
        let qStaffs = supabase.from("staffs").select("id, full_name").eq("is_active", true);
        let qBuses = supabase.from("buses").select("id, plate_number").eq("is_active", true);
        let qRoutes = supabase.from("routes").select("id, route_name").eq("is_active", true);

        if (companyId) {
          qStaffs = qStaffs.eq("company_id", companyId);
          qBuses = qBuses.eq("company_id", companyId);
          qRoutes = qRoutes.eq("company_id", companyId);
        }

        const [resTypes, resStaffs, resBuses, resRoutes] = await Promise.all([
          qTypes,
          qStaffs,
          qBuses,
          qRoutes
        ]);

        if (resTypes.error) throw resTypes.error;
        if (resStaffs.error) throw resStaffs.error;
        if (resBuses.error) throw resBuses.error;
        if (resRoutes.error) throw resRoutes.error;

        setInvoiceTypes(resTypes.data?.map(o => ({ id: o.id, name: o.type_name })) || []);
        setStaffs(resStaffs.data?.map(o => ({ id: o.id, name: o.full_name })) || []);
        setBuses(resBuses.data?.map(o => ({ id: o.id, name: o.plate_number })) || []);
        setRoutes(resRoutes.data?.map(o => ({ id: o.id, name: o.route_name })) || []);
      } catch (err: any) {
        console.error("Error loading invoice classifications:", err);
        setClassificationsError(err.message || "Failed to load option arrays from Supabase metadata.");
      } finally {
        setIsClassificationsLoading(false);
      }
    }
    loadClassifications();
  }, [lookups]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "TZS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val).replace("TZS", "TZS ");
  };

  const formatToPreviewDate = (ymdStr: string): string => {
    if (!ymdStr) return "—";
    const parts = ymdStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return ymdStr;
  };

  // Submit manual invoice rows
  const onSubmit = async (data: InvoicesFormValues) => {
    try {
      setIsSaving(true);
      setSaveError(null);
      setSaveSuccess(false);

      // Map rows for insert (leaving out net_amount and tax_amount since they are computed columns)
      const payload = data.lines.map((line) => {
        const item: any = {
          invoice_date: line.invoice_date || null,
          invoice_type_id: line.invoice_type_id || null,
          staff_id: line.staff_id || null,
          bus_id: line.bus_id || null,
          route_id: line.route_id || null,
          gross_amount: Number(line.gross_amount),
        };
        if (currentUserProfile?.company_id) {
          item.company_id = currentUserProfile.company_id;
        }
        return item;
      });

      const { error } = await supabase.from("invoices").insert(payload);

      if (error) throw error;

      setSaveSuccess(true);
      reset({
        lines: [defaultLineValues],
      });
    } catch (err: any) {
      console.error("Invoice save transaction error:", err);
      setSaveError(err.message || "Failed to commit invoice batches into ledger.");
    } finally {
      setIsSaving(false);
    }
  };

  // Excel parser process
  const handleExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processExcelFile(file);
  };

  const processExcelFile = (file: File) => {
    setExcelFile(file);
    setExcelError(null);
    setExcelSuccess(false);
    setAllParsedRows([]);
    setValidatedRows([]);
    setInvalidRows([]);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        setExcelMatchingLoading(true);
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Parse into json representation array
        const rawJsonList = XLSX.utils.sheet_to_json<any>(worksheet);
        
        if (rawJsonList.length === 0) {
          setExcelError("The uploaded spreadsheet contains no records or rows.");
          setExcelMatchingLoading(false);
          return;
        }

        const validList: any[] = [];
        const invalidList: any[] = [];
        const parsedList: any[] = [];

        // Helper alias resolution helper
        const resolveField = (row: any, aliases: string[]) => {
          for (const alias of aliases) {
            const cleanAlias = alias.toLowerCase().trim();
            for (const key of Object.keys(row)) {
              if (key.toLowerCase().trim() === cleanAlias) {
                return row[key];
              }
            }
          }
          return undefined;
        };

        // Parse various date formats robustly
        const parseExcelDateValue = (raw: any): string => {
          if (raw === undefined || raw === null) return "";
          
          // Check for Excel serial date
          const num = Number(raw);
          if (typeof raw === "number" || (!isNaN(num) && String(raw).trim() !== "" && !String(raw).includes("/") && !String(raw).includes("-") && num > 10000)) {
            try {
              const dateObj = XLSX.SSF.parse_date_code(num);
              if (dateObj) {
                const y = dateObj.y;
                const m = String(dateObj.m).padStart(2, "0");
                const d = String(dateObj.d).padStart(2, "0");
                // Validate if it is a real date
                const tempDate = new Date(y, dateObj.m - 1, dateObj.d);
                if (tempDate.getFullYear() === y && tempDate.getMonth() === dateObj.m - 1 && tempDate.getDate() === dateObj.d) {
                  return `${y}-${m}-${d}`;
                }
              }
            } catch (e) {
              console.error("Error parsing serial date:", e);
            }
          }

          const str = String(raw).trim();
          if (!str) return "";

          // 1. Try DD/MM/YYYY or DD-MM-YYYY first (comply with 05/06/2026 = 5 June 2026 and preferred DD/MM/YYYY / DD-MM-YYYY)
          const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
          if (dmyMatch) {
            const d = parseInt(dmyMatch[1], 10);
            const m = parseInt(dmyMatch[2], 10);
            const y = parseInt(dmyMatch[3], 10);
            if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
              // Check real calendar bounds
              const tempDate = new Date(y, m - 1, d);
              if (tempDate.getFullYear() === y && tempDate.getMonth() === m - 1 && tempDate.getDate() === d) {
                return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              }
            }
            return "";
          }

          // 2. Try YYYY-MM-DD or YYYY/MM/DD second
          const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
          if (ymdMatch) {
            const y = parseInt(ymdMatch[1], 10);
            const m = parseInt(ymdMatch[2], 10);
            const d = parseInt(ymdMatch[3], 10);
            if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
              const tempDate = new Date(y, m - 1, d);
              if (tempDate.getFullYear() === y && tempDate.getMonth() === m - 1 && tempDate.getDate() === d) {
                return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              }
            }
            return "";
          }

          // 3. Try slower word month match
          const monthsAbbr = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
          const monthsFull = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
          
          const wordMonthMatch = str.match(/^(\d{1,2})[\/\-\s]+([a-zA-Z]+)[\/\-\s]+(\d{4})$/);
          if (wordMonthMatch) {
            const day = parseInt(wordMonthMatch[1], 10);
            const monthWord = wordMonthMatch[2].toLowerCase();
            const year = parseInt(wordMonthMatch[3], 10);
            let monthIdx = monthsAbbr.indexOf(monthWord.substring(0, 3));
            if (monthIdx === -1) {
              monthIdx = monthsFull.indexOf(monthWord);
            }
            if (monthIdx !== -1) {
              const m = monthIdx + 1;
              if (day >= 1 && day <= 31) {
                const tempDate = new Date(year, monthIdx, day);
                if (tempDate.getFullYear() === year && tempDate.getMonth() === monthIdx && tempDate.getDate() === day) {
                  return `${year}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                }
              }
            }
          }

          return "";
        };

        const findMatchByNameOnly = (rawVal: any, sourceList: DropdownOption[]) => {
          if (rawVal === undefined || rawVal === null) return null;
          const needle = String(rawVal).toLowerCase().trim();
          if (!needle) return null;
          const nameMatch = sourceList.find(item => String(item.name).toLowerCase().trim() === needle);
          if (nameMatch) return nameMatch.id;
          return null;
        };

        const isCellEmpty = (val: any) => {
          if (val === undefined || val === null) return true;
          if (typeof val === "string") {
            const trimmed = val.trim();
            return trimmed === "" || trimmed.toLowerCase() === "null" || trimmed.toLowerCase() === "undefined";
          }
          return false;
        };

        const activeCompanyId = currentUserProfile?.company_id;

        // Process rows and perform async rpc validations row-by-row
        for (let i = 0; i < rawJsonList.length; i++) {
          const row = rawJsonList[i];
          const rawDate = resolveField(row, ["invoice_date", "date", "invoice date", "invoice-date"]);
          const rawType = resolveField(row, ["invoice_type", "type", "invoice_type_id", "type_id", "invoice type"]);
          const rawStaff = resolveField(row, ["staff", "staff_name", "driver", "conductor", "staff_id", "staff id"]);
          const rawBus = resolveField(row, ["bus", "plate_number", "plate", "plate number", "bus_id", "bus id"]);
          const rawRoute = resolveField(row, ["route", "route_name", "route name", "route_id", "route id"]);
          const rawAmount = resolveField(row, ["gross_amount", "amount", "gross amount", "gross-amount"]);

          const excelRowDate = parseExcelDateValue(rawDate);
          
          const matchedTypeId = isCellEmpty(rawType) ? null : findMatchByNameOnly(rawType, invoiceTypes);
          const matchedBusId = isCellEmpty(rawBus) ? null : findMatchByNameOnly(rawBus, buses);
          const matchedRouteId = isCellEmpty(rawRoute) ? null : findMatchByNameOnly(rawRoute, routes);
          const amt = Number(rawAmount);

          let matStaffId = null;
          let matStaffName = "";
          let matStaffScore = null;
          const errorsList: string[] = [];

          if (!excelRowDate) {
            errorsList.push("Invalid invoice date. Use DD/MM/YYYY.");
          }
          if (!isCellEmpty(rawType) && !matchedTypeId) {
            errorsList.push("Unmatched invoice type name");
          }

          // Fuzzy staff lookup using match_staff_for_invoice RPC
          if (!isCellEmpty(rawStaff)) {
            try {
              const { data: rpcData, error: rpcErr } = await supabase.rpc("match_staff_for_invoice", {
                p_staff_name: String(rawStaff).trim(),
                p_company_id: activeCompanyId,
              });

              if (rpcErr) {
                console.error(`Fuzzy match RPC error for row ${i + 1}, staff="${rawStaff}":`, rpcErr);
                errorsList.push("Staff matching failed");
              } else {
                const match = rpcData?.[0];
                if (match && match.match_score >= 0.75) {
                  matStaffId = match.staff_id;
                  matStaffName = match.staff_name;
                  matStaffScore = match.match_score;
                  console.log(`Row ${i + 1}: original="${rawStaff}" matched="${match.staff_name}" score=${match.match_score}`);
                } else {
                  errorsList.push("Unmatched staff name");
                  console.log(`Row ${i + 1}: original="${rawStaff}" unmatched or below threshold`, match);
                }
              }
            } catch (err: any) {
              console.error(`Fuzzy match exception for row ${i + 1}:`, err);
              errorsList.push("Staff matching failed");
            }
          } else {
            matStaffId = null;
          }

          if (!isCellEmpty(rawBus) && !matchedBusId) {
            errorsList.push("Unmatched bus plate number");
          }
          if (!isCellEmpty(rawRoute) && !matchedRouteId) {
            errorsList.push("Unmatched route name");
          }
          if (isNaN(amt) || amt <= 0) {
            errorsList.push("Invalid amount");
          }

          const rowData = {
            index: i + 1,
            rowNumber: i + 1,
            originalRow: row,
            invoice_date: excelRowDate,
            rawDateText: rawDate || "None",
            rawTypeText: rawType || "None",
            rawStaffText: rawStaff || "None",
            rawBusText: rawBus || "None",
            rawRouteText: rawRoute || "None",
            rawAmountText: rawAmount || "None",
            invoice_type_id: matchedTypeId,
            invoice_type_name: invoiceTypes.find(t => t.id === matchedTypeId)?.name || rawType || "",
            staff_id: matStaffId,
            staff_name_original: rawStaff || "",
            matched_staff_name: matStaffName,
            match_score: matStaffScore,
            bus_id: matchedBusId,
            route_id: matchedRouteId,
            gross_amount: isNaN(amt) ? 0 : amt,
            errors: errorsList,
          };

          parsedList.push(rowData);
          if (rowData.errors.length === 0) {
            validList.push(rowData);
          } else {
            invalidList.push(rowData);
          }
        }

        setAllParsedRows(parsedList);
        setValidatedRows(validList);
        setInvalidRows(invalidList);
      } catch (err: any) {
        console.error("Error processing Excel buffer:", err);
        setExcelError("System failed to parse spreadsheet. Ensure it is a valid Excel file.");
      } finally {
        setExcelMatchingLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const uploadParsedExcelRows = async () => {
    if (validatedRows.length === 0) return;
    try {
      setIsSaving(true);
      setExcelError(null);
      setExcelSuccess(false);

      const payload = validatedRows.map(row => {
        const item: any = {
          invoice_date: row.invoice_date,
          invoice_type_id: row.invoice_type_id,
          staff_id: row.staff_id,
          bus_id: row.bus_id ?? null,
          route_id: row.route_id ?? null,
          gross_amount: Number(row.gross_amount),
        };
        const activeCompanyId = currentUserProfile?.company_id;
        if (activeCompanyId) {
          item.company_id = activeCompanyId;
        }
        return item;
      });

      const { error } = await supabase.from("invoices").insert(payload);
      if (error) throw error;

      setExcelSuccess(true);
      setExcelFile(null);
      setAllParsedRows([]);
      setValidatedRows([]);
      setInvalidRows([]);
    } catch (err: any) {
      console.error("Excel batch upload failed:", err);
      setExcelError(err.message || "Database batch insert failed.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isClassificationsLoading) {
    return (
      <div className="rounded-2xl border border-white/5 bg-[#0c0c0c]/80 p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
        <Coins className="h-8 w-8 text-amber-500 mb-3 animate-spin" />
        <h4 className="text-sm font-medium text-neutral-300">Synchronizing lookup tables...</h4>
        <p className="text-xs text-neutral-500 font-mono mt-1">Loading types, staff rosters, plate registrations & and routes.</p>
      </div>
    );
  }

  if (classificationsError) {
    return (
      <div className="rounded-2xl border border-red-500/10 bg-red-500/5 p-8 text-center flex flex-col items-center justify-center min-h-[250px]">
        <AlertTriangle className="h-8 w-8 text-red-500 mb-3" />
        <h4 className="text-sm font-semibold text-red-400">Ledger Handshake Failure</h4>
        <p className="text-xs text-neutral-400 font-mono leading-relaxed max-w-md mt-1 mb-4">{classificationsError}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-200 text-xs rounded-xl font-mono cursor-pointer"
        >
          FORCE HANDSHAKE RETRY
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab select: Manual vs Excel */}
      <div className="flex gap-2 p-1.5 rounded-xl bg-neutral-900/40 border border-white/5 w-fit">
        <button
          onClick={() => {
            setActiveSubTab("manual");
            setSaveSuccess(false);
            setSaveError(null);
          }}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeSubTab === "manual"
              ? "bg-[#141414] text-amber-400 border border-white/5"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          <Plus className="h-3.5 w-3.5" />
          Interactive Ledger Entry
        </button>
        <button
          onClick={() => {
            setActiveSubTab("excel");
            setExcelSuccess(false);
            setExcelError(null);
          }}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeSubTab === "excel"
              ? "bg-[#141414] text-amber-400 border border-white/5"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Bulk Excel Upload
        </button>
      </div>

      {/* VIEW SUB-TAB 1: MANUALLY POST LINES */}
      {activeSubTab === "manual" && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="rounded-2xl bg-[#24283b]/60 backdrop-blur-xl border border-white/10 shadow-2xl p-6 relative col-span-12">
            <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent"></div>
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-5 border-b border-white/5 mb-6">
              <div>
                <span className="text-[10px] font-mono tracking-widest text-amber-500/80 uppercase">AR-Invoice System</span>
                <h2 className="text-base font-light text-white mt-0.5">Line-Based Invoice Accounts Entry</h2>
              </div>
              <button
                type="button"
                onClick={() => append(defaultLineValues)}
                className="flex items-center gap-2 text-xs font-semibold px-4 py-2 bg-amber-500/10 border border-amber-500/25 hover:bg-amber-500/20 text-amber-300 rounded-xl transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Add Invoice line
              </button>
            </div>

            {/* Error & Success announcements */}
            {saveError && (
              <div className="p-4 bg-red-950/20 border border-red-500/20 rounded-xl text-xs text-red-400 flex items-start gap-2.5 mb-6 font-mono leading-relaxed">
                <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold block uppercase tracking-wider text-[10px] mb-1">Ledger Entry Refused</strong>
                  An error occurred during transaction submission: {saveError}
                </div>
              </div>
            )}

            {saveSuccess && (
              <div className="p-4 bg-amber-950/20 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start gap-2.5 mb-6 font-mono leading-relaxed animate-pulse">
                <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold block uppercase tracking-wider text-[10px] mb-1">Invoices Recorded</strong>
                  The batched invoices have been successfully validated & committed into the ledger collections.
                </div>
              </div>
            )}

            {/* Desktop Table View inside a Horizontal scroll envelope */}
            <div className="hidden xl:block overflow-x-auto pb-48 custom-scrollbar relative z-20">
              <div className="min-w-[1050px] space-y-3">
                
                {/* Headers */}
                <div className="grid grid-cols-[125px_1fr_1.1fr_0.9fr_1fr_130px_42px] gap-2 bg-neutral-900/40 text-[10px] font-mono uppercase tracking-wider text-neutral-400 p-3 rounded-xl border border-white/5">
                  <div>Invoice Date</div>
                  <div>Invoice Type</div>
                  <div>Staff Roster</div>
                  <div>Plate / Bus</div>
                  <div>Route Line</div>
                  <div className="text-right">Gross Amount</div>
                  <div className="text-center">Del</div>
                </div>

                {/* Rows map */}
                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="grid grid-cols-[125px_1fr_1.1fr_0.9fr_1fr_130px_42px] gap-2 items-center p-2.5 rounded-xl border border-white/5 bg-neutral-950/20 hover:bg-neutral-900/40 transition-all relative"
                    >
                      {/* 1. Date */}
                      <div>
                        <Controller
                          control={control}
                          name={`lines.${index}.invoice_date`}
                          render={({ field }) => (
                            <input
                              type="date"
                              {...field}
                              className={`w-full bg-[#0c0c0c]/90 border ${
                                errors.lines?.[index]?.invoice_date ? "border-red-500/40 focus:border-red-500" : "border-white/10 hover:border-amber-500/20 focus:border-amber-500/50"
                              } rounded-xl p-2 text-xs text-white focus:outline-none h-[38px]`}
                            />
                          )}
                        />
                      </div>

                      {/* 2. Type */}
                      <Controller
                        control={control}
                        name={`lines.${index}.invoice_type_id`}
                        render={({ field }) => (
                          <SearchableSelect
                            options={invoiceTypes}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Select Type"
                            label="Type"
                            error={errors.lines?.[index]?.invoice_type_id?.message}
                          />
                        )}
                      />

                      {/* 3. Staff */}
                      <Controller
                        control={control}
                        name={`lines.${index}.staff_id`}
                        render={({ field }) => (
                          <SearchableSelect
                            options={staffs}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Select Staff"
                            label="Staff"
                            error={errors.lines?.[index]?.staff_id?.message}
                          />
                        )}
                      />

                      {/* 4. Bus */}
                      <Controller
                        control={control}
                        name={`lines.${index}.bus_id`}
                        render={({ field }) => (
                          <SearchableSelect
                            options={buses}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Select Bus"
                            label="Bus"
                            error={errors.lines?.[index]?.bus_id?.message}
                          />
                        )}
                      />

                      {/* 5. Route */}
                      <Controller
                        control={control}
                        name={`lines.${index}.route_id`}
                        render={({ field }) => (
                          <SearchableSelect
                            options={routes}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Select Route"
                            label="Route"
                            error={errors.lines?.[index]?.route_id?.message}
                          />
                        )}
                      />

                      {/* 6. Gross Amount */}
                      <div>
                        <Controller
                          control={control}
                          name={`lines.${index}.gross_amount`}
                          render={({ field }) => (
                            <input
                              type="number"
                              {...field}
                              placeholder="Amount"
                              className={`text-right w-full bg-[#0c0c0c]/90 border ${
                                errors.lines?.[index]?.gross_amount ? "border-red-500/40 focus:border-red-500" : "border-white/10 hover:border-amber-500/20 focus:border-amber-500/50"
                              } rounded-xl p-2 text-xs text-white focus:outline-none transition-colors h-[38px] font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                            />
                          )}
                        />
                      </div>

                      {/* 7. Action delete */}
                      <div className="text-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (fields.length > 1) remove(index);
                          }}
                          disabled={fields.length === 1}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            fields.length === 1
                              ? "border-white/5 text-neutral-800 cursor-not-allowed"
                              : "border-red-500/10 hover:bg-red-500/10 text-red-400 hover:border-red-500/30"
                          }`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                    </div>
                  ))}
                </div>

              </div>
            </div>

            {/* Smartphone & Tablet Stack card fallback */}
            <div className="block xl:hidden space-y-4 mb-6">
              {fields.map((field, index) => (
                <motion.div
                  key={field.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl bg-neutral-950/40 border border-white/5 p-4 space-y-3 relative"
                >
                  <div className="flex justify-between items-center pb-2 border-b border-white/5">
                    <span className="text-[10px] font-mono font-bold text-amber-500">LINE NO. #{index + 1}</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (fields.length > 1) remove(index);
                      }}
                      disabled={fields.length === 1}
                      className="px-2 py-1 text-[10px] border border-red-500/10 hover:bg-red-550/10 hover:border-red-500/30 text-red-400 rounded-lg transition-colors cursor-pointer"
                    >
                      Delete Row
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Invoice Date */}
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-neutral-500 font-mono mb-1">Invoice Date</label>
                      <Controller
                        control={control}
                        name={`lines.${index}.invoice_date`}
                        render={({ field }) => (
                          <input
                            type="date"
                            {...field}
                            className={`w-full bg-[#0c0c0c]/95 border ${
                              errors.lines?.[index]?.invoice_date ? "border-red-500/40 focus:border-red-500" : "border-white/10 focus:border-amber-500/55"
                            } rounded-xl p-2.5 text-xs text-white focus:outline-none h-[38px]`}
                          />
                        )}
                      />
                    </div>

                    {/* Invoice Type */}
                    <div>
                      <Controller
                        control={control}
                        name={`lines.${index}.invoice_type_id`}
                        render={({ field }) => (
                          <SearchableSelect
                            options={invoiceTypes}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Select Type"
                            label="Invoice Type"
                            error={errors.lines?.[index]?.invoice_type_id?.message}
                          />
                        )}
                      />
                    </div>

                    {/* Staff */}
                    <div>
                      <Controller
                        control={control}
                        name={`lines.${index}.staff_id`}
                        render={({ field }) => (
                          <SearchableSelect
                            options={staffs}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Select Staff"
                            label="Staff"
                            error={errors.lines?.[index]?.staff_id?.message}
                          />
                        )}
                      />
                    </div>

                    {/* Bus */}
                    <div>
                      <Controller
                        control={control}
                        name={`lines.${index}.bus_id`}
                        render={({ field }) => (
                          <SearchableSelect
                            options={buses}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Select Bus/Plate"
                            label="Bus"
                            error={errors.lines?.[index]?.bus_id?.message}
                          />
                        )}
                      />
                    </div>

                    {/* Route */}
                    <div>
                      <Controller
                        control={control}
                        name={`lines.${index}.route_id`}
                        render={({ field }) => (
                          <SearchableSelect
                            options={routes}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Select Route"
                            label="Route"
                            error={errors.lines?.[index]?.route_id?.message}
                          />
                        )}
                      />
                    </div>

                    {/* Gross Amount */}
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-neutral-500 font-mono mb-1">Gross Amount</label>
                      <Controller
                        control={control}
                        name={`lines.${index}.gross_amount`}
                        render={({ field }) => (
                          <input
                            type="number"
                            {...field}
                            placeholder="Amount in TZS"
                            className={`w-full bg-[#0c0c0c]/90 border ${
                              errors.lines?.[index]?.gross_amount ? "border-red-500/40 focus:border-red-500" : "border-white/10 focus:border-amber-500/55"
                            } rounded-xl p-2.5 text-xs text-white focus:outline-none h-[38px] font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                          />
                        )}
                      />
                    </div>

                  </div>
                </motion.div>
              ))}
            </div>

            {/* Actions segment */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 pt-5 border-t border-white/5">
              
              {/* Sum box */}
              <div className="w-full md:w-auto flex items-center gap-4 bg-amber-500/5 border border-amber-500/25 rounded-2xl p-4 pr-6">
                <div className="h-10 w-10 text-amber-400 bg-amber-500/10 rounded-xl flex items-center justify-center font-mono text-[11px] font-bold border border-amber-500/15">
                  ∑
                </div>
                <div className="text-left font-mono">
                  <span className="text-[10px] uppercase text-neutral-500 tracking-wider block font-light">Total Invoices Valuation</span>
                  <span className="text-base font-bold text-amber-300">{formatCurrency(liveTotal)}</span>
                </div>
              </div>

              {/* Submit triggers */}
              <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => {
                    reset({
                      lines: [defaultLineValues],
                    });
                    setSaveError(null);
                    setSaveSuccess(false);
                  }}
                  className="px-5 py-3 rounded-xl border border-white/5 bg-neutral-950/60 hover:bg-neutral-900 text-xs text-neutral-400 font-medium transition-colors cursor-pointer"
                >
                  Clear Fields
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className={`flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-neutral-950 font-semibold rounded-xl text-xs transition-colors cursor-pointer ${
                    isSaving ? "opacity-60 cursor-not-allowed" : "shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:shadow-[0_0_25px_rgba(245,158,11,0.25)]"
                  }`}
                >
                  {isSaving ? (
                    <>
                      <Coins className="h-4 w-4 animate-spin text-neutral-950" />
                      Saving Invoices...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 text-neutral-950" />
                      Save Invoices
                    </>
                  )}
                </button>
              </div>

            </div>

          </div>
        </form>
      )}

      {/* VIEW SUB-TAB 2: BULK EXCEL PARSER */}
      {activeSubTab === "excel" && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-[#24283b]/60 backdrop-blur-xl border border-white/10 shadow-2xl p-6 relative">
            <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent"></div>
            
            <div className="pb-5 border-b border-white/5 mb-6">
              <span className="text-[10px] font-mono tracking-widest text-amber-500/80 uppercase">Spreadsheet Pipeline</span>
              <h2 className="text-base font-light text-white mt-0.5">Bulk Excel Document Ingestion</h2>
            </div>

            {/* Drag and drop zone */}
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 hover:border-amber-500/25 bg-neutral-950/50 rounded-2xl p-8 text-center transition-all relative">
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleExcelFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <Upload className="h-10 w-10 text-amber-500/60 mb-3" />
              <h3 className="text-sm font-medium text-white mb-1">Drag and drop or browse files</h3>
              <p className="text-xs text-neutral-400 font-light mb-3">Accepts standard `.xlsx` or `.xls` workbooks</p>
              
              <div className="px-3.5 py-1.5 rounded-lg bg-[#0e0e0e]/95 border border-white/5 font-mono text-[9px] text-neutral-500">
                REQUIRED COLUMNS: invoice_date, invoice_type_id, staff_id, bus_id, route_id, gross_amount
              </div>
            </div>

            {/* Error & Success announcements */}
            {excelMatchingLoading && (
              <div className="p-4 bg-amber-950/40 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-center gap-2.5 mt-6 font-mono leading-relaxed">
                <span className="relative flex h-3 w-3 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                </span>
                <div>
                  <strong className="font-semibold block uppercase tracking-wider text-[10px] mb-1">Fuzzy Matching in Progress</strong>
                  Matching staff names using online database registries... Please wait.
                </div>
              </div>
            )}

            {excelError && (
              <div className="p-4 bg-red-950/20 border border-red-500/20 rounded-xl text-xs text-red-400 flex items-start gap-2.5 mt-6 font-mono leading-relaxed">
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold block uppercase tracking-wider text-[10px] mb-1">Compilation Blocked</strong>
                  {excelError}
                </div>
              </div>
            )}

            {excelSuccess && (
              <div className="p-4 bg-amber-950/20 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start gap-2.5 mt-6 font-mono leading-relaxed">
                <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold block uppercase tracking-wider text-[10px] mb-1">Records Committed</strong>
                  Batched spreadsheet invoice rows were successfully parsed and uploaded without errors.
                </div>
              </div>
            )}

            {excelFile && (
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/5 bg-[#121212]/50 mt-4 leading-none text-xs font-mono text-neutral-300">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                  <span>{excelFile.name} ({(excelFile.size / 1024).toFixed(1)} KB)</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setExcelFile(null);
                    setAllParsedRows([]);
                    setValidatedRows([]);
                    setInvalidRows([]);
                    setExcelError(null);
                  }}
                  className="text-red-400 hover:text-red-300 uppercase tracking-widest text-[9px] cursor-pointer"
                >
                  Detach Document
                </button>
              </div>
            )}

          </div>

          {/* PARSE SUMMARY & VALIDATION INTERACTION PANEL */}
          {allParsedRows.length > 0 && (
            <div className="rounded-2xl border border-white/5 bg-[#24283b]/65 backdrop-blur-xl p-6 space-y-6 shadow-2xl">
              <div className="pb-4 border-b border-white/5 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Parsing Validation Analysis</h3>
                  <span className="text-[10px] font-mono text-neutral-500">Validation completed against online database classification tables.</span>
                </div>
                <button
                  onClick={uploadParsedExcelRows}
                  disabled={validatedRows.length === 0 || isSaving}
                  className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold leading-none cursor-pointer ${
                    validatedRows.length === 0 || isSaving
                      ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                      : "bg-gradient-to-r from-amber-600 to-amber-500 text-neutral-950 hover:from-amber-500 font-bold hover:to-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.1)]"
                  }`}
                >
                  {isSaving ? (
                    <>
                      <Coins className="h-4 w-4 animate-spin text-neutral-950" />
                      Uploading Invoices ({validatedRows.length})...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 text-neutral-950" />
                      Upload Safe Invoices ({validatedRows.length})
                    </>
                  )}
                </button>
              </div>

              {/* Status summary boxes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-white/5 p-4 bg-neutral-950/40 text-left">
                  <span className="text-[9px] font-mono text-neutral-500 uppercase block">Total Records Found</span>
                  <p className="text-xl font-bold font-mono text-neutral-200 mt-1">{allParsedRows.length}</p>
                </div>
                <div className="rounded-xl border border-amber-500/10 p-4 bg-amber-550/5 text-left">
                  <span className="text-[9px] font-mono text-amber-500/60 uppercase block">Ready to Upload</span>
                  <p className="text-xl font-bold font-mono text-amber-400 mt-1">{validatedRows.length}</p>
                </div>
                <div className="rounded-xl border border-red-500/10 p-4 bg-red-550/5 text-left">
                  <span className="text-[9px] font-mono text-red-500/60 uppercase block">Rejected Rows</span>
                  <p className="text-xl font-bold font-mono text-red-400 mt-1">{invalidRows.length}</p>
                </div>
              </div>

              {/* Warnings and issues lists */}
              {invalidRows.length > 0 && (
                <div className="p-4 bg-red-950/10 border border-red-500/15 rounded-xl space-y-2">
                  <h4 className="text-xs font-bold font-mono text-red-400 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" /> REJECTED ROW ENTRIES LIST ({invalidRows.length})
                  </h4>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 custom-scrollbar font-mono pr-2">
                    {invalidRows.map((row) => (
                      <div key={row.index} className="text-[10px] text-neutral-400 border-b border-white/5 pb-1 flex flex-col md:flex-row md:justify-between md:items-start gap-1">
                        <span>Row {row.rowNumber}:</span>
                        <div className="text-red-400/90 text-left flex-1 md:pl-2">
                          {row.errors.map((e: string, i: number) => <span key={i} className="block">• {e}</span>)}
                        </div>
                        <span className="text-neutral-500 text-[9px]">
                          Staff: {row.rawStaffText} | Amount: {row.rawAmountText} | Converted Date: {row.invoice_date ? formatToPreviewDate(row.invoice_date) : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Valid rows scroll table */}
              {validatedRows.length > 0 && (
                <div className="space-y-3 text-left">
                  <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">Validated Rows Preview ({validatedRows.length})</h4>
                  <div className="overflow-x-auto rounded-xl border border-white/10 custom-scrollbar">
                    <table className="w-full text-xs font-mono text-neutral-300">
                      <thead className="bg-[#121212] text-neutral-500 border-b border-white/5 uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3 text-left">Row No.</th>
                          <th className="py-2.5 px-3 text-left">Date</th>
                          <th className="py-2.5 px-3 text-left">Type</th>
                          <th className="py-2.5 px-3 text-left">Original Staff</th>
                          <th className="py-2.5 px-3 text-left">Matched Staff</th>
                          <th className="py-2.5 px-3 text-left">Match Score</th>
                          <th className="py-2.5 px-3 text-left">Plate / Bus</th>
                          <th className="py-2.5 px-3 text-left">Route Line</th>
                          <th className="py-2.5 px-3 text-right">Gross Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {validatedRows.map((row, idx) => {
                          const displayScore = row.match_score !== undefined && row.match_score !== null
                            ? `${Math.round(row.match_score * 100)}%`
                            : "—";
                          return (
                            <tr key={idx} className="hover:bg-neutral-900/40">
                              <td className="py-2 px-3 text-neutral-500">{row.rowNumber}</td>
                              <td className="py-2 px-3">{formatToPreviewDate(row.invoice_date)}</td>
                              <td className="py-2 px-3">{row.invoice_type_name || row.rawTypeText}</td>
                              <td className="py-2 px-3">{row.staff_name_original || row.rawStaffText}</td>
                              <td className="py-2 px-3 text-amber-100">{row.matched_staff_name || "—"}</td>
                              <td className="py-2 px-3 font-semibold text-amber-400 bg-amber-500/5">{displayScore}</td>
                              <td className="py-2 px-3">{row.rawBusText}</td>
                              <td className="py-2 px-3">{row.rawRouteText}</td>
                              <td className="py-2 px-3 text-right text-amber-300">{formatCurrency(row.gross_amount)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      )}

    </div>
  );
}

/* ========================================================================== */
/* VIEW COMPONENT 3: ACTIONS (Workflows / Access Keys Approval States)         */
/* ========================================================================== */
function ActionsView({ lookups, currentUserProfile, onApprovalsUpdated }: { lookups?: any; currentUserProfile?: any; onApprovalsUpdated?: () => void }) {
  const [pendingCash, setPendingCash] = useState<any[]>([]);
  const [userProfilesMap, setUserProfilesMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [updatingRowId, setUpdatingRowId] = useState<string | null>(null);
  const [selectedStatuses, setSelectedStatuses] = useState<Record<string, number>>({});

  // Invoice Actions section states
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invoiceLoading, setInvoiceLoading] = useState(true);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  
  // Modal states for editing an invoice
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTypeId, setEditTypeId] = useState<number | string>("");
  const [editStaffId, setEditStaffId] = useState<number | string>("");
  const [editBusId, setEditBusId] = useState<number | string>("");
  const [editRouteId, setEditRouteId] = useState<number | string>("");
  const [editAmount, setEditAmount] = useState<number | string>("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [updatingInvoiceId, setUpdatingInvoiceId] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);

  async function fetchInvoices() {
    try {
      setInvoiceLoading(true);
      setInvoiceError(null);
      const companyId = currentUserProfile?.company_id;
      const isSuperUser = currentUserProfile?.company_name === "Meqk Foundation";
      
      let q = supabase
        .from("invoices")
        .select(`
          id,
          invoice_date,
          invoice_type_id,
          staff_id,
          bus_id,
          route_id,
          gross_amount,
          invoice_types(type_name),
          staffs(full_name),
          buses(plate_number),
          routes(route_name)
        `);
        
      if (companyId && !isSuperUser) {
        q = q.eq("company_id", companyId);
      }
      
      const { data, error: qErr } = await q.order("invoice_date", { ascending: false });
      if (qErr) throw qErr;
      
      setInvoices(data || []);
    } catch (err: any) {
      console.error("Error fetching actions invoices:", err);
      setInvoiceError(err.message || String(err));
    } finally {
      setInvoiceLoading(false);
    }
  }

  const handleOpenEditModal = (inv: any) => {
    setSelectedInvoice(inv);
    setEditDate(inv.invoice_date || "");
    setEditTypeId(inv.invoice_type_id || "");
    setEditStaffId(inv.staff_id || "");
    setEditBusId(inv.bus_id || "");
    setEditRouteId(inv.route_id || "");
    setEditAmount(inv.gross_amount || "");
    setUpdateError(null);
    setUpdateSuccess(null);
    setIsEditModalOpen(true);
  };

  const handleSaveInvoiceUpdate = async () => {
    if (!selectedInvoice) return;
    if (!editDate) {
      setUpdateError("Invoice date is required");
      return;
    }
    if (!editTypeId) {
      setUpdateError("Invoice Type is required");
      return;
    }
    if (!editStaffId) {
      setUpdateError("Staff selection is required");
      return;
    }
    if (isNaN(Number(editAmount)) || Number(editAmount) <= 0) {
      setUpdateError("Gross Amount must be a positive number");
      return;
    }
    
    try {
      setUpdatingInvoiceId(selectedInvoice.id);
      setUpdateError(null);
      setUpdateSuccess(null);
      
      const { error: saveErr } = await supabase
        .from("invoices")
        .update({
          invoice_date: editDate,
          invoice_type_id: Number(editTypeId),
          staff_id: Number(editStaffId),
          bus_id: editBusId ? Number(editBusId) : null,
          route_id: editRouteId ? Number(editRouteId) : null,
          gross_amount: Number(editAmount),
        })
        .eq("id", selectedInvoice.id);
        
      if (saveErr) throw saveErr;
      
      setUpdateSuccess("Invoice updated successfully!");
      // Refresh list
      await fetchInvoices();
      
      setTimeout(() => {
        setIsEditModalOpen(false);
      }, 1500);
    } catch (err: any) {
      console.error("Error updating invoice item in Actions section:", err);
      setUpdateError("Failed to update invoice: " + (err.message || String(err)));
    } finally {
      setUpdatingInvoiceId(null);
    }
  };

  const statuses = lookups?.transactionStatuses || [];
  const pendingStatusObj = statuses.find(
    (s: any) => s.slug?.toLowerCase() === "pending" || s.display_name?.toLowerCase() === "pending"
  );
  const pendingStatusId = pendingStatusObj ? pendingStatusObj.id : 1;

  async function fetchPendingCash() {
    try {
      setLoading(true);
      setError(null);
      
      let currentPendingId = pendingStatusId;
      if (statuses.length === 0) {
        const { data: statusRows, error: sErr } = await supabase
          .from("transaction_statuses")
          .select("*");
        if (sErr) throw sErr;
        const pendingObj = statusRows?.find(
          (s: any) => s.slug?.toLowerCase() === "pending" || s.display_name?.toLowerCase() === "pending"
        );
        if (pendingObj) {
          currentPendingId = pendingObj.id;
        }
      }

      // Fetch user profiles separately to map cash.created_by to full name
      try {
        const { data: profileRows, error: pErr } = await supabase
          .from("user_profiles")
          .select("id, full_name");
        if (!pErr && profileRows) {
          const mapping: Record<string, string> = {};
          profileRows.forEach((p: any) => {
            if (p.id) mapping[p.id] = p.full_name || "";
          });
          setUserProfilesMap(mapping);
        }
      } catch (profileErr) {
        console.warn("Error fetching profiles mapping inside Actions:", profileErr);
      }

      const companyId = currentUserProfile?.company_id;
      let qCash = supabase
        .from("cash")
        .select(`
          id,
          amount,
          transaction_date,
          reference_number,
          status_id,
          created_by,
          cash_types(type_name),
          staffs(full_name),
          buses(plate_number),
          routes(route_name),
          accounts(account_name),
          categories(category_name),
          transaction_statuses(display_name)
        `)
        .eq("status_id", currentPendingId);
      if (companyId) {
        qCash = qCash.eq("company_id", companyId);
      }
      
      const { data, error: fetchErr } = await qCash.order("transaction_date", { ascending: false });

      if (fetchErr) throw fetchErr;

      setPendingCash(data || []);
      const initialSelections: Record<string, number> = {};
      data?.forEach((row: any) => {
        initialSelections[row.id] = row.status_id;
      });
      setSelectedStatuses(initialSelections);
    } catch (err: any) {
      console.error("Error fetching pending cash approvals:", err);
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPendingCash();
    fetchInvoices();
  }, [lookups, pendingStatusId, currentUserProfile]);

  const handleUpdateStatus = async (rowId: string) => {
    const selectedStatusId = selectedStatuses[rowId];
    if (!selectedStatusId) return;

    try {
      setUpdatingRowId(rowId);
      setError(null);
      setSuccessMessage(null);

      const { error: updateErr } = await supabase
        .from("cash")
        .update({ status_id: selectedStatusId })
        .eq("id", rowId);

      if (updateErr) throw updateErr;

      setSuccessMessage("Status updated successfully!");
      if (onApprovalsUpdated) onApprovalsUpdated();
      
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);

      // Refresh elements
      await fetchPendingCash();
    } catch (err: any) {
      console.error("Error updating status:", err);
      setError("Failed to update status: " + (err.message || String(err)));
    } finally {
      setUpdatingRowId(null);
    }
  };

  const formatTZS = (val: any) => {
    if (val === undefined || val === null || isNaN(Number(val))) return "TZS 0";
    return "TZS " + Math.round(Number(val)).toLocaleString("en-US");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] py-12">
        <Coins className="h-7 w-7 text-amber-500 animate-spin mb-3" />
        <span className="font-mono text-xs tracking-wider text-neutral-400">
          LOADING PENDING CASH APPROVALS...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Messages */}
      {error && (
        <div className="p-4 bg-red-950/20 border border-red-500/20 rounded-xl text-xs text-red-400 flex items-start gap-2.5 font-mono leading-relaxed">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold block uppercase tracking-wider text-[10px] mb-1">Approval Action Failed</strong>
            {error}
          </div>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-start gap-2.5 font-mono leading-relaxed animate-pulse">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold block uppercase tracking-wider text-[10px] mb-1">Status Dispatched</strong>
            {successMessage}
          </div>
        </div>
      )}

      {pendingCash.length === 0 ? (
        <div className="rounded-2xl bg-[#0c0c0c]/80 border border-white/5 p-12 text-center flex flex-col items-center justify-center min-h-[250px] shadow-2xl">
          <CheckCircle2 className="h-8 w-8 text-amber-500/80 mb-4" />
          <h3 className="text-base font-light text-white mb-2">All Cash Approvals Clear</h3>
          <p className="text-xs text-neutral-400 font-light leading-relaxed max-w-md mx-auto">
            There are currently no cash ledger records in Pending status. All records have successfully transited the approval pipelines.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop view */}
          <div className="hidden lg:block overflow-x-auto pb-6 custom-scrollbar relative z-20">
            <div className="min-w-[1380px] rounded-2xl bg-[#24283b]/60 backdrop-blur-xl border border-white/10 shadow-2xl p-6 relative">
              <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent"></div>
              
              <div className="flex justify-between items-center pb-4 border-b border-white/5 mb-4">
                <div>
                  <span className="text-[10px] font-mono tracking-widest text-amber-500 uppercase">Cash Approvals Queue</span>
                  <h2 className="text-sm font-semibold text-white mt-1">Pending Ledger Approvals ({pendingCash.length})</h2>
                </div>
              </div>

              <div className="space-y-2">
                {/* Headers */}
                <div className="grid grid-cols-[100px_80px_1.2fr_0.8fr_1fr_1.1fr_1.1fr_150px_110px_150px_130px] gap-2 bg-neutral-900/40 text-[10px] font-mono uppercase tracking-wider text-neutral-400 px-3 py-2.5 rounded-xl border border-white/5">
                  <div>Date</div>
                  <div>T.Type</div>
                  <div>Staff</div>
                  <div>Bus</div>
                  <div>Route</div>
                  <div>Account</div>
                  <div>Category</div>
                  <div>Reference</div>
                  <div className="text-right">Amount</div>
                  <div className="text-center">Action</div>
                  <div className="text-right pr-2">User</div>
                </div>

                {/* Rows */}
                <div className="space-y-2">
                  {pendingCash.map((row) => (
                    <div
                      key={row.id}
                      className="grid grid-cols-[100px_80px_1.2fr_0.8fr_1fr_1.1fr_1.1fr_150px_110px_150px_130px] gap-2 items-center p-2.5 rounded-xl border border-white/5 bg-neutral-950/20 hover:bg-neutral-900/40 transition-all"
                    >
                      <div className="text-xs font-mono text-neutral-400">
                        {row.transaction_date}
                      </div>
                      <div className="text-xs text-neutral-300">
                        {row.cash_types?.type_name || "—"}
                      </div>
                      <div className="text-xs text-white font-medium truncate">
                        {row.staffs?.full_name || "—"}
                      </div>
                      <div className="text-xs font-mono text-neutral-300 truncate">
                        {row.buses?.plate_number || "—"}
                      </div>
                      <div className="text-xs text-neutral-400 truncate">
                        {row.routes?.route_name || "—"}
                      </div>
                      <div className="text-xs text-neutral-300 truncate">
                        {row.accounts?.account_name || "—"}
                      </div>
                      <div className="text-xs text-neutral-400 truncate">
                        {row.categories?.category_name || "—"}
                      </div>
                      <div className="text-xs font-mono text-neutral-400 truncate">
                        {row.reference_number || "—"}
                      </div>
                      <div className="text-xs font-mono font-semibold text-right text-amber-400">
                        {formatTZS(row.amount)}
                      </div>
                      <div className="flex gap-2 items-center">
                        <select
                           value={selectedStatuses[row.id] || ""}
                           onChange={(e) => {
                             setSelectedStatuses(prev => ({
                               ...prev,
                               [row.id]: Number(e.target.value)
                             }));
                           }}
                           className="bg-[#0c0c0c] border border-white/10 text-neutral-200 text-xs rounded-lg p-1 w-full focus:outline-none focus:border-amber-500/50"
                        >
                          {statuses.map((s: any) => (
                            <option key={s.id} value={s.id}>
                              {s.display_name}
                            </option>
                          ))}
                        </select>
                        <button
                          disabled={updatingRowId === row.id || selectedStatuses[row.id] === row.status_id}
                          onClick={() => handleUpdateStatus(row.id)}
                          className="px-2 py-1.5 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 disabled:opacity-40 text-amber-300 text-[10px] font-semibold rounded-lg shrink-0 cursor-pointer flex items-center gap-1 transition-all"
                        >
                          {updatingRowId === row.id ? (
                            <Coins className="h-3 w-3 animate-spin" />
                          ) : (
                            "Apply"
                          )}
                        </button>
                      </div>
                      <div className="text-xs font-mono text-neutral-400 text-right truncate pr-2">
                        {row.created_by ? (userProfilesMap[row.created_by] || row.created_by) : "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Stacked Layout (Responsive) */}
          <div className="lg:hidden space-y-4">
            {pendingCash.map((row) => (
              <div
                key={row.id}
                className="rounded-2xl bg-[#0c0c0c]/85 border border-white/5 p-4 space-y-3 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent"></div>
                
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[9px] font-mono text-amber-500/80 uppercase">
                      {row.cash_types?.type_name || "transaction"}
                    </span>
                    <h4 className="text-xs font-semibold text-white mt-0.5">
                      {row.staffs?.full_name || "Staff Unassigned"}
                    </h4>
                  </div>
                  <span className="font-mono text-xs text-amber-400 font-bold">
                    {formatTZS(row.amount)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2 border-t border-white/5 text-[11px]">
                  <div>
                    <span className="text-neutral-500 block text-[9px] uppercase font-mono">Date</span>
                    <span className="text-neutral-300 font-mono">{row.transaction_date}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[9px] uppercase font-mono">Bus / Plate</span>
                    <span className="text-neutral-300 font-mono truncate block">{row.buses?.plate_number || "—"}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[9px] uppercase font-mono">Route</span>
                    <span className="text-neutral-300 truncate block">{row.routes?.route_name || "—"}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[9px] uppercase font-mono">Account</span>
                    <span className="text-neutral-300 truncate block">{row.accounts?.account_name || "—"}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[9px] uppercase font-mono">Category</span>
                    <span className="text-neutral-300 truncate block">{row.categories?.category_name || "—"}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[9px] uppercase font-mono">Reference</span>
                    <span className="text-neutral-300 font-mono truncate block">{row.reference_number || "—"}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[9px] uppercase font-mono">User</span>
                    <span className="text-neutral-300 font-mono truncate block">
                      {row.created_by ? (userProfilesMap[row.created_by] || row.created_by) : "—"}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/5 flex gap-2 items-center">
                  <span className="text-[10px] font-mono text-neutral-400 uppercase mr-1 shrink-0">Status:</span>
                  <select
                    value={selectedStatuses[row.id] || ""}
                    onChange={(e) => {
                      setSelectedStatuses(prev => ({
                        ...prev,
                        [row.id]: Number(e.target.value)
                      }));
                    }}
                    className="bg-[#121212] border border-white/10 text-neutral-200 text-xs rounded-lg px-2 py-1.5 flex-1 focus:outline-none focus:border-amber-500/50"
                  >
                    {statuses.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.display_name}
                      </option>
                    ))}
                  </select>
                  <button
                    disabled={updatingRowId === row.id || selectedStatuses[row.id] === row.status_id}
                    onClick={() => handleUpdateStatus(row.id)}
                    className="px-4 py-1.5 bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 disabled:opacity-40 text-amber-300 text-xs font-semibold rounded-lg shrink-0 cursor-pointer"
                  >
                    {updatingRowId === row.id ? (
                      <Coins className="h-4 w-4 animate-spin" />
                    ) : (
                      "Apply"
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ==================================================================== */}
      {/* INVOICE ACTIONS REGISTRY SECTION                                    */}
      {/* ==================================================================== */}
      <div className="rounded-2xl bg-[#1e2235]/50 backdrop-blur-xl border border-white/10 shadow-2xl p-6 relative mt-6">
        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent"></div>
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-4 border-b border-white/5 mb-4 gap-4">
          <div>
            <span className="text-[10px] font-mono tracking-widest text-amber-500 uppercase">Saved Invoices</span>
            <h2 className="text-sm font-semibold text-white mt-1">Invoice Actions Registry</h2>
          </div>
          {/* Search Bar */}
          <div className="relative w-full md:w-72">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="h-3.5 w-3.5 text-neutral-400" />
            </span>
            <input
              type="text"
              value={invoiceSearch}
              onChange={(e) => setInvoiceSearch(e.target.value)}
              placeholder="Search (date, staff, plate, route, amount)..."
              className="w-full bg-[#0c0c0c] border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs font-mono text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>
        </div>

        {invoiceError && (
          <div className="p-3 bg-red-950/20 border border-red-500/25 rounded-xl text-xs text-red-400 mb-4 font-mono">
            <strong>Error loading invoices: </strong> {invoiceError}
          </div>
        )}

        {/* Desktop View */}
        <div className="hidden lg:block overflow-x-auto custom-scrollbar">
          <div className="min-w-[1100px] space-y-2">
            {/* Headers */}
            <div className="grid grid-cols-[110px_1.2fr_1.5fr_1fr_1.2fr_120px_100px] gap-2 bg-neutral-900/40 text-[10px] font-mono uppercase tracking-wider text-neutral-400 px-3 py-2.5 rounded-xl border border-white/5">
              <div>Date</div>
              <div>Invoice Type</div>
              <div>Staff / Agent</div>
              <div>Bus / Plate</div>
              <div>Route Line</div>
              <div className="text-right">Gross Amount</div>
              <div className="text-center">Action</div>
            </div>

            {/* Invoices List with inner scroll */}
            <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {invoiceLoading ? (
                <div className="p-6 text-center font-mono text-[11px] animate-pulse uppercase text-neutral-400">
                  Resynchronizing invoice log items...
                </div>
              ) : invoices.length === 0 ? (
                <div className="p-6 text-center font-mono text-[11px] text-neutral-500">
                  No invoices retrieved
                </div>
              ) : invoices.filter(inv => {
                const q = invoiceSearch.toLowerCase().trim();
                if (!q) return true;
                const dStr = inv.invoice_date ? String(inv.invoice_date).toLowerCase() : "";
                const tStr = inv.invoice_types?.type_name ? String(inv.invoice_types.type_name).toLowerCase() : "";
                const sStr = inv.staffs?.full_name ? String(inv.staffs.full_name).toLowerCase() : "";
                const bStr = inv.buses?.plate_number ? String(inv.buses.plate_number).toLowerCase() : "";
                const rStr = inv.routes?.route_name ? String(inv.routes.route_name).toLowerCase() : "";
                const aStr = inv.gross_amount ? String(inv.gross_amount).toLowerCase() : "";
                return dStr.includes(q) || tStr.includes(q) || sStr.includes(q) || bStr.includes(q) || rStr.includes(q) || aStr.includes(q);
              }).length === 0 ? (
                <div className="p-6 text-center font-mono text-[11px] text-neutral-500">
                  No matches found for search query
                </div>
              ) : (
                invoices.filter(inv => {
                  const q = invoiceSearch.toLowerCase().trim();
                  if (!q) return true;
                  const dStr = inv.invoice_date ? String(inv.invoice_date).toLowerCase() : "";
                  const tStr = inv.invoice_types?.type_name ? String(inv.invoice_types.type_name).toLowerCase() : "";
                  const sStr = inv.staffs?.full_name ? String(inv.staffs.full_name).toLowerCase() : "";
                  const bStr = inv.buses?.plate_number ? String(inv.buses.plate_number).toLowerCase() : "";
                  const rStr = inv.routes?.route_name ? String(inv.routes.route_name).toLowerCase() : "";
                  const aStr = inv.gross_amount ? String(inv.gross_amount).toLowerCase() : "";
                  return dStr.includes(q) || tStr.includes(q) || sStr.includes(q) || bStr.includes(q) || rStr.includes(q) || aStr.includes(q);
                }).map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-[110px_1.2fr_1.5fr_1fr_1.2fr_120px_100px] gap-2 items-center p-2.5 rounded-xl border border-white/5 bg-neutral-950/20 hover:bg-neutral-900/40 transition-all font-sans text-neutral-300"
                  >
                    <div className="text-xs font-mono text-neutral-400">{row.invoice_date || "—"}</div>
                    <div className="text-xs font-medium text-white truncate">{row.invoice_types?.type_name || "—"}</div>
                    <div className="text-xs text-neutral-300 truncate">{row.staffs?.full_name || "—"}</div>
                    <div className="text-xs font-mono text-neutral-400 truncate">{row.buses?.plate_number || "—"}</div>
                    <div className="text-xs text-neutral-300 truncate">{row.routes?.route_name || "—"}</div>
                    <div className="text-xs font-mono font-medium text-right text-amber-400">{formatTZS(row.gross_amount)}</div>
                    <div className="flex justify-center">
                      <button
                        onClick={() => handleOpenEditModal(row)}
                        className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 text-amber-300 hover:text-white text-[10px] font-semibold rounded-lg flex items-center gap-1 cursor-pointer transition-all uppercase tracking-wider"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Mobile View */}
        <div className="block lg:hidden space-y-4 max-h-[480px] overflow-y-auto pr-1 custom-scrollbar">
          {invoiceLoading ? (
            <div className="p-6 text-center font-mono text-[11px] animate-pulse text-neutral-400">
              Resynchronizing invoice log items...
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-6 text-center font-mono text-[11px] text-neutral-500">
              No invoices retrieved
            </div>
          ) : invoices.filter(inv => {
            const q = invoiceSearch.toLowerCase().trim();
            if (!q) return true;
            const dStr = inv.invoice_date ? String(inv.invoice_date).toLowerCase() : "";
            const tStr = inv.invoice_types?.type_name ? String(inv.invoice_types.type_name).toLowerCase() : "";
            const sStr = inv.staffs?.full_name ? String(inv.staffs.full_name).toLowerCase() : "";
            const bStr = inv.buses?.plate_number ? String(inv.buses.plate_number).toLowerCase() : "";
            const rStr = inv.routes?.route_name ? String(inv.routes.route_name).toLowerCase() : "";
            const aStr = inv.gross_amount ? String(inv.gross_amount).toLowerCase() : "";
            return dStr.includes(q) || tStr.includes(q) || sStr.includes(q) || bStr.includes(q) || rStr.includes(q) || aStr.includes(q);
          }).length === 0 ? (
            <div className="p-6 text-center font-mono text-[11px] text-neutral-500">
              No matches found for search query
            </div>
          ) : (
            invoices.filter(inv => {
              const q = invoiceSearch.toLowerCase().trim();
              if (!q) return true;
              const dStr = inv.invoice_date ? String(inv.invoice_date).toLowerCase() : "";
              const tStr = inv.invoice_types?.type_name ? String(inv.invoice_types.type_name).toLowerCase() : "";
              const sStr = inv.staffs?.full_name ? String(inv.staffs.full_name).toLowerCase() : "";
              const bStr = inv.buses?.plate_number ? String(inv.buses.plate_number).toLowerCase() : "";
              const rStr = inv.routes?.route_name ? String(inv.routes.route_name).toLowerCase() : "";
              const aStr = inv.gross_amount ? String(inv.gross_amount).toLowerCase() : "";
              return dStr.includes(q) || tStr.includes(q) || sStr.includes(q) || bStr.includes(q) || rStr.includes(q) || aStr.includes(q);
            }).map((row) => (
              <div
                key={row.id}
                className="rounded-2xl bg-[#0c0c0c]/85 border border-white/5 p-4 space-y-3 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent"></div>
                
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[9px] font-mono text-amber-500/80 uppercase">
                      {row.invoice_types?.type_name || "Invoice"}
                    </span>
                    <h4 className="text-xs font-semibold text-white mt-0.5">
                      {row.staffs?.full_name || "—"}
                    </h4>
                  </div>
                  <span className="font-mono text-xs text-amber-400 font-bold">
                    {formatTZS(row.gross_amount)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2 border-t border-white/5 text-[11px]">
                  <div>
                    <span className="text-neutral-500 block text-[9px] uppercase font-mono">Date</span>
                    <span className="text-neutral-300 font-mono">{row.invoice_date || "—"}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[9px] uppercase font-mono">Bus / Plate</span>
                    <span className="text-neutral-300 font-mono truncate block">{row.buses?.plate_number || "—"}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-neutral-500 block text-[9px] uppercase font-mono">Route Line</span>
                    <span className="text-neutral-300 truncate block">{row.routes?.route_name || "—"}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/5 flex justify-end">
                  <button
                    onClick={() => handleOpenEditModal(row)}
                    className="px-4 py-1.5 bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 text-amber-300 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit Invoice
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* EDIT MODAL DIALOG                                                   */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {isEditModalOpen && selectedInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#151726] border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative z-10 text-neutral-300 flex flex-col max-h-[90vh]"
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"></div>
              
              <div className="flex justify-between items-center pb-4 border-b border-white/5 mb-4">
                <div>
                  <span className="text-[10px] font-mono tracking-widest text-amber-500 uppercase">Operation Worksheet</span>
                  <h3 className="text-base font-semibold text-white mt-1">Edit Selected Invoice Record</h3>
                </div>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="text-neutral-400 hover:text-white text-lg font-mono px-2 py-1 bg-white/5 hover:bg-white/10 rounded-lg cursor-pointer"
                >
                  ×
                </button>
              </div>

              {/* Error & Success indicators inside the modal */}
              {updateError && (
                <div className="p-3 bg-red-950/20 border border-red-500/20 rounded-xl text-xs text-red-400 mb-4 font-mono">
                  {updateError}
                </div>
              )}
              {updateSuccess && (
                <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 mb-4 font-mono animate-pulse">
                  {updateSuccess}
                </div>
              )}

              {/* Form inputs with custom lookups */}
              <div className="space-y-4 overflow-y-auto pr-1 flex-1 custom-scrollbar">
                {/* Date Input */}
                <div>
                  <label className="text-[10px] font-mono text-neutral-400 uppercase block mb-1">Invoice Date *</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full bg-[#0c0c0c] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-neutral-200 focus:outline-none focus:border-amber-500/50 font-mono"
                  />
                </div>

                {/* Type Selection */}
                <div>
                  <label className="text-[10px] font-mono text-neutral-400 uppercase block mb-1">Invoice Type *</label>
                  <select
                    value={editTypeId}
                    onChange={(e) => setEditTypeId(e.target.value)}
                    className="w-full bg-[#0c0c0c] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-neutral-200 focus:outline-none focus:focus:border-amber-500/50"
                  >
                    <option value="">-- Select Type --</option>
                    {(lookups?.invoiceTypes || []).map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                {/* Staff Selection */}
                <div>
                  <label className="text-[10px] font-mono text-neutral-400 uppercase block mb-1">Staff / Agent Member *</label>
                  <select
                    value={editStaffId}
                    onChange={(e) => setEditStaffId(e.target.value)}
                    className="w-full bg-[#0c0c0c] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-neutral-200 focus:outline-none focus:focus:border-amber-500/50"
                  >
                    <option value="">-- Select Staff --</option>
                    {(lookups?.staffs || []).map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* Bus plate selection (optional) */}
                <div>
                  <label className="text-[10px] font-mono text-neutral-400 uppercase block mb-1">Bus / Plate Number (Optional)</label>
                  <select
                    value={editBusId}
                    onChange={(e) => setEditBusId(e.target.value)}
                    className="w-full bg-[#0c0c0c] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-neutral-200 focus:outline-none focus:focus:border-amber-500/50 font-mono"
                  >
                    <option value="">-- None (Null) --</option>
                    {(lookups?.buses || []).map((b: any) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                {/* Route selection (optional) */}
                <div>
                  <label className="text-[10px] font-mono text-neutral-400 uppercase block mb-1">Route Line (Optional)</label>
                  <select
                    value={editRouteId}
                    onChange={(e) => setEditRouteId(e.target.value)}
                    className="w-full bg-[#0c0c0c] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-neutral-200 focus:outline-none focus:focus:border-amber-500/50"
                  >
                    <option value="">-- None (Null) --</option>
                    {(lookups?.routes || []).map((r: any) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                {/* Gross Amount */}
                <div>
                  <label className="text-[10px] font-mono text-neutral-400 uppercase block mb-1">Gross Amount (TZS) *</label>
                  <input
                    type="number"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    placeholder="Enter gross ledger amount..."
                    className="w-full bg-[#0c0c0c] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-neutral-200 focus:outline-none focus:border-amber-500/50 font-mono"
                  />
                  <p className="text-[10px] font-mono text-neutral-500 mt-1">
                    Value format standard matching DB limits.
                  </p>
                </div>
              </div>

              {/* Action Operations footer */}
              <div className="pt-4 border-t border-white/5 mt-6 flex justify-end gap-3 shrink-0 font-sans">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2.5 bg-neutral-900 border border-white/5 hover:bg-neutral-850 text-neutral-300 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={updatingInvoiceId !== null}
                  onClick={handleSaveInvoiceUpdate}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-black text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/10"
                >
                  {updatingInvoiceId !== null ? (
                    <>
                      <Coins className="h-3.5 w-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ========================================================================== */
/* VIEW COMPONENT 4: VIEW COMPONENT 4: MEMOS (Internal Finance Panel)         */
/* ========================================================================== */
function MemosView({ currentUserProfile, onMemosUpdated }: { currentUserProfile?: any; onMemosUpdated?: () => void }) {
  const [activeSubTab, setActiveSubTab] = useState<"inbox" | "sent">("inbox");
  const [inboxMemos, setInboxMemos] = useState<any[]>([]);
  const [sentMemos, setSentMemos] = useState<any[]>([]);
  const [userProfiles, setUserProfiles] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [selectedMemoId, setSelectedMemoId] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  
  // Compose Form states
  const [composeReceiverId, setComposeReceiverId] = useState<string>("");
  const [composeReceiverName, setComposeReceiverName] = useState<string>("");
  const [receiverSearchQuery, setReceiverSearchQuery] = useState<string>("");
  const [receiverDropdownOpen, setReceiverDropdownOpen] = useState(false);
  const [composeTitle, setComposeTitle] = useState("");
  const [composeMessage, setComposeMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Search filter for lists
  const [listSearchQuery, setListSearchQuery] = useState("");

  const currentProfileId = currentUserProfile?.id;

  // Retrieve Memos & Profiles
  const loadData = async () => {
    if (!currentProfileId) return;
    try {
      setLoading(true);
      const companyId = currentUserProfile?.company_id;
      
      // Fetch user profiles for compose dropdown
      let qProfiles = supabase.from("user_profiles").select("id, full_name").eq("is_active", true);
      if (companyId) {
        qProfiles = qProfiles.eq("company_id", companyId);
      }
      const { data: profiles, error: pErr } = await qProfiles;
      if (!pErr && profiles) {
        setUserProfiles(profiles);
      }

      // Fetch inbox memos (receiver_id = current profile id)
      let qInbox = supabase
        .from("memos")
        .select(`
          id,
          title,
          message,
          is_read,
          created_at,
          sender_id,
          receiver_id,
          sender:user_profiles!sender_id (id, full_name),
          receiver:user_profiles!receiver_id (id, full_name)
        `)
        .eq("receiver_id", currentProfileId);
      if (companyId) {
        qInbox = qInbox.eq("company_id", companyId);
      }
      const { data: inbox, error: iErr } = await qInbox.order("created_at", { ascending: false });

      if (iErr) throw iErr;
      if (inbox) setInboxMemos(inbox);

      // Fetch sent memos (sender_id = current profile id)
      let qSent = supabase
        .from("memos")
        .select(`
          id,
          title,
          message,
          is_read,
          created_at,
          sender_id,
          receiver_id,
          sender:user_profiles!sender_id (id, full_name),
          receiver:user_profiles!receiver_id (id, full_name)
        `)
        .eq("sender_id", currentProfileId);
      if (companyId) {
        qSent = qSent.eq("company_id", companyId);
      }
      const { data: sent, error: sErr } = await qSent.order("created_at", { ascending: false });

      if (sErr) throw sErr;
      if (sent) setSentMemos(sent);

    } catch (err: any) {
      console.error("Error loading memos data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentProfileId]);

  // Mark memo as read when selected
  const handleSelectMemo = async (memo: any) => {
    setSelectedMemoId(memo.id);
    setIsComposing(false);

    if (activeSubTab === "inbox" && !memo.is_read) {
      // Optimistic local state update to reduce latency
      setInboxMemos(prev =>
        prev.map(m => m.id === memo.id ? { ...m, is_read: true } : m)
      );

      try {
        await supabase
          .from("memos")
          .update({ is_read: true })
          .eq("id", memo.id);
        if (onMemosUpdated) onMemosUpdated();
      } catch (err) {
        console.error("Failed to mark memo as read in DB:", err);
      }
    }
  };

  const handleComposeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfileId) {
      setSubmitError("No authenticated company user profile detected. Please refresh.");
      return;
    }
    if (!composeReceiverId) {
      setSubmitError("Please select a receiver from the searchable listing.");
      return;
    }
    if (!composeTitle.trim()) {
      setSubmitError("Title is required.");
      return;
    }
    if (!composeMessage.trim()) {
      setSubmitError("Message is required.");
      return;
    }

    try {
      setSending(true);
      setSubmitError(null);
      setSubmitSuccess(null);

      const memoPayload: any = {
        sender_id: currentProfileId,
        receiver_id: composeReceiverId,
        title: composeTitle.trim(),
        message: composeMessage.trim(),
        is_read: false
      };
      if (currentUserProfile?.company_id) {
        memoPayload.company_id = currentUserProfile.company_id;
      }

      const { data, error } = await supabase
        .from("memos")
        .insert(memoPayload)
        .select();

      if (error) throw error;

      setSubmitSuccess("Memo dispatched and archived successfully.");
      
      // Reset inputs
      setComposeTitle("");
      setComposeMessage("");
      setComposeReceiverId("");
      setComposeReceiverName("");
      setReceiverSearchQuery("");

      // Reload sent list
      await loadData();
      
      // Auto switch to Sent tab to show dispatch
      setActiveSubTab("sent");
      setIsComposing(false);
      if (data && data[0]) {
        setSelectedMemoId(data[0].id);
      }

      setTimeout(() => setSubmitSuccess(null), 3000);

    } catch (err: any) {
      console.error("Failed to insert memo:", err);
      setSubmitError(err?.message || "An unexpected error occurred while sending.");
    } finally {
      setSending(false);
    }
  };

  const unreadCount = inboxMemos.filter(m => !m.is_read).length;
  const currentList = activeSubTab === "inbox" ? inboxMemos : sentMemos;

  const filteredMemos = currentList.filter(memo => {
    const term = listSearchQuery.toLowerCase();
    const otherPartyName = (activeSubTab === "inbox" 
      ? memo.sender?.full_name 
      : memo.receiver?.full_name) || "";
    return (
      memo.title?.toLowerCase().includes(term) ||
      memo.message?.toLowerCase().includes(term) ||
      otherPartyName.toLowerCase().includes(term)
    );
  });

  const selectedMemo = currentList.find(m => m.id === selectedMemoId);

  // Filter other profiles (exclude current user profile)
  const otherProfiles = userProfiles.filter(p => p.id !== currentProfileId);
  const filteredProfiles = otherProfiles.filter(p =>
    p.full_name?.toLowerCase().includes(receiverSearchQuery.toLowerCase())
  );

  const formatMemoDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (e) {
      return dateStr;
    }
  };

  if (loading && userProfiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] py-12">
        <Mail className="h-7 w-7 text-amber-500 animate-spin mb-3" />
        <span className="font-mono text-xs tracking-wider text-neutral-400">
          DECODING SECURE COMMUNICATIONS CHANNEL...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* HEADER INTEGRATED ALERTS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#0a0a0a]/80 border border-white/5 p-4 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-center text-amber-400">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Internal Memo Hub</h2>
            <p className="text-neutral-400 text-xs">Transmit audit logs, ledger directives, and announcements securely.</p>
          </div>
        </div>
        
        {unreadCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full animate-pulse">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
            <span className="text-[10px] font-mono text-amber-300 font-bold tracking-wider uppercase">
              {unreadCount} UNREAD DIRECTIVE{unreadCount > 1 ? "S" : ""}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* LEFT COLUMN: LIST FILTER & CARDS */}
        <div className="lg:col-span-1 space-y-4">
          
          <div className="rounded-2xl bg-[#0c0c0c]/80 border border-white/5 p-4 space-y-4 shadow-xl">
            
            {/* New Memo action button */}
            <button
              onClick={() => {
                setIsComposing(true);
                setSelectedMemoId(null);
                setSubmitSuccess(null);
                setSubmitError(null);
              }}
              className={`w-full py-2 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                isComposing
                  ? "bg-amber-500/20 border border-amber-500/40 text-amber-300"
                  : "bg-amber-500 border border-transparent hover:bg-amber-600 text-neutral-950 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
              }`}
            >
              <Plus className="h-4 w-4" />
              Compose New Memo
            </button>

            {/* Inbox / Sent Tab Pills */}
            <div className="grid grid-cols-2 gap-1 bg-neutral-900/60 p-1 rounded-xl border border-white/5">
              <button
                onClick={() => {
                  setActiveSubTab("inbox");
                  setIsComposing(false);
                  const firstInbox = inboxMemos[0];
                  setSelectedMemoId(firstInbox ? firstInbox.id : null);
                }}
                className={`py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeSubTab === "inbox"
                    ? "bg-[#141414] text-amber-400 border border-white/5"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <Inbox className="h-3.5 w-3.5" />
                <span>Inbox</span>
                {unreadCount > 0 && (
                  <span className="bg-amber-400/10 border border-amber-400/40 text-amber-400 font-mono text-[9px] px-1.5 py-0.5 rounded-full font-bold ml-0.5">
                    {unreadCount}
                  </span>
                )}
              </button>
              
              <button
                onClick={() => {
                  setActiveSubTab("sent");
                  setIsComposing(false);
                  const firstSent = sentMemos[0];
                  setSelectedMemoId(firstSent ? firstSent.id : null);
                }}
                className={`py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeSubTab === "sent"
                    ? "bg-[#141414] text-amber-400 border border-white/5"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <Send className="h-3.5 w-3.5" />
                <span>Sent</span>
              </button>
            </div>

            {/* Filter Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-500" />
              <input
                type="text"
                value={listSearchQuery}
                onChange={(e) => setListSearchQuery(e.target.value)}
                placeholder="Filter memos by writer or title..."
                className="w-full bg-[#121212] border border-white/5 rounded-xl py-2 pl-9 pr-4 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20"
              />
            </div>

          </div>

          {/* SCRIPT LIST OF MEMOS */}
          <div className="space-y-2 max-h-[480px] overflow-y-auto custom-scrollbar pr-1">
            {filteredMemos.length === 0 ? (
              <div className="text-center py-8 rounded-2xl bg-[#0c0c0c]/40 border border-white/5">
                <Mail className="h-6 w-6 text-neutral-600 mx-auto mb-2" />
                <p className="text-neutral-400 text-xs">No memos found.</p>
                {listSearchQuery && (
                  <button
                    onClick={() => setListSearchQuery("")}
                    className="text-[10px] text-amber-400/80 hover:underline mt-1 font-mono"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            ) : (
              filteredMemos.map((memo) => {
                const isSelected = memo.id === selectedMemoId;
                const isUnread = activeSubTab === "inbox" && !memo.is_read;
                const displayUser = activeSubTab === "inbox" 
                  ? memo.sender?.full_name || "Anonymous Staff"
                  : memo.receiver?.full_name || "Anonymous Staff";

                return (
                  <div
                    key={memo.id}
                    onClick={() => handleSelectMemo(memo)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer text-left relative overflow-hidden group ${
                      isSelected
                        ? "bg-[#101010]/95 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.06)]"
                        : isUnread
                        ? "bg-amber-500/5 border-amber-500/20 hover:border-amber-500/30"
                        : "bg-[#0c0c0c]/60 border-white/5 hover:border-white/10 hover:bg-[#101010]/30"
                    }`}
                  >
                    {isUnread && (
                      <span className="absolute top-3 right-3 h-2 w-2 rounded-full bg-amber-400 animate-pulse"></span>
                    )}

                    <div className="flex justify-between items-start mb-1 pr-4">
                      <span className={`text-[11px] truncate font-medium ${isUnread ? "text-amber-300" : "text-neutral-300"}`}>
                        {displayUser}
                      </span>
                      <span className="text-[9px] font-mono text-neutral-500 shrink-0">
                        {formatMemoDate(memo.created_at)}
                      </span>
                    </div>

                    <h4 className={`text-xs truncate ${isUnread ? "text-white font-semibold" : "text-neutral-200"}`}>
                      {memo.title}
                    </h4>
                    
                    <p className="text-[11px] text-neutral-400 line-clamp-1 mt-1 font-light leading-relaxed">
                      {memo.message}
                    </p>

                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/5 text-[9px] font-mono text-neutral-500">
                      <span>STATUS</span>
                      {activeSubTab === "inbox" ? (
                        isUnread ? (
                          <span className="text-amber-400 bg-amber-400/5 px-2 py-0.5 rounded border border-amber-400/20">UNREAD</span>
                        ) : (
                          <span className="text-neutral-500">READ</span>
                        )
                      ) : (
                        memo.is_read ? (
                          <span className="text-neutral-500">READ BY RECIPIENT</span>
                        ) : (
                          <span className="text-amber-300/80">DELIVERED</span>
                        )
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: PREVIEW OR COMPOSE FORM */}
        <div className="lg:col-span-2">
          
          {isComposing ? (
            
            /* COMPOSE FORM CASE */
            <form onSubmit={handleComposeSubmit} className="rounded-2xl bg-[#24283b]/60 backdrop-blur-xl border border-white/10 p-6 shadow-2xl relative space-y-4">
              <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent"></div>
              
              <div className="pb-3 border-b border-white/5 flex justify-between items-center">
                <div>
                  <span className="text-[9px] font-mono text-amber-500 uppercase tracking-widest">Create Messaging Directive</span>
                  <h3 className="text-sm font-semibold text-white mt-1">Compose Memo</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsComposing(false)}
                  className="text-xs text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>

              {/* Status feedback logs */}
              {submitError && (
                <div className="p-3 bg-red-950/20 border border-red-500/20 rounded-xl text-xs text-red-400 flex items-start gap-2.5 font-mono">
                  <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              {submitSuccess && (
                <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-start gap-2.5 font-mono animate-pulse">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{submitSuccess}</span>
                </div>
              )}

              {/* Recipient Selecor */}
              <div className="space-y-1.5 relative">
                <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block">
                  Select Recipient Profile *
                </label>
                
                {composeReceiverId ? (
                  <div className="flex justify-between items-center bg-[#141414] border border-amber-500/30 p-2.5 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 bg-amber-500/10 border border-amber-500/20 rounded flex items-center justify-center text-amber-400 font-mono text-xs">
                        U
                      </div>
                      <span className="text-xs font-semibold text-white">{composeReceiverName}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setComposeReceiverId("");
                        setComposeReceiverName("");
                        setReceiverSearchQuery("");
                      }}
                      className="text-[10px] font-mono text-red-400 hover:underline px-2"
                    >
                      Change Receiver
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-500" />
                      <input
                        type="text"
                        value={receiverSearchQuery}
                        onFocus={() => setReceiverDropdownOpen(true)}
                        onChange={(e) => {
                          setReceiverSearchQuery(e.target.value);
                          setReceiverDropdownOpen(true);
                        }}
                        placeholder="Search team member by name..."
                        className="w-full bg-[#121212] border border-white/5 rounded-xl py-2 pl-9 pr-4 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                    
                    {receiverDropdownOpen && (
                      <div className="absolute left-0 right-0 top-[100%] mt-1 bg-[#121212] border border-white/10 rounded-xl shadow-2xl max-h-[160px] overflow-y-auto z-50 p-1.5 space-y-1">
                        {filteredProfiles.length === 0 ? (
                          <div className="text-center py-3 text-neutral-500 text-[11px] font-mono">
                            No team members matched
                          </div>
                        ) : (
                          filteredProfiles.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setComposeReceiverId(p.id);
                                setComposeReceiverName(p.full_name);
                                setReceiverDropdownOpen(false);
                              }}
                              className="w-full text-left p-2 rounded-lg text-xs text-neutral-300 hover:bg-amber-500/10 hover:text-amber-300 transition-colors cursor-pointer"
                            >
                              {p.full_name}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Title input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block">
                  Memo Title *
                </label>
                <input
                  type="text"
                  required
                  value={composeTitle}
                  onChange={(e) => setComposeTitle(e.target.value)}
                  placeholder="Enter clear, concise heading..."
                  className="w-full bg-[#121212] border border-white/5 rounded-xl py-2 px-3.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20"
                />
              </div>

              {/* Message field */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block">
                  Detailed Message Body *
                </label>
                <textarea
                  required
                  rows={6}
                  value={composeMessage}
                  onChange={(e) => setComposeMessage(e.target.value)}
                  placeholder="Draft your announcement or accounting instruction here..."
                  className="w-full bg-[#121212] border border-white/5 rounded-xl py-2 px-3.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 resize-none font-light leading-relaxed"
                />
              </div>

              {/* Action buttons */}
              <div className="pt-2 flex justify-end gap-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsComposing(false)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-neutral-950 font-semibold text-xs rounded-xl flex items-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.15)] transition-all cursor-pointer"
                >
                  {sending ? (
                    <>
                      <Mail className="h-3.5 w-3.5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      Send Memo
                    </>
                  )}
                </button>
              </div>

            </form>

          ) : selectedMemo ? (
            
            /* MEMO DETAIL PREVIEW CASE */
            <div className="rounded-2xl bg-[#24283b]/60 backdrop-blur-xl border border-white/10 p-6 shadow-2xl relative space-y-6">
              <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent"></div>
              
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-white/5">
                <div>
                  <span className="text-[10px] font-mono tracking-wider text-amber-500/80 uppercase block">
                    {activeSubTab === "inbox" ? "Received Communication" : "Sent Communication"}
                  </span>
                  <h3 className="text-base font-semibold text-white mt-0.5">
                    {selectedMemo.title}
                  </h3>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] font-mono text-neutral-500 block">TIMESTAMP</span>
                  <span className="text-xs font-mono text-neutral-300 block font-light mt-0.5">
                    {formatMemoDate(selectedMemo.created_at)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-neutral-900/30 p-3.5 rounded-xl border border-white/5 text-xs">
                <div>
                  <span className="text-[9px] font-mono text-neutral-500 uppercase block">SENDER</span>
                  <span className="text-neutral-200 mt-0.5 block font-medium">
                    {selectedMemo.sender?.full_name || "Anonymous Staff"}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-mono text-neutral-500 uppercase block">RECIPIENT</span>
                  <span className="text-neutral-200 mt-0.5 block font-medium">
                    {selectedMemo.receiver?.full_name || "Anonymous Staff"}
                  </span>
                </div>
              </div>

              <div className="text-xs text-neutral-300 bg-[#070707] p-5 rounded-xl border border-white/5 space-y-4 font-light leading-relaxed whitespace-pre-wrap">
                {selectedMemo.message}
              </div>

              <div className="flex justify-between items-center text-[10px] font-mono text-neutral-500 pt-2">
                <span>DIGITAL SIGNATURE SECURED</span>
                <span className="text-emerald-400 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                  AUTHENTIC
                </span>
              </div>

            </div>

          ) : (
            
            /* ABSOLUTE EMPTY STATE */
            <div className="rounded-2xl bg-[#24283b]/60 backdrop-blur-xl border border-white/5 p-12 text-center flex flex-col items-center justify-center min-h-[350px] shadow-2xl relative">
              <div className="absolute top-4 left-4 flex gap-1.5">
                <div className="h-2 w-2 rounded-full bg-amber-500/20"></div>
                <div className="h-2 w-2 rounded-full bg-blue-500/10"></div>
              </div>

              <Mail className="h-12 w-12 text-amber-500/40 mb-4 animate-pulse" />
              <h3 className="text-base font-light text-white mb-2">Internal Communication Core</h3>
              <p className="text-xs text-neutral-400 font-light leading-relaxed max-w-sm mx-auto">
                Select a directive from the communication tabs on the left, or compose a new internal memo to dispatch instructions instantly.
              </p>
            </div>

          )}

        </div>

      </div>

    </div>
  );
}

/* ========================================================================== */
/* VIEW COMPONENT 5: REPORTS (Financial Document Generation)                  */
/* ========================================================================== */
interface ReportCol {
  key: string;
  label: string;
  type: "date" | "month" | "text" | "number";
  align: "left" | "right";
}

interface ReportDefinition {
  id: string;
  name: string;
  category: "Core Financial Reports" | "Performance Reports" | "Monthly Reports";
  view: string;
  columns: ReportCol[];
  layout: "portrait" | "landscape";
}

const CATEGORIES = [
  "Core Financial Reports",
  "Performance Reports",
  "Monthly Reports"
];

const REPORTS_CONFIG: ReportDefinition[] = [
  {
    id: "daily_buses",
    name: "Daily Buses",
    category: "Core Financial Reports",
    view: "v_daily_bus_operations",
    layout: "landscape",
    columns: [
      { key: "date", label: "Date", type: "date", align: "left" },
      { key: "conductor", label: "Conductor", type: "text", align: "left" },
      { key: "driver", label: "Driver", type: "text", align: "left" },
      { key: "bus", label: "Bus", type: "text", align: "left" },
      { key: "route", label: "Route", type: "text", align: "left" },
      { key: "one_way", label: "Oneway", type: "number", align: "right" },
      { key: "enroute", label: "Enroute", type: "number", align: "right" },
      { key: "total", label: "Total", type: "number", align: "right" },
      { key: "user_id", label: "User ID", type: "text", align: "left" }
    ]
  },
  {
    id: "invoice_report",
    name: "Invoice Report",
    category: "Core Financial Reports",
    view: "v_invoice_report",
    layout: "landscape",
    columns: [
      { key: "date", label: "Date", type: "date", align: "left" },
      { key: "invoice_type", label: "Invoice Type", type: "text", align: "left" },
      { key: "staff", label: "Staff", type: "text", align: "left" },
      { key: "bus", label: "Bus", type: "text", align: "left" },
      { key: "route", label: "Route", type: "text", align: "left" },
      { key: "invoice_amount", label: "Invoice Amount", type: "number", align: "right" },
      { key: "online", label: "Online", type: "number", align: "right" },
      { key: "cash", label: "Cashed", type: "number", align: "right" },
      { key: "bank", label: "Banked", type: "number", align: "right" },
      { key: "lipa_namba", label: "Lipa Number", type: "number", align: "right" },
      { key: "pending_amount", label: "Pending", type: "number", align: "right" },
      { key: "user_id", label: "User ID", type: "text", align: "left" }
    ]
  },
  {
    id: "trial_balance",
    name: "Trial Balance",
    category: "Core Financial Reports",
    view: "v_cash_trial_balance",
    layout: "landscape",
    columns: [
      { key: "date", label: "Date", type: "date", align: "left" },
      { key: "staff", label: "Staff", type: "text", align: "left" },
      { key: "bus", label: "Bus", type: "text", align: "left" },
      { key: "route", label: "Route", type: "text", align: "left" },
      { key: "account", label: "Account", type: "text", align: "left" },
      { key: "reference_number", label: "Reference", type: "text", align: "left" },
      { key: "debit_amount", label: "Debit", type: "number", align: "right" },
      { key: "credit_amount", label: "Credit", type: "number", align: "right" },
      { key: "user_id", label: "User ID", type: "text", align: "left" }
    ]
  },
  {
    id: "income_statement",
    name: "Income Statement",
    category: "Core Financial Reports",
    view: "v_income_statement",
    layout: "landscape",
    columns: [
      { key: "date", label: "Date", type: "date", align: "left" },
      { key: "staff", label: "Staff", type: "text", align: "left" },
      { key: "bus", label: "Bus", type: "text", align: "left" },
      { key: "route", label: "Route", type: "text", align: "left" },
      { key: "account", label: "Account", type: "text", align: "left" },
      { key: "nature", label: "Nature", type: "text", align: "left" },
      { key: "amount", label: "Amount", type: "number", align: "right" },
      { key: "net_profit", label: "Net Profit", type: "number", align: "right" },
      { key: "user_id", label: "User ID", type: "text", align: "left" }
    ]
  },
  {
    id: "balance_sheet",
    name: "Balance Sheet",
    category: "Core Financial Reports",
    view: "v_balance_sheet",
    layout: "portrait",
    columns: [
      { key: "account", label: "Account", type: "text", align: "left" },
      { key: "assets", label: "Assets", type: "number", align: "right" },
      { key: "financed_by", label: "Financed By", type: "number", align: "right" }
    ]
  },
  {
    id: "account_statement",
    name: "Account Statement",
    category: "Core Financial Reports",
    view: "v_account_statement",
    layout: "landscape",
    columns: [
      { key: "date", label: "Date", type: "date", align: "left" },
      { key: "staff", label: "Staff", type: "text", align: "left" },
      { key: "bus", label: "Bus", type: "text", align: "left" },
      { key: "route", label: "Route", type: "text", align: "left" },
      { key: "account", label: "Account", type: "text", align: "left" },
      { key: "reference", label: "Reference", type: "text", align: "left" },
      { key: "nature", label: "Nature", type: "text", align: "left" },
      { key: "amount", label: "Amount", type: "number", align: "right" },
      { key: "balance", label: "Balance", type: "number", align: "right" },
      { key: "user_id", label: "User ID", type: "text", align: "left" }
    ]
  },
  {
    id: "bus_performance",
    name: "Bus Performance",
    category: "Performance Reports",
    view: "v_bus_performance",
    layout: "portrait",
    columns: [
      { key: "month", label: "Month", type: "month", align: "left" },
      { key: "bus", label: "Bus", type: "text", align: "left" },
      { key: "income", label: "Income", type: "number", align: "right" }
    ]
  },
  {
    id: "staff_performance",
    name: "Staff Performance",
    category: "Performance Reports",
    view: "v_staff_performance",
    layout: "portrait",
    columns: [
      { key: "month", label: "Month", type: "month", align: "left" },
      { key: "staff", label: "Staff", type: "text", align: "left" },
      { key: "office", label: "Office", type: "text", align: "left" },
      { key: "income", label: "Income", type: "number", align: "right" }
    ]
  },
  {
    id: "staff_shortage",
    name: "Staff Shortage",
    category: "Performance Reports",
    view: "v_staff_shortage",
    layout: "portrait",
    columns: [
      { key: "staff_name", label: "Staff", type: "text", align: "left" },
      { key: "occupation", label: "Occupation", type: "text", align: "left" },
      { key: "office", label: "Office", type: "text", align: "left" },
      { key: "shortage", label: "Shortage", type: "number", align: "right" }
    ]
  },
  {
    id: "monthly_cargo_report",
    name: "Monthly Cargo Report",
    category: "Monthly Reports",
    view: "v_monthly_cargo_report",
    layout: "landscape",
    columns: [
      { key: "month", label: "Month", type: "month", align: "left" },
      { key: "staff", label: "Staff", type: "text", align: "left" },
      { key: "office", label: "Office", type: "text", align: "left" },
      { key: "invoice", label: "Invoice", type: "number", align: "right" },
      { key: "cash", label: "Cash", type: "number", align: "right" },
      { key: "bank", label: "Bank", type: "number", align: "right" },
      { key: "lipa_number", label: "Lipa Namba", type: "number", align: "right" },
      { key: "cargo_expenses", label: "Cargo Expenses", type: "number", align: "right" },
      { key: "cargo_errors", label: "Cargo Errors", type: "number", align: "right" },
      { key: "shortage", label: "Shortage", type: "number", align: "right" }
    ]
  },
  {
    id: "monthly_expenses_report",
    name: "Monthly Expenses Report",
    category: "Monthly Reports",
    view: "v_monthly_expenses_report",
    layout: "portrait",
    columns: [
      { key: "month", label: "Month", type: "month", align: "left" },
      { key: "account", label: "Account", type: "text", align: "left" },
      { key: "amount", label: "Amount", type: "number", align: "right" }
    ]
  },
  {
    id: "monthly_income_statement",
    name: "Monthly Income Statement",
    category: "Monthly Reports",
    view: "v_monthly_income_statement",
    layout: "portrait",
    columns: [
      { key: "month", label: "Month", type: "month", align: "left" },
      { key: "account", label: "Account", type: "text", align: "left" },
      { key: "nature", label: "Nature", type: "text", align: "left" },
      { key: "amount", label: "Amount", type: "number", align: "right" },
      { key: "cumulative_net_profit", label: "Cum-Net Profit", type: "number", align: "right" }
    ]
  },
  {
    id: "monthly_office_performance",
    name: "Monthly Office Performance",
    category: "Monthly Reports",
    view: "v_monthly_office_performance",
    layout: "landscape",
    columns: [
      { key: "month", label: "Month", type: "month", align: "left" },
      { key: "office", label: "Office", type: "text", align: "left" },
      { key: "bus_income", label: "Bus Income", type: "number", align: "right" },
      { key: "cargo_income", label: "Cargo Income", type: "number", align: "right" },
      { key: "other_income", label: "Other Income", type: "number", align: "right" },
      { key: "performance_percent", label: "Performance Percent", type: "number", align: "right" }
    ]
  }
];

function ReportsView({ currentUserProfile }: { currentUserProfile?: any }) {
  const [activeCategory, setActiveCategory] = useState<string>("Core Financial Reports");
  const [selectedReportId, setSelectedReportId] = useState<string>("invoice_report");
  const [companyName, setCompanyName] = useState<string>("Company Name");
  
  // Filters values state
  const [filters, setFilters] = useState<{
    date_from: string;
    date_to: string;
    month_from: string;
    month_to: string;
    min_amount: string;
    max_amount: string;
    textFilters: Record<string, string>;
  }>({
    date_from: "",
    date_to: "",
    month_from: "",
    month_to: "",
    min_amount: "",
    max_amount: "",
    textFilters: {}
  });

  const [isFiltered, setIsFiltered] = useState<boolean>(false);
  const [appliedFiltersTrigger, setAppliedFiltersTrigger] = useState<number>(0);

  const [reportData, setReportData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load Company Name from Supabase on mount
  useEffect(() => {
    async function fetchCompany() {
      try {
        const companyId = currentUserProfile?.company_id;
        if (!companyId) {
          setCompanyName("Company Name");
          return;
        }
        const { data, error: companyErr } = await supabase
          .from("companies")
          .select("*")
          .eq("id", companyId)
          .limit(1);
        if (companyErr) throw companyErr;
        if (data && data.length > 0) {
          setCompanyName(data[0].company_name || data[0].name || "Company Name");
        } else {
          setCompanyName("Company Name");
        }
      } catch (err) {
        console.error("Failed to load company name in Finance:", err);
        setCompanyName("Company Name");
      }
    }
    fetchCompany();
  }, [currentUserProfile]);

  // Reset filters whenever selectedReportId changes
  useEffect(() => {
    setFilters({
      date_from: "",
      date_to: "",
      month_from: "",
      month_to: "",
      min_amount: "",
      max_amount: "",
      textFilters: {}
    });
    setIsFiltered(false);
  }, [selectedReportId]);

  // Handle active report lookup
  const activeReport = React.useMemo(() => {
    return REPORTS_CONFIG.find(r => r.id === selectedReportId);
  }, [selectedReportId]);

  const hasActiveFilters = React.useMemo(() => {
    const flatFilters = {
      date_from: filters.date_from,
      date_to: filters.date_to,
      month_from: filters.month_from,
      month_to: filters.month_to,
      min_amount: filters.min_amount,
      max_amount: filters.max_amount,
      ...filters.textFilters
    };
    return isFiltered && Object.values(flatFilters).some(
      value =>
        value !== "" &&
        value !== null &&
        value !== undefined
    );
  }, [isFiltered, filters]);

  // Fetch report data on selection/filter triggers
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!activeReport) return;

      const activeCompanyId = currentUserProfile?.company_id;
      if (!activeCompanyId) {
        console.warn("[ReportsView] Exiting loadData because activeCompanyId is null/undefined");
        if (isMounted) {
          setReportData([]);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        let finalRows: any[] = [];
        let selectStr = "";
        const viewName = activeReport.view;

        const isAffectedReport = [
          "income_statement",
          "balance_sheet",
          "account_statement",
          "monthly_expenses_report",
          "monthly_income_statement",
          "daily_buses"
        ].includes(activeReport.id);

        if (isAffectedReport) {
          if (activeReport.id === "income_statement") {
            selectStr = "date,staff,bus,route,account,nature,amount,net_profit,user_id,company_id";
          } else if (activeReport.id === "balance_sheet") {
            selectStr = "account,assets,financed_by,company_id";
          } else if (activeReport.id === "account_statement") {
            selectStr = "date,staff,bus,route,account,reference,nature,amount,balance,user_id,company_id";
          } else if (activeReport.id === "monthly_expenses_report") {
            selectStr = "month,account,amount,company_id";
          } else if (activeReport.id === "monthly_income_statement") {
            selectStr = "month,account,nature,amount,cumulative_net_profit,company_id";
          } else if (activeReport.id === "daily_buses") {
            selectStr = "date,conductor,driver,bus,route,one_way,enroute,total,user_id,company_id";
          }
        }

        const columnsList = selectStr || activeReport.columns.map(c => c.key).join(",");

        if (!hasActiveFilters) {
          // No filters applied -> Limit = 100 rows, preview only
          let query = supabase.from(viewName).select(columnsList);
          
          const hasCompanyIdCol = isAffectedReport || activeReport.columns.some(c => c.key === "company_id");
          if (hasCompanyIdCol) {
            query = query.eq("company_id", activeCompanyId);
          }
          
          query = query.limit(100);

          const { data: fetchRes, error: fetchErr } = await query;
          if (fetchErr) {
            console.error(
              `Error loading report data in preview:\n` +
              `Report Name: ${activeReport.name}\n` +
              `View Name: ${viewName}\n` +
              `Error details:`, fetchErr
            );
            throw fetchErr;
          }
          finalRows = fetchRes || [];
        } else {
          // Filters applied -> fetch ALL matching rows using pagination loop internally
          const batchSize = 1000;
          let from = 0;
          let hasMore = true;

          while (hasMore) {
            let query = supabase.from(viewName).select(columnsList);

            const hasCompanyIdCol = isAffectedReport || activeReport.columns.some(c => c.key === "company_id");
            if (hasCompanyIdCol) {
              query = query.eq("company_id", activeCompanyId);
            }

            // Apply filters BEFORE range selection
            // 1. Date Range
            const hasDateCol = activeReport.columns.some(c => c.key === "date");
            if (hasDateCol) {
              if (filters.date_from) {
                query = query.gte("date", filters.date_from);
              }
              if (filters.date_to) {
                query = query.lte("date", filters.date_to);
              }
            }

            // 2. Month Range
            const hasMonthCol = activeReport.columns.some(c => c.key === "month");
            if (hasMonthCol) {
              if (filters.month_from) {
                query = query.gte("month", filters.month_from);
              }
              if (filters.month_to) {
                query = query.lte("month", filters.month_to);
              }
            }

            // 3. Text search
            if (filters.textFilters) {
              Object.entries(filters.textFilters).forEach(([colKey, textVal]) => {
                const colExists = activeReport.columns.some(c => c.key === colKey);
                if (colExists && colKey !== "user_id" && colKey !== "company_id" && colKey !== "company" && textVal) {
                  query = query.ilike(colKey, `%${textVal}%`);
                }
              });
            }

            // 4. Numeric Range
            const numCols = activeReport.columns.filter(c => c.type === "number");
            if (numCols.length > 0) {
              const firstNumKey = numCols[0].key;
              if (filters.min_amount) {
                query = query.gte(firstNumKey, Number(filters.min_amount));
              }
              if (filters.max_amount) {
                query = query.lte(firstNumKey, Number(filters.max_amount));
              }
            }

            const { data: batchData, error: batchErr } = await query.range(from, from + batchSize - 1);
            if (batchErr) {
              console.error(`Error loading report data in query loop:`, batchErr);
              throw batchErr;
            }

            if (!batchData || batchData.length === 0) {
              hasMore = false;
              break;
            }

            finalRows.push(...batchData);

            if (isMounted) {
              setReportData([...finalRows]);
            }

            if (batchData.length < batchSize) {
              hasMore = false;
            } else {
              from += batchSize;
            }
          }
        }

        if (isMounted) {
          setReportData(finalRows);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || String(err) || "Failed to load report view from database.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [selectedReportId, isFiltered, appliedFiltersTrigger, activeReport, currentUserProfile?.company_id, hasActiveFilters]);

  const formatTZS = (val: any) => {
    if (val === undefined || val === null || isNaN(Number(val))) return "TZS 0";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "TZS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(val)).replace("TZS", "TZS ");
  };

  const formatMonthName = (monthStr: string) => {
    if (!monthStr || !monthStr.includes("-")) return monthStr;
    const [year, month] = monthStr.split("-");
    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    const idx = Number(month) - 1;
    if (idx >= 0 && idx < 12) {
      return `${monthNames[idx]} ${year}`;
    }
    return monthStr;
  };

  // Memoize column calculations for sums safely
  const totals = React.useMemo(() => {
    if (!activeReport) return {};

    const numCols = activeReport.columns.filter(c => c.type === "number");
    const acc: Record<string, number> = {};
    
    numCols.forEach(col => {
      acc[col.key] = 0;
    });

    reportData.forEach(row => {
      if (!row) return;
      numCols.forEach(col => {
        const val = Number(row[col.key] || 0);
        if (!isNaN(val)) {
          acc[col.key] += val;
        }
      });
    });

    return acc;
  }, [activeReport, reportData]);

  // TanStack columns construction
  const columnsDef = React.useMemo(() => {
    if (!activeReport) return [];

    return activeReport.columns.map(col => ({
      accessorKey: col.key,
      header: col.label,
      cell: (info: any) => {
        const val = info.getValue();
        if (col.type === "number") {
          if (col.key.includes("percent") || col.key.includes("ratio")) {
            return <span className="font-mono">{val !== undefined && val !== null ? `${Number(val).toFixed(2)}%` : "0.00%"}</span>;
          }
          return <span className="font-mono">{formatTZS(val)}</span>;
        }
        if (col.type === "date" && val) {
          return <span className="font-mono">{String(val).split("T")[0]}</span>;
        }
        if (col.type === "month" && val) {
          return <span className="font-mono">{formatMonthName(String(val))}</span>;
        }
        return <span>{val === undefined || val === null ? "" : String(val)}</span>;
      },
    }));
  }, [activeReport]);

  const table = useReactTable({
    data: reportData,
    columns: columnsDef as any,
    getCoreRowModel: getCoreRowModel(),
  });

  // Excel Excel export
  const handleExportExcel = () => {
    if (!activeReport) return;

    const aoa: any[][] = [];

    // Metadata title lines
    aoa.push([companyName.toUpperCase()]);
    aoa.push([activeReport.name]);
    aoa.push([`Generated On: ${new Date().toLocaleDateString()}`]);

    // Filters overview
    const filterSummary: string[] = [];
    if (isFiltered) {
      if (filters.date_from) filterSummary.push(`Date From: ${filters.date_from}`);
      if (filters.date_to) filterSummary.push(`Date To: ${filters.date_to}`);
      if (filters.month_from) filterSummary.push(`Month From: ${filters.month_from}`);
      if (filters.month_to) filterSummary.push(`Month To: ${filters.month_to}`);
      if (filters.min_amount) filterSummary.push(`Min Amt: ${filters.min_amount}`);
      if (filters.max_amount) filterSummary.push(`Max Amt: ${filters.max_amount}`);
      
      Object.entries(filters.textFilters).forEach(([k, v]) => {
        if (v) filterSummary.push(`${k}: ${v}`);
      });
    }
    const filterText = filterSummary.length > 0 ? `Filters: ${filterSummary.join(" | ")}` : "Filters: None (100 Preview Rows)";
    aoa.push([filterText]);
    aoa.push([]); // separation blank line

    // Header values
    aoa.push(activeReport.columns.map(c => c.label));

    // Cell values
    reportData.forEach(row => {
      aoa.push(activeReport.columns.map(col => {
        const val = row[col.key];
        if (col.type === "number") {
          return val === undefined || val === null ? null : Number(val);
        }
        if (col.type === "date" && val) {
          return String(val).split("T")[0];
        }
        if (col.type === "month" && val) {
          return formatMonthName(String(val));
        }
        return val;
      }));
    });

    // Totals line
    const footerRow = activeReport.columns.map((col, idx) => {
      if (idx === 0) return "TOTAL";
      if (col.type === "number") {
        return totals[col.key] === undefined ? null : Number(totals[col.key]);
      }
      return "";
    });
    aoa.push(footerRow);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, `${activeReport.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  // PDF Export
  const handleExportPDF = () => {
    if (!activeReport) return;

    const doc = new jsPDF({
      orientation: activeReport.layout,
      unit: "mm",
      format: "a4"
    });

    // PDF title blocks
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(245, 158, 11); // Gold amber accent
    doc.text(companyName.toUpperCase(), 14, 15);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(150, 150, 150);
    doc.text(activeReport.name, 14, 21);

    // Filters summary
    const filterSummary: string[] = [];
    if (isFiltered) {
      if (filters.date_from) filterSummary.push(`Date From: ${filters.date_from}`);
      if (filters.date_to) filterSummary.push(`Date To: ${filters.date_to}`);
      if (filters.month_from) filterSummary.push(`Month From: ${filters.month_from}`);
      if (filters.month_to) filterSummary.push(`Month To: ${filters.month_to}`);
      if (filters.min_amount) filterSummary.push(`Min Amt: ${filters.min_amount}`);
      if (filters.max_amount) filterSummary.push(`Max Amt: ${filters.max_amount}`);
      
      Object.entries(filters.textFilters).forEach(([k, v]) => {
        if (v) filterSummary.push(`${k}: ${v}`);
      });
    }
    const filterText = filterSummary.length > 0 ? `Filters: ${filterSummary.join(" | ")}` : "Filters: None (First 100 Rows Preview)";
    
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(filterText, 14, 27);

    // Columns & headers
    const headers = activeReport.columns.map(c => c.label);
    const rows = reportData.map(row => {
      return activeReport.columns.map(col => {
        const val = row[col.key];
        if (col.type === "number") {
          if (col.key.includes("percent") || col.key.includes("ratio")) {
            return val !== undefined && val !== null ? `${Number(val).toFixed(2)}%` : "";
          }
          return formatTZS(val);
        }
        if (col.type === "date" && val) {
          return String(val).split("T")[0];
        }
        if (col.type === "month" && val) {
          return formatMonthName(String(val));
        }
        return val === undefined || val === null ? "" : String(val);
      });
    });

    // Custom Footer / totals
    const footerRow = activeReport.columns.map((col, idx) => {
      if (idx === 0) return "TOTAL";
      if (col.type === "number") {
        if (col.key.includes("percent") || col.key.includes("ratio")) return "";
        return formatTZS(totals[col.key]);
      }
      return "";
    });

    // Build PDF table with clean borders
    autoTable(doc, {
      startY: 32,
      head: [headers],
      body: rows,
      foot: [footerRow],
      theme: "grid",
      styles: {
        fontSize: activeReport.layout === "landscape" ? 7 : 8,
        cellPadding: 1.5,
      },
      headStyles: {
        fillColor: [30, 30, 30],
        textColor: [245, 158, 11], // Gold headers
        fontStyle: "bold"
      },
      footStyles: {
        fillColor: [18, 18, 18],
        textColor: [245, 158, 11], // Gold totals
        fontStyle: "bold"
      },
      columnStyles: activeReport.columns.reduce((acc, col, idx) => {
        acc[idx] = { halign: col.align === "right" ? "right" : "left" };
        return acc;
      }, {} as any),
    });

    doc.save(`${activeReport.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  if (!currentUserProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] py-12">
        <div className="relative flex flex-col items-center">
          <div className="absolute w-24 h-24 bg-amber-500/10 blur-[30px] rounded-full"></div>
          <Coins className="h-8 w-8 text-amber-500 animate-spin mb-4" />
          <span className="font-mono text-xs tracking-widest text-amber-500/80 animate-pulse">
            LOADING COMPANY CONTEXT...
          </span>
        </div>
      </div>
    );
  }

  const activeCompanyId = currentUserProfile.company_id;

  if (!activeCompanyId) {
    return (
      <div className="rounded-2xl bg-[#24283b]/60 border border-amber-500/10 p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
        <AlertTriangle className="h-10 w-10 text-amber-500 mb-3 animate-pulse" />
        <h3 className="text-base font-semibold text-white mb-2">Company Context</h3>
        <p className="text-xs text-neutral-400 max-w-md leading-relaxed">
          Company context not found.
        </p>
      </div>
    );
  }

  const hasDate = activeReport?.columns.some(c => c.type === "date" && c.key === "date");
  const hasMonth = activeReport?.columns.some(c => c.type === "month" && c.key === "month");
  const hasNumber = activeReport?.columns.some(c => c.type === "number");
  const textCols = activeReport?.columns.filter(c => c.type === "text" && c.key !== "user_id" && c.key !== "company_id" && c.key !== "company") || [];

  return (
    <div className="space-y-3.5">
      {/* 1. Header segment */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-white/5 pb-2 gap-2">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-amber-500 uppercase">Management Accounting</span>
          <h1 className="text-xl font-light text-white mt-0.5">Financial Report Center</h1>
        </div>
      </div>

      {/* 2. Categorized Tabs Selector */}
      <div className="flex gap-1.5 p-1 rounded-xl bg-neutral-900/40 border border-white/5 overflow-x-auto">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => {
              setActiveCategory(cat);
              const firstOfCat = REPORTS_CONFIG.find(r => r.category === cat);
              if (firstOfCat) {
                setSelectedReportId(firstOfCat.id);
              }
            }}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              activeCategory === cat
                ? "bg-[#141414] text-amber-400 border border-white/5 shadow-md"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            {cat === "Core Financial Reports" ? <FileText className="h-3.5 w-3.5" /> : cat === "Performance Reports" ? <TrendingUp className="h-3.5 w-3.5" /> : <Calendar className="h-3.5 w-3.5" />}
            {cat}
          </button>
        ))}
      </div>

      {/* 3. Grid of Report Cards inside Selected Category */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {REPORTS_CONFIG.filter(r => r.category === activeCategory).map(report => {
          const isActive = report.id === selectedReportId;
          return (
            <button
              key={report.id}
              onClick={() => setSelectedReportId(report.id)}
              className={`rounded-xl border text-left p-3 cursor-pointer transition-all ${
                isActive
                  ? "bg-[#101010]/95 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.06)] text-white"
                  : "bg-[#0c0c0c]/80 border-white/5 text-neutral-400 hover:border-white/10 hover:text-neutral-200"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div className={`h-7 w-7 rounded-md flex items-center justify-center border ${
                  isActive ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "bg-neutral-900 border-white/5 text-neutral-500"
                }`}>
                  <FileText className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider">{report.name}</h4>
                  <span className="text-[9px] font-mono text-neutral-500 block mt-0.5">{report.view} view</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 4. Filters Panel */}
      {activeReport && (
        <div className="rounded-2xl border border-white/5 bg-[#0c0c0c]/80 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <div className="flex items-center gap-2 text-neutral-300 font-mono text-xs font-medium">
              <Filter className="h-4 w-4 text-amber-500" />
              <span>DYNAMIC FILTERS: {activeReport.name}</span>
            </div>
            {isFiltered && (
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-0.5 rounded-lg font-mono animate-pulse">
                • Filter Criteria Enabled
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {hasDate && (
              <>
                <div>
                  <label className="block text-[10px] uppercase font-mono text-neutral-500 mb-1">From Date</label>
                  <input
                    type="date"
                    value={filters.date_from}
                    onChange={e => setFilters(prev => ({ ...prev, date_from: e.target.value }))}
                    className="w-full text-xs font-mono bg-neutral-900/60 border border-white/10 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-mono text-neutral-500 mb-1">To Date</label>
                  <input
                    type="date"
                    value={filters.date_to}
                    onChange={e => setFilters(prev => ({ ...prev, date_to: e.target.value }))}
                    className="w-full text-xs font-mono bg-neutral-900/60 border border-white/10 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </>
            )}

            {hasMonth && (
              <>
                <div>
                  <label className="block text-[10px] uppercase font-mono text-neutral-500 mb-1">From Month</label>
                  <input
                    type="month"
                    value={filters.month_from}
                    onChange={e => setFilters(prev => ({ ...prev, month_from: e.target.value }))}
                    className="w-full text-xs font-mono bg-neutral-900/60 border border-white/10 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-mono text-neutral-500 mb-1">To Month</label>
                  <input
                    type="month"
                    value={filters.month_to}
                    onChange={e => setFilters(prev => ({ ...prev, month_to: e.target.value }))}
                    className="w-full text-xs font-mono bg-neutral-900/60 border border-white/10 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </>
            )}

            {textCols.map(col => (
              <div key={col.key}>
                <label className="block text-[10px] uppercase font-mono text-neutral-500 mb-1">{col.label}</label>
                <input
                  type="text"
                  placeholder={`Search by ${col.label}...`}
                  value={filters.textFilters[col.key] || ""}
                  onChange={e => {
                    const val = e.target.value;
                    setFilters(prev => ({
                      ...prev,
                      textFilters: {
                        ...prev.textFilters,
                        [col.key]: val
                      }
                    }));
                  }}
                  className="w-full text-xs bg-neutral-900/60 border border-white/10 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500/50 font-sans"
                />
              </div>
            ))}

            {hasNumber && (
              <>
                <div>
                  <label className="block text-[10px] uppercase font-mono text-neutral-500 mb-1">Min Amount</label>
                  <input
                    type="number"
                    placeholder="Min Value (TZS)"
                    value={filters.min_amount}
                    onChange={e => setFilters(prev => ({ ...prev, min_amount: e.target.value }))}
                    className="w-full text-xs font-mono bg-neutral-900/60 border border-white/10 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-mono text-neutral-500 mb-1">Max Amount</label>
                  <input
                    type="number"
                    placeholder="Max Value (TZS)"
                    value={filters.max_amount}
                    onChange={e => setFilters(prev => ({ ...prev, max_amount: e.target.value }))}
                    className="w-full text-xs font-mono bg-neutral-900/60 border border-white/10 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setFilters({
                  date_from: "",
                  date_to: "",
                  month_from: "",
                  month_to: "",
                  min_amount: "",
                  max_amount: "",
                  textFilters: {}
                });
                setIsFiltered(false);
                setAppliedFiltersTrigger(prev => prev + 1);
              }}
              className="px-4 py-2 bg-[#121212]/80 border border-white/5 hover:bg-neutral-800 text-neutral-400 text-xs rounded-xl cursor-pointer font-mono"
            >
              Clear Filters
            </button>
            <button
              type="button"
              onClick={() => {
                setIsFiltered(true);
                setAppliedFiltersTrigger(prev => prev + 1);
              }}
              className="px-5 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-[#0c0c0c] font-bold text-xs rounded-xl cursor-pointer shadow-lg font-mono"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}

      {/* 5. Report Preview Canvas */}
      {activeReport && (
        <div className="rounded-2xl border border-white/5 bg-[#24283b]/65 backdrop-blur-xl p-6 space-y-6 shadow-2xl relative">
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent"></div>

          {/* Symmetrical Company Banner above preview */}
          <div className="text-center py-6 border border-white/5 relative bg-neutral-950/20 rounded-xl">
            <h2 className="text-lg font-semibold text-amber-400 uppercase tracking-widest font-serif">{companyName}</h2>
            <h3 className="text-xs font-light text-neutral-300 uppercase tracking-wider mt-1">{activeReport.name}</h3>
            <span className="text-[9px] font-mono text-neutral-500 mt-2 block uppercase">
              {hasActiveFilters ? `Showing ${reportData.length} filtered records` : "Preview Mode (100 rows)"}
            </span>
          </div>

          {/* Size & Download Control Segment */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-4 gap-4">
            <div className="text-xs font-mono text-neutral-400 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
              <span>RESULT SET: <strong className="text-amber-400">{reportData.length}</strong> record line(s) loaded</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleExportExcel}
                disabled={reportData.length === 0}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border rounded-xl font-mono cursor-pointer transition-colors ${
                  reportData.length === 0
                    ? "border-white/5 text-neutral-850 cursor-not-allowed bg-neutral-950/20"
                    : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/40"
                }`}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                EXCEL EXPORT
              </button>
              <button
                onClick={handleExportPDF}
                disabled={reportData.length === 0}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border rounded-xl font-mono cursor-pointer transition-colors ${
                  reportData.length === 0
                    ? "border-white/5 text-neutral-850 cursor-not-allowed bg-neutral-950/20"
                    : "border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500/40"
                }`}
              >
                <FileDown className="h-3.5 w-3.5" />
                PDF EXPORT
              </button>
            </div>
          </div>

          {/* Condition-Based Display Canvas */}
          {isLoading ? (
            <div className="py-20 text-center flex flex-col items-center justify-center min-h-[300px]">
              <Coins className="h-8 w-8 text-amber-500 mb-3 animate-spin" />
              <h4 className="text-sm font-medium text-neutral-300">
                {hasActiveFilters ? "Loading filtered records..." : "Compiling ledger database rows..."}
              </h4>
              {hasActiveFilters && reportData.length > 0 && (
                <p className="text-xs text-amber-400 font-mono mt-1 animate-pulse">
                  Loaded {reportData.length} records...
                </p>
              )}
              <p className="text-xs text-neutral-500 font-mono mt-1">Interrogating {activeReport.view} with selected rules.</p>
            </div>
          ) : error ? (
            <div className="py-16 text-center flex flex-col items-center justify-center min-h-[300px] border border-red-500/10 bg-red-500/5 rounded-xl">
              <AlertTriangle className="h-8 w-8 text-red-500 mb-3" />
              <h4 className="text-sm font-semibold text-red-400">Database Handshake Lost</h4>
              <p className="text-xs text-neutral-400 font-mono mt-1 max-w-sm mx-auto leading-relaxed">{error}</p>
            </div>
          ) : reportData.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center justify-center min-h-[300px] border border-white/5 rounded-xl bg-neutral-950/10">
              <FileText className="h-8 w-8 text-neutral-700 mb-3" />
              <h4 className="text-sm font-medium text-neutral-400">No records found for this report.</h4>
              <p className="text-xs text-neutral-500 font-mono mt-1">Try resetting or broadening your filter criteria query.</p>
            </div>
          ) : (
            /* TanStack Scroll Table Envelope */
            <div className="overflow-x-auto rounded-xl border border-white/10 custom-scrollbar max-h-[500px]">
              <table className="w-full text-xs text-left text-neutral-300 border-collapse table-auto">
                <thead className="text-[10px] uppercase font-mono tracking-wider text-amber-500 bg-neutral-900 sticky top-0 z-10 border-b border-white/5">
                  {table.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map(header => {
                        const idx = headerGroup.headers.indexOf(header);
                        const colMeta = activeReport.columns[idx];
                        const alignClass = colMeta?.align === "right" ? "text-right" : "text-left";
                        return (
                          <th
                            key={header.id}
                            className={`p-3 ${alignClass} font-semibold`}
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
                
                <tbody className="divide-y divide-white/5 bg-neutral-950/25">
                  {table.getRowModel().rows.map(row => (
                    <tr key={row.id} className="hover:bg-neutral-900/30 transition-colors">
                      {row.getVisibleCells().map(cell => {
                        const idx = row.getVisibleCells().indexOf(cell);
                        const colMeta = activeReport.columns[idx];
                        const alignClass = colMeta?.align === "right" ? "text-right" : "text-left";
                        return (
                          <td
                            key={cell.id}
                            className={`p-3 ${alignClass} font-light text-neutral-300`}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>

                {/* Totals Row */}
                <tfoot className="border-t-2 border-white/10 bg-[#121212]/95 text-[11px] font-mono font-bold text-amber-400 sticky bottom-0">
                  <tr>
                    {activeReport.columns.map((col, idx) => {
                      const alignClass = col.align === "right" ? "text-right" : "text-left";
                      if (idx === 0) {
                        return (
                          <td key={col.key} className="p-3 text-left uppercase tracking-widest text-[9px]">
                            Σ TOTALS
                          </td>
                        );
                      }
                      if (col.type === "number") {
                        if (col.key.includes("percent") || col.key.includes("ratio")) {
                          return <td key={col.key} className={`p-3 ${alignClass}`} />;
                        }
                        return (
                          <td key={col.key} className={`p-3 ${alignClass}`}>
                            {formatTZS(totals[col.key])}
                          </td>
                        );
                      }
                      return <td key={col.key} className="p-3" />;
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
