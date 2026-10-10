export function Avatar({
  name,
  small = false,
  index = 0,
}: {
  name: string;
  small?: boolean;
  index?: number;
}) {
  return (
    <span className={`avatar ${small ? 'small' : ''} avatar-${index % 4}`} title={name}>
      {name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')}
    </span>
  );
}
