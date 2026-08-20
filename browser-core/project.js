import { randomUUID } from "./crypto-browser.js";

export class ProjectValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProjectValidationError";
  }
}

export const LOCAL_PROJECT_PERMISSION_MODES = Object.freeze([
  "read_write",
  "read_only"
]);

export function getProjectLocalPermissionMode(project) {
  const mode = project?.localPermissions?.mode;

  if (mode === undefined) {
    return "read_write";
  }

  if (!LOCAL_PROJECT_PERMISSION_MODES.includes(mode)) {
    throw new ProjectValidationError("As permissões locais do projeto são inválidas.");
  }

  return mode;
}

export function assertProjectWritable(project) {
  if (!project || typeof project !== "object" || typeof project.id !== "string") {
    throw new ProjectValidationError("O projeto informado é inválido.");
  }

  if (getProjectLocalPermissionMode(project) === "read_only") {
    throw new ProjectValidationError("O projeto está protegido como somente leitura.");
  }
}

export function createProject({ name, id = randomUUID(), now = new Date() }) {
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new ProjectValidationError("Informe um nome para o projeto.");
  }

  const normalizedName = name.trim();
  const timestamp = now.toISOString();

  return Object.freeze({
    schemaVersion: 2,
    id,
    name: normalizedName,
    status: "active",
    localPermissions: Object.freeze({ mode: "read_write" }),
    createdAt: timestamp,
    updatedAt: timestamp,
    history: Object.freeze([
      Object.freeze({
        type: "project.created",
        at: timestamp,
        name: normalizedName
      })
    ])
  });
}

export function applyProjectLocalPermissions({ project, mode, now = new Date() }) {
  if (!project || typeof project !== "object" || typeof project.id !== "string") {
    throw new ProjectValidationError("O projeto informado é inválido.");
  }

  if (!LOCAL_PROJECT_PERMISSION_MODES.includes(mode)) {
    throw new ProjectValidationError("Escolha uma permissão local válida para o projeto.");
  }

  const previousMode = getProjectLocalPermissionMode(project);
  if (previousMode === mode) {
    throw new ProjectValidationError("O projeto já usa essa permissão local.");
  }

  const timestamp = now.toISOString();
  return Object.freeze({
    ...project,
    schemaVersion: Math.max(Number(project.schemaVersion) || 1, 2),
    localPermissions: Object.freeze({ mode }),
    updatedAt: timestamp,
    history: Object.freeze([
      ...(Array.isArray(project.history) ? project.history : []),
      Object.freeze({
        type: "project.local_permissions_changed",
        at: timestamp,
        from: previousMode,
        to: mode
      })
    ])
  });
}

export function archiveProject({ project, now = new Date() }) {
  if (!project || typeof project !== "object" || typeof project.id !== "string") {
    throw new ProjectValidationError("O projeto informado é inválido.");
  }

  if (project.status !== "active") {
    throw new ProjectValidationError("Somente um projeto ativo pode ser arquivado.");
  }

  const timestamp = now.toISOString();
  return Object.freeze({
    ...project,
    status: "archived",
    updatedAt: timestamp,
    history: Object.freeze([
      ...(Array.isArray(project.history) ? project.history : []),
      Object.freeze({
        type: "project.archived",
        at: timestamp
      })
    ])
  });
}
