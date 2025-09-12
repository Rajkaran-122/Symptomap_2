import React, { useMemo, useState } from 'react';
import { useSymptoStore } from '@/store/symptoStore';
import { Button } from '@/components/ui/button';

const AnnotationsPanel: React.FC = () => {
  const { annotations, removeAnnotation } = useSymptoStore() as any;
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return annotations;
    return annotations.filter((a: any) => a.text.toLowerCase().includes(q));
  }, [annotations, query]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">Annotations</h4>
        <span className="text-xs text-muted-foreground">{filtered.length}</span>
      </div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search notes..."
        className="w-full px-2 py-1 text-sm border rounded-md bg-background"
      />
      <div className="max-h-64 overflow-auto space-y-2">
        {filtered.map((a: any) => (
          <div key={a.id} className="border rounded-md p-2 text-sm flex items-start justify-between gap-2">
            <div>
              <div className="text-foreground">{a.text}</div>
              <div className="text-[10px] text-muted-foreground">{a.lat.toFixed(4)}, {a.lng.toFixed(4)} • {new Date(a.createdAt).toLocaleString()}</div>
            </div>
            <Button variant="outline" className="text-xs" onClick={() => removeAnnotation(a.id)}>Delete</Button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-xs text-muted-foreground">No annotations</div>
        )}
      </div>
    </div>
  );
};

export default AnnotationsPanel;


