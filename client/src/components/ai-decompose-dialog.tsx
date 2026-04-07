import { useRef, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client/react';
import { Loader2, Plus, Sparkles, Upload, X } from 'lucide-react';

import { Button } from '@client/components/ui/button';
import { Input } from '@client/components/ui/input';
import { Label } from '@client/components/ui/label';
import { Textarea } from '@client/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@client/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/components/ui/select';
import { useToast } from '@client/hooks/use-toast';
import {
  AI_DECOMPOSE_MUTATION,
  AI_CONFIRM_DECOMPOSITION_MUTATION,
  PROJECT_MEMBERS_QUERY,
} from '@client/graphql/operations';

// ─── Types ────────────────────────────────────────────────────

interface TaskPreview {
  title: string;
  description?: string;
  priority?: string;
  dueDate?: string;
  assigneeId?: string;
}

interface ProjectMember {
  _id: string;
  userId: string;
  user: {
    _id: string;
    username: string;
  };
}

interface AiDecomposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess?: () => void;
}

// ─── Component ────────────────────────────────────────────────

export function AiDecomposeDialog({
  open,
  onOpenChange,
  projectId,
  onSuccess,
}: AiDecomposeDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'input' | 'preview'>('input');
  const [text, setText] = useState('');
  const [previews, setPreviews] = useState<TaskPreview[]>([]);
  const [uploading, setUploading] = useState(false);

  const [aiDecompose, { loading: analyzing }] = useMutation(AI_DECOMPOSE_MUTATION);
  const [aiConfirm, { loading: creating }] = useMutation(AI_CONFIRM_DECOMPOSITION_MUTATION);

  const { data: membersData } = useQuery(PROJECT_MEMBERS_QUERY, {
    variables: { projectId },
    skip: step !== 'preview',
  });

  const members: ProjectMember[] =
    (membersData as { projectMembers?: ProjectMember[] } | undefined)?.projectMembers ?? [];

  const handleClose = (val: boolean) => {
    if (!val) {
      setStep('input');
      setText('');
      setPreviews([]);
    }
    onOpenChange(val);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
      const data = (await res.json()) as { text?: string; error?: string };
      if (data.text) {
        setText(data.text);
      } else {
        throw new Error(data.error ?? 'No text extracted from file.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'File upload failed.';
      toast({ title: 'Upload Error', description: msg, variant: 'destructive' });
    } finally {
      setUploading(false);
      // reset so same file can be re-uploaded
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    try {
      const { data } = await aiDecompose({ variables: { projectId, text } });
      const results: TaskPreview[] =
        (data as { aiDecompose?: TaskPreview[] } | null | undefined)?.aiDecompose ?? [];
      if (results.length === 0) {
        toast({ title: 'No tasks generated', description: 'Try providing more detail.' });
        return;
      }
      setPreviews(results);
      setStep('preview');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI analysis failed.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  };

  const updatePreview = (index: number, field: keyof TaskPreview, value: string) => {
    setPreviews((prev) =>
      prev.map((task, i) => (i === index ? { ...task, [field]: value } : task)),
    );
  };

  const handleRemove = (index: number) => {
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddTask = () => {
    setPreviews((prev) => [...prev, { title: '' }]);
  };

  const handleConfirm = async () => {
    const hasEmptyTitle = previews.some((t) => !t.title.trim());
    if (previews.length === 0 || hasEmptyTitle) return;

    try {
      const tasks = previews.map(({ title, description, priority, dueDate, assigneeId }) => ({
        title,
        ...(description && { description }),
        ...(priority && { priority }),
        ...(dueDate && { dueDate }),
        ...(assigneeId && { assigneeId }),
      }));
      await aiConfirm({ variables: { projectId, tasks } });
      toast({ title: `${previews.length} task${previews.length > 1 ? 's' : ''} created` });
      handleClose(false);
      onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create tasks.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  };

  const confirmDisabled =
    creating || previews.length === 0 || previews.some((t) => !t.title.trim());

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Decompose
          </DialogTitle>
        </DialogHeader>

        {step === 'input' ? (
          <>
            <div className="py-2 space-y-3">
              <Textarea
                placeholder="Describe the work to decompose into tasks, e.g. 'Plan our Q2 billing audit and staff training rollout'"
                className="min-h-[120px] resize-none"
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={analyzing || uploading}
              />
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.docx,.pdf"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading || analyzing}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <Upload className="mr-1.5 h-3.5 w-3.5" />
                      Upload File
                    </>
                  )}
                </Button>
                <span className="text-xs text-muted-foreground">.txt, .md, .docx, .pdf · 5 MB max</span>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={analyzing || uploading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAnalyze}
                disabled={!text.trim() || analyzing || uploading}
              >
                {analyzing ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Analyzing…
                  </>
                ) : (
                  'Analyze'
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="py-2 space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {previews.map((task, i) => {
                const emptyTitle = !task.title.trim();
                return (
                  <div
                    key={i}
                    className="rounded-md border px-3 py-3 space-y-2 text-sm relative"
                  >
                    {/* Remove button */}
                    <button
                      type="button"
                      className="absolute top-2 right-2 rounded p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                      onClick={() => handleRemove(i)}
                      aria-label={`Remove task ${i + 1}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>

                    {/* Title */}
                    <div className="space-y-1 pr-6">
                      <Label className="text-xs text-muted-foreground">Title *</Label>
                      <Input
                        value={task.title}
                        onChange={(e) => updatePreview(i, 'title', e.target.value)}
                        placeholder="Task title"
                        className={emptyTitle ? 'border-destructive focus-visible:ring-destructive' : ''}
                      />
                    </div>

                    {/* Description */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Description</Label>
                      <Textarea
                        value={task.description ?? ''}
                        onChange={(e) => updatePreview(i, 'description', e.target.value)}
                        placeholder="Optional description"
                        className="resize-none min-h-[56px]"
                        rows={2}
                      />
                    </div>

                    {/* Priority + Due Date row */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Priority</Label>
                        <Select
                          value={task.priority ?? ''}
                          onValueChange={(val) => updatePreview(i, 'priority', val)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Due Date</Label>
                        <Input
                          type="date"
                          className="h-8 text-xs"
                          value={task.dueDate ?? ''}
                          onChange={(e) => updatePreview(i, 'dueDate', e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Assignee */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Assignee</Label>
                      <Select
                        value={task.assigneeId ?? ''}
                        onValueChange={(val) => updatePreview(i, 'assigneeId', val)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          {members.map((m) => (
                            <SelectItem key={m.userId} value={m.userId}>
                              {m.user.username}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}

              {previews.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  All tasks removed. Go back to re-analyze.
                </p>
              )}

              {/* Add Task button */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleAddTask}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add Task
              </Button>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('input')} disabled={creating}>
                Back
              </Button>
              <Button onClick={handleConfirm} disabled={confirmDisabled}>
                {creating ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Creating…
                  </>
                ) : (
                  `Create ${previews.length} Task${previews.length !== 1 ? 's' : ''}`
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
