import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { supabase, resolveProfile, getActiveCompanyId } from "../lib/supabase";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line
} from "recharts";
import {
  LayoutDashboard,
  CheckCircle2,
  AlertTriangle,
  Mail,
  FileBarChart2,
  LineChart as LineIcon,
  LogOut,
  Calendar,
  Building,
  DollarSign,
  TrendingUp,
  SlidersHorizontal,
  ChevronRight,
  Sparkles,
  Inbox,
  Send,
  Plus,
  Trash,
  FileText,
  Search,
  Check,
  Percent,
  Bus,
  MapPin,
  Menu,
  X,
  ArrowLeft,
  ChevronLeft
} from "lucide-react";

// Types
interface ManagementPageProps {
  session: any;
  onLogout: () => void;
}

// -------------------------------------------------------------
// REPORT DEFINITIONS FROM RESPECTIVE COGNATE MODULES
// -------------------------------------------------------------
interface ReportCol {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "month";
  align?: "left" | "right" | "center";
}

interface ReportDefinition {
  id: string;
  name: string;
  category: string;
  view: string;
  layout: "portrait" | "landscape";
  columns: ReportCol[];
}

const FINANCE_REPORTS: ReportDefinition[] = [
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
      { key: "staff", label: "Staff", type: "text" },
      { key: "bus", label: "Bus", type: "text" },
      { key: "route", label: "Route", type: "text" },
      { key: "account", label: "Account", type: "text" },
      { key: "nature", label: "Nature", type: "text" },
      { key: "amount", label: "Amount", type: "number", align: "right" },
      { key: "net_profit", label: "Net Profit", type: "number", align: "right" },
      { key: "user_id", label: "User ID", type: "text" }
    ]
  },
  {
    id: "balance_sheet",
    name: "Balance Sheet",
    category: "Core Financial Reports",
    view: "v_balance_sheet",
    layout: "portrait",
    columns: [
      { key: "account", label: "Account", type: "text" },
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
      { key: "date", label: "Date", type: "date" },
      { key: "staff", label: "Staff", type: "text" },
      { key: "bus", label: "Bus", type: "text" },
      { key: "route", label: "Route", type: "text" },
      { key: "account", label: "Account", type: "text" },
      { key: "reference", label: "Reference", type: "text" },
      { key: "nature", label: "Nature", type: "text" },
      { key: "amount", label: "Amount", type: "number", align: "right" },
      { key: "balance", label: "Balance", type: "number", align: "right" },
      { key: "user_id", label: "User ID", type: "text" }
    ]
  },
  {
    id: "bus_performance",
    name: "Bus Performance",
    category: "Performance Reports",
    view: "v_bus_performance",
    layout: "portrait",
    columns: [
      { key: "month", label: "Month", type: "month" },
      { key: "bus", label: "Bus", type: "text" },
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
      { key: "month", label: "Month", type: "month" },
      { key: "staff", label: "Staff", type: "text" },
      { key: "office", label: "Office", type: "text" },
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
      { key: "staff_name", label: "Staff", type: "text" },
      { key: "occupation", label: "Occupation", type: "text" },
      { key: "office", label: "Office", type: "text" },
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
      { key: "month", label: "Month", type: "month" },
      { key: "staff", label: "Staff", type: "text" },
      { key: "office", label: "Office", type: "text" },
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
      { key: "month", label: "Month", type: "month" },
      { key: "account", label: "Account", type: "text" },
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
      { key: "month", label: "Month", type: "month" },
      { key: "account", label: "Account", type: "text" },
      { key: "nature", label: "Nature", type: "text" },
      { key: "amount", label: "Amount", type: "number", align: "right" },
      { key: "cumulative_net_profit", label: "Cum-Net Profit", type: "number", align: "right" }
    ]
  }
];

const OPERATIONS_REPORTS: ReportDefinition[] = [
  {
    id: "daily_buses",
    name: "Daily Buses",
    category: "Daily Reports",
    view: "v_daily_bus_operations",
    layout: "landscape",
    columns: [
      { key: "date", label: "Date", type: "date" },
      { key: "conductor", label: "Conductor", type: "text" },
      { key: "driver", label: "Driver", type: "text" },
      { key: "bus", label: "Bus", type: "text" },
      { key: "route", label: "Route", type: "text" },
      { key: "one_way", label: "Oneway", type: "number", align: "right" },
      { key: "enroute", label: "Enroute", type: "number", align: "right" },
      { key: "total", label: "Total", type: "number", align: "right" },
      { key: "user_id", label: "User ID", type: "text" }
    ]
  },
  {
    id: "bus_utilization",
    name: "Bus Utilization",
    category: "Daily Reports",
    view: "v_buses_utilization",
    layout: "landscape",
    columns: [
      { key: "date", label: "Date", type: "date" },
      { key: "bus", label: "Bus", type: "text" },
      { key: "route", label: "Route", type: "text" },
      { key: "seats", label: "Seats", type: "number", align: "right" },
      { key: "total_passengers", label: "Total Passengers", type: "number", align: "right" },
      { key: "utilization_percent", label: "Utilization Percent", type: "number", align: "right" },
      { key: "created_by_user", label: "User ID", type: "text" }
    ]
  },
  {
    id: "monthly_utilization",
    name: "Monthly Utilization",
    category: "Monthly Reports",
    view: "v_overall_monthly_utilization_average",
    layout: "portrait",
    columns: [
      { key: "month", label: "Month", type: "month" },
      { key: "average_utilization", label: "Average Utilization", type: "number", align: "right" }
    ]
  },
  {
    id: "bus_performance_ops",
    name: "Bus Performance",
    category: "Monthly Reports",
    view: "v_bus_performance",
    layout: "portrait",
    columns: [
      { key: "month", label: "Month", type: "month" },
      { key: "bus", label: "Bus", type: "text" },
      { key: "income", label: "Income", type: "number", align: "right" }
    ]
  },
  {
    id: "monthly_office_performance",
    name: "Monthly Office Performance",
    category: "Monthly Reports",
    view: "v_monthly_office_performance",
    layout: "landscape",
    columns: [
      { key: "month", label: "Month", type: "month" },
      { key: "office", label: "Office", type: "text" },
      { key: "bus_income", label: "Bus Income", type: "number", align: "right" },
      { key: "cargo_income", label: "Cargo Income", type: "number", align: "right" },
      { key: "other_income", label: "Other Income", type: "number", align: "right" },
      { key: "performance_percent", label: "Performance Percent", type: "number", align: "right" }
    ]
  },
  {
    id: "buses_details",
    name: "Buses Details",
    category: "Daily Reports",
    view: "v_buses_details",
    layout: "landscape",
    columns: [
      { key: "plate_number", label: "Plate Number", type: "text" },
      { key: "model", label: "Model", type: "text" },
      { key: "seating_capacity", label: "Seating Capacity", type: "number", align: "right" },
      { key: "purchase_date", label: "Purchase Date", type: "date" },
      { key: "status", label: "Status", type: "text", align: "center" }
    ]
  }
];

const HR_REPORTS: ReportDefinition[] = [
  {
    id: "payroll_statement",
    name: "Payroll Statement",
    category: "Payroll & Payments",
    view: "v_salary_statement",
    layout: "landscape",
    columns: [
      { key: "month", label: "Month", type: "month" },
      { key: "staff", label: "Staff", type: "text" },
      { key: "office", label: "Office", type: "text" },
      { key: "basic_salary", label: "Basic Salary", type: "number", align: "right" },
      { key: "allowances", label: "Allowances", type: "number", align: "right" },
      { key: "gross_salary", label: "Gross Salary", type: "number", align: "right" },
      { key: "deductions", label: "Deductions", type: "number", align: "right" },
      { key: "net_pay", label: "Net Pay", type: "number", align: "right" }
    ]
  },
  {
    id: "wages_report",
    name: "Wages Report",
    category: "Payroll & Payments",
    view: "v_monthly_wages_statement",
    layout: "portrait",
    columns: [
      { key: "month", label: "Month", type: "month" },
      { key: "staff", label: "Staff", type: "text" },
      { key: "office", label: "Office", type: "text" },
      { key: "amount", label: "Amount", type: "number", align: "right" }
    ]
  },
  {
    id: "total_monthly_staff_payment",
    name: "Total Monthly Staff Payment",
    category: "Payroll & Payments",
    view: "v_total_payment_to_staff",
    layout: "landscape",
    columns: [
      { key: "month", label: "Month", type: "month" },
      { key: "staff", label: "Staff", type: "text" },
      { key: "office", label: "Office", type: "text" },
      { key: "occupation", label: "Occupation", type: "text" },
      { key: "net_pay", label: "Net Pay", type: "number", align: "right" },
      { key: "total_wages", label: "Total Wages", type: "number", align: "right" },
      { key: "total_paid", label: "Total Paid", type: "number", align: "right" }
    ]
  },
  {
    id: "staff_performance_hr",
    name: "Staff Performance",
    category: "Performance & Shortages",
    view: "v_staff_performance",
    layout: "portrait",
    columns: [
      { key: "month", label: "Month", type: "month" },
      { key: "staff", label: "Staff", type: "text" },
      { key: "office", label: "Office", type: "text" },
      { key: "income", label: "Income", type: "number", align: "right" }
    ]
  },
  {
    id: "staff_shortages_hr",
    name: "Staff Shortages",
    category: "Performance & Shortages",
    view: "v_staff_shortage",
    layout: "portrait",
    columns: [
      { key: "staff_name", label: "Staff Name", type: "text" },
      { key: "occupation", label: "Occupation", type: "text" },
      { key: "office", label: "Office", type: "text" },
      { key: "shortage", label: "Shortage", type: "number", align: "right" }
    ]
  },
  {
    id: "staff_details",
    name: "Staff Details",
    category: "Staff Master Data",
    view: "v_staff_details",
    layout: "landscape",
    columns: [
      { key: "full_name", label: "Full Name", type: "text" },
      { key: "office", label: "Office", type: "text" },
      { key: "occupation", label: "Occupation", type: "text" },
      { key: "phone_number", label: "Phone Number", type: "text" },
      { key: "account_number", label: "Account Number", type: "text" },
      { key: "nida_number", label: "NIDA Number", type: "text" },
      { key: "address", label: "Address", type: "text" },
      { key: "employment_date", label: "Employment Date", type: "date" },
      { key: "status", label: "Status", type: "text", align: "center" }
    ]
  }
];

// Helper to determine TZS formatting
const formatMoney = (val: any) => {
  if (val === undefined || val === null || isNaN(Number(val))) return "0 TZS";
  return Math.round(Number(val)).toLocaleString("en-US") + " TZS";
};

// Main ManagementPage Entry Point
export default function ManagementPage({ session, onLogout }: ManagementPageProps) {
  const [activeTab, setActiveTab] = useState<"dashboard" | "actions" | "memos" | "reports" | "analysis">("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [currentUserRoleName, setCurrentUserRoleName] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("Company Name");
  const [loadingProfile, setLoadingProfile] = useState(true);

  // 1. Load User profiles, roles, company name
  useEffect(() => {
    let isMounted = true;
    async function fetchUserProfile() {
      const uId = session?.user?.id || session?.id;
      if (!uId) return;
      try {
        setLoadingProfile(true);
        const profile = await resolveProfile(uId);
        if (profile) {
          const activeCompanyId = getActiveCompanyId(profile);
          profile.company_id = activeCompanyId;
          if (isMounted) setCurrentUserProfile(profile);

          // Get role_name
          if (profile.role_id) {
            const { data: rData } = await supabase
              .from("roles")
              .select("role_name")
              .eq("id", profile.role_id)
              .single();
            if (rData && isMounted) {
              setCurrentUserRoleName(rData.role_name || "Manager");
            }
          }

          // Fetch company details
          if (profile.company_id) {
            const { data: cData } = await supabase
              .from("companies")
              .select("*")
              .eq("id", profile.company_id)
              .limit(1);
            if (cData && cData.length > 0 && isMounted) {
              setCompanyName(cData[0].company_name || cData[0].name || "Company Name");
            }
          }
        }
      } catch (err) {
        console.error("Error loading user profile in Management:", err);
      } finally {
        if (isMounted) setLoadingProfile(false);
      }
    }
    fetchUserProfile();
    return () => {
      isMounted = false;
    };
  }, [session]);

  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
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
      console.error("Error fetching unread memos count in Management:", err);
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
      console.error("Error fetching pending approvals count in Management:", err);
    }
  };

  useEffect(() => {
    if (currentUserProfile) {
      fetchUnreadMemosCount();
      fetchPendingApprovalsCount();
    }
  }, [currentUserProfile, activeTab]);

  const fiscalYear = useMemo(() => {
    const year = new Date().getFullYear();
    return `FY ${year}/${year + 1}`;
  }, []);

  const navItems = [
    { id: "dashboard", label: "Boardroom Dashboard", icon: LayoutDashboard },
    { id: "actions", label: "Executive Actions", icon: CheckCircle2 },
    { id: "memos", label: "Memos & Inbox", icon: Mail },
    { id: "reports", label: "Departmental Reports", icon: FileBarChart2 },
    { id: "analysis", label: "Business Analysis", icon: LineIcon }
  ];

  return (
    <div className="relative min-h-screen management-animated-bg text-neutral-200 font-sans flex overflow-hidden">
      
      {/* BACKGROUND DECORATIONS (Gold & Deep Amber Subtle Ambient Lighting) */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-gradient-to-tr from-orange-600/24 to-orange-500/10 blur-[165px] rounded-full pointer-events-none animate-float-1"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-gradient-to-bl from-amber-500/22 to-yellow-500/10 blur-[165px] rounded-full pointer-events-none animate-float-2"></div>
      <div className="absolute top-[25%] left-[25%] w-[45%] h-[45%] bg-gradient-to-tr from-amber-600/18 to-orange-500/5 blur-[180px] rounded-full pointer-events-none animate-pulse"></div>

      {/* Mobile/Tablet Backdrop overlay when sidebar is open */}
      {!isSidebarCollapsed && (
        <div 
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setIsSidebarCollapsed(true)}
        />
      )}

      {/* SIDEBAR NAVIGATION */}
      <motion.aside
        id="management-sidebar"
        animate={{ width: isSidebarCollapsed ? "80px" : "280px" }}
        transition={{ duration: 0.3 }}
        className={`fixed md:relative inset-y-0 left-0 z-30 shrink-0 border-r border-amber-500/10 bg-[#090b11]/95 md:bg-slate-900/60 backdrop-blur-xl flex flex-col justify-between overflow-hidden ${isSidebarCollapsed ? "hidden md:flex" : "flex"}`}
      >
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
                    <Building className="h-4 w-4 text-amber-400 group-hover:rotate-12 transition-transform duration-300" />
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
                  <Building className="h-4 w-4 text-amber-400" />
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
            <div className="px-2.5 py-3 bg-amber-950/10 border border-amber-500/10 rounded-xl">
              <span className="text-[8px] font-mono uppercase tracking-[0.2em] text-amber-500/50 block mb-0.5">
                Administration
              </span>
              <div className="text-xs font-serif font-semibold text-neutral-350 truncate">
                {companyName}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Nav Option Loops */}
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
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full flex items-center justify-between rounded-xl p-3 text-xs tracking-wide transition-all duration-300 relative group cursor-pointer ${
                  isActive
                    ? "bg-gradient-to-r from-amber-950/40 to-amber-900/10 border border-amber-500/30 text-amber-300 shadow-[0_0_15px_rgba(217,119,6,0.05)]"
                    : "hover:bg-neutral-900/55 border border-transparent text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <div className="flex items-center flex-1">
                  <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? "text-amber-400" : "text-neutral-400 group-hover:text-amber-450"} ${isSidebarCollapsed ? "mx-auto" : "mr-3"}`} />
                  
                  {!isSidebarCollapsed && (
                    <span className="font-serif font-medium tracking-wide transition-colors">{item.label}</span>
                  )}
                </div>

                {!isSidebarCollapsed && badgeCount !== undefined && (
                  <span className="bg-[#1e0e05] text-amber-450 border border-orange-500/35 shadow-[0_0_8px_rgba(249,115,22,0.22)] animate-pulse font-mono text-[9px] px-1.5 py-0.5 rounded-full scale-90 shrink-0">
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
            className="w-full flex items-center justify-center rounded-xl border border-white/5 bg-neutral-950 hover:border-amber-500/30 text-xs text-neutral-450 hover:text-amber-400 p-3 transition-all duration-300 group cursor-pointer"
          >
            <ArrowLeft className={`h-4 w-4 shrink-0 ${isSidebarCollapsed ? "mx-auto" : "mr-2 group-hover:-translate-x-0.5 transition-transform"}`} />
            {!isSidebarCollapsed && <span className="font-medium">Modules Menu</span>}
          </button>

          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="w-full flex items-center justify-center rounded-xl border border-white/5 bg-neutral-950 hover:border-amber-500/30 text-xs text-neutral-450 hover:text-amber-400 p-3 transition-all duration-300 cursor-pointer"
          >
            <ChevronLeft className={`h-4 w-4 shrink-0 transition-transform duration-300 ${isSidebarCollapsed ? "rotate-180 mx-auto" : "mr-2"}`} />
            {!isSidebarCollapsed && <span className="font-medium">Collapse Sidebar</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main content wrapper */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        
        {/* Top Header Panel */}
        <header className="border-b border-white/5 bg-[#090909]/45 backdrop-blur-md px-6 py-4 flex flex-row justify-between items-center gap-4 z-10 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-2 rounded-xl border border-white/10 hover:bg-neutral-800 text-neutral-400 hover:text-orange-400 md:hidden cursor-pointer shrink-0"
              title="Toggle Sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs uppercase font-mono tracking-[0.25em] bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent font-bold">
                {currentUserProfile?.company_name || companyName || "Company Name"}
              </span>
              <h2 className="text-xl md:text-2xl font-serif font-black tracking-wide bg-gradient-to-r from-white via-neutral-100 to-orange-400 bg-clip-text text-transparent uppercase leading-none">
                Management
              </h2>
            </div>
          </div>

          {/* Right corner User Info */}
          <div className="flex items-center gap-5 font-mono text-neutral-400 text-xs">
            {/* Fiscal Year Info */}
            <div className="flex items-center gap-2 bg-neutral-950/40 border border-white/5 rounded-full px-3 py-1 text-[11px] font-medium leading-none">
              <Calendar className="h-3 w-3 text-neutral-500" />
              <span>{fiscalYear}</span>
            </div>

            {/* Profile Info matching requirements */}
            <div className="flex flex-col text-right leading-none">
              <span className="text-xs font-serif font-bold text-white leading-none">
                {currentUserProfile?.full_name || "Executive Boardroom"}
              </span>
              <span className="text-[9px] font-mono text-amber-500 uppercase tracking-widest leading-none mt-1">
                {currentUserRoleName}
              </span>
            </div>

            <button
              onClick={onLogout}
              className="p-1.5 border border-white/5 rounded-lg hover:border-amber-500/30 hover:bg-amber-500/5 text-neutral-400 hover:text-amber-400 transition-all cursor-pointer"
              title="Secure Logout"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </header>

        {/* Dynamic section main area with standard shell scrolling */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-6 text-neutral-150">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              {activeTab === "dashboard" && <DashboardSection currentUserProfile={currentUserProfile} />}
              {activeTab === "actions" && <ActionsSection currentUserProfile={currentUserProfile} onApprovalsUpdated={fetchPendingApprovalsCount} />}
              {activeTab === "memos" && <MemosSection currentUserProfile={currentUserProfile} onMemosUpdated={fetchUnreadMemosCount} />}
              {activeTab === "reports" && <ReportsSection currentUserProfile={currentUserProfile} companyName={companyName} />}
              {activeTab === "analysis" && <AnalysisSection currentUserProfile={currentUserProfile} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

// =============================================================================
// SUB-SECTION 1: MANAGERIAL DASHBOARD
// =============================================================================
function DashboardSection({ currentUserProfile }: { currentUserProfile?: any }) {
  const [loading, setLoading] = useState(true);
  const [totalPending, setTotalPending] = useState<number>(0);
  const [totalBusesToday, setTotalBusesToday] = useState<number>(0);
  const [financialMonthData, setFinancialMonthData] = useState<{ total_income: number; total_expenses: number } | null>(null);
  const [utilizationList, setUtilizationList] = useState<Array<{ bus: string; percent: number }>>([]);

  // Trend Chart State Arrays
  const [incomeExpenseData, setIncomeExpenseData] = useState<any[]>([]);
  const [utilTrendData, setUtilTrendData] = useState<any[]>([]);
  const [salaryWagesData, setSalaryWagesData] = useState<any[]>([]);
  const [chartSelector, setChartSelector] = useState<"fin" | "util" | "wages">("fin");

  // Dynamic Year-Month matching
  const currentMonthStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  useEffect(() => {
    if (!currentUserProfile) return;
    let isMounted = true;

    async function metrics() {
      try {
        setLoading(true);
        
        const isSuperUser = currentUserProfile?.company_name === "Meqk Foundation";
        let activeCompanyId: string | null = null;
        if (isSuperUser) {
          const selected = localStorage.getItem("meqk_active_company_id");
          if (selected && selected !== "all") {
            activeCompanyId = selected;
          }
        } else {
          activeCompanyId = currentUserProfile?.company_id || null;
        }

        // CARD 1 & CARD 3 - v_monthly_financial_dashboard
        let qFin = supabase.from("v_monthly_financial_dashboard").select("*").eq("month", currentMonthStr);
        if (activeCompanyId) {
          qFin = qFin.eq("company_id", activeCompanyId);
        }
        const { data: finDataList } = await qFin;
        
        let totalIncomeSum = 0;
        let totalExpensesSum = 0;
        let totalPendingSum = 0;

        if (finDataList && finDataList.length > 0) {
          finDataList.forEach((row: any) => {
            totalIncomeSum += Number(row.total_income) || 0;
            totalExpensesSum += Number(row.total_expenses) || 0;
            totalPendingSum += Number(row.total_pending) || 0;
          });
          if (isMounted) {
            setTotalPending(totalPendingSum);
            setFinancialMonthData({
              total_income: totalIncomeSum,
              total_expenses: totalExpensesSum
            });
          }
        } else {
          if (isMounted) {
            setTotalPending(0);
            setFinancialMonthData({
              total_income: 0,
              total_expenses: 0
            });
          }
        }

        // CARD 2 & CARD 4 - v_operational_dashboard
        let qOps = supabase.from("v_operational_dashboard").select("*");
        if (activeCompanyId) {
          qOps = qOps.eq("company_id", activeCompanyId);
        }
        const { data: opsData } = await qOps;

        let totalBusesSum = 0;
        let mergedUtilization: any[] = [];

        if (opsData && opsData.length > 0) {
          opsData.forEach((item: any) => {
            totalBusesSum += item.total_buses_today || 0;
            if (item.top_three_utilization) {
              try {
                const parsed = typeof item.top_three_utilization === "string" 
                  ? JSON.parse(item.top_three_utilization)
                  : item.top_three_utilization;
                if (Array.isArray(parsed)) {
                  mergedUtilization = [...mergedUtilization, ...parsed];
                }
              } catch (e) {
                console.error("JSON parse failed for top_three_utilization:", e);
              }
            }
          });
          
          const topThree = mergedUtilization
            .map((u: any) => ({
              bus: u.bus || u.bus_name || "",
              percent: u.percent || u.utilization_rate || 0
            }))
            .filter(u => u.bus)
            .sort((a, b) => b.percent - a.percent)
            .slice(0, 3);

          if (isMounted) {
            setTotalBusesToday(totalBusesSum);
            setUtilizationList(topThree);
          }
        } else {
          if (isMounted) {
            setTotalBusesToday(0);
            setUtilizationList([]);
          }
        }

        // Fetch Graph Trend 1: Income vs Expenses
        let qTrendFin = supabase.from("v_monthly_financial_dashboard").select("*").order("month", { ascending: true });
        if (activeCompanyId) {
          qTrendFin = qTrendFin.eq("company_id", activeCompanyId);
        }
        const { data: trendFinRes } = await qTrendFin;
        if (trendFinRes && isMounted) {
          const map: { [month: string]: any } = {};
          trendFinRes.forEach((row) => {
            const m = row.month;
            if (!map[m]) {
              map[m] = { ...row, total_income: 0, total_expenses: 0, total_pending: 0 };
            }
            map[m].total_income += Number(row.total_income) || 0;
            map[m].total_expenses += Number(row.total_expenses) || 0;
            map[m].total_pending += Number(row.total_pending) || 0;
          });
          const aggregatedTrendFin = Object.values(map).sort((a: any, b: any) => a.month.localeCompare(b.month));
          setIncomeExpenseData(aggregatedTrendFin);
        } else if (isMounted) {
          setIncomeExpenseData([]);
        }

        // Fetch Graph Trend 2: Utilization Over Months
        let qTrendUtil = supabase.from("v_overall_monthly_utilization_average").select("*").order("month", { ascending: true });
        if (activeCompanyId) {
          qTrendUtil = qTrendUtil.eq("company_id", activeCompanyId);
        }
        const { data: trendUtilRes } = await qTrendUtil;
        if (trendUtilRes && isMounted) {
          const map: { [month: string]: { count: number; total: number; row: any } } = {};
          trendUtilRes.forEach((row) => {
            const m = row.month;
            if (!map[m]) {
              map[m] = { count: 0, total: 0, row: { ...row } };
            }
            map[m].count += 1;
            const val = Number(row.utilization_average !== undefined ? row.utilization_average : (row.avg_utilization || 0));
            map[m].total += val;
          });
          const aggregatedTrendUtil = Object.values(map).map(entry => {
            const avg = entry.count > 0 ? parseFloat((entry.total / entry.count).toFixed(2)) : 0;
            return {
              ...entry.row,
              utilization_average: avg,
              avg_utilization: avg
            };
          }).sort((a: any, b: any) => a.month.localeCompare(b.month));
          setUtilTrendData(aggregatedTrendUtil);
        } else if (isMounted) {
          setUtilTrendData([]);
        }

        // Fetch Graph Trend 3: Wages trend filtered by 'Wages'
        let qTrendWages = supabase.from("v_monthly_expenses_report").select("*").eq("account", "Wages");
        
        let hasCompanyId = false;
        try {
          const { data: testRow } = await supabase.from("v_monthly_expenses_report").select("*").limit(1);
          hasCompanyId = !!(testRow && testRow.length > 0 && ("company_id" in testRow[0]));
        } catch (e) {
          console.log("No company_id checked dynamically:", e);
        }

        if (hasCompanyId && activeCompanyId) {
          qTrendWages = qTrendWages.eq("company_id", activeCompanyId);
        }
        
        const { data: trendWagesRes } = await qTrendWages.order("month", { ascending: true });
        if (trendWagesRes && isMounted) {
          const wagesMap: { [month: string]: any } = {};
          trendWagesRes.forEach((row) => {
            const m = row.month;
            if (!wagesMap[m]) {
              wagesMap[m] = { ...row, amount: 0 };
            }
            wagesMap[m].amount += Number(row.amount) || 0;
          });
          const aggregatedWages = Object.values(wagesMap).sort((a: any, b: any) => a.month.localeCompare(b.month));
          setSalaryWagesData(aggregatedWages);
        } else if (isMounted) {
          setSalaryWagesData([]);
        }

      } catch (e) {
        console.error("Error rendering executive overview:", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    metrics();
    return () => {
      isMounted = false;
    };
  }, [currentUserProfile, currentMonthStr]);

  // Income Statement calculations
  const totalIncome = financialMonthData?.total_income || 0;
  const totalExpenses = financialMonthData?.total_expenses || 0;
  const netProfit = totalIncome - totalExpenses;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin h-9 w-9 border-t-2 border-amber-500 border-r-2 border-transparent rounded-full mb-3"></div>
        <p className="text-xs font-mono tracking-widest text-[#d97706]/70 uppercase animate-pulse">
          Retrieving executive metrics scorecard...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in relative z-25">
      
      {/* SECTION 1 SCORECARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card 1: Total Pending */}
        <div className="rounded-2xl border border-amber-500/15 bg-zinc-900/45 p-5 backdrop-blur-xl relative h-[155px] flex flex-col justify-between shadow-xl">
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"></div>
          <div>
            <span className="text-[10px] font-mono tracking-widest text-amber-500/60 uppercase block">Pending Ledger Claims</span>
            <span className="text-[9px] font-mono text-neutral-500 block uppercase mt-0.5">Reference Month: {currentMonthStr}</span>
          </div>
          <div className="mb-2">
            <h3 className="text-2xl font-semibold font-mono text-amber-500 leading-none">
              {formatMoney(totalPending)}
            </h3>
            <p className="text-[10px] text-neutral-400 mt-1 font-light">Outstanding actions awaiting approval</p>
          </div>
        </div>

        {/* Card 2: Total Buses Today */}
        <div className="rounded-2xl border border-amber-500/15 bg-zinc-900/45 p-5 backdrop-blur-xl relative h-[155px] flex flex-col justify-between shadow-xl">
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"></div>
          <div>
            <span className="text-[10px] font-mono tracking-widest text-amber-500/60 uppercase block">Total Buses Registered</span>
            <span className="text-[9px] font-mono text-neutral-500 block uppercase mt-0.5">Live fleet capacity active</span>
          </div>
          <div className="mb-2">
            <h3 className="text-3xl font-semibold font-mono text-white leading-none">
              {totalBusesToday}
            </h3>
            <p className="text-[10px] text-neutral-400 mt-1 font-light">Buses deployed into service</p>
          </div>
        </div>

        {/* Card 3: Income Statement */}
        <div className="rounded-2xl border border-amber-500/15 bg-zinc-900/45 p-5 backdrop-blur-xl relative min-h-[155px] flex flex-col justify-between shadow-xl">
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"></div>
          <div>
            <span className="text-[10px] font-mono tracking-widest text-amber-500/60 uppercase block">Income Statement (MTD)</span>
            <span className="text-[9px] font-mono text-neutral-500 block uppercase mt-0.5">{currentMonthStr} Closed Blocks</span>
          </div>
          <div className="mt-2.5">
            <table className="w-full text-[10px] font-mono">
              <tbody>
                <tr className="border-b border-white/5">
                  <td className="py-0.5 text-neutral-400">Income</td>
                  <td className="py-0.5 text-right text-emerald-400 font-semibold">{formatMoney(totalIncome)}</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-0.5 text-neutral-450">Expenses</td>
                  <td className="py-0.5 text-right text-red-400 font-semibold">{formatMoney(totalExpenses)}</td>
                </tr>
                <tr>
                  <td className="py-1 text-white font-serif font-bold">Net Profit</td>
                  <td className={`py-1 text-right font-black ${netProfit >= 0 ? "text-amber-400" : "text-rose-450"}`}>
                    {formatMoney(netProfit)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Card 4: Most Buses Utilization */}
        <div className="rounded-2xl border border-amber-500/15 bg-zinc-900/45 p-5 backdrop-blur-xl relative min-h-[155px] flex flex-col justify-between shadow-xl">
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"></div>
          <div>
            <span className="text-[10px] font-mono tracking-widest text-amber-500/60 uppercase block">Best Buses Utilization</span>
            <span className="text-[9px] font-mono text-neutral-500 block uppercase mt-0.5">Top-3 fleet boards capacity</span>
          </div>
          <div className="mt-2.5">
            {utilizationList.length === 0 ? (
              <p className="text-[10px] text-neutral-500 leading-normal">No registered utilization logs</p>
            ) : (
              <table className="w-full text-[10px] font-mono">
                <thead>
                  <tr className="border-b border-white/5 text-[8px] uppercase tracking-wider text-neutral-400">
                    <th className="py-0.5 text-left font-normal">Bus</th>
                    <th className="py-0.5 text-right font-normal">Percent</th>
                  </tr>
                </thead>
                <tbody>
                  {utilizationList.slice(0, 3).map((item, id) => (
                    <tr key={id} className="border-b border-white/5 last:border-0">
                      <td className="py-0.5 text-white font-mono">{item.bus || "—"}</td>
                      <td className="py-0.5 text-right text-amber-400 font-black">
                        {Number(item.percent).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

      {/* CHARTS GRAPH SELECTOR PANEL */}
      <div className="rounded-2xl border border-amber-500/15 bg-zinc-900/45 p-6 backdrop-blur-xl relative shadow-xl">
        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4 mb-6">
          <div>
            <h3 className="text-sm font-serif font-black tracking-wide text-white uppercase">
              Financial & Fleet Analytics View
            </h3>
            <p className="text-[10px] text-neutral-400 mt-1 font-mono uppercase">
              Unified database reporting trends
            </p>
          </div>
          
          {/* Chart selector tabs */}
          <div className="flex flex-wrap gap-1 bg-black/40 p-1 border border-white/5 rounded-xl">
            <button
              onClick={() => setChartSelector("fin")}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-all cursor-pointer ${
                chartSelector === "fin"
                  ? "bg-amber-500/10 border border-amber-500/30 text-amber-400"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              1. Income vs Expenses
            </button>
            <button
              onClick={() => setChartSelector("util")}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-all cursor-pointer ${
                chartSelector === "util"
                  ? "bg-amber-500/10 border border-amber-500/30 text-amber-400"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              2. Fleet Utilization
            </button>
            <button
              onClick={() => setChartSelector("wages")}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-all cursor-pointer ${
                chartSelector === "wages"
                  ? "bg-amber-500/10 border border-amber-500/30 text-amber-400"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              3. Wages & Salaries Expense
            </button>
          </div>
        </div>

        {/* Only one chart area exists inside chart panel */}
        <div className="h-[320px] w-full z-10 relative">
          {chartSelector === "fin" && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incomeExpenseData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis dataKey="month" stroke="#d97706" style={{ fontSize: 9, fontFamily: "monospace" }} />
                <YAxis stroke="#d97706" style={{ fontSize: 9, fontFamily: "monospace" }} tickFormatter={(v) => `${(v/1000000).toFixed(1)}M`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#020202", borderColor: "#f59e0b", fontSize: 10, fontFamily: "monospace" }}
                  formatter={(value) => [formatMoney(value), "Amount"]}
                />
                <Legend wrapperStyle={{ fontSize: 10, fontFamily: "serif" }} />
                <Bar name="Total Income" dataKey="total_income" fill="#10b981" barSize={16} />
                <Bar name="Total Expenses" dataKey="total_expenses" fill="#f43f5e" barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          )}

          {chartSelector === "util" && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={utilTrendData}>
                <defs>
                  <linearGradient id="colorUtil" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis dataKey="month" stroke="#d97706" style={{ fontSize: 9, fontFamily: "monospace" }} />
                <YAxis stroke="#d97706" style={{ fontSize: 9, fontFamily: "monospace" }} tickFormatter={(v) => `${Number(v).toFixed(0)}%`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#020202", borderColor: "#f59e0b", fontSize: 10, fontFamily: "monospace" }}
                  formatter={(value) => [`${Number(value).toFixed(2)}%`, "Average Utilization"]}
                />
                <Area name="Avg Utilization" type="monotone" dataKey="average_utilization" stroke="#f59e0b" fillOpacity={1} fill="url(#colorUtil)" />
              </AreaChart>
            </ResponsiveContainer>
          )}

          {chartSelector === "wages" && (
            !salaryWagesData || salaryWagesData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-neutral-500 font-mono text-xs">
                <span>No Wages Trend data available.</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salaryWagesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                  <XAxis dataKey="month" stroke="#d97706" style={{ fontSize: 9, fontFamily: "monospace" }} />
                  <YAxis 
                    stroke="#d97706" 
                    style={{ fontSize: 9, fontFamily: "monospace" }} 
                    tickFormatter={(v) => {
                      const val = Number(v);
                      if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M TZS`;
                      if (val >= 1000) return `${(val / 1000).toFixed(0)}K TZS`;
                      return `${val} TZS`;
                    }} 
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#020202", borderColor: "#f59e0b", fontSize: 10, fontFamily: "monospace" }}
                    formatter={(value) => [`${Number(value).toLocaleString()} TZS`, "Payroll Wages"]}
                  />
                  <Legend wrapperStyle={{ fontSize: 10, fontFamily: "serif" }} />
                  <Line name="Wages Paid" type="monotone" dataKey="amount" stroke="#f97316" strokeWidth={3} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            )
          )}
        </div>
      </div>

    </div>
  );
}

// =============================================================================
// SUB-SECTION 2: ACTIONS QUEUE (PENDING APPROVALS)
// =============================================================================
function ActionsSection({ currentUserProfile, onApprovalsUpdated }: { currentUserProfile?: any; onApprovalsUpdated?: () => void }) {
  const [pendingCash, setPendingCash] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [updatingRowId, setUpdatingRowId] = useState<string | null>(null);
  const [selectedStatuses, setSelectedStatuses] = useState<Record<string, number>>({});

  const fetchLookupsAndPendingCash = async () => {
    try {
      setLoading(true);
      setError(null);
      const companyId = currentUserProfile?.company_id;

      // 1. Fetch transaction statuses (e.g. pending, cleared, bounced)
      const { data: statusRows, error: sErr } = await supabase
        .from("transaction_statuses")
        .select("*");
      if (sErr) throw sErr;
      setStatuses(statusRows || []);

      const pendingObj = statusRows?.find(
        (s: any) => s.slug?.toLowerCase() === "pending" || s.display_name?.toLowerCase() === "pending"
      );
      const pendingId = pendingObj ? pendingObj.id : 1;

      // 2. Fetch cash entries
      let qCash = supabase
        .from("cash")
        .select(`
          id,
          amount,
          transaction_date,
          reference_number,
          status_id,
          cash_types(type_name),
          staffs(full_name),
          buses(plate_number),
          routes(route_name),
          accounts(account_name),
          categories(category_name),
          transaction_statuses(display_name)
        `)
        .eq("status_id", pendingId);

      if (companyId) {
        qCash = qCash.eq("company_id", companyId);
      }

      const { data: cashRows, error: cErr } = await qCash.order("transaction_date", { ascending: false });
      if (cErr) throw cErr;

      setPendingCash(cashRows || []);
      const mapping: Record<string, number> = {};
      cashRows?.forEach((r: any) => {
        mapping[r.id] = r.status_id;
      });
      setSelectedStatuses(mapping);

    } catch (err: any) {
      console.error("Failed loading approvals queue:", err);
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUserProfile) {
      fetchLookupsAndPendingCash();
    }
  }, [currentUserProfile]);

  const handleStatusChange = (rowId: string, val: number) => {
    setSelectedStatuses(prev => ({ ...prev, [rowId]: val }));
  };

  const handleSaveStatusUpdate = async (rowId: string) => {
    const updatedStatusId = selectedStatuses[rowId];
    if (!updatedStatusId) return;

    try {
      setUpdatingRowId(rowId);
      setError(null);
      setSuccess(null);

      // Updating a row must update only cash.status_id (Do not modify other cash fields!)
      const { error: patchError } = await supabase
        .from("cash")
        .update({ status_id: updatedStatusId })
        .eq("id", rowId);

      if (patchError) throw patchError;

      setSuccess("Transaction status successfully updated!");
      if (onApprovalsUpdated) onApprovalsUpdated();
      setTimeout(() => setSuccess(null), 3000);
      await fetchLookupsAndPendingCash();

    } catch (err: any) {
      console.error("Save failed:", err);
      setError("Failed to update: " + (err.message || String(err)));
    } finally {
      setUpdatingRowId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px]">
        <div className="animate-spin h-8 w-8 border-t-2 border-amber-500 border-r-2 border-transparent rounded-full mb-3"></div>
        <p className="text-xs font-mono tracking-widest text-[#d97706]/70 uppercase">Loading pending action listings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative z-25">
      {/* Notifications */}
      {error && (
        <div className="p-4 bg-rose-950/20 border border-rose-500/20 text-rose-300 text-xs font-mono rounded-xl flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-rose-450 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 text-xs font-mono rounded-xl flex items-center gap-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-450 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {pendingCash.length === 0 ? (
        <div className="rounded-2xl bg-zinc-950/40 border border-amber-500/5 p-12 text-center flex flex-col items-center justify-center min-h-[250px] backdrop-blur-md relative">
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/10 to-transparent"></div>
          <CheckCircle2 className="h-8 w-8 text-amber-550 mb-3" />
          <h3 className="text-sm font-serif font-black text-white uppercase tracking-wide">Approvals Queue Clear</h3>
          <p className="text-xs text-neutral-400 mt-1 max-w-sm font-light">
            There are no pending transaction records on the ledger at this time. All audits are completed.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-500/15 bg-zinc-900/45 backdrop-blur-xl overflow-hidden relative shadow-xl">
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/30 to-transparent"></div>
          
          <div className="p-5 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h3 className="text-sm font-serif font-black tracking-wide text-white uppercase">Pending Approvals Queue</h3>
              <p className="text-[10px] text-neutral-450 mt-0.5 font-mono uppercase">Authorize pending ledger claims</p>
            </div>
            <div className="px-2.5 py-1 text-[9px] font-mono bg-amber-500/5 border border-amber-500/15 text-amber-400 rounded-lg">
              {pendingCash.length} OUTSTANDING APPROVALS
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-neutral-900/10 text-[9px] font-mono tracking-wider uppercase text-neutral-400">
                  <th className="p-4 font-normal">Date</th>
                  <th className="p-4 font-normal">T.Type</th>
                  <th className="p-4 font-normal font-sans">Staff</th>
                  <th className="p-4 font-normal">Bus</th>
                  <th className="p-4 font-normal">Route</th>
                  <th className="p-4 font-normal">Account</th>
                  <th className="p-4 font-normal">Category</th>
                  <th className="p-4 font-normal">Reference</th>
                  <th className="p-4 text-right font-normal">Amount</th>
                  <th className="p-4 text-center font-normal">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-[11px]">
                {pendingCash.map((row) => (
                  <tr key={row.id} className="hover:bg-amber-500/2 transition-colors">
                    <td className="p-4 font-mono text-neutral-450 whitespace-nowrap">{row.transaction_date}</td>
                    <td className="p-4 font-serif text-neutral-350">{row.cash_types?.type_name || "—"}</td>
                    <td className="p-4 font-semibold text-white whitespace-nowrap truncate max-w-[120px]">{row.staffs?.full_name || "—"}</td>
                    <td className="p-4 font-mono text-neutral-300">{row.buses?.plate_number || "—"}</td>
                    <td className="p-4 text-neutral-400 max-w-[100px] truncate">{row.routes?.route_name || "—"}</td>
                    <td className="p-4 text-neutral-300 max-w-[120px] truncate">{row.accounts?.account_name || "—"}</td>
                    <td className="p-4 text-neutral-400 max-w-[120px] truncate">{row.categories?.category_name || "—"}</td>
                    <td className="p-4 font-mono text-neutral-450 truncate max-w-[100px]">{row.reference_number || "—"}</td>
                    <td className="p-4 text-right font-mono font-bold text-amber-400 whitespace-nowrap">{formatMoney(row.amount)}</td>
                    <td className="p-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <select
                          value={selectedStatuses[row.id] || ""}
                          onChange={(e) => handleStatusChange(row.id, Number(e.target.value))}
                          disabled={updatingRowId === row.id}
                          className="bg-black/80 border border-white/10 text-neutral-300 text-[10px] font-mono p-1 rounded-lg focus:outline-none focus:border-amber-500/55 h-7 w-[100px]"
                        >
                          {statuses.map((st) => (
                            <option key={st.id} value={st.id}>
                              {st.display_name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleSaveStatusUpdate(row.id)}
                          disabled={updatingRowId === row.id || selectedStatuses[row.id] === row.status_id}
                          className="px-2 py-1 h-7 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 font-mono text-[9px] uppercase cursor-pointer transition-all disabled:opacity-40"
                        >
                          {updatingRowId === row.id ? "..." : "Save"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SUB-SECTION 3: MEMOS ENGINE (INBOX, SENT, COMPOSE)
// =============================================================================
function MemosSection({ currentUserProfile, onMemosUpdated }: { currentUserProfile?: any; onMemosUpdated?: () => void }) {
  const [direction, setDirection] = useState<"inbox" | "sent">("inbox");
  const [inboxMemos, setInboxMemos] = useState<any[]>([]);
  const [sentMemos, setSentMemos] = useState<any[]>([]);
  const [userProfiles, setUserProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMemoId, setSelectedMemoId] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);

  // Compose variables
  const [txtReceiverId, setTxtReceiverId] = useState("");
  const [txtTitle, setTxtTitle] = useState("");
  const [txtMessage, setTxtMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const loadMemos = async () => {
    try {
      setLoading(true);
      const companyId = currentUserProfile?.company_id;
      const profileId = currentUserProfile?.id;
      if (!profileId) return;

      // 1. Fetch users list for compose select dropdown (Filtered by same company_id if present)
      let qProfiles = supabase.from("user_profiles").select("id, full_name").eq("is_active", true);
      if (companyId) {
        qProfiles = qProfiles.eq("company_id", companyId);
      }
      const { data: usersData } = await qProfiles.order("full_name", { ascending: true });
      setUserProfiles(usersData || []);

      // 2. Fetch Inbox
      let qInbox = supabase
        .from("memos")
        .select(`
          id,
          title,
          message,
          is_read,
          created_at,
          sender:user_profiles!sender_id (id, full_name),
          receiver:user_profiles!receiver_id (id, full_name)
        `)
        .eq("receiver_id", profileId);
      if (companyId) qInbox = qInbox.eq("company_id", companyId);
      const { data: inboxData } = await qInbox.order("created_at", { ascending: false });
      setInboxMemos(inboxData || []);

      // 3. Fetch Sent
      let qSent = supabase
        .from("memos")
        .select(`
          id,
          title,
          message,
          is_read,
          created_at,
          sender:user_profiles!sender_id (id, full_name),
          receiver:user_profiles!receiver_id (id, full_name)
        `)
        .eq("sender_id", profileId);
      if (companyId) qSent = qSent.eq("company_id", companyId);
      const { data: sentData } = await qSent.order("created_at", { ascending: false });
      setSentMemos(sentData || []);

    } catch (e) {
      console.error("Memos query failed:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUserProfile) {
      loadMemos();
    }
  }, [currentUserProfile]);

  const unreadAlertsCount = useMemo(() => {
    return inboxMemos.filter(m => !m.is_read).length;
  }, [inboxMemos]);

  const handleOpenMemoDetail = async (memo: any) => {
    setSelectedMemoId(memo.id);
    setIsComposing(false);

    // If opening unread inbox memo, update is_read = true in database
    if (direction === "inbox" && !memo.is_read) {
      setInboxMemos(prev => prev.map(m => m.id === memo.id ? { ...m, is_read: true } : m));
      try {
        await supabase.from("memos").update({ is_read: true }).eq("id", memo.id);
        if (onMemosUpdated) onMemosUpdated();
      } catch (err) {
        console.error("Read patch update failed:", err);
      }
    }
  };

  const handlePublishMemo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txtReceiverId) {
      setErr("Please authorize a receiver staff member.");
      return;
    }
    if (!txtTitle.trim() || !txtMessage.trim()) {
      setErr("Title and message memo fields cannot be left empty.");
      return;
    }

    try {
      setSending(true);
      setErr(null);
      setOk(null);

      const memoPayload: any = {
        sender_id: currentUserProfile.id,
        receiver_id: txtReceiverId,
        title: txtTitle.trim(),
        message: txtMessage.trim(),
        is_read: false
      };

      if (currentUserProfile.company_id) {
        memoPayload.company_id = currentUserProfile.company_id;
      }

      const { error: insErr } = await supabase.from("memos").insert([memoPayload]);
      if (insErr) throw insErr;

      setOk("Memo successfully transmitted!");
      setTxtTitle("");
      setTxtMessage("");
      setTxtReceiverId("");
      setIsComposing(false);
      setSelectedMemoId(null);
      await loadMemos();

    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setSending(false);
    }
  };

  const activeSelectedMemo = useMemo(() => {
    if (!selectedMemoId) return null;
    const all = [...inboxMemos, ...sentMemos];
    return all.find(m => m.id === selectedMemoId) || null;
  }, [selectedMemoId, inboxMemos, sentMemos]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px]">
        <div className="animate-spin h-8 w-8 border-t-2 border-amber-500 border-r-2 border-transparent rounded-full mb-3"></div>
        <p className="text-xs font-mono tracking-widest text-[#d97706]/70 uppercase">Loading secure bulletin memos...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-25">
      {/* LEFT: MEMO SELECTION & TABS */}
      <div className="lg:col-span-5 space-y-4">
        
        {/* Navigation block */}
        <div className="flex items-center justify-between border-b border-amber-500/10 pb-3">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setDirection("inbox");
                setSelectedMemoId(null);
                setIsComposing(false);
              }}
              className={`px-3 py-1.5 rounded-lg font-mono text-xs uppercase tracking-wider select-none ${
                direction === "inbox"
                  ? "bg-amber-500/10 border border-amber-500/30 text-amber-400"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Inbox ({inboxMemos.length})
              {unreadAlertsCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[9px] bg-rose-600 text-white font-mono rounded-full animate-pulse">
                  {unreadAlertsCount}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setDirection("sent");
                setSelectedMemoId(null);
                setIsComposing(false);
              }}
              className={`px-3 py-1.5 rounded-lg font-mono text-xs uppercase tracking-wider select-none ${
                direction === "sent"
                  ? "bg-amber-500/10 border border-amber-500/30 text-amber-400"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Sent ({sentMemos.length})
            </button>
          </div>

          <button
            onClick={() => {
              setIsComposing(true);
              setSelectedMemoId(null);
              setErr(null);
              setOk(null);
            }}
            className="px-3 py-1.5 bg-amber-500 text-black font-semibold font-mono text-[10px] uppercase rounded-lg flex items-center gap-1.5 hover:bg-amber-400 cursor-pointer self-center"
          >
            <Plus className="h-3 w-3" />
            COMPOSE
          </button>
        </div>

        {/* List Memos */}
        <div className="space-y-2 h-[450px] overflow-y-auto pr-1">
          {direction === "inbox" ? (
            inboxMemos.length === 0 ? (
              <p className="p-4 text-xs text-neutral-400 font-light italic">No memos received inside your mailbox.</p>
            ) : (
              inboxMemos.map(m => (
                <button
                  key={m.id}
                  onClick={() => handleOpenMemoDetail(m)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex flex-col gap-1.5 cursor-pointer ${
                    m.id === selectedMemoId
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                      : !m.is_read
                      ? "bg-amber-500/5 border-amber-500/15 text-white"
                      : "bg-neutral-950/20 border-white/5 text-neutral-400"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] text-amber-500 font-semibold uppercase">
                      From: {m.sender?.full_name || "Staff Member"}
                    </span>
                    <span className="font-mono text-[8px] text-neutral-500">
                      {new Date(m.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="text-xs font-serif font-black uppercase truncate pr-4">{m.title}</h4>
                  <p className="text-[10px] font-sans truncate text-neutral-400">{m.message}</p>
                </button>
              ))
            )
          ) : (
            sentMemos.length === 0 ? (
              <p className="p-4 text-xs text-neutral-400 font-light italic">You have not dispatched any sent memos.</p>
            ) : (
              sentMemos.map(m => (
                <button
                  key={m.id}
                  onClick={() => handleOpenMemoDetail(m)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex flex-col gap-1.5 cursor-pointer ${
                    m.id === selectedMemoId
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                      : "bg-neutral-950/20 border-white/5 text-neutral-400"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] text-orange-500 uppercase">
                      To: {m.receiver?.full_name || "Staff Member"}
                    </span>
                    <span className="font-mono text-[8px] text-neutral-500">
                      {new Date(m.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="text-xs font-serif font-black uppercase truncate pr-4">{m.title}</h4>
                  <p className="text-[10px] font-sans truncate text-neutral-400">{m.message}</p>
                </button>
              ))
            )
          )}
        </div>
      </div>

      {/* RIGHT: WORKSPACE VIEWER */}
      <div className="lg:col-span-7">
        
        {/* COMPOSE LAYOUT */}
        {isComposing && (
          <form onSubmit={handlePublishMemo} className="rounded-2xl border border-amber-500/20 bg-zinc-900/55 p-6 space-y-4 backdrop-blur-xl relative h-full shadow-xl">
            <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-200/50 to-transparent"></div>
            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <Plus className="h-4 w-4 text-amber-400" />
              <h3 className="text-xs font-serif font-black tracking-wider text-white uppercase">Compose Executive Memo</h3>
            </div>

            {err && (
              <p className="p-2.5 bg-rose-950/20 border border-rose-500/20 text-rose-355 text-[10px] font-mono rounded-lg">{err}</p>
            )}

            <div>
              <label className="block text-[9px] uppercase font-mono tracking-widest text-[#d97706]/70 mb-1">Receiver Board Staff</label>
              <select
                value={txtReceiverId}
                onChange={(e) => setTxtReceiverId(e.target.value)}
                required
                className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50 h-[38px] font-mono"
              >
                <option value="">Select recipient...</option>
                {userProfiles.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[9px] uppercase font-mono tracking-widest text-[#d97706]/70 mb-1">Subject Header</label>
              <input
                type="text"
                value={txtTitle}
                onChange={(e) => setTxtTitle(e.target.value)}
                placeholder="Enterprise memo title..."
                required
                className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50 h-[38px]"
              />
            </div>

            <div>
              <label className="block text-[9px] uppercase font-mono tracking-widest text-[#d97706]/70 mb-1">Internal Secret Statement</label>
              <textarea
                value={txtMessage}
                onChange={(e) => setTxtMessage(e.target.value)}
                placeholder="Indicate instructions or executive report details inside body..."
                rows={8}
                required
                className="w-full bg-black border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsComposing(false);
                  setErr(null);
                }}
                className="px-3 py-2 border border-white/10 rounded-lg hover:bg-white/5 font-mono text-[10px] uppercase text-neutral-300 transition-all cursor-pointer h-9"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold font-mono text-[10px] uppercase rounded-lg h-9 flex items-center gap-1.5 cursor-pointer disabled:opacity-45"
              >
                {sending ? "TRANSMITTING..." : "DISPATCH"}
              </button>
            </div>
          </form>
        )}

        {/* DETAILS LAYOUT */}
        {activeSelectedMemo && !isComposing && (
          <div className="rounded-2xl border border-amber-500/15 bg-zinc-900/55 p-6 space-y-4 backdrop-blur-xl relative h-full shadow-xl">
            <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent"></div>
            
            <div className="flex justify-between items-start border-b border-white/5 pb-3">
              <div>
                <span className="font-mono text-[9px] uppercase text-amber-550 block">Corporate Memo Details</span>
                <span className="font-mono text-[8px] text-neutral-500 block mt-0.5 whitespace-nowrap">
                  Transmitted At: {new Date(activeSelectedMemo.created_at).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs leading-relaxed border-b border-white/5 pb-4 font-mono">
              <p className="text-[10px]">
                <strong className="text-neutral-500">SENDER: </strong>
                <span className="text-white font-medium">{activeSelectedMemo.sender?.full_name || "—"}</span>
              </p>
              <p className="text-[10px]">
                <strong className="text-neutral-500">RECIPIENT: </strong>
                <span className="text-white font-medium">{activeSelectedMemo.receiver?.full_name || "—"}</span>
              </p>
            </div>

            <div className="py-2">
              <h2 className="text-sm font-serif font-black uppercase text-amber-400 leading-snug mb-3">
                {activeSelectedMemo.title}
              </h2>
              <p className="text-[11px] leading-relaxed text-neutral-300 font-sans whitespace-pre-wrap selection:bg-amber-500/20">
                {activeSelectedMemo.message}
              </p>
            </div>
          </div>
        )}

        {/* DEFAULT PREVIEW */}
        {!isComposing && !activeSelectedMemo && (
          <div className="rounded-2xl border border-white/5 bg-zinc-950/20 p-12 text-center flex flex-col items-center justify-center h-full backdrop-blur-md min-h-[300px]">
            <Inbox className="h-6 w-6 text-neutral-600 mb-2" />
            <h3 className="text-xs uppercase font-mono tracking-widest text-neutral-400 font-bold">No Memo Highlighted</h3>
            <p className="text-[10px] text-neutral-500 mt-1 max-w-sm mx-auto font-light">
              Select or compose a boardroom bulletin message from the index queue list.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}

// =============================================================================
// SUB-SECTION 4: DEPARTMENTAL REPORTS ENGINE (Unified Management reporting hub)
// =============================================================================
function ReportsSection({ currentUserProfile, companyName }: { currentUserProfile?: any; companyName: string }) {
  const [department, setDepartment] = useState<"finance" | "operations" | "hr">("finance");
  const [selectedReportId, setSelectedReportId] = useState<string>("invoice_report");

  // Optional filter bounds
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [monthFrom, setMonthFrom] = useState("");
  const [monthTo, setMonthTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  // Search details
  const [staffQuery, setStaffQuery] = useState("");
  const [busQuery, setBusQuery] = useState("");
  const [routeQuery, setRouteQuery] = useState("");
  const [officeQuery, setOfficeQuery] = useState("");
  const [statusQuery, setStatusQuery] = useState("");
  const [occupationQuery, setOccupationQuery] = useState("");

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Auto fallback reset when department shifts
  useEffect(() => {
    if (department === "finance") {
      setSelectedReportId(FINANCE_REPORTS[0].id);
    } else if (department === "operations") {
      setSelectedReportId(OPERATIONS_REPORTS[0].id);
    } else {
      setSelectedReportId(HR_REPORTS[0].id);
    }
    // Clear filters automatically
    setDateFrom(""); setDateTo(""); setMonthFrom(""); setMonthTo("");
    setMinAmount(""); setMaxAmount(""); setStaffQuery(""); setBusQuery("");
    setRouteQuery(""); setOfficeQuery(""); setStatusQuery(""); setOccupationQuery("");
  }, [department]);

  const activeReport = useMemo(() => {
    const list = [...FINANCE_REPORTS, ...OPERATIONS_REPORTS, ...HR_REPORTS];
    return list.find(r => r.id === selectedReportId) || null;
  }, [selectedReportId]);

  // Execute database report load
  const loadData = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeReport) return;

    try {
      setLoading(true);
      setError(null);
      const companyId = currentUserProfile?.company_id;

      let q = supabase.from(activeReport.view).select("*");

      if (companyId) {
        q = q.eq("company_id", companyId);
      }

      // 1. Date filters
      const dateCol = activeReport.columns.find(c => c.type === "date")?.key || "date";
      if (dateFrom) q = q.gte(dateCol, dateFrom);
      if (dateTo) q = q.lte(dateCol, dateTo);

      // 2. Month filters
      const monthCol = activeReport.columns.find(c => c.type === "month")?.key || "month";
      if (monthFrom) q = q.gte(monthCol, monthFrom);
      if (monthTo) q = q.lte(monthCol, monthTo);

      // 3. Amount filters
      if (minAmount) q = q.gte("amount", Number(minAmount));
      if (maxAmount) q = q.lte("amount", Number(maxAmount));

      // 4. String queries
      if (staffQuery.trim()) {
        const key = activeReport.columns.find(c => c.key === "staff_name") ? "staff_name" : "staff";
        q = q.ilike(key, `%${staffQuery.trim()}%`);
      }
      if (busQuery.trim()) {
        const key = activeReport.columns.find(c => c.key === "plate_number") ? "plate_number" : "bus";
        q = q.ilike(key, `%${busQuery.trim()}%`);
      }
      if (routeQuery.trim()) q = q.ilike("route", `%${routeQuery.trim()}%`);
      if (officeQuery.trim()) q = q.ilike("office", `%${officeQuery.trim()}%`);
      if (statusQuery.trim()) q = q.ilike("status", `%${statusQuery.trim()}%`);
      if (occupationQuery.trim()) q = q.ilike("occupation", `%${occupationQuery.trim()}%`);

      // Limit caps to prevent sandbox locks
      q = q.limit(100);

      const { data, error: qErr } = await q;
      if (qErr) throw qErr;
      setReportData(data || []);

    } catch (err: any) {
      console.error("Failed fetching dynamic report:", err);
      setError(err.message || "Failed retrieving database ledger reports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedReportId]);

  // Calculate Column totals
  const totals = useMemo(() => {
    if (!activeReport || reportData.length === 0) return {};
    const sums: Record<string, number> = {};
    activeReport.columns.forEach(col => {
      if (col.type === "number") {
        sums[col.key] = reportData.reduce((acc, row) => acc + (Number(row[col.key]) || 0), 0);
      }
    });
    return sums;
  }, [reportData, activeReport]);

  // Download XLS Report Format (Includes premium unified titles with Resolved Company Name)
  const handleExportXLS = () => {
    if (reportData.length === 0 || !activeReport) return;
    try {
      const reportName = activeReport.name;
      const headers = activeReport.columns.map(c => c.label);
      
      const rows = reportData.map(row => {
        return activeReport.columns.map(col => {
          const val = row[col.key];
          if (val === undefined || val === null) return "";
          if (col.type === "number") return Number(val);
          if (col.type === "date" || col.type === "month") return String(val).split("T")[0];
          return String(val);
        });
      });

      // Show total summary inside excel rows as well
      const totalsRow = activeReport.columns.map((col, idx) => {
        if (idx === 0) return "TOTAL";
        if (col.type === "number") return totals[col.key] || "";
        return "";
      });
      rows.push(totalsRow as any);

      const aoa: any[][] = [
        [companyName.toUpperCase()],
        [`DEPARTMENT: ${department.toUpperCase()} ENGINE | ${reportName.toUpperCase()}`],
        [`Exported At: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`],
        [],
        headers,
        ...rows
      ];

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, reportName.slice(0, 30));
      XLSX.writeFile(wb, `${activeReport.id}_report_${new Date().toISOString().split("T")[0]}.xlsx`);

    } catch (e) {
      console.error("XLSX output error:", e);
    }
  };

  // Download PDF Report Format (Premium board theme with Resolved Company Name)
  const handleExportPDF = () => {
    if (reportData.length === 0 || !activeReport) return;
    try {
      const doc = new jsPDF(activeReport.layout === "landscape" ? "l" : "p", "pt", "a4");

      doc.setFillColor(6, 15, 29);
      const width = activeReport.layout === "landscape" ? 842 : 595;
      doc.rect(0, 0, width, 60, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(13);
      doc.text(companyName.toUpperCase(), 45, 35);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(217, 119, 6);
      doc.text(`${department.toUpperCase()} ENGINE REPORT: ${activeReport.name}`, 45, 48);

      const headers = activeReport.columns.map(c => c.label);
      const rows = reportData.map(row => {
        return activeReport.columns.map(col => {
          const val = row[col.key];
          if (val === undefined || val === null) return "—";
          if (col.type === "number") return Math.round(Number(val)).toLocaleString();
          return String(val);
        });
      });

      // Prepend sum results inside autoTable rows
      const totalsRow = activeReport.columns.map((col, idx) => {
        if (idx === 0) return "TOTAL";
        if (col.type === "number") return Math.round(Number(totals[col.key])).toLocaleString();
        return "";
      });
      rows.push(totalsRow as any);

      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: 85,
        theme: "striped",
        headStyles: { fillColor: [217, 119, 6], textColor: [0, 0, 0], fontSize: 8, fontStyle: "bold" },
        bodyStyles: { fontSize: 7.5, textColor: [31, 41, 55] },
        styles: { font: "Helvetica" }
      });

      doc.save(`${activeReport.id}_report_${new Date().toISOString().split("T")[0]}.pdf`);

    } catch (e) {
      console.error("PDF generation failed:", e);
    }
  };

  const hasFilter = (key: string) => {
    if (!activeReport) return false;
    return activeReport.columns.some(c => c.key === key) || (key === "date" && activeReport.columns.some(c => c.type === "date")) || (key === "month" && activeReport.columns.some(c => c.type === "month")) || (key === "staff" && activeReport.columns.some(c => c.key === "staff" || c.key === "staff_name"));
  };

  return (
    <div className="space-y-6 relative z-25">
      
      {/* 3 Premium tab selectors glowing gold when selected */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setDepartment("finance")}
          className={`p-4 rounded-xl border text-center transition-all select-none cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
            department === "finance"
              ? "bg-gradient-to-tr from-amber-600/10 to-orange-500/10 border-amber-500/40 text-amber-400 shadow-md ring-1 ring-amber-500/20"
              : "bg-zinc-950/20 border-white/5 text-neutral-400 hover:text-white"
          }`}
        >
          <span className="text-xs font-serif font-black uppercase tracking-widest leading-none">Finance Engine</span>
          <span className="text-[8px] font-mono uppercase text-neutral-500">Corporate balance statements</span>
        </button>
        <button
          onClick={() => setDepartment("operations")}
          className={`p-4 rounded-xl border text-center transition-all select-none cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
            department === "operations"
              ? "bg-gradient-to-tr from-amber-600/10 to-orange-500/10 border-amber-500/40 text-amber-400 shadow-md ring-1 ring-amber-500/20"
              : "bg-zinc-950/20 border-white/5 text-neutral-400 hover:text-white"
          }`}
        >
          <span className="text-xs font-serif font-black uppercase tracking-widest leading-none">Operations Engine</span>
          <span className="text-[8px] font-mono uppercase text-neutral-500">Fleet logs & utilization metrics</span>
        </button>
        <button
          onClick={() => setDepartment("hr")}
          className={`p-4 rounded-xl border text-center transition-all select-none cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
            department === "hr"
              ? "bg-gradient-to-tr from-amber-600/10 to-orange-500/10 border-amber-500/40 text-amber-400 shadow-md ring-1 ring-amber-500/20"
              : "bg-zinc-950/20 border-white/5 text-neutral-400 hover:text-white"
          }`}
        >
          <span className="text-xs font-serif font-black uppercase tracking-widest leading-none">HR Engine</span>
          <span className="text-[8px] font-mono uppercase text-neutral-500">Payroll statements & shortages</span>
        </button>
      </div>

      {/* Report selector cards inline */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {(department === "finance" ? FINANCE_REPORTS : department === "operations" ? OPERATIONS_REPORTS : HR_REPORTS).map((report) => {
          const isSelected = report.id === selectedReportId;
          return (
            <button
              key={report.id}
              onClick={() => setSelectedReportId(report.id)}
              className={`text-left p-3.5 rounded-xl border flex flex-col justify-between transition-all select-none h-20 cursor-pointer ${
                isSelected
                  ? "bg-amber-500/10 border-amber-500/35 text-amber-300 shadow-sm"
                  : "bg-zinc-950/25 border-white/5 text-neutral-400 hover:text-white"
              }`}
            >
              <h4 className="text-[10px] font-mono tracking-wider text-amber-550/80 uppercase font-bold leading-none">{report.category}</h4>
              <p className="text-xs font-serif font-semibold text-white whitespace-nowrap overflow-hidden text-ellipsis w-full mt-1">{report.name}</p>
            </button>
          );
        })}
      </div>

      {/* Main Reporting Workspace Grid */}
      {activeReport && (
        <div className="rounded-2xl border border-amber-500/15 bg-zinc-900/45 p-5 space-y-5 backdrop-blur-xl relative shadow-xl">
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/25 to-transparent"></div>
          
          {/* Workspace Title bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/5 pb-4">
            <div>
              <span className="text-[9px] font-mono tracking-wider uppercase text-amber-500 font-semibold">Active Executive Worksheet</span>
              <h3 className="text-sm font-serif font-black uppercase text-white tracking-wide mt-0.5">
                {activeReport.name} <span className="text-amber-500 font-normal font-mono text-[10.5px] ml-1">// {companyName}</span>
              </h3>
            </div>
            
            {/* Exports */}
            {reportData.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportXLS}
                  className="px-3 py-1 text-[10px] font-mono bg-zinc-950/80 border border-amber-500/20 hover:border-amber-500/50 text-amber-400 hover:text-amber-300 rounded-lg flex items-center gap-1.5 cursor-pointer h-8 shadow-md"
                >
                  <FileText className="h-3.5 w-3.5 text-amber-500" />
                  Export Excel
                </button>
                <button
                  onClick={handleExportPDF}
                  className="px-3 py-1 text-[10px] font-mono bg-zinc-950/80 border border-amber-500/20 hover:border-amber-500/50 text-amber-400 hover:text-amber-300 rounded-lg flex items-center gap-1.5 cursor-pointer h-8 shadow-md"
                >
                  <FileText className="h-3.5 w-3.5 text-amber-500" />
                  Export PDF
                </button>
              </div>
            )}
          </div>

          {/* Report workspace parameters filter layout */}
          <form onSubmit={loadData} className="bg-black/30 border border-white/5 rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-amber-500 font-bold border-b border-white/5 pb-1.5 w-full">
              <SlidersHorizontal className="h-3.5 w-3.5 text-amber-400" />
              <span>Workspace Range filters</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {/* Conditional rendering based on column definitions */}
              {hasFilter("date") && (
                <>
                  <div>
                    <label className="block text-[8px] uppercase tracking-wider font-mono text-neutral-450 mb-1">Date From</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full bg-black/80 border border-white/10 rounded-lg px-2.5 py-1 text-[11px] text-white focus:outline-none focus:border-amber-500/50 font-mono h-[32px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] uppercase tracking-wider font-mono text-neutral-450 mb-1">Date To</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full bg-black/80 border border-white/10 rounded-lg px-2.5 py-1 text-[11px] text-white focus:outline-none focus:border-amber-500/50 font-mono h-[32px]"
                    />
                  </div>
                </>
              )}

              {hasFilter("month") && (
                <>
                  <div>
                    <label className="block text-[8px] uppercase tracking-wider font-mono text-neutral-450 mb-1">Month From</label>
                    <input
                      type="month"
                      value={monthFrom}
                      onChange={(e) => setMonthFrom(e.target.value)}
                      className="w-full bg-black/80 border border-white/10 rounded-lg px-2.5 py-1 text-[11px] text-white focus:outline-none focus:border-amber-500/50 font-mono h-[32px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] uppercase tracking-wider font-mono text-neutral-450 mb-1">Month To</label>
                    <input
                      type="month"
                      value={monthTo}
                      onChange={(e) => setMonthTo(e.target.value)}
                      className="w-full bg-black/80 border border-white/10 rounded-lg px-2.5 py-1 text-[11px] text-white focus:outline-none focus:border-amber-500/50 font-mono h-[32px]"
                    />
                  </div>
                </>
              )}

              {hasFilter("amount") && (
                <>
                  <div>
                    <label className="block text-[8px] uppercase tracking-wider font-mono text-neutral-450 mb-1">Min Amount (TZS)</label>
                    <input
                      type="number"
                      value={minAmount}
                      onChange={(e) => setMinAmount(e.target.value)}
                      className="w-full bg-black/80 border border-white/10 rounded-lg px-2.5 py-1 text-[11px] text-white focus:outline-none focus:border-amber-500/50 font-mono h-[32px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] uppercase tracking-wider font-mono text-neutral-450 mb-1">Max Amount (TZS)</label>
                    <input
                      type="number"
                      value={maxAmount}
                      onChange={(e) => setMaxAmount(e.target.value)}
                      className="w-full bg-black/80 border border-white/10 rounded-lg px-2.5 py-1 text-[11px] text-white focus:outline-none focus:border-amber-500/50 font-mono h-[32px]"
                    />
                  </div>
                </>
              )}

              {hasFilter("staff") && (
                <div>
                  <label className="block text-[8px] uppercase tracking-wider font-mono text-neutral-450 mb-1">Staff filter</label>
                  <input
                    type="text"
                    value={staffQuery}
                    onChange={(e) => setStaffQuery(e.target.value)}
                    placeholder="Search staff..."
                    className="w-full bg-black/80 border border-white/10 rounded-lg px-2.5 py-1 text-[11px] text-white focus:outline-none focus:border-amber-500/50 h-[32px]"
                  />
                </div>
              )}

              {hasFilter("bus") && (
                <div>
                  <label className="block text-[8px] uppercase tracking-wider font-mono text-neutral-450 mb-1">Bus vehicle</label>
                  <input
                    type="text"
                    value={busQuery}
                    onChange={(e) => setBusQuery(e.target.value)}
                    placeholder="Plate register..."
                    className="w-full bg-black/80 border border-white/10 rounded-lg px-2.5 py-1 text-[11px] text-white focus:outline-none focus:border-amber-500/50 h-[32px]"
                  />
                </div>
              )}

              {hasFilter("route") && (
                <div>
                  <label className="block text-[8px] uppercase tracking-wider font-mono text-neutral-450 mb-1">Route segment</label>
                  <input
                    type="text"
                    value={routeQuery}
                    onChange={(e) => setRouteQuery(e.target.value)}
                    placeholder="Corporate route..."
                    className="w-full bg-black/80 border border-white/10 rounded-lg px-2.5 py-1 text-[11px] text-white focus:outline-none focus:border-amber-500/50 h-[32px]"
                  />
                </div>
              )}

              {hasFilter("office") && (
                <div>
                  <label className="block text-[8px] uppercase tracking-wider font-mono text-neutral-450 mb-1">Station Office</label>
                  <input
                    type="text"
                    value={officeQuery}
                    onChange={(e) => setOfficeQuery(e.target.value)}
                    placeholder="Terminal station..."
                    className="w-full bg-black/80 border border-white/10 rounded-lg px-2.5 py-1 text-[11px] text-white focus:outline-none focus:border-amber-500/50 h-[32px]"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold font-mono text-[10px] uppercase rounded-lg cursor-pointer h-8 flex items-center justify-center"
              >
                {loading ? "SEARCHING..." : "APPLY PARAMS"}
              </button>
            </div>
          </form>

          {/* Live spreadsheet table */}
          {error && (
            <div className="p-3 bg-rose-950/20 border border-rose-500/20 text-xs text-rose-355 font-mono rounded-lg">
              {error}
            </div>
          )}

          {reportData.length === 0 ? (
            <p className="p-6 text-center font-mono text-[10.5px] uppercase text-neutral-500/80">
              {loading ? "Synchronizing worksheet data with cloud..." : "No closed entries resolved matching filter params"}
            </p>
          ) : (
            <div className="max-h-[520px] overflow-y-auto overflow-x-auto relative rounded-xl border border-white/5 scrollbar-thin scrollbar-thumb-white/10">
              <table className="w-full text-left border-collapse font-sans text-[11px]">
                <thead className="sticky top-0 bg-neutral-950 z-15 shadow-[0_1px_0_0_rgba(255,255,255,0.05)]">
                  <tr className="border-b border-white/5 text-[9px] font-mono whitespace-nowrap uppercase tracking-wider text-neutral-400 bg-neutral-900/80">
                    {activeReport.columns.map((col) => (
                      <th key={col.key} className={`p-3 font-normal sticky top-0 bg-neutral-950 z-15 ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}`}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {reportData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-amber-500/2 transition-colors">
                      {activeReport.columns.map((col) => {
                        const val = row[col.key];
                        const isNum = col.type === "number";
                        return (
                          <td key={col.key} className={`p-3 whitespace-nowrap ${isNum ? "text-right font-mono" : ""}`}>
                            {isNum 
                              ? formatMoney(val)
                              : val === undefined || val === null
                              ? "—"
                              : String(val)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {/* Totals Summary Row */}
                  <tr className="bg-amber-500/2 font-bold font-mono text-[10.5px]">
                    {activeReport.columns.map((col, idx) => (
                      <td key={col.key} className={`p-3 whitespace-nowrap ${col.type === "number" ? "text-right text-amber-500" : "text-white"}`}>
                        {idx === 0 
                          ? "TOTALS"
                          : col.type === "number"
                          ? formatMoney(totals[col.key])
                          : ""}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SUB-SECTION 5: BUSINESS REPORT ANALYSIS (Executive Strategic Analysis Section)
// =============================================================================
function AnalysisSection({ currentUserProfile }: { currentUserProfile: any }) {
  const [activeSubTab, setActiveSubTab] = useState<"graphical" | "tabular">("graphical");

  // GRAPHICAL tab state
  const [selectedGraph, setSelectedGraph] = useState<"hce" | "bus_fare" | "route_fare">("hce");
  const [graphData, setGraphData] = useState<any[]>([]);
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphError, setGraphError] = useState<string | null>(null);

  // TABULAR tab state
  const [selectedReport, setSelectedReport] = useState<"average_fare" | "bus_fare" | "route_fare">("average_fare");
  const [tableData, setTableData] = useState<any[]>([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableError, setTableError] = useState<string | null>(null);
  const [limit, setLimit] = useState<number>(100);

  // Filter states
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    monthFrom: "",
    monthTo: "",
    staff: "",
    bus: "",
    route: ""
  });

  // Calculate if filter is active
  const hasActiveFilters = useMemo(() => {
    return !!(filters.dateFrom || filters.dateTo || filters.monthFrom || filters.monthTo || filters.staff || filters.bus || filters.route);
  }, [filters]);

  // Fetch Graphical Analysis data
  useEffect(() => {
    if (activeSubTab !== "graphical") return;

    let isMounted = true;
    async function fetchGraphData() {
      setGraphLoading(true);
      setGraphError(null);
      setGraphData([]);

      const companyId = currentUserProfile?.company_id;
      let viewName = "";
      if (selectedGraph === "hce") {
        viewName = "v_mgmt_human_capital_efficiency";
      } else if (selectedGraph === "bus_fare") {
        viewName = "v_monthly_bus_average_fare";
      } else if (selectedGraph === "route_fare") {
        viewName = "v_route_average_fare";
      }

      try {
        let q = supabase.from(viewName).select("*");
        if (companyId) {
          q = q.eq("company_id", companyId);
        }
        let { data, error } = await q;

        if (error && (error.code === "42703" || error.message?.includes("column"))) {
          // Fallback if company_id column does not exist in this view
          const retryQ = supabase.from(viewName).select("*");
          const { data: retryData, error: retryError } = await retryQ;
          if (retryError) throw retryError;
          data = retryData;
        } else if (error) {
          throw error;
        }

        if (isMounted) {
          let sorted = data || [];
          if (selectedGraph === "hce") {
            sorted = [...sorted].sort((a: any, b: any) => String(a.month || "").localeCompare(String(b.month || "")));
          } else if (selectedGraph === "bus_fare") {
            sorted = [...sorted].sort((a: any, b: any) => String(a.month || "").localeCompare(String(b.month || "")));
          } else if (selectedGraph === "route_fare") {
            sorted = [...sorted].sort((a: any, b: any) => String(a.month || "").localeCompare(String(b.month || "")));
          }
          setGraphData(sorted);
        }
      } catch (err: any) {
        console.error("Error loading graph data:", err);
        if (isMounted) {
          setGraphError(err.message || "Failed to load visualization data.");
        }
      } finally {
        if (isMounted) setGraphLoading(false);
      }
    }

    fetchGraphData();
    return () => { isMounted = false; };
  }, [selectedGraph, activeSubTab, currentUserProfile]);

  // Fetch Tabular Analysis data
  const loadTabularData = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setTableLoading(true);
    setTableError(null);

    const companyId = currentUserProfile?.company_id;
    let viewName = "";
    if (selectedReport === "average_fare") {
      viewName = "v_average_fare";
    } else if (selectedReport === "bus_fare") {
      viewName = "v_monthly_bus_average_fare";
    } else if (selectedReport === "route_fare") {
      viewName = "v_route_average_fare";
    }

    try {
      let q = supabase.from(viewName).select("*");
      if (companyId) {
        q = q.eq("company_id", companyId);
      }

      // 1. Date filters (only for average_fare which has date column)
      if (selectedReport === "average_fare") {
        if (filters.dateFrom) q = q.gte("date", filters.dateFrom);
        if (filters.dateTo) q = q.lte("date", filters.dateTo);
      }

      // 2. Month filters (for monthly_bus / route_fare which have month column)
      if (selectedReport !== "average_fare") {
        if (filters.monthFrom) q = q.gte("month", filters.monthFrom);
        if (filters.monthTo) q = q.lte("month", filters.monthTo);
      }

      // 3. Searchable filters
      if (filters.staff && selectedReport === "average_fare") {
        q = q.ilike("staff", `%${filters.staff}%`);
      }
      if (filters.bus) {
        q = q.ilike("bus", `%${filters.bus}%`);
      }
      if (filters.route && selectedReport !== "bus_fare") {
        q = q.ilike("route", `%${filters.route}%`);
      }

      // Limit rows - if filters are applied, let user choose but fall back to higher buffer if needed
      const currentLimit = hasActiveFilters ? 1000 : limit;
      q = q.limit(currentLimit);

      let { data, error } = await q;

      if (error && (error.code === "42703" || error.message?.includes("column"))) {
        // Fallback without company_id filter
        let retryQ = supabase.from(viewName).select("*");
        if (selectedReport === "average_fare") {
          if (filters.dateFrom) retryQ = retryQ.gte("date", filters.dateFrom);
          if (filters.dateTo) retryQ = retryQ.lte("date", filters.dateTo);
        } else {
          if (filters.monthFrom) retryQ = retryQ.gte("month", filters.monthFrom);
          if (filters.monthTo) retryQ = retryQ.lte("month", filters.monthTo);
        }
        if (filters.staff && selectedReport === "average_fare") {
          retryQ = retryQ.ilike("staff", `%${filters.staff}%`);
        }
        if (filters.bus) {
          retryQ = retryQ.ilike("bus", `%${filters.bus}%`);
        }
        if (filters.route && selectedReport !== "bus_fare") {
          retryQ = retryQ.ilike("route", `%${filters.route}%`);
        }
        retryQ = retryQ.limit(currentLimit);
        const { data: retryData, error: retryError } = await retryQ;
        if (retryError) throw retryError;
        data = retryData;
      } else if (error) {
        throw error;
      }

      setTableData(data || []);
    } catch (err: any) {
      console.error("Error loading tabular data:", err);
      setTableError(err.message || "Failed to load tabular report.");
    } finally {
      setTableLoading(false);
    }
  };

  // Run initial tabular load when selected tab rules shift
  useEffect(() => {
    if (activeSubTab === "tabular") {
      loadTabularData();
    }
  }, [selectedReport, activeSubTab, limit, currentUserProfile]);

  // Calculate active totals dynamically
  const totals = useMemo(() => {
    let passengers = 0;
    let income = 0;
    tableData.forEach((row) => {
      passengers += Number(row.total_passengers || 0);
      income += Number(row.total_income || 0);
    });
    return { passengers, income };
  }, [tableData]);

  // Read report-specific column setups
  const getColumnsForReport = () => {
    if (selectedReport === "average_fare") {
      return [
        { key: "date", label: "Date", type: "date" },
        { key: "staff", label: "Staff Profile", type: "text" },
        { key: "bus", label: "Bus Plate", type: "text" },
        { key: "route", label: "Route Segment", type: "text" },
        { key: "total_passengers", label: "Passengers", type: "number" },
        { key: "total_income", label: "Total Income", type: "money" },
        { key: "average_fare", label: "Avg Fare", type: "money" }
      ];
    }
    if (selectedReport === "bus_fare") {
      return [
        { key: "month", label: "Month", type: "month" },
        { key: "bus", label: "Bus Plate", type: "text" },
        { key: "total_passengers", label: "Passengers", type: "number" },
        { key: "total_income", label: "Total Income", type: "money" },
        { key: "monthly_average_fare", label: "Average Fare", type: "money" }
      ];
    }
    return [
      { key: "month", label: "Month", type: "month" },
      { key: "route", label: "Route Segment", type: "text" },
      { key: "total_passengers", label: "Passengers", type: "number" },
      { key: "total_income", label: "Total Income", type: "money" },
      { key: "route_average_fare", label: "Average Fare", type: "money" }
    ];
  };

  // Tooltip Components for Graphical charts
  const CustomTooltipHCE = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-neutral-900/95 border border-amber-500/30 p-2.5 rounded-lg shadow-xl backdrop-blur-md">
          <p className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">Month: {data.month}</p>
          <p className="text-xs font-semibold text-[#fbbf24] mt-1">
            HCE Efficiency: {Number(data.labor_to_revenue_percent || 0).toFixed(2)}%
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomTooltipBus = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-neutral-900/95 border border-amber-500/30 p-3 rounded-lg shadow-xl backdrop-blur-md space-y-1">
          <p className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">Month: {data.month}</p>
          <p className="text-xs font-semibold text-white">Bus: {data.bus || data.plate_number || "—"}</p>
          <p className="text-[11px] text-neutral-350">Passengers: {Number(data.total_passengers || 0).toLocaleString()}</p>
          <p className="text-[11px] text-neutral-350">Income: {formatMoney(data.total_income)}</p>
          <p className="text-xs font-bold text-amber-400 border-t border-white/5 pt-1 mt-1">
            Avg Fare: {formatMoney(data.monthly_average_fare)}
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomTooltipRoute = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-neutral-900/95 border border-amber-500/30 p-3 rounded-lg shadow-xl backdrop-blur-md space-y-1">
          {data.month && <p className="text-[10px] font-mono text-neutral-450 uppercase tracking-wider">Month: {data.month}</p>}
          <p className="text-xs font-semibold text-white">Route: {data.route || "—"}</p>
          <p className="text-[11px] text-neutral-350">Passengers: {Number(data.total_passengers || 0).toLocaleString()}</p>
          <p className="text-[11px] text-neutral-350">Income: {formatMoney(data.total_income)}</p>
          <p className="text-xs font-bold text-amber-400 border-t border-white/5 pt-1 mt-1">
            Avg Fare: {formatMoney(data.route_average_fare)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* HEADER BAR FOR BUSINESS ANALYSIS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-4">
        <div>
          <h3 className="text-lg font-serif font-black uppercase tracking-wider bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent flex items-center gap-2">
            <Sparkles className="h-4.5 w-4.5 text-amber-500" />
            Executive Business Analytics
          </h3>
          <p className="text-[11px] font-mono text-neutral-400 uppercase tracking-widest mt-0.5">
            Cloud ledger correlation & strategic intelligence
          </p>
        </div>

        {/* SUB TAB CONTROL CAPSULES */}
        <div className="flex p-0.5 bg-slate-950/80 border border-white/10 rounded-xl">
          <button
            onClick={() => setActiveSubTab("graphical")}
            className={`px-4 py-1.5 rounded-lg text-xs font-mono font-medium tracking-wider uppercase transition-all duration-200 cursor-pointer ${
              activeSubTab === "graphical"
                ? "bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                : "border border-transparent text-neutral-450 hover:text-neutral-200"
            }`}
          >
            Graphical View
          </button>
          <button
            onClick={() => setActiveSubTab("tabular")}
            className={`px-4 py-1.5 rounded-lg text-xs font-mono font-medium tracking-wider uppercase transition-all duration-200 cursor-pointer ${
              activeSubTab === "tabular"
                ? "bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                : "border border-transparent text-neutral-450 hover:text-neutral-200"
            }`}
          >
            Tabular Audits
          </button>
        </div>
      </div>

      {/* GRAPHICAL ANALYSIS VIEW */}
      {activeSubTab === "graphical" && (
        <div className="space-y-4">
          {/* GRAPH SELECTOR dropdown */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-zinc-900/40 p-4 border border-white/5 rounded-xl">
            <div className="space-y-1">
              <label className="block text-[9px] uppercase tracking-widest font-mono text-neutral-400">Selected Metric Vector</label>
              <select
                value={selectedGraph}
                onChange={(e) => setSelectedGraph(e.target.value as any)}
                className="bg-slate-950 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-amber-400 hover:border-amber-500/50 focus:outline-none focus:border-amber-500 transition-colors h-[34px]"
              >
                <option value="hce">Human Capital Efficiency (HCE)</option>
                <option value="bus_fare">Monthly Bus Average Fare</option>
                <option value="route_fare">Route Average Fare Analysis</option>
              </select>
            </div>

            <div className="text-right hidden sm:block">
              <span className="text-[10px] bg-amber-500/10 text-amber-400/90 border border-amber-500/15 px-2.5 py-1 rounded-md font-mono uppercase tracking-widest leading-none">
                Real-Time KPI Correlation
              </span>
            </div>
          </div>

          {/* VIEWPORT GRAPH CARDS */}
          <div className="bg-[#090b11]/40 border border-amber-500/10 rounded-2xl p-6 backdrop-blur-md relative min-h-[400px] flex flex-col justify-center">
            {/* Ambient indicator lights */}
            <div className="absolute top-[-5%] left-[-5%] w-[30%] h-[30%] bg-amber-500/5 blur-[80px] rounded-full pointer-events-none"></div>

            {graphLoading ? (
              <div className="flex flex-col items-center justify-center space-y-3 font-mono">
                <Sparkles className="h-6 w-6 text-amber-500 animate-spin" />
                <span className="text-[10px] tracking-[0.25em] text-neutral-400">GENERATING GRAPH VISUALIZATION...</span>
              </div>
            ) : graphError ? (
              <div className="text-center p-8 border border-red-500/15 bg-red-500/5 rounded-xl space-y-2">
                <p className="text-sm font-semibold text-red-400 font-serif">Visualization Error</p>
                <p className="text-xs font-mono text-red-300/80">{graphError}</p>
              </div>
            ) : graphData.length === 0 ? (
              <div className="text-center p-12 space-y-2 font-mono">
                <p className="text-xs uppercase tracking-wider text-neutral-455 font-bold">No Records Resolved</p>
                <p className="text-[10px] text-neutral-500">No operational ledger rows matching company parameters exist.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <span className="text-[10px] font-mono uppercase bg-neutral-900/80 px-2 py-0.5 rounded text-neutral-400">
                    {selectedGraph === "hce" && "Month-over-month Labor cost % against revenue"}
                    {selectedGraph === "bus_fare" && "Aggregated monthly average passenger fares by fleet bus"}
                    {selectedGraph === "route_fare" && "Average transaction value breakdown per dispatch route"}
                  </span>
                  <span className="text-[10px] font-mono text-amber-400/80">{graphData.length} records parsed</span>
                </div>

                <div className="w-full h-[320px] md:h-[380px]">
                  <ResponsiveContainer width="100%" height="100%">
                    {selectedGraph === "hce" ? (
                      <LineChart data={graphData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff04" />
                        <XAxis dataKey="month" stroke="#a3a3a3" fontSize={9} tickLine={false} axisLine={false} />
                        <YAxis stroke="#a3a3a3" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                        <Tooltip content={<CustomTooltipHCE />} />
                        <Line
                          type="monotone"
                          dataKey="labor_to_revenue_percent"
                          name="HCE Rate"
                          stroke="#fbbf24"
                          strokeWidth={2.5}
                          dot={{ r: 3, fill: "#fbbf24", strokeWidth: 1 }}
                          activeDot={{ r: 6, strokeWidth: 0 }}
                        />
                      </LineChart>
                    ) : selectedGraph === "bus_fare" ? (
                      <BarChart data={graphData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff04" />
                        <XAxis dataKey="month" stroke="#a3a3a3" fontSize={9} tickLine={false} axisLine={false} />
                        <YAxis stroke="#a3a3a3" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(v) => formatMoney(v).replace(" TZS", "")} />
                        <Tooltip content={<CustomTooltipBus />} />
                        <Bar
                          dataKey="monthly_average_fare"
                          name="Monthly Average Fare"
                          fill="#f59e0b"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={50}
                        />
                      </BarChart>
                    ) : (
                      <BarChart data={graphData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff04" />
                        <XAxis dataKey="route" stroke="#a3a3a3" fontSize={9} tickLine={false} axisLine={false} />
                        <YAxis stroke="#a3a3a3" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(v) => formatMoney(v).replace(" TZS", "")} />
                        <Tooltip content={<CustomTooltipRoute />} />
                        <Bar
                          dataKey="route_average_fare"
                          name="Route Average Fare"
                          fill="#d97706"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={60}
                        />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TABULAR ANALYSIS VIEW */}
      {activeSubTab === "tabular" && (
        <div className="space-y-4">
          {/* TABULAR SELECTOR dropdown */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-zinc-900/40 p-4 border border-white/5 rounded-xl">
            <div className="space-y-1">
              <label className="block text-[9px] uppercase tracking-widest font-mono text-neutral-400">Selected Ledger View</label>
              <select
                value={selectedReport}
                onChange={(e) => {
                  setSelectedReport(e.target.value as any);
                  setFilters({ dateFrom: "", dateTo: "", monthFrom: "", monthTo: "", staff: "", bus: "", route: "" });
                  setTableData([]);
                }}
                className="bg-slate-950 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-amber-400 hover:border-amber-500/50 focus:outline-none focus:border-amber-500 transition-colors h-[34px]"
              >
                <option value="average_fare">Combined Average Fare Report</option>
                <option value="bus_fare">Monthly Bus Average Fare Ledger</option>
                <option value="route_fare">Route Average Fare Ledger</option>
              </select>
            </div>

            <div className="text-right hidden sm:block">
              <span className="text-[10px] bg-amber-500/10 text-amber-400/90 border border-amber-500/15 px-2.5 py-1 rounded-md font-mono uppercase tracking-widest leading-none">
                Tabular Analytics Desk
              </span>
            </div>
          </div>

          {/* DYNAMIC FORM SEGMENT */}
          <form
            onSubmit={(e) => { e.preventDefault(); loadTabularData(); }}
            className="bg-zinc-950/60 border border-amber-500/10 p-4 rounded-xl flex flex-col gap-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {/* Date Filters: Only for Combined Average Fare */}
              {selectedReport === "average_fare" && (
                <>
                  <div>
                    <label className="block text-[9px] uppercase tracking-wider font-mono text-neutral-400 mb-1">Date From</label>
                    <input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                      className="w-full bg-[#050608] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:border-amber-500/50 focus:outline-none h-[32px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase tracking-wider font-mono text-neutral-400 mb-1">Date To</label>
                    <input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                      className="w-full bg-[#050608] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:border-amber-500/50 focus:outline-none h-[32px]"
                    />
                  </div>
                </>
              )}

              {/* Month Filters: For Monthly Bus & Route Average Fare */}
              {selectedReport !== "average_fare" && (
                <>
                  <div>
                    <label className="block text-[9px] uppercase tracking-wider font-mono text-neutral-400 mb-1">Month From</label>
                    <input
                      type="month"
                      value={filters.monthFrom}
                      onChange={(e) => setFilters(prev => ({ ...prev, monthFrom: e.target.value }))}
                      className="w-full bg-[#050608] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:border-amber-500/50 focus:outline-none h-[32px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase tracking-wider font-mono text-neutral-400 mb-1">Month To</label>
                    <input
                      type="month"
                      value={filters.monthTo}
                      onChange={(e) => setFilters(prev => ({ ...prev, monthTo: e.target.value }))}
                      className="w-full bg-[#050608] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:border-amber-500/50 focus:outline-none h-[32px]"
                    />
                  </div>
                </>
              )}

              {/* Staff Match Filter (Combined only) */}
              {selectedReport === "average_fare" && (
                <div>
                  <label className="block text-[9px] uppercase tracking-wider font-mono text-neutral-400 mb-1">Staff Name</label>
                  <input
                    type="text"
                    placeholder="E.g. Juma Ali..."
                    value={filters.staff}
                    onChange={(e) => setFilters(prev => ({ ...prev, staff: e.target.value }))}
                    className="w-full bg-[#050608] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-neutral-600 focus:border-amber-500/50 focus:outline-none h-[32px]"
                  />
                </div>
              )}

              {/* Bus plate segment (Combined & Monthly Bus) */}
              {selectedReport !== "route_fare" && (
                <div>
                  <label className="block text-[9px] uppercase tracking-wider font-mono text-neutral-400 mb-1">Bus Plate Number</label>
                  <input
                    type="text"
                    placeholder="Search plate..."
                    value={filters.bus}
                    onChange={(e) => setFilters(prev => ({ ...prev, bus: e.target.value }))}
                    className="w-full bg-[#050608] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-neutral-600 focus:border-amber-500/50 focus:outline-none h-[32px]"
                  />
                </div>
              )}

              {/* Route Match Filter (Combined & Route average) */}
              {selectedReport !== "bus_fare" && (
                <div>
                  <label className="block text-[9px] uppercase tracking-wider font-mono text-neutral-400 mb-1">Dispatch Route</label>
                  <input
                    type="text"
                    placeholder="Search route..."
                    value={filters.route}
                    onChange={(e) => setFilters(prev => ({ ...prev, route: e.target.value }))}
                    className="w-full bg-[#050608] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-neutral-600 focus:border-amber-500/50 focus:outline-none h-[32px]"
                  />
                </div>
              )}
            </div>

            {/* Bottom buttons controller bar */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2 border-t border-white/5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase text-neutral-400">Rows Cap:</span>
                <select
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="bg-slate-950 border border-white/15 rounded px-2.5 py-1 text-[11px] text-white focus:outline-none focus:border-amber-500 transition-all h-7"
                >
                  <option value={50}>50 lines</option>
                  <option value={100}>100 lines</option>
                  <option value={200}>200 lines</option>
                  <option value={500}>500 lines</option>
                </select>
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setFilters({ dateFrom: "", dateTo: "", monthFrom: "", monthTo: "", staff: "", bus: "", route: "" });
                    setTableData([]);
                    // Short defer load
                    setTimeout(() => loadTabularData(), 50);
                  }}
                  className="px-4 py-1.5 w-1/2 sm:w-auto border border-white/10 text-neutral-400 hover:text-white rounded-lg text-xs font-mono tracking-wider uppercase cursor-pointer transition-colors"
                >
                  Reset
                </button>

                <button
                  type="submit"
                  disabled={tableLoading}
                  className="px-5 py-1.5 w-1/2 sm:w-auto bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-semibold rounded-lg text-xs font-mono tracking-wider uppercase shadow-[0_0_15px_rgba(245,158,11,0.2)] cursor-pointer transition-colors flex items-center justify-center gap-1"
                >
                  {tableLoading ? (
                    <>
                      <Sparkles className="h-3.5 w-3.5 text-black animate-spin" />
                      FETCHING...
                    </>
                  ) : (
                    "RUN LEDGER QUERY"
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* SPREADSHEET TABLE PREVIEW */}
          <div className="bg-[#090b11]/40 border border-amber-500/10 rounded-2xl p-5 backdrop-blur-md relative min-h-[300px] flex flex-col justify-center">
            {tableLoading ? (
              <div className="flex flex-col items-center justify-center space-y-2 py-12 font-mono">
                <Sparkles className="h-6 w-6 text-amber-500 animate-spin" />
                <span className="text-[10px] tracking-[0.25em] text-neutral-400">CORRELATING DATA TRANSACTIONS...</span>
              </div>
            ) : tableError ? (
              <div className="text-center p-8 border border-red-500/15 bg-red-500/5 rounded-xl space-y-2 my-4">
                <p className="text-sm font-semibold text-red-400 font-serif">Cloud Ledger Query Error</p>
                <p className="text-xs font-mono text-red-350/80">{tableError}</p>
              </div>
            ) : tableData.length === 0 ? (
              <div className="text-center p-12 space-y-2 font-mono">
                <p className="text-xs uppercase tracking-wider text-neutral-450 font-bold">No Records Found</p>
                <p className="text-[10.5px] text-neutral-500">Provide different filter criteria or seed entries in the operative module.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Information Header */}
                <div className="flex justify-between items-center px-1 font-mono text-[9px] text-neutral-450 uppercase">
                  <span>Audit preview ledger matched rows</span>
                  <span className="text-amber-400 font-semibold">{tableData.length} records</span>
                </div>

                {/* Live spreadsheet table */}
                <div className="overflow-x-auto relative rounded-xl border border-white/5 scrollbar-thin scrollbar-thumb-white/10">
                  <table className="w-full text-left border-collapse font-sans text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-[9px] font-mono whitespace-nowrap uppercase tracking-widest text-[#fbbf24] bg-neutral-900/60 sticky top-0">
                        {getColumnsForReport().map((col) => (
                          <th key={col.key} className="p-3 font-semibold text-left">
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {tableData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-amber-500/2 transition-colors">
                          {getColumnsForReport().map((col) => {
                            const val = row[col.key];
                            const isNum = col.type === "number";
                            const isMoney = col.type === "money";
                            return (
                              <td key={col.key} className={`p-3 whitespace-nowrap ${isNum || isMoney ? "font-mono" : ""}`}>
                                {isMoney 
                                  ? formatMoney(val)
                                  : isNum 
                                  ? Number(val || 0).toLocaleString()
                                  : val === undefined || val === null
                                  ? "—"
                                  : String(val)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}

                      {/* Dynamic Totals Summary Row at Bottom */}
                      <tr className="bg-amber-500/3 font-bold font-mono text-[11px] border-t-2 border-amber-500/20 text-amber-400">
                        {getColumnsForReport().map((col, idx) => {
                          if (idx === 0) {
                            return (
                              <td key={col.key} className="p-3 whitespace-nowrap uppercase tracking-wider text-white">
                                METRIC SUMMARY
                              </td>
                            );
                          }
                          if (col.key === "total_passengers") {
                            return (
                              <td key={col.key} className="p-3 whitespace-nowrap">
                                {totals.passengers.toLocaleString()}
                              </td>
                            );
                          }
                          if (col.key === "total_income") {
                            return (
                              <td key={col.key} className="p-3 whitespace-nowrap">
                                {formatMoney(totals.income)}
                              </td>
                            );
                          }
                          return (
                            <td key={col.key} className="p-3 whitespace-nowrap text-neutral-500">
                              —
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
