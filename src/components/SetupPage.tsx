import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  ArrowLeft, 
  Coins, 
  ShieldCheck, 
  Building2, 
  UserPlus, 
  PlusCircle, 
  FolderPlus, 
  List, 
  BookOpen, 
  Tag, 
  ChevronDown, 
  Search, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle,
  Layers,
  Heart,
  Users,
  Compass,
  MapPin,
  KeyRound,
  Edit2,
  X
} from "lucide-react";
import { supabase, resolveProfile } from "../lib/supabase";

// Lookups types
interface LookupItem {
  id: string;
  name: string;
}

export default function SetupPage() {
  const navigate = useNavigate();

  // Selected tab state
  // Tabs: 1: Company Reg, 2: User Reg, 3: Add Account, 4: Add Category, 5: Companies, 6: Account List, 7: Category List
  const [activeTab, setActiveTab] = useState<number>(1);

  // Core metadata loaded on mount
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [isLookupsLoading, setIsLookupsLoading] = useState(true);

  // Lookup Tables (fetched once and reused)
  const [regions, setRegions] = useState<LookupItem[]>([]);
  const [roles, setRoles] = useState<LookupItem[]>([]);
  const [companies, setCompanies] = useState<LookupItem[]>([]);
  const [natures, setNatures] = useState<LookupItem[]>([]);

  // Section Live List data states
  const [companiesList, setCompaniesList] = useState<any[]>([]);
  const [accountsList, setAccountsList] = useState<any[]>([]);
  const [categoriesList, setCategoriesList] = useState<any[]>([]);

  // Individual lists loading states
  const [isCompaniesListLoading, setIsCompaniesListLoading] = useState(false);
  const [isAccountsListLoading, setIsAccountsListLoading] = useState(false);
  const [isCategoriesListLoading, setIsCategoriesListLoading] = useState(false);

  // Search parameters for lists
  const [companySearch, setCompanySearch] = useState("");
  const [accountSearch, setAccountSearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");

  // SECTION 1: Company Reg Form state
  const [companyForm, setCompanyForm] = useState({
    company_name: "",
    legal_name: "",
    tin: "",
    vrn: "",
    email: "",
    phone: "",
    address: "",
    city: "", // will hold region.id
    country: "Tanzania",
    is_active: true
  });
  const [companySaving, setCompanySaving] = useState(false);
  const [companySuccess, setCompanySuccess] = useState<string | null>(null);
  const [companyError, setCompanyError] = useState<string | null>(null);

  // SECTION 2: User Reg Form state
  const [userForm, setUserForm] = useState({
    email: "",
    password: "",
    full_name: "",
    role_id: "",
    address: "",
    phone_number: "",
    nida_number: "",
    company: "", // will hold company.id
    is_active: true
  });
  const [userSaving, setUserSaving] = useState(false);
  const [userSuccess, setUserSuccess] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);

  // SECTION 3: Add Account Form state
  const [accountForm, setAccountForm] = useState({
    account_name: "",
    nature: "", // will hold nature.id
    account_code: "",
    description: "",
    is_active: true,
    company: "" // will hold company.id
  });
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountSuccess, setAccountSuccess] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);

  // SECTION 4: Add Category Form state
  const [categoryForm, setCategoryForm] = useState({
    category_name: "",
    category_code: "",
    nature: "", // will hold nature.id
    description: "",
    company: "", // will hold company.id
    is_active: true
  });
  const [categorySaving, setCategorySaving] = useState(false);
  const [categorySuccess, setCategorySuccess] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  // SECTION 8: Add Route Form state
  const [routeForm, setRouteForm] = useState({
    route_name: "",
    origin: "",
    destination: "",
    distance_km: "",
    description: "",
    company: "", // will hold company.id
    is_active: true
  });
  const [routeSaving, setRouteSaving] = useState(false);
  const [routeSuccess, setRouteSuccess] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);

  // SECTION 9: Routes List management
  const [routesList, setRoutesList] = useState<any[]>([]);
  const [isRoutesListLoading, setIsRoutesListLoading] = useState(false);
  const [routeSearch, setRouteSearch] = useState("");
  const [editingRoute, setEditingRoute] = useState<any | null>(null);

  // SECTION 10: Users List management
  const [usersList, setUsersList] = useState<any[]>([]);
  const [isUsersListLoading, setIsUsersListLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [editingUser, setEditingUser] = useState<any | null>(null);

  // SECTION 11: Reset Password state
  const [resetPasswordSelectedUser, setResetPasswordSelectedUser] = useState<string | null>(null);
  const [resetPasswordSearch, setResetPasswordSearch] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState<string | null>(null);
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);

  // Global static defaults for fallback safety
  const DEFAULT_ROLES = [
    { id: "admin-role-id-9991", name: "Administrator" },
    { id: "manager-role-id-9992", name: "Manager" },
    { id: "accountant-role-id-9993", name: "Accountant" },
    { id: "clerk-role-id-9994", name: "Clerk" }
  ];

  const DEFAULT_REGIONS = [
    { id: "dar-reg-id-9991", name: "Dar es Salaam" },
    { id: "aru-reg-id-9992", name: "Arusha" },
    { id: "mwa-reg-id-9993", name: "Mwanza" },
    { id: "dod-reg-id-9994", name: "Dodoma" }
  ];

  const DEFAULT_NATURES = [
    { id: "asset-nat-id-991", name: "Asset" },
    { id: "liab-nat-id-992", name: "Liability" },
    { id: "eq-nat-id-993", name: "Equity" },
    { id: "rev-nat-id-994", name: "Revenue" },
    { id: "exp-nat-id-995", name: "Expense" }
  ];

  // Load mount lookups
  useEffect(() => {
    async function loadData() {
      setIsLookupsLoading(true);

      let profileObj: any = null;
      // 1. Fetch current signed-in user profile
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          const profile = await resolveProfile(session.user.id);
          if (profile) {
            profileObj = profile;
            setCurrentUserProfile(profile);
          }
        }
      } catch (err) {
        console.error("Error loading user session profile", err);
      }

      // 2. Fetch lookups passing Resolved profile
      await refreshAllLookups(profileObj);

      setIsLookupsLoading(false);
    }

    loadData();
  }, []);

  // Fetch Lookups Engine
  const refreshAllLookups = async (profileObj?: any) => {
    const activeProfile = profileObj || currentUserProfile;
    const companyId = activeProfile?.company_id;
    try {
      // 2.1 Fetch regions
      const { data: regionsData } = await supabase.from("regions").select("*");
      if (regionsData && regionsData.length > 0) {
        setRegions(regionsData.map((r: any) => ({
          id: String(r.id),
          name: r.region || r.region_name || r.name || String(r.id)
        })));
      } else {
        setRegions(DEFAULT_REGIONS);
      }

      // 2.2 Fetch roles
      const { data: rolesData } = await supabase.from("roles").select("*");
      if (rolesData && rolesData.length > 0) {
        setRoles(rolesData.map((r: any) => ({
          id: String(r.id),
          name: r.role_name || r.name || String(r.id)
        })));
      } else {
        setRoles(DEFAULT_ROLES);
      }

      // 2.3 Fetch companies
      const isSuper = activeProfile?.company_name === "Meqk Foundation";
      let q = supabase.from("companies").select("*");
      if (companyId && !isSuper) {
        q = q.eq("id", companyId);
      }
      const { data: companiesData } = await q;
      if (companiesData && companiesData.length > 0) {
        const formattedCompanies = companiesData.map((c: any) => ({
          id: String(c.id),
          name: c.company_name || c.name || String(c.id)
        }));
        setCompanies(formattedCompanies);
        setCompaniesList(companiesData);
      } else {
        setCompanies([]);
        setCompaniesList([]);
      }

      // 2.4 Fetch natures
      const { data: naturesData } = await supabase.from("natures").select("*");
      if (naturesData && naturesData.length > 0) {
        setNatures(naturesData.map((n: any) => ({
          id: String(n.id),
          name: n.nature_name || n.name || n.nature || String(n.id)
        })));
      } else {
        setNatures(DEFAULT_NATURES);
      }
    } catch (err) {
      console.error("Error refreshing static Admin lookups list:", err);
      // Fallback
      setRegions(DEFAULT_REGIONS);
      setRoles(DEFAULT_ROLES);
      setNatures(DEFAULT_NATURES);
    }
  };

  // Auto-field form defaults with user's company node and keep it synchronized
  useEffect(() => {
    if (currentUserProfile?.company_id) {
      setAccountForm((prev) => ({ ...prev, company: currentUserProfile.company_id }));
      setCategoryForm((prev) => ({ ...prev, company: currentUserProfile.company_id }));
      setRouteForm((prev) => ({ ...prev, company: currentUserProfile.company_id }));
      setUserForm((prev) => ({ ...prev, company: currentUserProfile.company_id }));
    }
  }, [currentUserProfile]);

  // Switch tabs & fetch custom list data if required
  useEffect(() => {
    if (activeTab === 5) {
      loadCompanies();
    } else if (activeTab === 6) {
      loadAccounts();
    } else if (activeTab === 7) {
      loadCategories();
    } else if (activeTab === 9) {
      loadRoutes();
    } else if (activeTab === 10 || activeTab === 11) {
      loadUsers();
    }
  }, [activeTab]);

  // Companies load
  const loadCompanies = async () => {
    setIsCompaniesListLoading(true);
    try {
      const isSuper = currentUserProfile?.company_name === "Meqk Foundation";
      let q = supabase.from("companies").select("*");
      if (currentUserProfile?.company_id && !isSuper) {
        q = q.eq("id", currentUserProfile.company_id);
      }
      const { data, error } = await q.order("company_name", { ascending: true });
      if (!error && data) {
        setCompaniesList(data);
        // Sync our lookup select values showing only active companies
        setCompanies(data.filter((c: any) => c.is_active).map((c: any) => ({ id: String(c.id), name: c.company_name })));
      }
    } catch (e) {
      console.error("Error fetching companies list", e);
    } finally {
      setIsCompaniesListLoading(false);
    }
  };

  // Accounts load
  const loadAccounts = async () => {
    setIsAccountsListLoading(true);
    try {
      const isSuper = currentUserProfile?.company_name === "Meqk Foundation";
      let q = supabase.from("accounts").select("*");
      if (currentUserProfile?.company_id && !isSuper) {
        q = q.eq("company_id", currentUserProfile.company_id);
      }
      const { data, error } = await q.order("account_name", { ascending: true });
      if (!error && data) {
        setAccountsList(data);
      }
    } catch (e) {
      console.error("Error fetching accounts list", e);
    } finally {
      setIsAccountsListLoading(false);
    }
  };

  // Categories load
  const loadCategories = async () => {
    setIsCategoriesListLoading(true);
    try {
      const isSuper = currentUserProfile?.company_name === "Meqk Foundation";
      let q = supabase.from("categories").select("*");
      if (currentUserProfile?.company_id && !isSuper) {
        q = q.eq("company_id", currentUserProfile.company_id);
      }
      const { data, error } = await q.order("category_name", { ascending: true });
      if (!error && data) {
        setCategoriesList(data);
      }
    } catch (e) {
      console.error("Error fetching categories list", e);
    } finally {
      setIsCategoriesListLoading(false);
    }
  };

  // SECTION 8 & 9 & 10 & 11 LOADERS
  const loadRoutes = async () => {
    setIsRoutesListLoading(true);
    try {
      const isSuper = currentUserProfile?.company_name === "Meqk Foundation";
      let q = supabase.from("routes").select("*");
      if (currentUserProfile?.company_id && !isSuper) {
        q = q.eq("company_id", currentUserProfile.company_id);
      }
      const { data, error } = await q.order("route_name", { ascending: true });
      if (!error && data) {
        setRoutesList(data);
      }
    } catch (e) {
      console.error("Error loading routes list:", e);
    } finally {
      setIsRoutesListLoading(false);
    }
  };

  const loadUsers = async () => {
    setIsUsersListLoading(true);
    try {
      const isSuper = currentUserProfile?.company_name === "Meqk Foundation";
      let q = supabase.from("user_profiles").select("*");
      if (currentUserProfile?.company_id && !isSuper) {
        q = q.eq("company_id", currentUserProfile.company_id);
      }
      const { data, error } = await q.order("full_name", { ascending: true });
      if (!error && data) {
        setUsersList(data);
      }
    } catch (e) {
      console.error("Error loading user profiles:", e);
    } finally {
      setIsUsersListLoading(false);
    }
  };

  // SECTION 8 SAVE: Add Route Action
  const handleSaveRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    setRouteSaving(true);
    setRouteSuccess(null);
    setRouteError(null);

    if (!routeForm.route_name || !routeForm.origin || !routeForm.destination) {
      setRouteError("Route Name, Origin, and Destination are required.");
      setRouteSaving(false);
      return;
    }

    try {
      const payload: any = {
        route_name: routeForm.route_name,
        origin: routeForm.origin,
        destination: routeForm.destination,
        distance_km: parseFloat(routeForm.distance_km) || 0,
        description: routeForm.description,
        is_active: routeForm.is_active,
        company_id: routeForm.company || null
      };

      const { error } = await supabase.from("routes").insert([payload]);
      if (error) throw error;

      setRouteSuccess("Route successfully registered!");
      // Reset only after successful save
      setRouteForm({
        route_name: "",
        origin: "",
        destination: "",
        distance_km: "",
        description: "",
        company: "",
        is_active: true
      });
      loadRoutes();
    } catch (err: any) {
      console.error("Error saving route:", err);
      setRouteError(err?.message || "Failure: could not save route registry values.");
    } finally {
      setRouteSaving(false);
    }
  };

  // SECTION 9 TOGGLE & UPDATE: Toggle Route Active
  const handleToggleRouteActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("routes")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;
      setRoutesList(prev => prev.map(r => r.id === id ? { ...r, is_active: !currentStatus } : r));
    } catch (e: any) {
      console.error("Error updating route status:", e);
      alert("Error: could not change route active status.");
    }
  };

  // SECTION 9 UPDATE: Full Edit Route
  const handleUpdateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoute) return;

    try {
      const payload: any = {
        route_name: editingRoute.route_name,
        origin: editingRoute.origin,
        destination: editingRoute.destination,
        distance_km: parseFloat(editingRoute.distance_km) || 0,
        description: editingRoute.description,
        is_active: editingRoute.is_active,
        company_id: editingRoute.company || editingRoute.company_id || null
      };

      const { error } = await supabase
        .from("routes")
        .update(payload)
        .eq("id", editingRoute.id);

      if (error) throw error;

      setRoutesList(prev => prev.map(r => r.id === editingRoute.id ? { ...r, ...payload } : r));
      setEditingRoute(null);
    } catch (err: any) {
      console.error("Error updating route row:", err);
      alert("Error: could not save route changes. " + (err?.message || ""));
    }
  };

  // SECTION 10 TOGGLE & UPDATE: Toggle User Active
  const handleToggleUserActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;
      setUsersList(prev => prev.map(u => u.id === id ? { ...u, is_active: !currentStatus } : u));
    } catch (e: any) {
      console.error("Error updating user status:", e);
      alert("Error: could not change user active status.");
    }
  };

  // SECTION 10 UPDATE: Full Edit User
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const payload: any = {
        full_name: editingUser.full_name,
        role_id: editingUser.role_id || null,
        address: editingUser.address,
        phone_number: editingUser.phone_number,
        nida_number: editingUser.nida_number,
        company_id: editingUser.company || editingUser.company_id || null,
        is_active: editingUser.is_active
      };

      if ('email' in editingUser || !('user_email' in editingUser || 'auth_email' in editingUser)) {
        payload.email = editingUser.email || editingUser.user_email || editingUser.auth_email || null;
      } else if ('user_email' in editingUser) {
        payload.user_email = editingUser.user_email || editingUser.email || editingUser.auth_email || null;
      } else if ('auth_email' in editingUser) {
        payload.auth_email = editingUser.auth_email || editingUser.email || editingUser.user_email || null;
      }

      const { error } = await supabase
        .from("user_profiles")
        .update(payload)
        .eq("id", editingUser.id);

      if (error) throw error;

      setUsersList(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...payload } : u));
      setEditingUser(null);
    } catch (err: any) {
      console.error("Error updating user profile:", err);
      alert("Error: could not update user profile. " + (err?.message || ""));
    }
  };

  // SECTION 11 WORKFLOW: Send Password Reset Link
  const handleSendPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetPasswordSuccess(null);
    setResetPasswordError(null);

    if (!resetPasswordSelectedUser) {
      setResetPasswordError("Please select a target user first.");
      return;
    }

    const targetUser = usersList.find(u => u.id === resetPasswordSelectedUser);
    if (!targetUser) {
      setResetPasswordError("Target user not found.");
      return;
    }

    const userEmail = targetUser.email || targetUser.user_email || targetUser.auth_email;
    if (!userEmail) {
      setResetPasswordError("This user has no email saved. Please update user profile with email first.");
      return;
    }

    setIsResettingPassword(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
        redirectTo: window.location.origin + "/reset-password"
      });
      if (error) throw error;

      setResetPasswordSuccess(`Password reset email successfully dispatched to mailbox ${userEmail}!`);
    } catch (err: any) {
      console.error("Error resetting password:", err);
      setResetPasswordError(err?.message || "Failed to trigger the email password reset workflow.");
    } finally {
      setIsResettingPassword(false);
    }
  };

  // SECTION 1 SAVE: Register Company
  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setCompanySaving(true);
    setCompanySuccess(null);
    setCompanyError(null);

    if (!companyForm.company_name) {
      setCompanyError("Company Name is required.");
      setCompanySaving(false);
      return;
    }

    try {
      // Setup flexible schema payload
      const payload: any = {
        company_name: companyForm.company_name,
        legal_name: companyForm.legal_name || companyForm.company_name,
        tin: companyForm.tin,
        vrn: companyForm.vrn,
        email: companyForm.email,
        phone: companyForm.phone,
        address: companyForm.address,
        city: companyForm.city, // save selected region.id as string city
        city_id: companyForm.city, // also save to city_id if exists as FK
        country: companyForm.country,
        is_active: companyForm.is_active
      };

      const { error } = await supabase.from("companies").insert([payload]);
      if (error) throw error;

      setCompanySuccess("Company registered successfully!");
      // Reset form variables
      setCompanyForm({
        company_name: "",
        legal_name: "",
        tin: "",
        vrn: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        country: "Tanzania",
        is_active: true
      });
      // Refresh lookups to expose new company inside lookup matrices
      refreshAllLookups();
    } catch (err: any) {
      console.error("Error saving company", err);
      setCompanyError(err?.message || "Failure: could not save company registry values.");
    } finally {
      setCompanySaving(false);
    }
  };

  // SECTION 2 SAVE: Register User Profile (Onboarding Flow with Auth creation)
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserSaving(true);
    setUserSuccess(null);
    setUserError(null);

    if (!userForm.email || !userForm.password || !userForm.full_name) {
      setUserError("Email, Password and Full Name are required.");
      setUserSaving(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: userForm.email,
          password: userForm.password,
          full_name: userForm.full_name,
          role_id: userForm.role_id || null,
          company: userForm.company || null,
          address: userForm.address,
          phone_number: userForm.phone_number,
          nida_number: userForm.nida_number,
          is_active: userForm.is_active
        })
      });

      const resData = await response.json();

      if (!response.ok) {
        throw new Error(resData.error || "Gateway response failed during server-side administrative account creation.");
      }

      setUserSuccess("Staff authentication security record with profile created successfully!");
      setUserForm({
        email: "",
        password: "",
        full_name: "",
        role_id: "",
        address: "",
        phone_number: "",
        nida_number: "",
        company: currentUserProfile?.company_id || "",
        is_active: true
      });
      loadUsers();
    } catch (err: any) {
      console.error("Error saving user profile & authenticating", err);
      setUserError(err?.message || "Failure: could not handle onboarding routing.");
    } finally {
      setUserSaving(false);
    }
  };

  // SECTION 3 SAVE: Add Account
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountSaving(true);
    setAccountSuccess(null);
    setAccountError(null);

    if (!accountForm.account_name || !accountForm.account_code) {
      setAccountError("Account Name and Account Code are required.");
      setAccountSaving(false);
      return;
    }

    try {
      const payload: any = {
        account_name: accountForm.account_name,
        account_code: accountForm.account_code,
        nature_id: accountForm.nature || null, // save to nature_id if FK
        description: accountForm.description,
        is_active: accountForm.is_active,
        company_id: accountForm.company || null // save company.id as company_id FK
      };

      const { error } = await supabase.from("accounts").insert([payload]);
      if (error) throw error;

      setAccountSuccess("New Account Ledger registered successfully!");
      setAccountForm({
        account_name: "",
        nature: "",
        account_code: "",
        description: "",
        is_active: true,
        company: ""
      });
    } catch (err: any) {
      console.error("Error creating account", err);
      setAccountError(err?.message || "Failure: could not save the account record.");
    } finally {
      setAccountSaving(false);
    }
  };

  // SECTION 4 SAVE: Add Category
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCategorySaving(true);
    setCategorySuccess(null);
    setCategoryError(null);

    if (!categoryForm.category_name || !categoryForm.category_code) {
      setCategoryError("Category Name and Category Code are required.");
      setCategorySaving(false);
      return;
    }

    try {
      const payload: any = {
        category_name: categoryForm.category_name,
        category_code: categoryForm.category_code,
        nature_id: categoryForm.nature || null,
        description: categoryForm.description,
        company_id: categoryForm.company || null,
        is_active: categoryForm.is_active
      };

      const { error } = await supabase.from("categories").insert([payload]);
      if (error) throw error;

      setCategorySuccess("New Category item successfully integrated!");
      setCategoryForm({
        category_name: "",
        category_code: "",
        nature: "",
        description: "",
        company: "",
        is_active: true
      });
    } catch (err: any) {
      console.error("Error creating category", err);
      setCategoryError(err?.message || "Failure: could not register the Category record.");
    } finally {
      setCategorySaving(false);
    }
  };

  // TOGGLE STATUS FOR SECTION 5: Toggle Company Active
  const handleToggleCompanyActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("companies")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;
      // Local updates for instantaneous UI feedback
      setCompaniesList(prev => prev.map(c => c.id === id ? { ...c, is_active: !currentStatus } : c));
    } catch (e: any) {
      console.error("Error updating company status", e);
      alert("Error: could not change company active status. " + (e?.message || ""));
    }
  };

  // TOGGLE STATUS FOR SECTION 6: Toggle Account Active
  const handleToggleAccountActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("accounts")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;
      setAccountsList(prev => prev.map(a => a.id === id ? { ...a, is_active: !currentStatus } : a));
    } catch (e: any) {
      console.error("Error updating account status", e);
      alert("Error: could not update account active state.");
    }
  };

  // TOGGLE STATUS FOR SECTION 7: Toggle Category Active
  const handleToggleCategoryActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("categories")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;
      setCategoriesList(prev => prev.map(c => c.id === id ? { ...c, is_active: !currentStatus } : c));
    } catch (e: any) {
      console.error("Error updating category status", e);
      alert("Error: could not update category active state.");
    }
  };

  // Filtered lists logic
  const filteredCompanies = companiesList.filter(c => {
    const val = companySearch.toLowerCase();
    return (
      (c.company_name && c.company_name.toLowerCase().includes(val)) ||
      (c.legal_name && c.legal_name.toLowerCase().includes(val)) ||
      (c.tin && c.tin.toLowerCase().includes(val)) ||
      (c.phone && c.phone.toLowerCase().includes(val)) ||
      (c.email && c.email.toLowerCase().includes(val))
    );
  });

  const filteredAccounts = accountsList.filter(a => {
    const val = accountSearch.toLowerCase();
    const resolvedComp = companies.find(c => c.id === String(a.company_id || a.company))?.name || "";
    return (
      (a.account_name && a.account_name.toLowerCase().includes(val)) ||
      (a.account_code && a.account_code.toLowerCase().includes(val)) ||
      resolvedComp.toLowerCase().includes(val)
    );
  });

  const filteredCategories = categoriesList.filter(c => {
    const val = categorySearch.toLowerCase();
    const resolvedComp = companies.find(comp => comp.id === String(c.company_id || c.company))?.name || "";
    return (
      (c.category_name && c.category_name.toLowerCase().includes(val)) ||
      (c.category_code && c.category_code.toLowerCase().includes(val)) ||
      resolvedComp.toLowerCase().includes(val)
    );
  });

  // Load username or default values safely
  const userName = currentUserProfile?.full_name || "Executive Admin";

  return (
    <div className="relative min-h-screen w-full overflow-hidden text-neutral-200 font-sans flex flex-col">
      {/* Isolated background layer */}
      <div className="absolute inset-0 pointer-events-none -z-0 setup-animated-bg overflow-hidden">
        {/* Background executive amber glows */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-amber-500/14 blur-[130px] rounded-full pointer-events-none animate-float-1"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-yellow-500/12 blur-[140px] rounded-full pointer-events-none animate-float-2"></div>
        <div className="absolute top-[30%] left-[25%] w-[40%] h-[40%] bg-amber-600/11 blur-[165px] rounded-full pointer-events-none animate-pulse"></div>
      </div>

      {/* Static Content layer scroll container */}
      <div className="relative z-10 flex-1 flex flex-col overflow-y-auto custom-scrollbar pb-8 overflow-x-hidden">
        
        {/* Top Header Grid: welcome matching instructions */}
        <header className="w-full max-w-7xl mx-auto px-4 md:px-6 py-6 border-b border-amber-500/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 z-10">
        
        {/* welcome metadata credentials */}
        <div className="space-y-1">
          <span className="text-[10px] font-mono tracking-[0.25em] text-amber-500 uppercase font-bold flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
            <span>Setup Module // System Admin control</span>
          </span>
          <h1 className="text-xl font-serif font-semibold text-white tracking-wide">
            Welcome, <span className="shimmer-text text-amber-300 font-bold">{userName}</span>
          </h1>
          <p className="text-xs text-neutral-400 font-mono tracking-wide">
            Meqk Foundation
          </p>
        </div>

        {/* Back navigation button */}
        <button
          onClick={() => navigate("/modules")}
          className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-xs font-mono font-bold uppercase tracking-wider text-amber-400 border border-amber-500/25 hover:border-amber-500/50 rounded-xl transition-all duration-300 flex items-center gap-2 cursor-pointer shadow-md"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Modules</span>
        </button>
      </header>

      {/* MAIN LAYOUT (Full horizontal options panel menu) */}
      <main className="w-full max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-8 z-10 flex-grow">
        
        {/* PREMIUM HORIZONTAL NAVIGATION MENUS */}
        <div className="relative overflow-visible z-30">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pb-3">
            
            {/* Tab items registration */}
            {[
              { id: 1, name: "Company Registration", icon: Building2 },
              { id: 2, name: "User Registration", icon: UserPlus },
              { id: 3, name: "Add Account", icon: PlusCircle },
              { id: 4, name: "Add Category", icon: FolderPlus },
              { id: 5, name: "Companies List", icon: List },
              { id: 6, name: "Account List", icon: BookOpen },
              { id: 7, name: "Category List", icon: Tag },
              { id: 8, name: "Add Route", icon: Compass },
              { id: 9, name: "Routes List", icon: MapPin },
              { id: 10, name: "User List", icon: Users },
              { id: 11, name: "Reset Password", icon: KeyRound }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full px-3.5 py-3 border rounded-xl flex items-center gap-2.5 transition-all duration-300 cursor-pointer h-12 shadow-sm ${
                    isActive 
                      ? "bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/30" 
                      : "bg-[#2a231d]/40 border-white/5 text-neutral-400 hover:text-neutral-200 hover:bg-[#2a231d]/60 hover:border-white/10"
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? "text-amber-400" : "text-neutral-500"}`} />
                  <span className="text-[10px] md:text-xs font-semibold uppercase tracking-wider truncate leading-none">
                    {tab.name}
                  </span>
                </button>
              );
            })}

          </div>
        </div>

        {/* LOADING INDICATOR ON INITIATING LOOKUPS */}
        {isLookupsLoading ? (
          <div className="py-24 text-center flex flex-col items-center justify-center min-h-[300px]">
            <Loader2 className="h-8 w-8 text-amber-500 animate-spin mb-4" />
            <span className="font-mono text-xs text-amber-500/70 tracking-widest">LOADING TELEMETRY AND DATABASE DICTIONARIES...</span>
          </div>
        ) : (
          <div className="w-full relative overflow-visible">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="w-full relative overflow-visible"
              >
                
                {/* SECTION 1: Company Registration */}
                {activeTab === 1 && (
                  <div className="max-w-2xl mx-auto overflow-visible relative">
                    <div className="rounded-2xl border border-amber-500/15 bg-zinc-900/40 backdrop-blur-xl p-6 md:p-8 shadow-2xl relative overflow-visible">
                      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/30 to-transparent"></div>
                      
                      <div className="flex items-center gap-3.5 pb-4 border-b border-white/5 mb-6">
                        <div className="h-10 w-10 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center text-amber-400 shadow-md">
                          <Building2 className="h-5.5 w-5.5" />
                        </div>
                        <div>
                          <h2 className="text-base font-serif font-bold text-white tracking-wide">Register New Company</h2>
                          <p className="text-[11px] text-neutral-400">Establish a corporate node in the multi-agency network directories.</p>
                        </div>
                      </div>

                      <form onSubmit={handleSaveCompany} className="grid grid-cols-1 md:grid-cols-2 gap-5 overflow-visible">
                        
                        <div className="md:col-span-2">
                          <label className="block text-[11px] font-mono uppercase tracking-wider text-amber-500/80 mb-1.5">Company Name *</label>
                          <input 
                            type="text"
                            required
                            value={companyForm.company_name}
                            onChange={(e) => setCompanyForm({...companyForm, company_name: e.target.value})}
                            placeholder="Meqk Corporation Limited"
                            className="w-full bg-neutral-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50 h-10 transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-mono uppercase tracking-wider text-amber-500/80 mb-1.5">Legal Registry Name</label>
                          <input 
                            type="text"
                            value={companyForm.legal_name}
                            onChange={(e) => setCompanyForm({...companyForm, legal_name: e.target.value})}
                            placeholder="Legal Registry Entity Name"
                            className="w-full bg-neutral-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50 h-10 transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-mono uppercase tracking-wider text-amber-500/80 mb-1.5">TIN (Tax ID Number)</label>
                          <input 
                            type="text"
                            value={companyForm.tin}
                            onChange={(e) => setCompanyForm({...companyForm, tin: e.target.value})}
                            placeholder="TIN Record ID"
                            className="w-full bg-neutral-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50 h-10 transition-colors font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-mono uppercase tracking-wider text-amber-500/80 mb-1.5">VRN (Value Added Tax)</label>
                          <input 
                            type="text"
                            value={companyForm.vrn}
                            onChange={(e) => setCompanyForm({...companyForm, vrn: e.target.value})}
                            placeholder="VRN Identification"
                            className="w-full bg-neutral-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50 h-10 transition-colors font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-mono uppercase tracking-wider text-amber-500/80 mb-1.5">E-mail Address</label>
                          <input 
                            type="email"
                            value={companyForm.email}
                            onChange={(e) => setCompanyForm({...companyForm, email: e.target.value})}
                            placeholder="contact@company.com"
                            className="w-full bg-neutral-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50 h-10 transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-mono uppercase tracking-wider text-amber-500/80 mb-1.5">Phone Number</label>
                          <input 
                            type="text"
                            value={companyForm.phone}
                            onChange={(e) => setCompanyForm({...companyForm, phone: e.target.value})}
                            placeholder="+255..."
                            className="w-full bg-neutral-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50 h-10 transition-colors font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-mono uppercase tracking-wider text-amber-500/80 mb-1.5">Postal Address</label>
                          <input 
                            type="text"
                            value={companyForm.address}
                            onChange={(e) => setCompanyForm({...companyForm, address: e.target.value})}
                            placeholder="Street, Block Office Location"
                            className="w-full bg-neutral-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50 h-10 transition-colors"
                          />
                        </div>

                        {/* Searchabledropdown for City based on regions lookup */}
                        <div className="overflow-visible">
                          <SearchableDropdown 
                            label="Target Region/City"
                            placeholder="Select active City/Region..."
                            options={regions}
                            selectedValue={companyForm.city}
                            onChange={(val) => setCompanyForm({...companyForm, city: val})}
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-mono uppercase tracking-wider text-amber-500/80 mb-1.5">Country</label>
                          <input 
                            type="text"
                            value={companyForm.country}
                            onChange={(e) => setCompanyForm({...companyForm, country: e.target.value})}
                            className="w-full bg-neutral-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50 h-10 transition-colors"
                          />
                        </div>

                        <div className="md:col-span-2 bg-[#2a221a]/20 border border-white/5 rounded-xl p-4 flex items-center justify-between">
                          <div>
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider leading-none">Node Activation</h4>
                            <p className="text-[10px] text-neutral-400 mt-1">Deactivate to temporarily lock corporate financial assignments.</p>
                          </div>
                          <select
                            value={companyForm.is_active ? "yes" : "no"}
                            onChange={(e) => setCompanyForm({...companyForm, is_active: e.target.value === "yes"})}
                            className="bg-neutral-950 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-amber-400 font-mono focus:outline-none h-9 cursor-pointer"
                          >
                            <option value="yes">Active</option>
                            <option value="no">Inactive</option>
                          </select>
                        </div>

                        <div className="md:col-span-2 pt-3">
                          <button
                            type="submit"
                            disabled={companySaving}
                            className="w-full py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-[#0c0c0c] font-bold text-xs uppercase tracking-widest rounded-xl transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                          >
                            {companySaving ? (
                              <Loader2 className="h-4 w-4 animate-spin text-[#0c0c0c]" />
                            ) : (
                              <Building2 className="h-4 w-4" />
                            )}
                            <span>SAVE COMPANY REGISTRY</span>
                          </button>
                        </div>

                      </form>

                      {/* Success / Error States */}
                      {companySuccess && (
                        <div className="mt-5 p-3.5 bg-emerald-500/10 border border-emerald-500/35 rounded-xl flex items-center gap-2.5 text-xs text-emerald-400">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                          <span>{companySuccess}</span>
                        </div>
                      )}
                      {companyError && (
                        <div className="mt-5 p-3.5 bg-rose-500/10 border border-rose-500/35 rounded-xl flex items-center gap-2.5 text-xs text-rose-400">
                          <AlertTriangle className="h-4 w-4 text-rose-450 shrink-0" />
                          <span>{companyError}</span>
                        </div>
                      )}

                    </div>
                  </div>
                )}

                {/* SECTION 2: User Registration */}
                {activeTab === 2 && (
                  <div className="max-w-2xl mx-auto overflow-viewing relative">
                    <div className="rounded-2xl border border-amber-500/15 bg-zinc-900/40 backdrop-blur-xl p-6 md:p-8 shadow-2xl relative overflow-visible">
                      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/30 to-transparent"></div>

                      <div className="flex items-center gap-3.5 pb-4 border-b border-white/5 mb-6">
                        <div className="h-10 w-10 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center text-amber-400 shadow-md">
                          <UserPlus className="h-5.5 w-5.5" />
                        </div>
                        <div>
                          <h2 className="text-base font-serif font-bold text-white tracking-wide">Register User Account Profile</h2>
                          <p className="text-[11px] text-neutral-400">Register administrative identifiers and profiles into regional directory sheets.</p>
                        </div>
                      </div>

                      <form onSubmit={handleSaveUser} className="grid grid-cols-1 md:grid-cols-2 gap-5 overflow-visible">
                        
                        <div className="md:col-span-2">
                          <label className="block text-[11px] font-mono uppercase tracking-wider text-amber-500/80 mb-1.5">Full Name *</label>
                          <input 
                            type="text"
                            required
                            value={userForm.full_name}
                            onChange={(e) => setUserForm({...userForm, full_name: e.target.value})}
                            placeholder="Michael John"
                            className="w-full bg-neutral-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50 h-10 transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-mono uppercase tracking-wider text-amber-500/80 mb-1.5">Institutional Email Address *</label>
                          <input 
                            type="email"
                            required
                            value={userForm.email}
                            onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                            placeholder="michael@company.com"
                            className="w-full bg-neutral-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50 h-10 transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-mono uppercase tracking-wider text-amber-500/80 mb-1.5">Security Password *</label>
                          <input 
                            type="password"
                            required
                            value={userForm.password}
                            onChange={(e) => setUserForm({...userForm, password: e.target.value})}
                            placeholder="••••••••"
                            className="w-full bg-neutral-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50 h-10 transition-colors font-mono"
                          />
                        </div>

                        {/* Searchable role dropdown */}
                        <div className="overflow-visible">
                          <SearchableDropdown 
                            label="Security Role Profile"
                            placeholder="Select security Role..."
                            options={roles}
                            selectedValue={userForm.role_id}
                            onChange={(val) => setUserForm({...userForm, role_id: val})}
                            required
                          />
                        </div>

                        {/* Searchable company dropdown */}
                        <div className="overflow-visible">
                          <SearchableDropdown 
                            label="Affiliated Company Node"
                            placeholder="Select affiliated Company..."
                            options={companies}
                            selectedValue={userForm.company}
                            onChange={(val) => setUserForm({...userForm, company: val})}
                            required
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-[11px] font-mono uppercase tracking-wider text-amber-500/80 mb-1.5">Residential Street Address</label>
                          <input 
                            type="text"
                            value={userForm.address}
                            onChange={(e) => setUserForm({...userForm, address: e.target.value})}
                            placeholder="Dar es Salaam, Masaki Block 5..."
                            className="w-full bg-neutral-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50 h-10 transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-mono uppercase tracking-wider text-amber-500/80 mb-1.5">Direct Phone Line</label>
                          <input 
                            type="text"
                            value={userForm.phone_number}
                            onChange={(e) => setUserForm({...userForm, phone_number: e.target.value})}
                            placeholder="+255..."
                            className="w-full bg-neutral-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50 h-10 transition-colors font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-mono uppercase tracking-wider text-amber-500/80 mb-1.5">NIDA Identification Number</label>
                          <input 
                            type="text"
                            value={userForm.nida_number}
                            onChange={(e) => setUserForm({...userForm, nida_number: e.target.value})}
                            placeholder="NIDA Registry digit values"
                            className="w-full bg-neutral-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50 h-10 transition-colors font-mono"
                          />
                        </div>

                        <div className="md:col-span-2 bg-[#2a221a]/20 border border-white/5 rounded-xl p-4 flex items-center justify-between">
                          <div>
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider leading-none">Profile Status</h4>
                            <p className="text-[10px] text-neutral-400 mt-1">Locking profile terminates secure transaction entry authorization.</p>
                          </div>
                          <select
                            value={userForm.is_active ? "yes" : "no"}
                            onChange={(e) => setUserForm({...userForm, is_active: e.target.value === "yes"})}
                            className="bg-neutral-950 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-amber-400 font-mono focus:outline-none h-9 cursor-pointer"
                          >
                            <option value="yes">Active</option>
                            <option value="no">Suspended</option>
                          </select>
                        </div>

                        <div className="md:col-span-2 pt-3">
                          <button
                            type="submit"
                            disabled={userSaving}
                            className="w-full py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-[#0c0c0c] font-bold text-xs uppercase tracking-widest rounded-xl transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                          >
                            {userSaving ? (
                              <Loader2 className="h-4 w-4 animate-spin text-[#0c0c0c]" />
                            ) : (
                              <UserPlus className="h-4 w-4" />
                            )}
                            <span>REGISTER ACCOUNT PROFILE</span>
                          </button>
                        </div>

                      </form>

                      {/* Alerts */}
                      {userSuccess && (
                        <div className="mt-5 p-3.5 bg-emerald-500/10 border border-emerald-500/35 rounded-xl flex items-center gap-2.5 text-xs text-emerald-400">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                          <span>{userSuccess}</span>
                        </div>
                      )}
                      {userError && (
                        <div className="mt-5 p-3.5 bg-rose-500/10 border border-rose-500/35 rounded-xl flex items-center gap-2.5 text-xs text-rose-400">
                          <AlertTriangle className="h-4 w-4 text-rose-450 shrink-0" />
                          <span>{userError}</span>
                        </div>
                      )}

                    </div>
                  </div>
                )}

                {/* SECTION 3: Add Account */}
                {activeTab === 3 && (
                  <div className="max-w-2xl mx-auto overflow-visible relative">
                    <div className="rounded-2xl border border-amber-500/15 bg-zinc-900/40 backdrop-blur-xl p-6 md:p-8 shadow-2xl relative overflow-visible">
                      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/30 to-transparent"></div>

                      <div className="flex items-center gap-3.5 pb-4 border-b border-white/5 mb-6">
                        <div className="h-10 w-10 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center text-amber-400 shadow-md">
                          <PlusCircle className="h-5.5 w-5.5" />
                        </div>
                        <div>
                          <h2 className="text-base font-serif font-bold text-white tracking-wide">Add Financial Ledger Account</h2>
                          <p className="text-[11px] text-neutral-400">Create double-entry ledger accounts with specified analytical nature constraints.</p>
                        </div>
                      </div>

                      <form onSubmit={handleSaveAccount} className="grid grid-cols-1 md:grid-cols-2 gap-5 overflow-visible">
                        
                        <div>
                          <label className="block text-[11px] font-mono uppercase tracking-wider text-amber-500/80 mb-1.5">Account Code *</label>
                          <input 
                            type="text"
                            required
                            value={accountForm.account_code}
                            onChange={(e) => setAccountForm({...accountForm, account_code: e.target.value})}
                            placeholder="e.g. 1010, 4050, ACC-115"
                            className="w-full bg-neutral-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50 h-10 transition-colors font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-mono uppercase tracking-wider text-amber-500/80 mb-1.5">Account Name *</label>
                          <input 
                            type="text"
                            required
                            value={accountForm.account_name}
                            onChange={(e) => setAccountForm({...accountForm, account_name: e.target.value})}
                            placeholder="e.g. Main Cash Vault Account"
                            className="w-full bg-neutral-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50 h-10 transition-colors"
                          />
                        </div>

                        {/* Searchable Nature select */}
                        <div className="overflow-visible">
                          <SearchableDropdown 
                            label="Account Nature Category"
                            placeholder="Select Nature constraint..."
                            options={natures}
                            selectedValue={accountForm.nature}
                            onChange={(val) => setAccountForm({...accountForm, nature: val})}
                            required
                          />
                        </div>

                        {/* Searchable Company select */}
                        <div className="overflow-visible">
                          <SearchableDropdown 
                            label="Assign to Company"
                            placeholder="Select Company host..."
                            options={companies}
                            selectedValue={accountForm.company}
                            onChange={(val) => setAccountForm({...accountForm, company: val})}
                            required
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-[11px] font-mono uppercase tracking-wider text-amber-500/80 mb-1.5">Description details</label>
                          <textarea 
                            value={accountForm.description}
                            onChange={(e) => setAccountForm({...accountForm, description: e.target.value})}
                            placeholder="Enter accounting nature notes or ledger operational targets..."
                            className="w-full bg-neutral-950/60 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500/50 h-20 transition-colors resize-none"
                          />
                        </div>

                        <div className="md:col-span-2 bg-[#2a221a]/20 border border-white/5 rounded-xl p-4 flex items-center justify-between">
                          <div>
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider leading-none">Ledger active status</h4>
                            <p className="text-[10px] text-neutral-400 mt-1">If inactive, Posting to ledger blocks will trigger automated alerts.</p>
                          </div>
                          <select
                            value={accountForm.is_active ? "yes" : "no"}
                            onChange={(e) => setAccountForm({...accountForm, is_active: e.target.value === "yes"})}
                            className="bg-neutral-950 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-amber-400 font-mono focus:outline-none h-9 cursor-pointer"
                          >
                            <option value="yes">Active</option>
                            <option value="no">Inactive</option>
                          </select>
                        </div>

                        <div className="md:col-span-2 pt-3">
                          <button
                            type="submit"
                            disabled={accountSaving}
                            className="w-full py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-[#0c0c0c] font-bold text-xs uppercase tracking-widest rounded-xl transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                          >
                            {accountSaving ? (
                              <Loader2 className="h-4 w-4 animate-spin text-[#0c0c0c]" />
                            ) : (
                              <PlusCircle className="h-4 w-4" />
                            )}
                            <span>REGISTER LEDGER ACCOUNT</span>
                          </button>
                        </div>

                      </form>

                      {accountSuccess && (
                        <div className="mt-5 p-3.5 bg-emerald-500/10 border border-emerald-500/35 rounded-xl flex items-center gap-2.5 text-xs text-emerald-400">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                          <span>{accountSuccess}</span>
                        </div>
                      )}
                      {accountError && (
                        <div className="mt-5 p-3.5 bg-rose-500/10 border border-rose-500/35 rounded-xl flex items-center gap-2.5 text-xs text-rose-400">
                          <AlertTriangle className="h-4 w-4 text-rose-455 shrink-0" />
                          <span>{accountError}</span>
                        </div>
                      )}

                    </div>
                  </div>
                )}

                {/* SECTION 4: Add Category */}
                {activeTab === 4 && (
                  <div className="max-w-2xl mx-auto overflow-visible relative">
                    <div className="rounded-2xl border border-amber-500/15 bg-zinc-900/40 backdrop-blur-xl p-6 md:p-8 shadow-2xl relative overflow-visible">
                      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/30 to-transparent"></div>

                      <div className="flex items-center gap-3.5 pb-4 border-b border-white/5 mb-6">
                        <div className="h-10 w-10 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center text-amber-400 shadow-md">
                          <FolderPlus className="h-5.5 w-5.5" />
                        </div>
                        <div>
                          <h2 className="text-base font-serif font-bold text-white tracking-wide">Add Analytics Category</h2>
                          <p className="text-[11px] text-neutral-400">Define classification categories to filter operational transit streams and ledgers.</p>
                        </div>
                      </div>

                      <form onSubmit={handleSaveCategory} className="grid grid-cols-1 md:grid-cols-2 gap-5 overflow-visible">
                        
                        <div>
                          <label className="block text-[11px] font-mono uppercase tracking-wider text-amber-500/80 mb-1.5">Category Code *</label>
                          <input 
                            type="text"
                            required
                            value={categoryForm.category_code}
                            onChange={(e) => setCategoryForm({...categoryForm, category_code: e.target.value})}
                            placeholder="e.g. CAT-50, REF-INC"
                            className="w-full bg-neutral-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50 h-10 transition-colors font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-mono uppercase tracking-wider text-amber-500/80 mb-1.5">Category Name *</label>
                          <input 
                            type="text"
                            required
                            value={categoryForm.category_name}
                            onChange={(e) => setCategoryForm({...categoryForm, category_name: e.target.value})}
                            placeholder="e.g. Fleet Fuel Procurement"
                            className="w-full bg-neutral-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50 h-10 transition-colors"
                          />
                        </div>

                        {/* Searchable Nature dropdown */}
                        <div className="overflow-visible">
                          <SearchableDropdown 
                            label="Associated Nature Type"
                            placeholder="Select Nature layout..."
                            options={natures}
                            selectedValue={categoryForm.nature}
                            onChange={(val) => setCategoryForm({...categoryForm, nature: val})}
                            required
                          />
                        </div>

                        {/* Searchable Company dropdown */}
                        <div className="overflow-visible">
                          <SearchableDropdown 
                            label="Affiliated Company Node"
                            placeholder="Select Company node..."
                            options={companies}
                            selectedValue={categoryForm.company}
                            onChange={(val) => setCategoryForm({...categoryForm, company: val})}
                            required
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-[11px] font-mono uppercase tracking-wider text-amber-500/80 mb-1.5">Operational Details</label>
                          <textarea 
                            value={categoryForm.description}
                            onChange={(e) => setCategoryForm({...categoryForm, description: e.target.value})}
                            placeholder="Specify categorizations details..."
                            className="w-full bg-neutral-950/60 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500/50 h-20 transition-colors resize-none"
                          />
                        </div>

                        <div className="md:col-span-2 bg-[#2a221a]/20 border border-white/5 rounded-xl p-4 flex items-center justify-between">
                          <div>
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider leading-none">Categorization activation</h4>
                            <p className="text-[10px] text-neutral-400 mt-1">Inactive categories will be omitted from manual dropdown selections.</p>
                          </div>
                          <select
                            value={categoryForm.is_active ? "yes" : "no"}
                            onChange={(e) => setCategoryForm({...categoryForm, is_active: e.target.value === "yes"})}
                            className="bg-neutral-950 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-amber-400 font-mono focus:outline-none h-9 cursor-pointer"
                          >
                            <option value="yes">Active</option>
                            <option value="no">Suspended</option>
                          </select>
                        </div>

                        <div className="md:col-span-2 pt-3">
                          <button
                            type="submit"
                            disabled={categorySaving}
                            className="w-full py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-[#0c0c0c] font-bold text-xs uppercase tracking-widest rounded-xl transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                          >
                            {categorySaving ? (
                              <Loader2 className="h-4 w-4 animate-spin text-[#0c0c0c]" />
                            ) : (
                              <FolderPlus className="h-4 w-4" />
                            )}
                            <span>SAVE SYSTEM CATEGORY</span>
                          </button>
                        </div>

                      </form>

                      {categorySuccess && (
                        <div className="mt-5 p-3.5 bg-emerald-500/10 border border-emerald-500/35 rounded-xl flex items-center gap-2.5 text-xs text-emerald-400">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                          <span>{categorySuccess}</span>
                        </div>
                      )}
                      {categoryError && (
                        <div className="mt-5 p-3.5 bg-rose-500/10 border border-rose-500/35 rounded-xl flex items-center gap-2.5 text-xs text-rose-400">
                          <AlertTriangle className="h-4 w-4 text-rose-455 shrink-0" />
                          <span>{categoryError}</span>
                        </div>
                      )}

                    </div>
                  </div>
                )}

                {/* SECTION 5: Companies management List */}
                {activeTab === 5 && (
                  <div className="w-full">
                    <div className="rounded-2xl border border-amber-500/15 bg-zinc-900/40 backdrop-blur-xl p-5 md:p-6 shadow-2xl relative">
                      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/35 to-transparent"></div>
                      
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4 mb-5">
                        <div>
                          <h2 className="text-base font-serif font-bold text-white tracking-wide flex items-center gap-2">
                            <List className="h-5 w-5 text-amber-400" />
                            <span>Registered Companies Node Directory</span>
                          </h2>
                          <p className="text-[11px] text-neutral-400 mt-1">Review active and inactive companies, and control active status states.</p>
                        </div>
                        
                        {/* Compact Search */}
                        <div className="relative w-full md:w-64">
                          <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
                          <input 
                            type="text"
                            placeholder="Search by name, legal or TIN..."
                            value={companySearch}
                            onChange={(e) => setCompanySearch(e.target.value)}
                            className="w-full bg-neutral-950/60 border border-white/10 rounded-xl py-1.5 pl-9 pr-4 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/50 font-mono h-9"
                          />
                        </div>
                      </div>

                      {/* Companies Table wrapper */}
                      {isCompaniesListLoading ? (
                        <div className="py-16 text-center flex flex-col items-center justify-center">
                          <Loader2 className="h-6 w-6 text-amber-500 animate-spin mb-3" />
                          <span className="font-mono text-[10px] tracking-widest text-amber-500/60">COLLECTING COMPANIES...</span>
                        </div>
                      ) : filteredCompanies.length === 0 ? (
                        <div className="py-16 text-center border border-white/5 bg-neutral-950/10 rounded-xl font-mono text-xs text-neutral-500 italic">
                          No matching records registered within the corporate registry sheet.
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-white/5 bg-neutral-950/20 custom-scrollbar">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-white/10 bg-neutral-900/40 text-[10px] font-mono uppercase tracking-wider text-amber-400">
                                <th className="py-2.5 px-4">Company Name</th>
                                <th className="py-2.5 px-4">Legal Registration Name</th>
                                <th className="py-2.5 px-3">TIN</th>
                                <th className="py-2.5 px-3">VRN</th>
                                <th className="py-2.5 px-4">Email</th>
                                <th className="py-2.5 px-3">Phone</th>
                                <th className="py-2.5 px-4">Address / City</th>
                                <th className="py-2.5 px-3 text-center">Status</th>
                                <th className="py-2.5 px-4 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-[11.5px] font-light">
                              {filteredCompanies.map((c) => {
                                // Resolve city/region name
                                const resolvedCityName = regions.find(r => r.id === String(c.city_id || c.city || ''))?.name || c.city || "Tanzania";
                                return (
                                  <tr key={c.id} className="hover:bg-white/2 transition-colors">
                                    <td className="py-3 px-4 text-white font-semibold truncate max-w-[150px]">{c.company_name}</td>
                                    <td className="py-3 px-4 text-neutral-300 font-light truncate max-w-[150px]">{c.legal_name || "N/A"}</td>
                                    <td className="py-3 px-3 font-mono text-neutral-400">{c.tin || "—"}</td>
                                    <td className="py-3 px-3 font-mono text-neutral-400">{c.vrn || "—"}</td>
                                    <td className="py-3 px-4 text-neutral-300">{c.email || "—"}</td>
                                    <td className="py-3 px-3 font-mono text-neutral-450">{c.phone || "—"}</td>
                                    <td className="py-3 px-4 text-neutral-300">
                                      {c.address ? `${c.address}, ` : ""} <span className="font-mono text-amber-500/80 uppercase text-[10px]">{resolvedCityName}</span>
                                    </td>
                                    <td className="py-3 px-3 text-center">
                                      <span className={`px-2 py-0.5 rounded-full font-mono text-[9px] uppercase font-semibold leading-none ${
                                        c.is_active 
                                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                                          : "bg-red-500/10 text-red-400 border border-red-500/20"
                                      }`}>
                                        {c.is_active ? "Active" : "Inactive"}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 text-right overflow-visible">
                                      <button
                                        onClick={() => handleToggleCompanyActive(c.id, c.is_active)}
                                        className={`px-3 py-1 font-mono text-[9px] border rounded-lg uppercase tracking-wider font-bold cursor-pointer transition-all ${
                                          c.is_active 
                                            ? "border-red-500/20 hover:border-red-500/60 bg-red-500/5 text-red-400" 
                                            : "border-emerald-500/20 hover:border-emerald-500/60 bg-emerald-500/5 text-emerald-400"
                                        }`}
                                      >
                                        {c.is_active ? "Lock Node" : "Authorize"}
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                    </div>
                  </div>
                )}

                {/* SECTION 6: Account management List */}
                {activeTab === 6 && (
                  <div className="w-full">
                    <div className="rounded-2xl border border-amber-500/15 bg-zinc-900/40 backdrop-blur-xl p-5 md:p-6 shadow-2xl relative">
                      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/35 to-transparent"></div>

                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4 mb-5">
                        <div>
                          <h2 className="text-base font-serif font-bold text-white tracking-wide flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-amber-400" />
                            <span>Financial Chart Ledger Accounts</span>
                          </h2>
                          <p className="text-[11px] text-neutral-400 mt-1">Review active global ledgers across participating companies.</p>
                        </div>

                        {/* Search */}
                        <div className="relative w-full md:w-64">
                          <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
                          <input 
                            type="text"
                            placeholder="Code, name or company..."
                            value={accountSearch}
                            onChange={(e) => setAccountSearch(e.target.value)}
                            className="w-full bg-neutral-950/60 border border-white/10 rounded-xl py-1.5 pl-9 pr-4 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/50 font-mono h-9"
                          />
                        </div>
                      </div>

                      {/* accounts List wrapper */}
                      {isAccountsListLoading ? (
                        <div className="py-16 text-center flex flex-col items-center justify-center">
                          <Loader2 className="h-6 w-6 text-amber-500 animate-spin mb-3" />
                          <span className="font-mono text-[10px] tracking-widest text-amber-500/60">COLLECTING ACCOUNTS LEDGER...</span>
                        </div>
                      ) : filteredAccounts.length === 0 ? (
                        <div className="py-16 text-center border border-white/5 bg-neutral-950/10 rounded-xl font-mono text-xs text-neutral-500 italic">
                          No analytical ledger accounts found matching the criteria.
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-white/5 bg-neutral-950/20 custom-scrollbar">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-white/10 bg-neutral-900/40 text-[10px] font-mono uppercase tracking-wider text-amber-400">
                                <th className="py-2.5 px-4 font-mono">Account Code</th>
                                <th className="py-2.5 px-4">Account Ledger Name</th>
                                <th className="py-2.5 px-3">Nature Categorization</th>
                                <th className="py-2.5 px-4">Host Company Affinity</th>
                                <th className="py-2.5 px-4">Detailed Description notes</th>
                                <th className="py-2.5 px-3 text-center">Status</th>
                                <th className="py-2.5 px-4 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-[11.5px] font-light">
                              {filteredAccounts.map((a) => {
                                // Resolve nature name
                                const resolvedAndNatureName = natures.find(n => n.id === String(a.nature_id || a.nature || ''))?.name || a.nature || "Asset";
                                // Resolve company name
                                const resolvedCompName = companies.find(comp => comp.id === String(a.company_id || a.company || ''))?.name || a.company || "All Companies";
                                return (
                                  <tr key={a.id} className="hover:bg-white/2 transition-colors">
                                    <td className="py-3 px-4 font-mono font-semibold text-amber-300">{a.account_code}</td>
                                    <td className="py-3 px-4 text-white font-medium">{a.account_name}</td>
                                    <td className="py-3 px-3">
                                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-zinc-800 border border-white/5 text-neutral-300 uppercase">{resolvedAndNatureName}</span>
                                    </td>
                                    <td className="py-3 px-4 text-neutral-350">{resolvedCompName}</td>
                                    <td className="py-3 px-4 text-neutral-400 font-light truncate max-w-[200px]" title={a.description}>{a.description || "—"}</td>
                                    <td className="py-3 px-3 text-center">
                                      <span className={`px-2 py-0.5 rounded-full font-mono text-[9px] uppercase font-semibold leading-none ${
                                        a.is_active 
                                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                                          : "bg-red-500/10 text-red-400 border border-red-500/20"
                                      }`}>
                                        {a.is_active ? "Active" : "Closed"}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                      <button
                                        onClick={() => handleToggleAccountActive(a.id, a.is_active)}
                                        className={`px-3 py-1 font-mono text-[9px] border rounded-lg uppercase tracking-wider font-bold cursor-pointer transition-all ${
                                          a.is_active 
                                            ? "border-red-500/20 hover:border-red-500/60 bg-red-500/5 text-red-400" 
                                            : "border-emerald-500/20 hover:border-emerald-500/60 bg-emerald-500/5 text-emerald-400"
                                        }`}
                                      >
                                        {a.is_active ? "Block" : "Unblock"}
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                    </div>
                  </div>
                )}

                {/* SECTION 7: Category management List */}
                {activeTab === 7 && (
                  <div className="w-full">
                    <div className="rounded-2xl border border-amber-500/15 bg-zinc-900/40 backdrop-blur-xl p-5 md:p-6 shadow-2xl relative">
                      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/35 to-transparent"></div>

                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4 mb-5">
                        <div>
                          <h2 className="text-base font-serif font-bold text-white tracking-wide flex items-center gap-2">
                            <Tag className="h-5 w-5 text-amber-400" />
                            <span>Analytic operational categories</span>
                          </h2>
                          <p className="text-[11px] text-neutral-400 mt-1">Review active accounting transit classifications and codes.</p>
                        </div>

                        {/* Search */}
                        <div className="relative w-full md:w-64">
                          <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
                          <input 
                            type="text"
                            placeholder="Code, name or company..."
                            value={categorySearch}
                            onChange={(e) => setCategorySearch(e.target.value)}
                            className="w-full bg-neutral-950/60 border border-white/10 rounded-xl py-1.5 pl-9 pr-4 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/50 font-mono h-9"
                          />
                        </div>
                      </div>

                      {/* Category List */}
                      {isCategoriesListLoading ? (
                        <div className="py-16 text-center flex flex-col items-center justify-center">
                          <Loader2 className="h-6 w-6 text-amber-500 animate-spin mb-3" />
                          <span className="font-mono text-[10px] tracking-widest text-amber-500/60">COLLECTING CATEGORIES...</span>
                        </div>
                      ) : filteredCategories.length === 0 ? (
                        <div className="py-16 text-center border border-white/5 bg-neutral-950/10 rounded-xl font-mono text-xs text-neutral-500 italic">
                          No classifications registered in local categories sheet directory.
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-white/5 bg-neutral-950/20 custom-scrollbar">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-white/10 bg-neutral-900/40 text-[10px] font-mono uppercase tracking-wider text-amber-400">
                                <th className="py-2.5 px-4 font-mono">Category Code</th>
                                <th className="py-2.5 px-4 font-mono">Category Name</th>
                                <th className="py-2.5 px-3">Nature Association</th>
                                <th className="py-2.5 px-4">Affiliated Company Group</th>
                                <th className="py-2.5 px-4">Classification Descriptions</th>
                                <th className="py-2.5 px-3 text-center">Status</th>
                                <th className="py-2.5 px-4 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-[11.5px] font-light">
                              {filteredCategories.map((c) => {
                                // Resolve nature name
                                const resolvedAndNatureName = natures.find(n => n.id === String(c.nature_id || c.nature || ''))?.name || c.nature || "Revenue";
                                // Resolve company name
                                const resolvedCompName = companies.find(comp => comp.id === String(c.company_id || c.company || ''))?.name || c.company || "All Nodes";
                                return (
                                  <tr key={c.id} className="hover:bg-white/2 transition-colors">
                                    <td className="py-3 px-4 font-mono font-semibold text-amber-300">{c.category_code}</td>
                                    <td className="py-3 px-4 text-white font-medium">{c.category_name}</td>
                                    <td className="py-3 px-3">
                                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-zinc-800 border border-white/5 text-neutral-350 uppercase">{resolvedAndNatureName}</span>
                                    </td>
                                    <td className="py-3 px-4 text-neutral-300">{resolvedCompName}</td>
                                    <td className="py-3 px-4 text-neutral-400 truncate max-w-[200px]" title={c.description}>{c.description || "—"}</td>
                                    <td className="py-3 px-3 text-center">
                                      <span className={`px-2 py-0.5 rounded-full font-mono text-[9px] uppercase font-semibold leading-none ${
                                        c.is_active 
                                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                                          : "bg-red-500/10 text-red-400 border border-red-500/20"
                                      }`}>
                                        {c.is_active ? "Active" : "Omitted"}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                      <button
                                        onClick={() => handleToggleCategoryActive(c.id, c.is_active)}
                                        className={`px-3 py-1 font-mono text-[9px] border rounded-lg uppercase tracking-wider font-bold cursor-pointer transition-all ${
                                          c.is_active 
                                            ? "border-red-500/20 hover:border-red-500/60 bg-red-500/5 text-red-400" 
                                            : "border-emerald-500/20 hover:border-emerald-500/60 bg-emerald-500/5 text-emerald-400"
                                        }`}
                                      >
                                        {c.is_active ? "Lock" : "Unblock"}
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                    </div>
                  </div>
                )}

                {/* SECTION 8: Add Route */}
                {activeTab === 8 && (
                  <div className="max-w-2xl mx-auto overflow-visible relative">
                    <div className="rounded-2xl border border-amber-500/15 bg-zinc-900/40 backdrop-blur-xl p-6 md:p-8 shadow-2xl relative overflow-visible col-span-2">
                      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/30 to-transparent"></div>
                      
                      <div className="flex items-center gap-3.5 pb-4 border-b border-white/5 mb-6">
                        <div className="h-10 w-10 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center text-amber-400 shadow-md">
                          <Compass className="h-5.5 w-5.5" />
                        </div>
                        <div>
                          <h2 className="text-base font-serif font-bold text-white tracking-wide">Register New Route</h2>
                          <p className="text-[11px] text-neutral-400">Establish a new transit line in the logistics database.</p>
                        </div>
                      </div>

                      <form onSubmit={handleSaveRoute} className="grid grid-cols-1 md:grid-cols-2 gap-5 overflow-visible">
                        
                        <div className="md:col-span-2">
                          <label className="block text-[11px] font-mono uppercase tracking-wider text-amber-500/80 mb-1.5">Route Name *</label>
                          <input 
                            type="text"
                            required
                            value={routeForm.route_name}
                            onChange={(e) => setRouteForm({...routeForm, route_name: e.target.value})}
                            placeholder="e.g. Dar es Salaam to Arusha"
                            className="w-full bg-neutral-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50 h-10 transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-mono uppercase tracking-wider text-amber-500/80 mb-1.5">Origin Node *</label>
                          <input 
                            type="text"
                            required
                            value={routeForm.origin}
                            onChange={(e) => setRouteForm({...routeForm, origin: e.target.value})}
                            placeholder="e.g. Dar es Salaam"
                            className="w-full bg-neutral-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50 h-10 transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-mono uppercase tracking-wider text-amber-500/80 mb-1.5">Destination Node *</label>
                          <input 
                            type="text"
                            required
                            value={routeForm.destination}
                            onChange={(e) => setRouteForm({...routeForm, destination: e.target.value})}
                            placeholder="e.g. Arusha"
                            className="w-full bg-neutral-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50 h-10 transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-mono uppercase tracking-wider text-amber-500/80 mb-1.5">Distance (KM) *</label>
                          <input 
                            type="number"
                            required
                            value={routeForm.distance_km}
                            onChange={(e) => setRouteForm({...routeForm, distance_km: e.target.value})}
                            placeholder="e.g. 650"
                            className="w-full bg-neutral-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50 h-10 transition-colors font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>

                        <div className="overflow-visible">
                          <SearchableDropdown 
                            label="Target Company Node *"
                            placeholder="Select affiliated Company..."
                            options={companies}
                            selectedValue={routeForm.company}
                            onChange={(val) => setRouteForm({...routeForm, company: val})}
                            required
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-[11px] font-mono uppercase tracking-wider text-amber-500/80 mb-1.5">Route Description Notes</label>
                          <textarea 
                            value={routeForm.description}
                            onChange={(e) => setRouteForm({...routeForm, description: e.target.value})}
                            placeholder="Enter route terrain description, driver assignment specifics, or rest stop protocols..."
                            className="w-full bg-neutral-950/60 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500/50 h-20 transition-colors resize-none"
                          />
                        </div>

                        <div className="md:col-span-2 bg-[#2a221a]/20 border border-white/5 rounded-xl p-4 flex items-center justify-between">
                          <div>
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider leading-none">Route Activation</h4>
                            <p className="text-[10px] text-neutral-400 mt-1">Deactivated routes are excluded from schedule/cargo assignments.</p>
                          </div>
                          <select
                            value={routeForm.is_active ? "yes" : "no"}
                            onChange={(e) => setRouteForm({...routeForm, is_active: e.target.value === "yes"})}
                            className="bg-neutral-950 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-amber-400 font-mono focus:outline-none h-9 cursor-pointer"
                          >
                            <option value="yes">Active</option>
                            <option value="no">Inactive</option>
                          </select>
                        </div>

                        <div className="md:col-span-2 pt-3">
                          <button
                            type="submit"
                            disabled={routeSaving}
                            className="w-full py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-400 text-[#0c0c0c] font-bold text-xs uppercase tracking-widest rounded-xl transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-lg animate-pulse"
                          >
                            {routeSaving ? (
                              <Loader2 className="h-4 w-4 animate-spin text-[#0c0c0c]" />
                            ) : (
                              <Compass className="h-4 w-4" />
                            )}
                            <span>SAVE ROUTE REGISTRY</span>
                          </button>
                        </div>

                      </form>

                      {routeSuccess && (
                        <div className="mt-5 p-3.5 bg-emerald-500/10 border border-emerald-500/35 rounded-xl flex items-center gap-2.5 text-xs text-emerald-400">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                          <span>{routeSuccess}</span>
                        </div>
                      )}
                      {routeError && (
                        <div className="mt-5 p-3.5 bg-rose-500/10 border border-rose-500/35 rounded-xl flex items-center gap-2.5 text-xs text-rose-455">
                          <AlertTriangle className="h-4 w-4 text-rose-455 shrink-0" />
                          <span>{routeError}</span>
                        </div>
                      )}

                    </div>
                  </div>
                )}

                {/* SECTION 9: Routes List */}
                {activeTab === 9 && (
                  <div className="w-full">
                    {editingRoute ? (
                      <div className="max-w-xl mx-auto rounded-2xl border border-amber-500/25 bg-neutral-950/90 backdrop-blur-xl p-6 md:p-8 shadow-2xl relative">
                        <div className="flex justify-between items-center pb-4 border-b border-white/5 mb-6">
                          <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2 font-serif">
                            <Compass className="h-4.5 w-4.5 animate-spin" />
                            <span>Edit Route Segment</span>
                          </h3>
                          <button onClick={() => setEditingRoute(null)} className="p-1 hover:bg-white/5 rounded-lg text-neutral-400 hover:text-white transition-colors">
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        <form onSubmit={handleUpdateRoute} className="space-y-4 text-left overflow-visible">
                          <div>
                            <label className="block text-[10px] font-mono uppercase tracking-wider text-amber-500/80 mb-1">Route Name *</label>
                            <input 
                              type="text" 
                              required 
                              value={editingRoute.route_name}
                              onChange={(e) => setEditingRoute({...editingRoute, route_name: e.target.value})}
                              className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-mono uppercase tracking-wider text-amber-500/80 mb-1">Origin Node *</label>
                              <input 
                                type="text" 
                                required 
                                value={editingRoute.origin}
                                onChange={(e) => setEditingRoute({...editingRoute, origin: e.target.value})}
                                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3.5 py-1.5 text-xs text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-mono uppercase tracking-wider text-amber-500/80 mb-1">Destination Node *</label>
                              <input 
                                type="text" 
                                required 
                                value={editingRoute.destination}
                                onChange={(e) => setEditingRoute({...editingRoute, destination: e.target.value})}
                                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3.5 py-1.5 text-xs text-white"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 overflow-visible">
                            <div>
                              <label className="block text-[10px] font-mono uppercase tracking-wider text-amber-500/80 mb-1">Distance (KM) *</label>
                              <input 
                                type="number" 
                                required 
                                value={editingRoute.distance_km}
                                onChange={(e) => setEditingRoute({...editingRoute, distance_km: e.target.value})}
                                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3.5 py-1.5 text-xs text-white font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </div>
                            <div className="overflow-visible">
                              <SearchableDropdown 
                                label="Target Company"
                                placeholder="Select Company..."
                                options={companies}
                                selectedValue={editingRoute.company || editingRoute.company_id || ""}
                                onChange={(val) => setEditingRoute({...editingRoute, company: val})}
                                required
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono uppercase tracking-wider text-amber-500/80 mb-1">Description</label>
                            <textarea 
                              value={editingRoute.description || ""}
                              onChange={(e) => setEditingRoute({...editingRoute, description: e.target.value})}
                              className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg p-2.5 text-xs text-white h-16 resize-none"
                            />
                          </div>

                          <div className="bg-[#2a221a]/25 border border-white/5 rounded-xl p-3 flex items-center justify-between">
                            <span className="text-[11px] font-bold text-white uppercase tracking-wider">Status Node</span>
                            <select
                              value={editingRoute.is_active ? "yes" : "no"}
                              onChange={(e) => setEditingRoute({...editingRoute, is_active: e.target.value === "yes"})}
                              className="bg-[#0c0c0c] border border-white/10 rounded px-2.5 py-1 text-xs text-amber-400 font-mono focus:outline-none h-8 cursor-pointer"
                            >
                              <option value="yes">Active</option>
                              <option value="no">Inactive</option>
                            </select>
                          </div>

                          <div className="flex gap-3 pt-2">
                            <button type="submit" className="flex-1 py-2 bg-gradient-to-r from-amber-600 to-amber-400 text-[#0a0a0a] font-bold text-xs uppercase tracking-wider rounded-lg transition-transform cursor-pointer">
                              Save Changes
                            </button>
                            <button type="button" onClick={() => setEditingRoute(null)} className="flex-1 py-2 border border-white/10 hover:border-white/20 text-xs font-mono tracking-wider hover:bg-white/5 rounded-lg text-neutral-300">
                              Cancel
                            </button>
                          </div>
                        </form>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-amber-500/15 bg-zinc-900/40 backdrop-blur-xl p-5 md:p-6 shadow-2xl relative">
                        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/35 to-transparent"></div>
                        
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4 mb-5">
                          <div>
                            <h2 className="text-base font-serif font-bold text-white tracking-wide flex items-center gap-2">
                              <Compass className="h-5 w-5 text-amber-400" />
                              <span>Registered Routes Directory</span>
                            </h2>
                            <p className="text-[11px] text-neutral-400 mt-1">Review active and inactive network route configurations.</p>
                          </div>
                          
                          <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
                            <input 
                              type="text"
                              placeholder="Search routes, origin, company..."
                              value={routeSearch}
                              onChange={(e) => setRouteSearch(e.target.value)}
                              className="w-full bg-[#0a0a0a]/65 border border-white/10 rounded-xl py-1.5 pl-9 pr-4 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/50 font-mono h-9"
                            />
                          </div>
                        </div>

                        {isRoutesListLoading ? (
                          <div className="py-16 text-center flex flex-col items-center justify-center">
                            <Loader2 className="h-6 w-6 text-amber-500 animate-spin mb-3" />
                            <span className="font-mono text-[10px] tracking-widest text-amber-500/60 font-bold">COLLECTING ROUTES...</span>
                          </div>
                        ) : routesList.length === 0 ? (
                          <div className="py-16 text-center border border-white/5 bg-neutral-950/10 rounded-xl font-mono text-xs text-neutral-500 italic">
                            No matching route segments currently registered.
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-xl border border-white/5 bg-neutral-950/20 custom-scrollbar">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="border-b border-white/10 bg-neutral-900/40 text-[10px] font-mono uppercase tracking-wider text-amber-400">
                                  <th className="py-3 px-4">Route Name</th>
                                  <th className="py-3 px-4">Origin</th>
                                  <th className="py-3 px-4">Destination</th>
                                  <th className="py-3 px-3">Distance</th>
                                  <th className="py-3 px-4">Affiliated Company</th>
                                  <th className="py-3 px-4 text-neutral-400">Description</th>
                                  <th className="py-3 px-3 text-center">Status</th>
                                  <th className="py-3 px-4 text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5 text-[11.5px] font-light">
                                {routesList
                                  .filter(r => {
                                    const val = routeSearch.toLowerCase();
                                    const compName = companies.find(c => c.id === String(r.company_id || r.company || ''))?.name || "";
                                    return (
                                      (r.route_name && r.route_name.toLowerCase().includes(val)) ||
                                      (r.origin && r.origin.toLowerCase().includes(val)) ||
                                      (r.destination && r.destination.toLowerCase().includes(val)) ||
                                      compName.toLowerCase().includes(val)
                                    );
                                  })
                                  .map((r) => {
                                    const linkedCompName = companies.find(c => c.id === String(r.company_id || r.company || ''))?.name || "All Nodes";
                                    return (
                                      <tr key={r.id} className="hover:bg-white/2 transition-colors">
                                        <td className="py-3.5 px-4 text-white font-semibold truncate max-w-[150px]">{r.route_name}</td>
                                        <td className="py-3.5 px-4 text-neutral-350">{r.origin}</td>
                                        <td className="py-3.5 px-4 text-neutral-350">{r.destination}</td>
                                        <td className="py-3.5 px-3 font-mono text-amber-400">{r.distance_km} KM</td>
                                        <td className="py-3.5 px-4 text-neutral-300 font-medium">{linkedCompName}</td>
                                        <td className="py-3.5 px-4 text-neutral-400 truncate max-w-[150px]" title={r.description}>{r.description || "—"}</td>
                                        <td className="py-3.5 px-3 text-center">
                                          <span className={`px-2 py-0.5 rounded-full font-mono text-[9px] uppercase font-semibold leading-none ${
                                            r.is_active 
                                              ? "bg-[#10b981]/15 text-[#34d399] border border-[#10b981]/20" 
                                              : "bg-red-500/10 text-red-400 border border-red-500/20"
                                          }`}>
                                            {r.is_active ? "Active" : "Inactive"}
                                          </span>
                                        </td>
                                        <td className="py-3.5 px-4 text-right">
                                          <div className="flex gap-2 justify-end">
                                            <button
                                              onClick={() => setEditingRoute(r)}
                                              className="px-2 py-1 font-mono text-[9px] border border-amber-500/20 hover:border-amber-500 hover:bg-amber-500/10 text-amber-300 rounded uppercase tracking-wider font-bold transition-all cursor-pointer flex items-center gap-1"
                                            >
                                              <Edit2 className="h-3 w-3" />
                                              <span>Edit</span>
                                            </button>
                                            <button
                                              onClick={() => handleToggleRouteActive(r.id, r.is_active)}
                                              className={`px-2 py-1 font-mono text-[9px] border rounded uppercase tracking-wider font-bold cursor-pointer transition-all ${
                                                r.is_active 
                                                  ? "border-red-500/25 hover:border-red-500/60 bg-red-500/5 text-red-400" 
                                                  : "border-emerald-500/25 hover:border-emerald-500/60 bg-emerald-500/5 text-emerald-400"
                                              }`}
                                            >
                                              {r.is_active ? "Lock" : "Unblock"}
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* SECTION 10: User List */}
                {activeTab === 10 && (
                  <div className="w-full">
                    {editingUser ? (
                      <div className="max-w-xl mx-auto rounded-2xl border border-amber-500/25 bg-neutral-950/95 backdrop-blur-xl p-6 md:p-8 shadow-2xl relative">
                        <div className="flex justify-between items-center pb-4 border-b border-white/5 mb-6">
                          <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2 font-serif">
                            <Users className="h-4.5 w-4.5" />
                            <span>Edit Staff Profile</span>
                          </h3>
                          <button onClick={() => setEditingUser(null)} className="p-1 hover:bg-white/5 rounded-lg text-neutral-400 hover:text-white-200">
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        <form onSubmit={handleUpdateUser} className="space-y-4 text-left overflow-visible">
                          <div>
                            <label className="block text-[10px] font-mono uppercase tracking-wider text-amber-500/80 mb-1">Full Name *</label>
                            <input 
                              type="text" 
                              required 
                              value={editingUser.full_name}
                              onChange={(e) => setEditingUser({...editingUser, full_name: e.target.value})}
                              className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono uppercase tracking-wider text-amber-500/80 mb-1">E-mail Address (Saved to Profile / Synchronized for Recovery)</label>
                            <input 
                              type="email" 
                              value={editingUser.email || editingUser.user_email || editingUser.auth_email || ""}
                              onChange={(e) => {
                                const newMail = e.target.value;
                                if ('email' in editingUser) {
                                  setEditingUser({...editingUser, email: newMail});
                                } else if ('user_email' in editingUser) {
                                  setEditingUser({...editingUser, user_email: newMail});
                                } else if ('auth_email' in editingUser) {
                                  setEditingUser({...editingUser, auth_email: newMail});
                                } else {
                                  setEditingUser({...editingUser, email: newMail});
                                }
                              }}
                              placeholder="user@company.com"
                              className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white"
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-visible">
                            <div className="overflow-visible">
                              <SearchableDropdown 
                                label="Security Role Target"
                                placeholder="Select Role..."
                                options={roles}
                                selectedValue={editingUser.role_id || ""}
                                onChange={(val) => setEditingUser({...editingUser, role_id: val})}
                                required
                              />
                            </div>
                            <div className="overflow-visible">
                              <SearchableDropdown 
                                label="Target Company"
                                placeholder="Select Company..."
                                options={companies}
                                selectedValue={editingUser.company || editingUser.company_id || ""}
                                onChange={(val) => setEditingUser({...editingUser, company: val})}
                                required
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono uppercase tracking-wider text-amber-500/80 mb-1">Residential Address</label>
                            <input 
                              type="text" 
                              value={editingUser.address || ""}
                              onChange={(e) => setEditingUser({...editingUser, address: e.target.value})}
                              className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-mono uppercase tracking-wider text-amber-500/80 mb-1">Direct Phone</label>
                              <input 
                                type="text" 
                                value={editingUser.phone_number || ""}
                                onChange={(e) => setEditingUser({...editingUser, phone_number: e.target.value})}
                                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-mono uppercase tracking-wider text-amber-500/80 mb-1">NIDA ID</label>
                              <input 
                                type="text" 
                                value={editingUser.nida_number || ""}
                                onChange={(e) => setEditingUser({...editingUser, nida_number: e.target.value})}
                                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white font-mono"
                              />
                            </div>
                          </div>

                          <div className="bg-[#2a221a]/25 border border-white/5 rounded-xl p-3 flex items-center justify-between">
                            <span className="text-[11px] font-bold text-white uppercase tracking-wider">Account Active</span>
                            <select
                              value={editingUser.is_active ? "yes" : "no"}
                              onChange={(e) => setEditingUser({...editingUser, is_active: e.target.value === "yes"})}
                              className="bg-[#0c0c0c] border border-white/10 rounded px-2.5 py-1 text-xs text-amber-400 font-mono focus:outline-none h-8 cursor-pointer"
                            >
                              <option value="yes">Active</option>
                              <option value="no">Inactive</option>
                            </select>
                          </div>

                          <div className="flex gap-3 pt-2">
                            <button type="submit" className="flex-1 py-2 bg-gradient-to-r from-amber-600 to-amber-500 text-neutral-950 text-xs font-bold uppercase tracking-wider rounded-lg transition-transform cursor-pointer">
                              Save Changes
                            </button>
                            <button type="button" onClick={() => setEditingUser(null)} className="flex-1 py-2 border border-white/10 hover:border-white/20 text-xs font-mono tracking-wider hover:bg-white/5 rounded-lg text-neutral-300">
                              Cancel
                            </button>
                          </div>
                        </form>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-amber-500/15 bg-zinc-900/40 backdrop-blur-xl p-5 md:p-6 shadow-2xl relative">
                        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/35 to-transparent"></div>
                        
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4 mb-5">
                          <div>
                            <h2 className="text-base font-serif font-bold text-white tracking-wide flex items-center gap-2">
                              <Users className="h-5 w-5 text-amber-400" />
                              <span>Staff Directory Registry</span>
                            </h2>
                            <p className="text-[11px] text-neutral-400 mt-1">Review active users, check roles, and adjust corporate node access controls.</p>
                          </div>
                          
                          <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
                            <input 
                              type="text"
                              placeholder="Search users, phone, NIDA, company..."
                              value={userSearch}
                              onChange={(e) => setUserSearch(e.target.value)}
                              className="w-full bg-[#0a0a0a]/65 border border-white/10 rounded-xl py-1.5 pl-9 pr-4 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/50 font-mono h-9"
                            />
                          </div>
                        </div>

                        {isUsersListLoading ? (
                          <div className="py-16 text-center flex flex-col items-center justify-center">
                            <Loader2 className="h-6 w-6 text-amber-500 animate-spin mb-3" />
                            <span className="font-mono text-[10px] tracking-widest text-amber-500/60 font-bold">COLLECTING PROFILES...</span>
                          </div>
                        ) : usersList.length === 0 ? (
                          <div className="py-16 text-center border border-white/5 bg-neutral-950/10 rounded-xl font-mono text-xs text-neutral-500 italic">
                            No profiles registered in local security groups directory.
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-xl border border-white/5 bg-neutral-950/20 custom-scrollbar">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="border-b border-white/10 bg-neutral-900/40 text-[10px] font-mono uppercase tracking-wider text-amber-400">
                                  <th className="py-3 px-4">Full Name</th>
                                  <th className="py-3 px-4">Role Profile</th>
                                  <th className="py-3 px-4">Affiliated Company</th>
                                  <th className="py-3 px-4">Street Address</th>
                                  <th className="py-3 px-3 font-mono">Phone Number</th>
                                  <th className="py-3 px-3 font-mono">NIDA Number</th>
                                  <th className="py-3 px-3 text-center">Status</th>
                                  <th className="py-3 px-4 text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5 text-[11.5px] font-light">
                                {usersList
                                  .filter(u => {
                                    const val = userSearch.toLowerCase();
                                    const roleStr = roles.find(r => r.id === String(u.role_id || ''))?.name || "";
                                    const compNameStr = companies.find(c => c.id === String(u.company_id || u.company || ''))?.name || "";
                                    return (
                                      (u.full_name && u.full_name.toLowerCase().includes(val)) ||
                                      (u.phone_number && u.phone_number.toLowerCase().includes(val)) ||
                                      (u.nida_number && u.nida_number.toLowerCase().includes(val)) ||
                                      roleStr.toLowerCase().includes(val) ||
                                      compNameStr.toLowerCase().includes(val)
                                    );
                                  })
                                  .map((u) => {
                                    const matchedRole = roles.find(r => r.id === String(u.role_id || ''))?.name || "Standard Identity";
                                    const matchedComp = companies.find(c => c.id === String(u.company_id || u.company || ''))?.name || "Unassigned Nodes";
                                    return (
                                      <tr key={u.id} className="hover:bg-white/2 transition-colors">
                                        <td className="py-3.5 px-4 text-white font-semibold truncate max-w-[150px]">{u.full_name}</td>
                                        <td className="py-3.5 px-4 text-neutral-350">
                                          <span className="font-mono text-[9px] uppercase tracking-wide bg-zinc-800 border border-white/5 px-2 py-0.5 rounded text-amber-300">{matchedRole}</span>
                                        </td>
                                        <td className="py-3.5 px-4 text-amber-500/80">{matchedComp}</td>
                                        <td className="py-3.5 px-4 text-neutral-300 font-light truncate max-w-[150px]">{u.address || "—"}</td>
                                        <td className="py-3.5 px-3 font-mono text-neutral-400">{u.phone_number || "—"}</td>
                                        <td className="py-3.5 px-3 font-mono text-neutral-450">{u.nida_number || "—"}</td>
                                        <td className="py-3.5 px-3 text-center">
                                          <span className={`px-2 py-0.5 rounded-full font-mono text-[9px] uppercase font-semibold leading-none ${
                                            u.is_active 
                                              ? "bg-[#10b981]/15 text-[#34d399] border border-[#10b981]/20" 
                                              : "bg-red-500/10 text-red-400 border border-red-500/20"
                                          }`}>
                                            {u.is_active ? "Active" : "Locked"}
                                          </span>
                                        </td>
                                        <td className="py-3.5 px-4 text-right">
                                          <div className="flex gap-2 justify-end">
                                            <button
                                              onClick={() => setEditingUser(u)}
                                              className="px-2 py-1 font-mono text-[9px] border border-amber-500/20 hover:border-amber-500 hover:bg-amber-500/10 text-amber-300 rounded uppercase tracking-wider font-bold transition-all cursor-pointer flex items-center gap-1"
                                            >
                                              <Edit2 className="h-3 w-3" />
                                              <span>Edit</span>
                                            </button>
                                            <button
                                              onClick={() => handleToggleUserActive(u.id, u.is_active)}
                                              className={`px-2.5 py-1 font-mono text-[9px] border rounded uppercase tracking-wider font-bold cursor-pointer transition-all ${
                                                u.is_active 
                                                  ? "border-red-500/25 hover:border-red-500/60 bg-red-500/5 text-red-400" 
                                                  : "border-emerald-500/25 hover:border-emerald-500/60 bg-emerald-500/5 text-emerald-400"
                                              }`}
                                            >
                                              {u.is_active ? "Suspend" : "Activate"}
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* SECTION 11: Reset Password Link Dispatcher */}
                {activeTab === 11 && (
                  <div className="max-w-xl mx-auto overflow-visible relative">
                    <div className="rounded-2xl border border-amber-500/15 bg-zinc-900/40 backdrop-blur-xl p-6 md:p-8 shadow-2xl relative overflow-visible col-span-2">
                      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/30 to-transparent"></div>
                      
                      <div className="flex items-center gap-3.5 pb-4 border-b border-white/5 mb-6">
                        <div className="h-10 w-10 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center text-amber-400 shadow-md">
                          <KeyRound className="h-5.5 w-5.5" />
                        </div>
                        <div>
                          <h2 className="text-base font-serif font-bold text-white tracking-wide">Secure Password Reset Gateway</h2>
                          <p className="text-[11px] text-neutral-400">Trigger recovery credentials link dispatch to affiliated user security mailboxes.</p>
                        </div>
                      </div>

                      <div className="space-y-6 overflow-visible text-left">
                        {/* Searchable select user */}
                        <div className="overflow-visible">
                          <SearchableDropdown 
                            label="Select Target User"
                            placeholder="Type to search and select a user..."
                            options={usersList.map((u) => ({ id: u.id, name: `${u.full_name} (${u.phone_number || "No Phone"})` }))}
                            selectedValue={resetPasswordSelectedUser || ""}
                            onChange={(val) => {
                              setResetPasswordSelectedUser(val);
                              setResetPasswordSuccess(null);
                              setResetPasswordError(null);
                            }}
                          />
                        </div>

                        {resetPasswordSelectedUser && (() => {
                          const targetUser = usersList.find(u => u.id === resetPasswordSelectedUser);
                          if (!targetUser) return null;
                          const linkedCompName = companies.find(c => c.id === String(targetUser.company_id || targetUser.company || ''))?.name || "None Assigned";
                          const userEmail = targetUser.email || targetUser.user_email || targetUser.auth_email;

                          return (
                            <div className="bg-[#1c1510]/50 border border-amber-500/10 rounded-xl p-5 space-y-3.5">
                              <h4 className="text-xs font-mono font-bold tracking-wider text-amber-400 uppercase">Target Node Details</h4>
                              
                              <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                  <span className="text-neutral-500 block text-[10px] uppercase font-mono tracking-wider">Full Name</span>
                                  <span className="font-semibold text-white">{targetUser.full_name}</span>
                                </div>
                                <div>
                                  <span className="text-neutral-500 block text-[10px] uppercase font-mono tracking-wider">Phone Line</span>
                                  <span className="font-mono text-neutral-200">{targetUser.phone_number || "—"}</span>
                                </div>
                                <div>
                                  <span className="text-neutral-500 block text-[10px] uppercase font-mono tracking-wider">Associated Node</span>
                                  <span className="text-amber-500/80">{linkedCompName}</span>
                                </div>
                                <div>
                                  <span className="text-neutral-500 block text-[10px] uppercase font-mono tracking-wider font-bold">Record Link</span>
                                  <span className="font-mono text-[10px] bg-zinc-900 border border-white/5 px-2.5 py-0.5 rounded text-neutral-400 inline-block truncate">
                                    Active Profile Checked
                                  </span>
                                </div>
                              </div>

                              <div className="border-t border-white/5 pt-3">
                                <span className="text-neutral-500 block text-[10px] uppercase font-mono tracking-wider mb-1">Target E-mail Account</span>
                                {userEmail ? (
                                  <span className="font-mono text-xs text-emerald-400 font-semibold">{userEmail}</span>
                                ) : (
                                  <div className="text-rose-400 text-xs font-semibold bg-rose-500/5 border border-rose-500/15 rounded-lg p-2.5 mt-1 flex items-start gap-2">
                                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                                    <span>This user has no email saved. Please update user profile with email first.</span>
                                  </div>
                                )}
                              </div>

                              {userEmail && (
                                <div className="pt-3">
                                  <button
                                    onClick={handleSendPasswordReset}
                                    disabled={isResettingPassword}
                                    className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-400 text-[#0c0c0c] font-bold text-xs uppercase tracking-widest rounded-xl transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-md"
                                  >
                                    {isResettingPassword ? (
                                      <Loader2 className="h-4 w-4 animate-spin text-[#0c0c0c]" />
                                    ) : (
                                      <KeyRound className="h-4 w-4" />
                                    )}
                                    <span>Send Password Reset Link</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {resetPasswordSuccess && (
                          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/35 rounded-xl flex items-center gap-2.5 text-xs text-emerald-400">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                            <span>{resetPasswordSuccess}</span>
                          </div>
                        )}
                        {resetPasswordError && (
                          <div className="p-3.5 bg-[#f43f5e]/10 border border-rose-500/35 rounded-xl flex items-center gap-2.5 text-xs text-rose-400">
                            <AlertTriangle className="h-4 w-4 text-rose-455 shrink-0" />
                            <span>{resetPasswordError}</span>
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                )}

              </motion.div>
            </AnimatePresence>
          </div>
        )}

      </main>

      {/* Symmetrical elegant footer message */}
      <footer className="w-full text-center py-6 mt-auto border-t border-amber-500/5 z-10 shrink-0 text-[10px] font-mono text-neutral-600 tracking-wider flex flex-col items-center justify-center gap-1.5">
        <p className="flex items-center gap-1">
          <span>MEQK EXECUTIVE TELEMETRY CONTROL PANEL</span>
          <Heart className="h-3 w-3 text-amber-500/60 shrink-0 inline-block animate-pulse" />
        </p>
        <p className="text-[9px] text-neutral-700">Meqk OS v1.26 // ALL SECURE TRANSMISSIONS ENCRYPTED</p>
      </footer>

      </div>
    </div>
  );
}

// Sub-component: SearchableDropdown
interface SearchableDropdownProps {
  label: string;
  placeholder: string;
  options: LookupItem[];
  selectedValue: string;
  onChange: (id: string) => void;
  required?: boolean;
}

function SearchableDropdown({ label, placeholder, options, selectedValue, onChange, required }: SearchableDropdownProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.id === selectedValue);
  const filtered = options.filter(o => o.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative font-sans overflow-visible w-full" ref={dropdownRef}>
      <label className="block text-[11px] font-mono uppercase tracking-wider text-amber-500/80 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-neutral-950/60 border border-white/10 hover:border-amber-500/30 rounded-xl px-3.5 py-2 text-xs text-white cursor-pointer h-10 flex items-center justify-between transition-colors shadow-sm"
      >
        <span className={selectedOption ? "text-neutral-200" : "text-neutral-500"}>
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 text-neutral-400 shrink-0" />
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-1.5 bg-neutral-900 border border-amber-500/25 rounded-xl shadow-2xl max-h-[190px] overflow-y-auto z-50 p-2 space-y-1.5 backdrop-blur-xl">
          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-neutral-950/90 rounded-lg border border-white/5 mx-0.5 sticky top-0 z-10 mb-1">
            <Search className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
            <input 
              type="text"
              placeholder="Search option names..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-xs text-white placeholder-neutral-500 outline-none"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          {filtered.length === 0 ? (
            <div className="text-center py-2 text-[11px] text-neutral-500 font-mono italic">
              No results found
            </div>
          ) : (
            filtered.map(opt => (
              <div 
                key={opt.id}
                onClick={() => {
                  onChange(opt.id);
                  setIsOpen(false);
                  setSearch("");
                }}
                className={`px-3 py-1.5 rounded-lg text-xs leading-normal transition-all cursor-pointer ${
                  opt.id === selectedValue 
                    ? "bg-amber-600 font-bold text-[#0c0c0c]" 
                    : "text-neutral-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                {opt.name}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
