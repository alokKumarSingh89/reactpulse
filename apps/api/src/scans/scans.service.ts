import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DeviceType, ScanStatus, ScanTrigger } from '@reactpulse/database';

import { DatabaseService } from '../database/database.service';
import { ScanQueueService } from '../queue/scan-queue.service';

@Injectable()
export class ScansService {
  constructor(
    private readonly database: DatabaseService,
    private readonly scanQueue: ScanQueueService,
  ) {}

  async create(
    organizationId: string,
    projectId: string,
    environmentId: string,
  ) {
    const environment = await this.database.client.environment.findFirst({
      where: {
        id: environmentId,
        projectId,

        project: {
          organizationId,
        },
      },

      select: {
        id: true,
        url: true,
      },
    });

    if (!environment) {
      throw new NotFoundException('Environment not found');
    }

    const scan = await this.database.client.scan.create({
      data: {
        environmentId,
        targetUrl: environment.url,

        status: ScanStatus.PENDING,
        trigger: ScanTrigger.MANUAL,
        deviceType: DeviceType.DESKTOP,
      },
    });

    try {
      await this.scanQueue.enqueue(scan.id);

      return await this.database.client.scan.update({
        where: {
          id: scan.id,
        },

        data: {
          status: ScanStatus.QUEUED,
        },

        select: {
          id: true,
          status: true,
          trigger: true,
          targetUrl: true,
          deviceType: true,
          createdAt: true,
        },
      });
    } catch {
      await this.database.client.scan.update({
        where: {
          id: scan.id,
        },

        data: {
          status: ScanStatus.FAILED,
          failureCode: 'QUEUE_UNAVAILABLE',
          failureMessage: 'Unable to queue scan for execution',
        },
      });

      throw new ServiceUnavailableException('Unable to schedule scan');
    }
  }

  async findOne(
    organizationId: string,
    projectId: string,
    environmentId: string,
    scanId: string,
  ) {
    const scan = await this.database.client.scan.findFirst({
      where: {
        id: scanId,
        environmentId,

        environment: {
          projectId,

          project: {
            organizationId,
          },
        },
      },

      select: {
        id: true,
        environmentId: true,

        status: true,
        trigger: true,

        targetUrl: true,
        deviceType: true,

        browserName: true,
        browserVersion: true,

        startedAt: true,
        completedAt: true,

        failureCode: true,
        failureMessage: true,

        createdAt: true,
        updatedAt: true,

        metrics: {
          select: {
            id: true,
            category: true,
            key: true,
            value: true,
            unit: true,
            metadata: true,
          },

          orderBy: {
            key: 'asc',
          },
        },
      },
    });

    if (!scan) {
      throw new NotFoundException('Scan not found');
    }

    return scan;
  }

  async findAll(
    organizationId: string,
    projectId: string,
    environmentId: string,
  ) {
    return this.database.client.scan.findMany({
      where: {
        environmentId,

        environment: {
          projectId,

          project: {
            organizationId,
          },
        },
      },

      select: {
        id: true,
        environmentId: true,

        status: true,
        trigger: true,

        targetUrl: true,
        deviceType: true,

        browserName: true,
        browserVersion: true,

        startedAt: true,
        completedAt: true,

        failureCode: true,
        failureMessage: true,

        createdAt: true,
        updatedAt: true,
      },

      orderBy: {
        createdAt: 'desc',
      },

      take: 50,
    });
  }
  async findAllForOrganization(organizationId: string) {
    return this.database.client.scan.findMany({
      where: {
        environment: {
          project: {
            organizationId,
          },
        },
      },

      select: {
        id: true,

        status: true,
        trigger: true,

        targetUrl: true,
        deviceType: true,

        browserName: true,
        browserVersion: true,

        startedAt: true,
        completedAt: true,

        failureCode: true,
        failureMessage: true,

        createdAt: true,
        updatedAt: true,

        environment: {
          select: {
            id: true,
            name: true,
            type: true,

            project: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },

      orderBy: {
        createdAt: 'desc',
      },

      take: 50,
    });
  }
  async findOneForOrganization(organizationId: string, scanId: string) {
    const scan = await this.database.client.scan.findFirst({
      where: {
        id: scanId,

        environment: {
          project: {
            organizationId,
          },
        },
      },

      select: {
        id: true,

        status: true,
        trigger: true,

        targetUrl: true,
        deviceType: true,

        browserName: true,
        browserVersion: true,

        startedAt: true,
        completedAt: true,

        failureCode: true,
        failureMessage: true,

        createdAt: true,
        updatedAt: true,

        environment: {
          select: {
            id: true,
            name: true,
            type: true,

            project: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },

        metrics: {
          select: {
            id: true,
            category: true,
            key: true,
            value: true,
            unit: true,
            metadata: true,
          },

          orderBy: {
            key: 'asc',
          },
        },
      },
    });

    if (!scan) {
      throw new NotFoundException('Scan not found');
    }

    return scan;
  }
}
