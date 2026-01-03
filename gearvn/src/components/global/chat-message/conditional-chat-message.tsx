"use client";

import { USER_ROLE } from "@/config.global";
import { useRoleStore } from "@/stores/use-role-store";

import { ChatMessage } from "@/components/global/chat-message";

export const ConditionalChatMessage = () => {
  const { role } = useRoleStore();

  if (role === USER_ROLE.ADMIN) return null;

  return <ChatMessage />;
};
