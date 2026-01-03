import { Message } from "@/types/chat";

export const mergeAndSortMessages = (
  prev: Message[],
  incoming: Message[]
): Message[] => {
  const merged = [...prev, ...incoming].reduce<Message[]>((acc, msg) => {
    if (!acc.find((m) => m._id === msg._id)) acc.push(msg);
    return acc;
  }, []);

  merged.sort(
    (a, b) =>
      new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime()
  );

  return merged;
};

export const isUserNearBottom = (
  container: HTMLDivElement,
  threshold = 120
): boolean => {
  return (
    container.scrollHeight - container.scrollTop - container.clientHeight <
    threshold
  );
};

export const scrollToBottom = (container: HTMLDivElement) => {
  requestAnimationFrame(() => {
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  });
};

export const revokePreview = (preview: string) => {
  URL.revokeObjectURL(preview);
};
