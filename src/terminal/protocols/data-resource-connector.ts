import { DataResourceLink } from './common-types';

/**
 * Placeholder data resource connector for lean mode.
 */
export class DataResourceConnector {
  private resources: Map<string, DataResourceLink> = new Map();

  addResource(link: DataResourceLink): void {
    this.resources.set(link.id, link);
  }

  listResources(): DataResourceLink[] {
    return Array.from(this.resources.values());
  }
}
