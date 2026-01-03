export const replaceUrlParams = (params: Record<string, string>) => {
  const query = new URLSearchParams(params).toString();
  window.history.replaceState(null, "", `${location.pathname}?${query}`);
};
