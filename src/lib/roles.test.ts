import { describe, it, expect } from "vitest";
import { CRM_ROLES, ROLE_OPTIONS, roleLabel, canManageUsers, canEditRole, canDeleteUser, isCrmRole } from "./roles";

describe("papéis — regras da tela de Usuários", () => {
  it("CA-S1-01: só existem os papéis proprietario e admin", () => {
    expect([...CRM_ROLES]).toEqual(["proprietario", "admin"]);
    expect(isCrmRole("vendedor")).toBe(false);
    expect(isCrmRole("proprietário")).toBe(false);
    expect(roleLabel("vendedor")).toBe("Sem papel");
  });

  it("CA-S1-03: proprietário não pode ser removido nem rebaixado pela tela", () => {
    expect(canEditRole("admin", "proprietario")).toBe(false);
    expect(canEditRole("proprietario", "proprietario")).toBe(false);
    expect(canDeleteUser("admin", "proprietario", false)).toBe(false);
    expect(canDeleteUser("proprietario", "proprietario", true)).toBe(false);
  });

  it("CA-S1-03: admin e proprietário gerenciam os demais, mas ninguém remove a si mesmo", () => {
    expect(canManageUsers("proprietario")).toBe(true);
    expect(canManageUsers("admin")).toBe(true);
    expect(canManageUsers(null)).toBe(false);
    expect(canEditRole("admin", "admin")).toBe(true);
    expect(canEditRole("admin", null)).toBe(true);
    expect(canDeleteUser("admin", "admin", false)).toBe(true);
    expect(canDeleteUser("admin", "admin", true)).toBe(false);
    expect(canDeleteUser(null, "admin", false)).toBe(false);
  });

  it("CA-S1-06: o seletor só oferece Admin e os rótulos não têm acento no valor", () => {
    expect(ROLE_OPTIONS.map((o) => o.value)).toEqual(["admin"]);
    expect(roleLabel("proprietario")).toBe("Proprietário");
    expect(roleLabel("admin")).toBe("Admin");
    expect(roleLabel(null)).toBe("Sem papel");
  });
});
