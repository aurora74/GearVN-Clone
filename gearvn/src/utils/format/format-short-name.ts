export const formatShortName = (fullName: string) => {
  if (!fullName) return "";
  const parts = fullName.trim().split(" ");

  if (parts.length === 1) return parts[0];
  const last = parts.pop();
  const initials = parts.map((p) => p[0].toUpperCase()).join(".") + ".";

  return `${initials}${last}`;
};
