export type BlogType = {
  _id: string;
  title: string;
  slug: string;
  summary: string;
  description: string;
  thumbnail: string;
  createdAt: Date;
  updatedAt: Date;
};

export type UseBlogsParams = {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  fields?: string;
};

export type CreateBlogPayload = {
  title: string;
  slug: string;
  summary: string;
  description: string;
  thumbnail: File;
};

export type UpdateBlogPayload = {
  title: string;
  slug: string;
  summary: string;
  description: string;
  thumbnail?: File | string;
};
