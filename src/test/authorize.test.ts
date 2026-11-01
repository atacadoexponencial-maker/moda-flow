import { describe, it, expect } from "vitest";
import { getCrmRole, isCrmRole, type RoleLookupClient } from "../../supabase/functions/_shared/authorize";

function clientReturning(result: { data: { role?: unknown } | null; error: unknown }): RoleLookupClient & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    from(table) {
      calls.push(table);
      return {
        select() {
          return {
            eq(column, value) {
              calls.push(`${column}=${value}`);
              return { maybeSingle: async () => result };
            },
          };
        },
      };
    },
  };
}

describe("autorização compartilhada das Edge Functions (manage-users, clear-crm)", () => {
  it("CA-S1-05: aceita proprietario e admin", async () => {
    expect(await getCrmRole(clientReturning({ data: { role: "proprietario" }, error: null }), "u1")).toBe("proprietario");
    expect(await getCrmRole(clientReturning({ data: { role: "admin" }, error: null }), "u1")).toBe("admin");
  });

  it("CA-S1-05: recusa usuário sem papel, papel desconhecido e erro de consulta", async () => {
    expect(await getCrmRole(clientReturning({ data: null, error: null }), "u1")).toBeNull();
    expect(await getCrmRole(clientReturning({ data: { role: "vendedor" }, error: null }), "u1")).toBeNull();
    expect(await getCrmRole(clientReturning({ data: { role: "admin" }, error: new Error("x") }), "u1")).toBeNull();
  });

  it("consulta user_roles pelo user_id informado", async () => {
    const c = clientReturning({ data: { role: "admin" }, error: null });
    await getCrmRole(c, "abc");
    expect(c.calls).toEqual(["user_roles", "user_id=abc"]);
  });

  it("isCrmRole rejeita valores não textuais", () => {
    expect(isCrmRole(null)).toBe(false);
    expect(isCrmRole(1)).toBe(false);
    expect(isCrmRole("admin")).toBe(true);
  });
});
