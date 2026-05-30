import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = "https://rgfunbwdgvqqmnwkkbsk.supabase.co";
export const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnZnVuYndkZ3ZxcW1ud2trYnNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODY4NjMsImV4cCI6MjA5NDM2Mjg2M30.AC0k15rEYB3MSX7E2gFsUFT3w16Jpp6ZiMn_6ekmKao";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function resolveProfile(uid: string) {
  if (!uid) return null;
  try {
    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", uid)
      .single();
    if (error || !profile) return null;

    if (profile.company_id) {
      const { data: cData } = await supabase
        .from("companies")
        .select("company_name")
        .eq("id", profile.company_id)
        .single();
      if (cData) {
        profile.company_name = cData.company_name;
      }
    }
    return profile;
  } catch (err) {
    console.error("Error in resolveProfile:", err);
    return null;
  }
}

export function isUserSuperUser(profile: any): boolean {
  return profile?.company_name === "Meqk Foundation";
}

export function getActiveCompanyId(profile: any): string | null {
  if (!profile) return null;
  if (isUserSuperUser(profile)) {
    const selected = localStorage.getItem("meqk_active_company_id");
    if (!selected || selected === "all") {
      return null;
    }
    return selected;
  }
  return profile.company_id || null;
}

