import { authResolvers } from './authResolvers.js';
import { folderResolvers } from './folderResolvers.js';
import { projectResolvers } from './projectResolvers.js';
import { taskResolvers } from './taskResolvers.js';
import { subtaskResolvers } from './subtaskResolvers.js';
import { commentResolvers } from './commentResolvers.js';
import { tagResolvers } from './tagResolvers.js';
import { notificationResolvers } from './notificationResolvers.js';
import { adminResolvers } from './adminResolvers.js';
import { aiResolvers } from './aiResolvers.js';

export const resolvers = {
  Query: {
    ...authResolvers.Query,
    ...folderResolvers.Query,
    ...projectResolvers.Query,
    ...taskResolvers.Query,
    ...subtaskResolvers.Query,
    ...commentResolvers.Query,
    ...tagResolvers.Query,
    ...notificationResolvers.Query,
    ...adminResolvers.Query,
  },
  Mutation: {
    ...authResolvers.Mutation,
    ...folderResolvers.Mutation,
    ...projectResolvers.Mutation,
    ...taskResolvers.Mutation,
    ...subtaskResolvers.Mutation,
    ...commentResolvers.Mutation,
    ...tagResolvers.Mutation,
    ...notificationResolvers.Mutation,
    ...adminResolvers.Mutation,
    ...aiResolvers.Mutation,
  },
  // Field resolvers
  Project: {
    ...projectResolvers.Project,
  },
  Task: {
    ...taskResolvers.Task,
  },
  Comment: {
    ...commentResolvers.Comment,
  },
};
