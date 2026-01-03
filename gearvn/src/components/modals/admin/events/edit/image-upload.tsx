import Image from "next/image";

import { ImagePlus } from "lucide-react";
import { UseFormReturn } from "react-hook-form";

import { FormType } from "./form-schema";

import {
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormControl,
} from "@/components/ui/form";

type ImageUploadProps = {
  label: string;
  disabled?: boolean;
  preview: string | null;
  name: "image" | "frame";
  form: UseFormReturn<FormType>;
  setPreview: (val: string | null) => void;
};

export const ImageUpload = ({
  form,
  name,
  label,
  preview,
  disabled,
  setPreview,
}: ImageUploadProps) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      form.setValue(name, file);
      setPreview(URL.createObjectURL(file));
    }
  };

  return (
    <FormField
      control={form.control}
      name={name}
      render={() => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <div>
              <label
                htmlFor={`${name}-upload`}
                className="border-2 border-dashed rounded-lg p-4 w-full flex flex-col items-center justify-center text-sm text-gray-500 cursor-pointer hover:border-primary transition"
              >
                <ImagePlus className="size-6 mb-2 text-gray-400" />
                <span>Nhấn để chọn hoặc kéo thả ảnh vào đây</span>
                <input
                  type="file"
                  accept="image/*"
                  id={`${name}-upload`}
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={disabled}
                />
              </label>

              {preview && (
                <div className="relative mt-4 w-full h-48">
                  <Image
                    fill
                    src={preview}
                    alt="Preview"
                    className="object-contain rounded-lg border"
                  />
                </div>
              )}
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
