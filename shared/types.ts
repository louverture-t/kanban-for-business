// ─── Enums ────────────────────────────────────────────────

export enum UserRole {
  SUPERADMIN = 'superadmin',
  MANAGER = 'manager',
  USER = 'user',
}

export enum TaskStatus {
  BACKLOG = 'backlog',
  ACTIVE = 'active',
  REVIEW = 'review',
  COMPLETE = 'complete',
}

export enum TaskPriority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum ProjectStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
}

export enum ProjectCategory {
  CLINICAL = 'clinical',
  BUSINESS = 'business',
  HR = 'hr',
  COMPLIANCE = 'compliance',
  IT = 'it',
}

export enum NotificationType {
  ASSIGNMENT = 'assignment',
  COMMENT = 'comment',
  DUE_DATE = 'due_date',
  AI_COMPLETE = 'ai_complete',
}

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
}

// ─── Object Types ─────────────────────────────────────────

export interface IUser {
  _id: string;
  username: string;
  email?: string;
  role: UserRole;
  active: boolean;
  failedAttempts: number;
  lockedUntil?: string;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthPayload {
  token: string;
  user: IUser;
}

export interface TokenPayload {
  userId: string;
  role: UserRole;
}

export interface IProject {
  _id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  color: string;
  category?: ProjectCategory;
  startDate?: string;
  endDate?: string;
  createdBy?: string;
  folderId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IProjectFolder {
  _id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface IProjectMember {
  _id: string;
  projectId: string;
  userId: string;
  user?: IUser;
  addedAt: string;
}

export interface ITask {
  _id: string;
  projectId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  startDate?: string;
  dueDate?: string;
  assigneeId?: string;
  assignee?: IUser;
  position: number;
  createdBy?: string;
  archivedAt?: string;
  completedAt?: string;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ISubtask {
  _id: string;
  taskId: string;
  title: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ITag {
  _id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface ITaskTag {
  _id: string;
  taskId: string;
  tagId: string;
  tag?: ITag;
  createdAt: string;
}

export interface IComment {
  _id: string;
  taskId: string;
  content: string;
  authorId: string;
  author?: IUser;
  createdAt: string;
  updatedAt: string;
}

export interface IAuditLog {
  _id: string;
  taskId?: string;
  userId?: string;
  action: string;
  userName: string;
  changes?: string;
  ipAddress?: string;
  createdAt: string;
}

export interface INotification {
  _id: string;
  userId: string;
  type: NotificationType;
  content: string;
  read: boolean;
  taskId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IInvitation {
  _id: string;
  email: string;
  token: string;
  role: UserRole;
  projectId?: string;
  invitedBy: string;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ITaskPreview {
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: string;
  assigneeId?: string;
}

// ─── Input Types ──────────────────────────────────────────

export interface ProjectInput {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  color?: string;
  category?: ProjectCategory;
  startDate?: string;
  endDate?: string;
  folderId?: string;
}

export interface TaskInput {
  projectId?: string;
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  startDate?: string;
  dueDate?: string;
  assigneeId?: string;
  position?: number;
}

export interface TaskPreviewInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: string;
  assigneeId?: string;
}
