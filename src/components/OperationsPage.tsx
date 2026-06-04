import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Building2, 
  MapPin, 
  Bus, 
  User, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  LayoutDashboard, 
  ListChecks, 
  CheckSquare, 
  Mail, 
  FileBarChart, 
  Inbox, 
  Send, 
  Plus, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowLeft, 
  LogOut,
  Menu,
  Compass,
  Zap,
  Navigation,
  FileText,
  Clock,
  RefreshCw,
  Users,
  Check,
  Trash2,
  ChevronDown,
  SlidersHorizontal,
  X
} from "lucide-react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from "recharts";
import { supabase, resolveProfile, getActiveCompanyId } from "../lib/supabase";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

/* ========================================================================== */
/* VALIDATION SCHEMAS AND TYPES                                               */
/* ========================================================================== */

const dailyBusEntrySchema = z.object({
  date: z.string().min(1, { message: "Operational date is required." }),
  bus_id: z.string().min(1, { message: "Please select a bus." }),
  route_id: z.string().min(1, { message: "Please select a route." }),
  conductor_id: z.string().min(1, { message: "Please select a conductor." }),
  driver_id: z.string().min(1, { message: "Please select a driver." }),
  one_way: z.coerce.number().min(0, { message: "Passengers must be 0 or more." }),
  enroute: z.coerce.number().min(0, { message: "Passengers must be 0 or more." }),
});

type DailyBusEntryFormValues = z.infer<typeof dailyBusEntrySchema>;

const addBusSchema = z.object({
  plate_number: z.string().min(1, { message: "Plate number is required." }),
  model: z.string().min(1, { message: "Model is required." }),
  seating_capacity: z.coerce.number().min(1, { message: "Seating capacity must be 1 or more." }),
  purchase_date: z.string().min(1, { message: "Purchase date is required." }),
});

const addOfficeSchema = z.object({
  office_name: z.string().min(1, { message: "Office name is required." }),
  region_id: z.string().min(1, { message: "Please select a region." }),
});

/* ========================================================================== */
/* COMPONENT: SEARCHABLE SELECT (DROPDOWN MODAL FOR FORM FIELDS)              */
/* ========================================================================== */
interface SearchableSelectProps {
  options: { id: string; name: string }[];
  value: string;
  onChange: (val: string) => void;
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
    <div className="relative w-full" ref={containerRef}>
      <label className="block text-[10px] uppercase tracking-wider text-neutral-400 font-mono mb-1.5">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full text-left bg-[#0c121f]/95 border ${
          error ? "border-red-500/40 focus:border-red-500" : "border-white/10 hover:border-blue-500/30 focus:border-blue-500/60"
        } rounded-xl p-2.5 text-xs text-neutral-200 flex items-center justify-between gap-1 focus:outline-none transition-colors h-[40px] font-sans`}
      >
        <span className="truncate">{selectedOption ? selectedOption.name : placeholder}</span>
        <span className="text-blue-500 text-[8px] pointer-events-none shrink-0 ml-1">▼</span>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-[#0a0e17] border border-blue-500/20 rounded-xl shadow-2xl p-2 space-y-2">
          <input
            type="text"
            className="w-full bg-[#111726] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500/50 font-mono"
            placeholder={`Search ${label}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className="max-h-40 overflow-y-auto space-y-0.5 custom-scrollbar">
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
                  className={`w-full text-left rounded-lg px-2.5 py-1.5 text-xs transition-colors block truncate ${
                    String(opt.id) === String(value)
                      ? "bg-blue-500/15 text-blue-300 border border-blue-500/25"
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
      {error && (
        <span className="text-[10px] text-red-400 mt-1 block font-mono">
          {error}
        </span>
      )}
    </div>
  );
}

interface DashboardViewProps {
  metrics: any;
  chartData: any[];
  metricsLoading: boolean;
}

function DashboardView({ metrics, chartData, metricsLoading }: DashboardViewProps) {
  const topThree = useMemo(() => {
    const util = metrics?.top_three_utilization;
    if (!util) return [];
    if (Array.isArray(util)) return util;
    try {
      const parsed = typeof util === "string" ? JSON.parse(util) : util;
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      console.warn("Error parsing top_three_utilization JSON", e);
    }
    return [];
  }, [metrics]);

  if (metricsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] py-12">
        <RefreshCw className="h-7 w-7 text-amber-500 animate-spin mb-3" />
        <span className="font-mono text-xs tracking-wider text-neutral-400">
          GENERATING LIVE METRICS TIMELINE...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview stats block (Aesthetic, pristine) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Buses Travelled Today */}
        <div className="rounded-2xl border border-white/5 bg-[#0a0f1d]/40 backdrop-blur-md p-5 relative overflow-hidden flex flex-col justify-between min-h-[140px]">
          <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-blue-500/5 blur-[40px] rounded-full pointer-events-none"></div>
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block">
              Buses Travelled Today
            </span>
            <Bus className="h-4 w-4 text-blue-400" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-serif font-bold text-white tracking-tight">
              {metrics?.total_buses_today ?? "0"}
            </span>
            <span className="text-[10px] block text-neutral-500 font-mono mt-1">Active Departures Today</span>
          </div>
        </div>

        {/* Card 2: Total Offices */}
        <div className="rounded-2xl border border-white/5 bg-[#0a0f1d]/40 backdrop-blur-md p-5 relative overflow-hidden flex flex-col justify-between min-h-[140px]">
          <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-amber-500/5 blur-[40px] rounded-full pointer-events-none"></div>
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block">
              Total Offices
            </span>
            <Building2 className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-serif font-bold text-white tracking-tight">
              {metrics?.total_offices ?? "0"}
            </span>
            <span className="text-[10px] block text-neutral-500 font-mono mt-1">Operational Hub Stations</span>
          </div>
        </div>

        {/* Card 3: Total Buses */}
        <div className="rounded-2xl border border-white/5 bg-[#0a0f1d]/40 backdrop-blur-md p-5 relative overflow-hidden flex flex-col justify-between min-h-[140px]">
          <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-blue-500/5 blur-[40px] rounded-full pointer-events-none"></div>
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block">
              Total Buses
            </span>
            <Compass className="h-4 w-4 text-blue-400" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-serif font-bold text-white tracking-tight">
              {metrics?.total_buses_registered ?? "0"}
            </span>
            <span className="text-[10px] block text-neutral-500 font-mono mt-1">Total Fleet Registry</span>
          </div>
        </div>

        {/* Card 4: Most Utilized Bus */}
        <div className="rounded-2xl border border-white/5 bg-[#0a0f1d]/40 backdrop-blur-md p-5 flex flex-col justify-between min-h-[140px] relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-amber-500/5 blur-[40px] rounded-full pointer-events-none"></div>
          <div className="z-10">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-2">
              Most Utilized Bus
            </span>
            {topThree.length === 0 ? (
              <div className="text-[11px] text-neutral-500 italic py-2">
                No Utilization Data
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-white/5 text-neutral-550 text-[9px] uppercase tracking-wider font-mono">
                      <th className="pb-1 font-semibold">Bus</th>
                      <th className="pb-1 font-semibold text-right">Percent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-neutral-300 font-mono">
                    {topThree.slice(0, 3).map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-white/5">
                        <td className="py-1 max-w-[90px] truncate">{row.bus || row.plate_number || "—"}</td>
                        <td className="py-1 text-right text-amber-500 font-semibold">
                          {row.percent !== undefined && row.percent !== null 
                            ? `${Number(row.percent).toFixed(2)}%` 
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Utilization Trend Graph Section */}
      <div className="rounded-2xl border border-white/5 bg-[#0a0f1d]/45 p-6 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wide uppercase font-mono">
              Monthly Utilization Trend
            </h3>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Average fleet capacity usage mapped across calendar months.
            </p>
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="h-72 border border-dashed border-white/5 rounded-xl flex flex-col items-center justify-center p-8 text-center bg-[#070b13]/25">
            <Compass className="h-8 w-8 text-neutral-600 mb-2 animate-pulse" />
            <span className="text-xs text-neutral-400 font-mono">No Utilization History Logged</span>
            <p className="text-[10px] text-neutral-500 max-w-xs mt-1">
              Utilization ratios will plot automatically as soon as transit logs are filed.
            </p>
          </div>
        ) : (
          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorUtil" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d97706" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis 
                  dataKey="month" 
                  stroke="rgba(255,255,255,0.3)" 
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                  fontFamily="monospace"
                />
                <YAxis 
                  stroke="rgba(255,255,255,0.3)" 
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  dx={-5}
                  fontFamily="monospace"
                  tickFormatter={(val) => `${val}%`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0a101d', 
                    borderColor: 'rgba(59,130,246,0.2)',
                    borderRadius: '12px',
                    fontSize: '11px',
                    color: '#fff',
                    fontFamily: 'sans-serif'
                  }}
                  formatter={(value) => [`${Number(value).toFixed(2)}%`, 'Average Utilization']}
                />
                <Area 
                  type="monotone" 
                  dataKey="average_utilization" 
                  stroke="#d97706" 
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorUtil)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

/* ========================================================================== */
/* VIEW COMPONENT 2: DAILY BUSES ENTRY FORM                                   */
/* ========================================================================== */
interface DailyBusesEntryViewProps {
  lookups: {
    busesReady: { id: string; name: string }[];
    routesReady: { id: string; name: string }[];
    staffsReady: { id: string; name: string }[];
  };
  currentUserProfile: any;
}

function DailyBusesEntryView({ lookups, currentUserProfile }: DailyBusesEntryViewProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(dailyBusEntrySchema) as any,
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      bus_id: "",
      route_id: "",
      conductor_id: "",
      driver_id: "",
      one_way: 0,
      enroute: 0,
    }
  });

  const onSubmit = async (data: any) => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      const payload: any = {
        date: data.date,
        bus_id: data.bus_id,
        route_id: data.route_id,
        conductor_id: data.conductor_id,
        driver_id: data.driver_id,
        one_way: Number(data.one_way),
        enroute: Number(data.enroute)
      };

      if (currentUserProfile?.company_id) {
        payload.company_id = currentUserProfile.company_id;
      }

      const { error: insertError } = await supabase
        .from("daily_bus_operations")
        .insert(payload);

      if (insertError) throw insertError;

      // Successful dispatch
      setSuccess(true);
      
      // Reset only on successful save
      reset({
        date: new Date().toISOString().split("T")[0],
        bus_id: "",
        route_id: "",
        conductor_id: "",
        driver_id: "",
        one_way: 0,
        enroute: 0,
      });

      setTimeout(() => setSuccess(false), 5000);

    } catch (err: any) {
      console.error("Supabase daily operations dispatch failure:", err);
      setError(err?.message || "An unexpected error occurred while writing values.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="rounded-2xl border border-white/5 bg-[#0a0f1d]/85 p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-blue-500/25 to-transparent"></div>
        
        <div className="flex items-center gap-3 pb-4 border-b border-white/5 mb-5">
          <div className="h-9 w-9 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-center text-blue-400">
            <Bus className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Daily Operational Register</h3>
            <p className="text-[11px] text-neutral-400">File a new bus assignment to log driver, conductor, and passenger manifests.</p>
          </div>
        </div>

        {/* FEEDBACK LABELS */}
        {error && (
          <div className="p-3 mb-4 bg-red-950/20 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-start gap-2.5 font-mono">
            <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold uppercase tracking-wider text-[9px] block mb-1">Dispatch Lockout</strong>
              {error}
            </div>
          </div>
        )}

        {success && (
          <div className="p-3 mb-4 bg-emerald-950/20 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-start gap-2.5 font-mono">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold uppercase tracking-wider text-[9px] block mb-1">Dispatch Archived</strong>
              Manifest written successfully to Supabase daily operations ledger.
            </div>
          </div>
        )}

        {/* VERTICAL FORM */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 font-sans text-xs">
          {/* Date Selector */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-neutral-400 font-mono mb-1.5">
              Operational Date *
            </label>
            <Controller
              control={control}
              name="date"
              render={({ field }) => (
                <input
                  type="date"
                  {...field}
                  className={`w-full bg-[#0c121f] border ${
                    errors.date ? "border-red-500/40 focus:border-red-500" : "border-white/10 hover:border-blue-500/20 focus:border-blue-500/50"
                  } rounded-xl p-2.5 text-xs text-white focus:outline-none transition-colors h-[40px]`}
                />
              )}
            />
            {errors.date && (
              <span className="text-[10px] text-red-400 mt-1 block font-mono">{errors.date.message}</span>
            )}
          </div>

          {/* Searchable Bus Selector */}
          <Controller
            control={control}
            name="bus_id"
            render={({ field }) => (
              <SearchableSelect
                options={lookups.busesReady}
                value={field.value}
                onChange={field.onChange}
                placeholder="Choose fleet bus plate..."
                label="Bus Assignment *"
                error={errors.bus_id?.message}
              />
            )}
          />

          {/* Searchable Route Selector */}
          <Controller
            control={control}
            name="route_id"
            render={({ field }) => (
              <SearchableSelect
                options={lookups.routesReady}
                value={field.value}
                onChange={field.onChange}
                placeholder="Choose active route channel..."
                label="Route Alignment *"
                error={errors.route_id?.message}
              />
            )}
          />

          {/* Searchable Conductor Selector */}
          <Controller
            control={control}
            name="conductor_id"
            render={({ field }) => (
              <SearchableSelect
                options={lookups.staffsReady}
                value={field.value}
                onChange={field.onChange}
                placeholder="Choose verified conductor..."
                label="Conductor in Charge *"
                error={errors.conductor_id?.message}
              />
            )}
          />

          {/* Searchable Driver Selector */}
          <Controller
            control={control}
            name="driver_id"
            render={({ field }) => (
              <SearchableSelect
                options={lookups.staffsReady}
                value={field.value}
                onChange={field.onChange}
                placeholder="Choose verified driver..."
                label="Commanding Driver *"
                error={errors.driver_id?.message}
              />
            )}
          />

          {/* Oneway Passengers */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-neutral-400 font-mono mb-1.5">
              Oneway Passengers *
            </label>
            <Controller
              control={control}
              name="one_way"
              render={({ field }) => (
                <input
                  type="number"
                  {...field}
                  placeholder="Total count at terminus"
                  className="w-full bg-[#0c121f] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none border border-white/10 hover:border-blue-500/20 focus:border-blue-500/50 rounded-xl p-2.5 text-xs text-white focus:outline-none transition-colors h-[40px] font-mono"
                />
              )}
            />
            {errors.one_way && (
              <span className="text-[10px] text-red-400 mt-1 block font-mono">{errors.one_way.message}</span>
            )}
          </div>

          {/* Enroute Passengers */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-neutral-400 font-mono mb-1.5">
              Enroute Passengers *
            </label>
            <Controller
              control={control}
              name="enroute"
              render={({ field }) => (
                <input
                  type="number"
                  {...field}
                  placeholder="Total count along way"
                  className="w-full bg-[#0c121f] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none border border-white/10 hover:border-blue-500/20 focus:border-blue-500/50 rounded-xl p-2.5 text-xs text-white focus:outline-none transition-colors h-[40px] font-mono"
                />
              )}
            />
            {errors.enroute && (
              <span className="text-[10px] text-red-400 mt-1 block font-mono">{errors.enroute.message}</span>
            )}
          </div>

          {/* ACTIONS */}
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 disabled:opacity-50 text-neutral-950 font-bold text-xs tracking-wider uppercase rounded-xl flex items-center gap-1.5 shadow-[0_0_20px_rgba(245,158,11,0.15)] transition-all cursor-pointer h-[42px]"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Archiving Logs...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Submit Log Entry
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* VIEW COMPONENT 3: OPERATIONS ACTIONS PLACEHOLDER                           */
/* ========================================================================== */
/* ========================================================================== */
/* VIEW COMPONENT 3: OPERATIONS ACTIONS CENTER                                */
/* ========================================================================== */
interface ActionsViewProps {
  currentUserProfile: any;
  regionsReady: { id: string; name: string }[];
  onRefreshLookups: () => void;
}

function ActionsView({ currentUserProfile, regionsReady, onRefreshLookups }: ActionsViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<"edit_bus" | "edit_office" | "delete_operations">("edit_bus");

  // A) Edit Bus States
  const [busSearchQuery, setBusSearchQuery] = useState("");
  const [matchingBuses, setMatchingBuses] = useState<any[]>([]);
  const [selectedBus, setSelectedBus] = useState<any | null>(null);
  const [searchBusLoading, setSearchBusLoading] = useState(false);
  const [editBusLoading, setEditBusLoading] = useState(false);
  const [editBusSuccess, setEditBusSuccess] = useState(false);
  const [editBusError, setEditBusError] = useState<string | null>(null);

  // Edit Bus Field States
  const [busPlate, setBusPlate] = useState("");
  const [busModel, setBusModel] = useState("");
  const [busCapacity, setBusCapacity] = useState("");
  const [busPurchaseDate, setBusPurchaseDate] = useState("");
  const [busIsActive, setBusIsActive] = useState(true);

  // B) Edit Office States
  const [officeSearchQuery, setOfficeSearchQuery] = useState("");
  const [matchingOffices, setMatchingOffices] = useState<any[]>([]);
  const [selectedOffice, setSelectedOffice] = useState<any | null>(null);
  const [searchOfficeLoading, setSearchOfficeLoading] = useState(false);
  const [editOfficeLoading, setEditOfficeLoading] = useState(false);
  const [editOfficeSuccess, setEditOfficeSuccess] = useState(false);
  const [editOfficeError, setEditOfficeError] = useState<string | null>(null);

  // Edit Office Field States
  const [officeName, setOfficeName] = useState("");
  const [officeRegionId, setOfficeRegionId] = useState("");
  const [officeIsActive, setOfficeIsActive] = useState(true);
  const [regionDropdownOpen, setRegionDropdownOpen] = useState(false);
  const [regionSearch, setRegionSearch] = useState("");

  // C) Delete Operations Log States
  const [logSearchQuery, setLogSearchQuery] = useState("");
  const [matchingLogs, setMatchingLogs] = useState<any[]>([]);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [searchLogLoading, setSearchLogLoading] = useState(false);
  const [deleteLogLoading, setDeleteLogLoading] = useState(false);
  const [deleteLogSuccess, setDeleteLogSuccess] = useState(false);
  const [deleteLogError, setDeleteLogError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // 1. Buses Search
  useEffect(() => {
    let active = true;
    const fetchBuses = async () => {
      try {
        setSearchBusLoading(true);
        let q = supabase.from("buses").select("*");
        if (currentUserProfile?.company_id) {
          q = q.eq("company_id", currentUserProfile.company_id);
        }
        if (busSearchQuery.trim()) {
          q = q.ilike("plate_number", `%${busSearchQuery.trim()}%`);
        }
        const { data, error } = await q.order("plate_number", { ascending: true }).limit(20);
        if (active && !error && data) {
          setMatchingBuses(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setSearchBusLoading(false);
      }
    };
    fetchBuses();
    return () => { active = false; };
  }, [busSearchQuery, currentUserProfile]);

  // Handle select bus
  const handleSelectBus = (bus: any) => {
    setSelectedBus(bus);
    setBusPlate(bus.plate_number || "");
    setBusModel(bus.model || "");
    setBusCapacity(String(bus.seating_capacity || ""));
    setBusPurchaseDate(bus.purchase_date || "");
    setBusIsActive(bus.is_active === undefined ? true : bus.is_active);
    setEditBusSuccess(false);
    setEditBusError(null);
  };

  const handleUpdateBus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBus) return;
    try {
      setEditBusLoading(true);
      setEditBusError(null);
      setEditBusSuccess(false);

      const payload = {
        plate_number: busPlate.trim(),
        model: busModel.trim(),
        seating_capacity: Number(busCapacity),
        purchase_date: busPurchaseDate,
        is_active: busIsActive
      };

      const { error } = await supabase
        .from("buses")
        .update(payload)
        .eq("id", selectedBus.id);

      if (error) throw error;

      setEditBusSuccess(true);
      onRefreshLookups();
      
      // Update local item details
      setSelectedBus({ ...selectedBus, ...payload });

      // Refresh listing trigger
      setBusSearchQuery(prev => prev);
    } catch (err: any) {
      console.error(err);
      setEditBusError(err.message || "Failed to update bus entry.");
    } finally {
      setEditBusLoading(false);
    }
  };

  // 2. Offices Search
  useEffect(() => {
    let active = true;
    const fetchOffices = async () => {
      try {
        setSearchOfficeLoading(true);
        let q = supabase.from("offices").select("*");
        if (currentUserProfile?.company_id) {
          q = q.eq("company_id", currentUserProfile.company_id);
        }
        if (officeSearchQuery.trim()) {
          q = q.ilike("office_name", `%${officeSearchQuery.trim()}%`);
        }
        const { data, error } = await q.order("office_name", { ascending: true }).limit(20);
        if (active && !error && data) {
          setMatchingOffices(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setSearchOfficeLoading(false);
      }
    };
    fetchOffices();
    return () => { active = false; };
  }, [officeSearchQuery, currentUserProfile]);

  const handleSelectOffice = (office: any) => {
    setSelectedOffice(office);
    setOfficeName(office.office_name || "");
    setOfficeRegionId(office.region_id || office.region || "");
    setOfficeIsActive(office.is_active === undefined ? true : office.is_active);
    setEditOfficeSuccess(false);
    setEditOfficeError(null);
  };

  const handleUpdateOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOffice) return;
    try {
      setEditOfficeLoading(true);
      setEditOfficeError(null);
      setEditOfficeSuccess(false);

      const payload: any = {
        office_name: officeName.trim(),
        is_active: officeIsActive
      };

      // Try column region_id, fallback to region column if missing
      const { error: updateError } = await supabase
        .from("offices")
        .update({ ...payload, region_id: officeRegionId })
        .eq("id", selectedOffice.id);

      if (updateError) {
        const msg = updateError.message || "";
        const isColumnErr = msg.includes("region_id") || updateError.code === "PGRST204" || updateError.code === "42703";
        if (isColumnErr) {
          const { error: fallbackError } = await supabase
            .from("offices")
            .update({ ...payload, region: officeRegionId })
            .eq("id", selectedOffice.id);
          if (fallbackError) throw fallbackError;
        } else {
          throw updateError;
        }
      }

      setEditOfficeSuccess(true);
      onRefreshLookups();
      
      // Update local values
      setSelectedOffice({ ...selectedOffice, ...payload, region_id: officeRegionId });
      setOfficeSearchQuery(prev => prev);
    } catch (err: any) {
      console.error(err);
      setEditOfficeError(err.message || "Failed to update office entry.");
    } finally {
      setEditOfficeLoading(false);
    }
  };

  // 3. Operational Logs Search (v_daily_bus_operations)
  useEffect(() => {
    let active = true;
    const fetchLogs = async () => {
      try {
        setSearchLogLoading(true);
        let q = supabase.from("v_daily_bus_operations").select("*");
        if (currentUserProfile?.company_id) {
          q = q.eq("company_id", currentUserProfile.company_id);
        }
        const { data, error } = await q.order("date", { ascending: false }).limit(60);
        if (active && !error && data) {
          let filtered = data;
          if (logSearchQuery.trim()) {
            const term = logSearchQuery.toLowerCase().trim();
            filtered = data.filter(item => 
              String(item.date).includes(term) ||
              String(item.bus || "").toLowerCase().includes(term) ||
              String(item.route || "").toLowerCase().includes(term) ||
              String(item.conductor || "").toLowerCase().includes(term) ||
              String(item.driver || "").toLowerCase().includes(term)
            );
          }
          setMatchingLogs(filtered);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setSearchLogLoading(false);
      }
    };
    fetchLogs();
    return () => { active = false; };
  }, [logSearchQuery, currentUserProfile, deleteLogSuccess]);

  const handleDeleteLog = async () => {
    if (!selectedLog) return;
    try {
      setDeleteLogLoading(true);
      setDeleteLogError(null);
      setDeleteLogSuccess(false);

      let q = supabase.from("daily_bus_operations").delete();
      if (selectedLog.id) {
        q = q.eq("id", selectedLog.id);
      } else {
        q = q.eq("date", selectedLog.date)
             .eq("one_way", selectedLog.one_way)
             .eq("enroute", selectedLog.enroute);
      }

      const { error } = await q;
      if (error) throw error;

      setDeleteLogSuccess(true);
      setSelectedLog(null);
      setShowDeleteConfirm(false);
    } catch (err: any) {
      console.error(err);
      setDeleteLogError(err.message || "Deletion unsuccessful. Missing dependencies or credentials.");
    } finally {
      setDeleteLogLoading(false);
    }
  };

  // Filtered regions for dropdown search
  const filteredRegions = useMemo(() => {
    if (!regionSearch.trim()) return regionsReady;
    return regionsReady.filter(r => r.name.toLowerCase().includes(regionSearch.toLowerCase()));
  }, [regionSearch, regionsReady]);

  const selectedRegionName = useMemo(() => {
    const reg = regionsReady.find(r => r.id === officeRegionId);
    return reg ? reg.name : "Choose regional territory...";
  }, [officeRegionId, regionsReady]);

  return (
    <div className="space-y-6 overflow-visible">
      {/* Cards Selector switcher */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Edit Bus */}
        <div 
          onClick={() => {
            setActiveSubTab("edit_bus");
            setSelectedBus(null);
          }}
          className={`rounded-2xl border p-5 cursor-pointer transition-all relative overflow-hidden flex flex-col justify-between min-h-[140px] ${
            activeSubTab === "edit_bus" 
              ? "bg-[#0b1710] border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.1)] animate-pulse-subtle" 
              : "bg-[#0a0f1d]/40 border-white/5 hover:border-white/10"
          }`}
        >
          <div className="absolute -right-8 -bottom-8 w-28 h-28 bg-emerald-500/5 blur-[35px] rounded-full pointer-events-none"></div>
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block">Task 01</span>
            <Bus className={`h-5 w-5 ${activeSubTab === "edit_bus" ? "text-emerald-400" : "text-neutral-400"}`} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Edit Fleet Bus</h4>
            <span className="text-[10px] block text-neutral-500 mt-1">Surgically update registration details, model, or active status.</span>
          </div>
        </div>

        {/* Card 2: Edit Office */}
        <div 
          onClick={() => {
            setActiveSubTab("edit_office");
            setSelectedOffice(null);
          }}
          className={`rounded-2xl border p-5 cursor-pointer transition-all relative overflow-hidden flex flex-col justify-between min-h-[140px] ${
            activeSubTab === "edit_office" 
              ? "bg-[#0b1710] border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.1)]" 
              : "bg-[#0a0f1d]/40 border-white/5 hover:border-white/10"
          }`}
        >
          <div className="absolute -right-8 -bottom-8 w-28 h-28 bg-emerald-500/5 blur-[35px] rounded-full pointer-events-none"></div>
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block">Task 02</span>
            <Building2 className={`h-5 w-5 ${activeSubTab === "edit_office" ? "text-emerald-400" : "text-neutral-400"}`} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Edit Office</h4>
            <span className="text-[10px] block text-neutral-500 mt-1">Modify station hub names and align regional territories.</span>
          </div>
        </div>

        {/* Card 3: Delete Daily Log Entry */}
        <div 
          onClick={() => {
            setActiveSubTab("delete_operations");
            setSelectedLog(null);
            setShowDeleteConfirm(false);
          }}
          className={`rounded-2xl border p-5 cursor-pointer transition-all relative overflow-hidden flex flex-col justify-between min-h-[140px] ${
            activeSubTab === "delete_operations" 
              ? "bg-[#180a0a] border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.1)]" 
              : "bg-[#0a0f1d]/40 border-white/5 hover:border-white/10"
          }`}
        >
          <div className="absolute -right-8 -bottom-8 w-28 h-28 bg-red-500/5 blur-[35px] rounded-full pointer-events-none"></div>
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block">Task 03</span>
            <Trash2 className={`h-5 w-5 ${activeSubTab === "delete_operations" ? "text-red-400" : "text-neutral-400"}`} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Delete Daily Log</h4>
            <span className="text-[10px] block text-neutral-500 mt-1">Locate and safely purge invalid daily dispatch operational logs.</span>
          </div>
        </div>
      </div>

      {/* Forms and Search Blocks */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start overflow-visible">
        
        {/* LEFT COLUMN: Search & List */}
        <div className="lg:col-span-4 rounded-2xl border border-white/5 bg-[#0a0f1d]/60 p-5 space-y-4">
          <h3 className="text-xs font-semibold text-white font-mono uppercase tracking-wider flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-emerald-400" />
            {activeSubTab === "edit_bus" && "Bus Lookup"}
            {activeSubTab === "edit_office" && "Office Lookup"}
            {activeSubTab === "delete_operations" && "Log Selector"}
          </h3>

          <div>
            <input 
              type="text"
              value={
                activeSubTab === "edit_bus" ? busSearchQuery :
                activeSubTab === "edit_office" ? officeSearchQuery : logSearchQuery
              }
              onChange={(e) => {
                const val = e.target.value;
                if (activeSubTab === "edit_bus") setBusSearchQuery(val);
                else if (activeSubTab === "edit_office") setOfficeSearchQuery(val);
                else setLogSearchQuery(val);
              }}
              placeholder={
                activeSubTab === "edit_bus" ? "Type plate number..." :
                activeSubTab === "edit_office" ? "Type office name..." : "Search logs..."
              }
              className="w-full bg-[#0c121f] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 transition-colors h-[40px]"
            />
          </div>

          <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {/* Loading */}
            {((activeSubTab === "edit_bus" && searchBusLoading) ||
              (activeSubTab === "edit_office" && searchOfficeLoading) ||
              (activeSubTab === "delete_operations" && searchLogLoading)) && (
              <div className="text-center py-6">
                <RefreshCw className="h-5 w-5 animate-spin mx-auto text-emerald-400 mb-2" />
                <span className="text-[10px] text-neutral-500 font-mono">Scanning registry...</span>
              </div>
            )}

            {/* Empty list */}
            {activeSubTab === "edit_bus" && !searchBusLoading && matchingBuses.length === 0 && (
              <div className="text-center py-6 text-[11px] text-neutral-500 font-mono">No matching buses found.</div>
            )}
            {activeSubTab === "edit_office" && !searchOfficeLoading && matchingOffices.length === 0 && (
              <div className="text-center py-6 text-[11px] text-neutral-500 font-mono">No matching offices found.</div>
            )}
            {activeSubTab === "delete_operations" && !searchLogLoading && matchingLogs.length === 0 && (
              <div className="text-center py-6 text-[11px] text-neutral-500 font-mono">No matching transit logs.</div>
            )}

            {/* List entries */}
            {activeSubTab === "edit_bus" && !searchBusLoading && matchingBuses.map(bus => (
              <div 
                key={bus.id}
                onClick={() => handleSelectBus(bus)}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-xs ${
                  selectedBus?.id === bus.id 
                    ? "bg-[#0b1710] border-emerald-500/30 text-white" 
                    : "bg-[#060a13]/60 border-white/5 hover:border-white/10 text-neutral-350"
                }`}
              >
                <div>
                  <div className="font-semibold font-mono">{bus.plate_number}</div>
                  <div className="text-[10px] text-neutral-400 font-light mt-0.5">{bus.model || "Unknown Model"}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-neutral-400">{bus.seating_capacity} Seats</span>
                  <span className={`h-1.5 w-1.5 rounded-full ${bus.is_active === false ? "bg-red-500" : "bg-emerald-400"}`}></span>
                </div>
              </div>
            ))}

            {activeSubTab === "edit_office" && !searchOfficeLoading && matchingOffices.map(off => (
              <div 
                key={off.id}
                onClick={() => handleSelectOffice(off)}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-xs ${
                  selectedOffice?.id === off.id 
                    ? "bg-[#0b1710] border-emerald-500/30 text-white" 
                    : "bg-[#060a13]/60 border-white/5 hover:border-white/10 text-neutral-350"
                }`}
              >
                <div>
                  <div className="font-semibold">{off.office_name}</div>
                  <div className="text-[10px] text-neutral-400 font-light mt-0.5">
                    Territory: {regionsReady.find(r => r.id === String(off.region_id || off.region))?.name || "None"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${off.is_active === false ? "bg-red-500" : "bg-emerald-400"}`}></span>
                </div>
              </div>
            ))}

            {activeSubTab === "delete_operations" && !searchLogLoading && matchingLogs.map((log, idx) => (
              <div 
                key={log.id || idx}
                onClick={() => {
                  setSelectedLog(log);
                  setShowDeleteConfirm(false);
                  setDeleteLogSuccess(false);
                  setDeleteLogError(null);
                }}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 text-xs ${
                  selectedLog?.id === log.id && selectedLog?.date === log.date
                    ? "bg-[#180a0a] border-red-500/30 text-white" 
                    : "bg-[#060a13]/60 border-white/5 hover:border-white/10 text-neutral-330"
                }`}
              >
                <div className="flex justify-between items-center border-b border-white/5 pb-1">
                  <span className="font-mono text-[9px] text-neutral-400">{log.date}</span>
                  <span className="font-semibold font-mono text-amber-500">{log.bus}</span>
                </div>
                <div className="text-[10px] text-neutral-300 space-y-0.5 font-light">
                  <div><span className="text-neutral-500 uppercase font-mono text-[8px]">Route:</span> {log.route}</div>
                  <div><span className="text-neutral-500 uppercase font-mono text-[8px]">Driver:</span> {log.driver}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: Edit Forms */}
        <div className="lg:col-span-8 rounded-2xl border border-white/5 bg-[#0a0f1d]/85 p-6 shadow-xl relative overflow-visible z-20 min-h-[460px]">
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#10b981]/25 to-transparent"></div>

          {/* Form Header */}
          <div className="pb-4 border-b border-white/5 mb-5">
            <h3 className="text-sm font-semibold text-white">
              {activeSubTab === "edit_bus" && "Form: Vehicle Customization"}
              {activeSubTab === "edit_office" && "Form: Modify Office Station"}
              {activeSubTab === "delete_operations" && "Form: Dispose Operational Log"}
            </h3>
            <p className="text-[11px] text-neutral-400 mt-1">
              {activeSubTab === "edit_bus" && "Surgically edit physical parameters of a registered transit vehicle."}
              {activeSubTab === "edit_office" && "Modify hub office name, regional align, and status toggle state."}
              {activeSubTab === "delete_operations" && "Erase a daily transit entry completely from the ledger database."}
            </p>
          </div>

          {/* NO SELECTION PLACEHOLDER */}
          {((activeSubTab === "edit_bus" && !selectedBus) ||
            (activeSubTab === "edit_office" && !selectedOffice) ||
            (activeSubTab === "delete_operations" && !selectedLog)) && (
            <div className="flex flex-col items-center justify-center min-h-[300px] text-center border border-dashed border-white/5 rounded-xl bg-white/[0.01]">
              <Compass className="h-8 w-8 text-neutral-600 animate-pulse mb-2" />
              <span className="text-xs text-neutral-400 font-mono">No Item Selected</span>
              <p className="text-[10px] text-neutral-500 max-w-xs mt-1">
                Please click on any list entry inside the left sidebar to initialize this operational editor panel.
              </p>
            </div>
          )}

          {/* FORM A: EDIT BUS */}
          {activeSubTab === "edit_bus" && selectedBus && (
            <form onSubmit={handleUpdateBus} className="space-y-4 text-xs font-sans">
              {editBusError && (
                <div className="p-3 bg-red-950/20 border border-red-500/30 rounded-xl text-xs text-red-300 font-mono">
                  {editBusError}
                </div>
              )}
              {editBusSuccess && (
                <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 font-mono">
                  Vehicle parameters saved in dynamic registry safely.
                </div>
              )}

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-neutral-400 font-mono mb-1.5">Plate Number *</label>
                <input 
                  type="text"
                  required
                  value={busPlate}
                  onChange={(e) => setBusPlate(e.target.value)}
                  className="w-full bg-[#0c121f] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 transition-colors h-[40px] font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-neutral-400 font-mono mb-1.5">Model *</label>
                <input 
                  type="text"
                  required
                  value={busModel}
                  onChange={(e) => setBusModel(e.target.value)}
                  className="w-full bg-[#0c121f] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 transition-colors h-[40px]"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-neutral-400 font-mono mb-1.5">Seating Capacity *</label>
                <input 
                  type="number"
                  required
                  min={1}
                  value={busCapacity}
                  onChange={(e) => setBusCapacity(e.target.value)}
                  className="w-full bg-[#0c121f] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 transition-colors h-[40px] font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-neutral-400 font-mono mb-1.5">Purchase Date *</label>
                <input 
                  type="date"
                  required
                  value={busPurchaseDate}
                  onChange={(e) => setBusPurchaseDate(e.target.value)}
                  className="w-full bg-[#0c121f] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 transition-colors h-[40px] font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-neutral-400 font-mono mb-2">Operational Status</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setBusIsActive(true)}
                    className={`px-4 py-2 rounded-xl border text-xs font-mono transition-all ${
                      busIsActive === true 
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-semibold" 
                        : "bg-transparent border-white/5 text-neutral-500 hover:border-white/10"
                    }`}
                  >
                    Active / In Services
                  </button>
                  <button
                    type="button"
                    onClick={() => setBusIsActive(false)}
                    className={`px-4 py-2 rounded-xl border text-xs font-mono transition-all ${
                      busIsActive === false 
                        ? "bg-red-500/10 border-red-500/30 text-red-400 font-semibold" 
                        : "bg-transparent border-white/5 text-neutral-500 hover:border-white/10"
                    }`}
                  >
                    Suspended Hub Pool
                  </button>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={editBusLoading}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 disabled:opacity-50 text-neutral-950 font-bold text-xs tracking-wider uppercase rounded-xl flex items-center gap-1.5 shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-all cursor-pointer h-[42px]"
                >
                  {editBusLoading ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Save Fleet updates
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* FORM B: EDIT OFFICE */}
          {activeSubTab === "edit_office" && selectedOffice && (
            <form onSubmit={handleUpdateOffice} className="space-y-4 text-xs font-sans overflow-visible relative">
              {editOfficeError && (
                <div className="p-3 bg-red-950/20 border border-red-500/30 rounded-xl text-xs text-red-300 font-mono">
                  {editOfficeError}
                </div>
              )}
              {editOfficeSuccess && (
                <div className="p-3 bg-[#0b1710]/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 font-mono">
                  Office parameters updated inside registers successfully.
                </div>
              )}

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-neutral-400 font-mono mb-1.5">Office Name *</label>
                <input 
                  type="text"
                  required
                  value={officeName}
                  onChange={(e) => setOfficeName(e.target.value)}
                  className="w-full bg-[#0c121f] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 transition-colors h-[40px]"
                />
              </div>

              {/* Searchable dropdown custom popover */}
              <div className="relative overflow-visible">
                <label className="block text-[10px] uppercase tracking-wider text-neutral-400 font-mono mb-1.5">Regional Alignment *</label>
                
                <div 
                  onClick={() => setRegionDropdownOpen(!regionDropdownOpen)}
                  className="w-full bg-[#0c121f] border border-white/10 hover:border-emerald-500/20 rounded-xl p-2.5 text-xs text-white flex justify-between items-center cursor-pointer transition-colors h-[40px] font-mono"
                >
                  <span className={officeRegionId ? "text-white" : "text-neutral-500"}>{selectedRegionName}</span>
                  <ChevronDown className={`h-4 w-4 text-neutral-500 transition-transform ${regionDropdownOpen ? "rotate-180" : ""}`} />
                </div>

                {regionDropdownOpen && (
                  <div className="absolute left-0 right-0 top-[44px] bg-[#090e1a] border border-white/10 rounded-xl shadow-[0_15px_30px_rgba(0,0,0,0.85)] z-[9999] overflow-hidden p-2 space-y-2 mt-1">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-500" />
                      <input 
                        type="text"
                        value={regionSearch}
                        onChange={(e) => setRegionSearch(e.target.value)}
                        placeholder="Type region name to filter..."
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-[#050810] border border-white/5 rounded-lg pl-8 pr-2.5 py-1.5 text-[11px] text-white focus:outline-none font-mono focus:border-emerald-500/30 h-[32px]"
                      />
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-0.5 custom-scrollbar font-mono text-[11px]">
                      {filteredRegions.length === 0 ? (
                        <div className="text-center py-4 text-neutral-500 text-[10px]">No matching territories.</div>
                      ) : (
                        filteredRegions.map(reg => (
                          <div
                            key={reg.id}
                            onClick={() => {
                              setOfficeRegionId(reg.id);
                              setRegionDropdownOpen(false);
                              setRegionSearch("");
                            }}
                            className={`p-2 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-400 cursor-pointer transition-colors ${
                              officeRegionId === reg.id ? "bg-emerald-500/5 text-emerald-400 font-semibold" : "text-neutral-350"
                            }`}
                          >
                            {reg.name}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-neutral-400 font-mono mb-2">Hub Status</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setOfficeIsActive(true)}
                    className={`px-4 py-2 rounded-xl border text-xs font-mono transition-all ${
                      officeIsActive === true 
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-semibold" 
                        : "bg-transparent border-white/5 text-neutral-500 hover:border-white/10"
                    }`}
                  >
                    Operational
                  </button>
                  <button
                    type="button"
                    onClick={() => setOfficeIsActive(false)}
                    className={`px-4 py-2 rounded-xl border text-xs font-mono transition-all ${
                      officeIsActive === false 
                        ? "bg-red-500/10 border-red-500/30 text-red-400 font-semibold" 
                        : "bg-transparent border-white/5 text-neutral-500 hover:border-white/10"
                    }`}
                  >
                    Closed Hub
                  </button>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={editOfficeLoading}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 disabled:opacity-50 text-neutral-950 font-bold text-xs tracking-wider uppercase rounded-xl flex items-center gap-1.5 shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-all cursor-pointer h-[42px]"
                >
                  {editOfficeLoading ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Confirm updates
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* FORM C: DELETE DAILY BUS ENTRY */}
          {activeSubTab === "delete_operations" && selectedLog && (
            <div className="space-y-5 text-xs font-mono leading-relaxed">
              {deleteLogError && (
                <div className="p-3 bg-red-950/20 border border-red-500/30 rounded-xl text-neutral-200">
                  <strong className="text-red-400 font-semibold uppercase block text-[9px] mb-1">Purge Halted</strong>
                  {deleteLogError}
                </div>
              )}

              <div className="p-4 rounded-xl border border-white/5 bg-[#0e0a0a]/50 text-neutral-350 space-y-3">
                <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider border-b border-white/5 pb-1 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Confirm Deletion Target Details
                </h4>
                
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
                  <div><span className="text-neutral-500 block text-[9px] uppercase font-mono">Date:</span> <strong className="text-white">{selectedLog.date}</strong></div>
                  <div><span className="text-neutral-500 block text-[9px] uppercase font-mono">Bus Panel:</span> <strong className="text-amber-500 font-mono">{selectedLog.bus}</strong></div>
                  <div className="col-span-2 border-t border-white/5 my-1" />
                  <div><span className="text-neutral-500 block text-[9px] uppercase font-mono">Transit Route:</span> {selectedLog.route}</div>
                  <div><span className="text-neutral-500 block text-[9px] uppercase font-mono">Driver In-Charge:</span> {selectedLog.driver}</div>
                  <div><span className="text-neutral-500 block text-[9px] uppercase font-mono">Conductor Name:</span> {selectedLog.conductor}</div>
                  <div><span className="text-neutral-500 block text-[9px] uppercase font-mono">Total Trips:</span> {selectedLog.total}</div>
                </div>
              </div>

              {!showDeleteConfirm ? (
                <div className="flex justify-end">
                  <button 
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-6 py-2.5 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-bold text-xs tracking-wider uppercase rounded-xl flex items-center gap-1.5 shadow-[0_0_20px_rgba(239,68,68,0.2)] transition-all cursor-pointer h-[42px]"
                  >
                    <Trash2 className="h-4 w-4" />
                    Purge from Database
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-red-950/25 border border-red-650/40 rounded-xl space-y-4 font-mono text-center">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500 animate-bounce" />
                    IRREVERSIBLE LOG ERASURE COMMAND
                  </h4>
                  <p className="text-[10px] text-red-300 leading-normal max-w-md mx-auto">
                    Are you absolutely sure you want to permanently erase this daily operation list entry?
                  </p>
                  
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] font-bold uppercase rounded-lg cursor-pointer"
                    >
                      Abort
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteLog}
                      disabled={deleteLogLoading}
                      className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold uppercase rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {deleteLogLoading ? (
                        <>
                          <RefreshCw className="h-3 w-3 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-3.5 w-3.5" />
                          Confirm Delete
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* VIEW COMPONENT 4: INTERNAL COMMUNICATIONS PANELS (MEMOS)                   */
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#1a2e26]/60 backdrop-blur-xl border border-white/10 p-4 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-center text-amber-400">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Internal Operations Memo Hub</h2>
            <p className="text-neutral-400 text-xs">Transmit transit logs, system actions and general announcements securely.</p>
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
          <div className="rounded-2xl bg-[#0c121f]/90 border border-white/5 p-4 space-y-4 shadow-xl">
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
                    ? "bg-[#111726]/90 text-amber-400 border border-white/5"
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
                    ? "bg-[#111726]/90 text-amber-400 border border-white/5"
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
                placeholder="Filter memos by writer..."
                className="w-full bg-[#0a0e17] border border-white/5 rounded-xl py-2 pl-9 pr-4 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
              />
            </div>
          </div>

          {/* LIST OF MEMOS */}
          <div className="space-y-2 max-h-[480px] overflow-y-auto custom-scrollbar pr-1">
            {filteredMemos.length === 0 ? (
              <div className="text-center py-8 rounded-2xl bg-[#0c121f]/40 border border-white/5">
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
                        ? "bg-[#0b1426]/95 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.06)]"
                        : isUnread
                        ? "bg-amber-500/5 border-amber-500/20 hover:border-amber-500/30"
                        : "bg-[#0c121f]/60 border-white/5 hover:border-white/10"
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
            <form onSubmit={handleComposeSubmit} className="rounded-2xl bg-[#0c121f]/85 border border-white/10 p-6 shadow-2xl relative space-y-4">
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

              {/* Recipient Selector */}
              <div className="space-y-1.5 relative">
                <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block">
                  Select Recipient Profile *
                </label>
                
                {composeReceiverId ? (
                  <div className="flex justify-between items-center bg-[#111726]/80 border border-amber-500/30 p-2.5 rounded-xl">
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
                        className="w-full bg-[#0a0e17] border border-white/5 rounded-xl py-2 pl-9 pr-4 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                    
                    {receiverDropdownOpen && (
                      <div className="absolute left-0 right-0 top-[100%] mt-1 bg-[#0c121f] border border-white/10 rounded-xl shadow-2xl max-h-[160px] overflow-y-auto z-50 p-1.5 space-y-1">
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
                  className="w-full bg-[#111726]/80 border border-white/5 rounded-xl py-2 px-3.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500/50"
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
                  placeholder="Draft your announcement or instruction here..."
                  className="w-full bg-[#111726]/80 border border-white/5 rounded-xl py-2 px-3.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500/50 resize-none font-light leading-relaxed"
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
            <div className="rounded-2xl bg-[#0c121f]/85 border border-white/10 p-6 shadow-2xl relative space-y-6">
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

              <div className="text-xs text-neutral-300 bg-[#070b14] p-5 rounded-xl border border-white/5 space-y-4 font-light leading-relaxed whitespace-pre-wrap">
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
            <div className="rounded-2xl bg-[#0c121f]/85 border border-white/5 p-12 text-center flex flex-col items-center justify-center min-h-[350px] shadow-2xl relative">
              <div className="absolute top-4 left-4 flex gap-1.5">
                <div className="h-2 w-2 rounded-full bg-blue-500/20"></div>
                <div className="h-2 w-2 rounded-full bg-blue-500/10"></div>
                <div className="h-2 w-2 rounded-full bg-blue-500/5"></div>
              </div>
              
              <Mail className="h-8 w-8 text-neutral-600 mb-3" />
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider">No Active Directive Selected</h4>
              <p className="text-[11px] text-neutral-400 font-light mt-1.5 leading-relaxed max-w-xs mx-auto">
                Toggle a memo card inside the list to unfold the transmission details, or construct a new communication.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* VIEW COMPONENT 5A: REGISTER ACTIVE FLEET BUS                               */
/* ========================================================================== */
interface AddBusViewProps {
  currentUserProfile: any;
  onRefreshLookups: () => void;
}

function AddBusView({ currentUserProfile, onRefreshLookups }: AddBusViewProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(addBusSchema) as any,
    defaultValues: {
      plate_number: "",
      model: "",
      seating_capacity: "",
      purchase_date: new Date().toISOString().split("T")[0]
    }
  });

  const onSubmit = async (data: any) => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      const payload: any = {
        plate_number: data.plate_number.trim(),
        model: data.model.trim(),
        seating_capacity: Number(data.seating_capacity),
        purchase_date: data.purchase_date
      };

      if (currentUserProfile?.company_id) {
        payload.company_id = currentUserProfile.company_id;
      }

      const { error: insertError } = await supabase
        .from("buses")
        .insert(payload);

      if (insertError) throw insertError;

      setSuccess(true);
      reset();

      // Refresh cached lookups so it's fully synchronized immediately
      onRefreshLookups();

      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      console.error("Supabase new bus registration failure:", err);
      setError(err?.message || "An unexpected error occurred while writing values.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="rounded-2xl border border-white/10 bg-[#1a2e26]/60 backdrop-blur-xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#d1a153]/25 to-transparent"></div>
        
        <div className="flex items-center gap-3 pb-4 border-b border-white/5 mb-5">
          <div className="h-9 w-9 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-center text-amber-400">
            <Bus className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Register Fleet Bus</h3>
            <p className="text-[11px] text-neutral-400">Add a new commercial vehicle to the available active logistics pool.</p>
          </div>
        </div>

        {error && (
          <div className="p-3 mb-4 bg-red-950/20 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-start gap-2.5 font-mono">
            <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold uppercase tracking-wider text-[9px] block mb-1">Registration Blocked</strong>
              {error}
            </div>
          </div>
        )}

        {success && (
          <div className="p-3 mb-4 bg-emerald-950/20 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-start gap-2.5 font-mono">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold uppercase tracking-wider text-[9px] block mb-1">Vehicle Archived</strong>
              New fleet vehicle saved in Supabase database ledger successfully.
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-xs font-sans">
          
          {/* Plate Number */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-neutral-400 font-mono mb-1.5">
              Plate Number *
            </label>
            <input
              type="text"
              {...register("plate_number")}
              placeholder="e.g. T 123 ABC"
              className={`w-full bg-[#0c121f] border ${
                errors.plate_number ? "border-red-500/40 focus:border-red-500" : "border-white/10 hover:border-blue-500/20 focus:border-blue-500/50"
              } rounded-xl p-2.5 text-xs text-white focus:outline-none transition-colors h-[40px]`}
            />
            {errors.plate_number && (
              <span className="text-[10px] text-red-400 mt-1 block font-mono">{(errors.plate_number as any).message}</span>
            )}
          </div>

          {/* Model */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-neutral-400 font-mono mb-1.5">
              Model *
            </label>
            <input
              type="text"
              {...register("model")}
              placeholder="e.g. Scania Marco Polo"
              className={`w-full bg-[#0c121f] border ${
                errors.model ? "border-red-500/40 focus:border-red-500" : "border-white/10 hover:border-blue-500/20 focus:border-blue-500/50"
              } rounded-xl p-2.5 text-xs text-white focus:outline-none transition-colors h-[40px]`}
            />
            {errors.model && (
              <span className="text-[10px] text-red-400 mt-1 block font-mono">{(errors.model as any).message}</span>
            )}
          </div>

          {/* Seating Capacity */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-neutral-400 font-mono mb-1.5">
              Seating Capacity *
            </label>
            <input
              type="number"
              {...register("seating_capacity")}
              placeholder="e.g. 55"
              className={`w-full bg-[#0c121f] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none border ${
                errors.seating_capacity ? "border-red-500/40 focus:border-red-500" : "border-white/10 hover:border-blue-500/20 focus:border-blue-500/50"
              } rounded-xl p-2.5 text-xs text-white focus:outline-none transition-colors h-[40px] font-mono`}
            />
            {errors.seating_capacity && (
              <span className="text-[10px] text-red-400 mt-1 block font-mono">{(errors.seating_capacity as any).message}</span>
            )}
          </div>

          {/* Purchase Date */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-neutral-400 font-mono mb-1.5">
              Purchase Date *
            </label>
            <input
              type="date"
              {...register("purchase_date")}
              className={`w-full bg-[#0c121f] border ${
                errors.purchase_date ? "border-red-500/40 focus:border-red-500" : "border-white/10 hover:border-blue-500/20 focus:border-blue-500/50"
              } rounded-xl p-2.5 text-xs text-white focus:outline-none transition-colors h-[40px]`}
            />
            {errors.purchase_date && (
              <span className="text-[10px] text-red-400 mt-1 block font-mono">{(errors.purchase_date as any).message}</span>
            )}
          </div>

          {/* SUBMIT */}
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 disabled:opacity-50 text-neutral-950 font-bold text-xs tracking-wider uppercase rounded-xl flex items-center gap-1.5 shadow-[0_0_20px_rgba(242,152,11,0.15)] transition-all cursor-pointer h-[42px]"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Registering...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Save Vehicle
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* VIEW COMPONENT 5B: REGISTER REGIONAL STATION HUB (ADD OFFICE)              */
/* ========================================================================== */
interface AddOfficeViewProps {
  currentUserProfile: any;
  regionsReady: { id: string; name: string }[];
  onRefreshLookups: () => void;
}

function AddOfficeView({ currentUserProfile, regionsReady, onRefreshLookups }: AddOfficeViewProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(addOfficeSchema) as any,
    defaultValues: {
      office_name: "",
      region_id: ""
    }
  });

  const onSubmit = async (data: any) => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      const payload: any = {
        office_name: data.office_name.trim(),
      };

      if (currentUserProfile?.company_id) {
        payload.company_id = currentUserProfile.company_id;
      }

      // Try with region_id first, catch and try region column if it fails
      const { error: insertError } = await supabase
        .from("offices")
        .insert({ ...payload, region_id: data.region_id });

      if (insertError) {
        const msg = insertError.message || "";
        const isColumnErr = msg.includes("region_id") || insertError.code === "PGRST204" || insertError.code === "42703";
        if (isColumnErr) {
          const { error: fallbackError } = await supabase
            .from("offices")
            .insert({ ...payload, region: data.region_id });
          if (fallbackError) throw fallbackError;
        } else {
          throw insertError;
        }
      }

      setSuccess(true);
      reset({
        office_name: "",
        region_id: ""
      });

      // Refresh cached lookups
      onRefreshLookups();

      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      console.error("Supabase office registration failure:", err);
      setError(err?.message || "An unexpected error occurred while writing values.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="rounded-2xl border border-white/10 bg-[#1a2e26]/60 backdrop-blur-xl p-6 shadow-2xl relative overflow-visible">
        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#d1a153]/25 to-transparent"></div>
        
        <div className="flex items-center gap-3 pb-4 border-b border-white/5 mb-5">
          <div className="h-9 w-9 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-center text-amber-400">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Add Hub Office</h3>
            <p className="text-[11px] text-neutral-400">Establish a new administrative terminal hub under a regional classification.</p>
          </div>
        </div>

        {error && (
          <div className="p-3 mb-4 bg-red-950/20 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-start gap-2.5 font-mono">
            <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold uppercase tracking-wider text-[9px] block mb-1">Office Construction Aborted</strong>
              {error}
            </div>
          </div>
        )}

        {success && (
          <div className="p-3 mb-4 bg-emerald-950/20 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-start gap-2.5 font-mono">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold uppercase tracking-wider text-[9px] block mb-1">Hub Constructed</strong>
              New regional branch written & verified within Supabase offices registry.
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-xs font-sans">
          
          {/* Office Name */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-neutral-400 font-mono mb-1.5">
              Office Name *
            </label>
            <input
              type="text"
              {...register("office_name")}
              placeholder="e.g. Dar es Salaam Terminal Main Office"
              className={`w-full bg-[#0c121f] border ${
                errors.office_name ? "border-red-500/40 focus:border-red-500" : "border-white/10 hover:border-blue-500/20 focus:border-blue-500/50"
              } rounded-xl p-2.5 text-xs text-white focus:outline-none transition-colors h-[40px]`}
            />
            {errors.office_name && (
              <span className="text-[10px] text-red-400 mt-1 block font-mono">{(errors.office_name as any).message}</span>
            )}
          </div>

          {/* Region Searchable selector */}
          <Controller
            control={control}
            name="region_id"
            render={({ field }) => (
              <SearchableSelect
                options={regionsReady}
                value={field.value}
                onChange={field.onChange}
                placeholder="Choose region alignment..."
                label="Regional Territory *"
                error={errors.region_id?.message}
              />
            )}
          />

          {/* ACTION BUTTONS */}
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 disabled:opacity-50 text-neutral-950 font-bold text-xs tracking-wider uppercase rounded-xl flex items-center gap-1.5 shadow-[0_0_20px_rgba(242,152,11,0.15)] transition-all cursor-pointer h-[42px]"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Constructing...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Construct Hub
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* VIEW COMPONENT 5: OPERATIONS REPORTS ENGINE                                */
/* ========================================================================== */
interface ReportsViewProps {
  currentUserProfile?: any;
}

interface ReportColumn {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "month";
  align?: "left" | "right" | "center";
}

interface ReportConfig {
  id: string;
  name: string;
  viewName: string;
  category: "Daily Reports" | "Monthly Reports";
  description: string;
  columns: ReportColumn[];
  totalsRow?: boolean;
}

const OPERATIONS_REPORTS_CONFIG: ReportConfig[] = [
  {
    id: "daily_buses",
    name: "Daily Buses",
    viewName: "v_daily_bus_operations",
    category: "Daily Reports",
    description: "Detailed daily transit manifest specifying drivers, conductors, bus license plates, and registered passenger tallies.",
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
    ],
    totalsRow: true
  },
  {
    id: "bus_utilization",
    name: "Bus Utilization",
    viewName: "v_buses_utilization",
    category: "Daily Reports",
    description: "Daily seating capacity, total boards, and overall utilization ratios per fleet departure.",
    columns: [
      { key: "date", label: "Date", type: "date", align: "left" },
      { key: "bus", label: "Bus", type: "text", align: "left" },
      { key: "route", label: "Route", type: "text", align: "left" },
      { key: "seats", label: "Seats", type: "number", align: "right" },
      { key: "total_passengers", label: "Total Passengers", type: "number", align: "right" },
      { key: "utilization_percent", label: "Utilization Percent", type: "number", align: "right" },
      { key: "created_by_user", label: "User ID", type: "text", align: "left" }
    ],
    totalsRow: true
  },
  {
    id: "monthly_utilization",
    name: "Monthly Utilization",
    viewName: "v_overall_monthly_utilization_average",
    category: "Monthly Reports",
    description: "Aggregated monthly transit capacity average across all operating regions.",
    columns: [
      { key: "month", label: "Month", type: "month", align: "left" },
      { key: "average_utilization", label: "Average Utilization", type: "number", align: "right" }
    ],
    totalsRow: true
  },
  {
    id: "bus_performance",
    name: "Bus Performance",
    viewName: "v_bus_performance",
    category: "Monthly Reports",
    description: "Financial performance comparison of specific fleet plates grouped by calendar blocks.",
    columns: [
      { key: "month", label: "Month", type: "month", align: "left" },
      { key: "bus", label: "Bus", type: "text", align: "left" },
      { key: "income", label: "Income", type: "number", align: "right" }
    ],
    totalsRow: true
  },
  {
    id: "monthly_office_performance",
    name: "Monthly Office Performance",
    viewName: "v_monthly_office_performance",
    category: "Monthly Reports",
    description: "Station performance metrics measuring passenger revenue, cargo billings, and ratio targets.",
    columns: [
      { key: "month", label: "Month", type: "month", align: "left" },
      { key: "office", label: "Office", type: "text", align: "left" },
      { key: "bus_income", label: "Bus Income", type: "number", align: "right" },
      { key: "cargo_income", label: "Cargo Income", type: "number", align: "right" },
      { key: "other_income", label: "Other Income", type: "number", align: "right" },
      { key: "performance_percent", label: "Performance Percent", type: "number", align: "right" }
    ],
    totalsRow: true
  },
  {
    id: "buses_details",
    name: "Buses Details",
    viewName: "v_buses_details",
    category: "Daily Reports",
    description: "Fleet specification inventory mapping license plates, seating capacity, register status, and purchase dates.",
    columns: [
      { key: "plate_number", label: "Plate Number", type: "text", align: "left" },
      { key: "model", label: "Model", type: "text", align: "left" },
      { key: "seating_capacity", label: "Seating Capacity", type: "number", align: "right" },
      { key: "purchase_date", label: "Purchase Date", type: "date", align: "left" },
      { key: "status", label: "Status", type: "text", align: "center" }
    ],
    totalsRow: true
  }
];

const NUMERIC_COLS = [
  "one_way",
  "enroute",
  "total",
  "seats",
  "total_passengers",
  "utilization_percent",
  "average_utilization",
  "income",
  "bus_income",
  "cargo_income",
  "other_income",
  "performance_percent",
  "seating_capacity"
];

const isIncomeCol = (key: string) => {
  return key === "income" || key.endsWith("_income");
};

const isPercentCol = (key: string) => {
  return key.endsWith("_percent") || key.includes("utilization") || key.includes("_percent");
};

const formatValue = (val: any, colKey: string) => {
  if (val === undefined || val === null || val === "") return "—";
  if (isIncomeCol(colKey)) {
    return `${Number(val).toLocaleString()} TZS`;
  }
  if (isPercentCol(colKey)) {
    return `${Number(val).toFixed(2)}%`;
  }
  if (typeof val === "number") {
    return Math.round(val).toLocaleString();
  }
  return String(val);
};

const formatTotalValue = (val: number, colKey: string) => {
  if (val === undefined || val === null || isNaN(val)) return "—";
  if (isIncomeCol(colKey)) {
    return `${Math.round(val).toLocaleString()} TZS`;
  }
  if (isPercentCol(colKey)) {
    return `${val.toFixed(2)}%`;
  }
  return Math.round(val).toLocaleString();
};

function ReportsView({ currentUserProfile }: ReportsViewProps) {
  const [selectedReportId, setSelectedReportId] = useState("daily_buses");
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
        console.error("Failed to load company name in Operations ReportsView:", err);
        setCompanyName("Company Name");
      }
    }
    fetchCompany();
  }, [currentUserProfile]);
  
  // Optional Filter variables
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startMonth, setStartMonth] = useState("");
  const [endMonth, setEndMonth] = useState("");
  
  const [busQuery, setBusQuery] = useState("");
  const [routeQuery, setRouteQuery] = useState("");
  const [conductorQuery, setConductorQuery] = useState("");
  const [driverQuery, setDriverQuery] = useState("");
  const [officeQuery, setOfficeQuery] = useState("");
  const [statusQuery, setStatusQuery] = useState("");

  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const activeReport = useMemo(() => {
    return OPERATIONS_REPORTS_CONFIG.find(r => r.id === selectedReportId) || OPERATIONS_REPORTS_CONFIG[0];
  }, [selectedReportId]);

  // Determine whether any column of specific type exists in the active report
  const hasDateFilter = activeReport.columns.some(col => col.type === "date" || col.key === "purchase_date" || col.key === "date");
  const hasMonthFilter = activeReport.columns.some(col => col.type === "month" || col.key === "month");
  const hasBusFilter = activeReport.columns.some(col => col.key === "bus" || col.key === "plate_number");
  const hasRouteFilter = activeReport.columns.some(col => col.key === "route");
  const hasConductorFilter = activeReport.columns.some(col => col.key === "conductor");
  const hasDriverFilter = activeReport.columns.some(col => col.key === "driver");
  const hasOfficeFilter = activeReport.columns.some(col => col.key === "office");
  const hasStatusFilter = activeReport.columns.some(col => col.key === "status");

  const isAnyFilterApplied = useMemo(() => {
    return !!(
      (hasDateFilter && (startDate || endDate)) ||
      (hasMonthFilter && (startMonth || endMonth)) ||
      (hasBusFilter && busQuery.trim()) ||
      (hasRouteFilter && routeQuery.trim()) ||
      (hasConductorFilter && conductorQuery.trim()) ||
      (hasDriverFilter && driverQuery.trim()) ||
      (hasOfficeFilter && officeQuery.trim()) ||
      (hasStatusFilter && statusQuery.trim())
    );
  }, [
    hasDateFilter, startDate, endDate,
    hasMonthFilter, startMonth, endMonth,
    hasBusFilter, busQuery,
    hasRouteFilter, routeQuery,
    hasConductorFilter, conductorQuery,
    hasDriverFilter, driverQuery,
    hasOfficeFilter, officeQuery,
    hasStatusFilter, statusQuery
  ]);

  const clearAllFilters = () => {
    setStartDate("");
    setEndDate("");
    setStartMonth("");
    setEndMonth("");
    setBusQuery("");
    setRouteQuery("");
    setConductorQuery("");
    setDriverQuery("");
    setOfficeQuery("");
    setStatusQuery("");
  };

  const fetchReportData = async () => {
    try {
      setLoading(true);
      setFetchError(null);
      
      const buildFilteredQuery = () => {
        let q = supabase.from(activeReport.viewName).select("*");
        
        if (currentUserProfile?.company_id) {
          q = q.eq("company_id", currentUserProfile.company_id);
        }
        
        // Apply date range filters if appropriate
        if (hasDateFilter) {
          const dateCol = activeReport.columns.some(col => col.key === "date") ? "date" : "purchase_date";
          if (startDate) {
            q = q.gte(dateCol, startDate);
          }
          if (endDate) {
            q = q.lte(dateCol, endDate);
          }
        }

        // Apply month range filters if appropriate
        if (hasMonthFilter) {
          if (startMonth) {
            q = q.gte("month", startMonth);
          }
          if (endMonth) {
            q = q.lte("month", endMonth);
          }
        }

        // Build text search filters
        if (hasBusFilter && busQuery.trim()) {
          const busCol = activeReport.columns.some(col => col.key === "bus") ? "bus" : "plate_number";
          q = q.ilike(busCol, `%${busQuery.trim()}%`);
        }
        if (hasRouteFilter && routeQuery.trim()) {
          q = q.ilike("route", `%${routeQuery.trim()}%`);
        }
        if (hasConductorFilter && conductorQuery.trim()) {
          q = q.ilike("conductor", `%${conductorQuery.trim()}%`);
        }
        if (hasDriverFilter && driverQuery.trim()) {
          q = q.ilike("driver", `%${driverQuery.trim()}%`);
        }
        if (hasOfficeFilter && officeQuery.trim()) {
          q = q.ilike("office", `%${officeQuery.trim()}%`);
        }
        if (hasStatusFilter && statusQuery.trim()) {
          q = q.ilike("status", `%${statusQuery.trim()}%`);
        }

        // Order logically where applicable
        if (activeReport.columns.some(col => col.key === "date")) {
          q = q.order("date", { ascending: false });
        } else if (activeReport.columns.some(col => col.key === "month")) {
          q = q.order("month", { ascending: false });
        }

        return q;
      };

      if (!isAnyFilterApplied) {
        let q = buildFilteredQuery().limit(100);
        const { data, error } = await q;
        if (error) throw error;
        setReportData(data || []);
      } else {
        // Filters applied -> fetch ALL matching rows using pagination loop internally
        let finalRows: any[] = [];
        const batchSize = 1000;
        let from = 0;
        let hasMore = true;

        while (hasMore) {
          let q = buildFilteredQuery().range(from, from + batchSize - 1);
          const { data: batchData, error: batchErr } = await q;
          if (batchErr) throw batchErr;

          if (!batchData || batchData.length === 0) {
            hasMore = false;
            break;
          }

          finalRows.push(...batchData);
          setReportData([...finalRows]);

          if (batchData.length < batchSize) {
            hasMore = false;
          } else {
            from += batchSize;
          }
        }
        setReportData(finalRows);
      }
    } catch (err: any) {
      console.error(err);
      setFetchError(err.message || "Failed to load report dataset from Supabase.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [selectedReportId]);

  const handleApplyTextFilter = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReportData();
  };

  const totals = useMemo(() => {
    const calculated: Record<string, number> = {};
    activeReport.columns.forEach(col => {
      if (NUMERIC_COLS.includes(col.key)) {
        const nonNullRows = reportData.filter(row => row[col.key] !== undefined && row[col.key] !== null && row[col.key] !== "");
        if (nonNullRows.length === 0) {
          calculated[col.key] = 0;
          return;
        }
        const values = nonNullRows.map(row => Number(row[col.key]));
        if (isPercentCol(col.key)) {
          // calculate average
          const sum = values.reduce((acc, v) => acc + v, 0);
          calculated[col.key] = sum / values.length;
        } else {
          // calculate sum
          calculated[col.key] = values.reduce((acc, v) => acc + v, 0);
        }
      }
    });
    return calculated;
  }, [reportData, activeReport]);

  const handleExportExcel = () => {
    try {
      if (reportData.length === 0) return;
      const headers = activeReport.columns.map(c => c.label);
      const rows = reportData.map(row => {
        return activeReport.columns.map(col => {
          const val = row[col.key];
          if (val === undefined || val === null) return "";
          if (col.type === "number") return Number(val);
          if (col.type === "date" && val) return String(val).split("T")[0];
          return String(val);
        });
      });

      if (activeReport.totalsRow) {
        const totalRow = activeReport.columns.map((col, idx) => {
          if (idx === 0) return "TOTAL";
          if (NUMERIC_COLS.includes(col.key)) {
            return totals[col.key] || 0;
          }
          return "";
        });
        rows.push(totalRow as any);
      }

      const aoa = [
        [companyName.toUpperCase()],
        [`OPERATIONAL REPORT: ${activeReport.name.toUpperCase()}`],
        [`Exported At: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`],
        [],
        headers,
        ...rows
      ];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, activeReport.name.slice(0, 30));
      XLSX.writeFile(wb, `${activeReport.id}_report_${new Date().toISOString().split("T")[0]}.xlsx`);
    } catch (err) {
      console.error("Excel export failure:", err);
    }
  };

  const handleExportPDF = () => {
    try {
      if (reportData.length === 0) return;
      const doc = new jsPDF("l", "pt", "a4");

      // Custom premium styling
      doc.setFillColor(6, 15, 29);
      doc.rect(0, 0, 842, 60, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(14);
      doc.text(companyName.toUpperCase(), 40, 35);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(156, 163, 175);
      doc.text(`Report: ${activeReport.name} | Generated: ${new Date().toISOString().split("T")[0]}`, 520, 35);

      const headers = activeReport.columns.map(c => c.label);
      const rows = reportData.map(row => {
        return activeReport.columns.map(col => {
          const val = row[col.key];
          return formatValue(val, col.key);
        });
      });

      if (activeReport.totalsRow) {
        const totalRow = activeReport.columns.map((col, idx) => {
          if (idx === 0) return "Σ TOTALS";
          if (NUMERIC_COLS.includes(col.key)) {
            return formatTotalValue(totals[col.key], col.key);
          }
          return "";
        });
        rows.push(totalRow as any);
      }

      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: 80,
        theme: "striped",
        headStyles: { 
          fillColor: [16, 185, 129], 
          textColor: [10, 15, 20], 
          fontSize: 8,
          fontStyle: "bold"
        },
        bodyStyles: { 
          fontSize: 7.5,
          textColor: [31, 41, 55]
        },
        columnStyles: activeReport.columns.reduce((acc, col, idx) => {
          acc[idx] = { halign: col.align || "left" };
          return acc;
        }, {} as Record<number, any>),
        styles: { font: "Helvetica" }
      });

      doc.save(`${activeReport.id}_report_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (err) {
      console.error("PDF export failure:", err);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Report Selection Cards at the Top */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {OPERATIONS_REPORTS_CONFIG.map((report) => {
          const isSelected = report.id === selectedReportId;
          return (
            <button
              key={report.id}
              id={`report-card-${report.id}`}
              onClick={() => {
                setSelectedReportId(report.id);
                clearAllFilters();
              }}
              className={`text-left p-4 rounded-xl border transition-all relative overflow-hidden flex flex-col justify-between hover:border-emerald-500/30 cursor-pointer ${
                isSelected
                  ? "bg-[#0c1a12] border-emerald-500/20 text-white shadow-lg"
                  : "bg-[#0a0f1d]/60 border-white/5 text-neutral-300"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className={`text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full ${
                  report.category === "Monthly Reports"
                    ? "bg-blue-500/10 text-blue-400"
                    : "bg-emerald-500/10 text-emerald-400"
                }`}>
                  {report.category}
                </span>
                <FileBarChart className={`h-4 w-4 ${isSelected ? "text-emerald-400" : "text-neutral-500"}`} />
              </div>
              <h4 className="font-semibold text-xs text-white mb-1">{report.name}</h4>
              <p className="text-[10px] text-neutral-400 leading-normal font-light shrink-0">
                {report.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Main Reporting Workspace */}
      <div className="rounded-2xl border border-white/10 bg-[#1a2e26]/60 backdrop-blur-xl p-5 space-y-5 shadow-2xl relative">
        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#10b981]/20 to-transparent"></div>
        
        {/* Header */}
        <div className="pb-4 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <FileBarChart className="h-4 w-4 text-emerald-400" />
              <span>{activeReport.name} <span className="text-emerald-500/80 font-mono text-[11px] ml-2 font-normal">// {companyName}</span></span>
            </h3>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              {activeReport.description} •{" "}
              {loading && isAnyFilterApplied ? (
                <span className="text-emerald-400 font-mono font-semibold animate-pulse">
                  Loading filtered records... {reportData.length > 0 ? `(Loaded ${reportData.length} records)` : ""}
                </span>
              ) : (
                <span className="text-emerald-400 font-mono font-semibold">
                  {isAnyFilterApplied ? `Showing ${reportData.length} filtered records` : "Preview Mode (100 rows)"}
                </span>
              )}
            </p>
          </div>

          {/* Exporting buttons */}
          {reportData.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                id="btn-export-xlsx"
                onClick={handleExportExcel}
                className="px-3 py-1.5 border border-white/10 hover:border-emerald-500/20 hover:bg-[#0b1710] text-neutral-300 hover:text-emerald-400 transition-all font-mono text-[10px] rounded-xl flex items-center gap-1.5 cursor-pointer h-8"
              >
                <FileText className="h-3 w-3" />
                XLSX
              </button>
              <button
                id="btn-export-pdf"
                onClick={handleExportPDF}
                className="px-3 py-1.5 border border-white/10 hover:border-emerald-500/20 hover:bg-[#0b1710] text-neutral-300 hover:text-emerald-400 transition-all font-mono text-[10px] rounded-xl flex items-center gap-1.5 cursor-pointer h-8"
              >
                <FileBarChart className="h-3 w-3" />
                PDF
              </button>
            </div>
          )}
        </div>

        {/* Dynamic Parameter Filters Form */}
        <form onSubmit={handleApplyTextFilter} className="bg-[#070b14]/50 p-4 rounded-xl border border-white/5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-300">
              <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-400" />
              <span>Report Parameters</span>
            </div>
            {isAnyFilterApplied && (
              <button
                type="button"
                id="btn-clear-filters"
                onClick={clearAllFilters}
                className="text-[10px] font-mono text-amber-500 hover:text-amber-400 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <X className="h-3 w-3" />
                Clear Filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
            {hasDateFilter && (
              <>
                <div>
                  <label className="block text-[9px] uppercase tracking-wider text-neutral-500 font-mono mb-1.5">Date From</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-500 pointer-events-none" />
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-[#0c121f] border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/40 font-mono h-[34px]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] uppercase tracking-wider text-neutral-500 font-mono mb-1.5">Date To</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-500 pointer-events-none" />
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-[#0c121f] border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/40 font-mono h-[34px]"
                    />
                  </div>
                </div>
              </>
            )}

            {hasMonthFilter && (
              <>
                <div>
                  <label className="block text-[9px] uppercase tracking-wider text-neutral-500 font-mono mb-1.5">Month From</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-500 pointer-events-none" />
                    <input
                      type="month"
                      value={startMonth}
                      onChange={(e) => setStartMonth(e.target.value)}
                      className="w-full bg-[#0c121f] border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/40 font-mono h-[34px]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] uppercase tracking-wider text-neutral-500 font-mono mb-1.5">Month To</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-500 pointer-events-none" />
                    <input
                      type="month"
                      value={endMonth}
                      onChange={(e) => setEndMonth(e.target.value)}
                      className="w-full bg-[#0c121f] border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/40 font-mono h-[34px]"
                    />
                  </div>
                </div>
              </>
            )}

            {hasBusFilter && (
              <div>
                <label className="block text-[9px] uppercase tracking-wider text-neutral-500 font-mono mb-1.5">Search Bus</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-500 pointer-events-none" />
                  <input
                    type="text"
                    value={busQuery}
                    onChange={(e) => setBusQuery(e.target.value)}
                    placeholder="Bus or license plate..."
                    className="w-full bg-[#0c121f] border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/40 h-[34px]"
                  />
                </div>
              </div>
            )}

            {hasRouteFilter && (
              <div>
                <label className="block text-[9px] uppercase tracking-wider text-neutral-500 font-mono mb-1.5">Search Route</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-500 pointer-events-none" />
                  <input
                    type="text"
                    value={routeQuery}
                    onChange={(e) => setRouteQuery(e.target.value)}
                    placeholder="Route details..."
                    className="w-full bg-[#0c121f] border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/40 h-[34px]"
                  />
                </div>
              </div>
            )}

            {hasConductorFilter && (
              <div>
                <label className="block text-[9px] uppercase tracking-wider text-neutral-500 font-mono mb-1.5">Search Conductor</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-500 pointer-events-none" />
                  <input
                    type="text"
                    value={conductorQuery}
                    onChange={(e) => setConductorQuery(e.target.value)}
                    placeholder="Conductor name..."
                    className="w-full bg-[#0c121f] border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/40 h-[34px]"
                  />
                </div>
              </div>
            )}

            {hasDriverFilter && (
              <div>
                <label className="block text-[9px] uppercase tracking-wider text-neutral-500 font-mono mb-1.5">Search Driver</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-500 pointer-events-none" />
                  <input
                    type="text"
                    value={driverQuery}
                    onChange={(e) => setDriverQuery(e.target.value)}
                    placeholder="Driver name..."
                    className="w-full bg-[#0c121f] border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/40 h-[34px]"
                  />
                </div>
              </div>
            )}

            {hasOfficeFilter && (
              <div>
                <label className="block text-[9px] uppercase tracking-wider text-neutral-500 font-mono mb-1.5">Search Office</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-500 pointer-events-none" />
                  <input
                    type="text"
                    value={officeQuery}
                    onChange={(e) => setOfficeQuery(e.target.value)}
                    placeholder="Office terminal..."
                    className="w-full bg-[#0c121f] border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/40 h-[34px]"
                  />
                </div>
              </div>
            )}

            {hasStatusFilter && (
              <div>
                <label className="block text-[9px] uppercase tracking-wider text-neutral-500 font-mono mb-1.5">Status Filter</label>
                <div className="relative">
                  <SlidersHorizontal className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-500 pointer-events-none" />
                  <input
                    type="text"
                    value={statusQuery}
                    onChange={(e) => setStatusQuery(e.target.value)}
                    placeholder="e.g. Active, Broken..."
                    className="w-full bg-[#0c121f] border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/40 h-[34px]"
                  />
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 disabled:opacity-50 text-neutral-950 font-bold font-mono tracking-widest uppercase text-[10px] rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer h-[34px]"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Syncing...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Apply Filters</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Table representation */}
        {fetchError && (
          <div className="p-4 bg-red-950/20 border border-red-500/30 rounded-xl text-xs text-red-300 font-mono">
            {fetchError}
          </div>
        )}

        {loading && reportData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <RefreshCw className="h-7 w-7 text-emerald-400 animate-spin mb-3" />
            <span className="font-mono text-xs text-neutral-400">LOADING METRICS LEDGER FROM CLOUD SERVERS...</span>
          </div>
        ) : reportData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-white/5 rounded-2xl bg-white/[0.01]">
            <Compass className="h-8 w-8 text-neutral-600 animate-pulse mb-2" />
            <span className="text-xs text-neutral-400 font-mono">No Records Registered</span>
            <p className="text-[10px] text-neutral-500 max-w-xs mt-1 leading-normal">
              No physical activity matches found. Make sure entries exist or clear active parameters to recheck.
            </p>
          </div>
        ) : (
          <div className="border border-white/5 rounded-2xl bg-[#090d18]/70 overflow-x-auto relative custom-scrollbar">
            <table className="w-full border-collapse text-left text-[11px] font-sans">
              <thead>
                <tr className="border-b border-white/10 bg-[#0c1221]/90 text-[10px] font-mono uppercase tracking-wider text-emerald-400 sticky top-0">
                  {activeReport.columns.map(col => (
                    <th key={col.key} className="p-3 font-semibold">
                      <div className={col.align === "right" ? "text-right" : "text-left"}>
                        {col.label}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-neutral-200">
                {reportData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-emerald-500/[0.02] transition-colors">
                    {activeReport.columns.map(col => {
                      const val = row[col.key];
                      const alignClass = col.align === "right" ? "text-right" : "text-left";
                      
                      return (
                        <td key={col.key} className={`p-3 ${alignClass}`}>
                          {col.type === "number" ? (
                            <span className="font-mono font-medium text-neutral-100">
                              {formatValue(val, col.key)}
                            </span>
                          ) : col.type === "date" ? (
                            <span className="font-mono text-neutral-400 text-[10px]">
                              {val ? String(val).split("T")[0] : "—"}
                            </span>
                          ) : (
                            <span className="font-light">{val === undefined || val === null || val === "" ? "—" : String(val)}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>

              {/* Dynamic Totals Row */}
              {activeReport.totalsRow && (
                <tfoot className="border-t-2 border-white/10 bg-[#090d18]/95 font-mono font-bold text-emerald-400 sticky bottom-0">
                  <tr>
                    {activeReport.columns.map((col, idx) => {
                      const alignClass = col.align === "right" ? "text-right" : "text-left";
                      
                      if (idx === 0) {
                        return (
                          <td key={col.key} className="p-3 text-left uppercase tracking-wider">
                            Σ TOTALS
                          </td>
                        );
                      }
                      
                      if (NUMERIC_COLS.includes(col.key)) {
                        return (
                          <td key={col.key} className={`p-3 ${alignClass}`}>
                            {formatTotalValue(totals[col.key], col.key)}
                          </td>
                        );
                      }

                      return <td key={col.key} className="p-3" />;
                    })}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* Rows limit preview memo */}
        <div className="text-[10px] font-mono text-neutral-500 text-right pr-2">
          {isAnyFilterApplied ? (
            `* Filter active: loaded ${reportData.length} records matching search criteria.`
          ) : (
            `* Default preview: displaying top 100 entries. Add parameters to search full dataset.`
          )}
        </div>
      </div>

    </div>
  );
}

/* ========================================================================== */
/* SECURE MAIN OPERATIONS CONTROLLER PAGE                                     */
/* ========================================================================== */
export default function OperationsPage({ session, onLogout }: { session: any; onLogout: () => void }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"dashboard" | "daily_bus" | "add_bus" | "add_office" | "actions" | "memos" | "reports">("dashboard");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  // Authenticated User States
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [currentUserRoleName, setCurrentUserRoleName] = useState<string>("");
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  // Dashboard view tables caches
  const [dashboardMetrics, setDashboardMetrics] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(true);

  // Cache Lookup tables
  const [buses, setBuses] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [staffs, setStaffs] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [lookupsLoading, setLookupsLoading] = useState(false);

  // Retrieve user profiles
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

  useEffect(() => {
    if (currentUserProfile) {
      fetchUnreadMemosCount();
    }
  }, [currentUserProfile]);

  // Read and Cache Lookup tables once on load
  const fetchLookupsState = async () => {
    try {
      setLookupsLoading(true);
      const companyId = currentUserProfile?.company_id;

      let qBuses = supabase.from("buses").select("id, plate_number").eq("is_active", true);
      let qRoutes = supabase.from("routes").select("id, route_name").eq("is_active", true);
      let qStaffs = supabase.from("staffs").select("id, full_name").eq("is_active", true);
      let qRegions = supabase.from("regions").select("*");

      if (companyId) {
        qBuses = qBuses.eq("company_id", companyId);
        qRoutes = qRoutes.eq("company_id", companyId);
        qStaffs = qStaffs.eq("company_id", companyId);
      }

      const [resBuses, resRoutes, resStaffs, resRegions] = await Promise.all([
        qBuses.order("plate_number", { ascending: true }),
        qRoutes.order("route_name", { ascending: true }),
        qStaffs.order("full_name", { ascending: true }),
        qRegions
      ]);

      if (resBuses.data) setBuses(resBuses.data);
      if (resRoutes.data) setRoutes(resRoutes.data);
      if (resStaffs.data) setStaffs(resStaffs.data);
      if (resRegions.data) setRegions(resRegions.data);

    } catch (err) {
      console.error("Error fetching lookups:", err);
    } finally {
      setLookupsLoading(false);
    }
  };

  useEffect(() => {
    if (currentUserProfile) {
      fetchLookupsState();
    }
  }, [currentUserProfile]);

  // Read and Cache view data for dashboard on load
  const fetchDashboardData = async () => {
    if (!currentUserProfile) return;
    try {
      setMetricsLoading(true);
      const companyId = currentUserProfile?.company_id;

      // Fetch v_operational_dashboard
      let qDash = supabase.from("v_operational_dashboard").select("*");
      if (companyId) {
        qDash = qDash.eq("company_id", companyId);
      }
      const { data: dashData, error: dashError } = await qDash;
      if (!dashError && dashData && dashData.length > 0) {
        setDashboardMetrics(dashData[0]);
      } else {
        // global fallback
        const { data: globalDash } = await supabase.from("v_operational_dashboard").select("*");
        if (globalDash && globalDash.length > 0) {
          setDashboardMetrics(globalDash[0]);
        }
      }

      // Fetch v_overall_monthly_utilization_average
      let qChart = supabase.from("v_overall_monthly_utilization_average").select("*");
      if (companyId) {
        qChart = qChart.eq("company_id", companyId);
      }
      const { data: cData, error: cError } = await qChart.order("month", { ascending: true });
      if (!cError && cData) {
        setChartData(cData);
      } else {
        // global fallback
        const { data: globalChart } = await supabase.from("v_overall_monthly_utilization_average").select("*").order("month", { ascending: true });
        if (globalChart) {
          setChartData(globalChart);
        }
      }
    } catch (err) {
      console.error("Error fetching dashboard views:", err);
    } finally {
      setMetricsLoading(false);
    }
  };

  useEffect(() => {
    if (currentUserProfile) {
      fetchDashboardData();
    }
  }, [currentUserProfile, activeTab]);

  // Memoize mapped lookup values to avoid recalculations
  const memoizedLookups = useMemo(() => ({
    busesReady: buses.map(b => ({ id: b.id, name: b.plate_number })),
    routesReady: routes.map(r => ({ id: r.id, name: r.route_name })),
    staffsReady: staffs.map(s => ({ id: s.id, name: s.full_name }))
  }), [buses, routes, staffs]);

  const memoizedRegions = useMemo(() => {
    return regions.map(r => ({ id: String(r.id), name: r.region || r.region_name || r.name || String(r.id) }));
  }, [regions]);

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    onLogout();
    navigate("/login");
  };

  const navItems = [
    { id: "dashboard", label: "Operational Dashboard", icon: LayoutDashboard },
    { id: "daily_bus", label: "Daily Buses Entry", icon: ListChecks },
    { id: "add_bus", label: "Add Bus", icon: Bus },
    { id: "add_office", label: "Add Office", icon: Building2 },
    { id: "actions", label: "Actions", icon: CheckSquare },
    { id: "memos", label: "Memos", icon: Mail },
    { id: "reports", label: "Reports", icon: FileBarChart },
  ] as const;

  // Extraction values
  const email = session?.user?.email || session?.email || "";
  const username = currentUserProfile?.full_name || email || "Current User";
  const userRole = currentUserRoleName || "Role Not Assigned";
  const fiscalYear = "FY 2026-2027";

  const currentNav = navItems.find((item) => item.id === activeTab) || navItems[0];

  return (
    <div className="relative min-h-screen operations-animated-bg text-neutral-250 font-sans flex overflow-hidden">
      
      {/* Premium Emerald Green and Gold ambient background lighting */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-gradient-to-tr from-emerald-700/25 to-emerald-650/10 blur-[180px] rounded-full pointer-events-none animate-float-1"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-gradient-to-bl from-[#10b981]/22 to-amber-500/14 blur-[180px] rounded-full pointer-events-none animate-float-2"></div>
      <div className="absolute top-[25%] left-[25%] w-[45%] h-[45%] bg-gradient-to-tr from-amber-500/18 to-emerald-600/5 blur-[200px] rounded-full pointer-events-none animate-pulse"></div>

      {/* Mobile/Tablet Backdrop overlay when sidebar is open */}
      {!isSidebarCollapsed && (
        <div 
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setIsSidebarCollapsed(true)}
        />
      )}

      {/* OPERATIONS SIDEBAR NAVIGATION */}
      <motion.aside
        id="operations-sidebar"
        animate={{ width: isSidebarCollapsed ? "80px" : "280px" }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={`fixed md:relative inset-y-0 left-0 z-30 shrink-0 border-r border-[#172545]/40 bg-[#090b11]/95 md:bg-slate-900/60 backdrop-blur-xl flex flex-col justify-between overflow-hidden ${isSidebarCollapsed ? "hidden md:flex" : "flex"}`}
      >
        <div className="p-5 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            {!isSidebarCollapsed ? (
              <div 
                id="operations-sidebar-brand" 
                onClick={() => navigate("/modules")}
                className="flex items-center gap-2.5 cursor-pointer group"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-600 to-yellow-200 shadow-[0_0_15px_rgba(251,191,36,0.2)] p-[1px]">
                  <div className="flex h-full w-full items-center justify-center rounded-lg bg-neutral-950">
                    <Compass className="h-4 w-4 text-amber-400 group-hover:rotate-45 transition-transform duration-500" />
                  </div>
                </div>
                <span className="font-serif font-black tracking-widest text-sm text-neutral-100 group-hover:text-amber-400 transition-colors">
                  MEQK
                </span>
              </div>
            ) : (
              <div 
                onClick={() => navigate("/modules")}
                className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-600 to-yellow-200 cursor-pointer p-[1px]"
              >
                <div className="flex h-full w-full items-center justify-center rounded-lg bg-neutral-950">
                  <Compass className="h-4 w-4 text-amber-400" />
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
            <div className="px-1 py-1.5 bg-[#091224]/85 border border-[#1b2b4d]/40 rounded-xl p-3">
              <span className="text-[9px] font-mono uppercase tracking-[0.25em] text-amber-500/80 block mb-0.5">
                ACTIVE PIPELINE
              </span>
              <div className="text-xs font-semibold text-white tracking-tight flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse"></div>
                Fleet Operations
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Navigation Options */}
        <nav className="flex-1 px-3 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const badgeCount = item.id === "memos" 
              ? (unreadMemosCount > 0 ? unreadMemosCount : undefined)
              : undefined;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between rounded-xl p-3 text-xs tracking-wide transition-all duration-300 relative group cursor-pointer ${
                  isActive
                    ? "bg-gradient-to-r from-blue-950/40 to-blue-900/10 border border-blue-500/30 text-amber-300 shadow-[0_0_15px_rgba(59,130,246,0.05)]"
                    : "hover:bg-[#0c1324]/50 border border-transparent text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <div className="flex items-center flex-1">
                  <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? "text-amber-400" : "text-neutral-400 group-hover:text-blue-400"} ${isSidebarCollapsed ? "mx-auto" : "mr-3"}`} />
                  
                  {!isSidebarCollapsed && (
                    <span className="font-medium transition-colors">{item.label}</span>
                  )}
                </div>

                {!isSidebarCollapsed && badgeCount !== undefined && (
                  <span className="bg-[#052e16]/65 text-amber-400 border border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.25)] animate-pulse font-mono text-[9px] px-1.5 py-0.5 rounded-full scale-90 shrink-0">
                    {badgeCount}
                  </span>
                )}
                
                {/* Collapsed view popover tooltip */}
                {isSidebarCollapsed && (
                  <div className="absolute left-20 bg-neutral-950 text-amber-300 border border-blue-500/20 px-3 py-1.5 rounded-md text-[11px] font-mono tracking-wide opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-300 shadow-xl z-50 whitespace-nowrap">
                    {item.label} {badgeCount !== undefined ? `(${badgeCount})` : ""}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer Controls */}
        <div className="p-4 border-t border-[#172545]/45 space-y-3">
          <button
            onClick={() => navigate("/modules")}
            className="w-full flex items-center justify-center rounded-xl border border-white/5 bg-neutral-950 hover:border-blue-500/30 text-xs text-neutral-400 hover:text-amber-300 p-3 transition-all duration-300 group cursor-pointer"
          >
            <ArrowLeft className={`h-4 w-4 shrink-0 ${isSidebarCollapsed ? "mx-auto" : "mr-2 group-hover:-translate-x-0.5 transition-transform"}`} />
            {!isSidebarCollapsed && <span className="font-medium">Modules Menu</span>}
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center rounded-xl border border-red-500/10 bg-red-950/5 hover:bg-red-950/20 hover:border-red-500/30 text-xs text-red-400 p-3 transition-all duration-300 cursor-pointer"
          >
            <LogOut className={`h-4 w-4 shrink-0 ${isSidebarCollapsed ? "mx-auto" : "mr-2"}`} />
            {!isSidebarCollapsed && <span className="font-medium">Secure Out</span>}
          </button>
        </div>
      </motion.aside>

      {/* VIEWPORT CONTROLLER */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        
        {/* TOP BAR USER PROFILE HEADER CAPSULE */}
        <header className="border-b border-[#172545]/40 bg-[#060a12]/55 backdrop-blur-md px-6 py-4 flex flex-row justify-between items-center gap-4 z-10 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-2 rounded-xl border border-white/10 hover:bg-neutral-800 text-neutral-400 hover:text-emerald-400 md:hidden cursor-pointer shrink-0"
              title="Toggle Sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs uppercase font-mono tracking-[0.25em] bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent font-bold">
                {currentUserProfile?.company_name || "Company Name"}
              </span>
              <h1 className="text-xl md:text-2xl font-serif font-black tracking-wide bg-gradient-to-r from-white via-neutral-200 to-emerald-400 bg-clip-text text-transparent uppercase leading-none">
                Operations
              </h1>
            </div>
          </div>

          {/* Luxury Executive User Status Info */}
          <div className="flex items-center gap-3 bg-[#0a0f1d]/90 border border-blue-500/10 shadow-2xl rounded-2xl p-2.5 px-4 shrink-0 font-mono tracking-wide">
            <div className="h-8.5 w-8.5 rounded-xl bg-gradient-to-tr from-blue-600/20 to-amber-500/5 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <User className="h-4 w-4" />
            </div>
            <div className="text-left flex flex-col gap-0.5">
              <div className="text-xs font-semibold text-white uppercase leading-tight">
                {username}
              </div>
              <div className="text-[9px] text-amber-300 uppercase flex items-center gap-1.5 leading-none font-medium">
                <span className="h-1 w-1 rounded-full bg-amber-500"></span>
                <span>{userRole || "Role Not Assigned"}</span>
              </div>
              <div className="text-[8px] text-neutral-400 uppercase flex items-center gap-1 leading-none">
                <Calendar className="h-3 w-3 text-neutral-600 shrink-0" />
                <span>{fiscalYear || "Current Fiscal Year"}</span>
              </div>
            </div>
          </div>
        </header>

        {/* MAIN DYNAMIC SECTION */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.25 }}
              className="space-y-6 mx-auto w-full max-w-[1650px]"
            >
              {/* Abstract Header Text */}
              <div className="p-5 rounded-2xl border border-white/5 bg-[#0a0f1d]/35 backdrop-blur-md flex flex-col md:flex-row justify-between items-start md:items-center gap-3 relative overflow-hidden">
                <div className="absolute right-[-10px] top-[-10px] w-28 h-28 bg-blue-500/5 blur-3xl pointer-events-none rounded-full"></div>
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-[#6c86b3] font-mono">
                    {activeTab === "dashboard" && "Operational Dashboard"}
                    {activeTab === "daily_bus" && "Daily Buses Entry"}
                    {activeTab === "add_bus" && "Register Fleet Bus"}
                    {activeTab === "add_office" && "Register Station Hub"}
                    {activeTab === "actions" && "Operations Actions"}
                    {activeTab === "memos" && "Directive Communication Board"}
                    {activeTab === "reports" && "Management Reporting"}
                  </h2>
                  <p className="text-[11px] text-neutral-400 font-light mt-1">
                    {activeTab === "dashboard" && "Monitor daily bus movements, passenger flow, and route performance."}
                    {activeTab === "daily_bus" && "Log bus operational date, driver and conductor staffing, and passenger manifests."}
                    {activeTab === "add_bus" && "Register a new bus into the regional transit fleet database."}
                    {activeTab === "add_office" && "Establish a new branch terminal office aligned with mapped territories."}
                    {activeTab === "actions" && "Review and manage operational approvals and updates."}
                    {activeTab === "memos" && "Secure memos database integrated directly into internal fleet communications."}
                    {activeTab === "reports" && "Generate operational reports and performance exports."}
                  </p>
                </div>
              </div>

              {/* Rendering Dynamic Sections */}
              {lookupsLoading && (
                <div className="flex flex-col items-center justify-center py-12">
                  <RefreshCw className="h-6 w-6 text-blue-400 animate-spin mb-2" />
                  <span className="font-mono text-[10px] tracking-wide text-neutral-500">Syncing Cache Lookups...</span>
                </div>
              )}

              {!lookupsLoading && activeTab === "dashboard" && (
                <DashboardView 
                  metrics={dashboardMetrics} 
                  chartData={chartData} 
                  metricsLoading={metricsLoading} 
                />
              )}
              {!lookupsLoading && activeTab === "daily_bus" && (
                <DailyBusesEntryView 
                  lookups={memoizedLookups} 
                  currentUserProfile={currentUserProfile} 
                />
              )}
              {!lookupsLoading && activeTab === "add_bus" && (
                <AddBusView 
                  currentUserProfile={currentUserProfile} 
                  onRefreshLookups={fetchLookupsState} 
                />
              )}
              {!lookupsLoading && activeTab === "add_office" && (
                <AddOfficeView 
                  currentUserProfile={currentUserProfile} 
                  regionsReady={memoizedRegions} 
                  onRefreshLookups={fetchLookupsState} 
                />
              )}
              {!lookupsLoading && activeTab === "actions" && (
                <ActionsView 
                  currentUserProfile={currentUserProfile} 
                  regionsReady={memoizedRegions}
                  onRefreshLookups={fetchLookupsState}
                />
              )}
              {!lookupsLoading && activeTab === "memos" && <MemosView currentUserProfile={currentUserProfile} onMemosUpdated={fetchUnreadMemosCount} />}
              {!lookupsLoading && activeTab === "reports" && <ReportsView currentUserProfile={currentUserProfile} />}

            </motion.div>
          </AnimatePresence>
        </main>
      </div>

    </div>
  );
}
