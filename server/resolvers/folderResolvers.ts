import { ProjectFolder, Project } from '@server/models/index.js';
import {
  requireAuth,
  requireManagerOrAbove,
  type GraphQLContext,
} from '@server/utils/auth.js';
import { ValidationError, NotFoundError } from '@server/utils/errors.js';
import { sanitizeInput } from '@server/utils/validators.js';

export const folderResolvers = {
  Query: {
    folders: (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      requireAuth(context);
      return ProjectFolder.find().sort({ name: 1 }).exec();
    },
  },

  Mutation: {
    createFolder: async (
      _parent: unknown,
      args: { name: string; color?: string },
      context: GraphQLContext,
    ) => {
      requireManagerOrAbove(context);

      const name = sanitizeInput(args.name.trim());
      if (!name) {
        throw new ValidationError('Folder name is required');
      }

      return ProjectFolder.create({
        name,
        color: args.color ?? '#6b7280',
      });
    },

    updateFolder: async (
      _parent: unknown,
      args: { id: string; name?: string; color?: string },
      context: GraphQLContext,
    ) => {
      requireManagerOrAbove(context);

      const update: Record<string, unknown> = {};

      if (args.name !== undefined) {
        const name = sanitizeInput(args.name.trim());
        if (!name) {
          throw new ValidationError('Folder name cannot be empty');
        }
        update.name = name;
      }

      if (args.color !== undefined) {
        update.color = args.color;
      }

      const folder = await ProjectFolder.findByIdAndUpdate(args.id, update, {
        new: true,
        runValidators: true,
      });

      if (!folder) {
        throw new NotFoundError('Folder not found');
      }

      return folder;
    },

    deleteFolder: async (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext,
    ) => {
      requireManagerOrAbove(context);

      const folder = await ProjectFolder.findByIdAndDelete(args.id);
      if (!folder) {
        throw new NotFoundError('Folder not found');
      }

      // Unset folderId on any projects referencing this folder
      await Project.updateMany(
        { folderId: folder._id },
        { $unset: { folderId: 1 } },
      );

      return true;
    },
  },
};
