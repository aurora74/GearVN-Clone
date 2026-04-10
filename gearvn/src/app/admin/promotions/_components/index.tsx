"use client";

import { Plus, TicketPercent, Timer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FlashSaleForm } from "@/components/modals/admin/promotions/flash-sale-form";
import { VoucherForm } from "@/components/modals/admin/promotions/voucher-form";
import { FlashSaleTab } from "./flash-sale-tab";
import { PromotionSummaryRow } from "./promotion-summary-row";
import { VoucherTab } from "./voucher-tab";

export const PromotionsPage = () => {
  return (
    <div className="h-full p-4 space-y-4 border bg-white shadow-sm rounded-md">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold">Khuyến mãi</h1>
          <p className="text-sm text-muted-foreground">
            Quản lý flash sale, voucher và giá khuyến mãi.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <FlashSaleForm>
            <Button className="w-full sm:w-auto">
              <Plus className="size-4" />
              Tạo flash sale
            </Button>
          </FlashSaleForm>
          <VoucherForm>
            <Button className="w-full sm:w-auto">
              <Plus className="size-4" />
              Tạo voucher
            </Button>
          </VoucherForm>
        </div>
      </div>

      <PromotionSummaryRow />

      <Tabs defaultValue="flash-sale" className="gap-3">
        <TabsList className="w-full justify-start sm:w-fit">
          <TabsTrigger value="flash-sale">
            <Timer className="size-4" />
            Flash sale
          </TabsTrigger>
          <TabsTrigger value="voucher">
            <TicketPercent className="size-4" />
            Voucher
          </TabsTrigger>
        </TabsList>
        <TabsContent value="flash-sale">
          <FlashSaleTab />
        </TabsContent>
        <TabsContent value="voucher">
          <VoucherTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};
