import { SimpleEditor as TiptapEditor } from "@/components/text-editor/tiptap-templates/simple/simple-editor";

type Props = {
  field: {
    value: string | undefined;
    onChange: (val: string) => void;
  };
  disabled?: boolean;
};

export const SimpleEditor = ({ field, disabled }: Props) => {
  return (
    <div className={disabled ? "pointer-events-none opacity-60" : ""}>
      <TiptapEditor
        initialContent={field.value || "<p></p>"}
        onChange={field.onChange}
        disabled={disabled}
      />
    </div>
  );
};
