import { Plus } from "lucide-react";
import { UseFormReturn, useFieldArray } from "react-hook-form";

import { FormType } from "./form-schema";

import { Button } from "@/components/ui/button";

import { FieldItem } from "./field-item";

type FormFieldsProps = {
  form: UseFormReturn<FormType>;
  isPending: boolean;
};

export const FormFields = ({ form, isPending }: FormFieldsProps) => {
  const { append, remove, fields } = useFieldArray({
    control: form.control,
    name: "fields",
  });

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold">Thuộc tính</h3>
      {fields.map((item, index) => (
        <FieldItem
          form={form}
          key={item.id}
          index={index}
          remove={remove}
          isPending={isPending}
        />
      ))}

      <Button
        type="button"
        variant={"ghost"}
        disabled={isPending}
        onClick={() =>
          append({ name: "", label: "", type: "text", options: [] })
        }
        className="ml-auto"
      >
        <Plus className="h-4 w-4" /> Thêm trường
      </Button>
    </div>
  );
};
