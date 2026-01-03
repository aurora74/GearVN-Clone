export const formatDateVi = (dateString: Date) => {
  if (!dateString) return "";
  const date = new Date(dateString);

  return date.toLocaleDateString("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};
