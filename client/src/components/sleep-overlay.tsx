import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@apollo/client/react';
import { Button } from '@client/components/ui/button';
import { REFRESH_TOKEN_MUTATION } from '@client/graphql/operations';
import { getAccessToken, setAccessToken, clearAccessToken } from '@client/utils/auth';

interface SleepOverlayProps {
  resetTimer: () => void;
}

export function SleepOverlay({ resetTimer }: SleepOverlayProps) {
  const navigate = useNavigate();
  const [refreshMutation] = useMutation(REFRESH_TOKEN_MUTATION);

  const handleWakeUp = useCallback(async () => {
    resetTimer();

    const token = getAccessToken();

    if (!token) {
      // No token in memory — attempt refresh via cookie
      try {
        const { data } = await refreshMutation() as { data: any };
        if (data?.refreshToken?.token) {
          setAccessToken(data.refreshToken.token);
          return; // Successfully refreshed, stay on page
        }
      } catch {
        // Refresh failed
      }
      clearAccessToken();
      navigate('/login', { replace: true });
      return;
    }

    // Token exists — decode and check expiry
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const isExpired = payload.exp * 1000 < Date.now();

      if (isExpired) {
        const { data } = await refreshMutation() as { data: any };
        if (data?.refreshToken?.token) {
          setAccessToken(data.refreshToken.token);
          return;
        }
        clearAccessToken();
        navigate('/login', { replace: true });
      }
      // Token still valid — nothing to do
    } catch {
      // Malformed token — attempt refresh
      try {
        const { data } = await refreshMutation() as { data: any };
        if (data?.refreshToken?.token) {
          setAccessToken(data.refreshToken.token);
          return;
        }
      } catch {
        // Refresh failed
      }
      clearAccessToken();
      navigate('/login', { replace: true });
    }
  }, [resetTimer, refreshMutation, navigate]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6 rounded-xl border bg-card p-10 shadow-2xl">
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-2xl font-semibold text-foreground">Session Paused</h2>
          <p className="text-sm text-muted-foreground">
            You've been inactive for 15 minutes.
          </p>
        </div>
        <Button size="lg" onClick={handleWakeUp}>
          Wake Up
        </Button>
      </div>
    </div>
  );
}
