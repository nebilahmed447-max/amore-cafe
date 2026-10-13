"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw, Save, UserPlus, Users, Utensils, Trash2, ShieldCheck, UserX, RotateCcw } from "lucide-react";
import { supabase } from "@/supabase";

type CafeTable = { table_number: number; label: string; created_at?: string };
type Staff = { user_id: string; display_name: string; role: "manager" | "waiter" | "delivery"; active: boolean; assigned_tables: number[]; created_at: string; email: string };
type Draft = { display_name: string; role: "waiter" | "delivery"; active: boolean; assigned_tables: number[] };

export default function StaffTableManager() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [tables, setTables] = useState<CafeTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [tableLabel, setTableLabel] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"waiter" | "delivery">("waiter");
  const [newAssigned, setNewAssigned] = useState<number[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const request = useCallback(async (payload?: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Your admin session has expired. Sign in again.");
    const res = await fetch("/api/staff-management", {
      method: payload ? "POST" : "GET",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || "Request failed.");
    return result;
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await request();
      setStaff(result.staff || []);
      setTables(result.tables || []);
      const nextDrafts: Record<string, Draft> = {};
      for (const member of (result.staff || []) as Staff[]) {
        nextDrafts[member.user_id] = {
          display_name: member.display_name || "",
          role: member.role === "delivery" ? "delivery" : "waiter",
          active: Boolean(member.active),
          assigned_tables: Array.isArray(member.assigned_tables) ? member.assigned_tables.map(Number) : [],
        };
      }
      setDrafts(nextDrafts);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load staff and tables."); }
    finally { setLoading(false); }
  }, [request]);

  useEffect(() => { void load(); }, [load]);

  async function perform(payload: Record<string, unknown>, success: string) {
    setSaving(true); setError(""); setNotice("");
    try { await request(payload); setNotice(success); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not save changes."); }
    finally { setSaving(false); }
  }

  async function addTable(e: FormEvent) {
    e.preventDefault();
    const number = Number(tableNumber);
    await perform({ action: "create_table", table_number: number, label: tableLabel.trim() || `Table ${number}` }, `Table ${number} added.`);
    setTableNumber(""); setTableLabel("");
  }

  async function removeTable(table: CafeTable) {
    if (!confirm(`Remove ${table.label || `Table ${table.table_number}`}? It must not be assigned to an active waiter.`)) return;
    await perform({ action: "delete_table", table_number: table.table_number }, `Table ${table.table_number} removed.`);
  }

  async function addStaff(e: FormEvent) {
    e.preventDefault();
    await perform({ action: "create_staff", display_name: name.trim(), email: email.trim(), password, role, assigned_tables: role === "waiter" ? newAssigned : [] }, `${role === "waiter" ? "Waiter" : "Delivery staff"} account created.`);
    setName(""); setEmail(""); setPassword(""); setNewAssigned([]); setRole("waiter");
  }

  function changeDraft(id: string, patch: Partial<Draft>) {
    setDrafts(current => ({ ...current, [id]: { ...current[id], ...patch } }));
  }
  function toggleAssignment(values: number[], n: number) { return values.includes(n) ? values.filter(value => value !== n) : [...values, n].sort((a,b) => a-b); }

  async function saveStaff(member: Staff) {
    const draft = drafts[member.user_id];
    await perform({ action: "update_staff", user_id: member.user_id, ...draft, assigned_tables: draft.role === "waiter" ? draft.assigned_tables : [] }, `${draft.display_name} updated.`);
  }

  async function toggleStaffAccess(member: Staff, draft: Draft) {
    const nextActive = !draft.active;
    const label = draft.display_name.trim() || member.email || "Staff member";
    await perform({
      action: "update_staff",
      user_id: member.user_id,
      display_name: label,
      role: draft.role,
      active: nextActive,
      assigned_tables: draft.role === "waiter" ? draft.assigned_tables : [],
    }, nextActive ? `${label} reactivated.` : `${label} deactivated. They can no longer use the staff panel.`);
  }

  async function deleteStaff(member: Staff) {
    const label = member.display_name || member.email || "this staff member";
    if (!confirm(`Delete ${label}? They will lose staff-panel access and their staff profile will be removed. Historical orders are intended to remain. This cannot be undone from the admin panel.`)) return;
    await perform({ action: "delete_staff", user_id: member.user_id }, `${label} deleted from staff management.`);
  }

  return <div className="staff-manager-wrap">
    <div className="staff-manager-intro"><div><span className="admin-eyebrow">STAFF & TABLES</span><h2>Manage your team</h2><p>Add as many tables and staff accounts as you need. Assign each dining table to one active waiter from here—no SQL edits for everyday changes.</p></div><button className="admin-secondary" onClick={() => void load()} disabled={loading}><RefreshCw size={15} className={loading ? "spin" : ""}/> Refresh</button></div>
    {error && <div className="staff-manager-alert error">{error}</div>}{notice && <div className="staff-manager-alert success">{notice}</div>}

    <div className="staff-manager-grid">
      <section className="admin-panel staff-manager-section"><div className="panel-head"><div><span className="admin-eyebrow">DINING ROOM</span><h2><Utensils size={19}/> Tables <span className="order-count">{tables.length}</span></h2></div></div>
        <form className="staff-add-table" onSubmit={addTable}><label>Table number<input type="number" min="1" max="1000000" step="1" value={tableNumber} onChange={e=>setTableNumber(e.target.value)} placeholder="e.g. 19" required/></label><label>Display name (optional)<input value={tableLabel} onChange={e=>setTableLabel(e.target.value)} placeholder="e.g. Window table" maxLength={80}/></label><button className="admin-primary" disabled={saving}><Plus size={16}/> Add table</button></form>
        {loading ? <p className="staff-manager-muted">Loading tables…</p> : tables.length ? <div className="staff-table-list">{tables.map(table=><div className="staff-table-chip" key={table.table_number}><span><b>{table.label || `Table ${table.table_number}`}</b><small>Table #{table.table_number}</small></span><button type="button" title={`Remove table ${table.table_number}`} aria-label={`Remove table ${table.table_number}`} onClick={()=>void removeTable(table)} disabled={saving}><Trash2 size={15}/></button></div>)}</div> : <div className="staff-manager-empty">No tables yet. Add your first dining table above.</div>}
      </section>

      <section className="admin-panel staff-manager-section"><div className="panel-head"><div><span className="admin-eyebrow">NEW TEAM MEMBER</span><h2><UserPlus size={19}/> Add staff account</h2></div></div><p className="staff-manager-muted">Create login credentials here. The staff member can sign in at <b>/waiter</b> or <b>/delivery</b>.</p>
        <form className="staff-create-form" onSubmit={addStaff}><label>Full name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Staff member name" maxLength={100} required/></label><label>Email / username<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="staff@example.com" autoComplete="off" required/></label><label>Temporary password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters" minLength={8} autoComplete="new-password" required/></label><label>Role<select value={role} onChange={e=>{setRole(e.target.value as "waiter"|"delivery");if(e.target.value==="delivery")setNewAssigned([])}}><option value="waiter">Waiter</option><option value="delivery">Delivery staff</option></select></label>
          {role === "waiter" && <div className="staff-assignment-picker"><b>Assign tables <span>({newAssigned.length} selected)</span></b>{tables.length ? <div className="staff-assignment-grid">{tables.map(table=><label key={table.table_number}><input type="checkbox" checked={newAssigned.includes(table.table_number)} onChange={()=>setNewAssigned(current=>toggleAssignment(current,table.table_number))}/><span>{table.label || `Table ${table.table_number}`}</span></label>)}</div> : <p>Add tables first, then assign them.</p>}</div>}
          <button className="admin-primary" disabled={saving || (role === "waiter" && !tables.length)}><UserPlus size={16}/> {saving ? "Saving…" : "Create staff account"}</button><small>The account is created as confirmed in Supabase Auth. Share the password securely and ask staff to change it after first sign-in.</small>
        </form>
      </section>
    </div>

    <section className="admin-panel staff-manager-section staff-roster"><div className="panel-head"><div><span className="admin-eyebrow">TEAM ROSTER</span><h2><Users size={19}/> Staff and assignments <span className="order-count">{staff.length}</span></h2></div></div>
      {loading ? <p className="staff-manager-muted">Loading staff…</p> : staff.length ? <div className="staff-roster-list">{staff.map(member=>{
        if (member.role === "manager") return <article className="staff-roster-card manager" key={member.user_id}><div className="staff-roster-top"><div><b>{member.display_name || "Cafe manager"}</b><small>{member.email}</small></div><span className="staff-role-badge manager"><ShieldCheck size={13}/> Manager</span></div><p className="staff-manager-muted">Manager access is protected and cannot be edited from this staff screen.</p></article>;
        const draft = drafts[member.user_id] || { display_name: member.display_name, role: member.role === "delivery" ? "delivery" as const : "waiter" as const, active: member.active, assigned_tables: member.assigned_tables || [] };
        return <article className="staff-roster-card" key={member.user_id}><div className="staff-roster-top"><div><b>{member.display_name || "Staff member"}</b><small>{member.email}</small></div><span className={`staff-role-badge ${draft.active ? "active" : "inactive"}`}>{draft.active ? "Active" : "Inactive"}</span></div>
          <div className="staff-roster-fields"><label>Display name<input value={draft.display_name} onChange={e=>changeDraft(member.user_id,{display_name:e.target.value})} maxLength={100}/></label><label>Role<select value={draft.role} onChange={e=>changeDraft(member.user_id,{role:e.target.value as "waiter"|"delivery",assigned_tables:e.target.value === "delivery" ? [] : draft.assigned_tables})}><option value="waiter">Waiter</option><option value="delivery">Delivery staff</option></select></label><label className="staff-active-toggle"><input type="checkbox" checked={draft.active} onChange={e=>changeDraft(member.user_id,{active:e.target.checked})}/> Account active</label></div>
          {draft.role === "waiter" && <div className="staff-assignment-picker roster-picker"><b>Assigned tables <span>({draft.assigned_tables.length} selected)</span></b>{tables.length ? <div className="staff-assignment-grid">{tables.map(table=><label key={table.table_number}><input type="checkbox" checked={draft.assigned_tables.includes(table.table_number)} onChange={()=>changeDraft(member.user_id,{assigned_tables:toggleAssignment(draft.assigned_tables,table.table_number)})}/><span>{table.label || `Table ${table.table_number}`}</span></label>)}</div> : <p>Add tables above to assign them.</p>}</div>}
          <div className="staff-roster-actions"><span className="staff-manager-muted">{draft.role === "waiter" ? `Tables: ${draft.assigned_tables.length ? draft.assigned_tables.join(", ") : "none assigned"}` : "Handles delivery orders"}</span><div className="staff-roster-buttons"><button type="button" className="admin-secondary small" onClick={()=>void toggleStaffAccess(member,draft)} disabled={saving}>{draft.active ? <><UserX size={15}/> Deactivate</> : <><RotateCcw size={15}/> Reactivate</>}</button><button type="button" className="admin-primary small" onClick={()=>void saveStaff(member)} disabled={saving || !draft.display_name.trim()}><Save size={15}/> Save changes</button><button type="button" className="staff-delete-button" onClick={()=>void deleteStaff(member)} disabled={saving}><Trash2 size={15}/> Delete</button></div></div>
        </article>;
      })}</div> : <div className="staff-manager-empty">No staff accounts yet. Create the first waiter or delivery account above.</div>}
    </section>
    <div className="staff-manager-footnote"><ShieldCheck size={16}/><p>Only an active manager can use this screen. A dining table can be assigned to only one active waiter at a time. Deactivate a staff account for temporary access removal, or use Delete to remove it from this roster and block sign-in. Historical orders are kept.</p></div>
  </div>;
}
