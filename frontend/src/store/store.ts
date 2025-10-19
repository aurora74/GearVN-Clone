import { configureStore } from "@reduxjs/toolkit";
import urlReducer from "./urlSlice";

export const store = configureStore({
  reducer: {
    url: urlReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
