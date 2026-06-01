import React, { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  Users, 
  Coins, 
  FileText, 
  Activity, 
  Search, 
  Settings, 
  LogOut, 
  ArrowLeft, 
  Menu,
  ChevronRight, 
  ChevronLeft, 
  SlidersHorizontal, 
  X, 
  ChevronDown, 
  UserPlus, 
  Plus, 
  Trash2, 
  Check, 
  AlertTriangle, 
  Send, 
  Inbox, 
  FileBarChart, 
  UserCheck, 
  Calendar, 
  TrendingUp, 
  Mail, 
  Compass, 
  RefreshCw, 
  Briefcase,
  Banknote,
  ReceiptText,
  IdCard,
  Download,
  Filter,
  Eraser
} from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase, resolveProfile, getActiveCompanyId } from "../lib/supabase";
import { 
  ResponsiveContainer, 
  AreaChart, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Area 
} from "recharts";

interface HRPageProps {
  session: any;
  onLogout: () => void;
}

type TabType = "dashboard" | "transactions" | "staff" | "actions" | "memos" | "reports";

// Searchable Select Option Type
interface Option {
  id: string;
  name: string;
}

// Searchable select component
interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  disabled?: boolean;
}

function SearchableSelect({ options, value, onChange, placeholder, disabled }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.id === value);
  const filtered = options.filter(o => o.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        onClick={() => { if (!disabled) { setIsOpen(!isOpen); setSearch(""); } }}
        className={`w-full bg-[#1a080c]/90 border ${isOpen ? "border-amber-500/50" : "border-white/10"} rounded-xl px-3 py-2 text-xs text-white flex justify-between items-center cursor-pointer h-[40px] transition-all ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <span className={selectedOption ? "text-neutral-150" : "text-neutral-500"}>
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
      </div>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-[#1a070a] border border-amber-500/30 rounded-xl shadow-[0_15px_30px_rgba(0,0,0,0.6)] p-2 space-y-1 backdrop-blur-md">
          <input
            type="text"
            className="w-full bg-[#270e13] border border-white/5 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-amber-500/40 font-mono"
            placeholder="Type to filter..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className="divide-y divide-white/5 max-h-40 overflow-y-auto custom-scrollbar">
            {filtered.length === 0 ? (
              <div className="p-2 text-center text-[10px] text-neutral-500 font-mono">No matches found</div>
            ) : (
              filtered.map(opt => (
                <div
                  key={opt.id}
                  onClick={() => {
                    onChange(opt.id);
                    setIsOpen(false);
                  }}
                  className={`p-2 hover:bg-amber-950/30 text-xs text-neutral-200 hover:text-amber-400 cursor-pointer rounded-lg transition-all ${value === opt.id ? "bg-amber-950/20 text-amber-400 font-medium" : ""}`}
                >
                  {opt.name}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function HRPage({ session, onLogout }: HRPageProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [currentUserRoleName, setCurrentUserRoleName] = useState<string>("");
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [companyName, setCompanyName] = useState<string>("Company Name");

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
        console.error("Failed to load company name in HR:", err);
        setCompanyName("Company Name");
      }
    }
    fetchCompany();
  }, [currentUserProfile]);

  // ==========================================================================
  // SECTION 6: REPORTS WORKSPACE PORTAL STATES & CONFS
  // ==========================================================================
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // Filters state
  const [filterMonthFrom, setFilterMonthFrom] = useState("");
  const [filterMonthTo, setFilterMonthTo] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterTextStaff, setFilterTextStaff] = useState("");
  const [filterTextOffice, setFilterTextOffice] = useState("");
  const [filterTextOccupation, setFilterTextOccupation] = useState("");
  const [filterTextStatus, setFilterTextStatus] = useState("");

  const [appliedFilters, setAppliedFilters] = useState<{
    isFiltered: boolean;
    monthFrom?: string;
    monthTo?: string;
    dateFrom?: string;
    dateTo?: string;
    staff?: string;
    office?: string;
    occupation?: string;
    status?: string;
  }>({ isFiltered: false });

  const formatTZSMoney = (val: any) => {
    if (val === undefined || val === null || isNaN(Number(val))) return "TZS 0";
    return "TZS " + Number(val).toLocaleString();
  };

  const reportsConfig = useMemo(() => [
    {
      id: "payroll_statement",
      name: "Payroll Statement",
      category: "Payroll & Payments" as const,
      view: "v_salary_statement",
      layout: "landscape" as const,
      icon: Banknote,
      hasCompanyId: true,
      columns: [
        { key: "month", label: "Month", type: "month" as const, align: "left" as const },
        { key: "staff", label: "Staff", type: "text" as const, align: "left" as const },
        { key: "office", label: "Office", type: "text" as const, align: "left" as const },
        { key: "basic_salary", label: "Basic Salary", type: "number" as const, align: "right" as const },
        { key: "allowances", label: "Allowances", type: "number" as const, align: "right" as const },
        { key: "gross_salary", label: "Gross Salary", type: "number" as const, align: "right" as const },
        { key: "deductions", label: "Deductions", type: "number" as const, align: "right" as const },
        { key: "net_pay", label: "Net Pay", type: "number" as const, align: "right" as const }
      ]
    },
    {
      id: "wages_report",
      name: "Wages Report",
      category: "Payroll & Payments" as const,
      view: "v_monthly_wages_statement",
      layout: "portrait" as const,
      icon: Coins,
      hasCompanyId: true,
      columns: [
        { key: "month", label: "Month", type: "month" as const, align: "left" as const },
        { key: "staff", label: "Staff", type: "text" as const, align: "left" as const },
        { key: "office", label: "Office", type: "text" as const, align: "left" as const },
        { key: "amount", label: "Amount", type: "number" as const, align: "right" as const }
      ]
    },
    {
      id: "total_monthly_staff_payment",
      name: "Total Monthly Staff Payment",
      category: "Payroll & Payments" as const,
      view: "v_total_payment_to_staff",
      layout: "landscape" as const,
      icon: ReceiptText,
      hasCompanyId: true,
      columns: [
        { key: "month", label: "Month", type: "month" as const, align: "left" as const },
        { key: "staff", label: "Staff", type: "text" as const, align: "left" as const },
        { key: "office", label: "Office", type: "text" as const, align: "left" as const },
        { key: "occupation", label: "Occupation", type: "text" as const, align: "left" as const },
        { key: "net_pay", label: "Net Pay", type: "number" as const, align: "right" as const },
        { key: "total_wages", label: "Total Wages", type: "number" as const, align: "right" as const },
        { key: "total_paid", label: "Total Paid", type: "number" as const, align: "right" as const }
      ]
    },
    {
      id: "staff_performance",
      name: "Staff Performance",
      category: "Performance & Shortages" as const,
      view: "v_staff_performance",
      layout: "portrait" as const,
      icon: TrendingUp,
      hasCompanyId: false,
      columns: [
        { key: "month", label: "Month", type: "month" as const, align: "left" as const },
        { key: "staff", label: "Staff", type: "text" as const, align: "left" as const },
        { key: "office", label: "Office", type: "text" as const, align: "left" as const },
        { key: "income", label: "Income", type: "number" as const, align: "right" as const }
      ]
    },
    {
      id: "staff_shortages",
      name: "Staff Shortages",
      category: "Performance & Shortages" as const,
      view: "v_staff_shortage",
      layout: "portrait" as const,
      icon: AlertTriangle,
      hasCompanyId: true,
      columns: [
        { key: "staff_name", label: "Staff Name", type: "text" as const, align: "left" as const },
        { key: "occupation", label: "Occupation", type: "text" as const, align: "left" as const },
        { key: "office", label: "Office", type: "text" as const, align: "left" as const },
        { key: "shortage", label: "Shortage", type: "number" as const, align: "right" as const }
      ]
    },
    {
      id: "daily_buses",
      name: "Daily Buses",
      category: "Performance & Shortages" as const,
      view: "v_daily_bus_operations",
      layout: "landscape" as const,
      icon: Calendar,
      hasCompanyId: true,
      columns: [
        { key: "date", label: "Date", type: "date" as const, align: "left" as const },
        { key: "conductor", label: "Conductor", type: "text" as const, align: "left" as const },
        { key: "driver", label: "Driver", type: "text" as const, align: "left" as const },
        { key: "bus", label: "Bus", type: "text" as const, align: "left" as const },
        { key: "route", label: "Route", type: "text" as const, align: "left" as const },
        { key: "one_way", label: "Oneway", type: "number" as const, align: "right" as const },
        { key: "enroute", label: "Enroute", type: "number" as const, align: "right" as const },
        { key: "total", label: "Total", type: "number" as const, align: "right" as const },
        { key: "user_id", label: "User ID", type: "text" as const, align: "left" as const }
      ]
    },
    {
      id: "staff_details",
      name: "Staff Details",
      category: "Staff Master Data" as const,
      view: "v_staff_details",
      layout: "landscape" as const,
      icon: IdCard,
      hasCompanyId: true,
      columns: [
        { key: "full_name", label: "Full Name", type: "text" as const, align: "left" as const },
        { key: "office", label: "Office", type: "text" as const, align: "left" as const },
        { key: "occupation", label: "Occupation", type: "text" as const, align: "left" as const },
        { key: "phone_number", label: "Phone Number", type: "text" as const, align: "left" as const },
        { key: "account_number", label: "Account Number", type: "text" as const, align: "left" as const },
        { key: "tin_number", label: "TIN", type: "text" as const, align: "left" as const },
        { key: "nida_number", label: "NIDA Number", type: "text" as const, align: "left" as const },
        { key: "address", label: "Address", type: "text" as const, align: "left" as const },
        { key: "employment_date", label: "Employment Date", type: "date" as const, align: "left" as const },
        { key: "status", label: "Status", type: "text" as const, align: "center" as const }
      ]
    }
  ], []);

  const activeReport = useMemo(() => {
    return reportsConfig.find(r => r.id === activeReportId) || null;
  }, [reportsConfig, activeReportId]);

  const loadReportData = async (targetReportId?: string, forceFilters?: any) => {
    const rId = targetReportId || activeReportId;
    if (!rId) return;

    const reportObj = reportsConfig.find(r => r.id === rId);
    if (!reportObj) return;

    try {
      setReportLoading(true);
      setReportError(null);

      let query = supabase.from(reportObj.view).select("*");

      // Check for company_id filtering requirement
      const companyId = currentUserProfile?.company_id;
      if (companyId && reportObj.hasCompanyId) {
        query = query.eq("company_id", companyId);
      }

      const activeAndAppliedFilters = forceFilters !== undefined ? forceFilters : appliedFilters;

      if (activeAndAppliedFilters.isFiltered) {
        // Apply Month filter
        if (activeAndAppliedFilters.monthFrom) {
          query = query.gte("month", activeAndAppliedFilters.monthFrom);
        }
        if (activeAndAppliedFilters.monthTo) {
          query = query.lte("month", activeAndAppliedFilters.monthTo);
        }

        // Apply Date filter (e.g., employment_date)
        const dateCol = reportObj.columns.find(c => c.type === "date")?.key;
        if (dateCol) {
          if (activeAndAppliedFilters.dateFrom) {
            query = query.gte(dateCol, activeAndAppliedFilters.dateFrom);
          }
          if (activeAndAppliedFilters.dateTo) {
            query = query.lte(dateCol, activeAndAppliedFilters.dateTo);
          }
        }

        // Apply Text filters: staff, office, occupation, status
        const textCols = reportObj.columns.filter(c => c.type === "text").map(c => c.key);

        if (activeAndAppliedFilters.staff) {
          const staffCol = textCols.find(k => k === "staff" || k === "staff_name" || k === "full_name");
          if (staffCol) {
            query = query.ilike(staffCol, `%${activeAndAppliedFilters.staff}%`);
          }
        }

        if (activeAndAppliedFilters.office) {
          const officeCol = textCols.find(k => k === "office");
          if (officeCol) {
            query = query.ilike(officeCol, `%${activeAndAppliedFilters.office}%`);
          }
        }

        if (activeAndAppliedFilters.occupation) {
          const occCol = textCols.find(k => k === "occupation");
          if (occCol) {
            query = query.ilike(occCol, `%${activeAndAppliedFilters.occupation}%`);
          }
        }

        if (activeAndAppliedFilters.status) {
          const statusCol = textCols.find(k => k === "status");
          if (statusCol) {
            query = query.ilike(statusCol, `%${activeAndAppliedFilters.status}%`);
          }
        }
      } else {
        // Default preview limit of 100 rows
        query = query.limit(100);
      }

      const { data, error } = await query;
      if (error) throw error;

      setReportData(data || []);
    } catch (err: any) {
      console.error("Failed fetching report data:", err);
      setReportError(err.message || String(err));
      setReportData([]);
    } finally {
      setReportLoading(false);
    }
  };

  const handleApplyFilters = () => {
    const hasAnyFilter = !!(
      filterMonthFrom ||
      filterMonthTo ||
      filterDateFrom ||
      filterDateTo ||
      filterTextStaff ||
      filterTextOffice ||
      filterTextOccupation ||
      filterTextStatus
    );

    const nextFilters = {
      isFiltered: hasAnyFilter,
      monthFrom: filterMonthFrom || undefined,
      monthTo: filterMonthTo || undefined,
      dateFrom: filterDateFrom || undefined,
      dateTo: filterDateTo || undefined,
      staff: filterTextStaff || undefined,
      office: filterTextOffice || undefined,
      occupation: filterTextOccupation || undefined,
      status: filterTextStatus || undefined,
    };

    setAppliedFilters(nextFilters);
    loadReportData(activeReportId, nextFilters);
  };

  const handleClearFilters = () => {
    setFilterMonthFrom("");
    setFilterMonthTo("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterTextStaff("");
    setFilterTextOffice("");
    setFilterTextOccupation("");
    setFilterTextStatus("");

    const cleared = { isFiltered: false };
    setAppliedFilters(cleared);
    loadReportData(activeReportId, cleared);
  };

  const handleExportExcel = () => {
    if (!activeReport || reportData.length === 0) return;

    try {
      const reportName = activeReport.name;

      const headers = activeReport.columns.map(c => c.label);
      
      const filterSummary: string[] = [];
      if (appliedFilters.isFiltered) {
        if (appliedFilters.monthFrom) filterSummary.push(`Month From: ${appliedFilters.monthFrom}`);
        if (appliedFilters.monthTo) filterSummary.push(`Month To: ${appliedFilters.monthTo}`);
        if (appliedFilters.dateFrom) filterSummary.push(`Date From: ${appliedFilters.dateFrom}`);
        if (appliedFilters.dateTo) filterSummary.push(`Date To: ${appliedFilters.dateTo}`);
        if (appliedFilters.staff) filterSummary.push(`Staff: ${appliedFilters.staff}`);
        if (appliedFilters.office) filterSummary.push(`Office: ${appliedFilters.office}`);
        if (appliedFilters.occupation) filterSummary.push(`Occupation: ${appliedFilters.occupation}`);
        if (appliedFilters.status) filterSummary.push(`Status: ${appliedFilters.status}`);
      }
      const filterSummaryText = filterSummary.length > 0 ? filterSummary.join(" | ") : "None (First 100 Rows Preview)";

      const aoa: any[][] = [
        [companyName.toString().toUpperCase()],
        [reportName.toUpperCase()],
        ["Exported At: " + new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString()],
        ["Applied Filters: " + filterSummaryText],
        [],
        headers
      ];

      reportData.forEach(row => {
        aoa.push(
          activeReport.columns.map(col => {
            const val = row[col.key];
            if (col.type === "number" && val !== undefined && val !== null) {
              return Number(val);
            }
            if (col.type === "date" && val) {
              return String(val).split("T")[0];
            }
            return val === undefined || val === null ? "" : String(val);
          })
        );
      });

      // Calculate totals row
      const totalsRow = activeReport.columns.map((col, idx) => {
        if (idx === 0) return "TOTAL";
        if ([
          "basic_salary", "allowances", "gross_salary", "deductions", "net_pay",
          "shortage", "amount", "income", "total_wages", "total_paid"
        ].includes(col.key)) {
          const sum = reportData.reduce((acc, row) => acc + (Number(row[col.key]) || 0), 0);
          return sum;
        }
        if (["one_way", "enroute", "total"].includes(col.key)) {
          const sum = reportData.reduce((acc, row) => acc + (Number(row[col.key]) || 0), 0);
          return sum;
        }
        return "";
      });
      aoa.push(totalsRow);

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "HR Report");
      XLSX.writeFile(wb, `${reportName.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`);

    } catch (e) {
      console.error("Failed Excel export:", e);
    }
  };

  const handleExportPDF = () => {
    if (!activeReport || reportData.length === 0) return;

    try {
      const reportName = activeReport.name;

      const doc = new jsPDF({
        orientation: activeReport.layout,
        unit: "mm",
        format: "a4"
      });

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(245, 158, 11);
      doc.text(companyName.toString().toUpperCase(), 14, 15);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(150, 150, 150);
      doc.text(reportName, 14, 21);

      const filterSummary: string[] = [];
      if (appliedFilters.isFiltered) {
        if (appliedFilters.monthFrom) filterSummary.push(`Month From: ${appliedFilters.monthFrom}`);
        if (appliedFilters.monthTo) filterSummary.push(`Month To: ${appliedFilters.monthTo}`);
        if (appliedFilters.dateFrom) filterSummary.push(`Date From: ${appliedFilters.dateFrom}`);
        if (appliedFilters.dateTo) filterSummary.push(`Date To: ${appliedFilters.dateTo}`);
        if (appliedFilters.staff) filterSummary.push(`Staff: ${appliedFilters.staff}`);
        if (appliedFilters.office) filterSummary.push(`Office: ${appliedFilters.office}`);
        if (appliedFilters.occupation) filterSummary.push(`Occupation: ${appliedFilters.occupation}`);
        if (appliedFilters.status) filterSummary.push(`Status: ${appliedFilters.status}`);
      }
      const filterText = filterSummary.length > 0 ? `Filters: ${filterSummary.join(" | ")}` : "Filters: None (First 100 Rows Preview)";

      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(filterText, 14, 27);

      const headers = activeReport.columns.map(c => c.label);
      const rows = reportData.map(row => {
        return activeReport.columns.map(col => {
          const val = row[col.key];
          if ([
            "basic_salary", "allowances", "gross_salary", "deductions", "net_pay",
            "shortage", "amount", "income", "total_wages", "total_paid"
          ].includes(col.key)) {
            return formatTZSMoney(val);
          }
          if (col.type === "date" && val) {
            return String(val).split("T")[0];
          }
          return val === undefined || val === null ? "" : String(val);
        });
      });

      const footerRow = activeReport.columns.map((col, idx) => {
        if (idx === 0) return "TOTAL";
        if ([
          "basic_salary", "allowances", "gross_salary", "deductions", "net_pay",
          "shortage", "amount", "income", "total_wages", "total_paid"
        ].includes(col.key)) {
          const sum = reportData.reduce((acc, row) => acc + (Number(row[col.key]) || 0), 0);
          return formatTZSMoney(sum);
        }
        if (["one_way", "enroute", "total"].includes(col.key)) {
          const sum = reportData.reduce((acc, row) => acc + (Number(row[col.key]) || 0), 0);
          return String(sum);
        }
        return "";
      });

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
          textColor: [245, 158, 11],
          fontStyle: "bold"
        },
        footStyles: {
          fillColor: [18, 18, 18],
          textColor: [245, 158, 11],
          fontStyle: "bold"
        },
        columnStyles: activeReport.columns.reduce((acc, col, idx) => {
          acc[idx] = { halign: col.align === "right" ? "right" : "left" };
          return acc;
        }, {} as any),
      });

      doc.save(`${reportName.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (err) {
      console.error("Failed PDF export:", err);
    }
  };

  useEffect(() => {
    if (activeTab === "reports" && activeReportId) {
      loadReportData();
    }
  }, [activeReportId, activeTab]);

  // Load User Profile
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
        console.error("Error fetching user profile in HR:", err);
      } finally {
        setIsProfileLoading(false);
      }
    }
    fetchUserProfile();
  }, [session]);

  // Unified lookup state at page level (cached, loaded once check)
  const [lookups, setLookups] = useState<{
    cashTypes: Option[];
    staffs: Option[];
    buses: Option[];
    routes: Option[];
    accounts: Option[];
    categories: Option[];
    transactionStatuses: any[];
    occupations: Option[];
    offices: Option[];
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
    transactionStatuses: [],
    occupations: [],
    offices: [],
    loaded: false,
    loading: false,
    error: null,
  });

  // Load Lookups on Profile Load Success
  const loadAllLookups = async () => {
    if (!currentUserProfile) return;
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
      let qStatuses = supabase.from("transaction_statuses").select("*");
      let qOccupations = supabase.from("occupations").select("id, occupation_name");
      let qOffices = supabase.from("offices").select("id, office_name").eq("is_active", true);

      if (companyId) {
        qStaffs = qStaffs.eq("company_id", companyId);
        qBuses = qBuses.eq("company_id", companyId);
        qRoutes = qRoutes.eq("company_id", companyId);
        qAccounts = qAccounts.eq("company_id", companyId);
        qCategories = qCategories.eq("company_id", companyId);
        qOffices = qOffices.eq("company_id", companyId);
      }

      const [
        resCashTypes,
        resStaffs,
        resBuses,
        resRoutes,
        resAccounts,
        resCategories,
        resStatuses,
        resOccupations,
        resOffices
      ] = await Promise.all([
        qCashTypes,
        qStaffs,
        qBuses,
        qRoutes,
        qAccounts,
        qCategories,
        qStatuses,
        qOccupations,
        qOffices
      ]);

      setLookups({
        cashTypes: resCashTypes.data?.map(o => ({ id: o.id, name: o.type_name })) || [],
        staffs: resStaffs.data?.map(o => ({ id: o.id, name: o.full_name })) || [],
        buses: resBuses.data?.map(o => ({ id: o.id, name: o.plate_number })) || [],
        routes: resRoutes.data?.map(o => ({ id: o.id, name: o.route_name })) || [],
        accounts: resAccounts.data?.map(o => ({ id: o.id, name: o.account_name })) || [],
        categories: resCategories.data?.map(o => ({ id: o.id, name: o.category_name })) || [],
        transactionStatuses: resStatuses.data || [],
        occupations: resOccupations.data?.map(o => ({ id: o.id, name: o.occupation_name })) || [],
        offices: resOffices.data?.map(o => ({ id: o.id, name: o.office_name })) || [],
        loaded: true,
        loading: false,
        error: null
      });
    } catch (err: any) {
      console.error("Failed loading lookup tables in HR:", err);
      setLookups(prev => ({ ...prev, loading: false, error: err.message || String(err) }));
    }
  };

  useEffect(() => {
    if (currentUserProfile) {
      loadAllLookups();
    }
  }, [currentUserProfile]);

  // ==========================================================================
  // SECTION 1: HR DASHBOARD STATE & DATA LOADER
  // ==========================================================================
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [stats, setStats] = useState({
    staffCount: 0,
    monthlyWages: 0,
    shortages: [] as any[],
    performers: [] as any[],
    wagesTrend: [] as any[]
  });

  const loadDashboardMetrics = async () => {
    if (!currentUserProfile) return;
    try {
      setDashboardLoading(true);
      const companyId = currentUserProfile.company_id;
      const d = new Date();
      const currentMonthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

      // 1. Staff count
      let qStaff = supabase.from("staffs").select("*", { count: "exact", head: true });
      if (companyId) qStaff = qStaff.eq("company_id", companyId);
      const resStaff = await qStaff;

      // 2. Wages this month
      const { data: resWages, error: wErr } = await supabase
        .from("v_monthly_expenses_report")
        .select("*")
        .eq("month", currentMonthStr)
        .eq("account", "Wages");

      let activeWagesThisMonth = 0;
      if (!wErr && resWages && resWages.length > 0) {
        activeWagesThisMonth = resWages.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
      }

      // 3. Top shortages
      let qShortages = supabase.from("v_staff_shortage").select("*");
      if (companyId) qShortages = qShortages.eq("company_id", companyId);
      const resShortages = await qShortages.order("shortage", { ascending: false }).limit(3);

      // 4. Top performers
      const { data: resPerformers } = await supabase
        .from("v_staff_performance")
        .select("*")
        .eq("month", currentMonthStr)
        .order("income", { ascending: false })
        .limit(3);

      // 5. Wages Trend
      const { data: resTrend } = await supabase
        .from("v_monthly_expenses_report")
        .select("*")
        .eq("account", "Wages")
        .order("month", { ascending: true });

      setStats({
        staffCount: resStaff.count || 0,
        monthlyWages: activeWagesThisMonth,
        shortages: resShortages.data || [],
        performers: resPerformers || [],
        wagesTrend: resTrend || []
      });

    } catch (err) {
      console.error("Dashboard metric load failure:", err);
    } finally {
      setDashboardLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "dashboard" && currentUserProfile) {
      loadDashboardMetrics();
    }
  }, [activeTab, currentUserProfile]);

  // ==========================================================================
  // SECTION 2: TRANSACTIONS STATE & SAVE HANDLER
  // ==========================================================================
  const [transactionLines, setTransactionLines] = useState<any[]>([
    {
      transaction_date: new Date().toISOString().split("T")[0],
      cash_type_id: "",
      staff_id: "",
      account_id: "",
      category_id: "",
      reference_number: "",
      amount: ""
    }
  ]);
  const [txSaving, setTxSaving] = useState(false);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);
  const [txErr, setTxErr] = useState<string | null>(null);

  const handleTxLineChange = (index: number, field: string, value: any) => {
    setTransactionLines(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
  };

  const handleAddTxLine = () => {
    setTransactionLines(prev => [
      ...prev,
      {
        transaction_date: new Date().toISOString().split("T")[0],
        cash_type_id: "",
        staff_id: "",
        account_id: "",
        category_id: "",
        reference_number: "",
        amount: ""
      }
    ]);
  };

  const handleRemoveTxLine = (index: number) => {
    if (transactionLines.length === 1) return;
    setTransactionLines(prev => prev.filter((_, i) => i !== index));
  };

  const txTotalAmount = useMemo(() => {
    return transactionLines.reduce((acc, l) => acc + (Number(l.amount) || 0), 0);
  }, [transactionLines]);

  const handleSaveTransactions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserProfile) {
      setTxErr("Profile not loaded. Retry.");
      return;
    }
    try {
      setTxSaving(true);
      setTxErr(null);
      setTxSuccess(null);

      const records = transactionLines.map((line, idx) => {
        const amt = Number(line.amount);
        if (isNaN(amt) || amt <= 0) {
          throw new Error(`Line ${idx + 1}: Amount must be a valid positive number.`);
        }
        if (!line.cash_type_id) throw new Error(`Line ${idx + 1}: Transaction Type is required.`);
        if (!line.account_id) throw new Error(`Line ${idx + 1}: Account is required.`);

        const rec: any = {
          transaction_date: line.transaction_date || null,
          cash_type_id: line.cash_type_id,
          staff_id: line.staff_id || null,
          account_id: line.account_id,
          category_id: line.category_id || null,
          reference_number: line.reference_number?.trim() || null,
          amount: amt
        };

        if (currentUserProfile.company_id) {
          rec.company_id = currentUserProfile.company_id;
        }
        return rec;
      });

      const { error } = await supabase.from("cash").insert(records);
      if (error) throw error;

      setTxSuccess(`${records.length} transactions successfully added and synchronized with the general ledger.`);
      setTransactionLines([
        {
          transaction_date: new Date().toISOString().split("T")[0],
          cash_type_id: "",
          staff_id: "",
          account_id: "",
          category_id: "",
          reference_number: "",
          amount: ""
        }
      ]);
      // Reload lookups / dashboard in background
      loadAllLookups();
    } catch (err: any) {
      console.error(err);
      setTxErr(err.message || String(err));
    } finally {
      setTxSaving(false);
    }
  };

  // ==========================================================================
  // SECTION 3: STAFF REGISTRATION STATE & HANDLERS
  // ==========================================================================
  const [regForm, setRegForm] = useState({
    full_name: "",
    occupation_id: "",
    office_id: "",
    tin_number: "",
    account_number: "",
    nida_number: "",
    phone_number: "",
    address: "",
    employment_date: new Date().toISOString().split("T")[0]
  });
  const [regSaving, setRegSaving] = useState(false);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);
  const [regErr, setRegErr] = useState<string | null>(null);

  const handleRegisterStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserProfile) return;
    if (!regForm.full_name.trim()) {
      setRegErr("Staff Full Name is required.");
      return;
    }

    try {
      setRegSaving(true);
      setRegErr(null);
      setRegSuccess(null);

      const payload: any = {
        full_name: regForm.full_name.trim(),
        occupation_id: regForm.occupation_id || null,
        office_id: regForm.office_id || null,
        tin_number: regForm.tin_number.trim() || null,
        account_number: regForm.account_number.trim() || null,
        nida_number: regForm.nida_number.trim() || null,
        phone_number: regForm.phone_number.trim() || null,
        address: regForm.address.trim() || null,
        employment_date: regForm.employment_date || null,
        is_active: true
      };

      if (currentUserProfile.company_id) {
        payload.company_id = currentUserProfile.company_id;
      }
      payload.created_by = currentUserProfile.id;

      const { error } = await supabase.from("staffs").insert(payload);
      if (error) throw error;

      setRegSuccess(`Staff profile for ${regForm.full_name} registered successfully.`);
      setRegForm({
        full_name: "",
        occupation_id: "",
        office_id: "",
        tin_number: "",
        account_number: "",
        nida_number: "",
        phone_number: "",
        address: "",
        employment_date: new Date().toISOString().split("T")[0]
      });
      // Refresh caching
      loadAllLookups();
    } catch (err: any) {
      console.error(err);
      setRegErr(err.message || String(err));
    } finally {
      setRegSaving(false);
    }
  };

  // ==========================================================================
  // SECTION 4: ACTIONS (STAFF EDIT & PENDING REVENUE APPROVALS) STATE & LOGIC
  // ==========================================================================
  // A. Staff Search & Editing
  const [staffSearchText, setStaffSearchText] = useState("");
  const [matchingStaffs, setMatchingStaffs] = useState<any[]>([]);
  const [searchingStaff, setSearchingStaff] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any | null>(null);
  const [staffUpdateSaving, setStaffUpdateSaving] = useState(false);
  const [staffUpdateSuccess, setStaffUpdateSuccess] = useState<string | null>(null);
  const [staffUpdateErr, setStaffUpdateErr] = useState<string | null>(null);

  const fetchStaffSearch = async () => {
    if (!currentUserProfile) return;
    try {
      setSearchingStaff(true);
      setStaffUpdateSuccess(null);
      setStaffUpdateErr(null);
      
      let q = supabase.from("staffs").select(`
        *,
        occupations(occupation_name),
        offices(office_name)
      `);
      
      if (currentUserProfile.company_id) {
        q = q.eq("company_id", currentUserProfile.company_id);
      }

      const trimQ = staffSearchText.trim();
      if (trimQ) {
        q = q.or(`full_name.ilike.%${trimQ}%,phone_number.ilike.%${trimQ}%,nida_number.ilike.%${trimQ}%`);
      }

      const { data, error } = await q.order("full_name").limit(30);
      if (error) throw error;
      setMatchingStaffs(data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setSearchingStaff(false);
    }
  };

  useEffect(() => {
    if (activeTab === "actions" && currentUserProfile) {
      fetchStaffSearch();
    }
  }, [activeTab, currentUserProfile]);

  const handleSearchStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStaffSearch();
  };

  const startEditingStaff = (staff: any) => {
    setSelectedStaff({
      ...staff,
      // Fallback values
      full_name: staff.full_name || "",
      occupation_id: staff.occupation_id || "",
      office_id: staff.office_id || "",
      tin_number: staff.tin_number || "",
      account_number: staff.account_number || "",
      nida_number: staff.nida_number || "",
      phone_number: staff.phone_number || "",
      address: staff.address || "",
      employment_date: staff.employment_date || "",
      is_active: staff.is_active === undefined ? true : staff.is_active
    });
    setStaffUpdateSuccess(null);
    setStaffUpdateErr(null);
  };

  const handleUpdateStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    try {
      setStaffUpdateSaving(true);
      setStaffUpdateErr(null);
      setStaffUpdateSuccess(null);

      const { error } = await supabase
        .from("staffs")
        .update({
          full_name: selectedStaff.full_name,
          occupation_id: selectedStaff.occupation_id || null,
          office_id: selectedStaff.office_id || null,
          tin_number: selectedStaff.tin_number || null,
          account_number: selectedStaff.account_number || null,
          nida_number: selectedStaff.nida_number || null,
          phone_number: selectedStaff.phone_number || null,
          address: selectedStaff.address || null,
          employment_date: selectedStaff.employment_date || null,
          is_active: selectedStaff.is_active
        })
        .eq("id", selectedStaff.id);

      if (error) throw error;
      setStaffUpdateSuccess("Staff details synchronized and registers successfully modernized.");
      setSelectedStaff(null);
      fetchStaffSearch();
      loadAllLookups();
    } catch (err: any) {
      console.error(err);
      setStaffUpdateErr(err.message || String(err));
    } finally {
      setStaffUpdateSaving(false);
    }
  };

  // B. Pending Cash Approvals Flow
  const [pendingCashList, setPendingCashList] = useState<any[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [approvalsStatusSelections, setApprovalsStatusSelections] = useState<Record<string, string>>({});
  const [approvalSavingId, setApprovalSavingId] = useState<string | null>(null);

  const fetchPendingCash = async () => {
    if (!currentUserProfile || lookups.transactionStatuses.length === 0) return;
    try {
      setPendingLoading(true);
      const pendingStatusObj = lookups.transactionStatuses.find(
        (s: any) => s.slug?.toLowerCase() === "pending" || s.display_name?.toLowerCase() === "pending"
      );
      if (!pendingStatusObj) return;

      let q = supabase
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
        .eq("status_id", pendingStatusObj.id);

      if (currentUserProfile.company_id) {
        q = q.eq("company_id", currentUserProfile.company_id);
      }

      const { data, error } = await q.order("transaction_date", { ascending: false });
      if (error) throw error;
      setPendingCashList(data || []);
      
      const initial: Record<string, string> = {};
      data?.forEach((row: any) => {
        initial[row.id] = String(row.status_id);
      });
      setApprovalsStatusSelections(initial);
    } catch (err) {
      console.error("Failed fetching pending cash list:", err);
    } finally {
      setPendingLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "actions" && currentUserProfile && lookups.transactionStatuses.length > 0) {
      fetchPendingCash();
    }
  }, [activeTab, currentUserProfile, lookups.transactionStatuses]);

  const handleUpdateCashStatus = async (cashId: string) => {
    const selectedStatusId = approvalsStatusSelections[cashId];
    if (!selectedStatusId) return;
    try {
      setApprovalSavingId(cashId);
      const { error } = await supabase
        .from("cash")
        .update({ status_id: selectedStatusId })
        .eq("id", cashId);

      if (error) throw error;
      await fetchPendingCash();
    } catch (err) {
      console.error("Status modify error:", err);
    } finally {
      setApprovalSavingId(null);
    }
  };

  // ==========================================================================
  // SECTION 5: MEMOS WORKSPACE STATE & ENGINE
  // ==========================================================================
  const [memoSubTab, setMemoSubTab] = useState<"inbox" | "sent" | "compose">("inbox");
  const [inboxMemos, setInboxMemos] = useState<any[]>([]);
  const [sentMemos, setSentMemos] = useState<any[]>([]);
  const [memoProfiles, setMemoProfiles] = useState<any[]>([]);
  const [memosLoading, setMemosLoading] = useState(false);
  const [selectedMemo, setSelectedMemo] = useState<any | null>(null);

  // Compose Fields
  const [composeReceiverId, setComposeReceiverId] = useState("");
  const [composeTitle, setComposeTitle] = useState("");
  const [composeMessage, setComposeMessage] = useState("");
  const [composeSaving, setComposeSaving] = useState(false);
  const [composeSuccess, setComposeSuccess] = useState<string | null>(null);
  const [composeErr, setComposeErr] = useState<string | null>(null);

  const fetchMemos = async () => {
    if (!currentUserProfile) return;
    try {
      setMemosLoading(true);
      const uId = currentUserProfile.id;
      const companyId = currentUserProfile.company_id;

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
        .eq("receiver_id", uId);

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
        .eq("sender_id", uId);

      let qProfiles = supabase.from("user_profiles").select("id, full_name").eq("is_active", true);

      if (companyId) {
        qInbox = qInbox.eq("company_id", companyId);
        qSent = qSent.eq("company_id", companyId);
        qProfiles = qProfiles.eq("company_id", companyId);
      }

      const [resInbox, resSent, resProfiles] = await Promise.all([
        qInbox.order("created_at", { ascending: false }),
        qSent.order("created_at", { ascending: false }),
        qProfiles.order("full_name")
      ]);

      setInboxMemos(resInbox.data || []);
      setSentMemos(resSent.data || []);
      setMemoProfiles(resProfiles.data || []);

    } catch (err) {
      console.error("Error retrieving memos:", err);
    } finally {
      setMemosLoading(false);
    }
  };

  useEffect(() => {
    if (currentUserProfile) {
      fetchMemos();
    }
  }, [activeTab, currentUserProfile]);

  const handleOpenMemo = async (memo: any) => {
    setSelectedMemo(memo);
    if (memoSubTab === "inbox" && !memo.is_read) {
      // Optimistic Update
      setInboxMemos(prev => prev.map(m => m.id === memo.id ? { ...m, is_read: true } : m));
      try {
        await supabase.from("memos").update({ is_read: true }).eq("id", memo.id);
      } catch (err) {
        console.error("Memos unread toggle error:", err);
      }
    }
  };

  const handleSendComposeMemo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserProfile) return;
    if (!composeReceiverId) {
      setComposeErr("Receiver is required.");
      return;
    }
    if (!composeTitle.trim()) {
      setComposeErr("Title is required.");
      return;
    }
    if (!composeMessage.trim()) {
      setComposeErr("Message is required.");
      return;
    }

    try {
      setComposeSaving(true);
      setComposeErr(null);
      setComposeSuccess(null);

      const payload: any = {
        sender_id: currentUserProfile.id,
        receiver_id: composeReceiverId,
        title: composeTitle.trim(),
        message: composeMessage.trim(),
        is_read: false
      };

      if (currentUserProfile.company_id) {
        payload.company_id = currentUserProfile.company_id;
      }

      const { error } = await supabase.from("memos").insert(payload);
      if (error) throw error;

      setComposeSuccess("Memo successfully routed & synchronized.");
      setComposeTitle("");
      setComposeMessage("");
      setComposeReceiverId("");
      await fetchMemos();
    } catch (err: any) {
      console.error(err);
      setComposeErr(err.message || String(err));
    } finally {
      setComposeSaving(false);
    }
  };

  const unreadMemosCount = useMemo(() => {
    return inboxMemos.filter(m => !m.is_read).length;
  }, [inboxMemos]);

  const formatTZS = (val: any) => {
    if (val === undefined || val === null || isNaN(Number(val))) return "0 TZS";
    return Number(val).toLocaleString() + " TZS";
  };

  return (
    <div className="relative min-h-screen hr-animated-bg text-neutral-200 font-sans flex overflow-hidden">
      
      {/* Background Glows (Subtle Dark Creams & Rich Luxury Golds) */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-gradient-to-tr from-[#ead2ac]/20 to-yellow-600/10 blur-[130px] rounded-full pointer-events-none animate-float-1"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-gradient-to-bl from-[#dfc18c]/18 to-amber-500/12 blur-[140px] rounded-full pointer-events-none animate-float-2"></div>
      <div className="absolute top-[30%] left-[25%] w-[40%] h-[40%] bg-gradient-to-tr from-[#c4a46a]/15 to-amber-650/10 blur-[165px] rounded-full pointer-events-none animate-pulse"></div>

      {/* Mobile/Tablet Backdrop overlay when sidebar is open */}
      {!isSidebarCollapsed && (
        <div 
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setIsSidebarCollapsed(true)}
        />
      )}

      {/* SIDEBAR NAVIGATION PANEL */}
      <motion.aside
        animate={{ width: isSidebarCollapsed ? "80px" : "280px" }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className={`fixed md:relative inset-y-0 left-0 z-30 shrink-0 border-r border-[#4a3d2c]/30 bg-[#1c1813]/95 md:bg-[#1c1813]/60 backdrop-blur-2xl flex flex-col justify-between overflow-hidden ${isSidebarCollapsed ? "hidden md:flex" : "flex"}`}
      >
        <div className="p-5 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            {!isSidebarCollapsed && (
              <div 
                onClick={() => navigate("/modules")}
                className="flex items-center gap-2.5 cursor-pointer group"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-500 to-yellow-200 shadow-[0_0_15px_rgba(245,158,11,0.25)] p-[1px]">
                  <div className="flex h-full w-full items-center justify-center rounded-lg bg-neutral-950">
                    <Users className="h-4 w-4 text-amber-500 group-hover:rotate-12 transition-transform duration-300" />
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
                className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-500 to-yellow-200 cursor-pointer p-[1px]"
              >
                <div className="flex h-full w-full items-center justify-center rounded-lg bg-neutral-950">
                  <Users className="h-4 w-4 text-amber-500" />
                </div>
              </div>
            )}

            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-1.5 rounded-md hover:bg-neutral-900 border border-transparent hover:border-white/5 text-neutral-400 hover:text-amber-500 transition-colors hidden md:block cursor-pointer"
            >
              {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>

          {!isSidebarCollapsed && (
            <div className="px-1 py-1 bg-amber-950/10 border border-amber-500/10 rounded-xl p-2.5">
              <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-amber-500/60 block mb-1">
                Active Environment
              </span>
              <div className="text-xs font-semibold text-white tracking-tight flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                Staff & Core HR
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Nav Items */}
        <nav className="flex-1 px-3 space-y-1.5">
          {[
            { id: "dashboard", label: "Dashboard", icon: Activity },
            { id: "transactions", label: "Transactions", icon: Coins },
            { id: "staff", label: "Staff Registration", icon: UserPlus },
            { id: "actions", label: "Actions", icon: SlidersHorizontal, badge: pendingCashList.length > 0 ? pendingCashList.length : undefined },
            { id: "memos", label: "Memos", icon: Mail, badge: unreadMemosCount > 0 ? unreadMemosCount : undefined },
            { id: "reports", label: "Reports", icon: FileBarChart }
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full flex items-center justify-between rounded-xl p-3 text-xs tracking-medium transition-all duration-300 relative group cursor-pointer ${
                  isActive
                    ? "bg-gradient-to-r from-amber-950/20 to-transparent border border-amber-500/30 text-amber-400 font-medium"
                    : "hover:bg-amber-950/5 border border-transparent text-neutral-400 hover:text-neutral-250"
                }`}
              >
                <div className="flex items-center">
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-amber-400" : "text-neutral-400 group-hover:text-amber-400"} ${isSidebarCollapsed ? "mx-auto" : "mr-3"}`} />
                  {!isSidebarCollapsed && <span>{item.label}</span>}
                </div>

                {!isSidebarCollapsed && item.badge !== undefined && (
                  <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono text-[9px] px-1.5 py-0.5 rounded-full scale-90">
                    {item.badge}
                  </span>
                )}

                {isSidebarCollapsed && (
                  <div className="absolute left-20 bg-[#1c1813] text-amber-300 border border-amber-500/20 px-3 py-1.5 rounded-md text-[10px] font-mono opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                    {item.label}
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
            className="w-full flex items-center justify-center rounded-xl border border-white/5 bg-black/40 hover:border-amber-500/30 text-xs text-neutral-450 hover:text-amber-400 p-3 transition-all cursor-pointer group"
          >
            <ArrowLeft className={`h-4 w-4 shrink-0 ${isSidebarCollapsed ? "mx-auto" : "mr-2 group-hover:-translate-x-0.5 transition-transform"}`} />
            {!isSidebarCollapsed && <span className="font-medium">Modules Menu</span>}
          </button>

          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center rounded-xl border border-red-500/10 bg-[#1c1410]/40 hover:bg-[#2e241c]/50 hover:border-red-500/20 text-xs text-red-450 hover:text-red-300 p-3 transition-all cursor-pointer"
          >
            <LogOut className={`h-4 w-4 shrink-0 ${isSidebarCollapsed ? "mx-auto" : "mr-2"}`} />
            {!isSidebarCollapsed && <span className="font-medium">Secure Out</span>}
          </button>
        </div>
      </motion.aside>

      {/* CORE WORKSPACE SCREEN */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        
        {/* TOP HR MODULE HEADER */}
        <header className="border-b border-[#4a3d2c]/25 bg-[#17130f]/60 backdrop-blur-xl px-6 py-4 flex flex-row justify-between items-center gap-4 z-10 shrink-0">
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
              <h1 className="text-xl md:text-2xl font-serif font-black tracking-wide bg-gradient-to-r from-white via-neutral-200 to-amber-500 bg-clip-text text-transparent uppercase leading-none">
                Human Resource
              </h1>
            </div>
          </div>

          {/* TOP RIGHT USER PROFILE BANNER */}
          <div className="px-4 py-2 bg-gradient-to-tr from-[#1f1913] to-[#2e241b] border border-amber-500/20 rounded-2xl flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/20">
              <Users className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <div className="text-left">
              <div id="user-full-name" className="text-xs font-bold text-white leading-tight">
                {currentUserProfile?.full_name || "Current User"}
              </div>
              <div id="user-role-name" className="text-[10px] text-amber-500 font-mono font-medium mt-0.5">
                {currentUserRoleName || "Role Not Assigned"}
              </div>
              <div id="fiscal-year" className="text-[9px] text-white/40 font-mono mt-0.5">
                FY 2026 Operations
              </div>
            </div>
          </div>
        </header>

        {/* WORKSPACE VIEW CONTENT REGION */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
          
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              
              {/* ========================================================================== */}
              {/* SECTION 1: HR DASHBOARD VIEW                                              */}
              {/* ========================================================================== */}
              {activeTab === "dashboard" && (
                <div className="space-y-6">
                  
                  {/* Top 4 Dashboard KPI Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    
                    {/* Card 1: Staff Count */}
                    <div className="p-5 bg-gradient-to-br from-[#1b080b]/80 to-[#270e12]/60 rounded-2xl border border-amber-500/10 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-5">
                        <Users className="h-16 w-16 text-amber-500" />
                      </div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">Total Workforce Staff</span>
                      <div className="mt-2 text-2xl font-black font-mono text-white">
                        {dashboardLoading ? (
                          <RefreshCw className="h-5 w-5 animate-spin text-amber-500 inline-block" />
                        ) : (
                          stats.staffCount
                        )}
                      </div>
                      <p className="text-[10px] text-neutral-500 mt-2">Active corporate employees on payroll database.</p>
                    </div>

                    {/* Card 2: Wages Expenses */}
                    <div className="p-5 bg-gradient-to-br from-[#1b080b]/80 to-[#270e12]/60 rounded-2xl border border-amber-500/10 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-5">
                        <Coins className="h-16 w-16 text-amber-500" />
                      </div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">Payroll Wages This Month</span>
                      <div className="mt-2 text-xl font-bold font-mono text-amber-400">
                        {dashboardLoading ? (
                          <RefreshCw className="h-5 w-5 animate-spin text-amber-500 inline-block" />
                        ) : (
                          formatTZS(stats.monthlyWages)
                        )}
                      </div>
                      <p className="text-[10px] text-neutral-500 mt-3">Excludes bonuses and individual contractor fuel allocations.</p>
                    </div>

                    {/* Card 3: Top Shortages */}
                    <div className="p-5 bg-gradient-to-br from-[#1b080b]/80 to-[#270e12]/60 rounded-2xl border border-amber-500/10 relative overflow-hidden flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">Critical Staff Shortages</span>
                        {dashboardLoading ? (
                          <div className="flex items-center justify-center py-4">
                            <RefreshCw className="h-4 w-4 animate-spin text-amber-500" />
                          </div>
                        ) : stats.shortages.length === 0 ? (
                          <p className="text-[11px] font-light text-neutral-500 mt-2 italic">Zero active shortages registered.</p>
                        ) : (
                          <div className="mt-2 space-y-1.5 overflow-hidden">
                            {stats.shortages.map((sh, idx) => (
                              <div key={idx} className="flex justify-between items-center text-[10px] border-b border-white/5 pb-1">
                                <span className="font-medium truncate text-neutral-250 max-w-[100px]">{sh.staff_name || "Unassigned"}</span>
                                <span className="font-mono text-yellow-500 font-bold">{formatTZS(sh.shortage)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="text-[9px] text-neutral-500 mt-2">Top 3 staff debt balances tracked from daily manifests.</p>
                    </div>

                    {/* Card 4: Most Performers */}
                    <div className="p-5 bg-gradient-to-br from-[#1b080b]/80 to-[#270e12]/60 rounded-2xl border border-amber-500/10 relative overflow-hidden flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">Top Revenue Partners</span>
                        {dashboardLoading ? (
                          <div className="flex items-center justify-center py-4">
                            <RefreshCw className="h-4 w-4 animate-spin text-amber-500" />
                          </div>
                        ) : stats.performers.length === 0 ? (
                          <p className="text-[11px] font-light text-neutral-500 mt-2 italic">No monthly logs compiled yet.</p>
                        ) : (
                          <div className="mt-2 space-y-1.5 overflow-hidden">
                            {stats.performers.map((per, idx) => (
                              <div key={idx} className="flex justify-between items-center text-[10px] border-b border-white/5 pb-1">
                                <span className="font-medium truncate text-neutral-250 max-w-[100px]">{per.staff || "N/A"}</span>
                                <span className="font-mono text-emerald-400 font-bold">{formatTZS(per.income)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="text-[9px] text-neutral-500 mt-2">Maximum sales collection compiled across all routes this month.</p>
                    </div>

                  </div>

                  {/* Wages Trend Chart Rendering */}
                  <div className="p-6 bg-[#1f1913]/40 border border-[#4a3d2c]/40 backdrop-blur-xl rounded-2xl space-y-4 shadow-lg min-h-[360px]">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-xs font-mono uppercase tracking-wider text-amber-400">Wages & Salaries Expense Trend</h3>
                        <p className="text-[11px] text-neutral-400">Real-time charts indicating payroll records on the general database</p>
                      </div>
                      <TrendingUp className="h-4 w-4 text-amber-500" />
                    </div>

                    {stats.wagesTrend.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-neutral-500">
                        <Compass className="h-8 w-8 text-neutral-600 animate-pulse mb-2" />
                        <span className="text-[11px] font-mono tracking-wider">No wage data registered in financial ledger views.</span>
                      </div>
                    ) : (
                      <div className="w-full h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={stats.wagesTrend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorWages" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="month" stroke="#737373" fontSize={10} fontFamily="monospace" />
                            <YAxis stroke="#737373" fontSize={9} fontFamily="monospace" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: "#1c0408", border: "1px solid rgba(245, 158, 11, 0.2)", borderRadius: "12px", fontSize: "11px" }}
                              labelStyle={{ color: "#f59e0b", fontFamily: "monospace" }}
                              itemStyle={{ color: "#fff" }}
                              formatter={(v: any) => [`${Number(v).toLocaleString()} TZS`, "Wages Allocated"]}
                            />
                            <Area type="monotone" dataKey="amount" stroke="#f59e0b" fillOpacity={1} fill="url(#colorWages)" strokeWidth={2.5} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  {/* Operational Crew Allocation Log preview */}
                  <div className="rounded-2xl border border-white/5 bg-[#1c1813]/45 p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex gap-3">
                      <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 shrink-0 mt-0.5">
                        <Briefcase className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-white">Workforce Operations Panel</h4>
                        <p className="text-[11px] text-neutral-400 mt-0.5">Register staff, dispatch operational ledgers, or approve cash actions with immediate ledger updates.</p>
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* ========================================================================== */}
              {/* SECTION 2: TRANSACTIONS VIEW                                              */}
              {/* ========================================================================== */}
              {activeTab === "transactions" && (
                <div className="space-y-6">
                  <div className="pb-4 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Coins className="h-4 w-4 text-amber-400" />
                        Disburse Cash Actions (Batch Line Registration)
                      </h3>
                      <p className="text-[11px] text-neutral-400 mt-0.5">Draft multiple ledger entries to save concurrently into the cash table.</p>
                    </div>
                  </div>

                  <form onSubmit={handleSaveTransactions} className="space-y-6">
                    {txSuccess && (
                      <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-3">
                        <Check className="h-4 w-4 shrink-0" />
                        <span>{txSuccess}</span>
                      </div>
                    )}

                    {txErr && (
                      <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/30 text-red-300 text-xs flex items-center gap-3 font-mono">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>Failed saving cash lines: {txErr}</span>
                      </div>
                    )}

                    <div className="space-y-4">
                      {transactionLines.map((line, idx) => (
                        <div 
                          key={idx}
                          className="p-5 rounded-2xl border border-[#4a3d2c]/30 bg-[#1c1813]/40 flex flex-col gap-4 relative"
                        >
                          {/* Row action ribbon */}
                          <div className="flex justify-between items-center pb-2 border-b border-white/5">
                            <span className="font-mono text-[10px] text-amber-500/80 font-bold">DISBURSEMENT REGISTRY ROW #{idx + 1}</span>
                            {transactionLines.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveTxLine(idx)}
                                className="text-red-400 hover:text-red-300 text-[10px] font-mono flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Remove Row
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            
                            <div>
                              <label className="block text-[10px] uppercase font-mono text-neutral-400 mb-1.5">Date</label>
                              <div className="relative">
                                <Calendar className="absolute left-3 top-3 h-3.5 w-3.5 text-neutral-500 pointer-events-none" />
                                <input
                                  type="date"
                                  className="w-full bg-[#1a1510] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50 h-[40px] font-mono"
                                  value={line.transaction_date}
                                  onChange={(e) => handleTxLineChange(idx, "transaction_date", e.target.value)}
                                  required
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] uppercase font-mono text-neutral-400 mb-1.5">Transaction Type</label>
                              <SearchableSelect
                                options={lookups.cashTypes}
                                value={line.cash_type_id}
                                onChange={(val) => handleTxLineChange(idx, "cash_type_id", val)}
                                placeholder="Select cash type..."
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] uppercase font-mono text-neutral-400 mb-1.5">Responsible Staff</label>
                              <SearchableSelect
                                options={lookups.staffs}
                                value={line.staff_id}
                                onChange={(val) => handleTxLineChange(idx, "staff_id", val)}
                                placeholder="Select driver/conductor..."
                              />
                            </div>



                            <div>
                              <label className="block text-[10px] uppercase font-mono text-neutral-400 mb-1.5">Chart Account</label>
                              <SearchableSelect
                                options={lookups.accounts}
                                value={line.account_id}
                                onChange={(val) => handleTxLineChange(idx, "account_id", val)}
                                placeholder="Select account..."
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] uppercase font-mono text-neutral-400 mb-1.5 font-sans">Operational Category</label>
                              <SearchableSelect
                                options={lookups.categories}
                                value={line.category_id}
                                onChange={(val) => handleTxLineChange(idx, "category_id", val)}
                                placeholder="Select category..."
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] uppercase font-mono text-neutral-400 mb-1.5">Reference Number</label>
                              <input
                                type="text"
                                className="w-full bg-[#1a1510] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50 h-[40px] font-mono"
                                placeholder="e.g. SLIP-200"
                                value={line.reference_number}
                                onChange={(e) => handleTxLineChange(idx, "reference_number", e.target.value)}
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] uppercase font-mono text-neutral-400 mb-1.5">Cash Amount (TZS)</label>
                              <input
                                type="number"
                                className="w-full bg-[#1a1510] border border-[#4a3d2c]/40 rounded-xl px-3 py-2 text-xs text-amber-400 font-bold focus:outline-none focus:border-amber-500/50 h-[40px] font-mono"
                                placeholder="0"
                                value={line.amount}
                                onChange={(e) => handleTxLineChange(idx, "amount", e.target.value)}
                                required
                              />
                            </div>

                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Batch Add Line and Save controls */}
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-[#1c1813]/40 p-4 border border-[#4a3d2c]/15 rounded-2xl">
                      <button
                        type="button"
                        onClick={handleAddTxLine}
                        className="w-full sm:w-auto px-4 py-2 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 text-xs font-mono text-amber-400 tracking-wider uppercase rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer h-10"
                      >
                        <Plus className="h-4 w-4" />
                        Append Registry Row
                      </button>

                      <div className="flex items-center gap-5 w-full sm:w-auto justify-end">
                        <div className="text-right shrink-0">
                          <span className="text-[10px] text-neutral-400 uppercase font-mono block">Cumulated Total Amount</span>
                          <span className="text-sm font-sans font-black text-amber-400">{formatTZS(txTotalAmount)}</span>
                        </div>

                        <button
                          type="submit"
                          disabled={txSaving}
                          className="px-6 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-500 disabled:opacity-50 text-neutral-950 font-black font-mono tracking-widest uppercase text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer h-10 shadow-[0_4px_20px_rgba(245,158,11,0.2)]"
                        >
                          {txSaving ? (
                            <>
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Check className="h-4 w-4" />
                              Save Ledger
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              )}

              {/* ========================================================================== */}
              {/* SECTION 3: STAFF REGISTRATION                                             */}
              {/* ========================================================================== */}
              {activeTab === "staff" && (
                <div className="space-y-6">
                  <div className="pb-4 border-b border-white/5">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <UserPlus className="h-4 w-4 text-emerald-400" />
                      Register New Staffing Node
                    </h3>
                    <p className="text-[11px] text-neutral-400 mt-0.5">Modernist enrollment registry for drivers, conductors, mechanics and administrative officers.</p>
                  </div>

                  <form onSubmit={handleRegisterStaff} className="max-w-4xl mx-auto space-y-6">
                    {regSuccess && (
                      <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-3">
                        <Check className="h-4 w-4 shrink-0" />
                        <span>{regSuccess}</span>
                      </div>
                    )}

                    {regErr && (
                      <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/30 text-red-300 text-xs flex items-center gap-3 font-mono">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>Registration error: {regErr}</span>
                      </div>
                    )}

                    {/* Registration Layout card */}
                    <div className="rounded-2xl border border-[#4a3d2c]/30 bg-[#1c1813]/40 overflow-hidden shadow-2xl relative">
                      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/25 to-transparent"></div>
                      
                      <div className="p-6 md:p-8 space-y-6">
                        {/* Area 1: Personal Details */}
                        <div className="space-y-4">
                          <h4 className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-500/80 font-bold border-b border-white/5 pb-1">Personal & General Specifications</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] uppercase font-mono text-neutral-400 mb-1.5">Staff Full Name</label>
                              <input
                                type="text"
                                className="w-full bg-[#180609] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/40 h-[40px]"
                                placeholder="e.g. Stephen Damiano"
                                value={regForm.full_name}
                                onChange={(e) => setRegForm(prev => ({ ...prev, full_name: e.target.value }))}
                                required
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] uppercase font-mono text-neutral-400 mb-1.5">National NIDA Identifier</label>
                              <input
                                type="text"
                                className="w-full bg-[#180609] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500/40 h-[40px]"
                                placeholder="199XXXXXXXXXXXXX"
                                value={regForm.nida_number}
                                onChange={(e) => setRegForm(prev => ({ ...prev, nida_number: e.target.value }))}
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] uppercase font-mono text-neutral-400 mb-1.5 font-sans">TIN</label>
                              <input
                                type="text"
                                className="w-full bg-[#180609] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/40 h-[40px]"
                                placeholder="TIN..."
                                value={regForm.tin_number}
                                onChange={(e) => setRegForm(prev => ({ ...prev, tin_number: e.target.value }))}
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] uppercase font-mono text-neutral-400 mb-1.5 font-sans">Account Number</label>
                              <input
                                type="text"
                                className="w-full bg-[#180609] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/40 h-[40px]"
                                placeholder="Account Number..."
                                value={regForm.account_number}
                                onChange={(e) => setRegForm(prev => ({ ...prev, account_number: e.target.value }))}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Area 2: Work Assignment */}
                        <div className="space-y-4">
                          <h4 className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-500/80 font-bold border-b border-white/5 pb-1">Role & Location Registry</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] uppercase font-mono text-neutral-400 mb-1.5 font-sans">Corporate Occupation</label>
                              <SearchableSelect
                                options={lookups.occupations}
                                value={regForm.occupation_id}
                                onChange={(val) => setRegForm(prev => ({ ...prev, occupation_id: val }))}
                                placeholder="Select job role..."
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] uppercase font-mono text-neutral-400 mb-1.5 font-sans">Assigned Station Branch</label>
                              <SearchableSelect
                                options={lookups.offices}
                                value={regForm.office_id}
                                onChange={(val) => setRegForm(prev => ({ ...prev, office_id: val }))}
                                placeholder="Select operations branch..."
                              />
                            </div>
                          </div>
                        </div>

                        {/* Area 3: Contact & Employment */}
                        <div className="space-y-4">
                          <h4 className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-500/80 font-bold border-b border-white/5 pb-1">Employment Duration & Communication</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] uppercase font-mono text-neutral-400 mb-1.5">Direct Phone Network</label>
                              <input
                                type="text"
                                className="w-full bg-[#180609] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/40 h-[40px] font-mono"
                                placeholder="+255..."
                                value={regForm.phone_number}
                                onChange={(e) => setRegForm(prev => ({ ...prev, phone_number: e.target.value }))}
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] uppercase font-mono text-neutral-400 mb-1.5">Employment Date</label>
                              <div className="relative">
                                <Calendar className="absolute left-3 top-3 h-3.5 w-3.5 text-neutral-500 pointer-events-none" />
                                <input
                                  type="date"
                                  className="w-full bg-[#180609] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/40 h-[40px] font-mono"
                                  value={regForm.employment_date}
                                  onChange={(e) => setRegForm(prev => ({ ...prev, employment_date: e.target.value }))}
                                />
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] uppercase font-mono text-neutral-400 mb-1.5">Physical Registered Address</label>
                            <textarea
                              rows={2}
                              className="w-full bg-[#180609] border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500/40"
                              placeholder="Describe staff physical block/residence address details..."
                              value={regForm.address}
                              onChange={(e) => setRegForm(prev => ({ ...prev, address: e.target.value }))}
                            />
                          </div>
                        </div>

                      </div>

                      {/* Footer controls inside card */}
                      <div className="p-4 bg-black/40 border-t border-white/5 flex justify-end">
                        <button
                          type="submit"
                          disabled={regSaving}
                          className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-500 disabled:opacity-50 text-neutral-950 font-black font-mono tracking-widest uppercase text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer h-10 shadow-lg"
                        >
                          {regSaving ? (
                            <>
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              Synchronizing...
                            </>
                          ) : (
                            <>
                              <Check className="h-4 w-4" />
                              Synchronize Staff Registry
                            </>
                          )}
                        </button>
                      </div>

                    </div>
                  </form>
                </div>
              )}

              {/* ========================================================================== */}
              {/* SECTION 4: HR ACTIONS (EDIT STAFF & APPROVAL LINES)                       */}
              {/* ========================================================================== */}
              {activeTab === "actions" && (
                <div className="space-y-8">
                  
                  {/* Part A: Modernize Staff Profile */}
                  <div className="p-6 bg-[#1f1913]/40 border border-[#4a3d2c]/40 backdrop-blur-xl rounded-2xl space-y-5">
                    <div>
                      <h4 className="text-xs font-mono uppercase tracking-wider text-amber-400">Section A // Modernize Staff Directory Profile values</h4>
                      <p className="text-[11px] text-neutral-400 mt-0.5">Search staff profiles by phone, NIDA identification, or full names to update registered status indexes.</p>
                    </div>

                    <form onSubmit={handleSearchStaffSubmit} className="flex gap-3 max-w-xl">
                      <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-3 h-3.5 w-3.5 text-neutral-400" />
                        <input
                          type="text"
                          className="w-full bg-[#180609] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/40 h-10"
                          placeholder="Search full name, phone number, or NIDA credentials..."
                          value={staffSearchText}
                          onChange={(e) => setStaffSearchText(e.target.value)}
                        />
                      </div>
                      <button
                        type="submit"
                        className="px-4 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 text-xs font-mono text-amber-400 tracking-wider uppercase rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer h-10 shrink-0"
                      >
                        Search
                      </button>
                    </form>

                    {staffUpdateSuccess && (
                      <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/20 text-emerald-300 text-xs">
                        {staffUpdateSuccess}
                      </div>
                    )}

                    {staffUpdateErr && (
                      <div className="p-3 bg-red-950/20 rounded-xl border border-red-500/30 text-red-300 text-xs font-mono">
                        {staffUpdateErr}
                      </div>
                    )}

                    {/* Staff results and quick edit sheet */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      
                      {/* Search Table Results list */}
                      <div className="lg:col-span-7 border border-white/5 rounded-xl bg-black/40 max-h-80 overflow-y-auto custom-scrollbar">
                        {searchingStaff ? (
                          <div className="py-12 text-center">
                            <RefreshCw className="h-5 w-5 animate-spin text-amber-500 mx-auto" />
                            <span className="text-[10px] font-mono text-neutral-500 mt-2 block">QUERIER RUNNING OVER staffs TABLE...</span>
                          </div>
                        ) : matchingStaffs.length === 0 ? (
                          <div className="py-12 text-center text-neutral-500 text-xs">No matching crew registrations loaded.</div>
                        ) : (
                          <div className="divide-y divide-white/5 text-[11px]">
                            {matchingStaffs.map(st => (
                              <div key={st.id} className="p-3 hover:bg-amber-950/5 flex justify-between items-center transition-all">
                                <div>
                                  <div className="font-semibold text-white text-xs">{st.full_name}</div>
                                  <div className="font-mono text-amber-500/80 text-[10px] mt-0.5">
                                    {st.occupations?.occupation_name || "No Occupation"} / {st.offices?.office_name || "Unassigned Station"}
                                  </div>
                                  <div className="text-[10px] text-neutral-400 mt-0.5">Contact: {st.phone_number || "—"} | NIDA: {st.nida_number || "—"}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full ${st.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                                    {st.is_active ? "Active" : "Terminated"}
                                  </span>
                                  <button
                                    onClick={() => startEditingStaff(st)}
                                    className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 hover:border-amber-500/40 text-[10px] text-amber-400 font-mono tracking-wide rounded-lg cursor-pointer transition-all"
                                  >
                                    Modernize
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Detail Edit Side panel */}
                      <div className="lg:col-span-5">
                        {selectedStaff ? (
                          <form onSubmit={handleUpdateStaffSubmit} className="p-4 border border-amber-500/20 bg-amber-950/5 rounded-xl space-y-4">
                            <div className="flex justify-between items-center border-b border-white/5 pb-2">
                              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold">Synchronize Profile Fields</span>
                              <button
                                type="button"
                                onClick={() => setSelectedStaff(null)}
                                className="text-neutral-450 hover:text-white"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>

                            <div className="space-y-3">
                              <div>
                                <label className="block text-[9px] font-mono uppercase text-neutral-400 mb-1">Full Name</label>
                                <input
                                  type="text"
                                  className="w-full bg-[#180609] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/50"
                                  value={selectedStaff.full_name}
                                  onChange={(e) => setSelectedStaff((prev: any) => ({ ...prev, full_name: e.target.value }))}
                                  required
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[9px] font-mono uppercase text-neutral-400 mb-1">Occupation</label>
                                  <SearchableSelect
                                    options={lookups.occupations}
                                    value={selectedStaff.occupation_id}
                                    onChange={(val) => setSelectedStaff((prev: any) => ({ ...prev, occupation_id: val }))}
                                    placeholder="Occupation..."
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] font-mono uppercase text-neutral-400 mb-1">Office Station</label>
                                  <SearchableSelect
                                    options={lookups.offices}
                                    value={selectedStaff.office_id}
                                    onChange={(val) => setSelectedStaff((prev: any) => ({ ...prev, office_id: val }))}
                                    placeholder="Branch..."
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[9px] font-mono uppercase text-neutral-400 mb-1">NIDA Number</label>
                                  <input
                                    type="text"
                                    className="w-full bg-[#180609] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/50"
                                    value={selectedStaff.nida_number}
                                    onChange={(e) => setSelectedStaff((prev: any) => ({ ...prev, nida_number: e.target.value }))}
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] font-mono uppercase text-neutral-400 mb-1">Phone Number</label>
                                  <input
                                    type="text"
                                    className="w-full bg-[#180609] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/50"
                                    value={selectedStaff.phone_number}
                                    onChange={(e) => setSelectedStaff((prev: any) => ({ ...prev, phone_number: e.target.value }))}
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[9px] font-mono uppercase text-neutral-400 mb-1">TIN</label>
                                  <input
                                    type="text"
                                    className="w-full bg-[#180609] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/50"
                                    value={selectedStaff.tin_number || ""}
                                    onChange={(e) => setSelectedStaff((prev: any) => ({ ...prev, tin_number: e.target.value }))}
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] font-mono uppercase text-neutral-400 mb-1">Account Number</label>
                                  <input
                                    type="text"
                                    className="w-full bg-[#180609] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/50"
                                    value={selectedStaff.account_number || ""}
                                    onChange={(e) => setSelectedStaff((prev: any) => ({ ...prev, account_number: e.target.value }))}
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-[9px] font-mono uppercase text-neutral-400 mb-1">Physical Address</label>
                                <input
                                  type="text"
                                  className="w-full bg-[#180609] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/50"
                                  value={selectedStaff.address}
                                  onChange={(e) => setSelectedStaff((prev: any) => ({ ...prev, address: e.target.value }))}
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[9px] font-mono uppercase text-neutral-400 mb-1">Employment Date</label>
                                  <input
                                    type="date"
                                    className="w-full bg-[#180609] border border-white/10 rounded-lg px-2 px-1.5 text-xs text-white focus:outline-none focus:border-amber-500/50 font-mono"
                                    value={selectedStaff.employment_date ? selectedStaff.employment_date.split("T")[0] : ""}
                                    onChange={(e) => setSelectedStaff((prev: any) => ({ ...prev, employment_date: e.target.value }))}
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] font-mono uppercase text-neutral-400 mb-1">Status index</label>
                                  <select
                                    className="w-full bg-[#180609] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/50 h-[40px]"
                                    value={selectedStaff.is_active ? "true" : "false"}
                                    onChange={(e) => setSelectedStaff((prev: any) => ({ ...prev, is_active: e.target.value === "true" }))}
                                  >
                                    <option value="true">Active Enrollment</option>
                                    <option value="false">Contract Suspended</option>
                                  </select>
                                </div>
                              </div>
                            </div>

                            <button
                              type="submit"
                              disabled={staffUpdateSaving}
                              className="w-full p-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-500 disabled:opacity-50 text-neutral-950 font-black font-mono tracking-wider uppercase text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer h-10 shadow-md"
                            >
                              {staffUpdateSaving ? (
                                <>
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                  Modernizing...
                                </>
                              ) : (
                                <>
                                  <Check className="h-4 w-4" />
                                  Commit Updates
                                </>
                              )}
                            </button>
                          </form>
                        ) : (
                          <div className="p-6 border border-dashed border-white/5 rounded-xl flex flex-col items-center justify-center text-center text-neutral-500 h-full min-h-[300px] bg-black/10">
                            <Users className="h-8 w-8 text-neutral-700 animate-pulse mb-3" />
                            <span className="text-[11px] font-mono">No profile selected</span>
                            <p className="text-[10px] text-neutral-600 max-w-xs mt-1 leading-normal">
                              Select "Modernize" on any search result line item to configure direct details.
                            </p>
                          </div>
                        )}
                      </div>

                    </div>
                  </div>

                  {/* Part B: Pending APPROVAL LINES */}
                  <div className="p-6 bg-[#1f1913]/40 border border-[#4a3d2c]/40 backdrop-blur-xl rounded-2xl space-y-4">
                    <div>
                      <h4 className="text-xs font-mono uppercase tracking-wider text-amber-400">Section B // Secure Financial Cash Approvals desk</h4>
                      <p className="text-[11px] text-neutral-400 mt-0.5">Authorizing and aligning pending cash records before database commit.</p>
                    </div>

                    {pendingLoading ? (
                      <div className="py-12 text-center text-xs">
                        <RefreshCw className="h-6 w-6 animate-spin text-amber-500 mx-auto mb-2" />
                        <span className="font-mono text-neutral-500">POLLING SECURE PENDING REGISTERS...</span>
                      </div>
                    ) : pendingCashList.length === 0 ? (
                      <div className="py-12 text-center text-neutral-500 text-xs border border-dashed border-white/5 bg-black/10 rounded-xl">
                        Zero pending cash approvals detected. Great balance state!
                      </div>
                    ) : (
                      <div className="border border-white/5 rounded-xl bg-black/40 overflow-x-auto relative custom-scrollbar">
                        <table className="w-full border-collapse text-left text-[11px] font-sans">
                          <thead>
                            <tr className="border-b border-white/10 bg-amber-950/10 text-[10px] font-mono uppercase tracking-wider text-amber-500">
                              <th className="p-3">Date</th>
                              <th className="p-3">T.Type</th>
                              <th className="p-3">Staff Assignment</th>
                              <th className="p-3">Bus Plate</th>
                              <th className="p-3">Route</th>
                              <th className="p-3">Chart Account</th>
                              <th className="p-3">Category</th>
                              <th className="p-3">Reference</th>
                              <th className="p-3 text-right">Registered Amount</th>
                              <th className="p-3 text-center">Audit Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 text-neutral-200">
                            {pendingCashList.map(row => (
                              <tr key={row.id} className="hover:bg-amber-500/[0.01]">
                                <td className="p-3 font-mono font-medium text-[10px]">{row.transaction_date ? String(row.transaction_date).split("T")[0] : "—"}</td>
                                <td className="p-3 font-light">{row.cash_types?.type_name || "—"}</td>
                                <td className="p-3 font-semibold">{row.staffs?.full_name || "—"}</td>
                                <td className="p-3 font-mono text-[10px]">{row.buses?.plate_number || "—"}</td>
                                <td className="p-3 font-light text-[10px] max-w-[110px] truncate">{row.routes?.route_name || "—"}</td>
                                <td className="p-3 font-light">{row.accounts?.account_name || "—"}</td>
                                <td className="p-3 font-light text-neutral-450">{row.categories?.category_name || "—"}</td>
                                <td className="p-3 font-mono font-bold text-[10px]">{row.reference_number || "—"}</td>
                                <td className="p-3 text-right text-amber-400 font-bold font-mono">{formatTZS(row.amount)}</td>
                                <td className="p-3">
                                  <div className="flex items-center gap-2 justify-center">
                                    <select
                                      className="bg-[#180609] border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-amber-500/40 h-8 font-mono"
                                      value={approvalsStatusSelections[row.id] || ""}
                                      onChange={(e) => setApprovalsStatusSelections(prev => ({ ...prev, [row.id]: e.target.value }))}
                                    >
                                      {lookups.transactionStatuses.map(s => (
                                        <option key={s.id} value={s.id}>{s.display_name}</option>
                                      ))}
                                    </select>
                                    <button
                                      onClick={() => handleUpdateCashStatus(row.id)}
                                      disabled={approvalSavingId === row.id}
                                      className="px-2.5 py-1 bg-amber-505/10 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-[10px] text-amber-400 font-mono rounded-lg transition-all flex items-center gap-1 cursor-pointer h-8"
                                    >
                                      {approvalSavingId === row.id ? (
                                        <RefreshCw className="h-3 w-3 animate-spin" />
                                      ) : (
                                        "Save Action"
                                      )}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                  </div>

                </div>
              )}

              {/* ========================================================================== */}
              {/* SECTION 5: MEMOS WORKSPACE                                                */}
              {/* ========================================================================== */}
              {activeTab === "memos" && (
                <div className="space-y-6">
                  <div className="pb-4 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Mail className="h-4 w-4 text-emerald-400" />
                        Corporate Memos Workspace
                      </h3>
                      <p className="text-[11px] text-neutral-400 mt-0.5">Disseminate official notes, policy directives, or warnings via secure encrypted pathways.</p>
                    </div>

                    {/* Subnavigation controls inside memos */}
                    <div className="flex bg-[#14100c] p-1 border border-amber-500/20 rounded-xl">
                      {[
                        { id: "inbox", label: "Inbox Alerts", count: unreadMemosCount },
                        { id: "sent", label: "Dispatched", count: 0 },
                        { id: "compose", label: "Compose Memo", count: 0 }
                      ].map(st => (
                        <button
                          key={st.id}
                          onClick={() => {
                            setMemoSubTab(st.id as any);
                            setSelectedMemo(null);
                          }}
                          className={`px-3 py-1.5 text-[11px] font-mono tracking-wide rounded-lg flex items-center gap-1.5 cursor-pointer transition-all ${
                            memoSubTab === st.id
                              ? "bg-amber-500/15 text-amber-400 font-bold"
                              : "text-neutral-450 hover:text-neutral-200"
                          }`}
                        >
                          {st.id === "inbox" && <Inbox className="h-3.5 w-3.5" />}
                          {st.id === "sent" && <Send className="h-3.5 w-3.5" />}
                          {st.id === "compose" && <Plus className="h-3.5 w-3.5" />}
                          <span>{st.label}</span>
                          {st.id === "inbox" && st.count > 0 && (
                            <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono text-[9px] px-1.5 py-0.2 rounded-full font-bold ml-1">
                              {st.count}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {memosLoading ? (
                    <div className="py-16 text-center text-xs">
                      <RefreshCw className="h-6 w-6 animate-spin text-amber-500 mx-auto" />
                      <span className="font-mono text-neutral-500 mt-2 block">SECURE DIRECT ROUTED INBOX SYNCING...</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                      
                      {/* Left list pane */}
                      <div className="md:col-span-5 space-y-3">
                        {memoSubTab === "inbox" && (
                          <div className="space-y-2 max-h-[460px] overflow-y-auto custom-scrollbar">
                            {inboxMemos.length === 0 ? (
                              <div className="p-8 text-center text-neutral-500 italic text-xs border border-dashed border-white/5 rounded-xl bg-black/10">No messages in inbox.</div>
                            ) : (
                              inboxMemos.map(m => (
                                <div
                                  key={m.id}
                                  onClick={() => handleOpenMemo(m)}
                                  className={`p-4 rounded-xl border transition-all cursor-pointer text-left relative ${
                                    selectedMemo?.id === m.id
                                      ? "bg-amber-500/10 border-amber-500/30"
                                      : m.is_read
                                      ? "bg-[#180609]/40 border-white/5 hover:border-white/10"
                                      : "bg-[#25080e]/60 border-amber-500/10 hover:border-amber-500/20"
                                  }`}
                                >
                                  {!m.is_read && (
                                    <div className="absolute top-4 right-4 h-2 w-2 rounded-full bg-amber-500 animate-pulse"></div>
                                  )}
                                  <h4 className="font-bold text-xs text-white truncate max-w-[200px]">{m.title}</h4>
                                  <div className="text-[10px] text-amber-500 font-mono mt-0.5">From: {m.sender?.full_name || "Administrator"}</div>
                                  <p className="text-[11px] text-neutral-400 line-clamp-1 mt-1 font-light">{m.message}</p>
                                  <span className="text-[9px] font-mono text-neutral-500 block mt-2 text-right">
                                    {new Date(m.created_at).toLocaleString()}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        )}

                        {memoSubTab === "sent" && (
                          <div className="space-y-2 max-h-[460px] overflow-y-auto custom-scrollbar">
                            {sentMemos.length === 0 ? (
                              <div className="p-8 text-center text-neutral-500 italic text-xs border border-dashed border-white/5 rounded-xl bg-black/10">No messages dispatched yet.</div>
                            ) : (
                              sentMemos.map(m => (
                                <div
                                  key={m.id}
                                  onClick={() => setSelectedMemo(m)}
                                  className={`p-4 rounded-xl border transition-all cursor-pointer text-left ${
                                    selectedMemo?.id === m.id
                                      ? "bg-amber-500/10 border-amber-500/30"
                                      : "bg-[#1b0609]/40 border-white/5 hover:border-white/10"
                                  }`}
                                >
                                  <h4 className="font-bold text-xs text-white truncate max-w-[200px]">{m.title}</h4>
                                  <div className="text-[10px] text-amber-500 font-mono mt-0.5">To: {m.receiver?.full_name || "Staff Member"}</div>
                                  <p className="text-[11px] text-neutral-400 line-clamp-1 mt-1 font-light">{m.message}</p>
                                  <span className="text-[9px] font-mono text-neutral-500 block mt-2 text-right">
                                    {new Date(m.created_at).toLocaleString()}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        )}

                        {memoSubTab === "compose" && (
                          <form onSubmit={handleSendComposeMemo} className="p-5 border border-[#4a3d2c]/30 bg-[#1c1813]/40 rounded-2xl space-y-4">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-amber-500/80 font-bold block border-b border-white/5 pb-1">COMPOSE DIRECT DISPATCH INSTRUCTIONS</span>
                            
                            {composeSuccess && (
                              <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/20 text-emerald-300 text-xs">
                                {composeSuccess}
                              </div>
                            )}

                            {composeErr && (
                              <div className="p-3 bg-red-950/20 rounded-xl border border-red-500/30 text-red-300 text-xs font-mono">
                                {composeErr}
                              </div>
                            )}

                            <div>
                              <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1">Target Receiver</label>
                              <select
                                className="w-full bg-[#180609] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/40 h-[40px]"
                                value={composeReceiverId}
                                onChange={(e) => setComposeReceiverId(e.target.value)}
                                required
                              >
                                <option value="">Select corporate user...</option>
                                {memoProfiles.map(p => (
                                  <option key={p.id} value={p.id}>{p.full_name}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1">Memo Headline</label>
                              <input
                                type="text"
                                className="w-full bg-[#180609] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/40 h-10"
                                placeholder="Core Subject Title..."
                                value={composeTitle}
                                onChange={(e) => setComposeTitle(e.target.value)}
                                required
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1">Message Body</label>
                              <textarea
                                rows={4}
                                className="w-full bg-[#180609] border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500/40"
                                placeholder="Describe memo contents, requirements, warnings and tasks in detail..."
                                value={composeMessage}
                                onChange={(e) => setComposeMessage(e.target.value)}
                                required
                              />
                            </div>

                            <button
                              type="submit"
                              disabled={composeSaving}
                              className="w-full p-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-500 disabled:opacity-50 text-neutral-950 font-black font-mono tracking-widest uppercase text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer h-10 shadow-md"
                            >
                              {composeSaving ? (
                                <>
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                  Routing Memo...
                                </>
                              ) : (
                                <>
                                  <Send className="h-4 w-4" />
                                  Dispatch Memo
                                </>
                              )}
                            </button>
                          </form>
                        )}
                      </div>

                      {/* Right Reader panel */}
                      <div className="md:col-span-7">
                        {selectedMemo ? (
                          <div className="p-6 border border-[#4a3d2c]/30 bg-[#1c1813]/40 rounded-2xl space-y-4">
                            <div className="flex justify-between items-center border-b border-white/5 pb-3">
                              <div>
                                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-500 font-bold">Encrypted direct transmission read-panel</span>
                                <h3 className="text-sm font-serif font-black tracking-wide text-white mt-1">{selectedMemo.title}</h3>
                              </div>
                              <button
                                onClick={() => setSelectedMemo(null)}
                                className="text-neutral-500 hover:text-white transition-colors cursor-pointer"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>

                            <div className="flex justify-between items-center bg-amber-950/5 border border-amber-500/10 p-3 rounded-xl text-[10px] font-mono">
                              <div>From: <span className="text-white font-bold">{selectedMemo.sender?.full_name || "System Master"}</span></div>
                              <div>To: <span className="text-white font-bold">{selectedMemo.receiver?.full_name || "Corporate staff node"}</span></div>
                            </div>

                            <div className="p-4 bg-black/25 border border-white/5 rounded-xl text-xs leading-relaxed text-neutral-200 font-light min-h-[140px] whitespace-pre-wrap">
                              {selectedMemo.message}
                            </div>

                            <span className="text-[10px] font-mono text-neutral-500 block text-right">
                              Archival date: {new Date(selectedMemo.created_at).toLocaleString()}
                            </span>
                          </div>
                        ) : (
                          memoSubTab !== "compose" && (
                            <div className="p-12 border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-center text-neutral-500 min-h-[300px] bg-black/10">
                              <Mail className="h-8 w-8 text-neutral-700 animate-pulse mb-3" />
                              <span className="text-[11px] font-mono">Read console ready</span>
                              <p className="text-[10px] text-neutral-600 max-w-xs mt-1 leading-normal">
                                Click on any message preview card on the left panel to load full text details safely.
                              </p>
                            </div>
                          )
                        )}
                      </div>

                    </div>
                  )}
                </div>
              )}

              {/* ========================================================================== */}
              {/* SECTION 6: HR REPORTS WORKSPACE                                           */}
              {/* ========================================================================== */}
              {activeTab === "reports" && (
                <div className="space-y-6">
                  {/* Page Header Segment */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#4a3d2c]/30 pb-4 gap-4">
                    <div>
                      <h3 className="text-base font-serif font-black tracking-wide text-white flex items-center gap-2">
                        <FileBarChart className="h-5 w-5 text-amber-500 animate-pulse" />
                        HR Reports Portal
                      </h3>
                      <p className="text-xs text-neutral-400 mt-0.5">Staff payroll, shortages, performance, and employee records from live views.</p>
                    </div>

                    {activeReport && reportData.length > 0 && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleExportExcel}
                          className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-neutral-950 font-black font-mono tracking-wider uppercase text-[10px] rounded-xl flex items-center gap-1.5 transition-all cursor-pointer h-9 shadow-lg"
                        >
                          <Download className="h-3.5 w-3.5 text-neutral-950" />
                          Excel Export
                        </button>
                        <button
                          onClick={handleExportPDF}
                          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-neutral-950 font-black font-mono tracking-wider uppercase text-[10px] rounded-xl flex items-center gap-1.5 transition-all cursor-pointer h-9 shadow-lg"
                        >
                          <FileText className="h-3.5 w-3.5 text-neutral-950" />
                          PDF Export
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Section 1: Dashboard Cards (Categorized report lists) */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                      { title: "Payroll & Payments", cat: "Payroll & Payments" },
                      { title: "Performance & Shortages", cat: "Performance & Shortages" },
                      { title: "Staff Master Data", cat: "Staff Master Data" }
                    ].map(group => {
                      const groupReports = reportsConfig.filter(r => r.category === group.cat);
                      return (
                        <div key={group.cat} className="space-y-3 p-4 bg-[#17130f]/50 border border-[#4a3d2c]/25 rounded-2xl">
                          <h4 className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-500/80 font-bold border-b border-white/5 pb-1.5">{group.title}</h4>
                          <div className="space-y-2">
                            {groupReports.map(report => {
                              const IconComp = report.icon;
                              const isSelected = activeReportId === report.id;
                              return (
                                <div
                                  key={report.id}
                                  onClick={() => {
                                    setActiveReportId(report.id);
                                    setReportData([]);
                                    setReportError(null);
                                    setFilterMonthFrom("");
                                    setFilterMonthTo("");
                                    setFilterDateFrom("");
                                    setFilterDateTo("");
                                    setFilterTextStaff("");
                                    setFilterTextOffice("");
                                    setFilterTextOccupation("");
                                    setFilterTextStatus("");
                                    setAppliedFilters({ isFiltered: false });
                                  }}
                                  className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                                    isSelected
                                      ? "bg-amber-500/10 border-amber-500/35 shadow-[0_0_15px_rgba(245,158,11,0.12)]"
                                      : "bg-[#241e17]/30 border-white/5 hover:border-amber-500/20 hover:bg-[#241e17]/60"
                                  }`}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className={`p-2 rounded-lg border ${isSelected ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : "bg-black/40 border-white/5 text-neutral-400"}`}>
                                      <IconComp className="h-4 w-4" />
                                    </div>
                                    <div className="truncate">
                                      <span className="text-xs font-bold text-white leading-none block">{report.name}</span>
                                      <span className="text-[9px] font-mono text-neutral-500 mt-1 block uppercase tracking-wider">{report.view}</span>
                                    </div>
                                  </div>
                                  <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${isSelected ? "text-amber-400 translate-x-1" : "text-neutral-500"}`} />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Section 2: Filters and Data Table view if report is selected */}
                  {activeReport ? (
                    <div className="space-y-5 p-6 bg-[#1f1913]/40 border border-[#4a3d2c]/40 backdrop-blur-xl rounded-2xl">
                      {/* Active Report Header */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-white/5 pb-3">
                        <div>
                          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-500">Live Workspace Database Connection</span>
                          <h4 className="text-sm font-serif font-black tracking-wide text-white mt-0.5 uppercase">
                            {activeReport.name} {companyName ? `// ${companyName}` : ""}
                          </h4>
                        </div>
                        <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg px-2.5 py-1 text-[9px] font-mono text-amber-400">
                          {appliedFilters.isFiltered ? "ALL RECORDS FETCHED (FILTER ACTIVE)" : "100 ROWS PREVIEW LIMIT (UNFILTERED)"}
                        </div>
                      </div>

                      {/* Dynamic Filter Layout */}
                      <div className="p-4 bg-black/30 border border-white/5 rounded-xl space-y-4">
                        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-amber-500/80 font-bold border-b border-white/5 pb-1.5">
                          <Filter className="h-3.5 w-3.5 text-amber-450" />
                          Workspace Filter Engine
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-left">
                          {/* 1. Month Columns filtering */}
                          {activeReport.columns.some(c => c.type === "month") && (
                            <>
                              <div>
                                <label className="block text-[9px] font-mono uppercase text-neutral-400 mb-1">From Month</label>
                                <input
                                  type="month"
                                  className="w-full bg-[#180609] border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-amber-500/40 h-8 font-mono"
                                  value={filterMonthFrom}
                                  onChange={(e) => setFilterMonthFrom(e.target.value)}
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] font-mono uppercase text-neutral-400 mb-1">To Month</label>
                                <input
                                  type="month"
                                  className="w-full bg-[#180609] border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-amber-500/40 h-8 font-mono"
                                  value={filterMonthTo}
                                  onChange={(e) => setFilterMonthTo(e.target.value)}
                                />
                              </div>
                            </>
                          )}

                          {/* 2. Date Columns filtering */}
                          {activeReport.columns.some(c => c.type === "date") && (
                            <>
                              <div>
                                <label className="block text-[9px] font-mono uppercase text-neutral-400 mb-1">From Date</label>
                                <input
                                  type="date"
                                  className="w-full bg-[#180609] border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-amber-500/40 h-8 font-mono"
                                  value={filterDateFrom}
                                  onChange={(e) => setFilterDateFrom(e.target.value)}
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] font-mono uppercase text-neutral-400 mb-1">To Date</label>
                                <input
                                  type="date"
                                  className="w-full bg-[#180609] border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-amber-500/40 h-8 font-mono"
                                  value={filterDateTo}
                                  onChange={(e) => setFilterDateTo(e.target.value)}
                                />
                              </div>
                            </>
                          )}

                          {/* 3. Text search fields where applicable */}
                          {activeReport.columns.some(c => c.key === "staff" || c.key === "staff_name" || c.key === "full_name") && (
                            <div>
                              <label className="block text-[9px] font-mono uppercase text-neutral-400 mb-1">Search Staff</label>
                              <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-3 w-3 text-neutral-500" />
                                <input
                                  type="text"
                                  className="w-full bg-[#180609] border border-white/10 rounded-lg pl-7 pr-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-amber-500/40 h-8"
                                  placeholder="Type name..."
                                  value={filterTextStaff}
                                  onChange={(e) => setFilterTextStaff(e.target.value)}
                                />
                              </div>
                            </div>
                          )}

                          {activeReport.columns.some(c => c.key === "office") && (
                            <div>
                              <label className="block text-[9px] font-mono uppercase text-neutral-400 mb-1">Office Station</label>
                              <select
                                className="w-full bg-[#180609] border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-amber-500/40 h-8 font-mono"
                                value={filterTextOffice}
                                onChange={(e) => setFilterTextOffice(e.target.value)}
                              >
                                <option value="">All Stations...</option>
                                {lookups.offices.map(o => (
                                  <option key={o.id} value={o.name}>{o.name}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {activeReport.columns.some(c => c.key === "occupation") && (
                            <div>
                              <label className="block text-[9px] font-mono uppercase text-neutral-400 mb-1">Occupation</label>
                              <select
                                className="w-full bg-[#180609] border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-amber-500/40 h-8 font-mono"
                                value={filterTextOccupation}
                                onChange={(e) => setFilterTextOccupation(e.target.value)}
                              >
                                <option value="">All Roles...</option>
                                {lookups.occupations.map(o => (
                                  <option key={o.id} value={o.name}>{o.name}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {activeReport.columns.some(c => c.key === "status") && (
                            <div>
                              <label className="block text-[9px] font-mono uppercase text-neutral-400 mb-1">Status</label>
                              <select
                                className="w-full bg-[#180609] border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-amber-500/40 h-8 font-mono"
                                value={filterTextStatus}
                                onChange={(e) => setFilterTextStatus(e.target.value)}
                              >
                                <option value="">All Statuses...</option>
                                <option value="Active">Active Enrollment</option>
                                <option value="Inactive">Inactive</option>
                                <option value="Terminated">Terminated</option>
                                <option value="Suspended">Suspended</option>
                              </select>
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                          <button
                            onClick={handleClearFilters}
                            className="px-3.5 py-1.5 bg-neutral-900 border border-white/5 hover:border-amber-500/20 text-[10px] font-mono uppercase tracking-wider text-neutral-400 hover:text-white rounded-lg transition-all flex items-center gap-1.5 cursor-pointer h-8"
                          >
                            <Eraser className="h-3 w-3" />
                            Clear Criteria
                          </button>
                          <button
                            onClick={handleApplyFilters}
                            className="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-550 text-neutral-950 font-black font-mono uppercase tracking-wider text-[10px] rounded-lg transition-all flex items-center gap-1.5 cursor-pointer h-8 shadow-md"
                          >
                            <Check className="h-3 w-3" />
                            Apply Indexes
                          </button>
                        </div>
                      </div>

                      {/* Live Data Table Preview Segment */}
                      <div className="space-y-2">
                        {reportLoading ? (
                          <div className="py-20 text-center border border-white/5 bg-black/15 rounded-xl">
                            <RefreshCw className="h-7 w-7 animate-spin text-amber-500 mx-auto mb-2.5" />
                            <span className="font-mono text-xs text-neutral-400 tracking-widest uppercase">TUNING WORKSPACE PIPELINES...</span>
                          </div>
                        ) : reportError ? (
                          <div className="p-4 bg-red-950/20 border border-red-500/20 text-red-300 rounded-xl text-xs font-mono text-left space-y-2">
                            <div className="font-bold flex items-center gap-1.5 text-red-400"><AlertTriangle className="h-4 w-4" /> PG_RELATION_CONNECTION_ERROR:</div>
                            <p className="font-light">{reportError}</p>
                          </div>
                        ) : reportData.length === 0 ? (
                          <div className="py-16 text-center border border-dashed border-white/5 bg-black/10 rounded-xl text-neutral-500 text-xs font-mono italic">
                            No matching records gathered from view. Refine filters or clear criteria.
                          </div>
                        ) : (
                          <div className="border border-white/5 rounded-xl bg-[#1c1813]/85 overflow-x-auto relative custom-scrollbar max-h-[500px]">
                            <table className="w-full border-collapse text-left text-[11px] font-sans">
                              <thead className="sticky top-0 z-10 bg-[#14100c] border-b border-white/10 shadow-[0_2px_5px_rgba(0,0,0,0.4)]">
                                <tr className="text-[10px] font-mono uppercase tracking-wider text-amber-500">
                                  {activeReport.columns.map(col => (
                                    <th
                                      key={col.key}
                                      className={`p-3 font-semibold ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}`}
                                    >
                                      {col.label}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5 text-neutral-200">
                                {reportData.map((row, rowIdx) => (
                                  <tr key={rowIdx} className="hover:bg-amber-500/[0.01] transition-colors">
                                    {activeReport.columns.map((col) => {
                                      const val = row[col.key];
                                      const isNumeric = [
                                        "basic_salary", "allowances", "gross_salary", "deductions", "net_pay",
                                        "shortage", "amount", "income", "total_wages", "total_paid"
                                      ].includes(col.key);

                                      // Special Status badge layout
                                      if (col.key === "status" && val !== undefined) {
                                        const statusStr = String(val);
                                        const isActive = statusStr.toLowerCase() === "active" || statusStr.toLowerCase() === "true" || statusStr === "Active Enrollment" || statusStr === "Active";
                                        return (
                                          <td key={col.key} className="p-3 text-center">
                                            <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full inline-block font-semibold ${
                                              isActive ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25" : "bg-red-500/15 text-red-400 border border-red-500/25"
                                            }`}>
                                              {statusStr}
                                            </span>
                                          </td>
                                        );
                                      }

                                      return (
                                        <td
                                          key={col.key}
                                          className={`p-3 ${
                                            col.align === "right" ? "text-right font-mono text-amber-400 font-bold" : col.align === "center" ? "text-center font-medium" : "text-left font-light"
                                          }`}
                                        >
                                          {isNumeric ? (
                                            formatTZSMoney(val)
                                          ) : col.type === "date" && val ? (
                                            <span className="font-mono text-[10px]">{String(val).split("T")[0]}</span>
                                          ) : val === undefined || val === null ? (
                                            <span className="text-neutral-500">—</span>
                                          ) : (
                                            String(val)
                                          )}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}

                                {/* Sum row at standard output */}
                                <tr className="bg-amber-950/20 border-t border-amber-500/25 font-semibold text-amber-400 sticky bottom-0 outline outline-1 outline-[#180609] shadow-[0_-2px_5px_rgba(0,0,0,0.3)]">
                                  {activeReport.columns.map((col, idx) => {
                                    const isNumericSum = [
                                      "basic_salary", "allowances", "gross_salary", "deductions", "net_pay",
                                      "shortage", "amount", "income", "total_wages", "total_paid"
                                    ].includes(col.key);
                                    if (idx === 0) {
                                      return (
                                        <td key={col.key} className="p-3 font-black uppercase font-mono text-amber-500">
                                          TOTAL
                                        </td>
                                      );
                                    }
                                    if (isNumericSum) {
                                      const sum = reportData.reduce((acc, row) => acc + (Number(row[col.key]) || 0), 0);
                                      return (
                                        <td key={col.key} className="p-3 text-right font-mono font-black border-l border-amber-500/10">
                                          {formatTZSMoney(sum)}
                                        </td>
                                      );
                                    }
                                    if (["one_way", "enroute", "total"].includes(col.key)) {
                                      const sum = reportData.reduce((acc, row) => acc + (Number(row[col.key]) || 0), 0);
                                      return (
                                        <td key={col.key} className="p-3 text-right font-mono font-black border-l border-amber-500/10">
                                          {sum}
                                        </td>
                                      );
                                    }
                                    return <td key={col.key} className="p-3 border-l border-white/[0.02]"></td>;
                                  })}
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-12 border border-dashed border-[#4a3d2c]/35 bg-[#1c1813]/40 rounded-3xl relative overflow-hidden flex flex-col items-center justify-center text-center text-neutral-500 min-h-[350px]">
                      <FileBarChart className="h-10 w-10 text-neutral-700 animate-pulse mb-3" />
                      <span className="text-[11px] font-mono text-amber-500/80 font-bold uppercase tracking-wider">Reports Terminal Standby</span>
                      <p className="text-[11px] text-neutral-400 max-w-xs mt-1.5 leading-relaxed">
                        Select any of the 6 executive live database reports of the three corporate categories above to execute SQL pipelines and analyze real-time metrics.
                      </p>
                    </div>
                  )}
                </div>
              )}

            </motion.div>
          </AnimatePresence>

        </main>
      </div>

    </div>
  );
}
