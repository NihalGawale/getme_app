import { supabase } from "./supabase";

// Looks up the conversation between a client and a freelancer, creating one
// if it doesn't exist yet.
export async function getOrCreateConversation(
  clientId: string,
  freelancerId: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("client_id", clientId)
    .eq("freelancer_id", freelancerId)
    .single();

  if (existing) return existing.id;

  const { data: newConvo, error } = await supabase
    .from("conversations")
    .insert({ client_id: clientId, freelancer_id: freelancerId })
    .select("id")
    .single();

  if (error || !newConvo) {
    throw error ?? new Error("Could not create conversation");
  }

  return newConvo.id;
}

// Unread message count for a client/freelancer pair, addressed to `userId`.
// Pass a single conversation id for a per-conversation count, or every
// conversation id the user is part of for a total/badge count.
export async function getUnreadCount(
  conversationIds: string[],
  userId: string,
): Promise<number> {
  if (!conversationIds.length) return 0;

  const { count } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .in("conversation_id", conversationIds)
    .eq("is_read", false)
    .neq("sender_id", userId);

  return count ?? 0;
}
