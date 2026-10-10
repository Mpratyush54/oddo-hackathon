import type { ReactNode } from 'react';
import { Icon } from './Icon';

export function Empty({
  title = 'Nothing here yet',
  description = 'Your next great thing starts right here.',
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="icon-tile">
        <Icon name="Sprout" size={30} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
