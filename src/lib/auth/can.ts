import type { PlatformRole, ProjectRole, User } from "@prisma/client";

export type Action =
  | "lead:read"
  | "lead:write"
  | "lead:convert"
  | "project:create"
  | "project:read"
  | "project:write"
  | "project:settings"
  | "project:billing"
  | "project:delete"
  | "menu:edit"
  | "menu:publish"
  | "qr:manage"
  | "analytics:read"
  | "user:manage"
  | "setting:manage";

export type AuthUser = Pick<User, "id" | "platformRole"> & {
  memberships?: Array<{ projectId: string; role: ProjectRole }>;
};

export type Resource = {
  projectId?: string;
  ownerId?: string | null;
};

const PROJECT_CAPS: Record<ProjectRole, Action[]> = {
  project_owner: [
    "project:read",
    "project:write",
    "project:settings",
    "menu:edit",
    "menu:publish",
    "qr:manage",
    "analytics:read",
  ],
  project_editor: [
    "project:read",
    "menu:edit",
    "menu:publish",
    "qr:manage",
    "analytics:read",
  ],
};

export function can(
  user: AuthUser | null | undefined,
  action: Action,
  resource: Resource = {},
): boolean {
  if (!user) return false;

  if (user.platformRole === ("studio_admin" as PlatformRole)) {
    return true;
  }

  const studioOnly: Action[] = [
    "lead:read",
    "lead:write",
    "lead:convert",
    "project:create",
    "project:delete",
    "project:billing",
    "user:manage",
    "setting:manage",
  ];
  if (studioOnly.includes(action)) return false;

  if (!resource.projectId) return false;
  const membership = user.memberships?.find(
    (m) => m.projectId === resource.projectId,
  );
  if (!membership) return false;
  return PROJECT_CAPS[membership.role].includes(action);
}

export function assertCan(
  user: AuthUser | null | undefined,
  action: Action,
  resource: Resource = {},
): void {
  if (!can(user, action, resource)) {
    const err = new Error("FORBIDDEN");
    (err as Error & { status: number }).status = 403;
    throw err;
  }
}
