import { describe, it, expect } from "vitest";
import { displayName, initials, assigneeLabel, assigneeInitials, canAssume, assignPatch, UNASSIGNED_LABEL } from "./team";

const members = [
  { user_id: "u-ana", email: "ana.souza@empresa.com", role: "admin" },
  { user_id: "u-mar", email: "marcelle@empresa.com", role: "proprietario" },
];

describe("responsável pelo lead — exibição", () => {
  it("CA-S1-07: nome e iniciais do responsável aparecem a partir do e-mail", () => {
    expect(displayName("ana.souza@empresa.com")).toBe("Ana Souza");
    expect(displayName("marcelle@empresa.com")).toBe("Marcelle");
    expect(initials("ana.souza@empresa.com")).toBe("AS");
    expect(initials("marcelle@empresa.com")).toBe("MA");
    expect(initials("joao_pedro-silva@x.com")).toBe("JP");
    expect(assigneeLabel(members, "u-ana")).toBe("Ana Souza");
    expect(assigneeInitials(members, "u-mar")).toBe("MA");
  });

  it("CA-S1-07: lead sem responsável ou com responsável desconhecido mostra 'Sem responsável' e card sem iniciais", () => {
    expect(assigneeLabel(members, null)).toBe(UNASSIGNED_LABEL);
    expect(assigneeLabel(members, "u-removido")).toBe(UNASSIGNED_LABEL);
    expect(assigneeInitials(members, null)).toBe("");
    expect(assigneeInitials(members, "u-removido")).toBe("");
  });
});

describe("responsável pelo lead — botão Assumir", () => {
  it("CA-S1-08: Assumir atribui ao usuário logado e só aparece quando o lead não é dele", () => {
    expect(canAssume({ assigned_to: null }, "u-ana")).toBe(true);
    expect(canAssume({ assigned_to: "u-mar" }, "u-ana")).toBe(true);
    expect(canAssume({ assigned_to: "u-ana" }, "u-ana")).toBe(false);
    expect(canAssume({ assigned_to: null }, null)).toBe(false);
    expect(assignPatch("u-ana")).toEqual({ assigned_to: "u-ana" });
  });
});
