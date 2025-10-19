import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface ShortenedUrl {
  shortUrl: string;
  originalUrl: string;
  createdAt: string;
  expiry: number;
}

interface UrlState {
  urls: ShortenedUrl[];
  loading: boolean;
  error: string | null;
}

const initialState: UrlState = {
  urls: [],
  loading: false,
  error: null,
};

const urlSlice = createSlice({
  name: "url",
  initialState,
  reducers: {
    addUrl: (state, action: PayloadAction<ShortenedUrl>) => {
      state.urls.unshift(action.payload);
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const { addUrl, setLoading, setError } = urlSlice.actions;
export default urlSlice.reducer;
