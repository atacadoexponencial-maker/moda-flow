// Integração contra o projeto Supabase (SUP-S1-07): retorno de lead.
// Cria leads temporários com identidades próprias, simula novo cadastro pelo
// mesmo ponto de entrada (insert em leads, igual ao webhook) e apaga tudo ao final.
import { describe, it, expect, afterAll } from "vitest";
import { hasSupabaseCredentials, adminClient, createTempUser, deleteTempUser, type TempUser } from "./supabase-admin";

const admin = hasSupabaseCredentials ? adminClient() : null;
const leadIds: string[] = [];
const users: TempUser[] = [];

const phone = () => `00902${Math.floor(Math.random() * 1e6).toString().padStart(6, "0")}`;

async function newLead(fields: Record<string, unknown>): Promise<{ id: string; whatsapp: string }> {
  const whatsapp = phone();
  const { data, error } = await admin!
    .from("leads")
    .insert({ nome: "TESTE RETORNO (apagar)", whatsapp, funil: "teste", ...fields })
    .select("id")
    .single();
  if (error) throw error;
  leadIds.push(data.id);
  return { id: data.id, whatsapp };
}

/** Novo cadastro com a mesma identidade: o trigger descarta o insert e trata como retorno. */
async function returnOf(whatsapp: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await admin!
    .from("leads")
    .insert({ nome: "TESTE RETORNO (apagar) 2", whatsapp, funil: "workshop", utm_source: "facebookads", utm_campaign: "camp_teste", ...extra })
    .select("id");
  if (error) throw error;
  return data; // vazio quando foi retorno
}

describe.skipIf(!hasSupabaseCredentials)("retorno de lead — banco", () => {
  afterAll(async () => {
    for (const id of leadIds) await admin!.from("leads").delete().eq("id", id);
    for (const u of users) { try { await deleteTempUser(admin!, u.id); } catch { /* melhor esforço */ } }
    const { data: left } = await admin!.from("leads").select("id").ilike("nome", "TESTE RETORNO%");
    expect(left ?? []).toHaveLength(0);
  }, 60_000);

  it("CA-S1-22: lead perdido, em Nutrição ou Follow-up Futuro que volta reabre em Leads de Entrada mantendo o responsável", async () => {
    const u = await createTempUser(admin!, "ca22"); users.push(u);

    for (const status of ["desqualificado", "proposta_recusada", "nutricao", "follow_futuro"]) {
      const { id, whatsapp } = await newLead({
        status,
        loss_reason: status.startsWith("desq") || status.startsWith("prop") ? "Fora do perfil" : null,
        data_proximo_contato: "2026-12-01",
        assigned_to: u.id,
      });
      const inserted = await returnOf(whatsapp);
      expect(inserted).toHaveLength(0); // nenhum lead novo

      const { data: lead } = await admin!.from("leads").select("status, loss_reason, data_proximo_contato, assigned_to, last_return_at").eq("id", id).single();
      expect(lead?.status).toBe("leads_entrada");
      expect(lead?.loss_reason).toBeNull();
      expect(lead?.data_proximo_contato).toBeNull();
      expect(lead?.assigned_to).toBe(u.id);
      expect(lead?.last_return_at).not.toBeNull();

      const { data: acts } = await admin!.from("activities").select("content").eq("lead_id", id).eq("type", "lead_voltou");
      expect(acts).toHaveLength(1);
      expect(acts![0].content).toContain("reaberto de");
      expect(acts![0].content).toContain("para Leads de Entrada");
      if (status.startsWith("desq") || status.startsWith("prop")) {
        expect(acts![0].content).toContain("motivo de perda anterior: Fora do perfil");
      }
    }
    const { count } = await admin!.from("leads").select("id", { count: "exact", head: true }).ilike("nome", "TESTE RETORNO%");
    expect(count).toBe(4);
  }, 90_000);

  it("CA-S1-23: lead em trabalho ou fechado que volta fica no mesmo estágio", async () => {
    for (const status of ["qualificacao", "follow_ra", "reuniao", "proposta_negociacao", "follow_rr", "contrato", "contrato_assinado"]) {
      const { id, whatsapp } = await newLead({ status, data_proximo_contato: "2026-12-01" });
      expect(await returnOf(whatsapp)).toHaveLength(0);
      const { data: lead } = await admin!.from("leads").select("status, data_proximo_contato, last_return_at").eq("id", id).single();
      expect(lead?.status).toBe(status);
      expect(lead?.data_proximo_contato).toBe("2026-12-01");
      expect(lead?.last_return_at).not.toBeNull();
    }
  }, 90_000);

  it("CA-S1-24: a linha do tempo ganha 'Lead voltou' com funil e origem da nova entrada", async () => {
    const { id, whatsapp } = await newLead({ status: "reuniao" });
    await returnOf(whatsapp, { funil: "lives-semanais-v1", utm_source: "organico", utm_campaign: "live_01" });
    const { data: acts } = await admin!.from("activities").select("content, created_by").eq("lead_id", id).eq("type", "lead_voltou");
    expect(acts).toHaveLength(1);
    expect(acts![0].content).toBe("Lead voltou pelo funil lives-semanais-v1 (organico / live_01)");
    expect(acts![0].created_by).toBe("Sistema");
    // touch de retorno também existe, como antes
    const { data: touches } = await admin!.from("lead_touches").select("is_aquisicao").eq("lead_id", id);
    expect(touches?.filter((t) => !t.is_aquisicao)).toHaveLength(1);
  }, 60_000);

  it("CA-S1-26: nenhum lead ganhou marcação retroativa por retornos anteriores à mudança", async () => {
    // Todo lead marcado como "voltou" tem um registro 'lead_voltou' na linha do tempo;
    // um retorno antigo (só touch) não gera marcação.
    const { data: marked } = await admin!.from("leads").select("id").not("last_return_at", "is", null);
    const ids = (marked ?? []).map((l) => l.id);
    if (ids.length > 0) {
      const { data: acts } = await admin!.from("activities").select("lead_id").eq("type", "lead_voltou").in("lead_id", ids);
      const withAct = new Set((acts ?? []).map((a) => a.lead_id));
      expect(ids.filter((id) => !withAct.has(id))).toHaveLength(0);
    }
    // e há retornos históricos (touches) em leads sem marcação
    const { data: oldReturns } = await admin!.from("lead_touches").select("lead_id").eq("is_aquisicao", false).lt("created_at", "2026-11-01T00:00:00Z").limit(5);
    for (const t of oldReturns ?? []) {
      const { data: lead } = await admin!.from("leads").select("last_return_at").eq("id", t.lead_id).maybeSingle();
      if (lead) expect(lead.last_return_at).toBeNull();
    }
  }, 60_000);
});
