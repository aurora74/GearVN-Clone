import { NextResponse } from "next/server";

import { ErrorResponseParams, SuccessResponseParams } from "@/types/auth";

export const successResponse = ({
  message,
  description,
  status = 200,
  result = null,
}: SuccessResponseParams) => {
  return NextResponse.json({ message, description, result }, { status });
};

export const errorResponse = ({
  message,
  description,
  status = 500,
  detail = null,
}: ErrorResponseParams) => {
  return NextResponse.json({ message, description, detail }, { status });
};
