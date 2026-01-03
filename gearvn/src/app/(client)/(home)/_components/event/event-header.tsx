import { Icon } from "@iconify/react";

export const EventHeader = ({ title }: { title: string }) => (
  <header className="flex items-center gap-2">
    <Icon
      aria-hidden="true"
      icon="fxemoji:lightningmood"
      className="flex-shrink-0 size-6 sm:size-8 text-yellow-400"
    />
    <h2
      title={title}
      className="text-xl sm:text-3xl font-bold text-white italic uppercase truncate"
    >
      {title}
    </h2>
  </header>
);
