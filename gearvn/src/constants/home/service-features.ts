import {
  Pin,
  Cog,
  Tag,
  Newspaper,
  ShieldCheck,
  CircleDollarSign,
} from "lucide-react";

import { ServiceFeatureType } from "@/types/global";

export const SERVICE_FEATURES: ServiceFeatureType[] = [
  { icon: Tag, label: "Build PC tặng màn 240Hz", href: "/" },
  { icon: Newspaper, label: "Tin tức công nghệ", href: "/" },
  { icon: Cog, label: "Dịch vụ sửa chữa", href: "/" },
  { icon: Pin, label: "Dịch vụ kỹ thuật tại nhà", href: "/" },
  { icon: CircleDollarSign, label: "Thu cũ đổi mới", href: "/" },
  { icon: ShieldCheck, label: "Tra cứu bảo hành", href: "/" },
];
