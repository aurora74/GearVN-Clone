export type BlogType = {
  _id: string;
  title: string;
  slug: string;
  summary: string;
  description: string;
  thumbnail: string;
  isPublished?: boolean;
  publishedAt?: Date | string;
  unpublishedAt?: Date | string;
  createdAt: Date;
  updatedAt: Date;
};

export type UseBlogsParams = {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  fields?: string;
  includeUnpublished?: boolean;
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

export type BlogCommentAuthor = {
  displayName: string;
  avatarUrl?: string;
};

export type BlogComment = {
  id: string;
  blogId: string;
  authorId: string;
  author: BlogCommentAuthor;
  content: string;
  status: "visible" | "hidden" | "deleted";
  createdAt: Date | string;
  updatedAt?: Date | string;
};

export type CreateBlogCommentPayload = {
  blogId: string;
  content: string;
};
