import { NextResponse } from "next/server";

export const GET = () => {
  return NextResponse.json({ url: process.env.SOCKET_URL });
};
