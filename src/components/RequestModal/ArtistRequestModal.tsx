import Alert from '@app/components/Common/Alert';
import Modal from '@app/components/Common/Modal';
import type { RequestOverrides } from '@app/components/RequestModal/AdvancedRequester';
import AdvancedRequester from '@app/components/RequestModal/AdvancedRequester';
import QuotaDisplay from '@app/components/RequestModal/QuotaDisplay';
import { useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import { MediaStatus, SecondaryType } from '@server/constants/media';
import type { MediaRequest } from '@server/entity/MediaRequest';
import type { QuotaResponse } from '@server/interfaces/api/userInterfaces';
import { Permission } from '@server/lib/permissions';
import type { ArtistResult } from '@server/models/Search';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR, { mutate } from 'swr';

const messages = defineMessages({
  requestadmin: 'This request will be approved automatically.',
  requestSuccess: '<strong>{title}</strong> requested successfully!',
  requestCancel: 'Request for <strong>{title}</strong> canceled.',
  requestartisttitle: 'Request Artist',
  edit: 'Edit Request',
  approve: 'Approve Request',
  cancel: 'Cancel Request',
  pendingrequest: 'Pending Artist Request',
  requestfrom: "{username}'s request is pending approval.",
  errorediting: 'Something went wrong while editing the request.',
  requestedited: 'Request for <strong>{title}</strong> edited successfully!',
  requestApproved: 'Request for <strong>{title}</strong> approved!',
  requesterror: 'Something went wrong while submitting the request.',
  pendingapproval: 'Your request is pending approval.',
});

interface RequestModalProps extends React.HTMLAttributes<HTMLDivElement> {
  mbId: string;
  editRequest?: MediaRequest;
  onCancel?: () => void;
  onComplete?: (newStatus: MediaStatus) => void;
  onUpdating?: (isUpdating: boolean) => void;
}

const ArtistRequestModal = ({
  onCancel,
  onComplete,
  mbId,
  onUpdating,
  editRequest,
}: RequestModalProps) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [requestOverrides, setRequestOverrides] =
    useState<RequestOverrides | null>(null);
  const { addToast } = useToasts();
  const { data, error } = useSWR<ArtistResult>(`/api/v1/music/artist/${mbId}`, {
    revalidateOnMount: true,
  });
  const intl = useIntl();
  const { user, hasPermission } = useUser();
  const { data: quota } = useSWR<QuotaResponse>(
    user &&
      (!requestOverrides?.user?.id || hasPermission(Permission.MANAGE_USERS))
      ? `/api/v1/user/${requestOverrides?.user?.id ?? user.id}/quota`
      : null
  );

  useEffect(() => {
    if (onUpdating) {
      onUpdating(isUpdating);
    }
  }, [isUpdating, onUpdating]);

  const sendRequest = useCallback(async () => {
    setIsUpdating(true);

    try {
      let overrideParams = {};
      if (requestOverrides) {
        overrideParams = {
          serverId: requestOverrides.server,
          profileId: requestOverrides.profile,
          rootFolder: requestOverrides.folder,
          userId: requestOverrides.user?.id,
          tags: requestOverrides.tags,
        };
      }
      const response = await axios.post<MediaRequest>('/api/v1/request', {
        mediaId: data?.id,
        mediaType: 'music',
        secondaryType: 'artist',
        ...overrideParams,
      });
      mutate('/api/v1/request?filter=all&take=10&sort=modified&skip=0');

      if (response.data) {
        if (onComplete) {
          onComplete(
            hasPermission(Permission.AUTO_APPROVE) ||
              hasPermission(Permission.AUTO_APPROVE_MUSIC)
              ? MediaStatus.PROCESSING
              : MediaStatus.PENDING
          );
        }
        addToast(
          <span>
            {intl.formatMessage(messages.requestSuccess, {
              title: data?.name,
              strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
            })}
          </span>,
          { appearance: 'success', autoDismiss: true }
        );
      }
    } catch (e) {
      addToast(intl.formatMessage(messages.requesterror), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setIsUpdating(false);
    }
  }, [data, onComplete, addToast, requestOverrides, hasPermission, intl]);

  const cancelRequest = async () => {
    setIsUpdating(true);

    try {
      const response = await axios.delete<MediaRequest>(
        `/api/v1/request/${editRequest?.id}`
      );
      mutate('/api/v1/request?filter=all&take=10&sort=modified&skip=0');

      if (response.status === 204) {
        if (onComplete) {
          onComplete(MediaStatus.UNKNOWN);
        }
        addToast(
          <span>
            {intl.formatMessage(messages.requestCancel, {
              title: data?.name,
              strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
            })}
          </span>,
          { appearance: 'success', autoDismiss: true }
        );
      }
    } catch (e) {
      setIsUpdating(false);
    }
  };

  const updateRequest = async (alsoApproveRequest = false) => {
    setIsUpdating(true);

    try {
      await axios.put(`/api/v1/request/${editRequest?.id}`, {
        mediaType: 'music',
        secondaryType: 'artist',
        serverId: requestOverrides?.server,
        profileId: requestOverrides?.profile,
        rootFolder: requestOverrides?.folder,
        userId: requestOverrides?.user?.id,
        tags: requestOverrides?.tags,
      });

      if (alsoApproveRequest) {
        await axios.post(`/api/v1/request/${editRequest?.id}/approve`);
      }
      mutate('/api/v1/request?filter=all&take=10&sort=modified&skip=0');

      addToast(
        <span>
          {intl.formatMessage(
            alsoApproveRequest
              ? messages.requestApproved
              : messages.requestedited,
            {
              title: data?.name,
              strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
            }
          )}
        </span>,
        {
          appearance: 'success',
          autoDismiss: true,
        }
      );

      if (onComplete) {
        onComplete(MediaStatus.PENDING);
      }
    } catch (e) {
      addToast(<span>{intl.formatMessage(messages.errorediting)}</span>, {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (editRequest) {
    const isOwner = editRequest.requestedBy.id === user?.id;

    return (
      <Modal
        loading={!data && !error}
        backgroundClickable
        onCancel={onCancel}
        title={intl.formatMessage(messages.pendingrequest)}
        subTitle={data?.name}
        onOk={() =>
          hasPermission(Permission.MANAGE_REQUESTS)
            ? updateRequest(true)
            : hasPermission(Permission.REQUEST_ADVANCED)
            ? updateRequest()
            : cancelRequest()
        }
        okDisabled={isUpdating}
        okText={
          hasPermission(Permission.MANAGE_REQUESTS)
            ? intl.formatMessage(messages.approve)
            : hasPermission(Permission.REQUEST_ADVANCED)
            ? intl.formatMessage(messages.edit)
            : intl.formatMessage(messages.cancel)
        }
        okButtonType={
          hasPermission(Permission.MANAGE_REQUESTS)
            ? 'success'
            : hasPermission(Permission.REQUEST_ADVANCED)
            ? 'primary'
            : 'danger'
        }
        onSecondary={
          isOwner &&
          hasPermission(
            [Permission.REQUEST_ADVANCED, Permission.MANAGE_REQUESTS],
            { type: 'or' }
          )
            ? () => cancelRequest()
            : undefined
        }
        secondaryDisabled={isUpdating}
        secondaryText={
          isOwner &&
          hasPermission(
            [Permission.REQUEST_ADVANCED, Permission.MANAGE_REQUESTS],
            { type: 'or' }
          )
            ? intl.formatMessage(messages.cancel)
            : undefined
        }
        secondaryButtonType="danger"
        cancelText={intl.formatMessage(globalMessages.close)}
        backdrop={data?.posterPath}
      >
        {isOwner
          ? intl.formatMessage(messages.pendingapproval)
          : intl.formatMessage(messages.requestfrom, {
              username: editRequest.requestedBy.displayName,
            })}
        {(hasPermission(Permission.REQUEST_ADVANCED) ||
          hasPermission(Permission.MANAGE_REQUESTS)) && (
          <AdvancedRequester
            type="music"
            secondaryType={SecondaryType.ARTIST}
            requestUser={editRequest.requestedBy}
            defaultOverrides={{
              folder: editRequest.rootFolder,
              profile: editRequest.profileId,
              server: editRequest.serverId,
              tags: editRequest.tags,
            }}
            onChange={(overrides) => {
              setRequestOverrides(overrides);
            }}
          />
        )}
      </Modal>
    );
  }

  const hasAutoApprove = hasPermission(
    [
      Permission.MANAGE_REQUESTS,
      Permission.AUTO_APPROVE,
      Permission.AUTO_APPROVE_MUSIC,
    ],
    { type: 'or' }
  );

  return (
    <Modal
      loading={(!data && !error) || !quota}
      backgroundClickable
      onCancel={onCancel}
      onOk={sendRequest}
      okDisabled={isUpdating || quota?.music.restricted}
      title={intl.formatMessage(messages.requestartisttitle)}
      subTitle={data?.name}
      okText={
        isUpdating
          ? intl.formatMessage(globalMessages.requesting)
          : intl.formatMessage(globalMessages.request)
      }
      okButtonType={'primary'}
      backdrop={data?.posterPath}
    >
      {hasAutoApprove && !quota?.music.restricted && (
        <div className="mt-6">
          <Alert
            title={intl.formatMessage(messages.requestadmin)}
            type="info"
          />
        </div>
      )}
      {(quota?.music.limit ?? 0) > 0 && (
        <QuotaDisplay
          mediaType="music"
          secondaryType={SecondaryType.ARTIST}
          quota={quota?.music}
          userOverride={
            requestOverrides?.user && requestOverrides.user.id !== user?.id
              ? requestOverrides?.user?.id
              : undefined
          }
        />
      )}
      {(hasPermission(Permission.REQUEST_ADVANCED) ||
        hasPermission(Permission.MANAGE_REQUESTS)) && (
        <AdvancedRequester
          type="music"
          secondaryType={SecondaryType.ARTIST}
          onChange={(overrides) => {
            setRequestOverrides(overrides);
          }}
        />
      )}
    </Modal>
  );
};

export default ArtistRequestModal;
