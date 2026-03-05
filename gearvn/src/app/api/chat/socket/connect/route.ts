import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const GET = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value ?? null;

  return NextResponse.json({ url: process.env.SOCKET_URL, token });
};
