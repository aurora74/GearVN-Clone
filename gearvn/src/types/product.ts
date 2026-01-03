import { User } from "./user";

export type UserInfo = {
  fullName: string;
  avatarUrl?: string;
};

export type Reply = {
  _id: string;
  userId: UserInfo;
  content: string;
  images?: string[];
  createdAt: string;
};

export type Comment = {
  _id: string;
  userId: User;
  content: string;
  rating: number;
  images?: string[];
  likes: string[];
  createdAt: string;
  replies: Comment[];
};

export type ProductType = {
  _id: string;
  name: string;
  slug: string;
  event: string;
  category: string;
  price: number;
  discountPrice?: number;
  discountPercent?: number;
  description?: string;
  images: string[];
  attributes: Record<string, any>;
  averageRating?: number;
  ratingsCount?: number;
  comments?: Comment[];
  createdAt: string;
  updatedAt: string;
  stock: number;
  soldQuantity: number;
};

export type CreateProductPayload = {
  name: string;
  slug: string;
  price: number;
  stock: number;
  event?: string;
  category: string;
  description?: string;
  discountPrice?: number;
  discountPercent?: number;
  images: (string | File)[];
  attributes?: Record<string, any>;
};

export type UpdateProductPayload = {
  id: string;
  name: string;
  slug: string;
  price: number;
  stock: number;
  event?: string;
  category: string;
  description?: string;
  discountPrice?: number;
  discountPercent?: number;
  images: (string | File)[];
  attributes?: Record<string, any>;
};

export type UseProductsParams = {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  fields?: string;
  category?: string;
  event?: string;
  attributes?: Record<string, string[]>;
};

export type UseRelatedProductsParams = {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  fields?: string;
  category?: string;
  event?: string;
  attributes?: Record<string, string[]>;
};

export type UseEditCommentParams = {
  productId: string;
  commentId: string;
  body: {
    content: string;
    images?: (File | string)[];
  };
};

export type UseDeleteCommentParams = {
  productId: string;
  commentId: string;
};

export type ProductFilterField = {
  name: string;
  label: string;
  type: "text" | "number";
  options?: (string | number)[];
};

export type CommentPayload = {
  content: string;
  rating: number;
  images?: File[];
};

export type ReplyCommentPayload = {
  content: string;
  images?: File[];
};
