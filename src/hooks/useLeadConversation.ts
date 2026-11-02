import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { upsertMessage, type ChatMessage } from "@/lib/whatsapp-chat";

export interface LeadConversation {
  id: string;
  unread_count: number;
  last_inbound_at: string | null;
}

const MEDIA_BUCKET = "whatsapp-media";
const COLS =
  "id, direction, type, content, media_path, media_mime, media_filename, media_status, status, status_error, reaction_emoji, reply_to_wamid, wamid, sent_by_email, created_at";

/** Conversa do lead com tempo real (Supabase Realtime) e links assinados de mídia. */
export function useLeadConversation(leadId: string | null) {
  const qc = useQueryClient();
  const [conversation, setConversation] = useState<LeadConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const signed = useRef(new Set<string>());

  const signMedia = useCallback(async (list: ChatMessage[]) => {
    const paths = list.map((m) => m.media_path).filter((p): p is string => !!p && !signed.current.has(p));
    if (paths.length === 0) return;
    paths.forEach((p) => signed.current.add(p));
    const { data } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(paths, 60 * 60);
    const map: Record<string, string> = {};
    for (const s of data ?? []) if (s.path && s.signedUrl) map[s.path] = s.signedUrl;
    setMediaUrls((prev) => ({ ...prev, ...map }));
  }, []);

  const load = useCallback(async () => {
    if (!leadId) return;
    const [{ data: conv }, { data: msgs }] = await Promise.all([
      supabase.from("whatsapp_conversations").select("id, unread_count, last_inbound_at").eq("lead_id", leadId).maybeSingle(),
      supabase.from("whatsapp_messages").select(COLS).eq("lead_id", leadId).order("created_at", { ascending: true }).limit(500),
    ]);
    setConversation((conv as LeadConversation) ?? null);
    const list = (msgs ?? []) as ChatMessage[];
    setMessages(list);
    setLoading(false);
    signMedia(list);
  }, [leadId, signMedia]);

  useEffect(() => {
    setLoading(true);
    setMessages([]);
    setConversation(null);
    signed.current.clear();
    load();
    if (!leadId) return;

    const channel = supabase
      .channel(`wa-lead-${leadId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_messages", filter: `lead_id=eq.${leadId}` }, (payload) => {
        const m = payload.new as ChatMessage;
        if (!m?.id) return;
        setMessages((prev) => upsertMessage(prev, m));
        signMedia([m]);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversations", filter: `lead_id=eq.${leadId}` }, (payload) => {
        const c = payload.new as LeadConversation;
        if (c?.id) setConversation(c);
        qc.invalidateQueries({ queryKey: ["whatsapp-inbox"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leadId, load, signMedia, qc]);

  const markRead = useCallback(async () => {
    if (!leadId) return;
    setConversation((c) => (c ? { ...c, unread_count: 0 } : c));
    await supabase.functions.invoke("whatsapp-mark-read", { body: { lead_id: leadId } });
    qc.invalidateQueries({ queryKey: ["whatsapp-inbox"] });
  }, [leadId, qc]);

  return { conversation, messages, mediaUrls, loading, reload: load, markRead };
}
