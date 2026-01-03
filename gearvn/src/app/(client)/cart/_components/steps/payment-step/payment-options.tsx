import Image from "next/image";

import { CheckCircle2 } from "lucide-react";

import { cn } from "@/utils/cn";
import { PAYMENT_METHOD } from "@/config.global";
import { PAYMENT_OPTIONS } from "@/constants/admin/orders/payment-method-options";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type PaymentOptionsProps = {
  isPending: boolean;
  paymentMethod: string;
  setPaymentMethod: (value: string) => void;
};

export const PaymentOptions = ({
  isPending,
  paymentMethod,
  setPaymentMethod,
}: PaymentOptionsProps) => (
  <section>
    <h2 className="text-lg font-semibold mb-4">Phương thức thanh toán</h2>

    <div className="border rounded-sm p-4 space-y-3">
      <RadioGroup
        disabled={isPending}
        value={paymentMethod}
        onValueChange={setPaymentMethod}
        defaultValue={PAYMENT_METHOD.COD}
        className={cn(
          "space-y-2",
          isPending && "opacity-50 pointer-events-none"
        )}
      >
        {PAYMENT_OPTIONS.map(({ value, label, img, imgSize }) => {
          const isSelected = paymentMethod === value;

          return (
            <label
              key={value}
              htmlFor={value}
              className={cn(
                "flex items-center justify-between p-3 sm:p-4 border rounded-md transition-colors cursor-pointer",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "hover:border-gray-300"
              )}
            >
              <div className="flex-1 flex items-center gap-3">
                <RadioGroupItem id={value} value={value} />
                <Image
                  src={img}
                  alt={label}
                  width={imgSize}
                  height={imgSize}
                  className="object-contain size-8 sm:size-10"
                />
                <span className="text-base font-medium">{label}</span>
              </div>

              {isSelected && (
                <CheckCircle2 className="size-5 flex-shrink-0 text-primary" />
              )}
            </label>
          );
        })}
      </RadioGroup>
    </div>
  </section>
);
