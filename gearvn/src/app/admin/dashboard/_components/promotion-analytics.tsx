import { TicketPercent } from "lucide-react";

import {
  DashboardPromotionCampaign,
  DashboardSummary,
} from "@/types/dashboard";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PromotionAnalyticsProps = {
  data: DashboardSummary;
};

type CampaignListProps = {
  topCampaigns: DashboardPromotionCampaign[];
};

const formatNumber = (value: number) => value.toLocaleString("vi-VN");

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);

const campaignTypeLabel = (type: DashboardPromotionCampaign["type"]) =>
  type === "flash_sale" ? "Flash sale" : "Voucher";

const CampaignTypeBadge = ({
  type,
}: {
  type: DashboardPromotionCampaign["type"];
}) => (
  <Badge
    variant="outline"
    className={
      type === "flash_sale"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-blue-200 bg-blue-50 text-blue-700"
    }
  >
    {campaignTypeLabel(type)}
  </Badge>
);

const campaignPrimaryMetric = (campaign: DashboardPromotionCampaign) =>
  campaign.type === "flash_sale"
    ? `${formatNumber(campaign.orders ?? 0)} đơn`
    : `${formatNumber(campaign.uses ?? 0)} lượt`;

const campaignSecondaryMetric = (campaign: DashboardPromotionCampaign) =>
  campaign.type === "flash_sale"
    ? `${formatNumber(campaign.productsSold ?? 0)} sản phẩm`
    : formatCurrency(campaign.discountAmount);

const CompactCampaignRows = ({ topCampaigns }: CampaignListProps) => (
  <div className="space-y-2">
    {topCampaigns.map((campaign) => (
      <div
        key={campaign.id}
        className="flex min-h-12 items-center justify-between gap-3 rounded-md border bg-background px-3 py-2"
      >
        <div className="min-w-0">
          <div className="line-clamp-1 text-sm font-medium" title={campaign.name}>
            {campaign.name}
          </div>
          <div className="mt-1">
            <CampaignTypeBadge type={campaign.type} />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-semibold tabular-nums">
            {campaignPrimaryMetric(campaign)}
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">
            {campaignSecondaryMetric(campaign)}
          </div>
        </div>
      </div>
    ))}
  </div>
);

const CampaignTable = ({ topCampaigns }: CampaignListProps) => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Chiến dịch</TableHead>
        <TableHead className="w-28">Loại</TableHead>
        <TableHead className="w-28 text-right">Đơn / lượt</TableHead>
        <TableHead className="w-32 text-right">Giảm giá</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {topCampaigns.map((campaign) => (
        <TableRow key={campaign.id}>
          <TableCell className="max-w-[260px] whitespace-normal">
            <div className="line-clamp-2 font-medium" title={campaign.name}>
              {campaign.name}
            </div>
            {campaign.type === "flash_sale" && (
              <div className="text-xs text-muted-foreground tabular-nums">
                {formatNumber(campaign.productsSold ?? 0)} sản phẩm
              </div>
            )}
          </TableCell>
          <TableCell>
            <CampaignTypeBadge type={campaign.type} />
          </TableCell>
          <TableCell className="text-right font-semibold tabular-nums">
            {campaignPrimaryMetric(campaign)}
          </TableCell>
          <TableCell className="text-right font-semibold tabular-nums">
            {formatCurrency(campaign.discountAmount)}
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

const CampaignList = ({ topCampaigns }: CampaignListProps) => {
  if (topCampaigns.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        Chưa có chiến dịch phát sinh trong kỳ.
      </div>
    );
  }

  return topCampaigns.length >= 4 ? (
    <CampaignTable topCampaigns={topCampaigns} />
  ) : (
    <CompactCampaignRows topCampaigns={topCampaigns} />
  );
};

export const PromotionAnalytics = ({ data }: PromotionAnalyticsProps) => {
  const { summary, topCampaigns } = data.promotionAnalytics;

  const summaryItems = [
    {
      label: "Đơn flash sale",
      value: formatNumber(summary.flashSaleOrdersCount),
    },
    {
      label: "Sản phẩm flash sale",
      value: formatNumber(summary.flashSaleProductsSold),
    },
    {
      label: "Lượt dùng voucher",
      value: formatNumber(summary.totalVoucherUses),
    },
    {
      label: "Tổng giảm giá",
      value: formatCurrency(summary.totalVoucherDiscountAmount),
    },
  ];

  return (
    <section>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Hiệu quả khuyến mãi</CardTitle>
              <CardDescription>
                Flash sale theo đơn và sản phẩm đã bán; voucher theo lượt dùng.
              </CardDescription>
            </div>
            <Badge variant="outline" className="shrink-0">
              <TicketPercent className="size-3" />
              {formatNumber(summary.activeFlashSales + summary.activeVouchers)} đang chạy
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summaryItems.map((item) => (
              <div key={item.label} className="rounded-md border bg-background px-3 py-2">
                <div className="text-xs font-medium text-muted-foreground">
                  {item.label}
                </div>
                <div className="mt-1 text-lg font-semibold tabular-nums">
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          <CampaignList topCampaigns={topCampaigns} />
        </CardContent>
      </Card>
    </section>
  );
};
