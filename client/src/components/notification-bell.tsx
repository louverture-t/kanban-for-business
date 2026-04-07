import { useRef, useState, useEffect, useCallback } from 'react';
import { useMutation } from '@apollo/client/react';
import { Bell, UserCheck, MessageSquare, Clock } from 'lucide-react';
import { MARK_NOTIFICATION_READ, MARK_ALL_NOTIFICATIONS_READ } from '@client/graphql/operations';
import type { INotification } from '@shared/types';
import { NotificationType } from '@shared/types';

// Usage:
// <NotificationBell notifications={notifications} onRefetch={refetch} />

interface NotificationBellProps {
  notifications: INotification[];
  onRefetch: () => void;
}

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  const diffMo = Math.floor(diffDay / 30);
  return `${diffMo} month${diffMo === 1 ? '' : 's'} ago`;
}

function TypeIcon({ type }: { type: NotificationType }) {
  const cls = 'h-4 w-4 flex-shrink-0 text-muted-foreground';
  switch (type) {
    case NotificationType.ASSIGNMENT:
      return <UserCheck className={cls} aria-hidden="true" />;
    case NotificationType.COMMENT:
      return <MessageSquare className={cls} aria-hidden="true" />;
    case NotificationType.DUE_DATE:
      return <Clock className={cls} aria-hidden="true" />;
    default:
      return <Bell className={cls} aria-hidden="true" />;
  }
}

export function NotificationBell({ notifications, onRefetch }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [markRead] = useMutation(MARK_NOTIFICATION_READ);
  const [markAllRead] = useMutation(MARK_ALL_NOTIFICATIONS_READ);

  // Sort newest first
  const sorted = [...notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Click-outside detection
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleNotificationClick = useCallback(
    async (notification: INotification) => {
      if (!notification.read) {
        await markRead({ variables: { id: notification._id } });
        onRefetch();
      }
      setOpen(false);
    },
    [markRead, onRefetch],
  );

  const handleMarkAllRead = useCallback(async () => {
    await markAllRead();
    onRefetch();
  }, [markAllRead, onRefetch]);

  return (
    <div ref={wrapperRef} className="relative mb-3">
      {/* Bell trigger button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      >
        <div className="relative">
          <Bell className="h-4 w-4" aria-hidden="true" />
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium leading-none text-destructive-foreground"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        <span>Notifications</span>
      </button>

      {/* Popover panel */}
      {open && (
        <div
          role="menu"
          aria-label="Notifications panel"
          className="absolute bottom-full left-0 z-50 mb-2 w-80 rounded-md border border-border bg-card shadow-lg"
        >
          {/* Panel header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs text-primary hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Notification list */}
          <ul
            className="max-h-80 overflow-y-auto"
            role="list"
            aria-label="Notification items"
          >
            {sorted.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                No notifications
              </li>
            ) : (
              sorted.map((notification) => (
                <li key={notification._id}>
                  <button
                    type="button"
                    onClick={() => handleNotificationClick(notification)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent ${
                      !notification.read ? 'border-l-2 border-primary bg-primary/5' : ''
                    }`}
                    aria-label={`${notification.read ? '' : 'Unread: '}${notification.content}`}
                  >
                    <span className="mt-0.5">
                      <TypeIcon type={notification.type} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-foreground">{notification.content}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {formatRelativeTime(notification.createdAt)}
                      </span>
                    </span>
                    {!notification.read && (
                      <span
                        aria-hidden="true"
                        className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary"
                      />
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
