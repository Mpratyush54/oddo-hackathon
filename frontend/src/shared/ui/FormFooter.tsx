import { Button } from './Button';

export function FormFooter({
  onClose,
  label = 'Save changes',
}: {
  onClose: () => void;
  label?: string;
}) {
  return (
    <div className="form-footer">
      <Button variant="secondary" onClick={onClose}>
        Cancel
      </Button>
      <Button type="submit" icon="Check">
        {label}
      </Button>
    </div>
  );
}
