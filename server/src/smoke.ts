import { MongoMemoryServer } from "mongodb-memory-server";
import { connectDb } from "./db.js";
import { createApp } from "./index.js";
import { seedDefaultRoles } from "./seedDefaultRoles.js";
import { seedOwner } from "./seedOwner.js";

process.env.JWT_SECRET = "test-secret-at-least-32-characters-long";
process.env.OWNER_NAME = "Tushar";
process.env.OWNER_EMAIL = "owner@cpa.test";
process.env.OWNER_PASSWORD = "owner-temp-pw";

let failures = 0;
function assert(condition: boolean, message: string) {
  if (!condition) {
    failures++;
    console.error(`FAIL: ${message}`);
  } else {
    console.log(`ok: ${message}`);
  }
}

async function main() {
  const mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri());
  await seedOwner();
  await seedDefaultRoles();

  const app = createApp();
  const server = app.listen(0);
  const port = (server.address() as { port: number }).port;
  const base = `http://localhost:${port}`;

  async function req(path: string, opts: RequestInit = {}, token?: string) {
    const res = await fetch(base + path, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...opts.headers,
      },
    });
    const isCsv = res.headers.get("content-type")?.includes("text/csv");
    const body = res.status === 204 ? null : isCsv ? await res.text() : await res.json();
    return { status: res.status, body };
  }

  // For binary responses (xlsx) where res.json()/res.text() in req() above
  // would misparse the body — just check status/content-type/size.
  async function reqBinary(path: string, token?: string) {
    const res = await fetch(base + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const buffer = await res.arrayBuffer();
    return { status: res.status, contentType: res.headers.get("content-type"), byteLength: buffer.byteLength };
  }

  // Owner logs in with the seeded temp password, must change it before anything else works.
  const ownerLogin = await req("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "owner@cpa.test", password: "owner-temp-pw" }),
  });
  assert(
    ownerLogin.status === 200 && ownerLogin.body.user.mustChangePassword === true && !!ownerLogin.body.refreshToken,
    "owner login returns mustChangePassword=true and a refresh token",
  );
  const ownerToken = ownerLogin.body.accessToken;

  const blockedCreate = await req("/projects", { method: "POST", body: JSON.stringify({ name: "x" }) }, ownerToken);
  assert(blockedCreate.status === 403 && blockedCreate.body.code === "MUST_CHANGE_PASSWORD", "blocked from app routes until password changed");

  const changePw = await req(
    "/auth/change-password",
    { method: "POST", body: JSON.stringify({ currentPassword: "owner-temp-pw", newPassword: "owner-real-password" }) },
    ownerToken,
  );
  assert(changePw.status === 200, "owner changes password successfully");

  // Re-login with the token that's now unblocked (mustChangePassword flips server-side, no need to re-login, but let's confirm).
  const projectsNowAllowed = await req("/projects", { method: "GET" }, ownerToken);
  assert(projectsNowAllowed.status === 200, "same token now passes the mustChangePassword gate after change");

  // Owner creates an admin, an analyst, and a member.
  const createAdmin = await req(
    "/users",
    { method: "POST", body: JSON.stringify({ name: "Alice Admin", email: "alice@cpa.test", tempPassword: "temp-pw-123", role: "admin" }) },
    ownerToken,
  );
  assert(createAdmin.status === 201, "owner creates an admin account");

  const createAnalyst = await req(
    "/users",
    { method: "POST", body: JSON.stringify({ name: "Ana Analyst", email: "ana@cpa.test", tempPassword: "temp-pw-123", role: "analyst" }) },
    ownerToken,
  );
  assert(createAnalyst.status === 201, "owner creates an analyst account");

  const createMember = await req(
    "/users",
    { method: "POST", body: JSON.stringify({ name: "Mo Member", email: "mo@cpa.test", tempPassword: "temp-pw-123", role: "member" }) },
    ownerToken,
  );
  assert(createMember.status === 201, "owner creates a member account");

  // Admin cannot create another admin.
  const adminLogin1 = await req("/auth/login", { method: "POST", body: JSON.stringify({ email: "alice@cpa.test", password: "temp-pw-123" }) });
  const adminToken0 = adminLogin1.body.accessToken;
  await req("/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword: "temp-pw-123", newPassword: "alice-real-pw" }) }, adminToken0);
  const adminTryCreateAdmin = await req(
    "/users",
    { method: "POST", body: JSON.stringify({ name: "Bob", email: "bob@cpa.test", tempPassword: "temp-pw-123", role: "admin" }) },
    adminToken0,
  );
  assert(adminTryCreateAdmin.status === 403, "admin is blocked from creating another admin");

  // Member and analyst log in and change password too. Member logs in with
  // rememberMe: true — used below for the refresh-token flow.
  const memberLogin = await req("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "mo@cpa.test", password: "temp-pw-123", rememberMe: true }),
  });
  const memberToken0 = memberLogin.body.accessToken;
  let memberRefreshToken = memberLogin.body.refreshToken;
  await req("/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword: "temp-pw-123", newPassword: "mo-real-pw" }) }, memberToken0);

  const analystLogin = await req("/auth/login", { method: "POST", body: JSON.stringify({ email: "ana@cpa.test", password: "temp-pw-123" }) });
  const analystToken0 = analystLogin.body.accessToken;
  await req("/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword: "temp-pw-123", newPassword: "ana-real-pw" }) }, analystToken0);

  // --- Refresh token rotation + reuse detection ---

  const refresh1 = await req("/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken: memberRefreshToken }) });
  assert(refresh1.status === 200 && !!refresh1.body.accessToken && !!refresh1.body.refreshToken, "refresh token exchanges for a new access + refresh token");
  const rotatedRefreshToken = refresh1.body.refreshToken;
  assert(rotatedRefreshToken !== memberRefreshToken, "rotation issues a genuinely new refresh token, not the same one back");

  const newAccessWorks = await req("/projects", {}, refresh1.body.accessToken);
  assert(newAccessWorks.status === 200, "the freshly refreshed access token actually works");

  // Replaying the now-rotated-away original refresh token is reuse — should
  // fail AND nuke every refresh token this user has, including the one we
  // just legitimately got back from refresh1.
  const reusedOldToken = await req("/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken: memberRefreshToken }) });
  assert(reusedOldToken.status === 401, "replaying an already-rotated refresh token is rejected");

  const rotatedTokenNowDead = await req("/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken: rotatedRefreshToken }) });
  assert(rotatedTokenNowDead.status === 401, "reuse detection revoked the legitimately-rotated token too, as a precaution");

  // --- Business logic (projects/purchases/roles), using fresh tokens ---

  // Member creates a project -> forbidden.
  const memberCreateProject = await req("/projects", { method: "POST", body: JSON.stringify({ name: "Warehouse Fit-out" }) }, memberToken0);
  assert(memberCreateProject.status === 403, "member cannot create a project");

  // Admin creates a project.
  const project = await req("/projects", { method: "POST", body: JSON.stringify({ name: "Warehouse Fit-out" }) }, adminToken0);
  assert(project.status === 201, "admin creates a project");
  const projectId = project.body._id;

  // A malformed id must fail cleanly (400), not crash the process — a
  // Mongoose CastError thrown inside an async handler is an unhandled
  // rejection unless caught, and previously took the whole server down.
  const malformedGet = await req("/projects/not-a-valid-object-id", {}, adminToken0);
  assert(malformedGet.status === 400, "GET /projects/:id with a malformed id returns 400, not a crash");
  const stillAlive = await req("/health", {});
  assert(stillAlive.status === 200, "server is still up after the malformed-id request");

  // Member adds a purchase, with quantity/unit/vendor/category/notes.
  const purchaseKey = "idem-key-concrete-mix-1";
  const purchase = await req(
    "/purchases",
    {
      method: "POST",
      body: JSON.stringify({
        projectId,
        amount: 250.5,
        description: "Concrete mix",
        quantity: 5,
        unit: "bag",
        vendor: "ACME Supplies",
        category: "materials",
        notes: "Delivered to site gate 2",
        idempotencyKey: purchaseKey,
      }),
    },
    memberToken0,
  );
  assert(
    purchase.status === 201 && purchase.body.quantity === 5 && purchase.body.unit === "bag" && purchase.body.vendor === "ACME Supplies",
    "member logs a purchase with quantity/unit/vendor/category/notes",
  );
  assert(purchase.body.status === "pending", "a member's purchase starts pending review, not auto-approved");
  const purchaseId = purchase.body._id;

  // Retrying the exact same idempotency key (a dropped response, a
  // re-synced offline item) must return the SAME purchase, not create a
  // second one — this is the whole point of the key.
  const retriedPurchase = await req(
    "/purchases",
    { method: "POST", body: JSON.stringify({ projectId, amount: 250.5, description: "Concrete mix", idempotencyKey: purchaseKey }) },
    memberToken0,
  );
  const purchasesAfterRetry = await req(`/purchases/project/${projectId}`, {}, adminToken0);
  assert(
    retriedPurchase.status === 200 &&
      retriedPurchase.body._id === purchaseId &&
      purchasesAfterRetry.body.items.filter((p: { _id: string }) => p._id === purchaseId).length === 1,
    "retrying the same idempotencyKey returns the original purchase, no duplicate created",
  );

  // quantity/unit must be provided together, and unit must be a known one.
  const mismatchedQtyUnit = await req(
    "/purchases",
    { method: "POST", body: JSON.stringify({ projectId, amount: 5, description: "x", quantity: 2, idempotencyKey: "idem-bad-1" }) },
    memberToken0,
  );
  assert(mismatchedQtyUnit.status === 400, "quantity without a unit is rejected");
  const badUnit = await req(
    "/purchases",
    { method: "POST", body: JSON.stringify({ projectId, amount: 5, description: "x", quantity: 2, unit: "smoots", idempotencyKey: "idem-bad-2" }) },
    memberToken0,
  );
  assert(badUnit.status === 400, "an unrecognized unit is rejected");

  // A pending purchase must NOT move the project's total yet — it's still
  // awaiting review.
  const projectsWhilePending = await req("/projects", {}, adminToken0);
  const warehouseWhilePending = (projectsWhilePending.body.items as { _id: string; totalSpent: number }[]).find((p) => p._id === projectId);
  assert(warehouseWhilePending?.totalSpent === 0, "a pending purchase doesn't count toward totalSpent yet");

  // --- Review workflow: only owner/admin can approve/reject, and only a pending purchase ---

  const memberTryReview = await req(`/purchases/${purchaseId}/review`, { method: "PATCH", body: JSON.stringify({ action: "approve" }) }, memberToken0);
  assert(memberTryReview.status === 403, "member cannot review a purchase");
  const analystTryReview = await req(`/purchases/${purchaseId}/review`, { method: "PATCH", body: JSON.stringify({ action: "approve" }) }, analystToken0);
  assert(analystTryReview.status === 403, "analyst cannot review a purchase");

  const pendingQueue = await req("/purchases/pending", {}, adminToken0);
  assert(
    pendingQueue.status === 200 && (pendingQueue.body.items as { _id: string }[]).some((p) => p._id === purchaseId),
    "the pending review queue includes the member's newly logged purchase",
  );

  const rejectWithoutReason = await req(`/purchases/${purchaseId}/review`, { method: "PATCH", body: JSON.stringify({ action: "reject" }) }, adminToken0);
  assert(rejectWithoutReason.status === 400, "rejecting requires a reason");

  const approve = await req(`/purchases/${purchaseId}/review`, { method: "PATCH", body: JSON.stringify({ action: "approve" }) }, adminToken0);
  assert(approve.status === 200 && approve.body.status === "approved", "admin approves the pending purchase");

  const reReview = await req(`/purchases/${purchaseId}/review`, { method: "PATCH", body: JSON.stringify({ action: "approve" }) }, adminToken0);
  assert(reReview.status === 409, "reviewing an already-reviewed purchase is rejected as a conflict");

  // The project list's aggregated totalSpent must reflect real, approved
  // purchases — this specifically regression-tests a bug where the totals
  // aggregation silently matched nothing (Purchase.projectId is a string,
  // Project._id is an ObjectId, and .aggregate() doesn't auto-cast between
  // them the way .find() does).
  const projectsWithTotal = await req("/projects", {}, adminToken0);
  const warehouseProject = (projectsWithTotal.body.items as { _id: string; totalSpent: number }[]).find((p) => p._id === projectId);
  assert(warehouseProject?.totalSpent === 250.5, "approving a purchase makes it count toward the project's totalSpent");

  // Member tries to edit/delete their own purchase -> forbidden.
  const memberEdit = await req("/purchases/" + purchaseId, { method: "PATCH", body: JSON.stringify({ amount: 1 }) }, memberToken0);
  assert(memberEdit.status === 403, "member cannot edit their own purchase");
  const memberDelete = await req("/purchases/" + purchaseId, { method: "DELETE" }, memberToken0);
  assert(memberDelete.status === 403, "member cannot delete their own purchase");

  // Analyst tries to add a purchase -> forbidden (view+export only).
  const analystAdd = await req(
    "/purchases",
    { method: "POST", body: JSON.stringify({ projectId, amount: 10, description: "nope" }) },
    analystToken0,
  );
  assert(analystAdd.status === 403, "analyst cannot add a purchase");

  // Admin edits the purchase (fraud-proofing: check audit log captures before/after).
  const adminEdit = await req("/purchases/" + purchaseId, { method: "PATCH", body: JSON.stringify({ amount: 275 }) }, adminToken0);
  assert(adminEdit.status === 200 && adminEdit.body.amount === 275, "admin edits the purchase amount");

  // Admin soft-deletes the purchase; it should vanish from normal views but the audit trail should have both the original and edited amounts.
  const adminDelete = await req("/purchases/" + purchaseId, { method: "DELETE" }, adminToken0);
  assert(adminDelete.status === 204, "admin soft-deletes the purchase");

  const projectPurchasesAfterDelete = await req(`/purchases/project/${projectId}`, {}, adminToken0);
  assert(projectPurchasesAfterDelete.body.items.length === 0, "soft-deleted purchase no longer appears in project purchase list");

  // A second purchase, rejected instead of approved, should never count —
  // and, unlike a soft-deleted one, it still shows up in the plain project
  // purchase list above (only /search and /export filter to approved-only),
  // so this runs after that assertion rather than before it.
  const purchase2 = await req(
    "/purchases",
    { method: "POST", body: JSON.stringify({ projectId, amount: 40, description: "Questionable receipt", idempotencyKey: "idem-key-reject-1" }) },
    memberToken0,
  );
  const purchase2Id = purchase2.body._id;
  const reject = await req(
    `/purchases/${purchase2Id}/review`,
    { method: "PATCH", body: JSON.stringify({ action: "reject", reason: "no matching receipt" }) },
    adminToken0,
  );
  assert(reject.status === 200 && reject.body.status === "rejected" && reject.body.rejectionReason === "no matching receipt", "admin rejects a purchase with a reason");
  const projectsAfterReject = await req("/projects", {}, adminToken0);
  const warehouseAfterReject = (projectsAfterReject.body.items as { _id: string; totalSpent: number }[]).find((p) => p._id === projectId);
  assert(warehouseAfterReject?.totalSpent === 0, "a rejected purchase never counts toward totalSpent");
  const pendingQueueAfterReject = await req("/purchases/pending", {}, adminToken0);
  assert(
    !(pendingQueueAfterReject.body.items as { _id: string }[]).some((p) => p._id === purchase2Id),
    "a reviewed purchase drops out of the pending queue",
  );

  // A deleted purchase must also drop out of the project's totalSpent —
  // both the list endpoint's aggregation and the single-project GET the
  // client refetches after any purchase change.
  const projectsAfterDelete = await req("/projects", {}, adminToken0);
  const warehouseAfterDelete = (projectsAfterDelete.body.items as { _id: string; totalSpent: number }[]).find((p) => p._id === projectId);
  assert(warehouseAfterDelete?.totalSpent === 0, "deleting a purchase subtracts it from the project list's totalSpent");
  const projectByIdAfterDelete = await req(`/projects/${projectId}`, {}, adminToken0);
  assert(projectByIdAfterDelete.body.totalSpent === 0, "deleting a purchase subtracts it from GET /projects/:id totalSpent too");

  // --- Reports preview: paginated, same filters as export ---

  const previewAll = await req("/purchases/search", {}, analystToken0);
  assert(previewAll.status === 200 && Array.isArray(previewAll.body.items) && typeof previewAll.body.totalAmount === "number", "analyst can preview matching purchases before exporting");
  const previewScoped = await req(`/purchases/search?projectIds=${projectId}`, {}, analystToken0);
  assert(previewScoped.body.items.length === 0 && previewScoped.body.totalAmount === 0, "preview for the now-empty project reflects the soft-deleted purchase too");
  const previewForbidden = await req("/purchases/search", {}, memberToken0);
  assert(previewForbidden.status === 403, "member cannot preview reports (view+export only for analyst/admin/owner)");

  // --- Export: csv, xlsx, xlsx+audit-trail ---

  const exportCsv = await req("/purchases/export?format=csv", {}, analystToken0);
  assert(exportCsv.status === 200 && typeof exportCsv.body === "string" && exportCsv.body.includes("project,amount"), "analyst can export CSV");

  const exportXlsx = await reqBinary("/purchases/export?format=xlsx", analystToken0);
  assert(
    exportXlsx.status === 200 &&
      Boolean(exportXlsx.contentType?.includes("spreadsheetml")) &&
      exportXlsx.byteLength > 1000,
    "analyst can export a real .xlsx workbook",
  );

  const exportXlsxScopedNoAudit = await reqBinary(`/purchases/export?format=xlsx&projectIds=${projectId}`, adminToken0);
  const exportXlsxScopedWithAudit = await reqBinary(`/purchases/export?format=xlsx&projectIds=${projectId}&includeAuditTrail=true`, adminToken0);
  assert(
    exportXlsxScopedWithAudit.status === 200 && exportXlsxScopedWithAudit.byteLength > exportXlsxScopedNoAudit.byteLength,
    "xlsx export with includeAuditTrail is a genuinely bigger (two-sheet) workbook than the same scope without it",
  );

  // Member cannot export.
  const memberExport = await req("/purchases/export?format=csv", {}, memberToken0);
  assert(memberExport.status === 403, "member cannot export");

  // --- Cross-project recent activity feed ---

  const recent = await req("/purchases/recent", {}, adminToken0);
  assert(recent.status === 200 && Array.isArray(recent.body.items), "recent activity feed returns a paginated list");

  // --- Pagination + search on projects, scaled to a few extra rows ---

  for (const name of ["Site Survey Alpha", "Site Survey Beta", "Roofing Job"]) {
    await req("/projects", { method: "POST", body: JSON.stringify({ name }) }, adminToken0);
  }
  const searchedProjects = await req(`/projects?search=${encodeURIComponent("Site Survey")}`, {}, adminToken0);
  assert(
    searchedProjects.status === 200 && searchedProjects.body.items.every((p: { name: string }) => p.name.includes("Site Survey")),
    "project search filters by name",
  );
  const pagedProjects = await req("/projects?page=1&limit=2", {}, adminToken0);
  assert(pagedProjects.status === 200 && pagedProjects.body.items.length === 2 && pagedProjects.body.hasMore === true, "project list respects page/limit and reports hasMore");

  // Audit log has entries for everything above, and admin can read it — paginated too.
  const auditLog = await req("/audit-log", {}, adminToken0);
  assert(auditLog.status === 200 && Array.isArray(auditLog.body.items), "admin can read paginated audit log");
  const actions = (auditLog.body.items as { action: string }[]).map((a) => a.action);
  for (const expected of ["user.create", "project.create", "purchase.create", "purchase.edit", "purchase.delete", "purchase.approve", "purchase.reject"]) {
    assert(actions.includes(expected), `audit log contains a ${expected} entry`);
  }
  const editEntry = (auditLog.body.items as { action: string; before: { amount: number }; after: { amount: number } }[]).find(
    (a) => a.action === "purchase.edit",
  );
  assert(editEntry?.before.amount === 250.5 && editEntry?.after.amount === 275, "purchase.edit audit entry has before/after amounts");

  // Project-scoped audit trail (Project Detail's "Activity" section) —
  // only this project's own entries, not other projects' or user-mgmt ones.
  const projectAuditLog = await req(`/audit-log?projectId=${projectId}`, {}, adminToken0);
  const projectActions = (projectAuditLog.body.items as { action: string }[]).map((a) => a.action);
  assert(
    projectAuditLog.status === 200 &&
      ["project.create", "purchase.create", "purchase.approve", "purchase.edit", "purchase.delete"].every((a) => projectActions.includes(a)) &&
      !projectActions.includes("user.create"),
    "audit log scoped to one project includes its own history but not unrelated user-management entries",
  );

  // Member cannot read audit log.
  const memberAuditLog = await req("/audit-log", {}, memberToken0);
  assert(memberAuditLog.status === 403, "member cannot read audit log");

  // --- Audit log filters (person/action/date) + export ---

  const meRes = await req("/auth/me", {}, adminToken0);
  const adminId = meRes.body.id;

  const byActor = await req(`/audit-log?actorId=${adminId}`, {}, adminToken0);
  assert(
    byActor.status === 200 && (byActor.body.items as { actorId: string }[]).every((a) => a.actorId === adminId),
    "audit log filters by actorId (person)",
  );

  const byAction = await req("/audit-log?action=purchase.approve", {}, adminToken0);
  assert(
    byAction.status === 200 && (byAction.body.items as { action: string }[]).every((a) => a.action === "purchase.approve"),
    "audit log filters by action",
  );

  const farFuture = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const byDateExcludesEverything = await req(`/audit-log?from=${farFuture}`, {}, adminToken0);
  assert(byDateExcludesEverything.status === 200 && byDateExcludesEverything.body.items.length === 0, "audit log date filter (from in the future) excludes existing entries");

  const combinedFilter = await req(`/audit-log?actorId=${adminId}&action=project.create`, {}, adminToken0);
  assert(
    combinedFilter.status === 200 && combinedFilter.body.items.length > 0 && combinedFilter.body.items.every((a: { action: string }) => a.action === "project.create"),
    "audit log filters combine (actorId + action) with AND",
  );

  const auditExport = await reqBinary("/audit-log/export", adminToken0);
  assert(
    auditExport.status === 200 &&
      auditExport.contentType?.includes("spreadsheetml") === true &&
      auditExport.byteLength > 0,
    "audit log exports as a non-empty .xlsx workbook",
  );

  const memberAuditExport = await reqBinary("/audit-log/export", memberToken0);
  assert(memberAuditExport.status === 403, "member cannot export the audit log");

  // --- Per-project auto-approve threshold ---

  const thresholdProject = await req("/projects", { method: "POST", body: JSON.stringify({ name: "Small Repairs" }) }, adminToken0);
  const thresholdProjectId = thresholdProject.body._id;
  assert(thresholdProject.body.autoApproveThreshold === 0, "a new project defaults autoApproveThreshold to 0 (always review)");

  const raiseThreshold = await req(
    `/projects/${thresholdProjectId}`,
    { method: "PATCH", body: JSON.stringify({ name: "Small Repairs", icon: "🔧", autoApproveThreshold: 100 }) },
    adminToken0,
  );
  assert(raiseThreshold.status === 200 && raiseThreshold.body.autoApproveThreshold === 100, "admin raises a project's auto-approve threshold");

  const thresholdAuditLog = await req(`/audit-log?projectId=${thresholdProjectId}&action=project.auto_approve_threshold_change`, {}, adminToken0);
  const thresholdEntry = thresholdAuditLog.body.items[0] as { before: { autoApproveThreshold: number }; after: { autoApproveThreshold: number } };
  assert(
    thresholdAuditLog.body.items.length === 1 && thresholdEntry.before.autoApproveThreshold === 0 && thresholdEntry.after.autoApproveThreshold === 100,
    "raising the threshold logs a from -> to audit entry",
  );

  const underThreshold = await req(
    "/purchases",
    { method: "POST", body: JSON.stringify({ projectId: thresholdProjectId, amount: 50, description: "Small hardware", idempotencyKey: "idem-small-1" }) },
    memberToken0,
  );
  assert(underThreshold.body.status === "approved", "a member's purchase at or under the threshold auto-approves");

  const overThreshold = await req(
    "/purchases",
    { method: "POST", body: JSON.stringify({ projectId: thresholdProjectId, amount: 150, description: "Bigger hardware", idempotencyKey: "idem-big-1" }) },
    memberToken0,
  );
  assert(overThreshold.body.status === "pending", "a member's purchase over the threshold still enters the review queue");

  // Team user list is paginated + searchable too.
  const searchedUsers = await req("/users?search=Admin", {}, ownerToken);
  assert(
    searchedUsers.status === 200 && searchedUsers.body.items.every((u: { name: string }) => u.name.includes("Admin")),
    "user search filters by name",
  );

  // --- Dynamic roles (Role collection) ---

  const memberTryListRoles = await req("/roles", {}, memberToken0);
  assert(memberTryListRoles.status === 403, "member cannot list roles");

  const adminTryCreateRole = await req(
    "/roles",
    { method: "POST", body: JSON.stringify({ name: "Auditor", permissions: { export: true }, rank: 50 }) },
    adminToken0,
  );
  assert(adminTryCreateRole.status === 403, "admin (non-owner) is blocked from creating a role");

  // manageUsers/manageRoles aren't real keys on RolePermissions at all — a
  // request body claiming them is silently ignored, not rejected, since
  // there's no schema field for them to land on.
  const createRole = await req(
    "/roles",
    {
      method: "POST",
      body: JSON.stringify({ name: "Auditor", permissions: { export: true, seeActivityLog: true, manageUsers: true }, rank: 500 }),
    },
    ownerToken,
  );
  assert(
    createRole.status === 201 &&
      createRole.body.rank === 99 && // clamped down from 500 to MAX_CUSTOM_ROLE_RANK
      createRole.body.permissions.export === true &&
      createRole.body.permissions.seeActivityLog === true &&
      createRole.body.permissions.manageUsers === undefined,
    "owner creates a custom role; rank is clamped below admin and manageUsers can't be smuggled in",
  );
  const auditorRoleId = createRole.body.id;

  const listRoles = await req("/roles", {}, ownerToken);
  assert(
    listRoles.status === 200 &&
      listRoles.body.some((r: { id: string }) => r.id === "member") &&
      listRoles.body.some((r: { id: string }) => r.id === "analyst") &&
      listRoles.body.some((r: { id: string }) => r.id === auditorRoleId),
    "role list includes the seeded defaults and the new custom role",
  );

  const createAuditorUser = await req(
    "/users",
    { method: "POST", body: JSON.stringify({ name: "Ray Auditor", email: "ray@cpa.test", tempPassword: "temp-pw-123", role: auditorRoleId }) },
    ownerToken,
  );
  assert(createAuditorUser.status === 201 && createAuditorUser.body.role === auditorRoleId, "owner creates a user with a custom role");

  const deleteInUseRole = await req(`/roles/${auditorRoleId}`, { method: "DELETE" }, ownerToken);
  assert(deleteInUseRole.status === 409, "deleting a role still assigned to a user is blocked");

  const reassignAuditor = await req(
    `/users/${createAuditorUser.body.id}/role`,
    { method: "PATCH", body: JSON.stringify({ role: "analyst" }) },
    ownerToken,
  );
  assert(reassignAuditor.status === 200 && reassignAuditor.body.role === "analyst", "user is reassigned off the custom role");

  const deleteNowUnusedRole = await req(`/roles/${auditorRoleId}`, { method: "DELETE" }, ownerToken);
  assert(deleteNowUnusedRole.status === 204, "deleting the now-unused custom role succeeds");

  const createUserWithDeletedRole = await req(
    "/users",
    { method: "POST", body: JSON.stringify({ name: "Late Auditor", email: "late@cpa.test", tempPassword: "temp-pw-123", role: auditorRoleId }) },
    ownerToken,
  );
  assert(createUserWithDeletedRole.status === 400, "a deleted role can no longer be assigned to a new user");

  // A fresh member login, to test that deactivation revokes refresh tokens too (separate from the reuse-detection test above, which already burned the first one).
  const memberLogin2 = await req("/auth/login", { method: "POST", body: JSON.stringify({ email: "mo@cpa.test", password: "mo-real-pw" }) });
  const memberRefreshToken2 = memberLogin2.body.refreshToken;

  // Owner deactivates the member; their access token should stop working immediately...
  const memberUserId = createMember.body.id;
  const deactivate = await req(`/users/${memberUserId}`, { method: "DELETE" }, ownerToken);
  assert(deactivate.status === 204, "owner deactivates the member account");
  const deactivatedAccess = await req("/projects", {}, memberToken0);
  assert(deactivatedAccess.status === 401, "deactivated member's existing access token is rejected immediately");

  // ...and so should their refresh token, not just their access token.
  const deactivatedRefresh = await req("/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken: memberRefreshToken2 }) });
  assert(deactivatedRefresh.status === 401, "deactivating a user also revokes their refresh token");

  // Admin cannot deactivate another admin or the owner.
  const secondAdmin = await req(
    "/users",
    { method: "POST", body: JSON.stringify({ name: "Second Admin", email: "second@cpa.test", tempPassword: "temp-pw-123", role: "admin" }) },
    ownerToken,
  );
  const adminTryDeactivateAdmin = await req(`/users/${secondAdmin.body.id}`, { method: "DELETE" }, adminToken0);
  assert(adminTryDeactivateAdmin.status === 403, "admin cannot deactivate another admin");

  // Logout revokes the presented refresh token.
  const analystLoginForLogout = await req("/auth/login", { method: "POST", body: JSON.stringify({ email: "ana@cpa.test", password: "ana-real-pw" }) });
  const logoutResult = await req(
    "/auth/logout",
    { method: "POST", body: JSON.stringify({ refreshToken: analystLoginForLogout.body.refreshToken }) },
    analystLoginForLogout.body.accessToken,
  );
  assert(logoutResult.status === 204, "logout succeeds");
  const refreshAfterLogout = await req("/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken: analystLoginForLogout.body.refreshToken }) });
  assert(refreshAfterLogout.status === 401, "refresh token is dead immediately after logout");

  // Login rate limiting: default is 10 attempts / 15 min per IP. Hammer bad
  // credentials until we either see a 429 or exceed the configured max.
  let sawRateLimited = false;
  for (let i = 0; i < 10; i++) {
    const attempt = await req("/auth/login", { method: "POST", body: JSON.stringify({ email: "nobody@cpa.test", password: "wrong" }) });
    if (attempt.status === 429) {
      sawRateLimited = true;
      break;
    }
  }
  assert(sawRateLimited, "repeated login attempts eventually get rate-limited (429)");

  server.close();
  await mongod.stop();

  console.log(failures === 0 ? "\nAll smoke checks passed." : `\n${failures} smoke check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
