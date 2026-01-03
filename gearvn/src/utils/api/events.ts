import { EventType } from "@/types/event";

export const fetchEvents = async (): Promise<EventType[]> => {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/events?limit=10`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return [];
    const { result } = await res.json();
    return result.data;
  } catch {
    return [];
  }
};
