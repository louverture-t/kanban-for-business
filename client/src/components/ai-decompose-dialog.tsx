import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { Loader2, X, Sparkles } from 'lucide-react';

import { Button } from '@client/components/ui/button';
import { Textarea } from '@client/components/ui/textarea';
import { Badge } from '@client/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@client/components/ui/dialog';
import { useToast } from '@client/hooks/use-toast';
import {
  AI_DECOMPOSE_MUTATION,
  AI_CONFIRM_DECOMPOSITION_MUTATION,
} from '@client/graphql/operations';

// ─── Types ────────────────────────────────────────────────────

interface TaskPreview {
  title: string;
  description?: string;
  priority?: string;
  dueDate?: string;
  assigneeId?: string;
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
  const [step, setStep] = useState<'input' | 'preview'>('input');
  const [text, setText] = useState('');
  const [previews, setPreviews] = useState<TaskPreview[]>([]);

  const [aiDecompose, { loading: analyzing }] = useMutation(AI_DECOMPOSE_MUTATION);
  const [aiConfirm, { loading: creating }] = useMutation(AI_CONFIRM_DECOMPOSITION_MUTATION);

  const handleClose = (val: boolean) => {
    if (!val) {
      setStep('input');
      setText('');
      setPreviews([]);
    }
    onOpenChange(val);
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

  const handleRemove = (index: number) => {
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = async () => {
    if (previews.length === 0) return;
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
            <div className="py-2">
              <Textarea
                placeholder="Describe the work to decompose into tasks, e.g. 'Plan our Q2 billing audit and staff training rollout'"
                className="min-h-[120px] resize-none"
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={analyzing}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)} disabled={analyzing}>
                Cancel
              </Button>
              <Button onClick={handleAnalyze} disabled={!text.trim() || analyzing}>
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
            <div className="py-2 space-y-2 max-h-72 overflow-y-auto">
              {previews.map((task, i) => (
                <div
                  key={task.title}
                  className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{task.title}</p>
                    {task.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {task.description}
                      </p>
                    )}
                    {task.priority && (
                      <Badge variant="secondary" className="mt-1 text-[10px] px-1.5 py-0">
                        {task.priority}
                      </Badge>
                    )}
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                    onClick={() => handleRemove(i)}
                    aria-label={`Remove ${task.title}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {previews.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  All tasks removed. Go back to re-analyze.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('input')} disabled={creating}>
                Back
              </Button>
              <Button onClick={handleConfirm} disabled={previews.length === 0 || creating}>
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
