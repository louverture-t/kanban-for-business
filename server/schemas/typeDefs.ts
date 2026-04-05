const typeDefs = `#graphql
  # ─── Enums ────────────────────────────────────────────────

  enum UserRole {
    superadmin
    manager
    user
  }

  enum TaskStatus {
    backlog
    active
    review
    complete
  }

  enum TaskPriority {
    high
    medium
    low
  }

  enum ProjectStatus {
    active
    paused
    completed
  }

  enum ProjectCategory {
    clinical
    business
    hr
    compliance
    it
  }

  enum NotificationType {
    assignment
    comment
    due_date
    ai_complete
  }

  enum InvitationStatus {
    pending
    accepted
    expired
  }

  # ─── Object Types ─────────────────────────────────────────

  type User {
    _id: ID!
    username: String!
    email: String
    role: UserRole!
    active: Boolean!
    failedAttempts: Int!
    lockedUntil: String
    mustChangePassword: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type Project {
    _id: ID!
    name: String!
    description: String
    status: ProjectStatus!
    color: String!
    category: ProjectCategory
    startDate: String
    endDate: String
    createdBy: ID
    folderId: ID
    createdAt: String!
    updatedAt: String!
  }

  type ProjectFolder {
    _id: ID!
    name: String!
    color: String!
    createdAt: String!
    updatedAt: String!
  }

  type ProjectMember {
    _id: ID!
    projectId: ID!
    userId: ID!
    user: User
    addedAt: String!
  }

  type Task {
    _id: ID!
    projectId: ID!
    title: String!
    description: String
    status: TaskStatus!
    priority: TaskPriority!
    startDate: String
    dueDate: String
    assigneeId: ID
    assignee: User
    position: Int!
    createdBy: ID
    archivedAt: String
    completedAt: String
    deletedAt: String
    createdAt: String!
    updatedAt: String!
  }

  type Subtask {
    _id: ID!
    taskId: ID!
    title: String!
    completed: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type Tag {
    _id: ID!
    name: String!
    color: String!
    createdAt: String!
    updatedAt: String!
  }

  type TaskTag {
    _id: ID!
    taskId: ID!
    tagId: ID!
    tag: Tag
    createdAt: String!
  }

  type Comment {
    _id: ID!
    taskId: ID!
    content: String!
    authorId: ID!
    author: User
    createdAt: String!
    updatedAt: String!
  }

  type AuditLog {
    _id: ID!
    taskId: ID
    userId: ID
    action: String!
    userName: String!
    changes: String
    ipAddress: String
    createdAt: String!
  }

  type Notification {
    _id: ID!
    userId: ID!
    type: NotificationType!
    content: String!
    read: Boolean!
    taskId: ID
    createdAt: String!
    updatedAt: String!
  }

  type Invitation {
    _id: ID!
    email: String!
    token: String!
    role: UserRole!
    projectId: ID
    invitedBy: ID!
    status: InvitationStatus!
    expiresAt: String!
    createdAt: String!
    updatedAt: String!
  }

  type TaskPreview {
    title: String!
    description: String
    priority: TaskPriority
    dueDate: String
    assigneeId: ID
  }

  # ─── Input Types ──────────────────────────────────────────

  input ProjectInput {
    name: String
    description: String
    status: ProjectStatus
    color: String
    category: ProjectCategory
    startDate: String
    endDate: String
    folderId: ID
  }

  input TaskInput {
    projectId: ID
    title: String
    description: String
    status: TaskStatus
    priority: TaskPriority
    startDate: String
    dueDate: String
    assigneeId: ID
    position: Int
  }

  input TaskPreviewInput {
    title: String!
    description: String
    priority: TaskPriority
    dueDate: String
    assigneeId: ID
  }

  # ─── Queries ──────────────────────────────────────────────

  type Query {
    # Auth
    me: User

    # Folders
    folders: [ProjectFolder!]!

    # Projects
    projects: [Project!]!
    project(id: ID!): Project

    # Project Members
    projectMembers(projectId: ID!): [ProjectMember!]!

    # Tasks
    tasks(projectId: ID, includeArchived: Boolean): [Task!]!
    task(id: ID!): Task
    searchTasks(query: String!): [Task!]!
    trashedTasks: [Task!]!

    # Subtasks
    subtasks(taskId: ID!): [Subtask!]!

    # Comments
    comments(taskId: ID!): [Comment!]!

    # Audit Logs
    auditLogs(taskId: ID!): [AuditLog!]!

    # Tags
    tags: [Tag!]!
    taskTags(taskId: ID!): [Tag!]!

    # Notifications
    notifications: [Notification!]!

    # Admin
    adminUsers: [User!]!
    adminInvitations: [Invitation!]!
  }

  # ─── Mutations ────────────────────────────────────────────

  type Mutation {
    # Auth
    login(username: String!, password: String!): AuthPayload!
    register(username: String!, password: String!, email: String, token: String!): AuthPayload!
    changePassword(currentPassword: String!, newPassword: String!): User!
    refreshToken: AuthPayload!
    logout: Boolean!

    # Folders
    createFolder(name: String!, color: String): ProjectFolder!
    updateFolder(id: ID!, name: String, color: String): ProjectFolder!
    deleteFolder(id: ID!): Boolean!

    # Projects
    createProject(input: ProjectInput!): Project!
    updateProject(id: ID!, input: ProjectInput!): Project!
    deleteProject(id: ID!): Boolean!
    addProjectMember(projectId: ID!, userId: ID!): ProjectMember!
    removeProjectMember(projectId: ID!, userId: ID!): Boolean!

    # Tasks
    createTask(input: TaskInput!): Task!
    updateTask(id: ID!, input: TaskInput!): Task!
    deleteTask(id: ID!): Task!
    restoreTask(id: ID!): Task!
    unarchiveTask(id: ID!): Task!
    archiveSweep: Int!
    purgeSweep: Int!

    # Subtasks
    createSubtask(taskId: ID!, title: String!, completed: Boolean): Subtask!
    updateSubtask(id: ID!, title: String, completed: Boolean): Subtask!
    deleteSubtask(id: ID!): Boolean!

    # Comments
    createComment(taskId: ID!, content: String!): Comment!
    deleteComment(id: ID!): Boolean!

    # Tags
    createTag(name: String!, color: String): Tag!
    addTagToTask(taskId: ID!, tagId: ID!): TaskTag!
    removeTagFromTask(taskId: ID!, tagId: ID!): Boolean!

    # Notifications
    markNotificationRead(id: ID!): Notification!
    markAllNotificationsRead: Boolean!

    # Admin
    updateUser(id: ID!, role: UserRole, active: Boolean): User!
    createInvitation(email: String!, role: UserRole, projectId: ID): Invitation!

    # AI
    aiDecompose(projectId: ID!, text: String!): [TaskPreview!]!
    aiConfirmDecomposition(projectId: ID!, tasks: [TaskPreviewInput!]!): [Task!]!
    aiGenerateSubtasks(taskId: ID!): [String!]!
  }
`;

export default typeDefs;
