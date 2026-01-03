import { SETTING_ITEMS } from "@/constants/setting-items";

export const SidebarSkeleton = () => {
  return (
    <aside className="w-[22%] max-h-full p-4 space-y-6 border bg-white shadow-sm rounded-lg animate-pulse">
      <div className="flex items-center gap-4">
        <div className="rounded-full bg-gray-200 w-14 h-14" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-32" />
          <div className="h-3 bg-gray-200 rounded w-24" />
        </div>
      </div>

      <nav aria-label="Cài đặt hồ sơ">
        <ul className="space-y-2">
          {Array.from({ length: SETTING_ITEMS.length }).map((_, i) => (
            <li key={i} className="flex items-center gap-2 p-2 rounded-md">
              <div className="w-4 h-4 bg-gray-200 rounded" />
              <div className="h-4 bg-gray-200 rounded w-24" />
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
};
