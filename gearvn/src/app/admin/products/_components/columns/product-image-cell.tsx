import Image from "next/image";

import { ProductType } from "@/types/product";
import { useEvents } from "@/react-query/query/event";

type Props = { product: ProductType };

export const ProductImageCell = ({ product }: Props) => {
  const { data: events } = useEvents();
  const matchedEvent = events?.data?.find((ev) => ev.tag === product.event);
  const firstImage = product.images?.[0];

  return (
    <div className="relative size-18 p-1">
      <Image
        fill
        src={firstImage}
        alt={product.name}
        className="object-contain rounded-md"
      />

      {matchedEvent?.frame && (
        <Image
          fill
          alt="Frame event"
          src={matchedEvent.frame}
          className="absolute inset-0 object-cover pointer-events-none"
        />
      )}
    </div>
  );
};
