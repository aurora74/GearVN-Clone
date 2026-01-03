type InfoItemProps = {
  label: string;
  value: string;
  icon: React.ReactNode;
};

export const InfoItem = ({ icon, label, value }: InfoItemProps) => (
  <p className="flex items-start gap-2">
    {icon}
    <span>
      <strong>{label}:</strong> {value}
    </span>
  </p>
);
