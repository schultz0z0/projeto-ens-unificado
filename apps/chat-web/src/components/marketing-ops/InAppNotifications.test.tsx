// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MarketingOpsClient } from '@/lib/marketingOps/client';
import type {
  MarketingOpsInAppNotification,
  MarketingOpsResult
} from '@/lib/marketingOps/types';
import { InAppNotifications } from './InAppNotifications';

const notification = (
  overrides: Partial<MarketingOpsInAppNotification> = {}
): MarketingOpsInAppNotification => ({
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  eventKey: 'assignment:item-1',
  notificationType: 'assignment',
  campaignId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  itemId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  label: 'Novo item atribuído',
  payload: {
    campaignId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    itemId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    dueAt: null,
    priority: 'normal'
  },
  occurredAt: '2026-07-19T12:00:00.000Z',
  readAt: null,
  createdAt: '2026-07-19T12:00:00.000Z',
  ...overrides
});

const result = <T,>(data: T): MarketingOpsResult<T> => ({
  data,
  correlationId: 'corr-notifications',
  etag: null
});

function renderNotifications(client: MarketingOpsClient) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <InAppNotifications
        client={client}
        canMarkRead
        createIdempotencyKey={() => 'idem-notification-ui'}
      />
    </QueryClientProvider>
  );
}

afterEach(() => cleanup());

describe('InAppNotifications', () => {
  it('announces unread events and marks only unread notifications with an idempotency key', async () => {
    const unread = notification();
    const read = notification({
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      eventKey: 'overdue:item-2',
      itemId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      notificationType: 'overdue',
      label: 'Item em atraso',
      readAt: '2026-07-19T13:00:00.000Z'
    });
    const markInAppNotificationsRead = vi.fn().mockResolvedValue(result([
      { ...unread, readAt: '2026-07-19T14:00:00.000Z' }
    ]));
    const client = {
      listInAppNotifications: vi.fn().mockResolvedValue(result([unread, read])),
      markInAppNotificationsRead
    } as unknown as MarketingOpsClient;
    const user = userEvent.setup();
    renderNotifications(client);

    const trigger = await screen.findByRole('button', { name: /notificações, 1 não lida/i });
    await user.click(trigger);
    expect(await screen.findByText('Novo item atribuído')).toBeTruthy();
    expect(screen.getByText('Item em atraso')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /marcar todas como lidas/i }));
    await waitFor(() => expect(markInAppNotificationsRead).toHaveBeenCalledWith(
      [unread.id],
      'idem-notification-ui'
    ));
  });

  it('exposes a retry state without leaking the backend error', async () => {
    const client = {
      listInAppNotifications: vi.fn().mockRejectedValue(new Error('secret backend detail'))
    } as unknown as MarketingOpsClient;
    const user = userEvent.setup();
    renderNotifications(client);

    await user.click(await screen.findByRole('button', { name: /notificações/i }));
    expect(await screen.findByText(/não foi possível carregar as notificações/i))
      .toBeTruthy();
    expect(screen.queryByText(/secret backend detail/i)).toBeNull();
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeTruthy();
  });
});
