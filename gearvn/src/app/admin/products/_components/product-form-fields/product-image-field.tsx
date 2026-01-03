import Image from "next/image";

import { ImagePlus, X } from "lucide-react";
import { UseFormReturn, ControllerRenderProps } from "react-hook-form";

import { cn } from "@/utils/cn";
import { FormType } from "../product-schema";

import {
  FormItem,
  FormField,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type ProductImageFieldProps = {
  isPending: boolean;
  form: UseFormReturn<FormType>;
};

export const ProductImageField = ({
  form,
  isPending,
}: ProductImageFieldProps) => {
  return (
    <FormField
      name="images"
      control={form.control}
      render={({ field }) => (
        <ProductImageFieldRender field={field} isPending={isPending} />
      )}
    />
  );
};

const ProductImageFieldRender = ({
  field,
  isPending,
}: {
  field: ControllerRenderProps<FormType, "images">;
  isPending: boolean;
}) => {
  const images = field.value || [];

  const createPreview = (img: string | File) =>
    typeof img === "string" ? img : URL.createObjectURL(img);

  const handleRemove = (index: number) => {
    const filtered = images.filter((_, i) => i !== index);
    field.onChange(filtered);
  };

  const handleAdd = (files: File[]) => {
    field.onChange([...images, ...files.reverse()]);
  };

  return (
    <FormItem>
      <FormLabel>Hình ảnh sản phẩm</FormLabel>
      <FormControl>
        <div className="space-y-2">
          <label
            htmlFor="upload-images"
            className={cn(
              "w-full h-40 flex flex-col items-center justify-center gap-2 border border-dashed border-muted-foreground rounded-md text-muted-foreground cursor-pointer hover:bg-accent/40 hover:border-primary transition",
              isPending && "pointer-events-none opacity-50"
            )}
          >
            <ImagePlus className="size-6" />
            <span className="text-sm font-medium">
              Nhấn để chọn hoặc kéo thả ảnh
            </span>
          </label>

          <Input
            multiple
            type="file"
            accept="image/*"
            id="upload-images"
            disabled={isPending}
            onChange={(e) => handleAdd(Array.from(e.target.files || []))}
            className="hidden"
          />

          {images.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {images.map((img, index) => {
                const preview = createPreview(img);

                return (
                  <div
                    key={index}
                    className="relative group rounded border overflow-hidden aspect-square"
                  >
                    <div className="relative w-full h-full">
                      <Image
                        fill
                        src={preview}
                        alt={`Ảnh ${index + 1}`}
                        className="object-contain"
                      />
                    </div>

                    <Button
                      size="icon"
                      type="button"
                      variant="ghost"
                      disabled={isPending}
                      onClick={() => handleRemove(index)}
                      className="absolute top-2 right-2 size-8 text-accent-foreground bg-accent opacity-0 group-hover:opacity-100 transition"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </FormControl>
      <FormMessage />
    </FormItem>
  );
};
