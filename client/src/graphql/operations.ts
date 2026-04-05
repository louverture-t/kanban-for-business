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
