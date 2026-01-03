"use client";

import { Suspense } from "react";

import { BlogType } from "@/types/blog";
import { PaginatedResponse } from "@/types/global";

import { AllBlogs } from "./_components/all-blogs";

export function PageClient({ blogs }: { blogs: PaginatedResponse<BlogType> }) {
  return (
    <Suspense>
      <AllBlogs blogs={blogs} />
    </Suspense>
  );
}
