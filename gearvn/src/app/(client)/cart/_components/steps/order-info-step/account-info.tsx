type AccountInfoProps = {
  phone?: string;
  address?: string;
  fullName?: string;
};

const Field = ({ label, value }: { label: string; value?: string }) => (
  <div>
    <dt className="text-sm font-semibold">{label}</dt>
    <dd className="text-base">
      {value != null && value !== "" ? value : "Chưa có"}
    </dd>
  </div>
);

export const AccountInfo = ({ fullName, phone, address }: AccountInfoProps) => (
  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <Field label="Họ tên" value={fullName} />
    <Field label="Số điện thoại" value={phone} />
    <div className="sm:col-span-2">
      <Field label="Địa chỉ" value={address} />
    </div>
  </dl>
);
