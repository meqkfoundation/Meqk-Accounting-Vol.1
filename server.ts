import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Supabase details
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://rgfunbwdgvqqmnwkkbsk.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

// Dynamic helper to identify existing columns of the target user_profiles table
async function getProfileColumns() {
  try {
    const { data, error } = await supabaseAdmin.from("user_profiles").select("*").limit(1);
    if (!error && data && data.length > 0) {
      return Object.keys(data[0]);
    }
  } catch (e) {
    console.error("Column check failed, falling back:", e);
  }
  return [
    "id",
    "full_name",
    "role_id",
    "company_id",
    "address",
    "phone_number",
    "nida_number",
    "is_active"
  ];
}

// SECURE SERVER-SIDE API POINT FOR ADMINISTRATIVE USER CREATION
app.post("/api/admin/create-user", async (req, res) => {
  const { 
    email, 
    password, 
    full_name, 
    role_id, 
    company, 
    address, 
    phone_number, 
    nida_number, 
    is_active 
  } = req.body;

  if (!serviceRoleKey) {
    return res.status(500).json({ 
      error: "SUPABASE_SERVICE_ROLE_KEY is missing or unconfigured in server env settings." 
    });
  }

  if (!email || !password || !full_name) {
    return res.status(400).json({ 
      error: "Required properties: email, password, and full_name are missing." 
    });
  }

  try {
    // 1. Create real Auth user securely inside Supabase
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    if (!authUser?.user?.id) {
      return res.status(500).json({ error: "No authenticated user ID was returned from auth ledger." });
    }

    const userId = authUser.user.id;

    // 2. Resolve columns on the user_profiles table dynamic mapping
    const cols = await getProfileColumns();

    // 3. Build insert payload dynamically
    const profilePayload: Record<string, any> = {
      id: userId,
      full_name,
      role_id: role_id || null,
      company_id: company || null,
      address: address || "",
      phone_number: phone_number || "",
      nida_number: nida_number || "",
      is_active: is_active ?? true
    };

    if (cols.includes("user_id")) {
      profilePayload.user_id = userId;
    }
    if (cols.includes("auth_user_id")) {
      profilePayload.auth_user_id = userId;
    }
    if (cols.includes("email")) {
      profilePayload.email = email;
    }
    if (cols.includes("user_email")) {
      profilePayload.user_email = email;
    }
    if (cols.includes("auth_email")) {
      profilePayload.auth_email = email;
    }

    // Filter payload dynamically to include only columns shown in DB
    const finalPayload: Record<string, any> = {};
    for (const key of Object.keys(profilePayload)) {
      if (key !== "company" && cols.includes(key)) {
        finalPayload[key] = profilePayload[key];
      }
    }

    // Determine target onConflict column dynamically
    let onConflictCol = "id";
    if (cols.includes("user_id") && !cols.includes("id")) {
      onConflictCol = "user_id";
    } else if (cols.includes("auth_user_id") && !cols.includes("id")) {
      onConflictCol = "auth_user_id";
    }

    // 4. Upsert into user_profiles table
    const { error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .upsert([finalPayload], { onConflict: onConflictCol });

    if (profileError) {
      // Rollback newly created user in case of DB insertion errors
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return res.status(400).json({ error: `Database setup failure: ${profileError.message}` });
    }

    return res.status(200).json({ 
      success: true, 
      message: "Security profile and Auth authentication keys established securely!", 
      user: authUser.user 
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message || "An unexpected error occurred during creation." });
  }
});

// Configure Vite middleware in development, otherwise serve built distribution
async function initServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is up running on port ${PORT}`);
  });
}

initServer();
