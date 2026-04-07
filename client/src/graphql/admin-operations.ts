import { gql } from '@apollo/client/core';

// ─── Admin ───────────────────────────────────────────────

export const ADMIN_USERS_QUERY = gql`
  query AdminUsers {
    adminUsers {
      _id
      username
      email
      role
      active
      createdAt
    }
  }
`;

export const ADMIN_INVITATIONS_QUERY = gql`
  query AdminInvitations {
    adminInvitations {
      _id
      email
      token
      role
      projectId
      status
      expiresAt
      createdAt
    }
  }
`;

export const UPDATE_USER_MUTATION = gql`
  mutation UpdateUser($id: ID!, $role: UserRole, $active: Boolean) {
    updateUser(id: $id, role: $role, active: $active) {
      _id
      username
      email
      role
      active
    }
  }
`;

export const CREATE_INVITATION_MUTATION = gql`
  mutation CreateInvitation($email: String!, $role: UserRole, $projectId: ID) {
    createInvitation(email: $email, role: $role, projectId: $projectId) {
      _id
      email
      token
      role
      projectId
      status
      expiresAt
      createdAt
    }
  }
`;

export const ADD_PROJECT_MEMBER_MUTATION = gql`
  mutation AddProjectMember($projectId: ID!, $userId: ID!) {
    addProjectMember(projectId: $projectId, userId: $userId) {
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

export const REMOVE_PROJECT_MEMBER_MUTATION = gql`
  mutation RemoveProjectMember($projectId: ID!, $userId: ID!) {
    removeProjectMember(projectId: $projectId, userId: $userId)
  }
`;
