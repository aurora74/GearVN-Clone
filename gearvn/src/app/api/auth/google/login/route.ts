import { NextResponse } from "next/server";

export const GET = () => {
  const baseUrl = process.env.API_BASE_URL;

  return NextResponse.redirect(`${baseUrl}/auth/google/login`, {
    status: 302,
  });
};
