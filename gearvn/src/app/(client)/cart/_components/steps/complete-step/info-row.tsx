type InfoRowProps = {
  label: string;
  value?: string;
  icon: React.ReactNode;
};

export const InfoRow = ({ icon, label, value }: InfoRowProps) => (
  <p className="flex items-start gap-2 text-base">
    <span className="flex-shrink-0">{icon}</span>
    <span className="text-start">
      <strong>{label}:</strong> {value ?? "N/A"}
    </span>
  </p>
);
