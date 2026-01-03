"use client";

import { useState, useEffect } from "react";

import { Loader } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { formSchema, FormType } from "./form-schema";
import { useUpdateEvent } from "@/react-query/mutation/event";

import {
  Dialog,
  DialogTitle,
  DialogFooter,
  DialogHeader,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

import { FormFields } from "./form-fields";
import { ImageUpload } from "./image-upload";

type ModalEditEventProps = {
  event: any;
  children: React.ReactNode;
  setOpenDropdown: (open: boolean) => void;
};

export const ModalEditEvent = ({
  children,
  event,
  setOpenDropdown,
}: ModalEditEventProps) => {
  const [open, setOpen] = useState(false);

  const [previewFrame, setPreviewFrame] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const form = useForm<FormType>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tag: event.tag,
      name: event.name,
      frame: undefined,
      image: undefined,
    },
  });

  useEffect(() => {
    if (open) {
      setPreviewFrame(event.frame || null);
      setPreviewImage(event.image || null);
    }
  }, [open, event.frame, event.image]);

  const { mutate: updateEvent, isPending } = useUpdateEvent(() => {
    form.reset();
    setOpen(false);
    setPreviewFrame(null);
    setPreviewImage(null);
    setOpenDropdown(false);
  });

  const onSubmit = (values: FormType) => {
    updateEvent({ id: event._id, ...values });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chỉnh sửa sự kiện</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="h-[85vh] space-y-6 px-3 -mx-3 overflow-y-auto custom-scroll"
          >
            <FormFields form={form} disabled={isPending} />

            <ImageUpload
              form={form}
              name="image"
              label="Ảnh sự kiện"
              disabled={isPending}
              preview={previewImage}
              setPreview={setPreviewImage}
            />

            <ImageUpload
              form={form}
              name="frame"
              disabled={isPending}
              preview={previewFrame}
              label="Khung ảnh sự kiện"
              setPreview={setPreviewFrame}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => setOpen(false)}
              >
                Huỷ
              </Button>

              <Button type="submit" disabled={isPending}>
                {isPending && <Loader className="size-4 animate-spin" />}
                Lưu thay đổi
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
