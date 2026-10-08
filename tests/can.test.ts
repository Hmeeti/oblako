import { describe, expect, it } from "vitest";
import { can } from "../src/lib/auth/can";

const admin = {
  id: "a1",
  platformRole: "studio_admin" as const,
  memberships: [],
};

const ownerA = {
  id: "u1",
  platformRole: "user" as const,
  memberships: [{ projectId: "proj-a", role: "project_owner" as const }],
};

const editorA = {
  id: "u2",
  platformRole: "user" as const,
  memberships: [{ projectId: "proj-a", role: "project_editor" as const }],
};

const ownerB = {
  id: "u3",
  platformRole: "user" as const,
  memberships: [{ projectId: "proj-b", role: "project_owner" as const }],
};

describe("can() isolation", () => {
  it("studio_admin can manage leads and any project", () => {
    expect(can(admin, "lead:read")).toBe(true);
    expect(can(admin, "project:settings", { projectId: "proj-a" })).toBe(true);
  });

  it("project_owner cannot read other project", () => {
    expect(can(ownerA, "menu:edit", { projectId: "proj-a" })).toBe(true);
    expect(can(ownerA, "menu:edit", { projectId: "proj-b" })).toBe(false);
    expect(can(ownerB, "analytics:read", { projectId: "proj-a" })).toBe(false);
  });

  it("project_editor cannot change settings or billing", () => {
    expect(can(editorA, "menu:edit", { projectId: "proj-a" })).toBe(true);
    expect(can(editorA, "project:settings", { projectId: "proj-a" })).toBe(false);
    expect(can(editorA, "project:billing", { projectId: "proj-a" })).toBe(false);
    expect(can(editorA, "lead:read")).toBe(false);
  });
});
