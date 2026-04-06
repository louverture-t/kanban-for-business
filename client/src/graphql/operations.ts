import { gql } from '@apollo/client/core';

// ─── Auth ─────────────────────────────────────────────────

export const ME_QUERY = gql`
  query Me {
    me {
      _id
      username
      email
      role
      active
      mustChangePassword
      createdAt
    }
  }
`;

export const LOGIN_MUTATION = gql`
  mutation Login($username: String!, $password: String!) {
    login(username: $username, password: $password) {
      token
      user {
        _id
        username
        email
        role
        mustChangePassword
      }
    }
  }
`;

export const REGISTER_MUTATION = gql`
  mutation Register($username: String!, $password: String!, $email: String, $token: String!) {
    register(username: $username, password: $password, email: $email, token: $token) {
      token
      user {
        _id
        username
        email
        role
        mustChangePassword
      }
    }
  }
`;

export const CHANGE_PASSWORD_MUTATION = gql`
  mutation ChangePassword($currentPassword: String!, $newPassword: String!) {
    changePassword(currentPassword: $currentPassword, newPassword: $newPassword) {
      _id
      mustChangePassword
    }
  }
`;

export const REFRESH_TOKEN_MUTATION = gql`
  mutation RefreshToken {
    refreshToken {
      token
      user {
        _id
        username
        email
        role
        mustChangePassword
      }
    }
  }
`;

export const LOGOUT_MUTATION = gql`
  mutation Logout {
    logout
  }
`;

// ─── Projects ─────────────────────────────────────────────

export const PROJECTS_QUERY = gql`
  query Projects {
    projects {
      _id
      name
      description
      status
      color
      category
      folderId
      memberCount
      createdAt
    }
  }
`;

export const FOLDERS_QUERY = gql`
  query Folders {
    folders {
      _id
      name
      color
    }
  }
`;

// ─── Notifications ────────────────────────────────────────

export const NOTIFICATIONS_QUERY = gql`
  query Notifications {
    notifications {
      _id
      type
      content
      read
      taskId
      createdAt
    }
  }
`;

export const MARK_NOTIFICATION_READ = gql`
  mutation MarkNotificationRead($id: ID!) {
    markNotificationRead(id: $id) {
      _id
      read
    }
  }
`;

export const MARK_ALL_NOTIFICATIONS_READ = gql`
  mutation MarkAllNotificationsRead {
    markAllNotificationsRead
  }
`;

// ─── Project Mutations ───────────────────────────────────

export const CREATE_PROJECT_MUTATION = gql`
  mutation CreateProject($input: ProjectInput!) {
    createProject(input: $input) {
      _id
      name
      description
      status
      color
      category
      startDate
      endDate
      folderId
      createdAt
    }
  }
`;

export const UPDATE_PROJECT_MUTATION = gql`
  mutation UpdateProject($id: ID!, $input: ProjectInput!) {
    updateProject(id: $id, input: $input) {
      _id
      name
      description
      status
      color
      category
      startDate
      endDate
      folderId
      createdAt
    }
  }
`;

// ─── Tasks ───────────────────────────────────────────────

export const TASKS_QUERY = gql`
  query Tasks($projectId: ID, $includeArchived: Boolean) {
    tasks(projectId: $projectId, includeArchived: $includeArchived) {
      _id
      title
      description
      status
      priority
      dueDate
      assigneeId
      assignee {
        _id
        username
        email
      }
      position
      archivedAt
      completedAt
      deletedAt
      createdAt
      updatedAt
    }
  }
`;

export const ARCHIVE_SWEEP_MUTATION = gql`
  mutation ArchiveSweep {
    archiveSweep
  }
`;

// ─── Task Queries & Mutations ─────────────────────────────

export const TASK_QUERY = gql`
  query Task($id: ID!) {
    task(id: $id) {
      _id
      projectId
      title
      description
      status
      priority
      startDate
      dueDate
      assigneeId
      assignee {
        _id
        username
        email
      }
      position
      createdBy
      archivedAt
      completedAt
      deletedAt
      createdAt
      updatedAt
    }
  }
`;

export const CREATE_TASK_MUTATION = gql`
  mutation CreateTask($input: TaskInput!) {
    createTask(input: $input) {
      _id
      projectId
      title
      description
      status
      priority
      startDate
      dueDate
      assigneeId
      position
      createdAt
    }
  }
`;

export const UPDATE_TASK_MUTATION = gql`
  mutation UpdateTask($id: ID!, $input: TaskInput!) {
    updateTask(id: $id, input: $input) {
      _id
      title
      description
      status
      priority
      startDate
      dueDate
      assigneeId
      updatedAt
    }
  }
`;

export const MOVE_TASK_TO_TRASH_MUTATION = gql`
  mutation MoveTaskToTrash($id: ID!) {
    moveTaskToTrash(id: $id) {
      _id
      deletedAt
    }
  }
`;

// ─── Subtasks ─────────────────────────────────────────────

export const SUBTASKS_QUERY = gql`
  query Subtasks($taskId: ID!) {
    subtasks(taskId: $taskId) {
      _id
      title
      completed
      position
      createdAt
      updatedAt
    }
  }
`;

// ─── Comments ─────────────────────────────────────────────

export const COMMENTS_QUERY = gql`
  query Comments($taskId: ID!) {
    comments(taskId: $taskId) {
      _id
      content
      authorId
      author {
        _id
        username
      }
      createdAt
      updatedAt
    }
  }
`;

// ─── Tags ─────────────────────────────────────────────────

export const TAGS_QUERY = gql`
  query Tags {
    tags {
      _id
      name
      color
    }
  }
`;

export const TASK_TAGS_QUERY = gql`
  query TaskTags($taskId: ID!) {
    taskTags(taskId: $taskId) {
      _id
      tagId
      tag {
        _id
        name
        color
      }
    }
  }
`;

// ─── Audit Logs ───────────────────────────────────────────

export const AUDIT_LOGS_QUERY = gql`
  query AuditLogs($taskId: ID!) {
    auditLogs(taskId: $taskId) {
      _id
      action
      userId
      user {
        _id
        username
      }
      changes
      createdAt
    }
  }
`;

// ─── Project Members ──────────────────────────────────────

export const PROJECT_MEMBERS_QUERY = gql`
  query ProjectMembers($projectId: ID!) {
    projectMembers(projectId: $projectId) {
      _id
      userId
      role
      user {
        _id
        username
        email
      }
    }
  }
`;
