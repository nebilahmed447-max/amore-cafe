import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StaffRole = "waiter" | "delivery";
function serverClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Server setup is missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
function authClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) throw new Error("Server setup is missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function managerClient(request: Request): Promise<{ db: SupabaseClient; userId: string } | { error: string; status: number }> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: "Please sign in again.", status: 401 };
  let db: SupabaseClient;
  let authDb: SupabaseClient;
  try { db = serverClient(); authDb = authClient(); } catch (error) { return { error: error instanceof Error ? error.message : "Server setup error.", status: 503 }; }
  // Validate the user's access token with the public/publishable key. Keep the service-role
  // client for privileged database operations only; newer Supabase secret keys are not
  // intended to replace the public key for Auth token validation.
  const { data: { user }, error } = await authDb.auth.getUser(token);
  if (error || !user) return { error: "Your session is invalid. Sign in again, then retry. If this continues, verify the local Supabase URL and keys belong to the same project.", status: 401 };
  const { data: profile, error: profileError } = await db.from("staff_profiles").select("role,active").eq("user_id", user.id).maybeSingle();
  if (profileError) return { error: "Run the staff setup SQL in Supabase first.", status: 503 };
  if (!profile || profile.role !== "manager" || !profile.active) return { error: "Only an active manager can manage staff and tables.", status: 403 };
  return { db, userId: user.id };
}
function responseError(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }

export async function GET(request: Request) {
  const auth = await managerClient(request);
  if ("error" in auth) return responseError(auth.error, auth.status);
  const { db } = auth;
  const [{ data: profiles, error: profilesError }, { data: tables, error: tablesError }] = await Promise.all([
    db.from("staff_profiles").select("user_id,display_name,role,active,assigned_tables,created_at").order("created_at", { ascending: true }),
    db.from("cafe_tables").select("table_number,label,created_at").order("table_number", { ascending: true }),
  ]);
  if (profilesError || tablesError) return responseError("Could not load staff and tables. Run supabase/staff-management.sql first.", 503);
  const { data: usersData, error: usersError } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) return responseError("Could not load staff email addresses.", 502);
  const emails = new Map((usersData.users || []).map(user => [user.id, user.email || ""]));
  return NextResponse.json({
    staff: (profiles || []).map(profile => ({ ...profile, email: emails.get(profile.user_id) || "" })),
    tables: tables || [],
  });
}

export async function POST(request: Request) {
  const auth = await managerClient(request);
  if ("error" in auth) return responseError(auth.error, auth.status);
  const { db } = auth;
  let body: any;
  try { body = await request.json(); } catch { return responseError("Invalid request."); }
  const action = String(body.action || "");

  if (action === "create_table") {
    const tableNumber = Number(body.table_number);
    const label = String(body.label || "").trim().slice(0, 80);
    if (!Number.isSafeInteger(tableNumber) || tableNumber < 1 || tableNumber > 1000000) return responseError("Enter a table number greater than 0.");
    const { error } = await db.from("cafe_tables").insert({ table_number: tableNumber, label: label || `Table ${tableNumber}` });
    if (error) return responseError(error.code === "23505" ? "That table number already exists." : error.message, 400);
    return NextResponse.json({ ok: true });
  }

  if (action === "delete_table") {
    const tableNumber = Number(body.table_number);
    if (!Number.isSafeInteger(tableNumber) || tableNumber < 1) return responseError("Invalid table number.");
    const { data: profiles, error: profilesError } = await db.from("staff_profiles").select("display_name,assigned_tables").eq("role", "waiter");
    if (profilesError) return responseError(profilesError.message, 400);
    const assignedTo = (profiles || []).filter(profile => (profile.assigned_tables || []).includes(tableNumber)).map(profile => profile.display_name || "a waiter");
    if (assignedTo.length) return responseError(`Reassign Table ${tableNumber} before deleting it. It is assigned to ${assignedTo.join(", ")}.`);
    const { error } = await db.from("cafe_tables").delete().eq("table_number", tableNumber);
    if (error) return responseError(error.message, 400);
    return NextResponse.json({ ok: true });
  }

  if (action === "create_staff") {
    const displayName = String(body.display_name || "").trim().slice(0, 100);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const role = String(body.role || "") as StaffRole;
    const assignedTables = Array.isArray(body.assigned_tables) ? [...new Set(body.assigned_tables.map(Number).filter((n: number) => Number.isSafeInteger(n) && n > 0))] : [];
    if (!displayName) return responseError("Enter the staff member's name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return responseError("Enter a valid email address.");
    if (password.length < 8) return responseError("Password must contain at least 8 characters.");
    if (role !== "waiter" && role !== "delivery") return responseError("Choose Waiter or Delivery.");
    if (role !== "waiter" && assignedTables.length) return responseError("Only waiters can be assigned dining tables.");
    if (assignedTables.length) {
      const { data: knownTables, error: tableError } = await db.from("cafe_tables").select("table_number").in("table_number", assignedTables);
      if (tableError) return responseError(tableError.message, 400);
      if ((knownTables || []).length !== assignedTables.length) return responseError("One or more selected tables no longer exist. Refresh the page.");
      const { data: otherProfiles, error: assignmentError } = await db.from("staff_profiles").select("display_name,assigned_tables").eq("role", "waiter").eq("active", true);
      if (assignmentError) return responseError(assignmentError.message, 400);
      const conflicts = assignedTables.filter(n => (otherProfiles || []).some(p => (p.assigned_tables || []).includes(n)));
      if (conflicts.length) return responseError(`Already assigned table(s): ${conflicts.join(", ")}. Remove them from the other waiter first.`);
    }
    const { data: created, error: createError } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: displayName } });
    if (createError || !created.user) return responseError(createError?.message || "Could not create the staff account.", 400);
    const { error: profileError } = await db.from("staff_profiles").insert({ user_id: created.user.id, display_name: displayName, role, active: true, assigned_tables: assignedTables });
    if (profileError) {
      await db.auth.admin.deleteUser(created.user.id);
      return responseError(`Account created but staff setup failed: ${profileError.message}`, 400);
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "delete_staff") {
    const userId = String(body.user_id || "").trim();
    if (!userId) return responseError("Choose a staff member to delete.");
    if (userId === auth.userId) return responseError("You cannot delete your own manager account.");

    const { data: target, error: targetError } = await db
      .from("staff_profiles")
      .select("user_id,role,display_name")
      .eq("user_id", userId)
      .maybeSingle();
    if (targetError) return responseError(targetError.message, 400);
    if (!target) return responseError("This staff account was not found. Refresh the page.", 404);
    if (target.role === "manager") return responseError("Manager accounts cannot be deleted from this screen.", 403);

    // Disable the staff profile first so the account loses panel access even if a later step fails.
    const { error: deactivateError } = await db
      .from("staff_profiles")
      .update({ active: false, assigned_tables: [] })
      .eq("user_id", userId);
    if (deactivateError) return responseError(`Could not deactivate this account: ${deactivateError.message}`, 400);

    // Soft-delete the Auth user to prevent sign-in while retaining its user ID for historical references.
    const { error: authDeleteError } = await db.auth.admin.deleteUser(userId, true);
    if (authDeleteError) return responseError(`The account was deactivated, but Auth could not remove it: ${authDeleteError.message}`, 400);

    const { error: profileDeleteError } = await db.from("staff_profiles").delete().eq("user_id", userId);
    if (profileDeleteError) return responseError(`The account can no longer sign in, but its staff record could not be removed: ${profileDeleteError.message}`, 400);

    return NextResponse.json({ ok: true });
  }

  if (action === "update_staff") {
    const userId = String(body.user_id || "");
    const displayName = String(body.display_name || "").trim().slice(0, 100);
    const role = String(body.role || "") as StaffRole;
    const active = Boolean(body.active);
    const assignedTables = Array.isArray(body.assigned_tables) ? [...new Set(body.assigned_tables.map(Number).filter((n: number) => Number.isSafeInteger(n) && n > 0))] : [];
    if (!userId || !displayName) return responseError("Staff member and display name are required.");
    if (role !== "waiter" && role !== "delivery") return responseError("Choose Waiter or Delivery.");
    if (role !== "waiter" && assignedTables.length) return responseError("Only waiters can be assigned dining tables.");
    if (userId === auth.userId) return responseError("You cannot change your own manager account here.");
    const { data: knownTables, error: tableError } = await db.from("cafe_tables").select("table_number").in("table_number", assignedTables.length ? assignedTables : [-1]);
    if (tableError) return responseError(tableError.message, 400);
    if ((knownTables || []).length !== assignedTables.length) return responseError("One or more selected tables no longer exist. Refresh the page.");
    if (role === "waiter" && active && assignedTables.length) {
      const { data: otherProfiles, error: assignmentError } = await db.from("staff_profiles").select("user_id,display_name,assigned_tables").eq("role", "waiter").eq("active", true).neq("user_id", userId);
      if (assignmentError) return responseError(assignmentError.message, 400);
      const conflicts = assignedTables.filter(n => (otherProfiles || []).some(p => (p.assigned_tables || []).includes(n)));
      if (conflicts.length) return responseError(`Already assigned table(s): ${conflicts.join(", ")}. Remove them from the other waiter first.`);
    }
    const { error } = await db.from("staff_profiles").update({ display_name: displayName, role, active, assigned_tables: assignedTables }).eq("user_id", userId);
    if (error) return responseError(error.message, 400);
    return NextResponse.json({ ok: true });
  }

  return responseError("Unknown action.");
}
