const WEEKDAYS_VI = [
  "Chủ nhật",
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
];

export const formatDateVi = (dateString: Date) => {
  if (!dateString) return "";
  const date = new Date(dateString);

  const weekday = WEEKDAYS_VI[date.getDay()];
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();

  return `${weekday}, ${day}/${month}/${year}`;
};
