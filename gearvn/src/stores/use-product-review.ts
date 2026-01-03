import { create } from "zustand";

type ProductReviewState = {
  // --- State ---
  rating: number;
  comment: string;
  images: File[];
  activeReplyId: string | null;
  replyTexts: Record<string, string>;
  replyImages: Record<string, File[]>;

  // --- Reset ---
  resetCommentForm: () => void;
  resetReplyForm: () => void;

  // --- Setters ---
  setRating: (rating: number) => void;
  setComment: (comment: string) => void;
  setImages: (images: File[]) => void;
  setActiveReplyId: (id: string | null) => void;

  // --- Reply actions ---
  addReplyText: (id: string, text: string) => void;
  addReplyImage: (id: string, files: File[]) => void;
  removeReplyImage: (id: string, index: number) => void;
  setReplyTexts: (texts: Record<string, string>) => void;
  setReplyImages: (images: Record<string, File[]>) => void;

  // --- Image actions ---
  removeImage: (index: number) => void;
};

export const useProductReviewStore = create<ProductReviewState>((set) => ({
  // --- State ---
  rating: 5,
  comment: "",
  images: [],
  activeReplyId: null,
  replyTexts: {},
  replyImages: {},

  // --- Reset ---
  resetCommentForm: () => set({ comment: "", rating: 5, images: [] }),
  resetReplyForm: () =>
    set({ replyTexts: {}, replyImages: {}, activeReplyId: null }),

  // --- Setters ---
  setRating: (rating) => set({ rating }),
  setComment: (comment) => set({ comment }),
  setImages: (images) => set({ images }),
  setActiveReplyId: (id) => set({ activeReplyId: id }),

  // --- Reply actions ---
  addReplyText: (id, text) =>
    set((state) => ({ replyTexts: { ...state.replyTexts, [id]: text } })),
  addReplyImage: (id, files) =>
    set((state) => ({
      replyImages: {
        ...state.replyImages,
        [id]: [...(state.replyImages[id] || []), ...files],
      },
    })),
  removeReplyImage: (id, index) =>
    set((state) => ({
      replyImages: {
        ...state.replyImages,
        [id]: state.replyImages[id].filter((_, i) => i !== index),
      },
    })),
  setReplyTexts: (texts) => set({ replyTexts: texts }),
  setReplyImages: (images) => set({ replyImages: images }),

  // --- Image actions ---
  removeImage: (index) =>
    set((state) => ({ images: state.images.filter((_, i) => i !== index) })),
}));
