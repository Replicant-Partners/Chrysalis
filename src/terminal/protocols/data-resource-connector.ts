import { DataResourceLink } from './common-types';

class NotImplementedError extends Error {
  constructor(method: string) {
    super(`${method} is not implemented in placeholder DataResourceConnector`);
    this.name = 'NotImplementedError';
  }
}

/**
 * Placeholder data resource connector for lean mode.
 * All methods throw NotImplementedError.
 */
export class DataResourceConnector {
  addResource(_link: DataResourceLink): void {
    throw new NotImplementedError('addResource');
  }

  listResources(): DataResourceLink[] {
    throw new NotImplementedError('listResources');
  }
}
