import React from 'react';
import { FileQuestion } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

export function PlaceholderPage({ title, description, icon }: PlaceholderPageProps) {
  return (
    <div className="emptyState">
      <div className="emptyStateCard">
        <div className="emptyStateIcon">
          {icon || <FileQuestion className="w-10 h-10 text-white" />}
        </div>
        <h2>{title}</h2>
        <p>{description}</p>
        <div className="emptyStateNote">
          <p>
            Halaman ini dalam pengembangan. Akan segera dilengkapi dengan fitur CRUD lengkap.
          </p>
        </div>
      </div>
    </div>
  );
}
