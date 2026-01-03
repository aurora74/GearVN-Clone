"use client";

import Image from "next/image";

import { X, ImagePlus } from "lucide-react";
import { UseFormReturn } from "react-hook-form";

import { FormType } from "./form-schema";

import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

type ImageUploadProps = {
  label: string;
  isPending: boolean;
  preview: string | null;
  name: "frame" | "image";
  form: UseFormReturn<FormType>;
  setPreview: (v: string | null) => void;
};

export const ImageUpload = ({
  form,
  name,
  label,
  preview,
  isPending,
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
                  disabled={isPending}
                  onChange={handleFileChange}
                />
              </label>

              {preview && (
                <div className="relative mt-4 w-full h-48">
                  <Image
                    fill
                    src={preview}
                    alt="Preview"
                    className="object-contain rounded-lg p-2 border"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPreview(null);
                      form.setValue(name, undefined);
                    }}
                    className="absolute top-2 right-2 bg-gray-200 text-gray-700 rounded-full p-1 hover:bg-gray-300 transition cursor-pointer"
                  >
                    <X className="size-4.5" />
                  </button>
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
