import { useEffect, useMemo, useState } from 'react';
import { FolderKanban, Plus, RefreshCw } from 'lucide-react';
import { projectAPI } from '../lib/api';
import { useAppStore } from '../lib/store';
import { toast } from 'sonner';

type Project = {
  projectId: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  archivedAt?: string | null;
};

export default function ProjectSwitcher() {
  const { projectId, setProjectId } = useAppStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const currentProject = useMemo(
    () => projects.find((p) => p.projectId === projectId) || projects.find((p) => p.projectId === 'default'),
    [projects, projectId]
  );

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await projectAPI.list();
      const list = (res?.data || []) as Project[];
      setProjects(list);
      if (!list.some((p) => p.projectId === projectId) && list.length > 0) {
        setProjectId(list[0].projectId);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async () => {
    if (!newName.trim()) return;
    try {
      const res = await projectAPI.create({ name: newName.trim(), description: newDescription.trim() });
      const created = res?.data as Project | undefined;
      toast.success('Project created');
      setCreateOpen(false);
      setNewName('');
      setNewDescription('');
      await load();
      if (created?.projectId) setProjectId(created.projectId);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create project');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="hidden sm:flex items-center gap-2 text-xs text-muted">
        <FolderKanban className="w-4 h-4 text-muted" />
        <span className="font-semibold uppercase tracking-wider">Project</span>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="h-9 rounded-lg bg-surface border border-border px-3 text-sm text-foreground focus:outline-none focus:border-primary/50"
          aria-label="Select project"
          disabled={isLoading || projects.length === 0}
        >
          {projects.length === 0 ? (
            <option value="default">default</option>
          ) : (
            projects.map((p) => (
              <option key={p.projectId} value={p.projectId}>
                {p.name}
              </option>
            ))
          )}
        </select>

        <button
          onClick={() => void load()}
          className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border bg-surface hover:bg-surface-alt transition-colors"
          aria-label="Refresh projects"
          title="Refresh projects"
        >
          <RefreshCw className={`w-4 h-4 text-muted ${isLoading ? 'animate-spin' : ''}`} />
        </button>

        <button
          onClick={() => setCreateOpen((v) => !v)}
          className="h-9 inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-foreground hover:bg-surface-alt transition-colors"
          aria-expanded={createOpen}
        >
          <Plus className="w-4 h-4 text-primary" />
          <span className="hidden md:inline">New</span>
        </button>
      </div>

      {createOpen && (
        <div className="absolute right-6 top-[70px] z-50 w-[340px] bg-surface border border-border rounded-xl shadow-2xl p-4">
          <div className="mb-3">
            <p className="text-sm font-semibold text-foreground">Create project</p>
            <p className="text-xs text-muted mt-0.5">
              Current: <span className="text-foreground/80">{currentProject?.name || '—'}</span>
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">Name</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full h-10 rounded-lg bg-surface border border-border px-3 text-sm text-foreground focus:outline-none focus:border-primary/50"
                placeholder="e.g. Payments QA"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">Description</label>
              <input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="w-full h-10 rounded-lg bg-surface border border-border px-3 text-sm text-foreground focus:outline-none focus:border-primary/50"
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              onClick={() => setCreateOpen(false)}
              className="h-9 px-3 rounded-lg border border-border bg-surface hover:bg-surface-alt text-sm text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => void create()}
              disabled={!newName.trim()}
              className="h-9 px-4 rounded-lg bg-[#0ea5e9] hover:bg-[#0284c7] text-white text-sm font-semibold shadow-xs disabled:opacity-40 transition-colors"
            >
              Create
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

