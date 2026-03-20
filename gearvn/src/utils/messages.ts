import { Message } from "@/types/chat";

const haveSameAttachments = (left: string[] = [], right: string[] = []) => {
  if (left.length !== right.length) return false;
  return left.every((url, index) => url === right[index]);
};

const isMatchingOptimisticMessage = (message: Message, savedMessage: Message) =>
  message._id?.startsWith("optimistic-") &&
  message.sender === savedMessage.sender &&
  message.text === savedMessage.text &&
  haveSameAttachments(message.attachments, savedMessage.attachments);

export const mergeAndSortMessages = (
  prev: Message[],
  incoming: Message[]
): Message[] => {
  const merged = [...prev, ...incoming].reduce<Message[]>((acc, msg) => {
    const withoutMatchingOptimistic = acc.filter(
      (existing) => !isMatchingOptimisticMessage(existing, msg)
    );

    if (!withoutMatchingOptimistic.find((m) => m._id === msg._id)) {
      withoutMatchingOptimistic.push(msg);
    }

    return withoutMatchingOptimistic;
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
