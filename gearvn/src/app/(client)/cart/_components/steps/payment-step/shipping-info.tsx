import { MapPin, Phone, User } from "lucide-react";

import { getGoogleMapsEmbedUrl } from "@/utils/maps";
import { OrderTypeStore } from "@/stores/use-order-store";

import { InfoItem } from "./info-item";

export const ShippingInfo = ({ order }: { order: OrderTypeStore }) => {
  const { fullName, phone, address } = order;

  return (
    <section>
      <h2 className="text-lg font-semibold mb-4">Thông tin giao hàng</h2>

      <div className="border rounded-sm p-4 space-y-4 text-base">
        <InfoItem
          label="Họ tên"
          value={fullName}
          icon={<User className="size-4 shrink-0 mt-1" />}
        />
        <InfoItem
          label="Số điện thoại"
          value={phone}
          icon={<Phone className="size-4 shrink-0 mt-1" />}
        />
        <InfoItem
          label="Địa chỉ"
          value={address}
          icon={<MapPin className="size-4 shrink-0 mt-1" />}
        />

        {address && (
          <div className="w-full h-60 rounded overflow-hidden mt-4">
            <iframe
              loading="lazy"
              title="Bản đồ giao hàng"
              className="w-full h-full border-0"
              src={getGoogleMapsEmbedUrl(address)}
            />
          </div>
        )}
      </div>
    </section>
  );
};
