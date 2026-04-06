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
      projectId
      title
      description
      status
      priority
      startDate
      dueDate
      assigneeId
      position
      archivedAt
      completedAt
      deletedAt
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_TASK_MUTATION = gql`
  mutation DeleteTask($id: ID!) {
    deleteTask(id: $id) {
      _id
      deletedAt
    }
  }
`;

export const RESTORE_TASK_MUTATION = gql`
  mutation RestoreTask($id: ID!) {
    restoreTask(id: $id) {
      _id
      deletedAt
    }
  }
`;

export const UNARCHIVE_TASK_MUTATION = gql`
  mutation UnarchiveTask($id: ID!) {
    unarchiveTask(id: $id) {
      _id
      archivedAt
    }
  }
`;

export const ARCHIVE_SWEEP_MUTATION = gql`
  mutation ArchiveSweep {
    archiveSweep
  }
`;

export const TRASHED_TASKS_QUERY = gql`
  query TrashedTasks {
    trashedTasks {
      _id
      projectId
      title
      status
      priority
      assigneeId
      assignee {
        _id
        username
      }
      deletedAt
      createdAt
    }
  }
`;

// ─── Subtasks ────────────────────────────────────────────

export const SUBTASKS_QUERY = gql`
  query Subtasks($taskId: ID!) {
    subtasks(taskId: $taskId) {
      _id
      taskId
      title
      completed
      createdAt
    }
  }
`;

export const CREATE_SUBTASK_MUTATION = gql`
  mutation CreateSubtask($taskId: ID!, $title: String!, $completed: Boolean) {
    createSubtask(taskId: $taskId, title: $title, completed: $completed) {
      _id
      taskId
      title
      completed
    }
  }
`;

export const UPDATE_SUBTASK_MUTATION = gql`
  mutation UpdateSubtask($id: ID!, $title: String, $completed: Boolean) {
    updateSubtask(id: $id, title: $title, completed: $completed) {
      _id
      title
      completed
    }
  }
`;

export const DELETE_SUBTASK_MUTATION = gql`
  mutation DeleteSubtask($id: ID!) {
    deleteSubtask(id: $id)
  }
`;

// ─── Comments ────────────────────────────────────────────

export const COMMENTS_QUERY = gql`
  query Comments($taskId: ID!) {
    comments(taskId: $taskId) {
      _id
      taskId
      content
      authorId
      author {
        _id
        username
      }
      createdAt
    }
  }
`;

export const CREATE_COMMENT_MUTATION = gql`
  mutation CreateComment($taskId: ID!, $content: String!) {
    createComment(taskId: $taskId, content: $content) {
      _id
      taskId
      content
      authorId
      author {
        _id
        username
      }
      createdAt
    }
  }
`;

export const DELETE_COMMENT_MUTATION = gql`
  mutation DeleteComment($id: ID!) {
    deleteComment(id: $id)
  }
`;

// ─── Tags ────────────────────────────────────────────────

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
      name
      color
    }
  }
`;

export const CREATE_TAG_MUTATION = gql`
  mutation CreateTag($name: String!, $color: String) {
    createTag(name: $name, color: $color) {
      _id
      name
      color
    }
  }
`;

export const ADD_TAG_TO_TASK_MUTATION = gql`
  mutation AddTagToTask($taskId: ID!, $tagId: ID!) {
    addTagToTask(taskId: $taskId, tagId: $tagId) {
      _id
      taskId
      tagId
    }
  }
`;

export const REMOVE_TAG_FROM_TASK_MUTATION = gql`
  mutation RemoveTagFromTask($taskId: ID!, $tagId: ID!) {
    removeTagFromTask(taskId: $taskId, tagId: $tagId)
  }
`;

// ─── Audit Logs ──────────────────────────────────────────

export const AUDIT_LOGS_QUERY = gql`
  query AuditLogs($taskId: ID!) {
    auditLogs(taskId: $taskId) {
      _id
      taskId
      userId
      action
      userName
      changes
      createdAt
    }
  }
`;

// ─── Project Members ─────────────────────────────────────

export const PROJECT_MEMBERS_QUERY = gql`
  query ProjectMembers($projectId: ID!) {
    projectMembers(projectId: $projectId) {
      _id
      projectId
      userId
      user {
        _id
        username
      }
      addedAt
    }
  }
`;

// ─── AI ──────────────────────────────────────────────────

export const AI_GENERATE_SUBTASKS_MUTATION = gql`
  mutation AiGenerateSubtasks($taskId: ID!) {
    aiGenerateSubtasks(taskId: $taskId)
  }
`;

export const AI_DECOMPOSE_MUTATION = gql`
  mutation AiDecompose($projectId: ID!, $text: String!) {
    aiDecompose(projectId: $projectId, text: $text) {
      title
      description
      priority
      dueDate
      assigneeId
    }
  }
`;

export const AI_CONFIRM_DECOMPOSITION_MUTATION = gql`
  mutation AiConfirmDecomposition($projectId: ID!, $tasks: [TaskPreviewInput!]!) {
    aiConfirmDecomposition(projectId: $projectId, tasks: $tasks) {
      _id
      title
      status
      priority
    }
  }
`;
