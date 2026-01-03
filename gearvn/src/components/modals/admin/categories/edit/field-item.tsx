import { useState, useRef } from "react";

import {
  Controller,
  UseFormReturn,
  UseFieldArrayRemove,
} from "react-hook-form";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";

import { FormType } from "./form-schema";

import {
  FormItem,
  FormField,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectItem,
  SelectValue,
  SelectTrigger,
  SelectContent,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type FieldItemProps = {
  index: number;
  isPending: boolean;
  remove: UseFieldArrayRemove;
  form: UseFormReturn<FormType>;
};

export const FieldItem = ({
  form,
  index,
  remove,
  isPending,
}: FieldItemProps) => {
  const [expanded, setExpanded] = useState(false);
  const optionRefs = useRef<Record<string, HTMLInputElement | null>>({});

  return (
    <div className="space-y-4 rounded-md border p-4">
      <FormField
        control={form.control}
        name={`fields.${index}.name`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Tên trường</FormLabel>
            <FormControl>
              <Input {...field} disabled={isPending} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name={`fields.${index}.label`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Nhãn hiển thị</FormLabel>
            <FormControl>
              <Input {...field} disabled={isPending} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name={`fields.${index}.type`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Loại dữ liệu</FormLabel>
            <Select
              disabled={isPending}
              onValueChange={field.onChange}
              defaultValue={field.value}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn loại dữ liệu" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="text">Văn bản</SelectItem>
                <SelectItem value="number">Số</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <Controller
        control={form.control}
        name={`fields.${index}.options`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Tùy chọn</FormLabel>
            <div className="space-y-2">
              {field.value
                ?.slice(0, expanded ? undefined : 1)
                .map((opt, optIndex) => (
                  <div key={optIndex} className="flex gap-2">
                    <Input
                      value={opt}
                      placeholder="Nhập tùy chọn"
                      onChange={(e) => {
                        const newOpts = [...(field.value || [])];
                        newOpts[optIndex] = e.target.value;
                        field.onChange(newOpts);
                      }}
                      ref={(el) => {
                        optionRefs.current[`${index}-${optIndex}`] = el;
                      }}
                    />

                    <Button
                      size="icon"
                      type="button"
                      variant="ghost"
                      disabled={isPending}
                      onClick={() =>
                        field.onChange(
                          field.value?.filter((_, i) => i !== optIndex)
                        )
                      }
                      className="bg-white hover:bg-destructive/10 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

              {field.value && field.value.length > 1 && (
                <Button
                  size="sm"
                  type="button"
                  variant="ghost"
                  className="flex items-center gap-1 text-blue-500 hover:text-blue-500"
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? (
                    <>
                      Thu gọn <ChevronUp className="size-3.5" />
                    </>
                  ) : (
                    <>
                      Xem thêm ({field.value.length - 1} tùy chọn nữa){" "}
                      <ChevronDown className="size-3.5" />
                    </>
                  )}
                </Button>
              )}

              <div className="flex items-center justify-between">
                <Button
                  size="sm"
                  type="button"
                  variant="ghost"
                  disabled={isPending}
                  onClick={() => {
                    const newOpts = [...(field.value || []), ""];
                    field.onChange(newOpts);

                    setTimeout(() => {
                      const el =
                        optionRefs.current[`${index}-${newOpts.length - 1}`];
                      el?.focus();
                    }, 0);
                  }}
                >
                  <Plus className="h-4 w-4" /> Thêm tùy chọn
                </Button>

                <Button
                  size="sm"
                  type="button"
                  variant="ghost"
                  disabled={isPending}
                  onClick={() => remove(index)}
                  className="bg-white hover:bg-destructive/10 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" /> Xóa
                </Button>
              </div>
            </div>
          </FormItem>
        )}
      />
    </div>
  );
};
