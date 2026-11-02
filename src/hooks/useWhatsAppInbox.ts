import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { applyConversationChange, sortInbox, totalUnread, type InboxItem } from "@/lib/whatsapp-inbox";

export const INBOX_QUERY_KEY = ["whatsapp-inbox"];

/** Conversas com dados do lead, atualizadas em tempo real. Compartilhado pela página e pela barra lateral. */
export function useWhatsAppInbox() {
  const qc = useQueryClient();
  // nome de canal único por instância (barra lateral e página usam o hook ao mesmo tempo)
  const channelName = useRef(`wa-inbox-${Math.random().toString(36).slice(2)}`);

  const query = useQuery<InboxItem[]>({
    queryKey: INBOX_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_conversations")
        .select("id, lead_id, unread_count, last_message_at, last_message_text, last_message_direction, last_inbound_at, lead:leads(id, nome, whatsapp, status, assigned_to)")
        .not("last_message_at", "is", null)
        .order("last_message_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return sortInbox(((data ?? []) as unknown as InboxItem[]).filter((c) => c.lead));
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel(channelName.current)
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversations" }, (payload) => {
        const change = payload.new as InboxItem;
        if (!change?.id) return;
        const current = qc.getQueryData<InboxItem[]>(INBOX_QUERY_KEY) ?? [];
        const { list, known } = applyConversationChange(current, change);
        if (known) qc.setQueryData(INBOX_QUERY_KEY, list);
        else qc.invalidateQueries({ queryKey: INBOX_QUERY_KEY }); // conversa nova: busca com os dados do lead
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const items = query.data ?? [];
  return { items, unread: totalUnread(items), isLoading: query.isLoading };
}
