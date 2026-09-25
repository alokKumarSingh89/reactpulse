import type {
  NetworkObservation,
  NetworkResponseObservation,
} from './network.types';

export interface NetworkMetricInput {
  category: 'NETWORK' | 'RESOURCE';

  key: string;

  value: number;

  unit: string;

  metadata?: Record<string, unknown>;
}

export function mapNetworkMetrics(
  observation: NetworkObservation,
): NetworkMetricInput[] {
  const { requests, responses, failures } = observation;

  const metrics: NetworkMetricInput[] = [];

  const totalTransferSize = sumResponseValue(
    responses,
    (response) => response.transferSize,
  );

  const thirdPartyResponses = responses.filter(
    (response) => response.party === 'THIRD_PARTY',
  );

  const thirdPartyTransferSize = sumResponseValue(
    thirdPartyResponses,
    (response) => response.transferSize,
  );

  const apiRequests = requests.filter((request) =>
    isApiResourceType(request.resourceType),
  );

  metrics.push(
    {
      category: 'NETWORK',
      key: 'request_count',
      value: requests.length,
      unit: 'count',
    },

    {
      category: 'NETWORK',
      key: 'response_count',
      value: responses.length,
      unit: 'count',
    },

    {
      category: 'NETWORK',
      key: 'failed_request_count',
      value: failures.length,
      unit: 'count',
    },

    {
      category: 'NETWORK',
      key: 'third_party_request_count',
      value: requests.filter((request) => request.party === 'THIRD_PARTY')
        .length,
      unit: 'count',
    },

    {
      category: 'NETWORK',
      key: 'third_party_transfer_size',
      value: thirdPartyTransferSize,
      unit: 'bytes',
    },

    {
      category: 'NETWORK',
      key: 'api_request_count',
      value: apiRequests.length,
      unit: 'count',
    },
    {
      category: 'NETWORK',

      key: 'third_party_request_percentage',

      value: calculatePercentage(
        requests.filter((request) => request.party === 'THIRD_PARTY').length,

        requests.length,
      ),

      unit: 'percent',
    },
    {
      category: 'RESOURCE',
      key: 'transfer_size',
      value: totalTransferSize,
      unit: 'bytes',
    },
  );

  addResourceMetric(metrics, responses, 'script', 'javascript_transfer_size');

  addResourceMetric(
    metrics,
    responses,
    'stylesheet',
    'stylesheet_transfer_size',
  );

  addResourceMetric(metrics, responses, 'image', 'image_transfer_size');

  addResourceMetric(metrics, responses, 'font', 'font_transfer_size');

  return metrics;
}

function addResourceMetric(
  metrics: NetworkMetricInput[],

  responses: NetworkResponseObservation[],

  resourceType: string,

  key: string,
): void {
  const matching = responses.filter(
    (response) => response.resourceType === resourceType,
  );

  metrics.push({
    category: 'RESOURCE',

    key,

    value: sumResponseValue(matching, (response) => response.transferSize),

    unit: 'bytes',
  });
}

function sumResponseValue(
  responses: NetworkResponseObservation[],

  selector: (response: NetworkResponseObservation) => number | null,
): number {
  return responses.reduce((total, response) => {
    const value = selector(response);

    if (value === null || !Number.isFinite(value)) {
      return total;
    }

    return total + value;
  }, 0);
}

function isApiResourceType(resourceType: string): boolean {
  return resourceType === 'fetch' || resourceType === 'xhr';
}

function calculatePercentage(value: number, total: number): number {
  if (total === 0) {
    return 0;
  }

  return (value / total) * 100;
}
