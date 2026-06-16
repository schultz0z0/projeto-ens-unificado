import { refreshChatMessageAttachmentUrls } from "@/lib/chatAttachments";

type MessageLike = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export const hydrateChatMessages = async <TMessage extends MessageLike>(messages: TMessage[]) => {
  return await Promise.all(
    messages.map(async (message) => ({
      ...message,
      content: await refreshChatMessageAttachmentUrls(message.content).catch(() => message.content),
    })),
  );
};
