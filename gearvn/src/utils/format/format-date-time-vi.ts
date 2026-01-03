export const formatDateTimeVi = (date: Date | string) => {
  const d = new Date(date);

  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();

  return `${time} - ${day}/${month}/${year}`;
};
