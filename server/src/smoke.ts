import { MongoMemoryServer } from "mongodb-memory-server";
import { connectDb } from "./db.js";
import { createApp } from "./index.js";
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

  // Member adds a purchase.
  const purchase = await req(
    "/purchases",
    { method: "POST", body: JSON.stringify({ projectId, amount: 250.5, description: "Concrete mix" }) },
    memberToken0,
  );
  assert(purchase.status === 201, "member logs a purchase");
  const purchaseId = purchase.body._id;

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
  assert(projectPurchasesAfterDelete.body.length === 0, "soft-deleted purchase no longer appears in project purchase list");

  // Analyst can export.
  const exportAll = await req("/purchases/export/all", {}, analystToken0);
  assert(exportAll.status === 200 && typeof exportAll.body === "string" && exportAll.body.includes("project,amount"), "analyst can export CSV");

  // Member cannot export.
  const memberExport = await req("/purchases/export/all", {}, memberToken0);
  assert(memberExport.status === 403, "member cannot export");

  // Audit log has entries for everything above, and admin can read it.
  const auditLog = await req("/audit-log", {}, adminToken0);
  assert(auditLog.status === 200, "admin can read audit log");
  const actions = (auditLog.body as { action: string }[]).map((a) => a.action);
  for (const expected of ["user.create", "project.create", "purchase.create", "purchase.edit", "purchase.delete"]) {
    assert(actions.includes(expected), `audit log contains a ${expected} entry`);
  }
  const editEntry = (auditLog.body as { action: string; before: { amount: number }; after: { amount: number } }[]).find(
    (a) => a.action === "purchase.edit",
  );
  assert(editEntry?.before.amount === 250.5 && editEntry?.after.amount === 275, "purchase.edit audit entry has before/after amounts");

  // Member cannot read audit log.
  const memberAuditLog = await req("/audit-log", {}, memberToken0);
  assert(memberAuditLog.status === 403, "member cannot read audit log");

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
