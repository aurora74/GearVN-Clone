export type CategoryFieldsType = "text" | "number";

export type CategoryFields = {
  name: string;
  label: string;
  type: CategoryFieldsType;
  options?: (string | number)[];
};

export type CategoryType = {
  _id: string;
  name: string;
  label: string;
  image: string;
  createdAt: string;
  updatedAt: string;
  fields: CategoryFields[];
};

export type UseCategoriesParams = {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  fields?: string;
};

export type CreateCategoryPayload = {
  name: string;
  label: string;
  fields: CategoryFields[];
  image?: File;
};

export type UpdateCategoryPayload = {
  id: string;
  name?: string;
  label?: string;
  fields?: CategoryFields[];
  image?: File | string;
};
