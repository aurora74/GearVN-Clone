"use client";

import { useMemo, useState } from "react";
import { Loader, Save } from "lucide-react";

import { useUpdateSystemConfig } from "@/react-query/mutation/user";
import { SystemConfig, useSystemConfig } from "@/react-query/query/user";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const stringifyValue = (value: unknown) => {
  if (typeof value === "string") return value;

  return JSON.stringify(value, null, 2);
};

const parseConfigValue = (value: string) => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const SystemConfigRow = ({ config }: { config: SystemConfig }) => {
  const [value, setValue] = useState(() => stringifyValue(config.value));
  const [description, setDescription] = useState(config.description ?? "");
  const [reason, setReason] = useState("");
  const trimmedReason = reason.trim();
  const { mutate, isPending } = useUpdateSystemConfig(undefined, {
    onSuccessCallback: () => {
      setReason("");
    },
  });

  return (
    <TableRow>
      <TableCell className="align-top">
        <div className="space-y-1">
          <p className="font-medium">{config.key}</p>
          {config.updatedAt && (
            <p className="text-xs text-muted-foreground">
              Cap nhat:{" "}
              {new Date(config.updatedAt).toLocaleString("vi-VN", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </p>
          )}
        </div>
      </TableCell>
      <TableCell className="min-w-[240px] align-top">
        <Textarea
          value={value}
          disabled={isPending}
          className="min-h-24 font-mono"
          onChange={(event) => setValue(event.target.value)}
        />
      </TableCell>
      <TableCell className="min-w-[220px] align-top">
        <Input
          value={description}
          disabled={isPending}
          placeholder="Mo ta cau hinh"
          onChange={(event) => setDescription(event.target.value)}
        />
      </TableCell>
      <TableCell className="min-w-[260px] align-top">
        <div className="space-y-2">
          <label className="text-sm font-semibold" htmlFor={`reason-${config.key}`}>
            Ly do
          </label>
          <Textarea
            id={`reason-${config.key}`}
            value={reason}
            disabled={isPending}
            placeholder="Nhap ly do de ghi nhan vao audit log."
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
      </TableCell>
      <TableCell className="align-top text-right">
        <Button
          disabled={isPending || !trimmedReason}
          onClick={() =>
            mutate({
              key: config.key,
              value: parseConfigValue(value),
              description: description || undefined,
              reason: trimmedReason,
            })
          }
        >
          {isPending ? (
            <Loader className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Luu
        </Button>
      </TableCell>
    </TableRow>
  );
};

export default function SystemPage() {
  const { data: configs, isPending } = useSystemConfig();
  const sortedConfigs = useMemo(
    () => [...(configs ?? [])].sort((a, b) => a.key.localeCompare(b.key)),
    [configs]
  );

  return (
    <div className="h-full p-4 space-y-4 border bg-white shadow-sm rounded-md">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold">Quan tri he thong</h1>
        <p className="text-sm text-muted-foreground">
          ({sortedConfigs.length} cau hinh)
        </p>
      </div>

      <div className="overflow-x-auto border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Khoa</TableHead>
              <TableHead>Gia tri</TableHead>
              <TableHead>Mo ta</TableHead>
              <TableHead>Ly do</TableHead>
              <TableHead className="text-right">Thao tac</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Dang tai cau hinh...
                </TableCell>
              </TableRow>
            ) : sortedConfigs.length ? (
              sortedConfigs.map((config) => (
                <SystemConfigRow key={config.key} config={config} />
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <div className="space-y-1">
                    <p className="font-medium">Chua co cau hinh</p>
                    <p className="text-sm text-muted-foreground">
                      He thong chua tra ve cau hinh nao de quan tri.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
